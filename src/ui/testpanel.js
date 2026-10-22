// 測試面板（?test=1）：選一個情境，下一轉就會出現；與參考站的測試工具相同的操作方式。
import { SCENARIOS } from '../engine/scenarios.js';
import { el } from './format.js';

export function mountTestPanel(game) {
  const tab = el('button', 'tp-tab', '測試');
  tab.type = 'button';
  const panel = el('div', 'tp-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  const status = el('div', 'tp-status');
  let autoSpin = true;
  const check = (label, checked, onChange) => {
    const l = el('label', 'tp-row');
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = checked;
    i.addEventListener('change', () => onChange(i.checked));
    l.append(i, label);
    return l;
  };
  const head = el('div', 'tp-head', '<b>測試工具</b>');
  const close = el('button', 'tp-x', '×');
  close.type = 'button';
  head.append(close);
  panel.append(head, status, check('選擇後自動旋轉', autoSpin, (v) => { autoSpin = v; }), check('每一轉都套用（不只下一轉）', game.demo.keepScenario, (v) => { game.demo.keepScenario = v; paint(); }));
  const buttons = new Map();
  let group = '';
  let grid = null;
  for (const s of SCENARIOS) {
    if (s.group !== group) {
      group = s.group;
      panel.append(el('div', 'tp-group', group));
      grid = el('div', 'tp-grid');
      panel.append(grid);
    }
    const b = el('button', 'tp-btn', s.label);
    b.type = 'button';
    b.dataset.scenario = s.id;
    b.addEventListener('click', () => {
      if (game.demo.activeScenario?.id === s.id) return game.demo.setScenario(null);
      game.demo.setScenario(s.id);
      panel.hidden = true;
      if (autoSpin) game.spin();
    });
    buttons.set(s.id, b);
    grid.append(b);
  }
  panel.append(el('div', 'tp-group', '點數'));
  const reset = el('button', 'tp-btn tp-wide tp-danger', '重置點數為 100,000（重新載入）');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    if (!reset.classList.contains('confirming')) {
      reset.classList.add('confirming');
      reset.textContent = '再按一次確認：重置點數並重新載入';
      return;
    }
    game.demo.resetBalance();
    location.reload();
  });
  panel.append(reset);
  const paint = () => {
    const s = game.demo.activeScenario;
    status.textContent = s ? `下一轉：${s.label}${game.demo.keepScenario ? '（每一轉）' : ''}` : '選一個情境，下一轉就會出現。';
    for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(s?.id === id));
    tab.toggleAttribute('data-armed', !!s);
  };
  game.demo.onScenarioChange = paint;
  paint();
  tab.addEventListener('click', () => { panel.hidden = false; });
  close.addEventListener('click', () => { panel.hidden = true; });
  document.body.append(tab, panel);
}
