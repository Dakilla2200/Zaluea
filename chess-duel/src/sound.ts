/**
 * Synthesized sound effects (Web Audio) — no audio files, so they work offline and load instantly.
 */
export type SoundName = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'win' | 'draw' | 'lowtime' | 'select' | 'illegal';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  return ctx;
}

/** Must be called from a user gesture on iOS to unlock audio. */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

/** A woody "tock": filtered noise transient + short pitched body. */
function tock(t: number, pitch: number, gain: number, decay = 0.09) {
  const c = ctx!;
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = pitch * 6;
  bp.Q.value = 1.4;
  const ng = c.createGain();
  ng.gain.setValueAtTime(gain * 0.9, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.6);
  n.connect(bp).connect(ng).connect(master!);
  n.start(t);
  n.stop(t + 0.2);

  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(pitch * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(pitch, t + 0.03);
  const og = c.createGain();
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + decay);
  o.connect(og).connect(master!);
  o.start(t);
  o.stop(t + decay + 0.02);
}

function tone(t: number, freq: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
  // soft echo for a "room" feel
  const d = c.createDelay();
  d.delayTime.value = 0.11;
  const dg = c.createGain();
  dg.gain.value = 0.22;
  g.connect(d).connect(dg).connect(master!);
}

export function playSound(name: SoundName) {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'move':
      tock(t, 210, 0.55);
      break;
    case 'capture':
      tock(t, 160, 0.75, 0.12);
      tock(t + 0.045, 240, 0.45);
      break;
    case 'castle':
      tock(t, 210, 0.5);
      tock(t + 0.11, 190, 0.45);
      break;
    case 'check':
      tock(t, 200, 0.55);
      tone(t + 0.02, 987.8, 0.35, 0.16, 'sine');
      tone(t + 0.02, 1318.5, 0.3, 0.08, 'sine');
      break;
    case 'promote':
      tock(t, 210, 0.5);
      [659.3, 830.6, 987.8].forEach((f, i) => tone(t + 0.04 + i * 0.06, f, 0.3, 0.1));
      break;
    case 'win':
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(t + i * 0.12, f, 0.9 - i * 0.05, 0.16));
      tone(t + 0.48, 1318.5, 1.2, 0.08, 'sine');
      break;
    case 'draw':
      tone(t, 587.3, 0.7, 0.13);
      tone(t + 0.16, 523.3, 1.0, 0.13);
      break;
    case 'lowtime':
      tone(t, 1760, 0.06, 0.05, 'square');
      break;
    case 'select':
      tock(t, 420, 0.12, 0.04);
      break;
    case 'illegal':
      tone(t, 180, 0.12, 0.08, 'sawtooth');
      break;
  }
}
