// 全螢幕演出彈窗：大獎橫幅、免費遊戲提示／總結、JP、神秘寶箱、再觸發、轉場。
import { fmt, el } from './format.js';
import { animateValue, wait, Ease } from '../render/tween.js';
import { iconDataURL } from '../render/icons.js';
import { SYM } from '../engine/config.js';

const TIER_STYLE = {
  big: { title: 'BIG WIN', zh: '大獎', color: '#ffd36b', count: 3 },
  super: { title: 'SUPER WIN', zh: '超級大獎', color: '#7fe3ff', count: 4 },
  mega: { title: 'MEGA WIN', zh: '巨額大獎', color: '#c88cff', count: 5 },
  ultra: { title: 'ULTRA WIN', zh: '極限大獎', color: '#ff7a5c', count: 6 },
  legend: { title: 'LEGENDARY WIN', zh: '傳奇大獎', color: '#ffffff', count: 7 },
};

export class Popups {
  constructor(root) {
    this.root = root;
    this.current = null;
    this.history = []; // 曾出現過的彈窗類別（驗收用）
  }

  // 建立一個可點擊跳過的覆蓋層；回傳 { node, done(promise 直到關閉), skip() }
  open(className, html, { dismissOnClick = true } = {}) {
    const node = el('div', `popup ${className}`, html);
    this.history.push(className.split(' ')[0]);
    this.root.append(node);
    let resolveSkip;
    const skipped = new Promise((r) => (resolveSkip = r));
    node.skipped = skipped;
    node.skip = () => resolveSkip();
    if (dismissOnClick) node.addEventListener('click', () => resolveSkip(), { once: true });
    requestAnimationFrame(() => node.classList.add('in'));
    this.current = node;
    return node;
  }

  async close(node) {
    node.classList.remove('in');
    node.classList.add('out');
    await wait(0.25);
    node.remove();
    if (this.current === node) this.current = null;
  }

  // 等待：到時間或玩家點擊，先到先贏。
  race(node, seconds, fast) {
    return Promise.race([wait(fast ? 0.02 : seconds), node.skipped]);
  }

  async countUp(label, amount, seconds, fast, onTick) {
    if (fast) {
      label.textContent = fmt(amount);
      return;
    }
    let last = 0;
    const p = animateValue(0, amount, seconds, (v) => {
      label.textContent = fmt(v);
      if (onTick && v - last > amount / 24) {
        last = v;
        onTick();
      }
    }, Ease.outCubic);
    await Promise.race([p, this.current?.skipped ?? p]);
    p.cancel();
    label.textContent = fmt(amount);
  }

  async bigWin(tier, amount, { fast = false, sfx = null } = {}) {
    const st = TIER_STYLE[tier.id];
    const node = this.open(`bigwin tier-${tier.id}`, `
      <div class="bigwin-box" style="--accent:${st.color}">
        <div class="bigwin-title">${st.title}</div>
        <div class="bigwin-zh">${st.zh}</div>
        <div class="bigwin-amount">0.00</div>
        <div class="popup-hint">點擊跳過</div>
      </div>`);
    await this.countUp(node.querySelector('.bigwin-amount'), amount, st.count, fast, () => sfx?.play('tick'));
    await this.race(node, 1.3, fast);
    await this.close(node);
  }

  async featureAlert(kind, spins, { fast = false, bought = false } = {}) {
    const awaken = kind === 'awaken';
    const node = this.open(`feature-alert ${awaken ? 'awaken' : 'fg'}`, `
      <div class="mc-panel feature-box">
        <div class="feature-icon"><img alt="" src="${iconDataURL({ s: awaken ? SYM.GOLD_SCATTER : SYM.SCATTER, v: 0, rare: false, lock: 0 }, 96)}"></div>
        <div class="feature-title">${awaken ? '覺醒之力' : '免費遊戲'}</div>
        <div class="feature-sub">${bought ? '購買成功，' : '恭喜！'}獲得 <b>${spins}</b> 次免費場次</div>
        ${awaken ? '<div class="feature-note">三個賽特圖騰 → 倍數球分裂；三個奈芙蒂斯圖騰 → 倍數球鎖定</div>' : '<div class="feature-note">盤面倍數球將累加為總倍數</div>'}
        <button class="mc-btn wide" data-go>開始</button>
      </div>`, { dismissOnClick: false });
    node.querySelector('[data-go]').addEventListener('click', () => node.skip(), { once: true });
    await this.race(node, 4.5, fast);
    await this.close(node);
  }

