// 遊戲數學設定：與參考站（golden-seth / 戰神賽特 II 覺醒之力）本地引擎相同的常數。
// 金額單位說明：賠率表與各種「win」以「總押注的百分之一」為單位（100 = 1 倍押注）。

export const SYM = Object.freeze({
  EYE: 0, // 荷魯斯之眼
  SCEPTER: 1, // 權杖
  BOW: 2, // 弓箭
  KHOPESH: 3, // 彎刀
  GEM_YELLOW: 4, // 橘寶石
  GEM_RED: 5, // 紅寶石
  GEM_PURPLE: 6, // 紫寶石
  GEM_BLUE: 7, // 藍寶石
  GEM_GREEN: 8, // 綠寶石
  SCATTER: 9, // 聖甲蟲
  GOLD_SCATTER: 10, // 黃金聖甲蟲
  ORB: 11, // 倍數球
  JP: 12, // JP 金字塔
  SET_TOTEM: 13, // 力量覺醒符號（賽特／分裂）
  NEPH_TOTEM: 14, // 鎖定覺醒符號（奈芙蒂斯／鎖定）
});
export const EMPTY = -1;
export const PAYING_SYMBOLS = 9;
export const COLS = 6;
export const ROWS = 5;
export const CELLS = COLS * ROWS;

export const SYMBOL_NAMES = ['荷魯斯之眼', '權杖', '弓箭', '彎刀', '橘寶石', '紅寶石', '紫寶石', '藍寶石', '綠寶石', '聖甲蟲', '黃金聖甲蟲', '倍數球', 'JP', '力量覺醒符號', '鎖定覺醒符號'];

export const isScatter = (s) => s === SYM.SCATTER || s === SYM.GOLD_SCATTER;

// 賠率表 [8-9 個, 10-11 個, 12+ 個]，單位：押注的 1/100。規則頁的數字 = 此表 / 5（規則頁以押注的 1/20 為單位）。
export const PAYTABLE = Object.freeze([
  [1000, 2500, 5000],
  [250, 1000, 2500],
  [200, 500, 1500],
  [150, 200, 1200],
  [100, 150, 1000],
  [80, 120, 800],
  [50, 100, 500],
  [40, 90, 400],
  [25, 75, 200],
]);
export const payTier = (count) => (count >= 12 ? 2 : count >= 10 ? 1 : 0);
export const MIN_MATCH = 8;

// Scatter 支付（4/5/6 個）。
export const SCATTER_PAY = Object.freeze({ 4: 300, 5: 500, 6: 10000 });

// 倍數球可能的倍數與稀有球升級步數權重（步 0..3）。
export const ORB_VALUES = Object.freeze([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500]);
export const RARE_STEP_WEIGHTS = Object.freeze([0, 70, 22, 8]);

export const FREE_GAME = Object.freeze({ trigger: 4, award: 15, retrigger: 3, retriggerAward: 5, maxSpins: 100 });
export const AWAKEN = Object.freeze({ totemsNeeded: 3, maxLevel: 3, splitPerLevel: 2, lockPerLevel: 2, guaranteeLatestSpin: 8 });
export const TOTEM_PAY = 25; // 三個圖騰觸發技能時的支付（0.25 倍押注）
export const MAX_WIN = 8100000; // 最高 81,000 倍
export const BUY_FEATURE = Object.freeze({ awakenChance: 0.153 }); // 購買免費遊戲時升級為覺醒之力的機率
export const SUPER_MAIN = Object.freeze({ lockLevel: 3 });

export const JACKPOTS = Object.freeze([
  { id: 'jp-mini', name: 'MINI', count: 2, x: 5 },
  { id: 'jp-minor', name: 'MINOR', count: 3, x: 25 },
  { id: 'jp-major', name: 'MAJOR', count: 4, x: 200 },
  { id: 'jp-grand', name: 'GRAND', count: 5, x: 2000 },
]);

