// 麥塊風格的兩位角色：賽特（左，藍）與奈芙蒂斯（右，紫）。
// 動作系統：有時長的片段（待機／張望／走動／施法／歡呼／跳舞／懸浮／技能／鞠躬），姿勢以平滑插值過渡。
import * as THREE from 'three';
import { buildVoxels, voxelMaterial, extrudePixels } from './voxel.js';
import { BOARD_CENTER_Y, BOARD_H, BOARD_W } from './scene.js';

const U = 0.095; // 一體素 = 0.095 單位（頭 8 體素 ≈ 0.76）
export const FLOOR_Y = BOARD_CENTER_Y - BOARD_H / 2 - 1.1; // 地板頂面
const BOARD_TARGET = new THREE.Vector3(0, BOARD_CENTER_Y, 0.6);

function part(w, h, d, paint, pivot = 'center') {
  const geo = buildVoxels({ w, h, d, unit: U, at: (x, y, z) => paint(x, y, z, w, h, d) });
  if (pivot === 'top') geo.translate(0, (-h * U) / 2, 0);
  if (pivot === 'bottom') geo.translate(0, (h * U) / 2, 0);
  return new THREE.Mesh(geo, voxelMaterial());
}

// 手持道具：賽特的彎刀、奈芙蒂斯的安卡（像素圖擠出）。
const KHOPESH = ['..SS..', '.SSSS.', 'SS..SS', 'S....S', '....SS', '...SS.', '...SS.', '...SS.', '...SS.', '...SS.', '..RRR.', '..GGG.', '..GGG.', '..GGG.'];
const ANKH = ['..GGG..', '.G...G.', '.G...G.', '.G...G.', '..GGG..', 'GGGGGGG', '..GGG..', '...G...', '...G...', '...G...', '...G...', '...G...'];
const PROP_PALETTE = { S: '#e6ebf2', R: '#d8302f', G: '#f2c14e' };

function makeFigure(style) {
  const g = new THREE.Group();
  const { skin, hair, armor, cloth, crown, gem, eye } = style;
  const head = part(8, 8, 8, (x, y, z, w, h, d) => {
    const front = z === d - 1;
    if (front && y === 4 && (x === 2 || x === 5)) return eye;
    if (front && y === 4 && (x === 1 || x === 6)) return '#ffffff';
    if (front && y === 2 && x >= 3 && x <= 4) return '#8a4a3a';
    if (y === 7 || (z === 0 && y >= 3) || (y >= 5 && (x === 0 || x === 7) && z < 4)) return hair;
    if (front && y === 6 && (x === 3 || x === 4)) return gem;
    if (front && y === 6) return crown;
    if ((x === 0 || x === 7 || z === 0) && y === 6) return crown;
    return skin;
  }, 'bottom');
  head.position.y = 24 * U;
  const topper = style.ears
    ? part(8, 3, 2, (x, y) => (x <= 1 || x >= 6 ? (y < 2 || x === 0 || x === 7 ? crown : gem) : null))
    : part(6, 3, 2, (x, y) => (y === 2 && (x === 2 || x === 3) ? gem : crown));
  topper.position.set(0, 9.5 * U, -2 * U);
  head.add(topper);
  if (style.longHair) {
    const hairBack = part(8, 10, 2, () => hair);
    hairBack.position.set(0, -2 * U, -3 * U);
    head.add(hairBack);
  }
  const body = part(8, 12, 4, (x, y) => (y >= 8 ? armor : y >= 5 ? (style.ears ? skin : cloth) : cloth));
  body.position.y = 18 * U;
  const armL = part(4, 12, 4, (x, y) => (y >= 10 ? armor : y <= 1 ? armor : skin), 'top');
  const armR = armL.clone();
  armL.position.set(-6 * U, 24 * U, 0);
  armR.position.set(6 * U, 24 * U, 0);
  const legL = part(4, 12, 4, (x, y) => (y <= 1 ? '#3a2a10' : cloth), 'top');
  const legR = legL.clone();
  legL.position.set(-2 * U, 12 * U, 0);
  legR.position.set(2 * U, 12 * U, 0);
  // 道具握在前手（靠盤面那隻手）
  const propGeo = extrudePixels(style.prop === 'khopesh' ? KHOPESH : ANKH, PROP_PALETTE, { depth: 1, unit: U, bevel: false });
  const prop = new THREE.Mesh(propGeo, voxelMaterial());
  const hand = style.frontArm === 'R' ? armR : armL;
  prop.position.set(0, -10 * U, 3 * U);
  hand.add(prop);
  g.add(head, body, armL, armR, legL, legR);
  g.userData.parts = { head, body, armL, armR, legL, legR, prop, hand };
  return g;
}

