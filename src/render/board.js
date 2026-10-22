// 盤面：30 格符號物件的建立、掉落、消除、下落補位、倍數球標籤與鎖定顯示。
import * as THREE from 'three';
import { COLS, ROWS, CELLS, SYM } from '../engine/config.js';
import { createSymbolObject } from './symbols.js';
import { tween, Ease } from './tween.js';
import { CELL, BOARD_CENTER_Y, BOARD_CLIP_PLANES } from './scene.js';
import { setPlaneText, textPlane } from './text3d.js';
import { voxelMaterial } from './voxel.js';

export const cellX = (col) => (col - (COLS - 1) / 2) * CELL;
export const cellY = (row) => BOARD_CENTER_Y + ((ROWS - 1) / 2 - row) * CELL;
export const rc = (i) => ({ col: Math.floor(i / ROWS), row: i % ROWS });
export const SYMBOL_SCALE = 0.88;
const DROP_FROM = 6.5;

const glowMaterial = voxelMaterial({ emissive: new THREE.Color('#5a4300'), emissiveIntensity: 1, clippingPlanes: BOARD_CLIP_PLANES });
const dimMaterial = voxelMaterial({ color: new THREE.Color('#6a6a6a'), clippingPlanes: BOARD_CLIP_PLANES });
const normalMaterial = voxelMaterial({ clippingPlanes: BOARD_CLIP_PLANES });

