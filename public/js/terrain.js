// WIBA - Gelaende: Hoehenkarte, Chunks, Graben/Auffuellen
import * as THREE from 'three';
import { CELL, GRID, HALF, ZONES } from './config.js';

const V = GRID + 1;
const CH = 32;
const NCH = GRID / CH;
const SEED = 91173;

export const heights = new Float32Array(V * V);
export const baseHeights = new Float32Array(V * V);
const dug = new Uint8Array(V * V);
const chunks = [];
const dirty = new Set();
export const editListeners = [];

function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; }
  return s / 0.9375;
}
function sstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

function genHeight(x, z) {
  const n = fbm(x / 170 + 31.7, z / 170 + 12.3);
  let h = 5 + (n - 0.42) * 58;
  h += 52 * Math.exp(-((x + 250) * (x + 250) + (z - 240) * (z - 240)) / (2 * 85 * 85));
  h += 2.2 * (vnoise(x / 23, z / 23) - 0.5);
  if (h < 1.4) h = 1.4 + (h - 1.4) * 0.15;
  const dEdge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
  const fall = sstep(0.8, 1.0, dEdge);
  h = h + (-14 - h) * fall;
  for (const zn of ZONES) {
    const wx = 1 - sstep(zn.rx, zn.rx + zn.blend, Math.abs(x - zn.x));
    const wz = 1 - sstep(zn.rz, zn.rz + zn.blend, Math.abs(z - zn.z));
    const w = wx * wz;
    if (w > 0) h = h + (zn.h - h) * w;
  }
  return h;
}

export function vertexX(i) { return ((i % V) - GRID / 2) * CELL; }
export function vertexZ(i) { return (Math.floor(i / V) - GRID / 2) * CELL; }

function zoneAt(x, z, pad) {
  for (const zn of ZONES) {
    if (Math.abs(x - zn.x) <= zn.rx + pad && Math.abs(z - zn.z) <= zn.rz + pad) return zn;
  }
  return null;
}
export function zoneName(x, z) {
  const zn = zoneAt(x, z, 0);
  if (zn) return zn.name;
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 'Offenes Meer';
  if ((x + 250) * (x + 250) + (z - 240) * (z - 240) < 130 * 130) return 'Faulenzer-Kogel';
  return 'Wildnis';
}
export function isProtected(x, z) {
  if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) return true;
  const zn = zoneAt(x, z, 6);
  return !!(zn && zn.protect);
}

const _c = [0, 0, 0];
export function vertexColor(i, out) {
  const h = heights[i];
  const x = vertexX(i), z = vertexZ(i);
  const n = hash2(i % V, Math.floor(i / V));
  let r, g, b;
  if (dug[i]) {
    const d = Math.min(1, Math.max(0, (baseHeights[i] - h) / 9));
    r = 0.43 - 0.2 * d; g = 0.29 - 0.13 * d; b = 0.17 - 0.07 * d;
    if (h > baseHeights[i]) { r = 0.52; g = 0.4; b = 0.25; }
  } else {
    const gi = i % V, gj = Math.floor(i / V);
    let slope = 0;
    if (gi > 0 && gi < GRID && gj > 0 && gj < GRID) {
      slope = Math.max(Math.abs(heights[i + 1] - heights[i - 1]), Math.abs(heights[i + V] - heights[i - V])) / (2 * CELL);
    }
    const zn = zoneAt(x, z, 4);
    if (h < 1.2) { r = 0.88; g = 0.8; b = 0.55; }
    else if (h > 46) { r = 0.95; g = 0.96; b = 1.0; }
    else if (h > 35 || slope > 0.95) { r = 0.52; g = 0.5; b = 0.48; }
    else if (zn && zn.name === 'Baustelle') { r = 0.66; g = 0.54; b = 0.36; }
    else {
      const t = fbm(x / 60 + 5, z / 60 + 9);
      r = 0.33 + 0.16 * t; g = 0.6 + 0.12 * t; b = 0.22 + 0.06 * t;
    }
  }
  const v = 0.94 + n * 0.12;
  out[0] = r * v; out[1] = g * v; out[2] = b * v;
  return out;
}

function buildChunk(ch) {
  const pos = ch.geo.attributes.position.array;
  const col = ch.geo.attributes.color.array;
  let k = 0;
  for (let j = 0; j <= CH; j++) {
    for (let i = 0; i <= CH; i++) {
      const gi = ch.cx * CH + i, gj = ch.cz * CH + j;
      const idx = gi + gj * V;
      pos[k] = (gi - GRID / 2) * CELL;
      pos[k + 1] = heights[idx];
      pos[k + 2] = (gj - GRID / 2) * CELL;
      vertexColor(idx, _c);
      col[k] = _c[0]; col[k + 1] = _c[1]; col[k + 2] = _c[2];
      k += 3;
    }
  }
  ch.geo.attributes.position.needsUpdate = true;
  ch.geo.attributes.color.needsUpdate = true;
  ch.geo.computeBoundingSphere();
  ch.geo.computeBoundingBox();
}

