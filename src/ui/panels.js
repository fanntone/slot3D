// 面板：選單、押注、自動旋轉、設定、購買特色、規則／賠率、紀錄、開場。麥塊 GUI 風格。
import { fmt, el } from './format.js';
import { STAKE_VALUES, RATIO_VALUES, totalBet, BUY_FEATURES, AUTOPLAY_COUNTS, PAYTABLE, SYM, SYMBOL_NAMES, SCATTER_PAY, JACKPOTS, ORB_VALUES } from '../engine/config.js';
import { iconDataURL } from '../render/icons.js';

// 所有可選的總押注（去重、排序），每個值對應第一組 (stakeIndex, ratioIndex)。
export function betOptions() {
  const map = new Map();
  STAKE_VALUES.forEach((s, si) => RATIO_VALUES.forEach((r, ri) => {
    const t = totalBet(si, ri);
    if (!map.has(t)) map.set(t, { total: t, stakeIndex: si, ratioIndex: ri });
  }));
  return [...map.values()].sort((a, b) => a.total - b.total);
}

const icon = (s, size = 44, extra = {}) => `<img class="sym-icon" alt="${SYMBOL_NAMES[s] ?? ''}" src="${iconDataURL({ s, v: 0, rare: false, lock: 0, ...extra }, size)}">`;
const orbIcon = (v, rare = false, size = 44) => `<img class="sym-icon" alt="倍數球 ${v}x" src="${iconDataURL({ s: SYM.ORB, v, rare, lock: 0 }, size)}">`;

