// 程序化 16×16 方塊貼圖（砂岩、鑿刻砂岩、金塊、青金石、黑曜石、石磚、火把…），NearestFilter 保留像素感。
import * as THREE from 'three';
import { Rng } from '../engine/rng.js';

const cache = new Map();

function canvasTexture(draw, size = 16, key) {
  if (key && cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (key) cache.set(key, tex);
  return tex;
}

const mix = (a, b, t) => a + (b - a) * t;
function hexLerp(h1, h2, t) {
  const c1 = new THREE.Color(h1);
  const c2 = new THREE.Color(h2);
  return `rgb(${Math.round(mix(c1.r, c2.r, t) * 255)},${Math.round(mix(c1.g, c2.g, t) * 255)},${Math.round(mix(c1.b, c2.b, t) * 255)})`;
}

// 雜訊填滿：在 base 與 alt 之間依種子隨機插值，是麥塊貼圖的基本手法。
function noiseFill(ctx, size, base, alt, seed, amount = 1) {
  const rng = Rng.fromString(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = hexLerp(base, alt, rng.next() * amount);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export const BLOCKS = {
  sandstone: { base: '#e6d8a2', alt: '#d3c17f', seed: 'sandstone' },
  sandstoneDark: { base: '#cdb26c', alt: '#b59a54', seed: 'sandstone-dark' },
  goldBlock: { base: '#f5cf3a', alt: '#d9a829', seed: 'gold' },
  lapis: { base: '#2448a8', alt: '#1a3480', seed: 'lapis' },
  obsidian: { base: '#221a33', alt: '#2f2347', seed: 'obsidian' },
  moon: { base: '#f3e9b8', alt: '#d9cf9a', seed: 'moon' },
  stoneBrick: { base: '#8a8a8a', alt: '#6f6f6f', seed: 'stonebrick' },
  purpur: { base: '#9a6ab8', alt: '#7d4f9c', seed: 'purpur' },
  netherGold: { base: '#b08a3a', alt: '#8f6b22', seed: 'nethergold' },
  nightSky: { base: '#0b1030', alt: '#141a4a', seed: 'sky' },
  darkPlanks: { base: '#5a3b1e', alt: '#4a2f16', seed: 'planks' },
  teal: { base: '#2fb8a0', alt: '#239682', seed: 'teal' },
  prismarine: { base: '#1e525a', alt: '#18454c', seed: 'prismarine' },
  redWool: { base: '#c23a36', alt: '#a62e2b', seed: 'redwool' },
  blueWool: { base: '#3458c8', alt: '#2a48ad', seed: 'bluewool' },
};

// 盤面底板：深青綠海晶石，帶淡淡格線。
export function panelTexture() {
  return canvasTexture(
    (ctx, s) => {
      const b = BLOCKS.prismarine;
      noiseFill(ctx, s, b.base, b.alt, 'panel');
      ctx.fillStyle = hexLerp(b.base, '#7fe3d0', 0.35);
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, 0, 1, s);
      ctx.fillStyle = hexLerp(b.base, '#000000', 0.35);
      ctx.fillRect(0, s - 1, s, 1);
      ctx.fillRect(s - 1, 0, 1, s);
    },
    16,
    'panel',
  );
}

// 旗幟：紅底、金邊、中央藍色菱形。
export function bannerTexture() {
  return canvasTexture(
    (ctx, s) => {
      noiseFill(ctx, s, BLOCKS.redWool.base, BLOCKS.redWool.alt, 'banner');
      ctx.fillStyle = BLOCKS.goldBlock.base;
      ctx.fillRect(0, 0, 2, s);
      ctx.fillRect(s - 2, 0, 2, s);
      ctx.fillStyle = BLOCKS.blueWool.base;
      for (let y = 0; y < 6; y++) {
        const w = y < 3 ? y + 1 : 6 - y;
        ctx.fillRect(8 - w, 5 + y, w * 2, 1);
      }
      ctx.fillStyle = BLOCKS.goldBlock.alt;
      ctx.fillRect(2, 13, s - 4, 1);
    },
    16,
    'banner',
  );
}

// 地毯：紅底、金邊、藍色菱形與金點。
export function carpetTexture() {
  return canvasTexture(
    (ctx, s) => {
      noiseFill(ctx, s, BLOCKS.redWool.base, BLOCKS.redWool.alt, 'carpet');
      ctx.fillStyle = BLOCKS.goldBlock.base;
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, s - 1, s, 1);
      ctx.fillRect(0, 0, 1, s);
      ctx.fillRect(s - 1, 0, 1, s);
      ctx.fillStyle = BLOCKS.blueWool.base;
      for (let y = 0; y < 7; y++) {
        const w = y < 4 ? y + 1 : 7 - y;
        ctx.fillRect(8 - w, 4 + y, w * 2, 1);
      }
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(3, 3, 1, 1);
      ctx.fillRect(12, 3, 1, 1);
      ctx.fillRect(3, 12, 1, 1);
      ctx.fillRect(12, 12, 1, 1);
    },
    16,
    'carpet',
  );
}

// 夜空：分段漸層（麥塊式色帶）。
export function skyTexture(top, mid, horizon, key) {
  return canvasTexture(
    (ctx, s) => {
      for (let y = 0; y < s; y++) {
        const t = y / (s - 1);
        ctx.fillStyle = t < 0.55 ? hexLerp(top, mid, t / 0.55) : hexLerp(mid, horizon, (t - 0.55) / 0.45);
        ctx.fillRect(0, y, s, 1);
      }
    },
    32,
    `sky:${key}`,
  );
}

export function blockTexture(kind) {
  const b = BLOCKS[kind];
  return canvasTexture((ctx, s) => noiseFill(ctx, s, b.base, b.alt, b.seed), 16, `block:${kind}`);
}

// 鑿刻砂岩：中央有象形文字般的浮雕圖案。
export function chiseledTexture(kind = 'sandstone', glyph = 0) {
  return canvasTexture(
    (ctx, s) => {
      const b = BLOCKS[kind];
      noiseFill(ctx, s, b.base, b.alt, `${b.seed}-chisel-${glyph}`);
      ctx.fillStyle = hexLerp(b.base, '#000000', 0.35);
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, s - 1, s, 1);
      ctx.fillRect(0, 0, 1, s);
      ctx.fillRect(s - 1, 0, 1, s);
      const glyphs = [
        ['..####..', '.#....#.', '#..##..#', '#.#..#.#', '#..##..#', '.#....#.', '..####..', '........'], // 眼
        ['...##...', '..####..', '.##..##.', '#..##..#', '#..##..#', '.##..##.', '..####..', '...##...'], // 太陽
        ['#......#', '##....##', '#.#..#.#', '#..##..#', '#..##..#', '#.#..#.#', '##....##', '#......#'], // 叉
        ['...##...', '..#..#..', '.#....#.', '#......#', '#..##..#', '#.#..#.#', '#......#', '########'], // 金字塔
      ][Math.abs(Math.round(glyph)) % 4];
      ctx.fillStyle = hexLerp(b.base, '#000000', 0.45);
      glyphs.forEach((row, y) => row.split('').forEach((c, x) => c === '#' && ctx.fillRect(x + 4, y + 4, 1, 1)));
      ctx.fillStyle = hexLerp(b.base, '#ffffff', 0.25);
      glyphs.forEach((row, y) => row.split('').forEach((c, x) => c === '#' && ctx.fillRect(x + 4, y + 3, 1, 1)));
    },
    16,
    `chisel:${kind}:${glyph}`,
  );
}

