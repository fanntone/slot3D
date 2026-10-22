// Three.js 場景：麥塊風格的埃及神殿（砂岩牆、鑿刻柱、火把、金塊框、青金石帶、旗幟、地毯、夜空與遠方金字塔），
// 以及主遊戲／免費遊戲／覺醒的配色切換。
import * as THREE from 'three';
import { blockTexture, chiseledTexture, brickTexture, panelTexture, bannerTexture, carpetTexture, skyTexture, mat } from './textures.js';
import { buildVoxels, voxelMaterial } from './voxel.js';
import { Rng } from '../engine/rng.js';
import { COLS, ROWS } from '../engine/config.js';

export const CELL = 1; // 一格 = 1 單位
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;
export const BOARD_CENTER_Y = 0.35; // 盤面中心略高於畫面中央（下方留給操作列）
// 盤面遮罩：符號掉入／掉出時，超出金框上下緣的部分被裁掉（相當於原版的 Mask）。
export const BOARD_CLIP_PLANES = [
  new THREE.Plane(new THREE.Vector3(0, -1, 0), BOARD_CENTER_Y + BOARD_H / 2 + 0.5),
  new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BOARD_CENTER_Y - BOARD_H / 2 - 0.5)),
];

const THEMES = {
  mg: { sky: ['#0b1240', '#24348a', '#6a4a9a'], fog: '#2a3680', hemiSky: '#b4bdff', hemiGround: '#8a6a30', sun: '#fff4dc', sunIntensity: 1.7, torch: '#ffb347', accent: 'lapis', lightL: '#3fe0c0', lightR: '#c86cff' },
  fg: { sky: ['#1a0a3a', '#4a1c86', '#b05ab0'], fog: '#4a2080', hemiSky: '#d8aaff', hemiGround: '#6a4080', sun: '#f4e2ff', sunIntensity: 1.7, torch: '#d98bff', accent: 'purpur', lightL: '#ff6ad5', lightR: '#8a7bff' },
  nfg: { sky: ['#3a1a05', '#8a4a10', '#ffb347'], fog: '#9a6420', hemiSky: '#ffe4a8', hemiGround: '#8a6a20', sun: '#fff8e0', sunIntensity: 2.0, torch: '#ffd36b', accent: 'goldBlock', lightL: '#ffd36b', lightR: '#ff9a3a' },
};
const FLOOR_TOP = BOARD_CENTER_Y - BOARD_H / 2 - 1.1;
const WALL_W = 17;
const WALL_H = 7.0;

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}
function tiledTex(tex, rx, ry, extra = {}) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return mat(t, extra);
}
const tiled = (kind, rx, ry, extra = {}) => tiledTex(blockTexture(kind), rx, ry, extra);

