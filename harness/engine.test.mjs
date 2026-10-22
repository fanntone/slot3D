// 引擎驗收：黃金值全部依規則頁手算（押注 20.00 時：規則頁賠率 × 20 / 20 = 規則頁數字 × 1）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/engine/rng.js';
import { SlotEngine } from '../src/engine/engine.js';
import { SYM, EMPTY, COLS, ROWS } from '../src/engine/config.js';
import { toViews, runRound, posOf, indexOfPos } from '../src/engine/round.js';
import { LocalDemo } from '../src/engine/demoServer.js';
import { SCENARIOS } from '../src/engine/scenarios.js';

const BET = 20; // 元

// 直接把 5×6 盤面寫進引擎（row 0 在最上面）。代號：E 眼 S 權杖 B 弓 K 刀 Y 橘 R 紅 P 紫 U 藍 G 綠
// sc 聖甲蟲 gs 黃金聖甲蟲 jp JP st 力量圖騰 nt 鎖定圖騰 o<n> 倍數球（o10r = 稀有 10 倍）
const TOKENS = { E: SYM.EYE, S: SYM.SCEPTER, B: SYM.BOW, K: SYM.KHOPESH, Y: SYM.GEM_YELLOW, R: SYM.GEM_RED, P: SYM.GEM_PURPLE, U: SYM.GEM_BLUE, G: SYM.GEM_GREEN, sc: SYM.SCATTER, gs: SYM.GOLD_SCATTER, jp: SYM.JP, st: SYM.SET_TOTEM, nt: SYM.NEPH_TOTEM };
function setBoard(engine, rows) {
  rows.forEach((row, r) => {
    row.trim().split(/\s+/).forEach((tok, c) => {
      const i = c * ROWS + r;
      if (tok.startsWith('o')) {
        engine.sym[i] = SYM.ORB;
        engine.val[i] = parseInt(tok.slice(1), 10);
        engine.rare[i] = tok.endsWith('r') ? 1 : 0;
      } else {
        engine.sym[i] = TOKENS[tok];
        engine.val[i] = 0;
        engine.rare[i] = 0;
      }
      engine.lock[i] = 0;
    });
  });
}
// 不會中獎的底盤：每個符號最多出現 4 次。
const NO_WIN = ['S B K Y R P', 'U G S B K Y', 'R P U G S B', 'K Y R P U G', 'S B K Y R P'];
const withBoard = (rows, seed = 'golden') => {
  const engine = new SlotEngine(Rng.fromString(seed));
  engine.rig = { board: () => setBoard(engine, rows) };
  return engine;
};
const toMoney = (unit) => Math.round((unit * BET) / 100 * 100) / 100;

test('8 個荷魯斯之眼：賠率 200 → 押注 20 時贏 200.00', () => {
  const engine = withBoard(['E E E E E E', 'E E S B K Y', 'R P U G S B', 'K Y R P U G', 'S B K Y R P']);
  const r = engine.spinBase();
  const win = r.events.find((e) => e.type === 'win');
  assert.equal(win.groups.length, 1);
  assert.equal(win.groups[0].s, SYM.EYE);
  assert.equal(win.groups[0].count, 8);
  assert.equal(toMoney(win.groups[0].win), 200);
});

test('12 個荷魯斯之眼：賠率 1000 → 1000.00（規則頁範例：押注 1 → 50）', () => {
  const engine = withBoard(['E E E E E E', 'E E E E E E', 'R P U G S B', 'K Y R P U G', 'S B K Y R P']);
  const r = engine.spinBase();
  const win = r.events.find((e) => e.type === 'win');
  assert.equal(toMoney(win.groups[0].win), 1000);
  assert.equal(Math.round((win.groups[0].win * 1) / 100 * 100) / 100, 50); // 押注 1
});

test('綠寶石 9/10/12 個 = 5 / 15 / 40', () => {
  const g9 = withBoard(['G G G G G G', 'G G G B K Y', 'R P U Y S B', 'K Y R P U S', 'S B K Y R P']).spinBase();
  assert.equal(toMoney(g9.events.find((e) => e.type === 'win').groups[0].win), 5);
  const g10 = withBoard(['G G G G G G', 'G G G G K Y', 'R P U Y S B', 'K Y R P U S', 'S B K Y R P']).spinBase();
  assert.equal(toMoney(g10.events.find((e) => e.type === 'win').groups[0].win), 15);
  const g12 = withBoard(['G G G G G G', 'G G G G G G', 'R P U Y S B', 'K Y R P U S', 'S B K Y R P']).spinBase();
  assert.equal(toMoney(g12.events.find((e) => e.type === 'win').groups[0].win), 40);
});

