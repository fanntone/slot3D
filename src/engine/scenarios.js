// 測試情境：強制下一轉出現特定結果（與參考站測試面板相同的清單）。
import { SYM, JACKPOTS } from './config.js';

const hasFg = (views) => views.some((v) => v.startFreeGame);
const hasAwaken = (views) => views.some((v) => v.startFreeGame && v.isGoldenFg);
const winX = (views, bet) => views.at(-1).totalWinnings / bet;

const orbsThen = (sym, count, orbValues) => ({
  board(b, mode, spinsPlayed) {
    if (spinsPlayed) return;
    for (const v of orbValues) b.place(SYM.ORB, 1, v);
    b.place(sym, count);
  },
});
const bigWin = (id, label, lo, hi, rig) => ({
  id,
  group: '大獎',
  label,
  rig,
  accept: (views, bet) => !hasFg(views) && winX(views, bet) >= lo && winX(views, bet) < hi,
});
const goldenTrigger = (b) => {
  b.place(SYM.SCATTER, 3);
  b.place(SYM.GOLD_SCATTER, 1);
};
const awakenSkill = (totems) => ({
  board(b, mode, spinsPlayed) {
    if (spinsPlayed === 0) return goldenTrigger(b);
    b.place(SYM.ORB, 1, 5);
    for (const t of totems) b.place(t, 3);
  },
});

export const SCENARIOS = [
  { id: 'fg', group: '特色', label: '免費遊戲', rig: { board: (b, m, n) => { if (!n) b.place(SYM.SCATTER, 4); } }, accept: (v) => hasFg(v) && !hasAwaken(v) },
  { id: 'awaken', group: '特色', label: '覺醒之力', rig: { board: (b, m, n) => { if (!n) goldenTrigger(b); } }, accept: hasAwaken },
  { id: 'split', group: '特色', label: '覺醒＋賽特分裂', rig: awakenSkill([SYM.SET_TOTEM]), accept: (v) => hasAwaken(v) && v.some((x) => x.splitList.length > 0) },
  { id: 'lock', group: '特色', label: '覺醒＋奈芙蒂斯鎖定', rig: awakenSkill([SYM.NEPH_TOTEM]), accept: (v) => hasAwaken(v) && v.some((x) => x.femaleTotemLevel > 0) },
  { id: 'both', group: '特色', label: '覺醒＋分裂＋鎖定', rig: awakenSkill([SYM.SET_TOTEM, SYM.NEPH_TOTEM]), accept: (v) => hasAwaken(v) && v.some((x) => x.splitList.length > 0) && v.some((x) => x.femaleTotemLevel > 0) },
  { id: 'retrigger', group: '特色', label: '免費遊戲再觸發', rig: { board: (b, m, n) => b.place(SYM.SCATTER, n === 0 ? 4 : n === 1 ? 3 : 0) }, accept: (v) => hasFg(v) && !hasAwaken(v) },
  { id: 'awaken-retrigger', group: '特色', label: '覺醒再觸發', rig: { board: (b, m, n) => { if (n === 0) goldenTrigger(b); else if (n === 1) b.place(SYM.GOLD_SCATTER, 3); } }, accept: hasAwaken },
  { id: 'tease', group: '特色', label: 'Scatter 聽牌（3 個）', rig: { board: (b, m, n) => { if (!n) b.place(SYM.SCATTER, 3); } }, accept: (v) => !hasFg(v) },
  bigWin('big', 'BIG WIN（20 倍）', 20, 50, orbsThen(SYM.GEM_YELLOW, 12, [3])),
  bigWin('super', 'SUPER WIN（50 倍）', 50, 100, orbsThen(SYM.GEM_YELLOW, 12, [4, 3])),
  bigWin('mega', 'MEGA WIN（100 倍）', 100, 300, orbsThen(SYM.GEM_YELLOW, 12, [10, 8])),
  bigWin('ultra', 'ULTRA WIN（300 倍）', 300, 1000, orbsThen(SYM.GEM_YELLOW, 12, [50])),
  bigWin('legend', 'LEGENDARY（1000 倍）', 1000, 81000, orbsThen(SYM.EYE, 12, [20, 10])),
  bigWin('max', '最高贏分 81000 倍', 81000, Infinity, orbsThen(SYM.EYE, 12, [500, 500, 500, 250])),
  ...JACKPOTS.map((j, t) => ({
    id: j.id,
    group: '彩金',
    label: `JP ${j.name}（${j.count} 個）`,
    rig: { board: (b, m, n) => { if (!n) b.place(SYM.JP, j.count); } },
    accept: (v) => !hasFg(v) && v.some((x) => x.isJp === j.id),
  })),
  { id: 'orbs', group: '倍數球', label: '倍數球乘倍', rig: orbsThen(SYM.GEM_GREEN, 9, [5, 10, 25]), accept: (v) => !hasFg(v) && v.some((x) => x.timesSymbols.length >= 3 && x.winSymbols.length > 0) },
  { id: 'combo', group: '倍數球', label: '連消連續出招', rig: orbsThen(SYM.GEM_GREEN, 10, [5]), accept: (v) => !hasFg(v) && v.filter((x) => x.newTimesSymbols.length > 0).length >= 2 },
  { id: 'cascades', group: '倍數球', label: '連續消除', rig: orbsThen(SYM.GEM_GREEN, 10, []), accept: (v) => !hasFg(v) && v.filter((x) => x.winSymbols.length > 0).length >= 3 },
  {
    id: 'rare',
    group: '倍數球',
    label: '稀有倍數球升級',
    rig: { board: (b, m, n) => { if (!n) { b.place(SYM.ORB, 1, 5, true); b.place(SYM.ORB, 1, 10, true); b.place(SYM.GEM_BLUE, 10); } } },
    accept: (v) => !hasFg(v) && v.some((x) => x.timesUpgrade.length > 0),
  },
  { id: 'mystery', group: '其他', label: '神秘寶箱', rig: { mystery: true }, accept: (v) => !hasFg(v) && v.some((x) => x.noWinReward > 0) && v.every((x) => x.winSymbols.length === 0) },
  {
    id: 'full',
    group: '其他',
    label: '滿盤 FULL COMBO',
    rig: { board: (b, m, n) => { if (!n) b.fill([SYM.GEM_YELLOW, SYM.GEM_RED, SYM.GEM_PURPLE, SYM.GEM_BLUE, SYM.GEM_GREEN][b.rng.int(5)]); } },
    accept: (v) => !hasFg(v),
  },
];

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) ?? null;
