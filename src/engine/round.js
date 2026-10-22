// 把引擎事件轉成「伺服器回應格式」的 view 清單（與參考站 gameState[] 相同），並執行完整一局（含免費遊戲）。
import { SYM, CELLS, COLS, ROWS, FREE_GAME, BUY_FEATURE, SCATTER_PAY } from './config.js';

export const posOf = (i) => (i % ROWS) * COLS + Math.floor(i / ROWS); // 內部索引 → symbolPos（row*6+col）
export const indexOfPos = (pos) => (pos % COLS) * ROWS + Math.floor(pos / COLS); // symbolPos → 內部索引
export const orbSymbolId = (v) => (v >= 100 ? 10 : v >= 50 ? 11 : v >= 10 ? 12 : 13);
export const money = (x) => Math.round(x * 100) / 100;

export function clientSymbol(cell) {
  if (cell.s < 9) return cell.s + 1;
  switch (cell.s) {
    case SYM.SCATTER: return 15;
    case SYM.GOLD_SCATTER: return 16;
    case SYM.ORB: return orbSymbolId(cell.v);
    case SYM.JP: return 14;
    case SYM.SET_TOTEM: return 17;
    case SYM.NEPH_TOTEM: return 18;
    default: return 0;
  }
}

export function toViews(result, bet, prevTotal = 0, freeGameCount = 0, currentTimes = 0) {
  let board = [];
  const views = [];
  let cur = null;
  const toMoney = (w) => money((w * bet) / 100);
  const timesSymbols = () => board.flatMap((cell, i) => (cell.s === SYM.ORB ? [{ symbol: clientSymbol(cell), symbolPos: posOf(i), times: cell.v, isRare: cell.rare, lock: cell.lock }] : []));
  const pushView = (newPositions) => {
    const view = Array.from({ length: ROWS }, () => new Array(COLS));
    board.forEach((cell, i) => {
      view[i % ROWS][Math.floor(i / ROWS)] = clientSymbol(cell);
    });
    const ts = timesSymbols();
    cur = {
      action: result.mode === 'base' ? 'spin' : 'freeSpin',
      totalStake: bet,
      view,
      winSymbols: [],
      timesSymbols: ts,
      newTimesSymbols: ts.filter((t) => newPositions.includes(t.symbolPos)),
      timesUpgrade: [],
      maleTotemLevel: 0,
      femaleTotemLevel: 0,
      splitList: [],
      posTransform: [],
      freeGameCount,
      superMainGameCount: 0,
      isGoldenFg: result.mode === 'awaken',
      isJp: '',
      currentTimes: result.mode === 'base' ? 0 : currentTimes,
      roundWinnings: cur?.roundWinnings ?? 0,
      totalWinnings: cur?.totalWinnings ?? prevTotal,
      totalViews: 1,
      currentView: 0,
      startFreeGame: false,
      noWinReward: 0,
    };
    views.push(cur);
  };
  for (const ev of result.events) {
    switch (ev.type) {
      case 'drop':
        board = structuredClone(ev.board);
        pushView(board.flatMap((cell, i) => (cell.s === SYM.ORB && !ev.kept.includes(i) ? [posOf(i)] : [])));
        break;
      case 'win':
        cur.winSymbols = ev.groups.map((g) => ({ symbol: g.s + 1, winnings: toMoney(g.win), symbolPos: g.cells.map(posOf) }));
        cur.roundWinnings = toMoney(ev.totalWin);
        cur.totalWinnings = money(prevTotal + cur.roundWinnings);
        break;
      case 'upgrade':
        cur.timesUpgrade = ev.orbs.map((o) => ({ symbolPos: posOf(o.i), beforeSymbol: orbSymbolId(o.from), afterSymbol: orbSymbolId(o.to), beforeTimes: o.from, afterTimes: o.to }));
        for (const o of ev.orbs) board[o.i].v = o.to;
        break;
      case 'tumble': {
        const prev = structuredClone(board);
        cur.posTransform = ev.moves.map(([a, b]) => ({ beforePos: posOf(a), afterPos: posOf(b) }));
        for (const [a, b] of ev.moves) board[b] = prev[a];
        for (const a of ev.added) board[a.i] = { ...a.cell };
        pushView(ev.added.map((a) => posOf(a.i)));
        break;
      }
      case 'split':
        cur.maleTotemLevel = ev.level;
        cur.winSymbols.push({ symbol: 17, winnings: toMoney(ev.win), symbolPos: ev.totems.map(posOf) });
        cur.roundWinnings = money(cur.roundWinnings + toMoney(ev.win));
        cur.totalWinnings = money(prevTotal + cur.roundWinnings);
        cur.splitList = [{ from: posOf(ev.source), to: ev.targets.map((t) => posOf(t.i)) }];
        for (const t of ev.targets) board[t.i] = { ...t.cell };
        cur.timesSymbols = timesSymbols();
        pushView([]);
        break;
      case 'lock':
        cur.femaleTotemLevel = ev.level;
        cur.winSymbols.push({ symbol: 18, winnings: toMoney(ev.win), symbolPos: ev.totems.map(posOf) });
        cur.roundWinnings = money(cur.roundWinnings + toMoney(ev.win));
        cur.totalWinnings = money(prevTotal + cur.roundWinnings);
        ev.orbs.forEach((i, k) => {
          board[i].lock = ev.locks[k];
        });
        cur.timesSymbols = timesSymbols();
        pushView([]);
        break;
      case 'multiply':
        cur.currentTimes = result.mode === 'base' ? -1 : ev.before;
        break;
      case 'jackpot':
        cur.isJp = ['jp-mini', 'jp-minor', 'jp-major', 'jp-grand'][ev.tier];
        break;
      case 'mystery':
        cur.noWinReward = toMoney(ev.win);
        break;
      case 'trigger':
        cur.startFreeGame = true;
        cur.isGoldenFg = ev.kind === 'awaken';
        cur.freeGameCount = ev.spins;
        break;
      case 'retrigger':
        cur.freeGameCount += ev.added;
        break;
      default:
        break;
    }
  }
  cur.roundWinnings = toMoney(result.win);
  cur.totalWinnings = money(prevTotal + cur.roundWinnings);
  if (result.mode === 'base') cur.currentTimes = -1;
  return views;
}

