// 18 個符號的體素外觀：16×16 像素圖擠出成方塊。具象符號手繪，寶石與倍數球以程式產生。
import * as THREE from 'three';
import { SYM } from '../engine/config.js';
import { extrudePixels, voxelMaterial } from './voxel.js';
import { textPlane } from './text3d.js';
import { BOARD_CLIP_PLANES } from './scene.js';

const C = {
  G: '#f0b84a', // 金
  g: '#b5832a', // 暗金
  Y: '#ffd978', // 亮金
  y: '#d6a03a', // 中金
  W: '#fff8e0', // 高光
  K: '#1d1a1a', // 黑
  k: '#4a2f1a', // 深棕（嘴）
  T: '#3bd0b4', // 青
  t: '#22937f',
  B: '#3b7ff0', // 藍
  b: '#1d4ea8',
  C: '#8fe0ff', // 淡藍（眼）
  R: '#ee3d3d', // 紅
  r: '#a02020',
  P: '#a05ee0', // 紫
  p: '#6a3aa0',
  M: '#f06ae0', // 紫紅寶石
  O: '#f09a3a', // 橘
  o: '#b86a18',
  N: '#4ccc5c', // 綠
  n: '#2a8c38',
  S: '#e6ebf2', // 銀
  s: '#98a0ad',
};

