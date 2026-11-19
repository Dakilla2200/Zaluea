/**
 * Stereo sound engine (Web Audio, fully synthesized — works offline, nothing to download).
 * Effects are panned by board file (a-file left … h-file right); a short opposite-side echo
 * (Haas effect) widens each sound. Includes a gentle generative background-music loop.
 */
export type SoundName = 'tap' | 'select' | 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'win' | 'draw' | 'lowtime' | 'illegal' | 'undo' | 'whoosh';

let ctx: AudioContext | null = null;
let fxBus: GainNode;
let musicBus: GainNode;
let musicDuck: GainNode;
let noiseBuf: AudioBuffer;

let fxVolume = 0.8;
let musicVolume = 0.4;
let musicWanted = false;
let musicTimer: number | undefined;
let nextBar = 0;
let bar = 0;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.connect(ctx.destination);
  fxBus = ctx.createGain();
  fxBus.gain.value = fxVolume;
  fxBus.connect(comp);
  musicDuck = ctx.createGain();
  musicDuck.connect(comp);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicVolume * 0.6;
  musicBus.connect(musicDuck);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 4;
  return ctx;
}

/** Call from a user gesture: unlocks audio on iOS and starts music if wanted. */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  if (musicWanted && musicTimer === undefined) startMusic();
}

export function setFxVolume(v: number) {
  fxVolume = v;
  if (ctx) fxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.03);
}
export function setMusicVolume(v: number) {
  musicVolume = v;
  if (ctx) musicBus.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.1);
}
export function setMusic(on: boolean) {
  musicWanted = on;
  if (!on) stopMusic();
  else if (ctx && ctx.state === 'running') startMusic();
}
/** Temporarily lower the music (e.g. under the victory fanfare). */
export function duckMusic(seconds: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  musicDuck.gain.cancelScheduledValues(t);
  musicDuck.gain.setTargetAtTime(0.15, t, 0.05);
  musicDuck.gain.setTargetAtTime(1, t + seconds, 0.6);
}
/** Pause/resume all audio, e.g. when the app is backgrounded. */
export function suspendAudio(suspend: boolean) {
  if (!ctx) return;
  if (suspend) void ctx.suspend();
  else void ctx.resume();
}

const fileToPan = (file: number) => ((file - 3.5) / 3.5) * 0.85;

function out(pan: number, dest: AudioNode = fxBus): AudioNode {
  const p = ctx!.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(dest);
  return p;
}

function tone(t: number, f: number, dur: number, gain: number, pan: number, type: OscillatorType = 'sine', f2?: number, dest?: AudioNode) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(pan, dest));
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Wooden "thock" with a Haas-widened echo on the opposite side. */
function thock(t: number, pitch: number, gain: number, pan: number) {
  const c = ctx!;
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = pitch * 7;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain;
  n.connect(bp).connect(g).connect(out(pan));
  n.start(t);
  tone(t, pitch * 1.8, 0.09, gain * 0.9, pan, 'sine', pitch);
  tone(t + 0.009, pitch * 1.8, 0.07, gain * 0.25, -pan * 0.8, 'sine', pitch);
}

