// 可播種的 PRNG（sfc32），與參考站本地引擎相同的演算法，方便驗收時固定種子。
export class Rng {
  constructor(seed = Rng.seed()) {
    this.a = seed[0] >>> 0;
    this.b = seed[1] >>> 0;
    this.c = seed[2] >>> 0;
    this.d = seed[3] >>> 0;
    for (let i = 0; i < 15; i++) this.u32();
  }

  static seed() {
    const s = new Uint32Array(4);
    globalThis.crypto.getRandomValues(s);
    return Array.from(s);
  }

  // 由任意字串導出固定種子（FNV-1a 變體），給 harness 與 ?seed= 使用。
  static fromString(str) {
    const out = [];
    let h = 0x811c9dc5;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i) + k * 131;
        h = Math.imul(h, 0x01000193);
      }
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
      out.push(h >>> 0);
    }
    return new Rng(out);
  }

  u32() {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  next() {
    return this.u32() / 4294967296;
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  chance(p) {
    return this.next() < p;
  }

  // 從陣列隨機取出一個元素（會改變陣列）。
  take(arr) {
    const i = this.int(arr.length);
    const v = arr[i];
    arr[i] = arr[arr.length - 1];
    arr.pop();
    return v;
  }
}

// 依權重抽樣（累積權重表）。
export class WeightedPicker {
  constructor(weights) {
    this.cum = new Float64Array(weights.length);
    let t = 0;
    weights.forEach((w, i) => {
      t += w;
      this.cum[i] = t;
    });
    this.total = t;
  }

  pick(rng) {
    const r = rng.next() * this.total;
    let i = 0;
    while (i < this.cum.length - 1 && r >= this.cum[i]) i++;
    return i;
  }
}