const EYE = [
  '.....GGGGGG.....',
  '...GGTTTTTTGG...',
  '..GTTTTTTTTTTG..',
  '.GTTGGGGGGGGTTG.',
  '.GTGGYYYYYYGGTG.',
  'GTTGWWWWWWWWGTTG',
  'GTTGWWBBBBWWGTTG',
  'GTTGWWBKKBWWGTTG',
  'GTTGGWWBBWWGGTTG',
  'GTTTGGWWWWGGTTTG',
  '.GTTTGGGGGGTTTG.',
  '.GTTGGTTTTGGTTG.',
  '..GTGGTTTTTGGTG.',
  '..GTTGGTTTTTTG..',
  '...GGTTTTTTGG...',
  '.....GGGGGG.....',
];
const SCEPTER = [
  '.....GGGGGG.....',
  '...GGPPPPPPGG...',
  '..GPPPGGGGPPPG..',
  '.GPPPGYYYYGPPPG.',
  '.GPPGYYRYYYYGPG.',
  'GPPPGYYYYYYYGPPG',
  'GPPPPGGYYYGGPPPG',
  'GPPPPPPGGGPPPPPG',
  'GPPPPPPGGPPPPPPG',
  'GPPPPPGGPPPPPPPG',
  '.GPPPGGPPPPPPPG.',
  '.GPPPGGGGPPPPPG.',
  '..GPPPPGGGGPPG..',
  '..GPPPPPPGGPPG..',
  '...GGPPPPPPGG...',
  '.....GGGGGG.....',
];
const BOW = [
  '.....GGGGGG.....',
  '...GGNNNNNNGG...',
  '..GNNNNNNNGGNG..',
  '.GNNNNNNNGYYNNG.',
  '.GNNNNNNGYNNYNG.',
  'GNNNNNNGYNNNNYNG',
  'GNNNNNGYNNNNNYNG',
  'GSSSSSSSSSSSSYNG',
  'GNNNNNGYNNNNNYNG',
  'GNNNNNNGYNNNNYNG',
  '.GNNNNNNGYNNYNG.',
  '.GNNNNNNNGYYNNG.',
  '..GNNNNNNNGGNG..',
  '..GNNNNNNNNNNG..',
  '...GGNNNNNNGG...',
  '.....GGGGGG.....',
];
const KHOPESH = [
  '.....GGGGGG.....',
  '...GGOOOOOOGG...',
  '..GOOOOOOOSSSG..',
  '.GOOOOOOOSSWSSG.',
  '.GOOOOOOSSWOSSG.',
  'GOOOOOOSSWOOOSOG',
  'GOOOOOSSWOOOOOOG',
  'GOOOOSSWOOOOOOOG',
  'GOOOSSWOOOOOOOOG',
  'GOOSSWOOOOOOOOOG',
  '.GRRSOOOOOOOOOG.',
  '.GRRROOOOOOOOOG.',
  '..GRRGOOOOOOOG..',
  '..GGGOOOOOOOOG..',
  '...GGOOOOOOGG...',
  '.....GGGGGG.....',
];
const SCARAB = [
  '......GRRG......',
  '.....GGRRGG.....',
  'T...GGGGGGGG...T',
  'TT.GGGYYYYGGG.TT',
  'TTTGGYYYYYYGGTTT',
  'TTTTGYYYYYYGTTTT',
  'TTTTGGYYYYGGTTTT',
  '.TTTGGYGGYGGTTT.',
  '.TTTGGYGGYGGTTT.',
  '..TTGGYGGYGGTT..',
  '..TTGGGYYGGGTT..',
  '...TGGGGGGGGT...',
  '....GGGGGGGG....',
  '.....GGGGGG.....',
  '......GGGG......',
  '................',
];
const SET_TOTEM = [
  'GGGGGGGGGGGGGGGG',
  'GBBBBBBBBBBBBBBG',
  'GBBYYBBBBBBYYBBG',
  'GBBYYYBBBBYYYBBG',
  'GBBYYYYYYYYYYBBG',
  'GBBYYYYYYYYYYBBG',
  'GBByyYYYYYYyyBBG',
  'GBByyYCYYCYyyBBG',
  'GBByyYYYYYYyyBBG',
  'GBBByYYYYYYyBBBG',
  'GBBByYYkkYYyBBBG',
  'GBBBByYYYYyBBBBG',
  'GBBBBBYYYYBBBBBG',
  'GBBBBBBYYBBBBBBG',
  'GBBBBBBBBBBBBBBG',
  'GGGGGGGGGGGGGGGG',
];
const NEPH_TOTEM = [
  'GGGGGGGGGGGGGGGG',
  'GPPPPPPPPPPPPPPG',
  'GPPPPYYYYYYPPPPG',
  'GPPPYYYMMYYYPPPG',
  'GPPKKYYYYYYKKPPG',
  'GPKKKYYYYYYKKKPG',
  'GPKKKYYYYYYKKKPG',
  'GPKKKYCYYCYKKKPG',
  'GPKKKYYYYYYKKKPG',
  'GPKKKKYYYYKKKKPG',
  'GPKKKKYkkYKKKKPG',
  'GPPKKKYYYYKKKPPG',
  'GPPPKKYYYYKKPPPG',
  'GPPPPPYYYYPPPPPG',
  'GPPPPPPPPPPPPPPG',
  'GGGGGGGGGGGGGGGG',
];
const PYRAMID = [
  '.......GG.......',
  '......GYYG......',
  '.....GYYYYG.....',
  '....GYTTTTYG....',
  '...GYYYYYYYYG...',
  '..GYYYYYYYYYYG..',
  '.GYTTTTTTTTTTYG.',
  'GYYYYYYYYYYYYYYG',
  'GYYYYYYYYYYYYYYG',
  'GYYYYYYYYYYYYYYG',
  'GYTTTTTTTTTTTTYG',
  'GYYYYYYYYYYYYYYG',
  'GGGGGGGGGGGGGGGG',
  '................',
  '................',
  '................',
];

// 以幾何函式產生 16×16 像素圖。inside(x,y) 以中心 (7.5,7.5) 為準。
function shapeArt(inside, { fill, dark, light, rim = null, rimWidth = 1, glint = true }) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      if (!inside(dx, dy)) {
        row += '.';
        continue;
      }
      let ch = fill;
      const onRim = rim && !inside(dx * (1 + rimWidth / 7), dy * (1 + rimWidth / 7));
      if (onRim) ch = rim;
      else if (dx + dy > 4.5) ch = dark; // 右下陰影
      else if (dx + dy < -5.5) ch = light; // 左上受光
      if (glint && !onRim && ((x === 5 && y === 4) || (x === 6 && y === 4) || (x === 5 && y === 5))) ch = 'W';
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}
const circle = (r) => (dx, dy) => dx * dx + dy * dy <= r * r;
const octagon = (r) => (dx, dy) => Math.abs(dx) <= r && Math.abs(dy) <= r && Math.abs(dx) + Math.abs(dy) <= r * 1.45;
const diamond = (r) => (dx, dy) => Math.abs(dx) * 1.05 + Math.abs(dy) * 0.95 <= r;