export class Board {
  constructor(scene, effects) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.effects = effects;
    this.cells = new Array(CELLS).fill(null);
    this.time = 0;
    this.winText = textPlane('', { height: 0.5, size: 56, color: '#fff3b0', outline: '#4a2a00', outlineWidth: 12 });
    this.winText.position.set(0, BOARD_CENTER_Y, 1.4);
    this.winText.visible = false;
    this.group.add(this.winText);
    // 中獎格背後的發光方格
    this.glowPlanes = [];
    const glowGeo = new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96);
    for (let i = 0; i < CELLS; i++) {
      const m = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0, depthWrite: false }));
      const { col, row } = rc(i);
      m.position.set(cellX(col), cellY(row), -0.25);
      this.group.add(m);
      this.glowPlanes.push(m);
    }
  }

  place(i, cell, y = null) {
    const obj = createSymbolObject(cell);
    const { col, row } = rc(i);
    obj.position.set(cellX(col), y ?? cellY(row), 0);
    obj.scale.setScalar(SYMBOL_SCALE);
    obj.userData.index = i;
    this.group.add(obj);
    this.cells[i] = obj;
    if (cell.s === SYM.ORB) this.setLock(i, cell.lock);
    return obj;
  }

  dispose(obj) {
    if (!obj) return;
    this.group.remove(obj);
    obj.traverse((o) => {
      if (o.isMesh && o.geometry && o.userData.text !== undefined) o.geometry.dispose();
    });
  }

  clear() {
    for (let i = 0; i < CELLS; i++) {
      this.dispose(this.cells[i]);
      this.cells[i] = null;
    }
  }

  // 直接放上整個盤面（開場／還原）。
  setBoard(board) {
    this.clear();
    board.forEach((cell, i) => this.place(i, cell));
  }

  cellObjects() {
    return this.cells.filter(Boolean);
  }

  // 一轉的掉落：舊符號掉出盤面下方，新符號由上方落下（保留鎖定的倍數球）。
  async drop(board, kept = [], { quick = false } = {}) {
    const keptSet = new Set(kept);
    const outs = [];
    for (let i = 0; i < CELLS; i++) {
      const obj = this.cells[i];
      if (!obj) continue;
      if (keptSet.has(i)) continue;
      const { col } = rc(i);
      obj.userData.baseY = obj.position.y;
      this.cells[i] = null;
      outs.push(tween(quick ? 0.12 : 0.28, (t) => { obj.position.y = obj.userData.baseY - t * t * 7; }, Ease.linear, quick ? 0 : col * 0.04).then(() => this.dispose(obj)));
    }
    await Promise.all(outs);
    const ins = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        const i = c * ROWS + r;
        if (keptSet.has(i) && this.cells[i]) {
          this.cells[i].userData.cell.lock = board[i].lock;
          this.setLock(i, board[i].lock);
          continue;
        }
        const obj = this.place(i, board[i], cellY(r) + DROP_FROM + (ROWS - r) * 0.25);
        ins.push(this.fall(obj, cellY(r), quick ? 0.16 : 0.42, quick ? 0 : c * 0.06 + (ROWS - 1 - r) * 0.025));
      }
    }
    await Promise.all(ins);
    this.effects?.sfx?.('land');
  }

  fall(obj, toY, duration, delay = 0) {
    const fromY = obj.position.y;
    return tween(duration, (t) => { obj.position.y = fromY + (toY - fromY) * t; }, Ease.outBounce, delay).then(() => {
      obj.position.y = toY;
      // 落地擠壓感
      return tween(0.12, (t) => { const s = 1 + 0.12 * Math.sin(Math.PI * t); obj.scale.set(SYMBOL_SCALE * s, SYMBOL_SCALE * (2 - s), SYMBOL_SCALE); });
    }).then(() => obj.scale.setScalar(SYMBOL_SCALE));
  }

  // 中獎強調：發光、放大脈動；dimOthers 讓其他格變暗。
  async highlight(indices, { pulses = 2, duration = 0.32, dimOthers = true } = {}) {
    const set = new Set(indices);
    for (let i = 0; i < CELLS; i++) {
      const obj = this.cells[i];
      if (!obj) continue;
      obj.userData.mesh.material = set.has(i) ? glowMaterial : dimOthers ? dimMaterial : normalMaterial;
      this.glowPlanes[i].material.opacity = set.has(i) ? 0.35 : 0;
    }
    for (let p = 0; p < pulses; p++) {
      await tween(duration, (t) => {
        const s = SYMBOL_SCALE * (1 + 0.14 * Math.sin(Math.PI * t));
        for (const i of indices) {
          const obj = this.cells[i];
          if (obj) obj.scale.setScalar(s);
        }
      }, Ease.inOutSine);
    }
    for (const i of indices) this.cells[i]?.scale.setScalar(SYMBOL_SCALE);
  }

  restoreMaterials() {
    for (let i = 0; i < CELLS; i++) {
      const obj = this.cells[i];
      if (obj) obj.userData.mesh.material = normalMaterial;
      this.glowPlanes[i].material.opacity = 0;
    }
  }

  // 消除：放大→縮小消失，並噴出方塊碎片。
  async remove(indices, { quick = false } = {}) {
    const objs = indices.map((i) => this.cells[i]).filter(Boolean);
    for (const i of indices) this.cells[i] = null;
    for (let i = 0; i < CELLS; i++) this.glowPlanes[i].material.opacity = 0;
    await tween(quick ? 0.1 : 0.22, (t) => {
      const s = SYMBOL_SCALE * (1 + 0.25 * t);
      for (const o of objs) o.scale.setScalar(s);
    }, Ease.outQuad);
    for (const o of objs) this.effects?.burst(o.position, this.colorsOf(o.userData.cell), quick ? 6 : 12);
    this.effects?.sfx?.('pop');
    await tween(quick ? 0.08 : 0.16, (t) => {
      const s = SYMBOL_SCALE * 1.25 * (1 - t);
      for (const o of objs) {
        o.scale.setScalar(Math.max(0.001, s));
        o.rotation.z = t * 0.6;
      }
    }, Ease.inQuad);
    for (const o of objs) this.dispose(o);
  }

  colorsOf(cell) {
    switch (cell.s) {
      case SYM.EYE: return ['#2fb8a0', '#e0a93a', '#fff6d8'];
      case SYM.SCEPTER: return ['#8d4fc9', '#e0a93a'];
      case SYM.BOW: return ['#3cb44b', '#e0a93a'];
      case SYM.KHOPESH: return ['#e58a2a', '#d8dde5'];
      case SYM.GEM_YELLOW: return ['#f7c531', '#fff3b0'];
      case SYM.GEM_RED: return ['#dc3030', '#e05ad6'];
      case SYM.GEM_PURPLE: return ['#8d4fc9', '#e05ad6'];
      case SYM.GEM_BLUE: return ['#2d6cdf', '#7fd8ff'];
      case SYM.GEM_GREEN: return ['#3cb44b', '#2fb8a0'];
      case SYM.SCATTER: return ['#e0a93a', '#2fb8a0', '#dc3030'];
      case SYM.GOLD_SCATTER: return ['#e0a93a', '#9b5fe0', '#3b7bff'];
      case SYM.SET_TOTEM: return ['#2d6cdf', '#f5d36b'];
      case SYM.NEPH_TOTEM: return ['#8d4fc9', '#f5d36b'];
      case SYM.JP: return ['#f5d36b', '#2fb8a0'];
      default: return ['#e0a93a', '#f5d36b'];
    }
  }

  // 下落補位：既有符號往下滑，新符號由上方落下。
  async tumble(moves, added, { quick = false } = {}) {
    const slides = [];
    // 先把物件移到新索引（由下往上處理已由引擎排序）
    const moved = new Map();
    for (const [from, to] of moves) {
      const obj = this.cells[from];
      if (!obj) continue;
      moved.set(to, obj);
      this.cells[from] = null;
    }
    for (const [to, obj] of moved) {
      this.cells[to] = obj;
      obj.userData.index = to;
      const { row } = rc(to);
      const dist = Math.abs(cellY(row) - obj.position.y);
      slides.push(this.fall(obj, cellY(row), quick ? 0.12 : 0.2 + dist * 0.07));
    }
    for (const a of added) {
      const { col, row } = rc(a.i);
      const obj = this.place(a.i, a.cell, cellY(row) + DROP_FROM * 0.7 + (ROWS - row) * 0.25);
      slides.push(this.fall(obj, cellY(row), quick ? 0.16 : 0.36, quick ? 0 : col * 0.03));
    }
    await Promise.all(slides);
    this.effects?.sfx?.('land');
  }

  // 倍數球升級：閃光＋換標籤。
  async upgradeOrb(i, to, { quick = false } = {}) {
    const obj = this.cells[i];
    if (!obj) return;
    await tween(quick ? 0.12 : 0.3, (t) => {
      obj.scale.setScalar(SYMBOL_SCALE * (1 + 0.3 * Math.sin(Math.PI * t)));
      obj.rotation.y = Math.sin(Math.PI * t) * 0.9;
    }, Ease.inOutSine);
    obj.rotation.y = 0;
    obj.scale.setScalar(SYMBOL_SCALE);
    const cell = { ...obj.userData.cell, v: to };
    // 重建物件（顏色分級可能改變）
    const lock = obj.userData.cell.lock;
    this.dispose(obj);
    const fresh = this.place(i, { ...cell, lock });
    this.effects?.burst(fresh.position, ['#fff3b0', '#ffd36b'], 10);
    this.effects?.sfx?.('upgrade');
    await tween(quick ? 0.1 : 0.2, (t) => fresh.scale.setScalar(SYMBOL_SCALE * (1.3 - 0.3 * t)), Ease.outQuad);
  }

  setLock(i, rounds) {
    const obj = this.cells[i];
    if (!obj?.userData.lock) return;
    obj.userData.cell.lock = rounds;
    if (rounds > 0) {
      setPlaneText(obj.userData.lock, `🔒${rounds}`, { height: 0.2, size: 30, color: '#dff6ff', outline: '#0a2a4a', outlineWidth: 8 });
      obj.userData.lock.visible = true;
    } else obj.userData.lock.visible = false;
  }

  // 幾格一起脈動（scatter / JP / 圖騰）。
  async pulse(indices, times = 2, { quick = false } = {}) {
    for (let k = 0; k < times; k++) {
      await tween(quick ? 0.14 : 0.3, (t) => {
        for (const i of indices) {
          const obj = this.cells[i];
          if (!obj) continue;
          obj.scale.setScalar(SYMBOL_SCALE * (1 + 0.2 * Math.sin(Math.PI * t)));
          obj.rotation.z = 0.15 * Math.sin(Math.PI * 2 * t);
        }
      }, Ease.inOutSine);
    }
    for (const i of indices) {
      const obj = this.cells[i];
      if (obj) {
        obj.scale.setScalar(SYMBOL_SCALE);
        obj.rotation.z = 0;
      }
    }
  }

  // 分裂：從來源球複製飛往目標格。
  async split(source, targets, { quick = false } = {}) {
    const src = this.cells[source];
    if (!src) return;
    await this.pulse([source], 1, { quick });
    const flights = targets.map((t, k) => {
      const { col, row } = rc(t.i);
      const old = this.cells[t.i];
      const obj = this.place(t.i, { ...t.cell, lock: 0 });
      obj.position.copy(src.position);
      obj.scale.setScalar(0.3);
      return tween(quick ? 0.2 : 0.45, (u) => {
        obj.position.x = src.position.x + (cellX(col) - src.position.x) * u;
        obj.position.y = src.position.y + (cellY(row) - src.position.y) * u + Math.sin(Math.PI * u) * 1.2;
        obj.position.z = Math.sin(Math.PI * u) * 0.8;
        obj.scale.setScalar(0.3 + (SYMBOL_SCALE - 0.3) * u);
      }, Ease.outQuad, k * 0.08).then(() => {
        obj.position.z = 0;
        if (old && old !== obj) this.dispose(old);
        this.effects?.burst(obj.position, ['#fff3b0', '#ffd36b'], 8);
      });
    });
    await Promise.all(flights);
    this.effects?.sfx?.('split');
  }

  showWinText(text) {
    setPlaneText(this.winText, text, { height: 0.5, size: 56, color: '#fff3b0', outline: '#4a2a00', outlineWidth: 12 });
    this.winText.visible = true;
    this.winText.scale.setScalar(0.2);
    return tween(0.25, (t) => this.winText.scale.setScalar(0.2 + 0.8 * t), Ease.outBack);
  }

  hideWinText() {
    this.winText.visible = false;
  }

  update(dt) {
    this.time += dt;
    // 待機時符號輕微漂浮
    for (let i = 0; i < CELLS; i++) {
      const obj = this.cells[i];
      if (!obj) continue;
      const { col, row } = rc(i);
      obj.rotation.y = Math.sin(this.time * 1.3 + col * 0.7 + row * 0.4) * 0.06;
    }
    this.winText.lookAt(this.winText.position.x, this.winText.position.y, 20);
  }
}