// 姿勢參數（弧度／單位）。片段回傳目標姿勢，update 以平滑插值逼近。
const ZERO = { headX: 0, headY: 0, bodyX: 0, armLX: 0, armLZ: 0.08, armRX: 0, armRZ: -0.08, legLX: 0, legRX: 0, posX: 0, posY: 0, yaw: 0 };
const TAU = Math.PI * 2;
const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// s = { toBoard: +1 | -1 }（朝盤面的方向）
const CLIPS = {
  idle: { d: 3.2, loop: true, pri: 0, f: (t, s) => ({ posY: Math.sin(t * TAU) * 0.02, armLX: Math.sin(t * TAU) * 0.1, armRX: -Math.sin(t * TAU) * 0.1, headY: Math.sin(t * TAU * 0.5) * 0.25 * s.toBoard }) },
  look: { d: 2.4, pri: 0, f: (t, s) => ({ headY: s.toBoard * 0.6 * Math.sin(Math.PI * t), yaw: s.toBoard * 0.25 * Math.sin(Math.PI * t), armLX: 0.1, armRX: -0.1 }) },
  walk: {
    d: 2.6,
    pri: 0,
    f: (t, s) => {
      const k = Math.sin(Math.PI * t);
      const step = Math.sin(t * Math.PI * 6);
      return { posX: s.toBoard * 0.7 * k, legLX: step * 0.7 * k, legRX: -step * 0.7 * k, armLX: -step * 0.6 * k, armRX: step * 0.6 * k, posY: Math.abs(step) * 0.05 * k, yaw: s.toBoard * (t < 0.5 ? 0.6 : -0.6) * k };
    },
  },
  cast: {
    d: 1.25,
    pri: 1,
    f: (t, s) => {
      const wind = clamp01(t / 0.3);
      const thrust = t < 0.3 ? 0 : t < 0.45 ? (t - 0.3) / 0.15 : t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
      const armX = 0.9 * wind * (1 - thrust) + -2.1 * thrust;
      const pose = { bodyX: -0.15 * wind * (1 - thrust) + 0.3 * thrust, headX: -0.15 * thrust, posY: 0.05 * thrust, yaw: s.toBoard * 0.35 * thrust };
      if (s.toBoard > 0) Object.assign(pose, { armRX: armX, armRZ: -0.5 * thrust, armLX: 0.3 * thrust });
      else Object.assign(pose, { armLX: armX, armLZ: 0.5 * thrust, armRX: 0.3 * thrust });
      return pose;
    },
    fire: 0.42,
  },
  cheer: {
    d: 1.9,
    pri: 2,
    f: (t) => {
      const j = t < 0.55 ? Math.sin((Math.PI * t) / 0.55) : 0;
      const up = Math.min(1, t * 4) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      return { posY: j * 0.55, armLX: -2.9 * up, armRX: -2.9 * up, armLZ: 0.35 * up, armRZ: -0.35 * up, headX: -0.35 * up, legLX: -0.5 * j, legRX: 0.5 * j, bodyX: -0.05 * up };
    },
  },
  dance: {
    d: 1.4,
    loop: true,
    pri: 3,
    f: (t) => {
      const b = Math.abs(Math.sin(t * TAU));
      const w = Math.sin(t * TAU);
      return { posY: b * 0.22, armLX: -2.5 + w * 0.6, armRX: -2.5 - w * 0.6, armLZ: 0.5, armRZ: -0.5, yaw: w * 0.5, headY: -w * 0.35, headX: -0.2, legLX: w * 0.3, legRX: -w * 0.3 };
    },
  },
  levitate: {
    d: 3.2,
    pri: 4,
    f: (t) => {
      const rise = smooth(clamp01(t < 0.3 ? t / 0.3 : t > 0.8 ? (1 - t) / 0.2 : 1));
      const spin = smooth(clamp01((t - 0.25) / 0.5));
      return { posY: rise * 0.9, yaw: spin * TAU, armLZ: 1.3 * rise + 0.08, armRZ: -1.3 * rise - 0.08, headX: -0.3 * rise, legLX: 0.25 * rise, legRX: -0.25 * rise };
    },
  },
  skill: {
    d: 2.0,
    pri: 3,
    f: (t, s) => {
      const c = t < 0.3 ? t / 0.3 : t < 0.5 ? 1 - (t - 0.3) / 0.2 : 0;
      const th = t < 0.3 ? 0 : t < 0.45 ? (t - 0.3) / 0.15 : t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
      const shake = th > 0.99 ? Math.sin(t * 90) * 0.04 : 0;
      return { posY: -0.12 * c + 0.05 * th, legLX: 0.6 * c, legRX: 0.6 * c, bodyX: 0.25 * c + 0.2 * th, armLX: 0.6 * c - 1.6 * th, armRX: 0.6 * c - 1.6 * th, armLZ: 0.25 * th + 0.08, armRZ: -0.25 * th - 0.08, headX: 0.2 * c - 0.15 * th, posX: shake, yaw: s.toBoard * 0.4 * th };
    },
    fire: 0.4,
  },
  bow: {
    d: 1.8,
    pri: 2,
    f: (t) => {
      const k = Math.sin(Math.PI * t);
      return { bodyX: 0.55 * k, headX: 0.3 * k, armLX: 0.4 * k, armRX: 0.4 * k };
    },
  },
};