// 購買特色時的「觸發盤面」：對角線四個 scatter（覺醒時最後一個為黃金聖甲蟲），支付 3 倍押注。
function boughtTriggerSpin(kind) {
  const board = Array.from({ length: CELLS }, (_, i) => ({ s: posOf(i) % 9, v: 0, rare: false, lock: 0 }));
  const cells = [];
  for (let k = 0; k < 4; k++) {
    const i = indexOfPos(k * COLS + k);
    board[i] = { s: k === 3 && kind === 'awaken' ? SYM.GOLD_SCATTER : SYM.SCATTER, v: 0, rare: false, lock: 0 };
    cells.push(i);
  }
  const pay = SCATTER_PAY[4];
  return {
    mode: 'base',
    bought: true,
    events: [
      { type: 'drop', board, kept: [] },
      { type: 'scatterPay', cells, count: 4, win: pay },
      { type: 'trigger', kind, cells, spins: FREE_GAME.award },
    ],
    cascadeWin: 0, multiplier: 0, win: pay, scatterWin: pay, jackpotWin: 0, mysteryWin: 0, trigger: kind, retrigger: 0, capped: false,
  };
}

// 執行一局：主遊戲一轉，若觸發則跑完整個免費遊戲。feature：undefined | 'fg' | 'awaken' | 'super'（購買）。
// 回傳 { views, spins, feature }，spins 為每一轉的引擎結果（含 events），供前端演出。
export function runRound(engine, bet, feature) {
  const spins = [];
  const base = feature ? null : engine.spinBase();
  let views = [];
  if (base) {
    spins.push(base);
    views = toViews(base, bet);
  }
  const kind = feature === 'super' ? 'awaken' : feature === 'fg' ? (engine.rng.chance(BUY_FEATURE.awakenChance) ? 'awaken' : 'fg') : (feature ?? base?.trigger);
  let featureState = null;
  if (kind) {
    featureState = feature === 'super' ? engine.startSuper() : engine.startFeature(kind, base?.win ?? 0);
    if (feature && feature !== 'super') {
      const fake = boughtTriggerSpin(kind);
      spins.push(fake);
      const v = toViews(fake, bet)[0];
      v.startFreeGame = true;
      v.isGoldenFg = kind === 'awaken';
      v.freeGameCount = FREE_GAME.award;
      views.push(v);
      featureState.roundWin = SCATTER_PAY[4];
    }
    while (featureState.spinsLeft > 0 && !featureState.capped) {
      const before = featureState.multiplier;
      const r = engine.spinFeature(featureState);
      r.spinsLeft = featureState.spinsLeft;
      r.totalSpins = featureState.totalSpins;
      r.spinsPlayed = featureState.spinsPlayed;
      r.multiplierBefore = before;
      r.featureWin = featureState.win;
      spins.push(r);
      views.push(...toViews(r, bet, views.at(-1)?.totalWinnings ?? 0, featureState.spinsLeft - r.retrigger, before));
    }
    if (feature === 'super') {
      for (const v of views) {
        v.action = 'superSpin';
        v.superMainGameCount = v.freeGameCount;
        v.freeGameCount = 0;
        v.startFreeGame = false;
        v.isGoldenFg = false;
        v.currentTimes = v.winSymbols.length ? 0 : -1;
      }
    }
  }
  views.forEach((v, i) => {
    v.currentView = i;
    v.totalViews = views.length;
  });
  return { views, spins, feature: kind ? { kind, bought: feature ?? null, super: feature === 'super', state: featureState } : null };
}