export class Panels {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.node = null;
    this.onClose = null;
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.node) this.close();
    });
  }

  get isOpen() {
    return !!this.node;
  }

  open(title, bodyHtml, { wide = false, onClose = null, closable = true } = {}) {
    this.close();
    const node = el('div', `mc-modal ${wide ? 'wide' : ''}`, `
      <div class="mc-panel panel">
        <div class="panel-head"><b>${title}</b>${closable ? '<button class="mc-btn sq" data-close aria-label="關閉">×</button>' : ''}</div>
        <div class="panel-body">${bodyHtml}</div>
      </div>`);
    this.root.append(node);
    this.root.hidden = false;
    node.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    this.node = node;
    this.onClose = onClose;
    return node;
  }

  close() {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    this.root.hidden = true;
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  menu() {
    const node = this.open('選單', `
      <div class="menu-grid">
        <button class="mc-btn wide" data-m="rules">遊戲規則 / 賠率表</button>
        <button class="mc-btn wide" data-m="bet">押注設定</button>
        <button class="mc-btn wide" data-m="auto">自動旋轉</button>
        <button class="mc-btn wide" data-m="settings">音效與速度</button>
        <button class="mc-btn wide" data-m="records">下注紀錄</button>
        <button class="mc-btn wide" data-m="intro">遊戲介紹</button>
      </div>`);
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const fn = { rules: () => this.rules(), bet: () => this.bet(), auto: () => this.autoplay(), settings: () => this.settings(), records: () => this.records(), intro: () => this.game.showIntro({ fromMenu: true }) }[b.dataset.m];
      fn?.();
    });
  }

  bet() {
    const options = betOptions();
    const cur = this.game.demo.bet;
    const node = this.open('押注設定', `
      <div class="bet-grid">${options.map((o) => `<button class="mc-btn bet-opt ${o.total === cur ? 'active' : ''}" data-bet="${o.total}">${fmt(o.total)}</button>`).join('')}</div>
      <div class="panel-note">總押注 = 籌碼 × 倍率 × 20 線。目前：<b>${fmt(cur)}</b></div>`, { wide: true });
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bet]');
      if (!b) return;
      const opt = options.find((o) => o.total === Number(b.dataset.bet));
      this.game.setBet(opt.stakeIndex, opt.ratioIndex);
      this.close();
    });
  }

  autoplay() {
    const s = this.game.demo.settings.autoPlay;
    const node = this.open('自動旋轉', `
      <div class="auto-counts">${AUTOPLAY_COUNTS.map((c) => `<button class="mc-btn ${c === s.count ? 'active' : ''}" data-count="${c}">${c < 0 ? '∞' : c}</button>`).join('')}</div>
      <label class="mc-check"><input type="checkbox" data-opt="stopOnWinMultiplier" ${s.stopOnWinMultiplier ? 'checked' : ''}> 單局贏分達押注 <input type="number" class="mc-input" data-opt-num="stopOnWinMultiplierValue" value="${s.stopOnWinMultiplierValue}" min="1" max="10000"> 倍時停止</label>
      <label class="mc-check"><input type="checkbox" data-opt="stopOnJackpot" ${s.stopOnJackpot ? 'checked' : ''}> 中彩金時停止</label>
      <label class="mc-check"><input type="checkbox" data-opt="stopOnFreeSpin" ${s.stopOnFreeSpin ? 'checked' : ''}> 進入免費遊戲時停止</label>
      <label class="mc-check"><input type="checkbox" data-opt="stopOnBalance" ${s.stopOnBalance ? 'checked' : ''}> 餘額低於 <input type="number" class="mc-input" data-opt-num="stopOnBalanceValue" value="${s.stopOnBalanceValue}" min="0"> 時停止</label>
      <button class="mc-btn wide primary" data-start>開始自動旋轉</button>`);
    let count = s.count;
    node.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
      count = Number(b.dataset.count);
      node.querySelectorAll('[data-count]').forEach((x) => x.classList.toggle('active', x === b));
    }));
    node.querySelector('[data-start]').addEventListener('click', () => {
      const patch = { autoPlay: { count } };
      node.querySelectorAll('[data-opt]').forEach((i) => { patch.autoPlay[i.dataset.opt] = i.checked; });
      node.querySelectorAll('[data-opt-num]').forEach((i) => { patch.autoPlay[i.dataset.optNum] = Number(i.value) || 0; });
      this.game.demo.updateSettings(patch);
      this.close();
      this.game.startAutoplay(count);
    });
  }

  settings() {
    const s = this.game.demo.settings;
    const node = this.open('音效與速度', `
      <label class="mc-check"><input type="checkbox" data-s="sounds.background" ${s.sounds.background ? 'checked' : ''}> 背景音樂</label>
      <label class="mc-range">音樂音量 <input type="range" min="0" max="1" step="0.02" data-r="sounds.backgroundVolume" value="${s.sounds.backgroundVolume}"></label>
      <label class="mc-check"><input type="checkbox" data-s="sounds.effect" ${s.sounds.effect ? 'checked' : ''}> 音效</label>
      <label class="mc-range">音效音量 <input type="range" min="0" max="1" step="0.02" data-r="sounds.effectVolume" value="${s.sounds.effectVolume}"></label>
      <label class="mc-check"><input type="checkbox" data-s="turbo" ${s.turbo ? 'checked' : ''}> 快速模式（加速所有演出）</label>
      <button class="mc-btn wide danger" data-reset>重置點數為 100,000（重新載入）</button>`);
    const apply = () => {
      const patch = { sounds: {} };
      node.querySelectorAll('[data-s]').forEach((i) => {
        const [a, b] = i.dataset.s.split('.');
        if (b) patch[a][b] = i.checked; else patch[a] = i.checked;
      });
      node.querySelectorAll('[data-r]').forEach((i) => {
        const [a, b] = i.dataset.r.split('.');
        patch[a][b] = Number(i.value);
      });
      this.game.applySettings(patch);
    };
    node.addEventListener('change', apply);
    node.addEventListener('input', apply);
    const reset = node.querySelector('[data-reset]');
    reset.addEventListener('click', () => {
      if (!reset.classList.contains('confirming')) {
        reset.classList.add('confirming');
        reset.textContent = '再按一次確認：重置點數並重新載入';
        return;
      }
      this.game.demo.resetBalance();
      location.reload();
    });
  }

  buyFeature() {
    const bet = this.game.demo.bet;
    const cards = BUY_FEATURES.map((f, i) => {
      const price = bet * f.featureRate;
      const desc = ['觸發免費遊戲，15 次免費場次；有機率升級為覺醒之力。', '直接啟動覺醒之力，15 次免費場次，圖騰技能：分裂與鎖定。', '必定掉落 500x 倍數球並鎖定，有機會觸發覺醒技能。'][i];
      const art = [icon(SYM.SCATTER, 64), icon(SYM.GOLD_SCATTER, 64), orbIcon(500, true, 64)][i];
      return `<div class="buy-card">${art}<div class="buy-name">${f.label}</div><div class="buy-desc">${desc}</div><div class="buy-price">${fmt(price)}</div><button class="mc-btn wide primary" data-buy="${i}">購買 ×${f.featureRate}</button></div>`;
    }).join('');
    const node = this.open('購買特色', `<div class="buy-grid">${cards}</div><div class="panel-note">目前押注 ${fmt(bet)}；購買後自動開始，直到場次用盡並發放贏分。再按一次按鈕確認購買。</div>`, { wide: true });
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (!b) return;
      const i = Number(b.dataset.buy);
      // 兩段式確認：第一次按變成「確認」，再按一次才購買。
      if (!b.classList.contains('confirming')) {
        node.querySelectorAll('[data-buy].confirming').forEach((x) => { x.classList.remove('confirming'); x.textContent = `購買 ×${BUY_FEATURES[Number(x.dataset.buy)].featureRate}`; });
        b.classList.add('confirming');
        b.textContent = `確認 ${fmt(bet * BUY_FEATURES[i].featureRate)}`;
        return;
      }
      this.close();
      this.game.buyFeature(i);
    });
  }

  rules(page = 0) {
    const pages = rulePages();
    const node = this.open(`遊戲規則（${page + 1}/${pages.length}）`, `
      <div class="rules-page">${pages[page]}</div>
      <div class="rules-nav"><button class="mc-btn" data-prev ${page === 0 ? 'disabled' : ''}>‹ 上一頁</button><button class="mc-btn" data-next ${page === pages.length - 1 ? 'disabled' : ''}>下一頁 ›</button></div>`, { wide: true });
    node.querySelector('[data-prev]').addEventListener('click', () => this.rules(page - 1));
    node.querySelector('[data-next]').addEventListener('click', () => this.rules(page + 1));
  }

  records() {
    const rows = this.game.demo.getBetRecords(30);
    const body = rows.length ? rows.map((r) => `<tr><td>${new Date(r.endTime).toLocaleString('zh-TW', { hour12: false })}</td><td>${fmt(r.totalStake)}</td><td class="${r.win > 0 ? 'pos' : ''}">${fmt(r.win)}</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${fmt(r.profit)}</td><td>${r.isFeature ? '購買' : r.hasFree ? '免費' : ''}</td></tr>`).join('') : '<tr><td colspan="5">尚無紀錄</td></tr>';
    this.open('下注紀錄', `<table class="mc-table"><thead><tr><th>時間</th><th>押注</th><th>贏分</th><th>損益</th><th>類型</th></tr></thead><tbody>${body}</tbody></table>`, { wide: true });
  }
}

