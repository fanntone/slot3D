// 本地模擬伺服器：點數、押注、產生一局、紀錄、測試情境。金額內部以「分」計（整數），對外以元（兩位小數）。
import { Rng } from './rng.js';
import { SlotEngine } from './engine.js';
import { runRound, money } from './round.js';
import { scenarioById } from './scenarios.js';
import { STAKE_VALUES, RATIO_VALUES, totalBet, DEFAULT_SETTINGS, INITIAL_BALANCE_CENTS, BUY_FEATURES, JACKPOTS, AUTOPLAY_COUNTS } from './config.js';

export const STORAGE_KEY = 'slot3d.demo.v1';
export const GAME_NAME = '戰神賽特 II・覺醒之力';
const MAX_RECORDS = 100;

const defaultSettings = () => ({
  stakeIndex: DEFAULT_SETTINGS.stakeIndex,
  ratioIndex: DEFAULT_SETTINGS.ratioIndex,
  turbo: false,
  sounds: { background: true, effect: true, backgroundVolume: 0.26, effectVolume: 0.22 },
  autoPlay: { count: AUTOPLAY_COUNTS[0], stopOnWinMultiplier: true, stopOnWinMultiplierValue: 20, stopOnJackpot: true, stopOnFreeSpin: false, stopOnBalance: false, stopOnBalanceValue: 0 },
});

const randomId = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