// 石磚紋：兩排交錯的磚。
export function brickTexture(kind = 'sandstoneDark') {
  return canvasTexture(
    (ctx, s) => {
      const b = BLOCKS[kind];
      noiseFill(ctx, s, b.base, b.alt, `${b.seed}-brick`);
      ctx.fillStyle = hexLerp(b.base, '#000000', 0.4);
      ctx.fillRect(0, 7, s, 1);
      ctx.fillRect(0, 15, s, 1);
      ctx.fillRect(7, 0, 1, 7);
      ctx.fillRect(3, 8, 1, 7);
      ctx.fillRect(11, 8, 1, 7);
      ctx.fillStyle = hexLerp(b.base, '#ffffff', 0.18);
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, 8, s, 1);
    },
    16,
    `brick:${kind}`,
  );
}

// 發光方塊（螢石／海晶燈風格）。
export function glowTexture(color = '#ffd36b') {
  return canvasTexture(
    (ctx, s) => {
      noiseFill(ctx, s, color, '#fff6c8', `glow-${color}`);
      ctx.fillStyle = hexLerp(color, '#000000', 0.3);
      for (let i = 0; i < s; i += 4) {
        ctx.fillRect(i, 0, 1, s);
        ctx.fillRect(0, i, s, 1);
      }
    },
    16,
    `glow:${color}`,
  );
}

export function blockMaterial(kind, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: blockTexture(kind), ...opts });
}

export function mat(texture, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: texture, ...opts });
}
