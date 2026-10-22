// 方塊粒子（消除碎片、金幣噴泉）與音效轉發。
import * as THREE from 'three';
import { shadedCube, voxelMaterial } from './voxel.js';
import { Rng } from '../engine/rng.js';
import { BOARD_CENTER_Y, BOARD_H } from './scene.js';

const MAX = 600;

export class Effects {
  constructor(scene, { sfx = null } = {}) {
    this.scene = scene;
    this.sfx = sfx;
    this.rng = new Rng();
    this.material = voxelMaterial();
    this.pool = [];
    this.live = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.actors = [];
  }

  // 火球：發光方塊沿拋物線飛向目標，沿途留尾跡，抵達時爆開；回傳抵達的 Promise。
  fireball(from, to, color = '#4fa8ff', { duration = 0.75, arc = 1.1 } = {}) {
    const core = new THREE.Mesh(shadedCube('#ffffff'), new THREE.MeshBasicMaterial({ color }));
    core.scale.setScalar(0.26);
    const orbit = [0, 1].map(() => {
      const m = new THREE.Mesh(shadedCube('#ffffff'), new THREE.MeshBasicMaterial({ color: '#fff6c8' }));
      m.scale.setScalar(0.12);
      this.group.add(m);
      return m;
    });
    this.group.add(core);
    const light = new THREE.PointLight(new THREE.Color(color), 1.4, 4, 2);
    this.group.add(light);
    return new Promise((resolve) => {
      this.actors.push({
        t: 0,
        duration,
        update: (dt) => {
          const a = this;
          void a;
        },
        step: (dt, actor) => {
          actor.t += dt;
          const k = Math.min(1, actor.t / duration);
          const pos = new THREE.Vector3().lerpVectors(from, to, k);
          pos.y += Math.sin(Math.PI * k) * arc;
          core.position.copy(pos);
          core.rotation.x += dt * 9;
          core.rotation.y += dt * 7;
          light.position.copy(pos);
          orbit.forEach((m, i) => {
            const ang = actor.t * 14 + i * Math.PI;
            m.position.set(pos.x + Math.cos(ang) * 0.3, pos.y + Math.sin(ang * 1.3) * 0.2, pos.z + Math.sin(ang) * 0.3);
          });
          for (let i = 0; i < 2; i++) this.spawn(i ? color : '#fff6c8', pos, new THREE.Vector3((this.rng.next() - 0.5) * 0.6, (this.rng.next() - 0.5) * 0.6, 0), { size: 0.06 + this.rng.next() * 0.06, life: 0.3 + this.rng.next() * 0.2, gravity: 0, spin: 2 });
          if (k >= 1) {
            this.group.remove(core, light, ...orbit);
            this.burst(to, [color, '#fff6c8', '#f5d36b'], 20);
            this.sfx?.('pop');
            resolve();
            return false;
          }
          return true;
        },
      });
    });
  }

  spawn(hex, pos, vel, { size = 0.12, life = 0.9, gravity = 14, spin = 6 } = {}) {
    let p = this.pool.pop();
    if (!p) {
      if (this.live.length >= MAX) return null;
      p = { mesh: new THREE.Mesh(shadedCube(hex), this.material), vel: new THREE.Vector3(), rot: new THREE.Vector3() };
      this.group.add(p.mesh);
    } else {
      p.mesh.geometry = shadedCube(hex);
      p.mesh.visible = true;
    }
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(size);
    p.mesh.rotation.set(0, 0, 0);
    p.vel.copy(vel);
    p.rot.set((this.rng.next() - 0.5) * spin, (this.rng.next() - 0.5) * spin, (this.rng.next() - 0.5) * spin);
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    this.live.push(p);
    return p;
  }

  // 消除碎片：從格子位置向四周噴出。
  burst(pos, colors, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = 2 + this.rng.next() * 3.5;
      const vel = new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 2.5, 1.5 + this.rng.next() * 2.5);
      this.spawn(colors[i % colors.length], pos, vel, { size: 0.08 + this.rng.next() * 0.1, life: 0.6 + this.rng.next() * 0.5 });
    }
  }

  // 金幣噴泉：由盤面下方往上灑。
  coins(count = 40, { x = 0, y = BOARD_CENTER_Y - BOARD_H / 2 - 0.5, spread = 4 } = {}) {
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(x + (this.rng.next() - 0.5) * spread, y, 1.5 + this.rng.next());
      const vel = new THREE.Vector3((this.rng.next() - 0.5) * 6, 8 + this.rng.next() * 7, (this.rng.next() - 0.5) * 2);
      this.spawn(i % 3 ? '#f5cf3a' : '#fff0a0', pos, vel, { size: 0.14 + this.rng.next() * 0.08, life: 1.4 + this.rng.next() * 0.8, gravity: 16 });
    }
  }

  // 閃電落雷：由上而下的白色方塊串。
  bolt(x, topY, bottomY, count = 14) {
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = new THREE.Vector3(x + (this.rng.next() - 0.5) * 0.6, topY + (bottomY - topY) * t, 0.8);
      this.spawn(i % 2 ? '#ffffff' : '#9fd8ff', pos, new THREE.Vector3(0, 0, 0), { size: 0.1 + this.rng.next() * 0.12, life: 0.25 + this.rng.next() * 0.25, gravity: 0, spin: 0 });
    }
  }

  update(dt) {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const actor = this.actors[i];
      if (!actor.step(dt, actor)) this.actors.splice(i, 1);
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.live.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rot.x * dt;
      p.mesh.rotation.y += p.rot.y * dt;
      p.mesh.rotation.z += p.rot.z * dt;
      const k = p.life / p.maxLife;
      if (k < 0.3) p.mesh.scale.setScalar(p.mesh.scale.x * (1 - dt * 3));
    }
  }
}