export class GameScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 160);
    this.theme = 'mg';
    this.time = 0;
    this.flashT = 0;
    this.buildLights();
    this.buildEnvironment();
    this.setTheme('mg');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.7);
    this.sun.position.set(-4, 9, 11);
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.7);
    this.fill.position.set(6, 2, 8);
    this.scene.add(this.fill);
    // 左右彩色補光：讓角色與石柱有冷暖對比
    this.accentL = new THREE.PointLight(0x3fe0c0, 1.6, 14, 1.1);
    this.accentL.position.set(-6, 2.5, 3.5);
    this.accentR = new THREE.PointLight(0xc86cff, 1.6, 14, 1.1);
    this.accentR.position.set(6, 2.5, 3.5);
    this.scene.add(this.accentL, this.accentR);
    this.torchLights = [];
  }

  buildEnvironment() {
    const env = new THREE.Group();
    this.env = env;
    this.scene.add(env);

    // 夜空背景板（色帶漸層）＋星星＋月亮
    this.skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    this.skyPlane.position.set(0, FLOOR_TOP + 28, -70);
    env.add(this.skyPlane);
    const rng = Rng.fromString('stars');
    const starGeo = buildVoxels({ w: 1, h: 1, d: 1, at: () => '#ffffff', unit: 0.14 });
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    this.stars = new THREE.Group();
    for (let i = 0; i < 220; i++) {
      const s = new THREE.Mesh(starGeo, starMat);
      s.position.set((rng.next() - 0.5) * 120, FLOOR_TOP + 6 + rng.next() * 30, -30 - rng.next() * 30);
      s.scale.setScalar(0.5 + rng.next() * 1.4);
      this.stars.add(s);
    }
    env.add(this.stars);
    const moon = box(2.6, 2.6, 2.6, new THREE.MeshBasicMaterial({ map: blockTexture('moon'), fog: false }));
    moon.position.set(14, FLOOR_TOP + 17, -44);
    moon.rotation.set(0.4, 0.6, 0);
    env.add(moon);
    this.moon = moon;

    // 沙漠地面與遠處金字塔
    const desert = box(200, 1, 120, tiledTex(blockTexture('sandstone'), 100, 60));
    desert.position.set(0, FLOOR_TOP - 0.52, -40);
    env.add(desert);
    const pyramidMat = tiledTex(brickTexture('sandstoneDark'), 4, 1);
    const pyramid = (x, z, base, tiers) => {
      const g = new THREE.Group();
      for (let t = 0; t < tiers; t++) {
        const w = base * (1 - t / tiers);
        const tier = box(w, 1.1, w, pyramidMat);
        tier.position.y = FLOOR_TOP + 0.55 + t * 1.1;
        g.add(tier);
      }
      g.position.set(x, 0, z);
      return g;
    };
    env.add(pyramid(-26, -30, 18, 8), pyramid(28, -36, 22, 9), pyramid(-42, -42, 12, 6));

    // 神殿背牆（上方露出夜空）、青金石帶、簷口
    const wall = box(WALL_W, WALL_H, 1, tiledTex(brickTexture('sandstoneDark'), WALL_W, WALL_H));
    wall.position.set(0, FLOOR_TOP + WALL_H / 2, -1.6);
    env.add(wall);
    const lapisBand = box(WALL_W, 0.32, 1.06, tiled('lapis', WALL_W, 0.32));
    lapisBand.position.set(0, BOARD_CENTER_Y + BOARD_H / 2 + 0.72, -1.57);
    env.add(lapisBand);
    this.lapisBand = lapisBand;
    for (const dy of [-0.2, 0.2]) {
      const trim = box(WALL_W, 0.08, 1.08, tiled('goldBlock', WALL_W, 0.08));
      trim.position.set(0, lapisBand.position.y + dy, -1.56);
      env.add(trim);
    }
    const cornice = box(WALL_W + 1.4, 0.6, 1.8, tiledTex(chiseledTexture('sandstone', 3), WALL_W + 1, 0.6));
    cornice.position.set(0, FLOOR_TOP + WALL_H + 0.3, -1.3);
    env.add(cornice);
    const corniceTrim = box(WALL_W + 1.4, 0.12, 1.82, tiled('teal', WALL_W, 0.12));
    corniceTrim.position.set(0, FLOOR_TOP + WALL_H + 0.66, -1.3);
    env.add(corniceTrim);

    // 盤面底板（海晶石）、金塊框、青色內飾條、四角裝飾
    const panel = box(BOARD_W + 0.6, BOARD_H + 0.6, 0.3, tiledTex(panelTexture(), 6.6, 5.6));
    panel.position.set(0, BOARD_CENTER_Y, -0.45);
    env.add(panel);
    this.panel = panel;
    const fw = BOARD_W + 1.1;
    const fh = BOARD_H + 1.1;
    const top = box(fw, 0.45, 0.6, tiled('goldBlock', 7, 1));
    top.position.set(0, BOARD_CENTER_Y + fh / 2 - 0.22, -0.2);
    const bottom = top.clone();
    bottom.position.y = BOARD_CENTER_Y - fh / 2 + 0.22;
    const left = box(0.45, fh, 0.6, tiled('goldBlock', 1, 6));
    left.position.set(-fw / 2 + 0.22, BOARD_CENTER_Y, -0.2);
    const right = left.clone();
    right.position.x = fw / 2 - 0.22;
    env.add(top, bottom, left, right);
    const trimMat = tiled('teal', 6, 1);
    const innerW = BOARD_W + 0.2;
    const innerH = BOARD_H + 0.2;
    for (const sy of [-1, 1]) {
      const t = box(innerW, 0.1, 0.25, trimMat);
      t.position.set(0, BOARD_CENTER_Y + (sy * innerH) / 2, -0.25);
      env.add(t);
    }
    for (const sx of [-1, 1]) {
      const t = box(0.1, innerH, 0.25, trimMat);
      t.position.set((sx * innerW) / 2, BOARD_CENTER_Y, -0.25);
      env.add(t);
    }
    this.accentBlocks = [];
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const corner = box(0.62, 0.62, 0.7, tiled('lapis', 1, 1));
      corner.position.set((sx * fw) / 2, BOARD_CENTER_Y + (sy * fh) / 2, -0.15);
      env.add(corner);
      this.accentBlocks.push(corner);
    }

    // 地板、階梯、地毯
    const floor = box(40, 1, 16, tiledTex(blockTexture('sandstone'), 40, 16));
    floor.position.set(0, FLOOR_TOP - 0.5, 4);
    env.add(floor);
    const step = box(BOARD_W + 4, 0.5, 2.2, tiledTex(chiseledTexture('sandstone', 3), 10, 1));
    step.position.set(0, BOARD_CENTER_Y - BOARD_H / 2 - 0.85, 0.3);
    env.add(step);
    const carpet = box(4.8, 0.06, 8, tiledTex(carpetTexture(), 3, 5));
    carpet.position.set(0, FLOOR_TOP + 0.04, 5.4);
    env.add(carpet);

    // 旗幟（框兩側）
    for (const sx of [-1, 1]) {
      const banner = box(0.62, 2.7, 0.08, tiledTex(bannerTexture(), 1, 3));
      banner.position.set(sx * 4.08, BOARD_CENTER_Y + 0.9, -1.02);
      env.add(banner);
      const rod = box(0.9, 0.1, 0.12, tiled('goldBlock', 1, 1));
      rod.position.set(sx * 4.08, BOARD_CENTER_Y + 2.3, -1.0);
      env.add(rod);
    }

    // 兩側鑿刻石柱＋火把
    this.torches = [];
    for (const sx of [-1, 1]) {
      const x = sx * (BOARD_W / 2 + 1.9);
      const pillar = box(1, 9.5, 1, tiledTex(chiseledTexture('sandstone', 0), 1, 9.5));
      pillar.position.set(x, BOARD_CENTER_Y + 1.5, -0.6);
      env.add(pillar);
      const cap = box(1.4, 0.5, 1.4, tiled('lapis', 1, 1));
      cap.position.set(x, BOARD_CENTER_Y + 6.5, -0.6);
      env.add(cap);
      const base = box(1.4, 0.5, 1.4, tiled('sandstoneDark', 1, 1));
      base.position.set(x, BOARD_CENTER_Y - 3.2, -0.6);
      env.add(base);
      const torch = new THREE.Group();
      const stick = box(0.16, 0.6, 0.16, tiled('darkPlanks', 1, 1));
      const flame = box(0.24, 0.24, 0.24, new THREE.MeshBasicMaterial({ color: 0xffa030 }));
      flame.position.y = 0.4;
      const flameTip = box(0.14, 0.16, 0.14, new THREE.MeshBasicMaterial({ color: 0xfff1a0 }));
      flameTip.position.y = 0.58;
      torch.add(stick, flame, flameTip);
      torch.position.set(x - sx * 0.65, BOARD_CENTER_Y + 2.6, 0.1);
      env.add(torch);
      const light = new THREE.PointLight(0xffb347, 2.2, 8, 1.4);
      light.position.set(x - sx * 0.65, BOARD_CENTER_Y + 3.0, 0.6);
      env.add(light);
      this.torches.push({ torch, flame, light, phase: sx });
      this.torchLights.push(light);
    }

    // 覺醒模式的金塊堆（平時隱藏）
    this.coinPiles = new THREE.Group();
    const coinMat = tiled('goldBlock', 1, 1);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const c = box(0.5, 0.5, 0.5, coinMat);
        c.position.set(sx * (BOARD_W / 2 + 0.6 + rng.next() * 3.5), BOARD_CENTER_Y - BOARD_H / 2 - 0.85 + rng.next() * 1.1, 0.4 + rng.next() * 2.2);
        c.rotation.y = rng.next();
        this.coinPiles.add(c);
      }
    }
    this.coinPiles.visible = false;
    env.add(this.coinPiles);

    // 雷電閃光平面
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.flash.position.set(0, BOARD_CENTER_Y + 4, -1.0);
    env.add(this.flash);
  }

  setTheme(name) {
    const t = THEMES[name] ?? THEMES.mg;
    this.theme = name;
    this.scene.background = new THREE.Color(t.sky[0]);
    this.scene.fog = new THREE.Fog(t.fog, 30, 90);
    this.skyPlane.material.map = skyTexture(t.sky[0], t.sky[1], t.sky[2], name);
    this.skyPlane.material.needsUpdate = true;
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
    this.accentL.color.set(t.lightL);
    this.accentR.color.set(t.lightR);
    for (const l of this.torchLights) l.color.set(t.torch);
    const accent = blockTexture(t.accent);
    for (const b of this.accentBlocks) b.material = mat(accent);
    this.coinPiles.visible = name === 'nfg';
  }

  // 雷電閃光：短暫白光。
  lightning(strength = 0.6) {
    this.flashT = strength;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const needW = aspect >= 1.2 ? 13.8 : 8.8;
    const needH = aspect >= 1.2 ? 9.2 : 11.8;
    const dist = Math.max(needW / (2 * aspect * Math.tan(halfFov)), needH / (2 * Math.tan(halfFov)));
    // 相機略高並俯視，讓體素的頂面與側面露出來（類 3D 感），並看得到簷口上方的夜空
    this.camera.position.set(0, BOARD_CENTER_Y + 2.5, dist);
    this.camera.lookAt(0, BOARD_CENTER_Y + 0.35, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    for (const t of this.torches) {
      const f = 0.85 + 0.25 * Math.sin(this.time * 9 + t.phase * 2) + 0.1 * Math.sin(this.time * 23 + t.phase);
      t.light.intensity = 2.2 * f;
      t.flame.scale.setScalar(0.9 + 0.2 * f);
    }
    this.accentL.intensity = 1.6 + 0.3 * Math.sin(this.time * 1.7);
    this.accentR.intensity = 1.6 + 0.3 * Math.sin(this.time * 1.7 + 2);
    this.moon.rotation.y += dt * 0.05;
    if (this.flashT > 0) {
      this.flash.material.opacity = this.flashT * 0.5;
      this.flashT = Math.max(0, this.flashT - dt * 2.4);
    } else this.flash.material.opacity = 0;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export { voxelMaterial };
