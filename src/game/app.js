// 應用程式：啟動流程（載入畫面 → 開場 → 遊戲）、旋轉／自動／購買／押注，把引擎、場景與 UI 接起來。
import { LocalDemo } from '../engine/demoServer.js';
import { Rng } from '../engine/rng.js';
import { SYM } from '../engine/config.js';
import { GameScene } from '../render/scene.js';
import { Board } from '../render/board.js';
import { Effects } from '../render/effects.js';
import { Characters } from '../render/characters.js';
import { Sfx } from '../audio/sfx.js';
import { Hud } from '../ui/hud.js';
import { Popups } from '../ui/popups.js';
import { Panels, betOptions } from '../ui/panels.js';
import { mountTestPanel } from '../ui/testpanel.js';
import { Sequencer } from './sequencer.js';
import { indexOfPos } from '../engine/round.js';
import { validateArt } from '../render/symbols.js';
import { iconDataURL } from '../render/icons.js';

const TIPS = [
  '出現 3 個聖甲蟲＋1 個黃金聖甲蟲，立即觸發【覺醒之力】',
  '4 個以上聖甲蟲觸發免費遊戲，獲得 15 次免費場次',
  '3 個賽特圖騰＋任 1 個倍數球，盤面倍數球分裂',
  '3 個奈芙蒂斯圖騰＋任 1 個倍數球，倍數球鎖定數回合',
  '倍數球帶來 2 倍至 500 倍的隨機倍數',
  '盤面任意位置均支付，最高贏得 81,000 倍',
];

// 把伺服器格式的 view（1..18）轉回盤面 cell，供開場盤面使用。
function viewToBoard(view, timesSymbols = []) {
  const board = new Array(30);
  const times = new Map(timesSymbols.map((t) => [t.symbolPos, t]));
  view.forEach((row, r) => row.forEach((id, c) => {
    const pos = r * 6 + c;
    const i = indexOfPos(pos);
    let cell;
    if (id >= 1 && id <= 9) cell = { s: id - 1, v: 0, rare: false, lock: 0 };
    else if (id >= 10 && id <= 13) { const t = times.get(pos); cell = { s: SYM.ORB, v: t?.times ?? [100, 50, 10, 5][id - 10], rare: !!t?.isRare, lock: t?.lock ?? 0 }; }
    else cell = { s: { 14: SYM.JP, 15: SYM.SCATTER, 16: SYM.GOLD_SCATTER, 17: SYM.SET_TOTEM, 18: SYM.NEPH_TOTEM }[id], v: 0, rare: false, lock: 0 };
    board[i] = cell;
  }));
  return board;
}

