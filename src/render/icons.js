// 把符號像素圖畫成 2D 圖示（規則頁、購買特色面板、彈窗用）。
import { artFor } from './symbols.js';

const cache = new Map();

export function iconDataURL(cell, size = 48) {
  const { rows, palette } = artFor(cell);
  const key = `${JSON.stringify(rows)}|${size}|${JSON.stringify(palette)}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const px = size / 16;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (!c || row[x] === '.') continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.floor(x * px), Math.floor(y * px), Math.ceil(px), Math.ceil(px));
    }
  });
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
