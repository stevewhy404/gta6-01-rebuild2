// Solmar Bay — audio.js
// One job: every sound in the game, synthesized live with WebAudio. No audio files.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  // Must be called from a user gesture (start button / first keypress).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine hum: two detuned saws through a low-pass, gain follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(lp);
    engineOsc2.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    engineOsc2.start();
    // Police siren: one square wave that alternates two notes.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // speed01: 0..1 of top speed. Call every frame while driving.
  engine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.08);
    const f = 50 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.05);
  }

  siren(on, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.1);
    if (!on) return;
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.42) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 950 : 720, t, 0.02);
    }
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shot() { this._noise(0.14, 0.5, 2600); this._blip(180, 0.1, 'square', 0.18, 60); }
  punch() { this._noise(0.08, 0.25, 500); }
  crash() { this._noise(0.3, 0.45, 700); }
  pickup() { this._blip(660, 0.09, 'sine', 0.22); setTimeout(() => this._blip(990, 0.12, 'sine', 0.22), 70); }
  click() { this._blip(520, 0.05, 'square', 0.12); }
  denied() { this._blip(160, 0.16, 'square', 0.18, 110); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._blip(f, 0.14, 'triangle', 0.22), i * 90)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip(f, 0.18, 'triangle', 0.24), i * 110)); }
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.22), i * 140)); }
  cash() { this._blip(880, 0.08, 'sine', 0.2); setTimeout(() => this._blip(1320, 0.12, 'sine', 0.2), 60); }
}