/** Play an effect. `file` (0-7) positions it in the stereo field. */
export function playSound(name: SoundName, file = 3.5) {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.005;
  const p = fileToPan(file);
  switch (name) {
    case 'tap':
      tone(t, 900, 0.05, 0.07, 0, 'triangle', 1250);
      break;
    case 'select':
      tone(t, 520, 0.14, 0.2, p, 'sine', 880);
      tone(t + 0.012, 1040, 0.1, 0.05, -p * 0.5, 'triangle', 1500);
      break;
    case 'move':
      thock(t, 200, 0.6, p);
      tone(t + 0.02, 1600, 0.05, 0.045, p, 'triangle');
      break;
    case 'capture':
      thock(t, 150, 0.75, p);
      tone(t + 0.03, 900, 0.22, 0.17, p, 'square', 220);
      tone(t + 0.05, 2200, 0.12, 0.05, -p, 'triangle', 3000);
      break;
    case 'castle':
      thock(t, 210, 0.5, p);
      thock(t + 0.12, 190, 0.5, p * 0.4);
      break;
    case 'check':
      tone(t, 988, 0.22, 0.18, -0.6, 'triangle');
      tone(t + 0.16, 1319, 0.3, 0.18, 0.6, 'triangle');
      break;
    case 'promote':
      thock(t, 210, 0.45, p);
      [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => tone(t + 0.05 + i * 0.07, f, 0.35, 0.1, -0.6 + i * 0.4, 'triangle'));
      break;
    case 'win':
      duckMusic(3.5);
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => {
        const pp = -0.9 + i * 0.45;
        tone(t + i * 0.11, f, 0.6, 0.15, pp, 'triangle');
        tone(t + i * 0.11 + 0.12, f, 0.4, 0.05, -pp, 'sine');
      });
      [523.3, 659.3, 784].forEach((f) => {
        tone(t + 0.6, f, 1.5, 0.07, -0.45, 'sine');
        tone(t + 0.6, f * 1.004, 1.5, 0.07, 0.45, 'sine');
      });
      break;
    case 'draw':
      duckMusic(2.5);
      tone(t, 587.3, 0.7, 0.12, -0.4, 'triangle');
      tone(t + 0.18, 523.3, 1.0, 0.12, 0.4, 'triangle');
      tone(t + 0.36, 659.3, 1.2, 0.08, 0, 'sine');
      break;
    case 'lowtime':
      tone(t, 1760, 0.05, 0.05, p, 'square');
      break;
    case 'illegal':
      tone(t, 220, 0.14, 0.1, p, 'sine', 160);
      break;
    case 'undo':
      tone(t, 880, 0.14, 0.1, 0.4, 'sine', 440);
      tone(t + 0.05, 660, 0.14, 0.07, -0.4, 'sine', 330);
      break;
    case 'whoosh': {
      const n = c.createBufferSource();
      n.buffer = noiseBuf;
      n.playbackRate.value = 0.5;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
      const g = c.createGain();
      g.gain.value = 0.35;
      const pan = c.createStereoPanner();
      pan.pan.setValueAtTime(-0.8, t);
      pan.pan.linearRampToValueAtTime(0.8, t + 0.35);
      n.connect(bp).connect(g).connect(pan).connect(fxBus);
      n.start(t);
      break;
    }
  }
}

// ---------- background music: warm pad + plucked arpeggio, alternating stereo ----------
const CHORDS = [
  [261.6, 329.6, 392, 493.9], // Cmaj7
  [220, 261.6, 329.6, 392], // Am7
  [174.6, 220, 261.6, 329.6], // Fmaj7
  [196, 246.9, 293.7, 392], // G6
];

function scheduleMusic() {
  const c = ctx!;
  const spb = 60 / 88;
  while (nextBar < c.currentTime + 1.2) {
    const ch = CHORDS[bar % 4];
    ch.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 850;
      o.type = 'sawtooth';
      o.frequency.value = (f / 2) * (i % 2 ? 1.003 : 0.997);
      g.gain.setValueAtTime(0.0001, nextBar);
      g.gain.linearRampToValueAtTime(0.016, nextBar + 1);
      g.gain.linearRampToValueAtTime(0.0001, nextBar + spb * 4 + 0.4);
      o.connect(lp).connect(g).connect(out(i % 2 ? 0.55 : -0.55, musicBus));
      o.start(nextBar);
      o.stop(nextBar + spb * 4 + 0.5);
    });
    // bass on the downbeat
    tone(nextBar, ch[0] / 4, spb * 2, 0.05, 0, 'sine', undefined, musicBus);
    for (let s = 0; s < 8; s++) {
      if ((s * 7 + bar * 3) % 10 < 3) continue; // gentle, deterministic variation
      const f = ch[(s * 3 + bar) % 4] * 2;
      const t = nextBar + (s * spb) / 2;
      tone(t, f, 0.45, 0.045, s % 2 ? 0.7 : -0.7, 'triangle', undefined, musicBus);
      tone(t + 0.18, f, 0.3, 0.012, s % 2 ? -0.7 : 0.7, 'sine', undefined, musicBus); // ping-pong echo
    }
    nextBar += spb * 4;
    bar++;
  }
}

function startMusic() {
  if (!ctx || musicTimer !== undefined) return;
  nextBar = ctx.currentTime + 0.15;
  musicDuck.gain.cancelScheduledValues(ctx.currentTime);
  musicDuck.gain.setValueAtTime(0, ctx.currentTime);
  musicDuck.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
  scheduleMusic();
  musicTimer = window.setInterval(scheduleMusic, 300);
}

function stopMusic() {
  if (musicTimer !== undefined) window.clearInterval(musicTimer);
  musicTimer = undefined;
  if (ctx) {
    musicDuck.gain.cancelScheduledValues(ctx.currentTime);
    musicDuck.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }
}
