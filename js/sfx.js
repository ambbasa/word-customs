'use strict';

export const SFX = {
  ctx: null,
  muted: false,
  ensure() {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(freq, dur, type = 'sine', vol = 0.08, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },
  bell() { this.tone(880, 0.35, 'triangle', 0.1); this.tone(1320, 0.25, 'sine', 0.05, 0.03); },
  paper() { this.tone(240, 0.08, 'triangle', 0.04); this.tone(310, 0.06, 'sine', 0.03, 0.04); },
  stamp(kind) {
    if (kind === 'pass') { this.tone(125, 0.14, 'triangle', 0.14); this.tone(90, 0.12, 'sine', 0.1, 0.04); }
    else if (kind === 'deny') { this.tone(220, 0.1, 'sawtooth', 0.09); this.tone(140, 0.16, 'square', 0.07, 0.04); }
    else { this.tone(420, 0.09, 'sine', 0.08); this.tone(540, 0.09, 'triangle', 0.06, 0.04); }
  },
  meterResult(displayedVal) {
    this.tone(110, 0.16, 'sawtooth', 0.03);
    const pitch = 240 + Math.max(0, Math.min(100, displayedVal)) * 5.2;
    this.tone(pitch, 0.22, 'sine', 0.09, 0.16);
  },
  nullBeep() { this.tone(620, 0.05, 'square', 0.035); },
  warn() { this.tone(190, 0.18, 'sawtooth', 0.09); this.tone(150, 0.22, 'sawtooth', 0.09, 0.16); },
  motif(isMetaphor) {
    const mult = isMetaphor ? 0.5 : 1;
    [523.25, 659.25, 783.99, 987.77].forEach((n, i) => this.tone(n * mult, 0.65, 'triangle', 0.09, i * 0.24));
  },
  eveningChord(restoredTotal) {
    if (restoredTotal <= 0) return;
    const layer1 = [261.63, 329.63, 392.00];
    const layer2 = [493.88, 587.33];
    const layer3 = [130.81, 659.25, 783.99];
    layer1.forEach((n, i) => this.tone(n, 1.1, 'triangle', 0.055, i * 0.22));
    if (restoredTotal >= 3) layer2.forEach((n, i) => this.tone(n, 1.2, 'sine', 0.045, 0.55 + i * 0.22));
    if (restoredTotal >= 8) layer3.forEach((n, i) => this.tone(n, 1.4, 'triangle', 0.04, 0.95 + i * 0.2));
  }
};
