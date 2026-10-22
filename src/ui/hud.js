// HUD：彩金列、免費遊戲列、餘額／押注／贏得、旋轉列、提示訊息。
import { fmt, el } from './format.js';
import { JACKPOTS } from '../engine/config.js';
import { animateValue, Ease } from '../render/tween.js';

const SLOGANS = ['', '', '連續消除！', '勢如破竹', '雷霆萬鈞', '神力覺醒', '天雷滾滾'];

export class Hud {
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    root.innerHTML = `
      <div class="hud-top">
        <div class="logo"><b>戰神賽特 II</b><small>覺醒之力・麥塊版</small></div>
        <div class="jp-bar" aria-label="彩金池">
          ${JACKPOTS.slice().reverse().map((j) => `<div class="jp ${j.id}"><span>${j.name}</span><b data-jp="${j.id}">0.00</b></div>`).join('')}
        </div>
        <div class="fg-bar" hidden>
          <span class="fg-title">免費遊戲</span>
          <span class="fg-count">剩餘 <b data-fg-left>0</b><span class="fg-of"> / <i data-fg-total>0</i></span><span class="fg-unit"> 轉</span></span>
          <span class="fg-times">總倍數 <b data-fg-times>×0</b></span>
        </div>
      </div>
      <div class="slogan" aria-live="polite" hidden><b></b><span></span></div>
      <div class="toast-area" aria-live="polite"></div>
      <div class="hud-bottom">
        <div class="info-bar">
          <div class="stat"><span>餘額</span><b data-balance>0.00</b></div>
          <div class="stat"><span>押注</span><b data-bet>0.00</b></div>
          <div class="stat win"><span>贏得</span><b data-win>0.00</b></div>
        </div>
        <div class="spin-bar">
          <button class="mc-btn" data-action="menu" aria-label="選單">☰ 選單</button>
          <button class="mc-btn buy" data-action="buy">購買特色</button>
          <div class="bet-ctl">
            <button class="mc-btn sq" data-action="bet-" aria-label="減少押注">−</button>
            <div class="bet-val"><span>總押注</span><b data-bet2>0.00</b></div>
            <button class="mc-btn sq" data-action="bet+" aria-label="增加押注">+</button>
          </div>
          <button class="mc-btn spin" data-action="spin" aria-label="旋轉（空白鍵）"><span class="spin-face">SPIN</span><span class="spin-sub">空白鍵</span></button>
          <button class="mc-btn" data-action="auto"><span data-auto-label>自動</span></button>
          <button class="mc-btn" data-action="turbo" aria-pressed="false">快速</button>
        </div>
      </div>`;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      handlers[btn.dataset.action]?.();
    });
    this.q = (s) => root.querySelector(s);
    this.shownBalance = 0;
    this.shownWin = 0;
    this.balanceTween = null;
    this.winTween = null;
  }

  setBalance(amount, { animate = true } = {}) {
    const label = this.q('[data-balance]');
    this.balanceTween?.cancel();
    if (!animate || Math.abs(amount - this.shownBalance) < 0.005) {
      this.shownBalance = amount;
      label.textContent = fmt(amount);
      return Promise.resolve();
    }
    const from = this.shownBalance;
    this.shownBalance = amount;
    this.balanceTween = animateValue(from, amount, 0.6, (v) => { label.textContent = fmt(v); }, Ease.outQuad);
    return this.balanceTween.then(() => { label.textContent = fmt(amount); });
  }

  setBet(amount) {
    this.q('[data-bet]').textContent = fmt(amount);
    this.q('[data-bet2]').textContent = fmt(amount);
  }

  setWin(amount, { animate = true } = {}) {
    const label = this.q('[data-win]');
    this.winTween?.cancel();
    if (!animate || amount <= this.shownWin || amount === 0) {
      this.shownWin = amount;
      label.textContent = fmt(amount);
      label.classList.toggle('lit', amount > 0);
      return Promise.resolve();
    }
    const from = this.shownWin;
    this.shownWin = amount;
    label.classList.add('lit');
    this.winTween = animateValue(from, amount, 0.5, (v) => { label.textContent = fmt(v); }, Ease.outQuad);
    return this.winTween.then(() => { label.textContent = fmt(amount); });
  }

  setJackpots(pools) {
    for (const [id, v] of Object.entries(pools)) {
      const label = this.q(`[data-jp="${id}"]`);
      if (label) label.textContent = fmt(v);
    }
  }

  setSpinEnabled(on) {
    for (const a of ['spin', 'buy', 'bet-', 'bet+', 'menu']) {
      const b = this.q(`[data-action="${a}"]`);
      if (b) b.disabled = !on;
    }
    this.root.dataset.state = on ? 'idle' : 'busy';
  }

  setAutoState(remaining) {
    const label = this.q('[data-auto-label]');
    const btn = this.q('[data-action="auto"]');
    if (remaining === null) {
      label.textContent = '自動';
      btn.classList.remove('active');
    } else {
      label.textContent = remaining < 0 ? '∞ 停止' : `${remaining} 停止`;
      btn.classList.add('active');
    }
  }

  setTurbo(on) {
    this.q('[data-action="turbo"]').setAttribute('aria-pressed', String(on));
  }

  enterFeature(kind, isSuper) {
    const bar = this.q('.fg-bar');
    bar.hidden = false;
    bar.dataset.kind = kind;
    this.q('.fg-title').textContent = isSuper ? '不朽覺醒' : kind === 'awaken' ? '覺醒之力' : '免費遊戲';
    this.q('.jp-bar').hidden = true;
    this.setTotalTimes(0);
  }

  exitFeature() {
    this.q('.fg-bar').hidden = true;
    this.q('.jp-bar').hidden = false;
    this.q('.fg-count').classList.remove('super');
  }

  setFreeSpins(left, total, played, isSuper) {
    this.q('[data-fg-left]').textContent = String(left);
    this.q('[data-fg-total]').textContent = String(total);
    this.q('.fg-count').classList.toggle('super', !!isSuper);
  }

  setTotalTimes(times, before = null) {
    const label = this.q('[data-fg-times]');
    label.textContent = `×${times}`;
    if (before !== null && times !== before) {
      label.classList.remove('pop');
      void label.offsetWidth;
      label.classList.add('pop');
    }
  }

  cascadeSlogan(n) {
    const s = this.q('.slogan');
    s.querySelector('b').textContent = SLOGANS[Math.min(n, SLOGANS.length - 1)];
    s.querySelector('span').textContent = `連續消除 ×${n}`;
    s.hidden = false;
    s.classList.remove('on');
    void s.offsetWidth;
    s.classList.add('on');
    clearTimeout(this.sloganTimer);
    this.sloganTimer = setTimeout(() => { s.hidden = true; }, 1800);
  }

  toast(text, kind = '') {
    const t = el('div', `toast ${kind}`, text);
    this.q('.toast-area').append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
}