test('少於 8 個不中獎；底盤沒有任何事件', () => {
  const r = withBoard(NO_WIN).spinBase();
  assert.equal(r.win, 0);
  assert.deepEqual(r.events.map((e) => e.type), ['drop']);
});

test('消除後：中獎格被移除、上方符號落下（下方的不動）、空格由上方補入', () => {
  // 底列全是 E，第 0、1 欄 row3 也是 E：共 8 個。
  const engine = withBoard(['R P U G S B', 'K Y R P U G', 'S B K Y R P', 'E E S B K Y', 'E E E E E E']);
  const r = engine.spinBase();
  const tumble = r.events.find((e) => e.type === 'tumble');
  assert.equal(tumble.removed.length, 8);
  const colMoves = (c) => tumble.moves.filter(([from]) => Math.floor(from / ROWS) === c).map(([from, to]) => [from % ROWS, to % ROWS]);
  const colAdded = (c) => tumble.added.filter((a) => Math.floor(a.i / ROWS) === c).map((a) => a.i % ROWS).sort();
  // 第 0 欄：row3、row4 被移除 → row2→4、row1→3、row0→2（由下往上處理），補 row0、row1。
  assert.deepEqual(colMoves(0), [[2, 4], [1, 3], [0, 2]]);
  assert.deepEqual(colAdded(0), [0, 1]);
  // 第 2 欄：只有 row4 被移除 → row3→4、row2→3、row1→2、row0→1，補 row0。
  assert.deepEqual(colMoves(2), [[3, 4], [2, 3], [1, 2], [0, 1]]);
  assert.deepEqual(colAdded(2), [0]);
  // 補入的格子在最後一次事件後盤面不再有空格
  assert.ok(engine.sym.every((s) => s !== EMPTY));
});

test('倍數球：8 眼 (1000) × 倍數球 10 = 2000.00；倍數事件 sum=10', () => {
  const engine = withBoard(['E E E E E E', 'E E o10 B K Y', 'R P U G S B', 'K Y R P U G', 'S B K Y R P'], 'orb-1');
  const r = engine.spinBase();
  const mul = r.events.find((e) => e.type === 'multiply');
  assert.ok(mul, '應有 multiply 事件');
  if (mul.sum === 10 && r.cascadeWin === 1000) {
    assert.equal(mul.baseWin, 1000);
    assert.equal(toMoney(mul.win), 2000);
    assert.equal(toMoney(r.win), 2000);
  } else {
    // 補入的隨機符號又連消或掉出新球時，仍需滿足 win = cascadeWin × sum
    assert.equal(mul.win, mul.baseWin * mul.sum);
  }
});

test('Scatter 4/5/6 個 = 60 / 100 / 2000，4 個以上觸發免費遊戲 15 次', () => {
  const s4 = withBoard(['sc S sc K Y R', 'U G S B K Y', 'R P U G sc B', 'K Y R P U sc', 'S B K Y R P']).spinBase();
  assert.equal(s4.scatterWin, 300);
  assert.equal(toMoney(s4.scatterWin), 60);
  assert.equal(s4.trigger, 'fg');
  assert.equal(s4.events.find((e) => e.type === 'trigger').spins, 15);
  const s5 = withBoard(['sc S sc K Y R', 'U G S B sc Y', 'R P U G sc B', 'K Y R P U sc', 'S B K Y R P']).spinBase();
  assert.equal(toMoney(s5.scatterWin), 100);
  const s6 = withBoard(['sc S sc K Y R', 'U sc S B sc Y', 'R P U G sc B', 'K Y R P U sc', 'S B K Y R P']).spinBase();
  assert.equal(toMoney(s6.scatterWin), 2000);
  assert.equal(toMoney(s6.win), 2000);
});

test('含黃金聖甲蟲的 4 個 scatter → 覺醒之力', () => {
  const r = withBoard(['sc S sc K Y R', 'U G S B K Y', 'R P U G sc B', 'K Y R P U gs', 'S B K Y R P']).spinBase();
  assert.equal(r.trigger, 'awaken');
});