export class LocalDemo {
  constructor({ storage = globalThis.localStorage ?? null, rng = new Rng(), now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
    this.engine = new SlotEngine(rng);
    this.balance = INITIAL_BALANCE_CENTS;
    this.settings = defaultSettings();
    this.records = [];
    this.pending = null;
    this.scenario = null;
    this.keepScenario = false;
    this.onScenarioChange = null;
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      if (!saved) return;
      if (Number.isSafeInteger(saved.balance) && saved.balance >= 0) this.balance = saved.balance;
      if (Array.isArray(saved.records)) this.records = saved.records.filter((r) => r && typeof r.id === 'string').slice(0, MAX_RECORDS);
      this.applySettings(saved.settings);
    } catch {
      /* 壞掉的儲存內容就忽略 */
    }
  }

  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ balance: this.balance, records: this.records, settings: this.settings }));
    } catch {
      /* 無法儲存（隱私模式等）不影響遊戲 */
    }
  }

  // 只接受型別相同的既有欄位（遞迴），避免壞資料污染設定。
  applySettings(patch) {
    const merge = (target, src) => {
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      for (const [k, v] of Object.entries(src)) {
        if (!Object.hasOwn(target, k)) continue;
        const cur = target[k];
        if (cur && typeof cur === 'object' && !Array.isArray(cur)) merge(cur, v);
        else if ((typeof cur === 'boolean' && typeof v === 'boolean') || (typeof cur === 'number' && typeof v === 'number' && Number.isFinite(v))) target[k] = v;
      }
    };
    merge(this.settings, patch);
    const s = this.settings;
    if (!Number.isInteger(s.stakeIndex) || STAKE_VALUES[s.stakeIndex] === undefined) s.stakeIndex = DEFAULT_SETTINGS.stakeIndex;
    if (!Number.isInteger(s.ratioIndex) || RATIO_VALUES[s.ratioIndex] === undefined) s.ratioIndex = DEFAULT_SETTINGS.ratioIndex;
    s.sounds.backgroundVolume = Math.min(1, Math.max(0, s.sounds.backgroundVolume));
    s.sounds.effectVolume = Math.min(1, Math.max(0, s.sounds.effectVolume));
    if (!AUTOPLAY_COUNTS.includes(s.autoPlay.count)) s.autoPlay.count = AUTOPLAY_COUNTS[0];
  }

  updateSettings(patch) {
    this.applySettings(patch);
    this.save();
    return structuredClone(this.settings);
  }

  get bet() {
    return totalBet(this.settings.stakeIndex, this.settings.ratioIndex);
  }

  get balanceMoney() {
    return money(this.balance / 100);
  }

  // 彩金池顯示金額（元）：押注 × 倍數。
  jackpots(bet = this.bet) {
    return Object.fromEntries(JACKPOTS.map((j) => [j.id, money(bet * j.x)]));
  }

  get activeScenario() {
    return this.scenario;
  }

  setScenario(id) {
    this.scenario = scenarioById(id);
    this.onScenarioChange?.(this.scenario);
  }

  resetBalance() {
    this.balance = INITIAL_BALANCE_CENTS;
    this.pending = null;
    this.save();
  }

  // 產生一局；有測試情境時反覆重抽直到符合 accept（最多 400 次）。
  generate(bet, feature) {
    const scenario = this.scenario;
    try {
      if (!scenario) return runRound(this.engine, bet, feature);
      this.engine.rig = scenario.rig;
      let round = runRound(this.engine, bet, feature);
      for (let i = 0; !feature && scenario.accept && !scenario.accept(round.views, bet) && i < 400; i++) round = runRound(this.engine, bet, feature);
      return round;
    } finally {
      if (scenario) {
        this.engine.rig = null;
        if (!this.keepScenario) this.setScenario(null);
      }
    }
  }

  // 下注一轉（或購買特色）。回傳的 record 含 views（伺服器格式）與 spins（引擎事件，供演出）。
  spin({ stakeIndex = this.settings.stakeIndex, ratioIndex = this.settings.ratioIndex, featureIndex = null } = {}) {
    if (this.pending) throw new Error('上一局尚未結束');
    if (!Number.isInteger(stakeIndex) || !Number.isInteger(ratioIndex) || STAKE_VALUES[stakeIndex] === undefined || RATIO_VALUES[ratioIndex] === undefined) throw new Error('投注額無效');
    const bet = totalBet(stakeIndex, ratioIndex);
    const buy = featureIndex !== null ? BUY_FEATURES[featureIndex] : null;
    if (featureIndex !== null && !buy) throw new Error('特色遊戲無效');
    const cost = Math.round(bet * 100 * (buy ? buy.featureRate : 1));
    if (cost > this.balance) throw new Error('點數不足');
    const feature = buy ? (featureIndex === 2 ? 'super' : featureIndex === 1 ? 'awaken' : 'fg') : undefined;
    const round = this.generate(bet, feature);
    const win = Math.round(round.views.at(-1).totalWinnings * 100);
    const record = {
      id: randomId(),
      name: GAME_NAME,
      bet,
      cost,
      win,
      time: Math.max(this.now(), (this.records[0]?.time ?? 0) + 1),
      feature: buy ? buy.feature : '',
      hasFree: round.views.some((v) => v.action === 'freeSpin' || v.action === 'superSpin'),
      views: round.views,
      spins: round.spins,
      featureInfo: round.feature ? { kind: round.feature.kind, bought: round.feature.bought, super: round.feature.super } : null,
      balanceAfter: this.balance + win - cost,
    };
    this.balance += win - cost;
    this.settings.stakeIndex = stakeIndex;
    this.settings.ratioIndex = ratioIndex;
    this.pending = record;
    this.records.unshift({ id: record.id, name: record.name, bet, cost, win, time: record.time, feature: record.feature, hasFree: record.hasFree });
    this.records.length = Math.min(MAX_RECORDS, this.records.length);
    this.save();
    return record;
  }

  // 演出結束，把這局關掉；回傳目前點數（元）。
  closeSpin(id) {
    if (this.pending && this.pending.id === id) this.pending = null;
    this.save();
    return this.balanceMoney;
  }

  // 下注紀錄（最新在前）。
  getBetRecords(rows = 16) {
    return this.records.slice(0, Math.max(1, Math.min(MAX_RECORDS, rows))).map((r) => ({
      id: r.id,
      name: r.name,
      endTime: r.time,
      totalStake: money(r.cost / 100),
      win: money(r.win / 100),
      profit: money((r.win - r.cost) / 100),
      hasFree: r.hasFree,
      isFeature: !!r.feature,
    }));
  }
}
