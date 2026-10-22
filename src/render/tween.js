// 極簡補間／時間軸：以 requestAnimationFrame 驅動，回傳 Promise，支援全域速度倍率（turbo）。
const active = new Set();
let last = 0;
let speed = 1;
let running = false;

export const Ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outBounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export function setSpeed(s) {
  speed = s;
}
export function getSpeed() {
  return speed;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) * speed;
  last = now;
  for (const tw of active) tw.step(dt);
  if (active.size) requestAnimationFrame(frame);
  else running = false;
}
function ensureRunning() {
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

/**
 * tween(duration 秒, onUpdate(t 0..1), ease) → Promise；可 .cancel()。
 */
export function tween(duration, onUpdate, ease = Ease.linear, delay = 0) {
  let resolve;
  const p = new Promise((r) => (resolve = r));
  const tw = {
    t: -delay,
    step(dt) {
      this.t += dt;
      if (this.t < 0) return;
      const k = duration <= 0 ? 1 : Math.min(1, this.t / duration);
      onUpdate(ease(k), k);
      if (k >= 1) {
        active.delete(this);
        resolve();
      }
    },
  };
  p.cancel = () => {
    active.delete(tw);
    resolve();
  };
  active.add(tw);
  ensureRunning();
  return p;
}

export const wait = (seconds) => tween(seconds, () => {});

// 讓一個數值從 a 到 b（寫入 setter）。
export const animateValue = (a, b, duration, setter, ease = Ease.outQuad, delay = 0) => tween(duration, (t) => setter(a + (b - a) * t), ease, delay);

// 每幀回呼（無結束），回傳停止函式。
export function onFrame(fn) {
  const tw = { step: (dt) => fn(dt) };
  active.add(tw);
  ensureRunning();
  return () => active.delete(tw);
}

export function cancelAll() {
  active.clear();
}