test('JP：2/3/4/5 個 = MINI 100 / MINOR 500 / MAJOR 4000 / GRAND 40000', () => {
  const place = (n) => {
    const rows = NO_WIN.map((r) => r.split(' '));
    for (let c = 0; c < n; c++) rows[c % ROWS][c] = 'jp'; // 每欄最多一個 JP
    return rows.map((r) => r.join(' '));
  };
  const expect = { 2: 100, 3: 500, 4: 4000, 5: 40000 };
  for (const [n, x] of Object.entries(expect)) {
    const r = withBoard(place(Number(n))).spinBase();
    assert.equal(toMoney(r.jackpotWin), x, `JP ${n} 個`);
    assert.equal(r.events.find((e) => e.type === 'jackpot').tier, Number(n) - 2);
  }
});

test('神秘寶箱：未中獎盤面可得 1~100 倍押注，另附兩個誘餌', () => {
  const engine = withBoard(NO_WIN, 'mystery');
  engine.rig.mystery = true;
  const r = engine.spinBase();
  const m = r.events.find((e) => e.type === 'mystery');
  assert.ok(m);
  assert.ok([1, 2, 3, 5, 8, 10, 20, 50, 100].includes(m.win / 100));
  assert.equal(m.decoys.length, 2);
  assert.equal(r.win, r.mysteryWin);
});

