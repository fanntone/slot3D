// 老虎機核心：5 列 × 6 欄、8 個以上同符號任意位置消除、倍數球、免費遊戲、覺醒之力、JP、神秘寶箱。
// 盤面索引 i = col * 5 + row（row 0 為最上列）。
import { Rng, WeightedPicker } from './rng.js';
import {
  SYM, EMPTY, CELLS, COLS, ROWS, PAYING_SYMBOLS, isScatter, PAYTABLE, payTier, MIN_MATCH, SCATTER_PAY, ORB_VALUES,
  RARE_STEP_WEIGHTS, FREE_GAME, AWAKEN, TOTEM_PAY, MAX_WIN, SUPER_MAIN, JACKPOTS, MYSTERY, MODE_CONFIG,
} from './config.js';

function compileMode(cfg) {
  const ids = [];
  const weights = [];
  const add = (id, w) => {
    if (w > 0) {
      ids.push(id);
      weights.push(w);
    }
  };
  cfg.symbols.forEach((w, i) => add(i, w));
  add(SYM.SCATTER, cfg.scatter);
  add(SYM.ORB, cfg.orb);
  add(SYM.JP, cfg.jp);
  add(SYM.SET_TOTEM, cfg.setTotem);
  add(SYM.NEPH_TOTEM, cfg.nephTotem);
  return { ids, draw: new WeightedPicker(weights), gold: cfg.goldChance, orbValue: new WeightedPicker(cfg.orbValues), rare: cfg.rareChance };
}

export class SlotEngine {
  constructor(rng = new Rng(), modeConfig = MODE_CONFIG) {
    this.rng = rng;
    this.modes = {
      base: compileMode(modeConfig.base),
      fg: compileMode(modeConfig.fg),
      awaken: compileMode(modeConfig.awaken),
      super: compileMode(modeConfig.super),
    };
    this.sym = new Int8Array(CELLS);
    this.val = new Int16Array(CELLS);
    this.rare = new Uint8Array(CELLS);
    this.lock = new Int8Array(CELLS);
    this.removed = new Uint8Array(CELLS);
    this.counts = new Int32Array(PAYING_SYMBOLS);
    this.rareSteps = new WeightedPicker(RARE_STEP_WEIGHTS);
    this.mysteryPick = new WeightedPicker(MYSTERY.weights);
    this.rig = null; // 測試情境：{ board(rigBoard, mode, spinsPlayed), mystery }
    this.long = null; // 交易所買進：{ symbol, factor }
    this.superGame = false;
    this.jackpotPay = (tier) => JACKPOTS[tier].x * 100;
  }

  spinBase(withEvents = true) {
    return this.spin('base', null, withEvents);
  }

  startFeature(kind, roundWin = 0) {
    return {
      kind,
      spinsLeft: FREE_GAME.award,
      spinsPlayed: 0,
      totalSpins: FREE_GAME.award,
      multiplier: 0,
      win: 0,
      roundWin,
      splitLevel: 1,
      lockLevel: 1,
      skillFired: false,
      guaranteeSpin: 1 + this.rng.int(AWAKEN.guaranteeLatestSpin),
      capped: false,
      splits: 0,
      locks: 0,
      heldV: Array(CELLS).fill(0),
      heldRare: Array(CELLS).fill(0),
      heldLock: Array(CELLS).fill(0),
    };
  }

  startSuper() {
    return { ...this.startFeature('awaken'), super: true, spinsLeft: 1, totalSpins: 1, guaranteeSpin: Infinity, lockLevel: SUPER_MAIN.lockLevel };
  }

  spinFeature(feature, withEvents = true) {
    if (feature.spinsLeft <= 0) throw new Error('feature is over');
    return this.spin(feature.kind, feature, withEvents);
  }

