// 場景內的像素文字（倍數球數字、贏分飄字）：畫在 canvas 上再貼到平面，NearestFilter 保持鋸齒感。
import * as THREE from 'three';

const cache = new Map();

export function textTexture(text, { font = '"Press Start 2P", monospace', size = 40, color = '#fff6c8', outline = '#3a2200', outlineWidth = 6, padding = 8, bg = null } = {}) {
  const key = JSON.stringify([text, font, size, color, outline, outlineWidth, padding, bg]);
  if (cache.has(key)) return cache.get(key);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${size}px ${font}`;
  const width = Math.ceil(measure.measureText(text).width) + padding * 2 + outlineWidth * 2;
  const height = Math.ceil(size * 1.3) + padding * 2 + outlineWidth * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (outlineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(text, width / 2, height / 2 + 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const out = { texture: tex, aspect: width / height };
  cache.set(key, out);
  return out;
}

export function textPlane(text, { height = 0.3, ...opts } = {}) {
  const { texture, aspect } = textTexture(text, opts);
  const geo = new THREE.PlaneGeometry(height * aspect, height);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.text = text;
  mesh.renderOrder = 5;
  return mesh;
}

// 更新既有文字平面的內容（重建材質貼圖與尺寸）。
export function setPlaneText(mesh, text, { height = 0.3, ...opts } = {}) {
  if (mesh.userData.text === text) return;
  const { texture, aspect } = textTexture(text, opts);
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(height * aspect, height);
  mesh.userData.text = text;
}