const INITIAL_VIEW = [
  [1, 13, 3, 8, 2, 1],
  [9, 13, 6, 7, 4, 9],
  [9, 1, 6, 7, 1, 1],
  [6, 1, 9, 4, 15, 2],
  [6, 6, 4, 5, 5, 9],
];
const INITIAL_TIMES = [{ symbol: 13, symbolPos: 1, times: 4, isRare: false, lock: 0 }, { symbol: 13, symbolPos: 7, times: 4, isRare: true, lock: 0 }];

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.params = params;
    if (params.has('reset')) {
      try {
        localStorage.removeItem('slot3d.demo.v1');
      } catch {
        /* 無法存取儲存空間時直接以預設值開始 */
      }
    }
    const seed = params.get('seed');
    this.demo = new LocalDemo({ rng: seed ? Rng.fromString(seed) : new Rng() });
    this.busy = false;
    this.auto = null; // { remaining }
    this.ready = false;
    this.lastRecord = null;
  }

  async boot() {
    const splash = document.getElementById('bootSplash');
    const pct = splash.querySelector('.splash-pct');
    const tip = splash.querySelector('.splash-tip');
    const setProgress = (p) => { pct.textContent = `${Math.round(p * 100)}%`; splash.style.setProperty('--p', p); };
    let tipIndex = Math.floor(Math.random() * TIPS.length);
    tip.textContent = TIPS[tipIndex];
    const tipTimer = setInterval(() => { tipIndex = (tipIndex + 1) % TIPS.length; tip.textContent = TIPS[tipIndex]; }, 3000);
    setProgress(0.1);
    const bad = validateArt();
    if (bad.length) console.warn('symbol art problems', bad);
    await document.fonts?.ready;
    setProgress(0.3);

    const canvas = document.getElementById('GameCanvas');
    this.scene = new GameScene(canvas);
    this.sfx = new Sfx();
    this.effects = new Effects(this.scene.scene, { sfx: (n) => this.sfx.play(n) });
    this.board = new Board(this.scene.scene, this.effects);
    this.characters = new Characters(this.scene.scene, this.effects);
    setProgress(0.6);

    this.hud = new Hud(document.getElementById('hud'), {
      spin: () => this.onSpinButton(),
      'bet-': () => this.stepBet(-1),
      'bet+': () => this.stepBet(1),
      menu: () => this.panels.menu(),
      buy: () => this.panels.buyFeature(),
      auto: () => (this.auto ? this.stopAutoplay() : this.panels.autoplay()),
      turbo: () => this.setTurbo(!this.demo.settings.turbo),
    });
    this.popups = new Popups(document.getElementById('popups'));
    this.panels = new Panels(document.getElementById('modal'), this);
    this.sequencer = new Sequencer({ board: this.board, hud: this.hud, popups: this.popups, scene: this.scene, effects: this.effects, characters: this.characters, sfx: this.sfx });
    this.sequencer.setFast(this.params.has('fast'));
    this.applySettings({});
    this.hud.setBalance(this.demo.balanceMoney, { animate: false });
    this.hud.setBet(this.demo.bet);
    this.hud.setJackpots(this.demo.jackpots());
    this.hud.setWin(0, { animate: false });
    this.board.setBoard(viewToBoard(INITIAL_VIEW, INITIAL_TIMES));
    setProgress(0.85);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !this.panels.isOpen && document.getElementById('intro').hidden) {
        e.preventDefault();
        this.onSpinButton();
      }
    });
    if (this.params.has('test')) mountTestPanel(this);
    this.startLoop();
    setProgress(1);
    clearInterval(tipTimer);
    await new Promise((r) => setTimeout(r, 250));
    splash.classList.add('done');
    setTimeout(() => splash.remove(), 700);
    window.__game = this;
    await this.showIntro();
    document.getElementById('hud').hidden = false;
    this.sfx.setMusic('mg');
    this.ready = true;
  }

  startLoop() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.scene.update(dt);
      this.board.update(dt);
      this.effects.update(dt);
      this.characters.update(dt);
      this.scene.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 開場畫面：特色介紹 + 開始按鈕。
  showIntro({ fromMenu = false } = {}) {
    const intro = document.getElementById('intro');
    if (fromMenu) this.panels.close();
    intro.innerHTML = `
      <div class="intro-box mc-panel">
        <div class="intro-title"><b>戰神賽特 II</b><span>覺醒之力・麥塊版</span></div>
        <div class="intro-cards">
          <div class="intro-card"><img alt="" src="${iconDataURL({ s: SYM.SCATTER, v: 0, rare: false, lock: 0 }, 72)}"><b>免費遊戲</b><span>4 個以上聖甲蟲 → 15 次免費場次，倍數累加</span></div>
          <div class="intro-card"><img alt="" src="${iconDataURL({ s: SYM.GOLD_SCATTER, v: 0, rare: false, lock: 0 }, 72)}"><b>覺醒之力</b><span>黃金聖甲蟲 → 圖騰技能：分裂／鎖定</span></div>
          <div class="intro-card"><img alt="" src="${iconDataURL({ s: SYM.ORB, v: 500, rare: true, lock: 0 }, 72)}"><b>倍數球</b><span>2x ～ 500x 隨機倍數，最高 81,000 倍</span></div>
          <div class="intro-card"><img alt="" src="${iconDataURL({ s: SYM.JP, v: 0, rare: false, lock: 0 }, 72)}"><b>JACKPOT</b><span>2～5 個 JP → MINI / MINOR / MAJOR / GRAND</span></div>
        </div>
        <button class="mc-btn wide primary big" data-start>${fromMenu ? '回到遊戲' : '開始遊戲'}</button>
        <div class="intro-note">本地試玩：所有結果由瀏覽器內模擬引擎產生，點數無任何價值。</div>
      </div>`;
    intro.hidden = false;
    return new Promise((resolve) => {
      intro.querySelector('[data-start]').addEventListener('click', () => {
        intro.hidden = true;
        this.sfx.unlock();
        this.sfx.play('click');
        resolve();
      }, { once: true });
    });
  }

  applySettings(patch) {
    const s = this.demo.updateSettings(patch);
    this.sfx.applySettings(s.sounds);
    this.sequencer.setTurbo(s.turbo);
    this.hud.setTurbo(s.turbo);
  }

  setTurbo(on) {
    this.applySettings({ turbo: on });
    this.sfx.play('click');
  }

  setBet(stakeIndex, ratioIndex) {
    this.demo.updateSettings({ stakeIndex, ratioIndex });
    this.hud.setBet(this.demo.bet);
    this.hud.setJackpots(this.demo.jackpots());
    this.sfx.play('click');
  }

  stepBet(dir) {
    if (this.busy) return;
    const options = (this.betOptions ??= betOptions());
    const i = options.findIndex((o) => o.total === this.demo.bet);
    const next = options[Math.max(0, Math.min(options.length - 1, i + dir))];
    if (next && next.total !== this.demo.bet) this.setBet(next.stakeIndex, next.ratioIndex);
  }

  onSpinButton() {
    if (this.busy) {
      this.sequencer.requestSkip();
      return;
    }
    if (this.auto) {
      this.stopAutoplay();
      return;
    }
    this.spin();
  }

  // 下注一轉（或購買特色），並演出。
  async spin({ featureIndex = null } = {}) {
    if (this.busy || !this.ready) return null;
    let record;
    try {
      record = this.demo.spin({ featureIndex });
    } catch (e) {
      this.hud.toast(e.message, 'error');
      this.stopAutoplay();
      return null;
    }
    this.busy = true;
    this.hud.setSpinEnabled(false);
    this.sfx.play('click');
    this.hud.setBalance(this.demo.balanceMoney - record.win / 100);
    this.lastRecord = record;
    try {
      await this.sequencer.play(record);
    } catch (e) {
      console.error('presentation failed', e);
    }
    this.demo.closeSpin(record.id);
    await this.hud.setBalance(this.demo.balanceMoney);
    this.hud.setWin(record.win / 100, { animate: false });
    this.busy = false;
    this.hud.setSpinEnabled(true);
    this.continueAutoplay(record);
    return record;
  }

  buyFeature(i) {
    return this.spin({ featureIndex: i });
  }

  startAutoplay(count) {
    this.auto = { remaining: count };
    this.hud.setAutoState(count);
    if (!this.busy) this.spin();
  }

  stopAutoplay() {
    this.auto = null;
    this.hud.setAutoState(null);
  }

  continueAutoplay(record) {
    if (!this.auto) return;
    const s = this.demo.settings.autoPlay;
    if (this.auto.remaining > 0) this.auto.remaining--;
    const winX = record.win / 100 / record.bet;
    let stop = false;
    if (this.auto.remaining === 0) stop = true;
    if (s.stopOnWinMultiplier && winX >= s.stopOnWinMultiplierValue) stop = true;
    if (s.stopOnJackpot && record.views.some((v) => v.isJp)) stop = true;
    if (s.stopOnFreeSpin && record.hasFree) stop = true;
    if (s.stopOnBalance && this.demo.balanceMoney < s.stopOnBalanceValue) stop = true;
    if (this.demo.balance < Math.round(this.demo.bet * 100)) stop = true;
    if (stop) {
      this.stopAutoplay();
      return;
    }
    this.hud.setAutoState(this.auto.remaining);
    setTimeout(() => { if (this.auto && !this.busy) this.spin(); }, this.sequencer.fast ? 20 : 350);
  }

  // e2e／除錯用的狀態快照
  state() {
    return { idle: !this.busy && this.ready, balance: this.demo.balanceMoney, lastWin: this.lastRecord ? this.lastRecord.win / 100 : 0, bet: this.demo.bet, auto: this.auto, theme: this.scene.theme, cells: this.board.cellObjects().length };
  }
}