  spin(mode, feature, withEvents) {
    const { rng, sym, val, rare, lock } = this;
    this.superGame = feature?.super === true;
    const cfg = this.modes[this.superGame ? 'super' : mode];
    const events = withEvents ? [] : null;
    const isAwaken = feature?.kind === 'awaken';
    if (this.superGame && feature) feature.multiplier = 0;
    if (feature) {
      feature.spinsLeft--;
      feature.spinsPlayed++;
    }
    sym.fill(EMPTY);
    lock.fill(0);
    const kept = [];
    if (feature && isAwaken) {
      for (let i = 0; i < CELLS; i++) {
        if (feature.heldLock[i] > 0) {
          sym[i] = SYM.ORB;
          val[i] = feature.heldV[i];
          rare[i] = feature.heldRare[i];
          lock[i] = feature.heldLock[i];
          kept.push(i);
        }
      }
    }
    for (let c = 0; c < COLS; c++) this.fillColumn(c, cfg, null);
    this.rig?.board?.(this.rigBoard(), mode, feature ? feature.spinsPlayed : 0);
    if (this.superGame && feature) {
      if (!this.cellsOf(SYM.ORB).length) {
        const cells = this.payingCells();
        const t = cells.length ? rng.take(cells) : rng.int(CELLS);
        sym[t] = SYM.ORB;
        val[t] = 500;
        rare[t] = 0;
      }
      if (feature.spinsPlayed === 1) this.addTotems(SYM.NEPH_TOTEM, this.payingCells());
    }
    if (feature && isAwaken && !feature.skillFired && feature.spinsPlayed >= feature.guaranteeSpin) this.forceSkill(cfg);
    events?.push({ type: 'drop', board: this.snapshot(), kept });
    if (kept.length) {
      const ups = events ? [] : null;
      for (const i of kept) if (rare[i]) this.powerUp(i, ups);
      if (ups?.length) events.push({ type: 'upgrade', orbs: ups });
    }

    let cascadeWin = 0;
    for (;;) {
      const groups = events ? [] : null;
      const w = this.evaluate(groups, feature ? null : this.long);
      if (!w) break;
      cascadeWin += w;
      events?.push({ type: 'win', groups, stepWin: w, totalWin: cascadeWin });
      const ups = events ? [] : null;
      for (let i = 0; i < CELLS; i++) if (sym[i] === SYM.ORB && rare[i]) this.powerUp(i, ups);
      if (ups?.length) events.push({ type: 'upgrade', orbs: ups });
      if (events) {
        const t = { type: 'tumble', removed: this.removedCells(), moves: [], added: [] };
        this.collapse(cfg, t);
        events.push(t);
      } else this.collapse(cfg, null);
    }

    if (feature && isAwaken) {
      for (let i = 0; i < CELLS; i++) if (lock[i] > 0) lock[i]--;
      cascadeWin += this.awakenSkills(feature, events);
    }

    let win = cascadeWin;
    let multiplier = 0;
    if (cascadeWin > 0) {
      const orbs = this.cellsOf(SYM.ORB);
      if (orbs.length) {
        let sum = 0;
        for (const i of orbs) sum += val[i];
        const before = feature ? feature.multiplier : 0;
        multiplier = feature ? (feature.multiplier += sum) : sum;
        win = cascadeWin * multiplier;
        events?.push({ type: 'multiply', orbs, sum, before, after: multiplier, baseWin: cascadeWin, win });
      }
    }

    const scatters = this.scatterCells();
    let scatterWin = 0;
    let jackpotWin = 0;
    let mysteryWin = 0;
    if (scatters.length >= 4) {
      const p = SCATTER_PAY[Math.min(6, scatters.length)];
      win += p;
      scatterWin = p;
      events?.push({ type: 'scatterPay', cells: scatters, count: scatters.length, win: p });
    }
    let trigger = null;
    let retrigger = 0;
    if (!feature && scatters.length >= FREE_GAME.trigger) trigger = scatters.some((i) => sym[i] === SYM.GOLD_SCATTER) ? 'awaken' : 'fg';
    else if (feature && !this.superGame && scatters.length >= FREE_GAME.retrigger) retrigger = Math.min(FREE_GAME.retriggerAward, FREE_GAME.maxSpins - feature.totalSpins);

    if (!feature) {
      const jps = this.cellsOf(SYM.JP);
      let tier = -1;
      JACKPOTS.forEach((j, t) => {
        if (jps.length >= j.count) tier = t;
      });
      if (tier >= 0) {
        const p = this.jackpotPay(tier);
        win += p;
        jackpotWin = p;
        events?.push({ type: 'jackpot', cells: jps, tier, win: p });
      }
      if (rng.chance(MYSTERY.chance) || this.rig?.mystery) {
        const p = MYSTERY.prizesX[this.mysteryPick.pick(rng)] * 100;
        win += p;
        mysteryWin = p;
        const decoys = [0, 1].map(() => MYSTERY.prizesX[rng.int(MYSTERY.prizesX.length)] * 100);
        events?.push({ type: 'mystery', win: p, decoys });
      }
    }

    let capped = false;
    const roundWin = feature ? feature.roundWin : 0;
    if (roundWin + win >= MAX_WIN) {
      win = MAX_WIN - roundWin;
      capped = true;
      trigger = null;
      retrigger = 0;
      events?.push({ type: 'cap', win });
    }
    if (trigger) events?.push({ type: 'trigger', kind: trigger, cells: scatters, spins: FREE_GAME.award });
    if (feature) {
      if (retrigger > 0) {
        feature.spinsLeft += retrigger;
        feature.totalSpins += retrigger;
        events?.push({ type: 'retrigger', cells: scatters, added: retrigger, total: feature.totalSpins });
      }
      feature.win += win;
      feature.roundWin += win;
      if (capped) {
        feature.capped = true;
        feature.spinsLeft = 0;
      }
      if (isAwaken) {
        for (let i = 0; i < CELLS; i++) {
          const held = sym[i] === SYM.ORB && lock[i] > 0;
          feature.heldLock[i] = held ? lock[i] : 0;
          feature.heldV[i] = held ? val[i] : 0;
          feature.heldRare[i] = held ? rare[i] : 0;
        }
        if (this.superGame && !capped) feature.spinsLeft = Math.min(FREE_GAME.maxSpins - feature.spinsPlayed, Math.max(...feature.heldLock));
      }
    }
    return { mode, events: events ?? [], cascadeWin, multiplier, win, scatterWin, jackpotWin, mysteryWin, trigger, retrigger, capped };
  }

