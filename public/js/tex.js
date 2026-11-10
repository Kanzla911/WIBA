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
  cloud: () => make(256, (c, s) => {
    for (let i = 0; i < 16; i++) {
      const x = s * (0.22 + rnd() * 0.56), y = s * (0.38 + rnd() * 0.26), r = s * (0.12 + rnd() * 0.14);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
  }, false),
};
export function tex(name) { if (!cache[name]) cache[name] = DEF[name](); return cache[name]; }