export function initTerrain(scene) {
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const h = genHeight((i - GRID / 2) * CELL, (j - GRID / 2) * CELL);
      heights[i + j * V] = h; baseHeights[i + j * V] = h;
    }
  }
  const n = CH + 1;
  const index = [];
  for (let j = 0; j < CH; j++) {
    for (let i = 0; i < CH; i++) {
      const a = i + j * n, b = i + 1 + j * n, c = i + (j + 1) * n, d = i + 1 + (j + 1) * n;
      index.push(a, c, b, b, c, d);
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (let cz = 0; cz < NCH; cz++) {
    for (let cx = 0; cx < NCH; cx++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      geo.setIndex(index);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      const ch = { cx, cz, geo, mesh };
      buildChunk(ch);
      chunks.push(ch);
      scene.add(mesh);
    }
  }
}

export function getHeight(x, z) {
  const fx = x / CELL + GRID / 2, fz = z / CELL + GRID / 2;
  if (fx < 0 || fz < 0 || fx >= GRID || fz >= GRID) return -14;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const i = ix + iz * V;
  const h00 = heights[i], h10 = heights[i + 1], h01 = heights[i + V], h11 = heights[i + V + 1];
  if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}

function markDirty(i) {
  const gi = i % V, gj = Math.floor(i / V);
  const cx0 = Math.max(0, Math.floor((gi - 1) / CH)), cx1 = Math.min(NCH - 1, Math.floor(gi / CH));
  const cz0 = Math.max(0, Math.floor((gj - 1) / CH)), cz1 = Math.min(NCH - 1, Math.floor(gj / CH));
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) dirty.add(cx + cz * NCH);
}

export function setVertex(i, h) {
  if (i < 0 || i >= V * V) return;
  heights[i] = h;
  dug[i] = 1;
  markDirty(i);
  for (const fn of editListeners) fn(i);
}
export function applyEdits(list) {
  for (const e of list) setVertex(e[0], e[1]);
}
export function flushTerrain() {
  if (!dirty.size) return;
  for (const k of dirty) buildChunk(chunks[k]);
  dirty.clear();
}

// Senkt (amount>0) oder hebt (amount<0) das Gelaende rund um (x,z). Liefert die Aenderungen.
export function sculpt(x, z, radius, amount) {
  const edits = [];
  const ci = Math.round(x / CELL + GRID / 2), cj = Math.round(z / CELL + GRID / 2);
  const rr = Math.ceil(radius / CELL);
  let moved = 0, depth = 0;
  for (let j = cj - rr; j <= cj + rr; j++) {
    for (let i = ci - rr; i <= ci + rr; i++) {
      if (i < 1 || j < 1 || i >= GRID || j >= GRID) continue;
      const idx = i + j * V;
      const vx = (i - GRID / 2) * CELL, vz = (j - GRID / 2) * CELL;
      const d = Math.hypot(vx - x, vz - z);
      if (d > radius || isProtected(vx, vz)) continue;
      const f = Math.max(0.4, 1 - d / radius);
      let h = heights[idx] - amount * f;
      h = Math.max(baseHeights[idx] - 16, Math.min(baseHeights[idx] + 12, h));
      h = Math.round(h * 100) / 100;
      if (Math.abs(h - heights[idx]) < 0.01) continue;
      moved += Math.abs(h - heights[idx]);
      depth = Math.max(depth, baseHeights[idx] - h);
      edits.push([idx, h]);
    }
  }
  applyEdits(edits);
  return { edits, moved, depth };
}

// Strahl gegen Gelaende. Liefert Distanz oder -1.
export function raycastTerrain(ox, oy, oz, dx, dy, dz, maxDist) {
  let t = 0, prev = 0;
  if (oy < getHeight(ox, oz)) return 0;
  while (t < maxDist) {
    const above = oy + dy * t - getHeight(ox + dx * t, oz + dz * t);
    if (above < 0) {
      let lo = prev, hi = t;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        if (oy + dy * mid - getHeight(ox + dx * mid, oz + dz * mid) < 0) hi = mid; else lo = mid;
      }
      return hi;
    }
    prev = t;
    t += Math.max(0.6, Math.min(6, above * 0.4));
  }
  return -1;
}

export function minimapImage(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const c = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gi = Math.min(GRID, Math.floor((x / size) * GRID)), gj = Math.min(GRID, Math.floor((y / size) * GRID));
      const idx = gi + gj * V;
      const k = (x + y * size) * 4;
      if (heights[idx] < 0) { img.data[k] = 60; img.data[k + 1] = 140; img.data[k + 2] = 200; }
      else {
        vertexColor(idx, c);
        const sh = 0.8 + Math.min(0.5, heights[idx] / 90);
        img.data[k] = Math.min(255, c[0] * 255 * sh); img.data[k + 1] = Math.min(255, c[1] * 255 * sh); img.data[k + 2] = Math.min(255, c[2] * 255 * sh);
      }
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