  // 覺醒技能：三個力量圖騰 + 倍數球 → 分裂；三個鎖定圖騰 + 倍數球 → 鎖定。
  awakenSkills(feature, events) {
    const { rng, sym, val, rare, lock } = this;
    let win = 0;
    const setTotems = this.cellsOf(SYM.SET_TOTEM);
    let orbs = this.cellsOf(SYM.ORB);
    if (setTotems.length >= AWAKEN.totemsNeeded && orbs.length) {
      const level = feature.splitLevel;
      const source = orbs[rng.int(orbs.length)];
      const cells = this.payingCells();
      const n = Math.min(level * AWAKEN.splitPerLevel, cells.length);
      const targets = [];
      for (let k = 0; k < n; k++) {
        const i = rng.take(cells);
        sym[i] = SYM.ORB;
        val[i] = val[source];
        rare[i] = rare[source];
        lock[i] = 0;
        targets.push({ i, cell: this.cell(i) });
      }
      feature.splitLevel = Math.min(AWAKEN.maxLevel, level + 1);
      feature.skillFired = true;
      feature.splits++;
      win += TOTEM_PAY;
      events?.push({ type: 'split', totems: setTotems, source, targets, level, win: TOTEM_PAY });
      orbs = this.cellsOf(SYM.ORB);
    }
    const nephTotems = this.cellsOf(SYM.NEPH_TOTEM);
    if (nephTotems.length >= AWAKEN.totemsNeeded && orbs.length) {
      const level = feature.lockLevel;
      const rounds = level * AWAKEN.lockPerLevel;
      for (const i of orbs) lock[i] = Math.max(lock[i], rounds);
      feature.lockLevel = Math.min(AWAKEN.maxLevel, level + 1);
      feature.skillFired = true;
      feature.locks++;
      win += TOTEM_PAY;
      events?.push({ type: 'lock', totems: nephTotems, orbs, rounds, level, locks: orbs.map((i) => lock[i]), win: TOTEM_PAY });
    }
    return win;
  }

  // 覺醒保底：到了保底轉數仍未觸發技能，就強制放上三個圖騰（與至少一顆倍數球）。
  forceSkill(cfg) {
    const { rng, sym, val, rare } = this;
    const totem = rng.chance(0.5) ? SYM.SET_TOTEM : SYM.NEPH_TOTEM;
    const cells = this.payingCells();
    this.addTotems(totem, cells);
    if (!this.cellsOf(SYM.ORB).length && cells.length) {
      const i = rng.take(cells);
      sym[i] = SYM.ORB;
      val[i] = ORB_VALUES[cfg.orbValue.pick(rng)];
      rare[i] = rng.chance(cfg.rare) ? 1 : 0;
    }
  }

  addTotems(totem, cells) {
    let n = AWAKEN.totemsNeeded - this.cellsOf(totem).length;
    while (n-- > 0 && cells.length) this.sym[this.rng.take(cells)] = totem;
  }

  // 測試情境用的盤面操作介面。
  rigBoard() {
    const { rng, sym, val, rare, lock } = this;
    const columnLimited = (s) => isScatter(s) || s === SYM.JP;
    const columnHas = (col, s) => {
      for (let r = 0; r < ROWS; r++) {
        const v = sym[col * ROWS + r];
        if (s === SYM.JP ? v === SYM.JP : isScatter(v)) return true;
      }
      return false;
    };
    return {
      rng,
      place: (s, count, orbValue = 0, rareOrb = false) => {
        const placed = [];
        for (let k = 0; k < count; k++) {
          const cells = this.payingCells().filter((i) => lock[i] === 0 && !(columnLimited(s) && columnHas(Math.floor(i / ROWS), s)));
          if (!cells.length) break;
          const i = rng.take(cells);
          sym[i] = s;
          val[i] = s === SYM.ORB ? orbValue : 0;
          rare[i] = s === SYM.ORB && rareOrb ? 1 : 0;
          placed.push(i);
        }
        return placed;
      },
      fill: (s) => {
        for (let i = 0; i < CELLS; i++) {
          if (lock[i] > 0) continue;
          sym[i] = s;
          val[i] = 0;
          rare[i] = 0;
        }
      },
    };
  }

