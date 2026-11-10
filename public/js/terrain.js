// WIBA - Gelaende 1:1 aus echten Hoehendaten: Streaming-Kacheln mit Detailstufen, Graben, Seen
import * as THREE from 'three';
import { tex } from './tex.js';

export const M = { meta: null, heights: null, landuse: null, lakeid: null, pois: [], overview: null, tileSet: new Set(), air: null, ready: false };
export const TILE = 500, FC = 2.5; // Kachelgroesse, feines Raster (Graben)
let NX = 0, NZ = 0, CELL = 10, MINX = 0, MINZ = 0, HS = 10, FW = 0;
const edits = new Map(); // feiner Index -> absolute Hoehe
const editBuckets = new Set();
export const editListeners = [];

export async function loadWorld(onProgress) {
  const get = async (f, type) => {
    const r = await fetch('./world/' + f, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Kartendatei fehlt: ' + f);
    return type === 'json' ? r.json() : r.arrayBuffer();
  };
  onProgress && onProgress('Karte: Metadaten…');
  M.meta = await get('meta.json', 'json');
  const m = M.meta;
  NX = m.nx; NZ = m.nz; CELL = m.cell; MINX = m.minX; MINZ = m.minZ; HS = m.hscale; FW = (NX - 1) * (CELL / FC) + 1;
  onProgress && onProgress('Karte: Höhenmodell…');
  const [h, l, k, p] = await Promise.all([get('heights.bin'), get('landuse.bin'), get('lakeid.bin'), get('pois.json', 'json')]);
  M.heights = new Int16Array(h); M.landuse = new Uint8Array(l); M.lakeid = new Uint8Array(k); M.pois = p;
  M.tileSet = new Set(m.tiles);
  M.maxX = MINX + (NX - 1) * CELL; M.maxZ = MINZ + (NZ - 1) * CELL; M.minX = MINX; M.minZ = MINZ;
  onProgress && onProgress('Karte: Übersicht…');
  M.overview = await new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = './world/overview.png'; });
  M.ready = true;
}

// Erfundener Feldflugplatz (falls es im Gebiet keinen echten gibt): Streifen einebnen
export function applyAirfield(af) {
  M.air = af;
  if (!af || !af.made) return;
  const lv = Math.round(af.level * HS);
  const x0 = Math.min(af.x0, af.x1) - 40, x1 = Math.max(af.x0, af.x1) + 40, z0 = Math.min(af.z0, af.z1) - 70, z1 = Math.max(af.z0, af.z1) + 70;
  for (let j = Math.max(0, Math.floor((z0 - MINZ) / CELL)); j <= Math.min(NZ - 1, Math.ceil((z1 - MINZ) / CELL)); j++) {
    for (let i = Math.max(0, Math.floor((x0 - MINX) / CELL)); i <= Math.min(NX - 1, Math.ceil((x1 - MINX) / CELL)); i++) {
      const x = MINX + i * CELL, z = MINZ + j * CELL;
      const d = Math.max(x0 + 30 - x, x - (x1 - 30), z0 + 30 - z, z - (z1 - 30), 0) / 30;
      const c = i + j * NX;
      M.heights[c] = Math.round(lv + (M.heights[c] - lv) * Math.min(1, d));
      if (d === 0 && M.landuse[c] !== 4) M.landuse[c] = 0;
    }
  }
}