test('toViews：內部索引 col*5+row 對應 view[row][col]、symbolPos = row*6+col、符號 id 對照', () => {
  const engine = withBoard(['E S B K Y R', 'P U G sc gs jp', 'st nt o5 o10 o50 o100', 'K Y R P U G', 'S B K Y R P'], 'views');
  const r = engine.spinBase();
  const v = toViews(r, BET)[0];
  assert.deepEqual(v.view[0], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(v.view[1], [7, 8, 9, 15, 16, 14]);
  assert.deepEqual(v.view[2], [17, 18, 13, 12, 11, 10]);
  assert.equal(v.timesSymbols.length, 4);
  assert.deepEqual(v.timesSymbols.map((t) => [t.symbolPos, t.times]), [[14, 5], [15, 10], [16, 50], [17, 100]]);
  assert.equal(posOf(indexOfPos(17)), 17);
  assert.equal(indexOfPos(2 * COLS + 5), 5 * ROWS + 2);
});

test('免費遊戲：購買時第一個 view 是對角線 4 個 scatter（支付 60.00），之後 15 轉 freeSpin 且倍數累加', () => {
  const engine = new SlotEngine(Rng.fromString('buy-fg'));
  const round = runRound(engine, BET, 'fg');
  const [first, ...rest] = round.views;
  assert.equal(first.startFreeGame, true);
  assert.equal(first.roundWinnings, 60);
  assert.deepEqual([first.view[0][0], first.view[1][1], first.view[2][2]], [15, 15, 15]);
  assert.ok([15, 16].includes(first.view[3][3]));
  assert.ok(rest.every((v) => v.action === 'freeSpin'));
  const featureSpins = round.spins.filter((s) => s.mode !== 'base');
  assert.ok(featureSpins.length >= 15, '至少 15 轉');
  // 總倍數只增不減，且等於各轉盤面倍數球加總（只在有贏分時加入）
  let acc = 0;
  for (const s of featureSpins) {
    const m = s.events.find((e) => e.type === 'multiply');
    if (m) {
      assert.equal(m.before, acc);
      acc += m.sum;
      assert.equal(m.after, acc);
      assert.equal(m.win, m.baseWin * acc);
    }
  }
  const total = round.views.at(-1).totalWinnings;
  const sum = round.spins.reduce((a, s) => a + s.win, 0);
  assert.equal(total, Math.round((sum * BET) / 100 * 100) / 100);
});

test('免費遊戲中 3 個 scatter 再觸發 +5 轉，上限 100 轉', () => {
  const engine = new SlotEngine(Rng.fromString('retrigger'));
  const f = engine.startFeature('fg');
  engine.rig = { board: (b) => { if (f.spinsPlayed === 1) setBoard(engine, ['sc S sc K Y R', 'U G S B K Y', 'R P U G sc B', 'K Y R P U G', 'S B K Y R P']); } };
  const r = engine.spinFeature(f);
  assert.equal(r.retrigger, 5);
  assert.equal(f.totalSpins, 20);
  assert.equal(f.spinsLeft, 19);
  f.totalSpins = 98;
  f.spinsLeft = 10;
  engine.rig = { board: (b) => setBoard(engine, ['sc S sc K Y R', 'U G S B K Y', 'R P U G sc B', 'K Y R P U G', 'S B K Y R P']) };
  const r2 = engine.spinFeature(f);
  assert.equal(r2.retrigger, 2);
  assert.equal(f.totalSpins, 100);
});

test('覺醒之力：3 個力量圖騰＋倍數球 → 分裂出 2 顆同值球並付 5.00；3 個鎖定圖騰 → 鎖定 2 回合', () => {
  const engine = new SlotEngine(Rng.fromString('skills'));
  const f = engine.startFeature('awaken');
  f.guaranteeSpin = Infinity;
  engine.rig = { board: () => setBoard(engine, ['st S st K Y R', 'U G S B K st', 'R P U G o25 B', 'K Y R P U G', 'S B K Y R P']) };
  const r = engine.spinFeature(f);
  const split = r.events.find((e) => e.type === 'split');
  assert.ok(split);
  assert.equal(split.targets.length, 2);
  assert.ok(split.targets.every((t) => t.cell.v === 25));
  assert.equal(toMoney(split.win), 5);
  assert.equal(f.splitLevel, 2);
  assert.equal(r.multiplier, 75, '三顆 25 倍球相加 = 75');
  const engine2 = new SlotEngine(Rng.fromString('skills-2'));
  const f2 = engine2.startFeature('awaken');
  f2.guaranteeSpin = Infinity;
  engine2.rig = { board: () => setBoard(engine2, ['nt S nt K Y R', 'U G S B K nt', 'R P U G o25 B', 'K Y R P U G', 'S B K Y R P']) };
  const r2 = engine2.spinFeature(f2);
  const lock = r2.events.find((e) => e.type === 'lock');
  assert.ok(lock);
  assert.deepEqual(lock.locks, [2]);
  assert.equal(f2.lockLevel, 2);
  // 鎖定的球下一轉仍在（lock 倒數為 1）
  const r3 = engine2.spinFeature(f2);
  assert.deepEqual(r3.events[0].kept.length, 1);
  assert.equal(r3.events[0].board[lock.orbs[0]].v, 25);
});

test('最高贏分封頂 81,000 倍', () => {
  const engine = withBoard(['E E E E E E', 'E E E E E E', 'o500 o500 o500 o500 o500 o500', 'o500 o500 o500 o500 o500 o500', 'o500 o500 o500 o500 o500 o500'], 'cap');
  const r = engine.spinBase();
  assert.equal(r.capped, true);
  assert.equal(r.win, 8100000);
  assert.equal(toMoney(r.win), 81000 * BET);
});

test('本地模擬：初始 100,000.00；下注 20 後點數 = 100000 − 20 + 贏分；closeSpin 後可再下注', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const demo = new LocalDemo({ storage, rng: Rng.fromString('demo'), now: () => 1700000000000 });
  assert.equal(demo.balanceMoney, 100000);
  assert.equal(demo.bet, 20);
  const rec = demo.spin();
  assert.equal(rec.cost, 2000);
  assert.equal(demo.balance, 10000000 - 2000 + rec.win);
  assert.throws(() => demo.spin(), /尚未結束/);
  demo.closeSpin(rec.id);
  assert.equal(demo.getBetRecords(5)[0].totalStake, 20);
  // 重新載入後點數延續
  const demo2 = new LocalDemo({ storage, rng: Rng.fromString('demo2') });
  assert.equal(demo2.balance, demo.balance);
  // 購買免費遊戲花費 200 倍 = 4000.00
  const buy = demo2.spin({ featureIndex: 0 });
  assert.equal(buy.cost, 400000);
  assert.equal(buy.feature, 'freeGame');
  assert.ok(buy.views.some((v) => v.action === 'freeSpin'));
});

test('每個測試情境都能在 400 次內產生符合條件的一局', () => {
  const demo = new LocalDemo({ storage: null, rng: Rng.fromString('scenarios') });
  for (const s of SCENARIOS) {
    demo.setScenario(s.id);
    const rec = demo.spin();
    demo.closeSpin(rec.id);
    if (s.accept) assert.ok(s.accept(rec.views, rec.bet), `情境 ${s.id} 未滿足`);
  }
});
