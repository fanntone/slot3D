// WebAudio 合成音效與簡單背景音樂（音符方塊風格），不需任何音訊檔。
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.effectGain = null;
    this.musicGain = null;
    this.settings = { effect: true, background: true, effectVolume: 0.22, backgroundVolume: 0.26 };
    this.musicMode = null;
    this.musicTimer = 0;
    this.step = 0;
    this.unlocked = false;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.effectGain = this.ctx.createGain();
    this.effectGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.applySettings(this.settings);
    this.unlocked = true;
    if (this.musicMode) this.startMusic();
  }

  applySettings(s) {
    Object.assign(this.settings, s);
    if (!this.ctx) return;
    this.effectGain.gain.value = this.settings.effect ? this.settings.effectVolume : 0;
    this.musicGain.gain.value = this.settings.background ? this.settings.backgroundVolume * 0.6 : 0;
  }

  tone({ freq = 440, type = 'square', dur = 0.12, gain = 0.5, slide = 0, attack = 0.005, dest = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.effectGain);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, gain = 0.3, freq = 800, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.effectGain);
    src.start(t0);
  }

  play(name, idx = 0) {
    if (!this.ctx || !this.settings.effect) return;
    switch (name) {
      case 'click': this.tone({ freq: 660, dur: 0.05, gain: 0.3 }); break;
      case 'spin': this.noise({ dur: 0.35, gain: 0.25, freq: 1200 }); this.tone({ freq: 220, type: 'triangle', dur: 0.3, slide: 200, gain: 0.2 }); break;
      case 'land': this.noise({ dur: 0.08, gain: 0.35, freq: 400 }); this.tone({ freq: 110, type: 'triangle', dur: 0.08, gain: 0.3 }); break;
      case 'pop': this.tone({ freq: 520, dur: 0.08, gain: 0.3, slide: 300 }); this.noise({ dur: 0.1, gain: 0.2, freq: 2500 }); break;
      case 'win': { const base = 392 * Math.pow(1.122, Math.min(8, idx)); [0, 0.07, 0.14].forEach((d, i) => this.tone({ freq: base * [1, 1.25, 1.5][i], type: 'square', dur: 0.18, gain: 0.25, delay: d })); break; }
      case 'multiply': [0, 0.1, 0.2, 0.3].forEach((d, i) => this.tone({ freq: 523 * Math.pow(1.19, i), type: 'triangle', dur: 0.25, gain: 0.3, delay: d })); break;
      case 'upgrade': this.tone({ freq: 880, type: 'sine', dur: 0.3, slide: 600, gain: 0.3 }); break;
      case 'scatter': [0, 0.12, 0.24].forEach((d) => this.tone({ freq: 784, type: 'square', dur: 0.15, gain: 0.25, delay: d })); break;
      case 'trigger': [0, 0.1, 0.2, 0.3, 0.45].forEach((d, i) => this.tone({ freq: [523, 659, 784, 1047, 1319][i], type: 'square', dur: 0.3, gain: 0.3, delay: d })); break;
      case 'skill': this.tone({ freq: 330, type: 'sawtooth', dur: 0.4, slide: 500, gain: 0.25 }); this.noise({ dur: 0.3, gain: 0.2, freq: 900 }); break;
      case 'split': [0, 0.08, 0.16].forEach((d) => this.tone({ freq: 988, type: 'triangle', dur: 0.12, gain: 0.25, delay: d })); break;
      case 'jackpot': [0, 0.15, 0.3, 0.45, 0.6, 0.75].forEach((d, i) => this.tone({ freq: [523, 659, 784, 1047, 784, 1047][i], type: 'square', dur: 0.35, gain: 0.3, delay: d })); break;
      case 'chest': this.tone({ freq: 196, type: 'triangle', dur: 0.4, gain: 0.3 }); this.noise({ dur: 0.25, gain: 0.15, freq: 600 }); break;
      case 'bigwin': { const n = 6 + idx * 2; for (let i = 0; i < n; i++) this.tone({ freq: [523, 659, 784, 1047][i % 4] * (1 + Math.floor(i / 4) * 0.5), type: 'square', dur: 0.22, gain: 0.28, delay: i * 0.11 }); break; }
      case 'tick': this.tone({ freq: 1200 + Math.random() * 300, type: 'square', dur: 0.03, gain: 0.12 }); break;
      case 'fgIntro': [0, 0.2, 0.4, 0.6].forEach((d, i) => this.tone({ freq: [262, 330, 392, 523][i], type: 'triangle', dur: 0.5, gain: 0.3, delay: d })); break;
      case 'lightning': this.noise({ dur: 0.5, gain: 0.3, freq: 300 }); break;
      default: break;
    }
  }

  // 背景音樂：以音階步進的短音循環（主遊戲：Hijaz 風；免費遊戲：較快；覺醒：更亮）。
  setMusic(mode) {
    this.musicMode = mode;
    this.step = 0;
    if (this.ctx) this.startMusic();
  }

  startMusic() {
    clearInterval(this.musicTimer);
    if (!this.musicMode || !this.ctx) return;
    const scales = {
      mg: { notes: [164.8, 174.6, 207.7, 220, 246.9, 261.6, 311.1, 329.6], bpm: 92, pattern: [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 6, 4, 2, 1] },
      fg: { notes: [196, 207.7, 246.9, 261.6, 293.7, 311.1, 370, 392], bpm: 120, pattern: [0, 4, 2, 5, 0, 4, 7, 5, 1, 4, 2, 6, 1, 4, 7, 6] },
      nfg: { notes: [220, 233.1, 277.2, 293.7, 329.6, 349.2, 415.3, 440], bpm: 132, pattern: [0, 2, 4, 7, 4, 2, 5, 7, 0, 3, 5, 7, 6, 4, 2, 0] },
    };
    const s = scales[this.musicMode] ?? scales.mg;
    const interval = 60000 / s.bpm / 2;
    this.musicTimer = setInterval(() => {
      if (!this.settings.background) return;
      const i = this.step++ % s.pattern.length;
      const f = s.notes[s.pattern[i]];
      this.tone({ freq: f, type: 'triangle', dur: 0.25, gain: 0.35, dest: this.musicGain });
      if (i % 4 === 0) this.tone({ freq: f / 2, type: 'sine', dur: 0.4, gain: 0.3, dest: this.musicGain });
      if (i % 8 === 4) this.noise({ dur: 0.05, gain: 0.08, freq: 3000 });
    }, interval);
  }
}