export function inWorld(x, z, pad = 0) { return x > MINX + pad && x < M.maxX - pad && z > MINZ + pad && z < M.maxZ - pad; }
function baseHeight(x, z) {
  let fx = (x - MINX) / CELL, fz = (z - MINZ) / CELL;
  if (fx < 0) fx = 0; else if (fx > NX - 1.001) fx = NX - 1.001;
  if (fz < 0) fz = 0; else if (fz > NZ - 1.001) fz = NZ - 1.001;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = ix + iz * NX, H = M.heights;
  return (H[i] * (1 - tx) * (1 - tz) + H[i + 1] * tx * (1 - tz) + H[i + NX] * (1 - tx) * tz + H[i + NX + 1] * tx * tz) / HS;
}
function fineH(fi, fj) {
  const e = edits.get(fi + fj * FW);
  return e !== undefined ? e : baseHeight(MINX + fi * FC, MINZ + fj * FC);
}
export function getHeight(x, z) {
  if (!editBuckets.size) return baseHeight(x, z);
  const gx = (x - MINX) / FC, gz = (z - MINZ) / FC;
  const fi = Math.floor(gx), fj = Math.floor(gz);
  if (!editBuckets.has((fi >> 3) + (fj >> 3) * 65536) && !editBuckets.has(((fi + 1) >> 3) + ((fj + 1) >> 3) * 65536)) return baseHeight(x, z);
  const tx = gx - fi, tz = gz - fj;
  return fineH(fi, fj) * (1 - tx) * (1 - tz) + fineH(fi + 1, fj) * tx * (1 - tz) + fineH(fi, fj + 1) * (1 - tx) * tz + fineH(fi + 1, fj + 1) * tx * tz;
}
export function landuseAt(x, z) {
  const i = Math.round((x - MINX) / CELL), j = Math.round((z - MINZ) / CELL);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return 0;
  return M.landuse[i + j * NX];
}
// Wasserspiegel eines Sees an dieser Stelle (oder -1e9)
export function waterLevelAt(x, z) {
  const i = Math.round((x - MINX) / CELL), j = Math.round((z - MINZ) / CELL);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1e9;
  const id = M.lakeid[i + j * NX];
  return id ? M.meta.lakes[id - 1].level : -1e9;
}
export function isProtected(x, z) {
  if (!inWorld(x, z, 20)) return true;
  const lu = landuseAt(x, z);
  if (lu === 3 || lu === 4) return true;
  const a = M.air;
  if (a && x > Math.min(a.x0, a.x1) - 60 && x < Math.max(a.x0, a.x1) + 60 && z > Math.min(a.z0, a.z1) - 80 && z < Math.max(a.z0, a.z1) + 80) return true;
  return false;
}
const LU_NAME = ['Wiese', 'Wald', 'Acker', 'Ortsgebiet', 'See', 'Fluss', 'Fels', 'Abbaugebiet', 'Gebüsch', 'Moor', 'Park'];
let places = null;
export function zoneName(x, z) {
  if (!places) places = M.pois.filter((p) => p.k === 'place' && p.r <= 4);
  let best = null, bd = 1e9;
  for (const p of places) {
    const lim = [1500, 1100, 600, 450, 280][p.r];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < lim && d / lim < bd) { bd = d / lim; best = p.n; }
  }
  const a = M.air;
  if (a && Math.abs(x - (a.x0 + a.x1) / 2) < Math.abs(a.x1 - a.x0) / 2 + 80 && Math.abs(z - (a.z0 + a.z1) / 2) < Math.abs(a.z1 - a.z0) / 2 + 90) return 'Flugplatz';
  const lu = landuseAt(x, z);
  if (lu === 4) return M.lakeid[Math.round((x - MINX) / CELL) + Math.round((z - MINZ) / CELL) * NX] === 1 ? 'Attersee' : 'See';
  if (best) return best;
  return LU_NAME[lu] || 'Wildnis';
}

