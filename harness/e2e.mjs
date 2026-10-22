// 端到端驗收：真實瀏覽器（本機 Chrome）載入頁面、按鍵旋轉、走過各特色流程。
// 「實際值」一律取自畫面 DOM（玩家看到的數字），比對引擎權威值與手算值。可重複執行（?reset=1 重置點數）。
import { chromium } from 'playwright-core';
import { listen } from './serve.mjs';

const results = [];
let current = null;
const check = (name, ok, detail = '') => {
  results.push({ name: `${current} › ${name}`, ok, detail });
  console.log(`${ok ? '  ok ' : '  FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};
const eq = (name, actual, expected) => check(name, actual === expected, actual === expected ? '' : `實際 ${JSON.stringify(actual)} ≠ 預期 ${JSON.stringify(expected)}`);
const fmt = (n) => (Math.floor(n * 100 + 1e-6) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { server, port } = await listen(0);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const FEATURE_TIMEOUT = 600000; // 免費遊戲回合在軟體繪圖下可能很慢
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const state = () => page.evaluate(() => window.__game.state());
const idle = (timeout = 120000) => page.waitForFunction(() => window.__game && window.__game.state().idle && window.__game.auto === null, null, { timeout });
const dom = (sel) => page.$eval(sel, (e) => e.textContent.trim());
const spinAndWait = async (timeout) => {
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__game.state().idle, null, { timeout: 5000 }).catch(() => {});
  await idle(timeout);
};
const lastRecord = () => page.evaluate(() => { const r = window.__game.lastRecord; return { win: r.win / 100, cost: r.cost / 100, bet: r.bet, hasFree: r.hasFree, feature: r.feature, views: r.views.length, isJp: r.views.some((v) => v.isJp) }; });
const popupHistory = () => page.evaluate(() => window.__game.popups.history.slice());

try {
  current = '啟動';
  await page.goto(`http://127.0.0.1:${port}/?test=1&fast=1&seed=e2e-1&reset=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#intro:not([hidden])', { timeout: 60000 });
  await page.click('#intro [data-start]');
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 30000 });
  eq('初始餘額顯示 100,000.00', await dom('[data-balance]'), '100,000.00');
  eq('預設押注 20.00', await dom('[data-bet]'), '20.00');
  eq('盤面有 30 個符號', (await state()).cells, 30);
  eq('彩金 GRAND = 押注 × 2000', await dom('[data-jp="jp-grand"]'), '40,000.00');

  current = '一般旋轉';
  let before = (await state()).balance;
  await spinAndWait();
  let rec = await lastRecord();
  eq('花費 = 押注 20', rec.cost, 20);
  eq('畫面餘額 = 之前 − 20 + 贏分（手算）', await dom('[data-balance]'), fmt(before - 20 + rec.win));
  eq('畫面餘額 = 引擎餘額', await dom('[data-balance]'), fmt((await state()).balance));
  eq('畫面贏得 = 這局贏分', await dom('[data-win]'), fmt(rec.win));
  eq('旋轉後盤面仍為 30 格', (await state()).cells, 30);
  check('角色有施法動作', (await page.evaluate(() => window.__game.characters.history)).includes('cast'));

  current = 'BIG WIN';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('big'));
  await spinAndWait();
  rec = await lastRecord();
  check('贏分 ≥ 20 倍押注', rec.win >= rec.bet * 20, `${rec.win}`);
  check('出現 BIG WIN 彈窗', (await popupHistory()).includes('bigwin'));
  check('角色有跳舞與歡呼動作', await page.evaluate(() => { const h = window.__game.characters.history; return h.includes('dance') && h.includes('cheer'); }));
  eq('餘額 = 之前 − 20 + 贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = '滿盤 FULL COMBO';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('full'));
  await spinAndWait();
  rec = await lastRecord();
  check('出現 FULL COMBO 彈窗', (await popupHistory()).includes('fullcombo'));
  check('第一次消除為 30 格', await page.evaluate(() => { const w = window.__game.lastRecord.spins[0].events.find((e) => e.type === 'win'); return w && w.groups[0].cells.length === 30; }));
  eq('餘額 = 之前 − 20 + 贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = '免費遊戲';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('fg'));
  await spinAndWait(FEATURE_TIMEOUT);
  rec = await lastRecord();
  check('這局含免費遊戲', rec.hasFree);
  check('至少 16 個 view（觸發 + 15 轉）', rec.views >= 16, `${rec.views}`);
  const hist = await popupHistory();
  check('出現免費遊戲提示', hist.includes('feature-alert'));
  check('出現免費遊戲總結', hist.includes('feature-total'));
  eq('結束後回到主遊戲背景', (await state()).theme, 'mg');
  check('免費遊戲列已隱藏', await page.$eval('.fg-bar', (e) => e.hidden));
  eq('餘額 = 之前 − 20 + 總贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = '覺醒之力（分裂＋鎖定）';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('both'));
  await spinAndWait(FEATURE_TIMEOUT);
  rec = await lastRecord();
  const skills = await page.evaluate(() => { const r = window.__game.lastRecord; return { split: r.views.some((v) => v.splitList.length > 0), lock: r.views.some((v) => v.femaleTotemLevel > 0), golden: r.views.some((v) => v.isGoldenFg) }; });
  check('有分裂', skills.split);
  check('有鎖定', skills.lock);
  check('是覺醒之力', skills.golden);
  check('角色有技能、懸浮與鞠躬動作', await page.evaluate(() => { const h = window.__game.characters.history; return ['skill', 'levitate', 'bow'].every((n) => h.includes(n)); }));
  eq('餘額 = 之前 − 20 + 總贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = 'JACKPOT';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('jp-grand'));
  await spinAndWait();
  rec = await lastRecord();
  check('中 GRAND', rec.isJp);
  check('贏分 ≥ 2000 倍押注', rec.win >= rec.bet * 2000, `${rec.win}`);
  check('出現 JACKPOT 彈窗', (await popupHistory()).includes('jackpot'));
  eq('餘額 = 之前 − 20 + 贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = '神秘寶箱';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.demo.setScenario('mystery'));
  await spinAndWait();
  rec = await lastRecord();
  check('出現寶箱彈窗', (await popupHistory()).includes('mystery'));
  check('贏分為押注的 1～100 倍', [1, 2, 3, 5, 8, 10, 20, 50, 100].includes(rec.win / rec.bet), `${rec.win}`);
  eq('餘額 = 之前 − 20 + 贏分', await dom('[data-balance]'), fmt(before - 20 + rec.win));

  current = '購買特色';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.buyFeature(0));
  await page.waitForFunction(() => !window.__game.state().idle, null, { timeout: 5000 }).catch(() => {});
  await idle(FEATURE_TIMEOUT);
  rec = await lastRecord();
  eq('購買花費 = 押注 × 200 = 4000', rec.cost, 4000);
  eq('紀錄類型為 freeGame', rec.feature, 'freeGame');
  check('有免費遊戲', rec.hasFree);
  eq('餘額 = 之前 − 4000 + 總贏分', await dom('[data-balance]'), fmt(before - 4000 + rec.win));

  current = '購買不朽覺醒';
  before = (await state()).balance;
  await page.evaluate(() => window.__game.buyFeature(2));
  await page.waitForFunction(() => !window.__game.state().idle, null, { timeout: 5000 }).catch(() => {});
  await idle(FEATURE_TIMEOUT);
  rec = await lastRecord();
  eq('購買花費 = 押注 × 2000 = 40000', rec.cost, 40000);
  eq('紀錄類型為 superMainGame', rec.feature, 'superMainGame');
  check('每個 view 都是 superSpin 且必有 500x 倍數球', await page.evaluate(() => window.__game.lastRecord.views.every((v) => v.action === 'superSpin' && v.timesSymbols.some((t) => t.times === 500))));
  eq('餘額 = 之前 − 40000 + 總贏分', await dom('[data-balance]'), fmt(before - 40000 + rec.win));

  current = '自動旋轉';
  const recordsBefore = await page.evaluate(() => window.__game.demo.records.length);
  await page.evaluate(() => { window.__game.demo.updateSettings({ autoPlay: { stopOnWinMultiplier: false, stopOnJackpot: false, stopOnFreeSpin: false } }); window.__game.startAutoplay(3); });
  await page.waitForFunction(() => window.__game.auto === null && window.__game.state().idle, null, { timeout: FEATURE_TIMEOUT });
  const recordsAfter = await page.evaluate(() => window.__game.demo.records.length);
  eq('自動 3 轉新增 3 筆紀錄', recordsAfter - recordsBefore, 3);
  eq('自動按鈕回到「自動」', await dom('[data-auto-label]'), '自動');

  current = '押注調整';
  const betBefore = (await state()).bet;
  await page.click('[data-action="bet+"]');
  const betAfter = (await state()).bet;
  check('押注增加', betAfter > betBefore, `${betBefore} → ${betAfter}`);
  eq('畫面押注 = 引擎押注', await dom('[data-bet]'), fmt(betAfter));
  eq('彩金隨押注更新', await dom('[data-jp="jp-mini"]'), fmt(betAfter * 5));
  await page.click('[data-action="bet-"]');
  eq('押注回到原值', (await state()).bet, betBefore);

  current = '快速模式';
  await page.click('[data-action="turbo"]');
  eq('快速按鈕狀態為開', await page.$eval('[data-action="turbo"]', (e) => e.getAttribute('aria-pressed')), 'true');
  eq('設定已儲存 turbo=true', await page.evaluate(() => window.__game.demo.settings.turbo), true);
  await page.click('[data-action="turbo"]');
  eq('再按一次關閉', await page.evaluate(() => window.__game.demo.settings.turbo), false);

  current = '面板';
  await page.click('[data-action="menu"]');
  check('選單開啟', await page.$eval('#modal', (e) => !e.hidden));
  await page.click('[data-m="rules"]');
  check('規則頁顯示賠率', (await dom('.panel-body')).includes('遊戲玩法'));
  await page.keyboard.press('Escape');
  check('Esc 關閉面板', await page.$eval('#modal', (e) => e.hidden));

  current = '重新載入';
  const balancePersist = (await state()).balance;
  await page.goto(`http://127.0.0.1:${port}/?test=1&fast=1&seed=e2e-2`, { waitUntil: 'domcontentloaded' }); // 不帶 reset，點數應延續
  await page.waitForSelector('#intro:not([hidden])', { timeout: 60000 });
  await page.click('#intro [data-start]');
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 30000 });
  eq('點數在重新載入後延續', await dom('[data-balance]'), fmt(balancePersist));

  current = '錯誤';
  eq('沒有 JS 錯誤', errors.length, 0);
  if (errors.length) console.log(errors.slice(0, 10));
} catch (e) {
  results.push({ name: `${current} › 流程中斷`, ok: false, detail: String(e.stack || e) });
  console.log('FATAL', e.stack || e);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\ne2e: ${results.length - failed.length}/${results.length} 通過`);
for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