class Figure {
  constructor(group, side, baseX, baseYaw) {
    this.group = group;
    this.parts = group.userData.parts;
    this.side = side; // -1 左（賽特）、+1 右（奈芙蒂斯）
    this.s = { toBoard: -side };
    this.baseX = baseX;
    this.baseYaw = baseYaw;
    this.pose = { ...ZERO };
    this.clip = null;
    this.t = 0;
    this.fired = false;
    this.onFire = null;
    this.idleTimer = 4 + Math.random() * 4;
    this.history = [];
  }

  play(name, { onFire = null, force = false } = {}) {
    const clip = CLIPS[name];
    if (!clip) return false;
    if (this.clip && !force && this.clip.pri > clip.pri && !(this.clip.loop === true && name !== 'idle')) return false;
    this.clip = clip;
    this.clipName = name;
    this.t = 0;
    this.fired = false;
    this.onFire = onFire;
    this.history.push(name);
    if (this.history.length > 200) this.history.shift();
    return true;
  }

  stop(name) {
    if (this.clipName === name) {
      this.clip = null;
      this.clipName = null;
    }
  }

  handWorld(out = new THREE.Vector3()) {
    return this.parts.hand.localToWorld(out.set(0, -12 * U, 2 * U));
  }

  update(dt) {
    let target;
    if (!this.clip) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 5 + Math.random() * 5;
        this.play(Math.random() < 0.5 ? 'look' : 'walk');
      }
      if (!this.clip) this.play('idle');
    }
    this.t += dt;
    const k = this.t / this.clip.d;
    if (k >= 1) {
      if (this.clip.loop) this.t -= this.clip.d;
      else {
        this.clip = null;
        this.clipName = null;
        target = { ...ZERO };
      }
    }
    if (this.clip) {
      const kk = this.t / this.clip.d;
      target = { ...ZERO, ...this.clip.f(kk, this.s) };
      if (this.clip.fire !== undefined && !this.fired && kk >= this.clip.fire) {
        this.fired = true;
        this.onFire?.(this);
      }
    }
    const a = 1 - Math.exp(-dt * 12);
    for (const key of Object.keys(ZERO)) this.pose[key] += (target[key] - this.pose[key]) * a;
    const p = this.pose;
    const { head, body, armL, armR, legL, legR } = this.parts;
    head.rotation.set(p.headX, p.headY, 0);
    body.rotation.x = p.bodyX;
    armL.rotation.set(p.armLX, 0, p.armLZ);
    armR.rotation.set(p.armRX, 0, p.armRZ);
    legL.rotation.x = p.legLX;
    legR.rotation.x = p.legRX;
    this.group.position.set(this.baseX + p.posX, FLOOR_Y + p.posY, this.group.position.z);
    this.group.rotation.y = this.baseYaw + p.yaw;
  }
}