// ---------- Graben ----------
const dirtyTiles = new Set();
export function setVertex(i, h) {
  const fi = i % FW, fj = Math.floor(i / FW);
  edits.set(i, h);
  for (let b = -1; b <= 0; b++) for (let a = -1; a <= 0; a++) editBuckets.add(((fi + a) >> 3) + ((fj + b) >> 3) * 65536);
  editBuckets.add((fi >> 3) + (fj >> 3) * 65536);
  const x = MINX + fi * FC, z = MINZ + fj * FC;
  for (const ox of [-FC, FC]) for (const oz of [-FC, FC]) dirtyTiles.add(Math.floor((x + ox) / TILE) + '_' + Math.floor((z + oz) / TILE));
  for (const fn of editListeners) fn(x, z);
}
export function applyEdits(list) { for (const e of list) setVertex(e[0], e[1]); }
export function sculpt(x, z, radius, amount) {
  const out = [];
  const ci = Math.round((x - MINX) / FC), cj = Math.round((z - MINZ) / FC), rr = Math.ceil(radius / FC);
  let moved = 0, depth = 0;
  for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) {
    const vx = MINX + i * FC, vz = MINZ + j * FC;
    const d = Math.hypot(vx - x, vz - z);
    if (d > radius || isProtected(vx, vz)) continue;
    const base = baseHeight(vx, vz), cur = fineH(i, j);
    let h = cur - amount * Math.max(0.4, 1 - d / radius);
    h = Math.round(Math.max(base - 16, Math.min(base + 12, h)) * 100) / 100;
    if (Math.abs(h - cur) < 0.01) continue;
    moved += Math.abs(h - cur); depth = Math.max(depth, base - h);
    out.push([i + j * FW, h]);
  }
  applyEdits(out);
  return { edits: out, moved, depth };
}
export function raycastTerrain(ox, oy, oz, dx, dy, dz, maxDist) {
  let t = 0, prev = 0;
  if (oy < getHeight(ox, oz)) return 0;
  while (t < maxDist) {
    const above = oy + dy * t - getHeight(ox + dx * t, oz + dz * t);
    if (above < 0) {
      let lo = prev, hi = t;
      for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (oy + dy * mid - getHeight(ox + dx * mid, oz + dz * mid) < 0) hi = mid; else lo = mid; }
      return hi;
    }
    prev = t;
    t += Math.max(0.6, Math.min(12, above * 0.4));
  }
  return -1;
}

// ---------- Farben ----------
function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ 91173;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const _c = [0, 0, 0];
function colorAt(x, z, h, slope, out) {
  const lu = landuseAt(x, z);
  const n = vnoise(x / 37, z / 37), n2 = vnoise(x / 190 + 7, z / 190 + 3);
  const elev = h + M.meta.yoff;
  let r, g, b;
  if (lu === 4) { const wl = waterLevelAt(x, z); const d = Math.min(1, Math.max(0, (wl - h) / 14)); r = 0.78 - 0.66 * d; g = 0.76 - 0.4 * d; b = 0.58 - 0.12 * d; }
  else if (lu === 5) { r = 0.3; g = 0.5; b = 0.62; }
  else if (slope > 1.05 || lu === 6) { const q = 0.82 + n * 0.3; r = 0.6 * q; g = 0.585 * q; b = 0.55 * q; }
  else if (elev > 1750 + n2 * 200) { const q = 0.85 + n * 0.25; r = 0.62 * q; g = 0.61 * q; b = 0.57 * q; }
  else if (lu === 1) { r = 0.2 + 0.07 * n; g = 0.34 + 0.08 * n; b = 0.15 + 0.03 * n; }
  else if (lu === 2) {
    const f = hash2(Math.floor(x / 70 + n2 * 2) + 900, Math.floor(z / 70 + n2 * 2) + 300);
    if (f < 0.25) { r = 0.74; g = 0.66; b = 0.34; } else if (f < 0.45) { r = 0.5; g = 0.62; b = 0.25; } else if (f < 0.58) { r = 0.56; g = 0.46; b = 0.3; } else { r = 0.4; g = 0.6; b = 0.26; }
    r += (n - 0.5) * 0.05; g += (n - 0.5) * 0.05;
  }
  else if (lu === 3) { r = 0.47 + 0.08 * n; g = 0.56 + 0.07 * n; b = 0.34 + 0.04 * n; }
  else if (lu === 7) { r = 0.62; g = 0.55; b = 0.44; }
  else if (lu === 8) { r = 0.3 + 0.08 * n; g = 0.45 + 0.08 * n; b = 0.2; }
  else if (lu === 9) { r = 0.36; g = 0.48; b = 0.3; }
  else if (lu === 10) { r = 0.36 + 0.06 * n; g = 0.62 + 0.06 * n; b = 0.26; }
  else { const k = Math.min(1, Math.max(0, (elev - 900) / 800)); r = 0.38 + 0.12 * n - 0.06 * k; g = 0.6 + 0.08 * n - 0.12 * k; b = 0.22 + 0.04 * n; }
  if (slope > 0.75 && lu !== 4) { const k = Math.min(1, (slope - 0.75) / 0.3); r += (0.56 - r) * k; g += (0.55 - g) * k; b += (0.52 - b) * k; }
  out[0] = r; out[1] = g; out[2] = b;
}
const DIRT = [0.43, 0.29, 0.17];

