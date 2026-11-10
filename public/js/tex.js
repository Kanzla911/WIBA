// WIBA - prozedurale Texturen (keine Bilddateien noetig)
import * as THREE from 'three';

const cache = {};
function rnd() { return Math.random(); }
function make(size, draw, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function speckle(c, s, n, lo, hi, a, max = 2) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(lo + rnd() * (hi - lo));
    c.fillStyle = `rgba(${v},${v},${v},${a})`;
    const r = 1 + rnd() * max;
    c.fillRect(rnd() * s, rnd() * s, r, r);
  }
}
function blotch(c, s, n, a) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = 20 + rnd() * 70, v = rnd() < 0.5 ? 0 : 255;
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}
const DEF = {
  ground: () => make(512, (c, s) => {
    c.fillStyle = '#d6d6d6'; c.fillRect(0, 0, s, s);
    blotch(c, s, 70, 0.1);
    speckle(c, s, 16000, 120, 255, 0.3, 2);
    for (let i = 0; i < 5000; i++) { const v = 150 + rnd() * 105; c.strokeStyle = `rgba(${v},${v},${v},0.3)`; const x = rnd() * s, y = rnd() * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 5); c.stroke(); }
  }),
  asphalt: () => make(256, (c, s) => { c.fillStyle = '#c4c4c4'; c.fillRect(0, 0, s, s); blotch(c, s, 14, 0.08); speckle(c, s, 16000, 90, 255, 0.45, 1); }),
  plaster: () => make(256, (c, s) => {
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, s, s); speckle(c, s, 5000, 170, 255, 0.18, 2);
    const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(0,0,0,0.1)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  }, false),
  roof: () => make(256, (c, s) => {
    c.fillStyle = '#e2e2e2'; c.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) {
      const y = r * 32;
      const g = c.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.18, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.12)');
      c.fillStyle = g; c.fillRect(0, y, s, 32);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = (r % 2) * 16; x < s; x += 32) c.fillRect(x, y, 2, 32);
    }
    speckle(c, s, 2500, 100, 255, 0.15, 3);
  }),
  wood: () => make(256, (c, s) => {
    c.fillStyle = '#e0e0e0'; c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 22) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, 0, 2, s); }
    for (let i = 0; i < 900; i++) { const v = 90 + rnd() * 140; c.fillStyle = `rgba(${v},${v},${v},0.15)`; c.fillRect(rnd() * s, rnd() * s, 1, 10 + rnd() * 50); }
  }),
  facade: () => make(256, (c, s) => {
    c.fillStyle = '#f1f1f1'; c.fillRect(0, 0, s, s); speckle(c, s, 3500, 180, 255, 0.16, 2);
    const g0 = c.createLinearGradient(0, 0, 0, s); g0.addColorStop(0, 'rgba(0,0,0,0.07)'); g0.addColorStop(0.2, 'rgba(0,0,0,0)'); g0.addColorStop(1, 'rgba(0,0,0,0.05)');
    c.fillStyle = g0; c.fillRect(0, 0, s, s);
    const x = s * 0.31, y = s * 0.24, w = s * 0.38, h = s * 0.5;
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x - 5, y - 3, w + 10, h + 12);
    c.fillStyle = '#ffffff'; c.fillRect(x - 6, y - 6, w + 12, h + 12);
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2c3a4a'); g.addColorStop(0.5, '#536a80'); g.addColorStop(1, '#1e2833');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(x, y + h * 0.5); c.lineTo(x + w * 0.6, y); c.lineTo(x + w * 0.85, y); c.lineTo(x, y + h * 0.8); c.fill();
    c.fillStyle = '#f6f6f6'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h * 0.36, w, 3);
    c.fillStyle = '#d9d5cc'; c.fillRect(x - 10, y + h + 6, w + 20, 7);
  }),
  facadeGlow: () => make(256, (c, s) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, s, s);
    const x = s * 0.31, y = s * 0.24, w = s * 0.38, h = s * 0.5;
    const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#ffd98a'); g.addColorStop(1, '#c98a3a');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#000'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h * 0.36, w, 3);
  }),
  leaves: () => make(256, (c, s) => {
    c.clearRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const a = rnd() * 6.283, d = Math.pow(rnd(), 0.6) * s * 0.46, x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d * 0.9;
      const v = 120 + rnd() * 135, w = 7 + rnd() * 9;
      c.fillStyle = `rgb(${v * 0.95 | 0},${v | 0},${v * 0.8 | 0})`;
      c.save(); c.translate(x, y); c.rotate(rnd() * 6.283); c.beginPath(); c.ellipse(0, 0, w, w * 0.45, 0, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(-w, 0); c.lineTo(w, 0); c.stroke(); c.restore();
    }
  }, false),
  fir: () => make(256, (c, s) => {
    c.clearRect(0, 0, s, s);
    for (let b = 0; b < 15; b++) {
      const y0 = s * (0.06 + b * 0.06), len = s * (0.07 + b * 0.029);
      for (const dir of [-1, 1]) {
        for (let k = 0; k < 40; k++) {
          const t = k / 40, x = s / 2 + dir * t * len, y = y0 + t * s * 0.07 + (rnd() - 0.5) * 5;
          const v = 110 + rnd() * 140; c.strokeStyle = `rgb(${v * 0.85 | 0},${v | 0},${v * 0.8 | 0})`; c.lineWidth = 3.2;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * 5 + (rnd() - 0.5) * 6, y + 9 + rnd() * 9); c.stroke();
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * 3, y - 5 - rnd() * 5); c.stroke();
        }
      }
    }
    c.fillStyle = 'rgb(120,105,85)'; c.fillRect(s / 2 - 3, s * 0.08, 6, s * 0.9);
  }, false),
  grass: () => make(128, (c, s) => {
    c.clearRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const x = s * (0.08 + rnd() * 0.84), h = s * (0.35 + rnd() * 0.6), lean = (rnd() - 0.5) * s * 0.3, w = 2.5 + rnd() * 3.5, v = 150 + rnd() * 105;
      c.fillStyle = `rgb(${v * 0.9 | 0},${v | 0},${v * 0.62 | 0})`;
      c.beginPath(); c.moveTo(x - w, s); c.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h); c.quadraticCurveTo(x + lean * 0.4 + w, s - h * 0.5, x + w, s); c.fill();
    }
  }, false),
  bark: () => make(128, (c, s) => {
    c.fillStyle = '#b8b8b8'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { const v = 60 + rnd() * 150; c.fillStyle = `rgba(${v},${v},${v},0.5)`; c.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 8 + rnd() * 30); }
  }),
  cloud: () => make(256, (c, s) => {
    for (let i = 0; i < 16; i++) {
      const x = s * (0.22 + rnd() * 0.56), y = s * (0.38 + rnd() * 0.26), r = s * (0.12 + rnd() * 0.14);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
  }, false),
};
const NOMIP = { leaves: 1, fir: 1, grass: 1 };
export function tex(name) {
  if (!cache[name]) { const t = DEF[name](); if (NOMIP[name]) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } cache[name] = t; }
  return cache[name];
}