export function rulePages() {
  const pay = (s) => `<div class="pay-item">${icon(s, 56)}<div class="pay-name">${SYMBOL_NAMES[s]}</div><div class="pay-rows"><span>12+</span><b>${PAYTABLE[s][2] / 5}</b><span>10-11</span><b>${PAYTABLE[s][1] / 5}</b><span>8-9</span><b>${PAYTABLE[s][0] / 5}</b></div></div>`;
  return [
    `<h3>遊戲玩法</h3>
     <ul><li>5 列 × 6 欄，盤面任意位置出現 <b>8 個以上</b>相同符號即消除贏分，依賠率表計算。</li>
     <li>贏分 =（單次押注額 / 20）× 符號賠率。舉例：押注 1，盤面 12 個 ${icon(SYM.EYE, 28)} → (1/20) × 1000 = 50。</li>
     <li>消除後上方符號落下補位，可連續消除。當盤面沒有符號可消除時，倍數球相加形成總倍數。</li>
     <li>該次旋轉的總贏分 = 贏分 × 總倍數。最高贏分 81,000 倍。</li></ul>`,
    `<h3>賠率表（以押注 / 20 為單位）</h3><div class="pay-grid">${[SYM.EYE, SYM.SCEPTER, SYM.BOW, SYM.KHOPESH, SYM.GEM_YELLOW, SYM.GEM_RED, SYM.GEM_PURPLE, SYM.GEM_BLUE, SYM.GEM_GREEN].map(pay).join('')}</div>`,
    `<h3>免費遊戲</h3><div class="rule-hero">${icon(SYM.SCATTER, 96)}</div>
     <ul><li>主遊戲中獲得 4 至 6 個 ${icon(SYM.SCATTER, 28)}，觸發免費遊戲並獲得 15 次免費場次。</li>
     <li>免費遊戲中獲得 3 至 6 個 ${icon(SYM.SCATTER, 28)}，額外獲得 5 次免費場次，最多可達 100 次。</li>
     <li>免費遊戲中，有累積贏分且盤面有倍數球時，盤面上的所有倍數將會加入總倍數。</li>
     <li>Scatter 支付：4 個 ${SCATTER_PAY[4] / 5}、5 個 ${SCATTER_PAY[5] / 5}、6 個 ${SCATTER_PAY[6] / 5}。</li></ul>`,
    `<h3>覺醒之力</h3><div class="rule-hero">${icon(SYM.GOLD_SCATTER, 96)}</div>
     <ul><li>主遊戲中獲得 4 至 6 個聖甲蟲且其中包含 ${icon(SYM.GOLD_SCATTER, 28)}，即可獲得覺醒之力並獲得 15 次免費場次。</li>
     <li>覺醒之力過程中，獲得 3 至 4 個 ${icon(SYM.GOLD_SCATTER, 28)}，可額外獲得 5 次免費場次。</li>
     <li>每次贏分 = 贏分 ×（盤面倍數 + 總倍數）；總贏分 = 每次贏分總和。</li></ul>`,
    `<h3>覺醒之力符號</h3><div class="rule-hero two">${icon(SYM.SET_TOTEM, 96)}${icon(SYM.NEPH_TOTEM, 96)}</div>
     <ul><li>累積消除後，盤面出現三個 ${icon(SYM.SET_TOTEM, 28)} ＋ 倍數球，觸發角色技能：倍數球分裂為多個相同倍數球（每級 2 顆，最多 3 級）。</li>
     <li>出現三個 ${icon(SYM.NEPH_TOTEM, 28)} ＋ 倍數球，觸發角色技能：倍數球被鎖定盤面數回合（每級 2 回合）。</li>
     <li>兩種圖騰觸發時各支付 5（押注 / 20 單位）。</li></ul>`,
    `<h3>倍數特色</h3><div class="rule-hero four">${orbIcon(5, false, 72)}${orbIcon(10, false, 72)}${orbIcon(50, false, 72)}${orbIcon(100, false, 72)}</div>
     <ul><li>同時出現在主遊戲與免費遊戲中。盤面上只要出現倍數球，即可獲得 2 倍到 500 倍的隨機倍數：${ORB_VALUES.join(' / ')}。</li>
     <li>盤面清除後，稀有倍數球（帶尖刺邊框）${orbIcon(10, true, 28)} 有機會升級，最高可達 500 倍。</li></ul>`,
    `<h3>購買特色</h3>
     <ul>${BUY_FEATURES.map((f, i) => `<li><b>${f.label}</b>：以目前押注的 ${f.featureRate} 倍購買，${['即可觸發免費遊戲或啟動覺醒之力。', '即可啟動覺醒之力。', '必定掉落 500x 倍數球，且有機會觸發覺醒技能（分裂／鎖定）。'][i]}</li>`).join('')}</ul>
     <p class="panel-note">購買後將自動開始，直至場次用盡和贏分發放完畢為止。</p>`,
    `<h3>JACKPOT 說明</h3><div class="rule-hero">${icon(SYM.JP, 96)}</div>
     <ul>${JACKPOTS.slice().reverse().map((j) => `<li><b>${j.count}</b> 個 → <b>${j.name}</b>（押注 × ${j.x}）</li>`).join('')}<li>盤面上出現 2 個以上相同符號即可獲獎（每欄最多一個）。</li></ul>`,
    `<h3>神秘寶箱</h3>
     <ul><li>任一未中獎的旋轉有機率可中神秘寶箱，獎金為押注的 1 ～ 100 倍，下注越高贏分越多。</li>
     <li>本遊戲為本地試玩版：所有結果由瀏覽器內的模擬引擎決定，點數無任何價值。</li></ul>`,
  ];
}