// ---------- Kachel-Meshes ----------
let scene = null, mat = null, coarse = null;
const tiles = new Map(); // key -> {lod, mesh}
const LODS = [{ step: 2.5, n: 200 }, { step: 10, n: 50 }, { step: 25, n: 20 }];
const idxCache = {};
function indexFor(n) {
  if (idxCache[n]) return idxCache[n];
  const s = n + 3, idx = [];
  for (let j = 0; j < s - 1; j++) for (let i = 0; i < s - 1; i++) { const a = i + j * s, b = a + 1, c = a + s, d = c + 1; idx.push(a, c, b, b, c, d); }
  return (idxCache[n] = n > 100 ? new Uint32Array(idx) : new Uint16Array(idx));
}
function buildTile(tx, tz, lod) {
  const { step, n } = LODS[lod], s = n + 3; // +2 Randreihen als Schuerze
  const pos = new Float32Array(s * s * 3), col = new Float32Array(s * s * 3), nor = new Float32Array(s * s * 3), uv = new Float32Array(s * s * 2);
  const x0 = tx * TILE, z0 = tz * TILE, e = lod === 0 ? FC : step;
  let k = 0, u = 0;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const ii = Math.min(n, Math.max(0, i - 1)), jj = Math.min(n, Math.max(0, j - 1));
    const skirt = i === 0 || j === 0 || i === s - 1 || j === s - 1;
    const x = x0 + ii * step, z = z0 + jj * step;
    const h = getHeight(x, z);
    const hx = getHeight(x - e, z) - getHeight(x + e, z), hz = getHeight(x, z - e) - getHeight(x, z + e);
    const nl = Math.hypot(hx, 2 * e, hz);
    pos[k] = x; pos[k + 1] = skirt ? h - (step * 3 + 6) : h; pos[k + 2] = z;
    nor[k] = hx / nl; nor[k + 1] = (2 * e) / nl; nor[k + 2] = hz / nl;
    const slope = Math.hypot(hx, hz) / (2 * e);
    if (lod === 0 && edits.has(Math.round((x - MINX) / FC) + Math.round((z - MINZ) / FC) * FW)) { col[k] = DIRT[0]; col[k + 1] = DIRT[1]; col[k + 2] = DIRT[2]; }
    else { colorAt(x, z, h, slope, _c); col[k] = _c[0]; col[k + 1] = _c[1]; col[k + 2] = _c[2]; }
    uv[u++] = x / 9; uv[u++] = z / 9;
    k += 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(indexFor(n), 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  return mesh;
}
const CS = 10; // grobes Fernmesh: jede 10. Zelle (100 m)
function buildCoarse() {
  const cw = Math.floor((NX - 1) / CS) + 1, chh = Math.floor((NZ - 1) / CS) + 1;
  const pos = new Float32Array(cw * chh * 3), col = new Float32Array(cw * chh * 3), nor = new Float32Array(cw * chh * 3), uv = new Float32Array(cw * chh * 2);
  let k = 0, u = 0;
  for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
    const x = MINX + i * CS * CELL, z = MINZ + j * CS * CELL, h = baseHeight(x, z), e = CS * CELL;
    const hx = baseHeight(x - e, z) - baseHeight(x + e, z), hz = baseHeight(x, z - e) - baseHeight(x, z + e), nl = Math.hypot(hx, 2 * e, hz);
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; nor[k] = hx / nl; nor[k + 1] = (2 * e) / nl; nor[k + 2] = hz / nl;
    colorAt(x, z, h, Math.hypot(hx, hz) / (2 * e), _c); col[k] = _c[0]; col[k + 1] = _c[1]; col[k + 2] = _c[2];
    uv[u++] = x / 9; uv[u++] = z / 9; k += 3;
  }
  const idx = new Uint32Array((cw - 1) * (chh - 1) * 6);
  let q = 0;
  for (let j = 0; j < chh - 1; j++) for (let i = 0; i < cw - 1; i++) { const a = i + j * cw, b = a + 1, c = a + cw, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  coarse = new THREE.Mesh(geo, mat); coarse.frustumCulled = false; coarse.matrixAutoUpdate = false;
  coarse.userData = { cw, chh, base: pos.slice() };
  scene.add(coarse);
}
function sinkCoarse(ctx, ctz, R) {
  const { cw, chh, base } = coarse.userData, pos = coarse.geometry.attributes.position.array;
  const x0 = (ctx - R + 1) * TILE - 60, x1 = (ctx + R) * TILE + 60, z0 = (ctz - R + 1) * TILE - 60, z1 = (ctz + R) * TILE + 60;
  for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
    const k = (i + j * cw) * 3, x = base[k], z = base[k + 2];
    pos[k + 1] = base[k + 1] - (x > x0 && x < x1 && z > z0 && z < z1 ? 90 : 0);
  }
  coarse.geometry.attributes.position.needsUpdate = true;
}

