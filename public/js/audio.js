// WIBA - synthetische Soundeffekte (WebAudio, keine Dateien noetig)
let ctx = null, master = null, noiseBuf = null;
let eng = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}

function noise(dur, vol, freq, q = 0.7, type = 'lowpass', slide = 0) {
  if (!ctx || vol <= 0.005) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.4, dur + 0.05);
}
function tone(freq, dur, vol, type = 'square', slide = 0, delay = 0) {
  if (!ctx || vol <= 0.005) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  shot(kind, vol = 1) {
    if (kind === 'schrot') { noise(0.35, 0.9 * vol, 1400, 0.5, 'lowpass', 200); tone(110, 0.2, 0.5 * vol, 'sawtooth', 40); }
    else if (kind === 'stg' || kind === 'mg') { noise(0.12, 0.6 * vol, 2600, 0.6, 'lowpass', 500); tone(180, 0.08, 0.3 * vol, 'square', 60); }
    else if (kind === 'pzf' || kind === 'rakete') { noise(0.7, 0.7 * vol, 900, 0.4, 'bandpass', 3000); }
    else { noise(0.16, 0.7 * vol, 2000, 0.6, 'lowpass', 400); tone(150, 0.1, 0.35 * vol, 'square', 50); }
  },
  explosion(vol = 1) { noise(1.3, 1.2 * vol, 700, 0.3, 'lowpass', 60); tone(70, 0.9, 0.9 * vol, 'sine', 25); },
  dig(vol = 1) { noise(0.35, 0.5 * vol, 500, 0.8, 'lowpass', 120); tone(60, 0.2, 0.3 * vol, 'sine', 40); },
  hit() { tone(900, 0.07, 0.25, 'square', 600); },
  hurt() { tone(160, 0.2, 0.4, 'sawtooth', 70); },
  buy() { tone(880, 0.08, 0.2, 'square'); tone(1320, 0.12, 0.2, 'square', 0, 0.08); },
  deny() { tone(140, 0.18, 0.25, 'square', 100); },
  drink() { for (let i = 0; i < 3; i++) tone(300 + i * 60, 0.09, 0.2, 'sine', 180, i * 0.14); },
  eat() { for (let i = 0; i < 3; i++) noise(0.08, 0.3, 900, 1, 'bandpass'); },
  smoke() { noise(0.9, 0.2, 3000, 0.5, 'highpass'); },
  wiba() { tone(520, 0.1, 0.22, 'triangle'); tone(660, 0.1, 0.22, 'triangle', 0, 0.1); tone(780, 0.1, 0.22, 'triangle', 0, 0.2); tone(1040, 0.25, 0.25, 'triangle', 0, 0.3); },
  squeak() { tone(1400 + Math.random() * 500, 0.06, 0.07, 'sine', 900); },
  horn(vol = 1) { tone(310, 0.5, 0.3 * vol, 'sawtooth'); tone(390, 0.5, 0.3 * vol, 'sawtooth'); },
  reload() { tone(700, 0.04, 0.2, 'square'); tone(500, 0.05, 0.2, 'square', 0, 0.15); },
  place() { noise(0.2, 0.5, 300, 1, 'lowpass'); tone(90, 0.15, 0.4, 'sine', 50); },
  step() { noise(0.06, 0.12, 400, 1, 'lowpass'); },
  death() { tone(300, 0.8, 0.4, 'sawtooth', 40); },
  chute() { noise(0.5, 0.4, 600, 0.5, 'bandpass', 1500); },
};

// Motor-Dauerton
export function engine(on, pitch = 1, vol = 0.2, jet = false) {
  if (!ctx) return;
  if (!on) {
    if (eng) { eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
    return;
  }
  if (!eng) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const ng = ctx.createGain(); ng.gain.value = 0;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); n.connect(ng); ng.connect(f); f.connect(g); g.connect(master);
    o.start(); n.start();
    eng = { o, f, g, ng };
  }
  const t = ctx.currentTime;
  eng.o.frequency.setTargetAtTime((jet ? 90 : 45) * pitch, t, 0.08);
  eng.f.frequency.setTargetAtTime((jet ? 1800 : 380) * pitch + 150, t, 0.08);
  eng.ng.gain.setTargetAtTime(jet ? 0.9 : 0.15, t, 0.1);
  eng.g.gain.setTargetAtTime(vol, t, 0.1);
}