  async featureTotal(total, kind, { fast = false, isSuper = false, bet = 0 } = {}) {
    const node = this.open('feature-total', `
      <div class="mc-panel feature-box">
        <div class="feature-title">${isSuper ? '不朽覺醒結束' : kind === 'awaken' ? '覺醒之力結束' : '免費遊戲結束'}</div>
        <div class="feature-sub">總贏分</div>
        <div class="bigwin-amount gold">0.00</div>
        ${bet ? `<div class="feature-note">${(total / bet).toFixed(1)} 倍押注</div>` : ''}
        <button class="mc-btn wide" data-go>確定</button>
      </div>`, { dismissOnClick: false });
    node.querySelector('[data-go]').addEventListener('click', () => node.skip(), { once: true });
    await this.countUp(node.querySelector('.bigwin-amount'), total, 2, fast);
    await this.race(node, 4, fast);
    await this.close(node);
  }

  async jackpot(tier, amount, { fast = false } = {}) {
    const node = this.open(`jackpot jp-${tier.name.toLowerCase()}`, `
      <div class="bigwin-box jackpot-box">
        <div class="bigwin-title">JACKPOT</div>
        <div class="jackpot-tier">${tier.name}</div>
        <div class="bigwin-amount">0.00</div>
        <div class="popup-hint">點擊跳過</div>
      </div>`);
    await this.countUp(node.querySelector('.bigwin-amount'), amount, 2.5, fast);
    await this.race(node, 1.5, fast);
    await this.close(node);
  }

  // 神秘寶箱：三個寶箱選一個；選到的永遠是真正獎金，其餘揭曉誘餌（與原版相同：結果已由伺服器決定）。
  async mystery(win, decoys, { fast = false } = {}) {
    const node = this.open('mystery', `
      <div class="mc-panel feature-box">
        <div class="feature-title">神秘寶箱</div>
        <div class="feature-sub">未中獎也有機會！請選一個寶箱</div>
        <div class="chests">${[0, 1, 2].map((i) => `<button class="chest" data-chest="${i}" aria-label="寶箱 ${i + 1}"><span class="chest-art"></span><b class="chest-prize"></b></button>`).join('')}</div>
      </div>`, { dismissOnClick: false });
    const chests = [...node.querySelectorAll('.chest')];
    let picked = null;
    const pick = (i) => { if (picked === null) { picked = i; node.skip(); } };
    chests.forEach((c, i) => c.addEventListener('click', () => pick(i)));
    await Promise.race([wait(fast ? 0.02 : 5), node.skipped]);
    if (picked === null) picked = 1;
    const prizes = [...decoys];
    chests.forEach((c, i) => {
      const value = i === picked ? win : prizes.shift();
      c.classList.add('open', i === picked ? 'picked' : 'decoy');
      c.querySelector('.chest-prize').textContent = fmt(value);
    });
    await wait(fast ? 0.02 : 2.2);
    await this.close(node);
  }

  async retrigger(added, total, { fast = false } = {}) {
    const node = this.open('retrigger', `<div class="retrigger-box"><b>+${added}</b><span>免費場次（共 ${total} 次）</span></div>`);
    await this.race(node, 1.6, fast);
    await this.close(node);
  }

  async fullCombo({ fast = false } = {}) {
    const node = this.open('fullcombo', `<div class="bigwin-box" style="--accent:#9cf59c"><div class="bigwin-title">FULL COMBO</div><div class="bigwin-zh">滿盤全消！</div></div>`);
    await this.race(node, 1.6, fast);
    await this.close(node);
  }

  // 轉場：閃電白光 + 方塊簾幕。
  async transition(theme, { fast = false } = {}) {
    const node = this.open(`transition to-${theme}`, `<div class="curtain">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`, { dismissOnClick: false });
    await wait(fast ? 0.02 : 0.75);
    await this.close(node);
  }
}
