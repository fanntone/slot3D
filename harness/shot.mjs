// 開發用：啟動本機伺服器，用 headless Chrome 開啟遊戲、走一輪流程並截圖，同時收集 console 錯誤。
// 用法：node harness/shot.mjs <輸出資料夾> [情境,情境...]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { listen } from './serve.mjs';

const OUT = process.argv[2] || 'shots-out';
const SCENARIOS = (process.argv[3] ?? 'big,fg').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const logs = [];
const log = (...a) => {
  const s = `[${new Date().toISOString().slice(11, 19)}] ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}`;
  console.log(s);
  logs.push(s);
};
const { server, port } = await listen(0);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log('console.' + m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => log('pageerror', String(e.stack || e).slice(0, 600)));
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); log('shot', name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (timeout = 90000) => page.waitForFunction(() => window.__game && window.__game.state().idle, null, { timeout });
try {
  await page.goto(`http://127.0.0.1:${port}/?test=1&seed=shot-1&reset=1`, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await shot('00_splash');
  await page.waitForSelector('#intro:not([hidden])', { timeout: 60000 });
  await sleep(500);
  await shot('01_intro');
  await page.click('#intro [data-start]');
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 30000 });
  await sleep(800);
  await shot('02_main');
  log('state', await page.evaluate(() => window.__game.state()));
  await page.keyboard.press('Space');
  for (let i = 0; i < 8; i++) { await sleep(350); await shot(`03_spin_${i}`); }
  await idle();
  await shot('04_after_spin');
  log('state', await page.evaluate(() => window.__game.state()));
  for (const sc of SCENARIOS) {
    await page.evaluate((id) => window.__game.demo.setScenario(id), sc);
    await page.keyboard.press('Space');
    for (let i = 0; i < 14; i++) { await sleep(700); await shot(`10_${sc}_${String(i).padStart(2, '0')}`); }
    await idle(240000);
    await shot(`11_${sc}_end`);
    log('state', await page.evaluate(() => window.__game.state()));
  }
  // 面板
  for (const action of ['menu', 'buy']) {
    await page.click(`[data-action="${action}"]`);
    await sleep(400);
    await shot(`20_panel_${action}`);
    if (action === 'menu') { await page.click('[data-m="rules"]'); await sleep(400); await shot('21_rules_1'); await page.click('[data-next]'); await sleep(300); await shot('21_rules_2'); }
    await page.keyboard.press('Escape');
    await sleep(200);
  }
  await page.click('.tp-tab');
  await sleep(300);
  await shot('30_testpanel');
} catch (e) {
  log('FATAL', e.stack || String(e));
} finally {
  fs.writeFileSync(path.join(OUT, 'log.txt'), logs.join('\n'));
  await browser.close();
  server.close();
}