  evaluate(groups, long) {
    const { sym, counts, removed } = this;
    counts.fill(0);
    for (let i = 0; i < CELLS; i++) {
      const s = sym[i];
      if (s >= 0 && s < PAYING_SYMBOLS) counts[s]++;
    }
    removed.fill(0);
    let total = 0;
    for (let s = 0; s < PAYING_SYMBOLS; s++) {
      const n = counts[s];
      if (n < MIN_MATCH) continue;
      const w = PAYTABLE[s][payTier(n)] * (long?.symbol === s ? long.factor : 1);
      total += w;
      const cells = groups ? [] : null;
      for (let i = 0; i < CELLS; i++) {
        if (sym[i] === s) {
          removed[i] = 1;
          cells?.push(i);
        }
      }
      groups?.push({ s, count: n, cells, win: w });
    }
    return total;
  }

  collapse(cfg, tumble) {
    const { sym, val, rare, lock, removed } = this;
    for (let c = 0; c < COLS; c++) {
      const base = c * ROWS;
      let dst = ROWS - 1;
      while (dst >= 0 && lock[base + dst] > 0) dst--;
      for (let r = ROWS - 1; r >= 0; r--) {
        const i = base + r;
        if (lock[i] > 0 || removed[i]) continue;
        const j = base + dst;
        if (j !== i) {
          sym[j] = sym[i];
          val[j] = val[i];
          rare[j] = rare[i];
          tumble?.moves.push([i, j]);
        }
        dst--;
        while (dst >= 0 && lock[base + dst] > 0) dst--;
      }
      for (let r = dst; r >= 0; r--) if (lock[base + r] === 0) sym[base + r] = EMPTY;
      this.fillColumn(c, cfg, tumble ? tumble.added : null);
    }
    removed.fill(0);
  }

  fillColumn(c, cfg, added) {
    const { rng, sym, val, rare, lock } = this;
    const base = c * ROWS;
    let hasScatter = false;
    let hasJp = false;
    for (let r = 0; r < ROWS; r++) {
      const s = sym[base + r];
      if (isScatter(s)) hasScatter = true;
      else if (s === SYM.JP) hasJp = true;
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = base + r;
      if (sym[i] !== EMPTY) continue;
      let s;
      for (;;) {
        s = cfg.ids[cfg.draw.pick(rng)];
        if (s === SYM.SCATTER) {
          if (hasScatter) continue;
          hasScatter = true;
          if (cfg.gold > 0 && !this.superGame && rng.chance(cfg.gold)) s = SYM.GOLD_SCATTER;
        } else if (s === SYM.JP) {
          if (hasJp) continue;
          hasJp = true;
        }
        break;
      }
      sym[i] = s;
      lock[i] = 0;
      if (s === SYM.ORB) {
        val[i] = this.superGame ? 500 : ORB_VALUES[cfg.orbValue.pick(rng)];
        rare[i] = rng.chance(cfg.rare) ? 1 : 0;
      } else {
        val[i] = 0;
        rare[i] = 0;
      }
      added?.push({ i, cell: this.cell(i) });
    }
  }

  powerUp(i, ups) {
    const v = this.val[i];
    if (v >= 500) return;
    const idx = ORB_VALUES.indexOf(v);
    const nv = ORB_VALUES[Math.min(ORB_VALUES.length - 1, idx + this.rareSteps.pick(this.rng))];
    this.val[i] = nv;
    ups?.push({ i, from: v, to: nv });
  }

  cellsOf(s) {
    const out = [];
    for (let i = 0; i < CELLS; i++) if (this.sym[i] === s) out.push(i);
    return out;
  }

  scatterCells() {
    const out = [];
    for (let i = 0; i < CELLS; i++) if (isScatter(this.sym[i])) out.push(i);
    return out;
  }

  payingCells() {
    const out = [];
    for (let i = 0; i < CELLS; i++) if (this.sym[i] >= 0 && this.sym[i] < PAYING_SYMBOLS) out.push(i);
    return out;
  }

  removedCells() {
    const out = [];
    for (let i = 0; i < CELLS; i++) if (this.removed[i]) out.push(i);
    return out;
  }

  cell(i) {
    return { s: this.sym[i], v: this.val[i], rare: this.rare[i] === 1, lock: this.lock[i] };
  }

  snapshot() {
    return Array.from({ length: CELLS }, (_, i) => this.cell(i));
  }
}
