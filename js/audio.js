// Procedural "creepy proximity" sound — a low detuned drone that rises in volume,
// brightens and wobbles faster the closer a monster gets. No audio files needed,
// so it works anywhere (including GitHub Pages) with zero assets.
export class CreepSound {
  constructor() {
    this.ctx = null;
    this.started = false;
  }

  // Must be called from a user gesture (e.g. clicking a level button).
  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // low-pass shapes the drone from harsh to muffled
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 220;
    this.filter.Q.value = 7;
    this.filter.connect(this.master);

    // two slightly detuned saw oscillators = uneasy beating drone
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc1.frequency.value = 52;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.value = 52 * 1.012;
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);

    // LFO wobbles the filter cutoff for a pulsing, breathing menace
    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 3;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    this.osc1.start();
    this.osc2.start();
    this.lfo.start();
    this.started = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  // intensity 0 (no monster near) .. 1 (right on top of you)
  setIntensity(x) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const k = Math.max(0, Math.min(1, x));
    this.master.gain.setTargetAtTime(k * 0.25, t, 0.12);
    this.filter.frequency.setTargetAtTime(180 + k * 600, t, 0.18);
    this.lfoGain.gain.setTargetAtTime(k * 140, t, 0.18);
    this.lfo.frequency.setTargetAtTime(2.5 + k * 7, t, 0.18);
  }

  silence() {
    if (this.started) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
