// 驗收入口：先跑引擎案例，再跑端到端（需要本機 Chrome）。任一失敗就以非零碼結束。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (label, args) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.resolve(here, '..') });
  return r.status === 0;
};

const okEngine = run('engine', ['--test', path.join(here, 'engine.test.mjs')]);
const okE2e = process.argv.includes('--no-e2e') ? true : run('e2e', [path.join(here, 'e2e.mjs')]);
console.log(`\nengine: ${okEngine ? 'PASS' : 'FAIL'}   e2e: ${okE2e ? 'PASS' : 'FAIL'}`);
process.exit(okEngine && okE2e ? 0 : 1);