export class Characters {
  constructor(scene, effects = null) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.effects = effects;
    this.mode = 'mg';
    this.time = 0;
    this.turn = 0;
    const setGroup = makeFigure({ skin: '#b8824f', hair: '#1a1210', armor: '#f0b84a', cloth: '#2d6cdf', crown: '#f5d36b', gem: '#3b7bff', eye: '#7fd8ff', ears: true, prop: 'khopesh', frontArm: 'R' });
    const nephGroup = makeFigure({ skin: '#c99266', hair: '#141018', armor: '#f0b84a', cloth: '#9b5fe0', crown: '#f5d36b', gem: '#e05ad6', eye: '#e8b4ff', ears: false, longHair: true, prop: 'ankh', frontArm: 'L' });
    const x = BOARD_W / 2 + 2.75;
    setGroup.position.set(-x, FLOOR_Y, 1.8);
    nephGroup.position.set(x, FLOOR_Y, 1.8);
    this.group.add(setGroup, nephGroup);
    this.set = new Figure(setGroup, -1, -x, 0.4);
    this.neph = new Figure(nephGroup, 1, x, -0.4);
    this.figures = [this.set, this.neph];
    this.colors = { set: '#4fa8ff', neph: '#d58cff' };
    // 特色模式的光環
    this.auras = this.figures.map((f) => {
      const ring = new THREE.Group();
      const geo = buildVoxels({ w: 1, h: 1, d: 1, at: () => '#ffffff', unit: 0.12 });
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd36b }));
        const a = (i / 12) * TAU;
        m.position.set(Math.cos(a) * 0.95, 0.08 + (i % 2) * 0.12, Math.sin(a) * 0.95);
        ring.add(m);
      }
      ring.position.set(f.baseX, FLOOR_Y, 1.8);
      ring.visible = false;
      this.group.add(ring);
      return ring;
    });
  }

  get history() {
    return [...this.set.history, ...this.neph.history];
  }

  setMode(mode) {
    this.mode = mode;
    const color = mode === 'nfg' ? 0xffd36b : mode === 'fg' ? 0xd58cff : 0xffffff;
    for (const ring of this.auras) {
      ring.visible = mode !== 'mg';
      for (const m of ring.children) m.material.color.set(color);
    }
  }

  fireball(fig, target, color) {
    if (!this.effects) return Promise.resolve();
    const from = fig.handWorld();
    return this.effects.fireball(from, target, color);
  }

  // 旋轉開始：輪流由一位施法，向盤面丟火球。
  onSpin() {
    this.turn ^= 1;
    const fig = this.turn ? this.set : this.neph;
    const color = this.turn ? this.colors.set : this.colors.neph;
    fig.play('cast', { onFire: (f) => this.fireball(f, BOARD_TARGET, color) });
  }

  // 消除：另一位歡呼；連消 3 次以上兩位都歡呼。
  onWin(cascade) {
    const other = this.turn ? this.neph : this.set;
    other.play('cheer');
    if (cascade >= 3) (this.turn ? this.set : this.neph).play('cheer');
  }

  // 倍數結算：兩位同時向盤面發射火球，回傳火球抵達的 Promise。
  onMultiply() {
    const flights = [];
    for (const fig of this.figures) {
      const color = fig === this.set ? this.colors.set : this.colors.neph;
      let resolveFlight;
      flights.push(new Promise((r) => (resolveFlight = r)));
      const ok = fig.play('cast', { force: true, onFire: (f) => this.fireball(f, BOARD_TARGET, color).then(resolveFlight) });
      if (!ok) resolveFlight();
    }
    return Promise.all(flights);
  }

  onSkill(kind) {
    const fig = kind === 'set' ? this.set : this.neph;
    const color = kind === 'set' ? this.colors.set : this.colors.neph;
    fig.play('skill', { force: true, onFire: (f) => { this.effects?.burst(f.handWorld(), [color, '#ffffff', '#f5d36b'], 22); this.effects?.sfx?.('skill'); } });
  }

  onTrigger() {
    for (const f of this.figures) f.play('cheer', { force: true });
  }

  onFeatureEnter() {
    for (const f of this.figures) {
      f.play('levitate', { force: true });
      this.effects?.bolt(f.baseX, FLOOR_Y + 7, FLOOR_Y + 2.6, 16);
    }
  }

  onFeatureExit() {
    for (const f of this.figures) f.play('bow', { force: true });
  }

  onBigWinStart() {
    for (const f of this.figures) f.play('dance', { force: true });
  }

  onBigWinEnd() {
    for (const f of this.figures) f.stop('dance');
  }

  update(dt) {
    this.time += dt;
    for (const f of this.figures) f.update(dt);
    this.group.updateMatrixWorld(true);
    this.auras.forEach((ring, i) => {
      ring.rotation.y = this.time * 1.2 * (i ? -1 : 1);
      ring.position.y = FLOOR_Y + Math.max(0, this.figures[i].pose.posY) * 0.4;
    });
  }
}