export const MYSTERY = Object.freeze({
  chance: 1 / 220,
  prizesX: [1, 2, 3, 5, 8, 10, 20, 50, 100],
  weights: [300, 260, 180, 120, 60, 40, 20, 5, 1],
});

// 各模式的符號權重。symbols 依序為 9 個付獎符號的權重。
export const MODE_CONFIG = Object.freeze({
  base: {
    symbols: [3.5, 4.5, 5.5, 6.5, 8, 9, 10, 11, 12],
    scatter: 1.5085,
    goldChance: 0.0497,
    orb: 0.4764,
    orbValues: [300, 250, 200, 150, 110, 80, 60, 40, 30, 18, 12, 6, 2, 0.6, 0.2],
    rareChance: 0.05,
    jp: 0.16,
    setTotem: 0,
    nephTotem: 0,
  },
  fg: {
    symbols: [3, 4, 5, 6, 8, 9, 10, 11, 12],
    scatter: 1.1,
    goldChance: 0,
    orb: 3.5,
    orbValues: [371.4, 350.7, 306.6, 246.3, 191.1, 151.8, 122, 86.03, 69.11, 45.31, 32.36, 20.03, 8.268, 3.29, 1.358],
    rareChance: 0.12,
    jp: 0,
    setTotem: 0,
    nephTotem: 0,
  },
  awaken: {
    symbols: [3, 4, 5, 6, 9, 10, 12, 14, 16],
    scatter: 1.1,
    goldChance: 1,
    orb: 4,
    orbValues: [346.1, 368.4, 383.3, 340.4, 278.1, 238.7, 206.2, 160.4, 142.5, 101.9, 72.44, 50.14, 26.03, 13.34, 5.538],
    rareChance: 0.25,
    jp: 0,
    setTotem: 3,
    nephTotem: 3,
  },
  super: {
    symbols: [3, 4, 5, 6, 9, 10, 12, 14, 16],
    scatter: 1.1,
    goldChance: 1,
    orb: 2.32,
    orbValues: [250, 220, 200, 160, 120, 90, 70, 50, 40, 25, 16, 8, 3, 1, 0.3],
    rareChance: 0.25,
    jp: 0,
    setTotem: 1,
    nephTotem: 1,
  },
});

// 平台／押注設定（與參考站 local-demo 相同）。總押注 = stake × ratio × 20 條線。
export const STAKE_VALUES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
export const RATIO_VALUES = Object.freeze([0.05, 0.1, 0.2, 0.3, 0.4, 0.8, 1, 3, 4, 5, 6, 7, 8, 10]);
export const LINES = 20;
export const DEFAULT_SETTINGS = Object.freeze({ stakeIndex: 0, ratioIndex: 6 });
export const INITIAL_BALANCE_CENTS = 10000000; // 100,000.00

export const BUY_FEATURES = Object.freeze([
  { feature: 'freeGame', featureRate: 200, featureIndex: 0, label: '購買免費遊戲' },
  { feature: 'superFreeGame', featureRate: 500, featureIndex: 1, label: '購買覺醒之力' },
  { feature: 'superMainGame', featureRate: 2000, featureIndex: 2, label: '購買不朽覺醒' },
]);

// 贏分等級門檻（倍數）。
export const WIN_TIERS = Object.freeze([
  { id: 'big', label: 'BIG WIN', x: 20 },
  { id: 'super', label: 'SUPER WIN', x: 50 },
  { id: 'mega', label: 'MEGA WIN', x: 100 },
  { id: 'ultra', label: 'ULTRA WIN', x: 300 },
  { id: 'legend', label: 'LEGENDARY WIN', x: 1000 },
]);

export const AUTOPLAY_COUNTS = Object.freeze([10, 50, 100, 200, 500, -1]);

// 總押注金額（元，兩位小數）。
export const totalBet = (stakeIndex, ratioIndex) => Math.round(STAKE_VALUES[stakeIndex] * RATIO_VALUES[ratioIndex] * LINES * 100) / 100;