// 倍數球：圓球 + 金色框 + 4 根尖刺；稀有球 8 根。
function orbArt(colorFill, colorDark, colorLight, rare) {
  const rows = shapeArt(circle(5.6), { fill: colorFill, dark: colorDark, light: colorLight, rim: 'g', rimWidth: 1.2 }).map((r) => r.split(''));
  const set = (x, y, ch) => {
    if (x >= 0 && y >= 0 && x < 16 && y < 16) rows[y][x] = ch;
  };
  const spikes = [
    [[7, 0], [8, 0], [6, 1], [7, 1], [8, 1], [9, 1]],
    [[7, 15], [8, 15], [6, 14], [7, 14], [8, 14], [9, 14]],
    [[0, 7], [0, 8], [1, 6], [1, 7], [1, 8], [1, 9]],
    [[15, 7], [15, 8], [14, 6], [14, 7], [14, 8], [14, 9]],
  ];
  for (const sp of spikes) for (const [x, y] of sp) set(x, y, 'G');
  for (const [x, y] of [[7, 1], [8, 1], [7, 14], [8, 14], [1, 7], [1, 8], [14, 7], [14, 8]]) set(x, y, 'Y');
  if (rare) {
    const diag = [[2, 2], [3, 3], [13, 2], [12, 3], [2, 13], [3, 12], [13, 13], [12, 12], [1, 1], [14, 1], [1, 14], [14, 14]];
    for (const [x, y] of diag) set(x, y, 'G');
  }
  return rows.map((r) => r.join(''));
}

const GEM_PALETTE = { ...C, Y: '#ffd23a', y: '#e0a520', g: '#8a5a10' };

export const ORB_TIERS = {
  10: { fill: 'R', dark: 'r', light: 'M', label: '#ff6b6b' }, // ≥100x 紅
  11: { fill: 'P', dark: 'p', light: 'M', label: '#d7a3ff' }, // ≥50x 紫
  12: { fill: 'B', dark: 'b', light: 'C', label: '#8fc5ff' }, // ≥10x 藍
  13: { fill: 'N', dark: 'n', light: 'T', label: '#9cf59c' }, // <10x 綠
};
export const orbTier = (v) => (v >= 100 ? 10 : v >= 50 ? 11 : v >= 10 ? 12 : 13);

const ART = {
  [SYM.EYE]: { rows: EYE, palette: C },
  [SYM.SCEPTER]: { rows: SCEPTER, palette: C },
  [SYM.BOW]: { rows: BOW, palette: C },
  [SYM.KHOPESH]: { rows: KHOPESH, palette: C },
  [SYM.GEM_YELLOW]: { rows: shapeArt(octagon(6.4), { fill: 'Y', dark: 'y', light: 'W', rim: 'g', rimWidth: 0.8 }), palette: GEM_PALETTE },
  [SYM.GEM_RED]: { rows: shapeArt(circle(6.3), { fill: 'R', dark: 'r', light: 'M', rim: 'g', rimWidth: 0.8 }), palette: GEM_PALETTE },
  [SYM.GEM_PURPLE]: { rows: shapeArt(circle(6.3), { fill: 'P', dark: 'p', light: 'M', rim: 'g', rimWidth: 0.8 }), palette: GEM_PALETTE },
  [SYM.GEM_BLUE]: { rows: shapeArt(diamond(7.2), { fill: 'B', dark: 'b', light: 'C', rim: 'g', rimWidth: 0.8 }), palette: GEM_PALETTE },
  [SYM.GEM_GREEN]: { rows: shapeArt(diamond(7.2), { fill: 'N', dark: 'n', light: 'T', rim: 'g', rimWidth: 0.8 }), palette: GEM_PALETTE },
  [SYM.SCATTER]: { rows: SCARAB, palette: C },
  [SYM.GOLD_SCATTER]: { rows: SCARAB, palette: { ...C, T: '#9b5fe0', R: '#3b7bff' } },
  [SYM.JP]: { rows: PYRAMID, palette: C },
  [SYM.SET_TOTEM]: { rows: SET_TOTEM, palette: C },
  [SYM.NEPH_TOTEM]: { rows: NEPH_TOTEM, palette: C },
};