export const R = { l0: 1, l1: 4, l2: 9 };
export function initTerrain(sc, lowGfx) {
  scene = sc;
  if (lowGfx) { R.l0 = 0; R.l1 = 3; R.l2 = 6; }
  mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('ground') });
  buildCoarse();
}
let lastKey = '', queue = [];
function wantLod(d) { return d <= R.l0 ? 0 : (d <= R.l1 ? 1 : (d <= R.l2 ? 2 : -1)); }
// Streaming: pro Aufruf nur wenige Kacheln bauen. Liefert true, solange noch Arbeit ansteht.
export function updateTerrain(cx, cz, budgetMs = 5) {
  const ctx = Math.floor(cx / TILE), ctz = Math.floor(cz / TILE), key = ctx + '_' + ctz;
  if (key !== lastKey) {
    lastKey = key;
    for (const [k, t] of tiles) {
      const d = Math.max(Math.abs(t.tx - ctx), Math.abs(t.tz - ctz));
      if (d > R.l2 + 1) { scene.remove(t.mesh); t.mesh.geometry.dispose(); tiles.delete(k); }
    }
    queue = [];
    for (let dz = -R.l2; dz <= R.l2; dz++) for (let dx = -R.l2; dx <= R.l2; dx++) {
      const tx = ctx + dx, tz = ctz + dz, d = Math.max(Math.abs(dx), Math.abs(dz));
      if ((tx + 1) * TILE < MINX || tx * TILE > M.maxX || (tz + 1) * TILE < MINZ || tz * TILE > M.maxZ) continue;
      const t = tiles.get(tx + '_' + tz), lod = wantLod(d);
      if (!t || t.lod !== lod) queue.push({ tx, tz, lod, d });
    }
    queue.sort((a, b) => b.d - a.d);
    sinkCoarse(ctx, ctz, R.l2);
  }
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budgetMs) {
    const q = queue.pop(), k = q.tx + '_' + q.tz, old = tiles.get(k);
    const mesh = buildTile(q.tx, q.tz, q.lod);
    scene.add(mesh);
    if (old) { scene.remove(old.mesh); old.mesh.geometry.dispose(); }
    tiles.set(k, { tx: q.tx, tz: q.tz, lod: q.lod, mesh });
  }
  return queue.length > 0;
}
export function flushTerrain() {
  if (!dirtyTiles.size) return;
  for (const k of dirtyTiles) {
    const t = tiles.get(k);
    if (!t || t.lod !== 0) continue;
    const mesh = buildTile(t.tx, t.tz, 0);
    scene.add(mesh); scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh = mesh;
  }
  dirtyTiles.clear();
}

// Seeflaechen als Rechteck-Streifen (pro Rasterzeile zusammengefasst)
export function lakeGeometries() {
  const out = [];
  const P = M.meta.lakes.map(() => []);
  for (let j = 0; j < NZ; j++) {
    let run = 0, start = 0;
    for (let i = 0; i <= NX; i++) {
      const id = i < NX ? M.lakeid[i + j * NX] : 0;
      if (id !== run) {
        if (run) { const y = M.meta.lakes[run - 1].level, x0 = MINX + (start - 1.5) * CELL, x1 = MINX + (i + 0.5) * CELL, z0 = MINZ + (j - 0.5) * CELL, z1 = MINZ + (j + 0.5) * CELL; P[run - 1].push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); }
        run = id; start = i;
      }
    }
  }
  for (const p of P) {
    if (!p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    out.push(g);
  }
  return out;
}