export const UNIT = 1 / 16;
export const SYMBOL_DEPTH = 3;
const geoCache = new Map();

// 取得某格符號的像素圖（2D 圖示與 3D 共用同一份資料）。
export function artFor(cell) {
  if (cell.s === SYM.ORB) {
    const tier = ORB_TIERS[orbTier(cell.v)];
    return { rows: orbArt(tier.fill, tier.dark, tier.light, !!cell.rare), palette: C };
  }
  return ART[cell.s];
}

export function symbolKey(cell) {
  return cell.s === SYM.ORB ? `orb:${orbTier(cell.v)}:${cell.rare ? 1 : 0}` : `sym:${cell.s}`;
}

export function symbolGeometry(cell) {
  const key = symbolKey(cell);
  let geo = geoCache.get(key);
  if (geo) return geo;
  let rows;
  let palette;
  if (cell.s === SYM.ORB) {
    const tier = ORB_TIERS[orbTier(cell.v)];
    rows = orbArt(tier.fill, tier.dark, tier.light, !!cell.rare);
    palette = C;
  } else {
    ({ rows, palette } = ART[cell.s]);
  }
  geo = extrudePixels(rows, palette, { depth: SYMBOL_DEPTH, unit: UNIT, bevel: true });
  geoCache.set(key, geo);
  return geo;
}

const sharedMaterial = voxelMaterial({ clippingPlanes: BOARD_CLIP_PLANES });
const clipped = (plane) => {
  plane.material.clippingPlanes = BOARD_CLIP_PLANES;
  return plane;
};

// 建立一格符號：Group 內含體素網格與（倍數球／JP／scatter 的）標籤平面。
export function createSymbolObject(cell) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(symbolGeometry(cell), sharedMaterial);
  mesh.castShadow = false;
  group.add(mesh);
  group.userData.cell = { ...cell };
  group.userData.mesh = mesh;
  const front = (SYMBOL_DEPTH * UNIT) / 2 + 0.02;
  if (cell.s === SYM.ORB) {
    const tier = ORB_TIERS[orbTier(cell.v)];
    const label = clipped(textPlane(`${cell.v}x`, { height: 0.34, size: 44, color: '#fffbe6', outline: tier.label, outlineWidth: 10 }));
    label.position.set(0, 0, front);
    group.add(label);
    group.userData.label = label;
    const lock = clipped(textPlane('', { height: 0.2, size: 30, color: '#dff6ff', outline: '#0a2a4a', outlineWidth: 8 }));
    lock.position.set(0.3, -0.33, front + 0.01);
    lock.visible = false;
    group.add(lock);
    group.userData.lock = lock;
  } else if (cell.s === SYM.JP) {
    const label = clipped(textPlane('JP', { height: 0.3, size: 44, color: '#fff2b0', outline: '#5a2d00', outlineWidth: 10 }));
    label.position.set(0, -0.05, front);
    group.add(label);
  } else if (cell.s === SYM.SCATTER || cell.s === SYM.GOLD_SCATTER) {
    const label = clipped(textPlane('SCATTER', { height: 0.16, size: 36, color: cell.s === SYM.SCATTER ? '#ffe8a0' : '#e8d4ff', outline: '#3a1a00', outlineWidth: 10 }));
    label.position.set(0, -0.44, front);
    group.add(label);
  }
  return group;
}

// 檢查像素圖是否都是 16×16（開發期防呆）。
export function validateArt() {
  const bad = [];
  for (const [id, art] of Object.entries(ART)) {
    if (art.rows.length !== 16) bad.push(`${id}: ${art.rows.length} rows`);
    art.rows.forEach((r, i) => {
      if (r.length !== 16) bad.push(`${id} row ${i}: ${r.length}`);
      for (const ch of r) if (ch !== '.' && !art.palette[ch]) bad.push(`${id} row ${i}: unknown '${ch}'`);
    });
  }
  return bad;
}
