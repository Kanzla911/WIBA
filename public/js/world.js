// WIBA - Welt: Himmel, Licht, Wasser, Dorf, Flugplatz, Baustelle, Baeume, Kollisionsboxen
import * as THREE from 'three';
import { M, TILE, getHeight, landuseAt, waterLevelAt, lakeGeometries } from './terrain.js';
import { tex } from './tex.js';

export const boxes = []; // {x0,y0,z0,x1,y1,z1, sid?}
export const pois = []; // {x,y,z,kind,label}
export const npcSpots = []; // {x,z,r,n,kind}
export let sun = null, hemi = null, water = null;
const clouds = [];
let cloudMat = null, sky = null, sunDisc = null, stars = null;
const lampMat = new THREE.MeshBasicMaterial({ color: 0x888877, fog: false });
let sceneRef = null;
const matCache = new Map();

export function lam(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
    matCache.set(key, m);
  }
  return m;
}
export function texMat(color, name, opts) {
  const key = 't' + color + name;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color, map: tex(name) }, opts || {})); matCache.set(key, m); }
  return m;
}
function gableRoof(w, d, rh, over, color) {
  const X = w / 2 + over, Z = d / 2 + over, sl = Math.hypot(Z, rh);
  const P = [], U = [];
  const quad = (a, b, c, e, ua, ub, uc, ue) => { P.push(...a, ...b, ...c, ...a, ...c, ...e); U.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ue); };
  quad([-X, 0, Z], [X, 0, Z], [X, rh, 0], [-X, rh, 0], [0, 0], [X / 1.6, 0], [X / 1.6, sl / 1.6], [0, sl / 1.6]);
  quad([X, 0, -Z], [-X, 0, -Z], [-X, rh, 0], [X, rh, 0], [0, 0], [X / 1.6, 0], [X / 1.6, sl / 1.6], [0, sl / 1.6]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, texMat(color, 'roof', { side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function gableWall(w, d, rh, color) {
  const x = w / 2, z = d / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, z, x, 0, -z, x, rh, 0, -x, 0, -z, -x, 0, z, -x, rh, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0.2, 1, 0.2, 0.5, 0.7, 0, 0.2, 1, 0.2, 0.5, 0.7], 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, texMat(color, 'plaster', { side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}
export function mkBox(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function textTexture(text, opts = {}) {
  const fs = opts.size || 48;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `bold ${fs}px "Trebuchet MS", Arial, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + fs;
  cv.width = w; cv.height = Math.ceil(fs * 1.5);
  ctx.font = `bold ${fs}px "Trebuchet MS", Arial, sans-serif`;
  if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs / 6; ctx.strokeStyle = opts.stroke || 'rgba(0,0,0,0.85)';
  if (!opts.bg) ctx.strokeText(text, cv.width / 2, cv.height / 2);
  ctx.fillStyle = opts.color || '#fff';
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { aspect: cv.width / cv.height };
  return tex;
}
export function textSprite(text, height = 0.5, opts) {
  const tex = textTexture(text, opts);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sp.scale.set(height * tex.userData.aspect, height, 1);
  return sp;
}
function sign(text, height, x, y, z, ry, opts) {
  const tex = textTexture(text, Object.assign({ bg: '#f4e9c8', color: '#3a2a1a' }, opts || {}));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(height * tex.userData.aspect, height),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry || 0;
  sceneRef.add(m);
  return m;
}

export function addBox(b) { boxes.push(b); return b; }
export function removeBox(b) { const i = boxes.indexOf(b); if (i >= 0) boxes.splice(i, 1); }
function solid(x, y, z, w, h, d) {
  return addBox({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
}

// Strahl gegen alle Boxen: liefert {t, box} oder null
export function rayBoxes(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null, bt = maxDist;
  for (const b of boxes) {
    let t0 = 0, t1 = bt;
    // X
    if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
    else {
      let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
    }
    if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; }
    else {
      let a = (b.y0 - oy) / dy, c = (b.y1 - oy) / dy; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
    else {
      let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
    }
    if (t0 < bt) { bt = t0; best = b; }
  }
  const tp = rayPolys(ox, oy, oz, dx, dy, dz, bt);
  if (tp >= 0) return { t: tp, box: { poly: true } };
  return best ? { t: bt, box: best } : null;
}
export function pointInBoxes(x, y, z, pad = 0) {
  const pp = polyAt(x, z, pad);
  if (pp && y < pp.top + pad && y > pp.base - pad) return pp;
  for (const b of boxes) {
    if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y > b.y0 - pad && y < b.y1 + pad) return b;
  }
  return null;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ 7919;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------- Kollision: Gebaeude-Grundrisse + Bruecken ----------
const HC = 40;
const polyHash = new Map(), deckHash = new Map();
const hkey = (cx, cz) => (cx + 50000) * 100003 + (cz + 50000);
function hashAdd(map, o, x0, z0, x1, z1) {
  for (let cz = Math.floor(z0 / HC); cz <= Math.floor(z1 / HC); cz++) for (let cx = Math.floor(x0 / HC); cx <= Math.floor(x1 / HC); cx++) {
    const k = hkey(cx, cz); let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(o);
  }
}
function hashRemove(map, o, x0, z0, x1, z1) {
  for (let cz = Math.floor(z0 / HC); cz <= Math.floor(z1 / HC); cz++) for (let cx = Math.floor(x0 / HC); cx <= Math.floor(x1 / HC); cx++) {
    const k = hkey(cx, cz), a = map.get(k); if (!a) continue;
    const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); if (!a.length) map.delete(k);
  }
}
// Gebaeude an (x,z) im Umkreis r - liefert {top, base} oder null
export function polyAt(x, z, r = 0) {
  const list = polyHash.get(hkey(Math.floor(x / HC), Math.floor(z / HC)));
  if (!list) return null;
  for (const p of list) {
    if (x < p.x0 - r || x > p.x1 + r || z < p.z0 - r || z > p.z1 + r) continue;
    const q = p.pts, n = q.length;
    let inside = false, near = false;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const ax = q[j], az = q[j + 1], bx = q[i], bz = q[i + 1];
      if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
      if (r > 0 && !near) {
        const ex = bx - ax, ez = bz - az; let t = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1); t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const dx = ax + ex * t - x, dz = az + ez * t - z; if (dx * dx + dz * dz < r * r) near = true;
      }
    }
    if (inside || near) return p;
  }
  return null;
}
function rayPolys(ox, oy, oz, dx, dy, dz, maxDist) {
  if (!polyHash.size) return -1;
  for (let t = 0.6; t < maxDist; t += 1.1) {
    const y = oy + dy * t, p = polyAt(ox + dx * t, oz + dz * t, 0);
    if (p && y < p.top && y > p.base) {
      let lo = Math.max(0, t - 1.1), hi = t;
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2, q = polyAt(ox + dx * m, oz + dz * m, 0); if (q && oy + dy * m < q.top) hi = m; else lo = m; }
      return hi;
    }
  }
  return -1;
}
function deckAt(x, z) {
  const list = deckHash.get(hkey(Math.floor(x / HC), Math.floor(z / HC)));
  if (!list) return -1e9;
  let best = -1e9;
  for (const s of list) {
    const ex = s.bx - s.ax, ez = s.bz - s.az; const t = ((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez || 1);
    if (t < -0.02 || t > 1.02) continue;
    const px = s.ax + ex * t - x, pz = s.az + ez * t - z;
    if (px * px + pz * pz > s.hw * s.hw) continue;
    const y = s.ya + (s.yb - s.ya) * t; if (y > best) best = y;
  }
  return best;
}
// Begehbare Oberflaeche: Gelaende oder Brueckendeck (wenn man nicht darunter steht)
export function surfaceAt(x, z, refY) {
  const g = getHeight(x, z);
  if (!deckHash.size) return g;
  const d = deckAt(x, z);
  return d > g && refY > d - 2.6 ? d : g;
}

// ---------- Geometrie-Sammler ----------
function Buf() { return { p: [], n: [], c: [], u: [] }; }
function tri(B, a, b, c, col, ua, ub, uc, up) {
  let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  if (up && ny < 0) { nx = -nx; ny = -ny; nz = -nz; const tb = b; b = c; c = tb; const tu = ub; ub = uc; uc = tu; }
  B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  B.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  B.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
  B.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
}
function quad(B, a, b, c, d, col, u0, v0, u1, v1, up) {
  tri(B, a, b, c, col, [u0, v0], [u1, v0], [u1, v1], up); tri(B, a, c, d, col, [u0, v0], [u1, v1], [u0, v1], up);
}
function meshOf(B, material, shadow) {
  if (!B.p.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
  if (B.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
  const m = new THREE.Mesh(g, material);
  m.castShadow = !!shadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
  return m;
}

// ---------- Gebaeude ----------
const wallMatG = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('facadeG'), emissiveMap: tex('facadeGGlow'), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('facade'), emissiveMap: tex('facadeGlow'), emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex('roof'), side: THREE.DoubleSide });
const WALLS = [[0.97, 0.95, 0.9], [0.96, 0.9, 0.78], [0.93, 0.86, 0.8], [0.88, 0.92, 0.86], [0.98, 0.97, 0.95], [0.9, 0.9, 0.94], [0.95, 0.84, 0.76], [0.99, 0.94, 0.82]];
const ROOFS = [[0.86, 0.4, 0.3], [0.78, 0.36, 0.28], [0.66, 0.44, 0.36], [0.5, 0.52, 0.56], [0.72, 0.3, 0.25]];
const GREY = [0.62, 0.63, 0.65], WOOD = [0.52, 0.38, 0.25], PLAIN = [0.03, 0.03];
function defHeight(kind, area) {
  if (kind === 5) return area < 45 ? 2.8 : 5;
  if (kind === 1) return 11.5; if (kind === 2) return 7; if (kind === 3) return 8; if (kind === 4) return area < 60 ? 5 : 12; if (kind === 6) return 10;
  return area < 30 ? 2.8 : (area > 400 ? 8 : 6.2);
}
function addBuilding(b, ox, oz, W, Rf, polys) {
  const kind = b[3], P = [];
  for (let i = 5; i < b.length; i += 2) {
    const x = ox + b[i] / 10, z = oz + b[i + 1] / 10, l = P[P.length - 1];
    if (!l || Math.abs(l[0] - x) + Math.abs(l[1] - z) > 0.05) P.push([x, z]);
  }
  if (P.length > 2 && Math.abs(P[0][0] - P[P.length - 1][0]) + Math.abs(P[0][1] - P[P.length - 1][1]) < 0.05) P.pop();
  const n = P.length; if (n < 3) return;
  let area = 0, cx = 0, cz = 0, x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, base = 1e9, maxg = -1e9;
  for (let i = 0; i < n; i++) {
    const a = P[i], c = P[(i + 1) % n]; area += a[0] * c[1] - c[0] * a[1]; cx += a[0]; cz += a[1];
    if (a[0] < x0) x0 = a[0]; if (a[0] > x1) x1 = a[0]; if (a[1] < z0) z0 = a[1]; if (a[1] > z1) z1 = a[1];
    const g = getHeight(a[0], a[1]); if (g < base) base = g; if (g > maxg) maxg = g;
  }
  area = Math.abs(area / 2); cx /= n; cz /= n;
  if (area < 5) return;
  let h = b[0] / 10 || (b[1] ? b[1] * 3 + 0.4 : defHeight(kind, area));
  h = Math.max(2.4, Math.min(60, h)) + Math.min(3, maxg - base);
  const top = base + h, hs = hash2(Math.round(P[0][0] * 3), Math.round(P[0][1] * 3));
  const small = kind === 5 || area < 32;
  const wcol = small && kind === 5 ? WOOD : (kind === 3 ? GREY : WALLS[Math.floor(hs * WALLS.length)]);
  let rcol = ROOFS[Math.floor(hs * 97 % 1 * ROOFS.length)];
  const floors = Math.max(1, Math.round(h / 3));
  for (let i = 0; i < n; i++) {
    const a = P[i], c = P[(i + 1) % n], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 0.05) continue;
    const bays = small ? 0 : Math.max(1, Math.round(len / 3.4));
    if (small) quad(W, [a[0], base - 2, a[1]], [c[0], base - 2, c[1]], [c[0], top, c[1]], [a[0], top, a[1]], wcol, PLAIN[0], PLAIN[1], PLAIN[0], PLAIN[1]);
    else {
      // Erdgeschoss (Tueren/Auslagen) getrennt von den Obergeschossen
      const gh = h / floors, vr = hs > 0.5 ? 0.5 : 0, ub = Math.max(1, Math.round(bays / 2));
      quad(W.g, [a[0], base - 2, a[1]], [c[0], base - 2, c[1]], [c[0], base + gh, c[1]], [a[0], base + gh, a[1]], wcol, 0, vr, ub, vr + 0.5);
      if (floors > 1) quad(W, [a[0], base + gh, a[1]], [c[0], base + gh, c[1]], [c[0], top, c[1]], [a[0], top, a[1]], wcol, 0, 0, bays, floors - 1);
    }
  }
  let rf = b[2];
  if (!rf) rf = (kind === 2 || kind === 3) && area > 220 ? 3 : (n === 4 ? 1 : (area > 900 ? 3 : 2));
  if (rf === 1 && n !== 4) rf = 2;
  if (rf === 4) rf = 2;
  let rh = 0;
  if (rf === 3) {
    rcol = GREY;
    try {
      const idx = THREE.ShapeUtils.triangulateShape(P.map((q) => new THREE.Vector2(q[0], q[1])), []);
      for (const t of idx) tri(Rf, [P[t[0]][0], top, P[t[0]][1]], [P[t[1]][0], top, P[t[1]][1]], [P[t[2]][0], top, P[t[2]][1]], rcol, PLAIN, PLAIN, PLAIN, true);
    } catch (e) { /* kaputter Grundriss */ }
  } else if (rf === 1) {
    const e0 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), e1 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
    const o = e0 >= e1 ? 0 : 1, q = (i) => P[(i + o) % 4];
    const short = Math.min(e0, e1), long = Math.max(e0, e1);
    rh = Math.min(4.8, short * 0.42);
    const m1 = [(q(1)[0] + q(2)[0]) / 2, top + rh, (q(1)[1] + q(2)[1]) / 2], m3 = [(q(3)[0] + q(0)[0]) / 2, top + rh, (q(3)[1] + q(0)[1]) / 2];
    const V = (i) => [q(i)[0], top - 0.05, q(i)[1]], sl = Math.hypot(short / 2, rh) / 1.6, ul = long / 1.6;
    quad(Rf, V(0), V(1), m1, m3, rcol, 0, 0, ul, sl, true); quad(Rf, V(2), V(3), m3, m1, rcol, 0, 0, ul, sl, true);
    tri(W, V(1), V(2), m1, wcol, PLAIN, PLAIN, PLAIN); tri(W, V(3), V(0), m3, wcol, PLAIN, PLAIN, PLAIN);
  } else {
    rh = Math.min(3.6, Math.sqrt(area) * 0.22);
    const Q = P.map((p) => [cx + (p[0] - cx) * 0.38, cz + (p[1] - cz) * 0.38]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, len = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) / 1.6;
      quad(Rf, [P[i][0], top - 0.05, P[i][1]], [P[j][0], top - 0.05, P[j][1]], [Q[j][0], top + rh, Q[j][1]], [Q[i][0], top + rh, Q[i][1]], rcol, 0, 0, len, 1.6, true);
    }
    try {
      const idx = THREE.ShapeUtils.triangulateShape(Q.map((p) => new THREE.Vector2(p[0], p[1])), []);
      for (const t of idx) tri(Rf, [Q[t[0]][0], top + rh, Q[t[0]][1]], [Q[t[1]][0], top + rh, Q[t[1]][1]], [Q[t[2]][0], top + rh, Q[t[2]][1]], rcol, PLAIN, PLAIN, PLAIN, true);
    } catch (e) { /* */ }
  }
  if (kind === 4 && area > 120) { // Kirchturm
    const tx = P[0][0] + (cx - P[0][0]) * 0.35, tz = P[0][1] + (cz - P[0][1]) * 0.35, s = 2.6, th = top + Math.max(12, h * 0.9);
    const c4 = [[tx - s, tz - s], [tx + s, tz - s], [tx + s, tz + s], [tx - s, tz + s]];
    for (let i = 0; i < 4; i++) { const a = c4[i], c = c4[(i + 1) % 4]; quad(W, [a[0], base, a[1]], [c[0], base, c[1]], [c[0], th, c[1]], [a[0], th, a[1]], WALLS[4], PLAIN[0], PLAIN[1], PLAIN[0], PLAIN[1]); tri(Rf, [a[0], th, a[1]], [c[0], th, c[1]], [tx, th + 9, tz], [0.25, 0.38, 0.33], PLAIN, PLAIN, PLAIN, true); }
  }
  const pts = []; for (const p of P) pts.push(p[0], p[1]);
  const poly = { pts, x0, z0, x1, z1, base: base - 2.5, top: top + rh * 0.5 };
  polys.push(poly); hashAdd(polyHash, poly, x0 - 2, z0 - 2, x1 + 2, z1 + 2);
}

// ---------- Strassen, Bahn, Wasserlaeufe ----------
const roadMats = {
  asphalt: new THREE.MeshLambertMaterial({ color: 0x6b6d75, map: tex('asphalt'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  gravel: new THREE.MeshLambertMaterial({ color: 0xb7a98a, map: tex('asphalt'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  paving: new THREE.MeshLambertMaterial({ color: 0xcbbfa6, map: tex('asphalt'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  rail: new THREE.MeshLambertMaterial({ color: 0x7c7468, map: tex('asphalt'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  walk: new THREE.MeshLambertMaterial({ color: 0xc9c5bb, map: tex('asphalt'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  line: new THREE.MeshLambertMaterial({ color: 0xf2f2f2, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  steel: new THREE.MeshLambertMaterial({ color: 0x33343a, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  water: new THREE.MeshLambertMaterial({ color: 0x3d8fb3, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
};
function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s < k; s++) out.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// Band entlang einer Linie; yfn(x, z, t) liefert die Hoehe
function strip(B, pts, w, off, yfn, lift) {
  let len = 0; const total = [0];
  for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); total.push(len); }
  let pl = null, pr = null, pv = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const cx = pts[i][0] + dz * off, cz = pts[i][1] - dx * off, t = len ? total[i] / len : 0;
    const lx = cx - dz * w / 2, lz = cz + dx * w / 2, rx = cx + dz * w / 2, rz = cz - dx * w / 2;
    const L = [lx, yfn(lx, lz, t) + lift, lz], Rr = [rx, yfn(rx, rz, t) + lift, rz], v = total[i] / 5;
    if (pl) {
      B.p.push(pl[0], pl[1], pl[2], L[0], L[1], L[2], pr[0], pr[1], pr[2], pr[0], pr[1], pr[2], L[0], L[1], L[2], Rr[0], Rr[1], Rr[2]);
      for (let q = 0; q < 6; q++) B.n.push(0, 1, 0);
      B.u.push(0, pv, 0, v, w / 5, pv, w / 5, pv, 0, v, w / 5, v);
    }
    pl = L; pr = Rr; pv = v;
  }
}
const lampGeo = (() => {
  const pole = new THREE.CylinderGeometry(0.06, 0.09, 6.2, 8).translate(0, 3.1, 0).toNonIndexed();
  const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6).rotateX(Math.PI / 2).translate(0, 6.15, 0.7).toNonIndexed();
  const P = [...pole.attributes.position.array, ...arm.attributes.position.array], N = [...pole.attributes.normal.array, ...arm.attributes.normal.array];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return { pole: g, poleMat: new THREE.MeshLambertMaterial({ color: 0x4a4e55 }), bulb: new THREE.SphereGeometry(0.2, 10, 8).scale(1.3, 0.55, 1.9).translate(0, 6.08, 1.35) };
})();
const RGROUP = ['asphalt', 'asphalt', 'asphalt', 'asphalt', 'asphalt', 'asphalt', 'asphalt', 'gravel', 'paving', 'rail', 'asphalt', 'asphalt'];
function addRoad(r, ox, oz, G, T) {
  const cls = r[0], w = r[1] / 10, bridge = r[2];
  const raw = []; for (let i = 3; i < r.length; i += 2) raw.push([ox + r[i] / 10, oz + r[i + 1] / 10]);
  if (raw.length < 2) return;
  const pts = densify(raw, cls === 9 ? 8 : 5);
  let yfn = (x, z) => getHeight(x, z), lift = cls === 7 ? 0.12 : 0.2;
  if (bridge) {
    const a = raw[0], b = raw[raw.length - 1];
    const ya = getHeight(a[0], a[1]) + 0.4, yb = getHeight(b[0], b[1]) + 0.4;
    yfn = (x, z, t) => ya + (yb - ya) * t; lift = 0;
    let len = 0; for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    let acc = 0;
    for (let i = 1; i < raw.length; i++) {
      const p = raw[i - 1], q = raw[i], sl = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const s = { ax: p[0], az: p[1], bx: q[0], bz: q[1], ya: ya + (yb - ya) * (acc / len), yb: ya + (yb - ya) * ((acc + sl) / len), hw: w / 2 + 0.6, x0: Math.min(p[0], q[0]) - w, z0: Math.min(p[1], q[1]) - w, x1: Math.max(p[0], q[0]) + w, z1: Math.max(p[1], q[1]) + w };
      acc += sl; T.decks.push(s); hashAdd(deckHash, s, s.x0, s.z0, s.x1, s.z1);
    }
    strip(G.rail, pts, w + 0.8, 0, yfn, -0.35); // Brueckenkoerper
    for (const sg of [-1, 1]) strip(G.line, pts, 0.18, sg * (w / 2 + 0.25), yfn, 0.9);
  }
  strip(G[RGROUP[cls]], pts, w, 0, yfn, lift);
  // Gehsteige und Laternen im Ortsgebiet
  if (cls >= 2 && cls <= 5 && !bridge && landuseAt(raw[0][0], raw[0][1]) === 3 && landuseAt(raw[raw.length - 1][0], raw[raw.length - 1][1]) === 3) {
    for (const sg of [-1, 1]) strip(G.walk, pts, 1.7, sg * (w / 2 + 0.85), yfn, lift + 0.1);
    for (let i = 3; i < pts.length - 1; i += 8) {
      const a = pts[i - 1], b = pts[i + 1]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const sd = (Math.floor(pts[i][0] + pts[i][1]) & 1) ? 1 : -1, lx = pts[i][0] + dz * sd * (w / 2 + 1.4), lz = pts[i][1] - dx * sd * (w / 2 + 1.4);
      if (hash2(Math.round(lx / 30), Math.round(lz / 30)) < 0.75) T.lamps.push([lx, getHeight(lx, lz), lz, Math.atan2(-dz * sd, dx * sd) + Math.PI / 2]);
    }
  }
  if (cls === 9) { for (const sg of [-1, 1]) strip(G.steel, pts, 0.14, sg * 0.72, yfn, lift + 0.12); }
  else if (cls === 0) { for (const sg of [-1, 1]) strip(G.line, pts, 0.25, sg * (w / 2 - 0.5), yfn, lift + 0.05); }
  else if (cls <= 4 || cls === 10) strip(G.line, pts, 0.16, 0, yfn, lift + 0.05);
  if (cls <= 4) for (const sg of [-1, 1]) strip(G.line, pts, 0.14, sg * (w / 2 - 0.2), yfn, lift + 0.05);
  const rr = Math.ceil((w / 2 + 2.5) / 5);
  for (const p of pts) { const ci = Math.floor(p[0] / 5), cj = Math.floor(p[1] / 5); for (let a = -rr; a <= rr; a++) for (let c = -rr; c <= rr; c++) T.roadCells.add((ci + a) * 100003 + cj + c); }
}
function addWater(wv, ox, oz, G) {
  const w = wv[0] / 10, raw = [];
  for (let i = 1; i < wv.length; i += 2) raw.push([ox + wv[i] / 10, oz + wv[i + 1] / 10]);
  let run = [];
  const flush = () => { if (run.length > 1) strip(G.water, run, w, 0, (x, z) => getHeight(x, z), 0.3); run = []; };
  for (const p of densify(raw, 6)) { if (waterLevelAt(p[0], p[1]) > -1e8) flush(); else run.push(p); }
  flush();
}

// ---------- Baeume ----------
let treeGeo = null;
function initTreeGeo() {
  // Blattwerk aus Karten (Flaechen mit Blatt-Textur), Normalen zeigen nach aussen -> weiches Licht
  const cards = (list) => {
    const P = [], N = [], U = [];
    for (const [cx, cy, cz, w, h, ry, tilt] of list) {
      const c = Math.cos(ry), sn = Math.sin(ry), ct = Math.cos(tilt), st = Math.sin(tilt);
      const pt = (u, v) => { const lx = (u - 0.5) * w, ly = (v - 0.5) * h * ct, lz = (v - 0.5) * h * st; return [cx + lx * c + lz * sn, cy + ly, cz - lx * sn + lz * c]; };
      const q = [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)];
      const nl = Math.hypot(cx, cy * 0.4 + 1.5, cz) || 1, n = [cx / nl, (cy * 0.4 + 1.5) / nl, cz / nl];
      for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...q[i]); N.push(...n); U.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    return g;
  };
  const rn = (i) => hash2(i * 13 + 5, i * 7 + 11);
  const broad = [], fir = [];
  for (let i = 0; i < 22; i++) {
    const a = rn(i) * 6.283, e = rn(i + 50) * 1.9 - 0.5, r = 1.2 + rn(i + 99) * 1.9;
    broad.push([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.85, Math.sin(a) * Math.cos(e) * r, 3.4 + rn(i + 7) * 1.6, 3.2 + rn(i + 9) * 1.4, rn(i + 21) * 6.283, (rn(i + 33) - 0.5) * 1.2]);
  }
  for (let i = 0; i < 4; i++) fir.push([0, 6.2, 0, 6.4, 11.5, (i * Math.PI) / 4, 0]);
  for (let i = 0; i < 6; i++) { const a = rn(i + 70) * 6.283, y = 2.6 + i * 1.25, w = 5.4 - i * 0.75; fir.push([Math.cos(a) * 0.3, y, Math.sin(a) * 0.3, w, w, a, 1.45]); }
  const translated = (g, y) => { g.translate(0, y, 0); return g; };
  treeGeo = {
    trunkC: translated(new THREE.CylinderGeometry(0.14, 0.34, 9.5, 7), 4.75), trunkB: translated(new THREE.CylinderGeometry(0.24, 0.46, 4.6, 8), 2.3),
    leafC: cards(fir), leafB: translated(cards(broad), 6.0),
    farC: new THREE.ConeGeometry(2.6, 11, 5).translate(0, 6.2, 0),
    farB: new THREE.IcosahedronGeometry(3.3, 0).translate(0, 5.6, 0),
  };
  const lm = (name) => new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex(name), alphaTest: 0.4, side: THREE.DoubleSide });
  const dm = (name) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex(name), alphaTest: 0.4 });
  treeGeo.matLeafB = lm('leaves'); treeGeo.matLeafC = lm('fir'); treeGeo.depB = dm('leaves'); treeGeo.depC = dm('fir');
  treeGeo.matBark = new THREE.MeshLambertMaterial({ color: 0x6a5240, map: tex('bark') });
  treeGeo.matFlat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
}
function buildTrees(T, near) {
  const ox = T.tx * TILE, oz = T.tz * TILE;
  const list = [];
  const want = (x, z) => {
    if (T.roadCells.has(Math.floor(x / 5) * 100003 + Math.floor(z / 5))) return false;
    return !polyAt(x, z, 1.5);
  };
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) {
    const x0 = ox + i * 10, z0 = oz + j * 10, lu = landuseAt(x0 + 5, z0 + 5);
    const p = lu === 1 ? (near ? 0.85 : 0.5) : (lu === 10 ? 0.07 : (lu === 3 ? 0.035 : (lu === 8 ? 0.2 : (lu === 0 ? 0.004 : 0))));
    if (!p) continue;
    const h1 = hash2(x0 | 0, z0 | 0);
    if (h1 > p) continue;
    const h2 = hash2((x0 | 0) + 7777, z0 | 0), h3 = hash2(x0 | 0, (z0 | 0) + 3333);
    const x = x0 + h2 * 10, z = z0 + h3 * 10;
    if (!want(x, z)) continue;
    const y = getHeight(x, z);
    const con = lu === 1 && h2 * 0.6 + h3 * 0.4 < 0.35 + Math.min(0.55, Math.max(0, (y + M.meta.yoff - 550) / 600));
    list.push([x, y, z, (lu === 8 ? 0.45 : 0.75) + h1 / p * 0.7, con, h3]);
  }
  if (T.data && T.data.t) for (let i = 0; i < T.data.t.length; i += 2) { const x = ox + T.data.t[i] / 10, z = oz + T.data.t[i + 1] / 10; if (!polyAt(x, z, 0.5)) list.push([x, getHeight(x, z), z, 0.9, false, hash2(x | 0, z | 0)]); }
  if (!list.length) return [];
  const cons = list.filter((t) => t[4]), brs = list.filter((t) => !t[4]);
  const out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const mk = (arr, geo, mat, hue, sat, lig, dep) => {
    if (!arr.length) return;
    const im = new THREE.InstancedMesh(geo, mat, arr.length);
    if (dep) im.customDepthMaterial = dep;
    arr.forEach((t, i) => {
      q.setFromAxisAngle(up, t[5] * 6.28); s.set(t[3], t[3] * (0.85 + t[5] * 0.4), t[3]);
      m.compose(p.set(t[0], t[1] - 0.2, t[2]), q, s); im.setMatrixAt(i, m);
      if (hue >= 0) im.setColorAt(i, col.setHSL(hue + t[5] * 0.05, sat, lig + t[5] * 0.08)); else im.setColorAt(i, col.setScalar(0.8 + t[5] * 0.3));
    });
    im.castShadow = near; im.receiveShadow = false;
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    out.push(im);
  };
  if (near) {
    mk(cons, treeGeo.trunkC, treeGeo.matBark, -1); mk(cons, treeGeo.leafC, treeGeo.matLeafC, 0.34, 0.5, 0.3, treeGeo.depC);
    mk(brs, treeGeo.trunkB, treeGeo.matBark, -1); mk(brs, treeGeo.leafB, treeGeo.matLeafB, 0.26, 0.55, 0.42, treeGeo.depB);
  }
  else { mk(cons, treeGeo.farC, treeGeo.matFlat, 0.33, 0.4, 0.15); mk(brs, treeGeo.farB, treeGeo.matFlat, 0.25, 0.42, 0.25); }
  return out;
}

// ---------- Kachel-Streaming ----------
let RB = 5, RT = 3, RN = 1; // Radius: Gebaeude/Strassen, ferne Baeume, nahe Baeume
const objTiles = new Map();
let objKey = '', objQueue = [], fetching = 0;
function loadTileData(T) {
  if (!M.tileSet.has(T.key)) { T.data = {}; T.state = 1; return; }
  if (fetching >= 6) return;
  fetching++; T.state = 0.5;
  fetch('./world/tiles/' + T.key + '.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { fetching--; T.data = d; T.state = 1; });
}
function buildTileObjects(T) {
  const ox = T.tx * TILE, oz = T.tz * TILE, d = T.data;
  const W = Buf(), Rf = Buf(); W.g = Buf(); T.lamps = [];
  const G = { asphalt: Buf(), gravel: Buf(), paving: Buf(), rail: Buf(), line: Buf(), steel: Buf(), water: Buf(), walk: Buf() };
  T.group = new THREE.Group(); T.group.matrixAutoUpdate = false;
  if (d.r) for (const r of d.r) addRoad(r, ox, oz, G, T);
  if (d.w) for (const w of d.w) addWater(w, ox, oz, G);
  if (d.b) for (const b of d.b) addBuilding(b, ox, oz, W, Rf, T.polys);
  for (const [B, mat, sh] of [[W, wallMat, true], [W.g, wallMatG, true], [Rf, roofMat, true], ...Object.keys(G).map((k) => [G[k], roadMats[k], false])]) {
    const m = meshOf(B, mat, sh); if (m) T.group.add(m);
  }
  if (T.lamps.length) {
    const n = Math.min(T.lamps.length, 160), mm = new THREE.Matrix4();
    const poles = new THREE.InstancedMesh(lampGeo.pole, lampGeo.poleMat, n), bulbs = new THREE.InstancedMesh(lampGeo.bulb, lampMat, n);
    for (let i = 0; i < n; i++) { const l = T.lamps[i]; mm.makeRotationY(l[3]); mm.setPosition(l[0], l[1], l[2]); poles.setMatrixAt(i, mm); bulbs.setMatrixAt(i, mm); }
    poles.castShadow = true; poles.computeBoundingSphere(); bulbs.computeBoundingSphere();
    T.group.add(poles); T.group.add(bulbs);
  }
  sceneRef.add(T.group);
  T.state = 2;
}
function setTrees(T, lod) {
  if (T.treeLod === lod) return;
  for (const im of T.trees) { sceneRef.remove(im); im.dispose(); }
  T.trees = lod ? buildTrees(T, lod === 2) : [];
  for (const im of T.trees) sceneRef.add(im);
  T.treeLod = lod;
}
function unloadTile(T) {
  if (T.group) { sceneRef.remove(T.group); T.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  for (const im of T.trees) { sceneRef.remove(im); im.dispose(); }
  for (const p of T.polys) hashRemove(polyHash, p, p.x0 - 2, p.z0 - 2, p.x1 + 2, p.z1 + 2);
  for (const s of T.decks) hashRemove(deckHash, s, s.x0, s.z0, s.x1, s.z1);
  objTiles.delete(T.key);
}
// Liefert true, solange im Nahbereich (3x3) noch nicht alles geladen ist
export function updateObjects(cx, cz, budgetMs = 6) {
  if (!treeGeo) initTreeGeo();
  const ctx = Math.floor(cx / TILE), ctz = Math.floor(cz / TILE), key = ctx + '_' + ctz;
  if (key !== objKey) {
    objKey = key;
    for (const T of [...objTiles.values()]) if (Math.max(Math.abs(T.tx - ctx), Math.abs(T.tz - ctz)) > RB + 1) unloadTile(T);
    objQueue = [];
    for (let dz = -RB; dz <= RB; dz++) for (let dx = -RB; dx <= RB; dx++) {
      const tx = ctx + dx, tz = ctz + dz;
      if ((tx + 1) * TILE < M.minX || tx * TILE > M.maxX || (tz + 1) * TILE < M.minZ || tz * TILE > M.maxZ) continue;
      const k = tx + '_' + tz;
      let T = objTiles.get(k);
      if (!T) { T = { key: k, tx, tz, state: 0, data: null, group: null, trees: [], treeLod: 0, polys: [], decks: [], roadCells: new Set() }; objTiles.set(k, T); }
      T.d = Math.max(Math.abs(dx), Math.abs(dz));
      objQueue.push(T);
    }
    objQueue.sort((a, b) => a.d - b.d);
  }
  const t0 = performance.now();
  let pendingNear = false, work = false;
  for (const T of objQueue) {
    if (T.state === 0) loadTileData(T);
    const wantTree = T.d <= RN ? 2 : (T.d <= RT ? 1 : 0);
    if (T.state === 1 && performance.now() - t0 < budgetMs) buildTileObjects(T);
    if (T.state === 2 && T.treeLod !== wantTree && performance.now() - t0 < budgetMs) setTrees(T, wantTree);
    if (T.state < 2 || T.treeLod !== wantTree) { work = true; if (T.d <= 1) pendingNear = true; }
  }
  if (!work) objQueue = objQueue.length ? objQueue : [];
  return pendingNear;
}

export function nearRoad(x, z) {
  const T = objTiles.get(Math.floor(x / TILE) + '_' + Math.floor(z / TILE));
  return !!(T && T.roadCells.has(Math.floor(x / 5) * 100003 + Math.floor(z / 5)));
}

// ---------- Gras rund um den Spieler ----------
let grass = null, grassX = 1e9, grassZ = 1e9;
const GRASS_N = 16000, GRASS_STEP = 1.25, GRASS_R = 78;
export function updateGrass(cx, cz, agl, ready) {
  if (RN === 0) return; // niedrige Grafik: kein Gras
  if (!grass) {
    const P = [], U = [], N = [];
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3, c = Math.cos(a) * 0.55, sn = Math.sin(a) * 0.55;
      const q = [[-c, 0, -sn], [c, 0, sn], [c, 0.42, sn], [-c, 0.42, -sn]], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...q[i]); U.push(...uv[i]); N.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    grass = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex('grass'), alphaTest: 0.35, side: THREE.DoubleSide }), GRASS_N);
    grass.frustumCulled = false; grass.receiveShadow = true; grass.count = 0;
    grass.setColorAt(0, new THREE.Color(1, 1, 1));
    sceneRef.add(grass);
  }
  if (agl > 120) { grass.visible = false; return; }
  grass.visible = true;
  if (!ready || Math.hypot(cx - grassX, cz - grassZ) < 9) return;
  grassX = cx; grassZ = cz;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let n = 0;
  const i0 = Math.floor((cx - GRASS_R) / GRASS_STEP), i1 = Math.floor((cx + GRASS_R) / GRASS_STEP), j0 = Math.floor((cz - GRASS_R) / GRASS_STEP), j1 = Math.floor((cz + GRASS_R) / GRASS_STEP);
  for (let j = j0; j <= j1 && n < GRASS_N; j++) for (let i = i0; i <= i1 && n < GRASS_N; i++) {
    const h1 = hash2(i, j);
    const x = (i + h1) * GRASS_STEP, z = (j + hash2(i + 911, j)) * GRASS_STEP;
    const d = Math.hypot(x - cx, z - cz);
    if (d > GRASS_R || h1 < (d / GRASS_R) * 0.75) continue; // nach aussen ausduennen
    const lu = landuseAt(x, z);
    if (lu === 4 || lu === 5 || lu === 6 || lu === 7 || (lu === 2 && h1 > 0.5) || (lu === 1 && h1 > 0.45)) continue;
    if (nearRoad(x, z) || polyAt(x, z, 0.6)) continue;
    const y = getHeight(x, z);
    if (y + M.meta.yoff > 1650) continue;
    const sc = (lu === 2 ? 1.2 : 0.55) + h1 * 0.6;
    q.setFromAxisAngle(up, h1 * 6.283); s.set(sc, sc * (0.7 + hash2(i, j + 77) * 0.8), sc);
    m.compose(p.set(x, y - 0.03, z), q, s); grass.setMatrixAt(n, m);
    const t = hash2(i + 5, j + 3);
    if (lu === 2) col.setRGB(0.62 + t * 0.2, 0.6 + t * 0.15, 0.25); else col.setRGB(0.36 + t * 0.12, 0.56 + t * 0.14, 0.2 + t * 0.06);
    grass.setColorAt(n, col); n++;
  }
  grass.count = n; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
}

// ---------- POIs, Beschriftungen, Flugplatz ----------
const POI_ICON = { wirt: '🍺', werk: '🔧', handel: '💰', dealer: '🌿' };
function initPois() {
  let id = 0;
  for (const p of M.pois) {
    let kind = null, label = p.n;
    if (p.k === 'wirt') { kind = 'wirt'; label = p.n || 'Wirtshaus'; }
    else if (p.k === 'werk') { kind = 'werk'; label = p.n || 'Werkstatt'; }
    else if (p.k === 'handel' || p.k === 'tank') { kind = 'handel'; label = p.n || (p.k === 'tank' ? 'Tankstelle' : 'Geschäft'); }
    if (kind) pois.push({ id: id++, x: p.x, z: p.z, y: getHeight(p.x, p.z), kind, label, marker: null });
    if (p.k === 'place' && p.r <= 2) {
      const x = p.x + 38, z = p.z + 27;
      pois.push({ id: id++, x, z, y: getHeight(x, z), kind: 'dealer', label: 'Der Franz', marker: null });
      npcSpots.push({ x: p.x, z: p.z, r: [170, 120, 75][p.r], n: [22, 14, 8][p.r], kind: p.r <= 1 ? 'stadt' : 'dorf' });
    } else if (p.k === 'place' && p.r <= 4) npcSpots.push({ x: p.x, z: p.z, r: 40, n: 3, kind: 'dorf' });
    else if (p.k === 'wirt') npcSpots.push({ x: p.x, z: p.z, r: 9, n: 2, kind: 'dorf' });
    else if (p.k === 'werk') npcSpots.push({ x: p.x, z: p.z, r: 10, n: 2, kind: 'arbeit' });
    else if (p.k === 'fall' || p.k === 'attr' || p.k === 'peak' || p.k === 'sternwarte' || p.k === 'burg') npcSpots.push({ x: p.x, z: p.z, r: 12, n: 2, kind: 'wander' });
    else if (p.k === 'kirche') npcSpots.push({ x: p.x, z: p.z, r: 14, n: 1, kind: 'dorf' });
  }
}
const labels = new Map();
let markT = 0;
export function updateMarkers(cx, cz, dt) {
  markT -= dt; if (markT > 0) return; markT = 0.8;
  for (const p of pois) {
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d < 260 && !p.marker) {
      const g = new THREE.Group();
      const sp = textSprite(POI_ICON[p.kind] + ' ' + p.label, 0.9); sp.position.y = 3.8; g.add(sp);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 20), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35; g.add(ring);
      p.y = getHeight(p.x, p.z); g.position.set(p.x, p.y, p.z); sceneRef.add(g); p.marker = g;
    } else if (d > 320 && p.marker) { sceneRef.remove(p.marker); p.marker.traverse((o) => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); p.marker = null; }
  }
  for (const p of M.pois) {
    if (p.k !== 'place' && p.k !== 'peak') continue;
    if (p.k === 'place' && p.r > 3) continue;
    const d = Math.hypot(p.x - cx, p.z - cz), lim = p.k === 'peak' ? 9000 : [14000, 10000, 5000, 2500][p.r];
    const has = labels.get(p);
    if (d < lim && d > 150 && !has) {
      const size = p.k === 'peak' ? 60 : [150, 110, 60, 40][p.r];
      const sp = textSprite(p.k === 'peak' ? `▲ ${p.n}${p.e ? ' ' + Math.round(p.e) + ' m' : ''}` : p.n, size);
      sp.material.depthTest = false; sp.material.fog = false; sp.material.opacity = 0.9; sp.renderOrder = 5;
      sp.position.set(p.x, getHeight(p.x, p.z) + (p.k === 'peak' ? 90 : 160), p.z);
      sceneRef.add(sp); labels.set(p, sp);
    } else if ((d > lim * 1.1 || d < 120) && has) { sceneRef.remove(has); has.material.map.dispose(); has.material.dispose(); labels.delete(p); }
  }
}
function buildAirfield() {
  const a = M.air; if (!a) return;
  if (a.made) {
    const pts = densify([[a.x0, a.z0], [a.x1, a.z1]], 20);
    const A = Buf(), L = Buf();
    strip(A, pts, a.w, 0, () => a.level, 0.12);
    for (let i = 0; i + 1 < pts.length; i += 2) strip(L, [pts[i], pts[i + 1]], 0.9, 0, () => a.level, 0.2);
    const m1 = meshOf(A, roadMats.asphalt, false), m2 = meshOf(L, roadMats.line, false);
    sceneRef.add(m1); sceneRef.add(m2);
  }
  const sp = textSprite('✈ Flugplatz', 40); sp.material.depthTest = false; sp.material.fog = false;
  sp.position.set((a.x0 + a.x1) / 2, a.level + 70, (a.z0 + a.z1) / 2); sceneRef.add(sp);
}

function buildClouds() {
  const rnd = mulberry(99);
  cloudMat = new THREE.SpriteMaterial({ map: tex('cloud'), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  for (let i = 0; i < 70; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(cloudMat);
      const sc0 = 420 + rnd() * 520;
      sp.scale.set(sc0, sc0 * 0.55, 1);
      sp.position.set((k - n / 2) * 210 + rnd() * 120, rnd() * 80, (rnd() - 0.5) * 360);
      g.add(sp);
    }
    g.position.set((rnd() - 0.5) * 24000, 1900 + rnd() * 900, (rnd() - 0.5) * 24000);
    sceneRef.add(g); clouds.push(g);
  }
}
export function initWorld(scene, lowGfx, renderer) {
  sceneRef = scene;
  if (lowGfx) { RB = 3; RT = 2; RN = 0; }
  hemi = new THREE.HemisphereLight(0xcfe4ff, 0x7d7458, 1.0);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = lowGfx !== true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 560;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(0x9fd6ff, 300, 22000);
  scene.background = new THREE.Color(0x9fd6ff);
  water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.95, 0.8) },
      skyTop: { value: new THREE.Color(0x2f7fe0) }, skyBot: { value: new THREE.Color(0x9fd6ff) }, deep: { value: new THREE.Color(0x0e6f86) }, day: { value: 1 } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time; uniform float day; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyTop; uniform vec3 skyBot; uniform vec3 deep; varying vec3 wp;
      void main(){
        vec2 p = wp.xz; float t = time;
        float dist = length(cameraPosition - wp);
        float amp = 1.0 / (1.0 + dist * 0.012); float far = 1.0 / (1.0 + dist * 0.0012);
        vec2 g = vec2(0.0);
        g += 0.10 * far * vec2(cos(p.x * 0.21 + t * 1.1), cos(p.y * 0.17 - t * 0.9));
        g += 0.07 * far * vec2(cos(p.x * 0.53 - p.y * 0.31 + t * 1.7), cos(p.y * 0.61 + p.x * 0.27 + t * 1.4));
        g += 0.05 * amp * vec2(cos(p.x * 1.7 + p.y * 1.1 + t * 2.6), cos(p.y * 1.9 - p.x * 0.8 - t * 2.2));
        g += 0.035 * amp * vec2(cos(p.x * 4.3 - t * 3.1), cos(p.y * 3.7 + t * 3.4));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - wp);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(skyBot, skyTop, pow(clamp(R.y, 0.0, 1.0), 0.5));
        float spec = pow(max(dot(R, sunDir), 0.0), 260.0) * 2.4 + pow(max(dot(R, sunDir), 0.0), 24.0) * 0.12;
        vec3 body = mix(deep, vec3(0.16, 0.74, 0.76), 0.35 + 0.25 * N.x) * (0.25 + 0.75 * day);
        vec3 col = mix(body, sky, fres) + sunCol * spec * day;
        float fogF = smoothstep(300.0, 22000.0, dist);
        col = mix(col, skyBot, fogF);
        gl_FragColor = vec4(col, mix(0.62, 0.97, fres));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f7fe0) }, bottom: { value: new THREE.Color(0x9fd6ff) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) } },
    vertexShader: 'varying float vh; varying vec3 vd; void main(){ vd = position; vh = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying float vh; varying vec3 vd; void main(){ float t = pow(clamp(vh, 0.0, 1.0), 0.5); vec3 c = mix(bottom, top, t); float s = max(dot(normalize(vd), sunDir), 0.0); c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.5 + pow(s, 6.0) * 0.16); c = mix(c, bottom * 1.06, pow(1.0 - clamp(vh, 0.0, 1.0), 14.0)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -10; scene.add(sky);
  sunDisc = new THREE.Mesh(new THREE.SphereGeometry(55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false }));
  scene.add(sunDisc);
  { const pts = []; const r = mulberry(5);
    for (let i = 0; i < 700; i++) { const a = r() * 6.283, e = Math.asin(r() * 0.95 + 0.04); pts.push(Math.cos(a) * Math.cos(e) * 3900, Math.sin(e) * 3900, Math.sin(a) * Math.cos(e) * 3900); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(stars); }
  sky.scale.setScalar(7); stars.scale.setScalar(7); sunDisc.scale.setScalar(7);
  for (const g of lakeGeometries()) { const m = new THREE.Mesh(g, water.material); m.frustumCulled = false; m.renderOrder = 2; scene.add(m); }
  buildClouds(); initPois(); buildAirfield();
  // Umgebungslicht/Spiegelungen fuer PBR-Materialien aus dem Himmel
  if (renderer) {
    try {
      const es = new THREE.Scene();
      const em = sky.material.clone();
      em.uniforms.top.value.set(0x2f7fe0); em.uniforms.bottom.value.set(0xb9defa); em.uniforms.sunDir.value.set(0.5, 0.7, 0.3).normalize(); em.uniforms.sunCol.value.set(1, 0.95, 0.85);
      es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), em));
      const gr = new THREE.Mesh(new THREE.SphereGeometry(49, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a5a3a, side: THREE.BackSide })); es.add(gr);
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(es, 0.02, 0.1, 200).texture;
      scene.environmentIntensity = 0.8;
      pm.dispose();
    } catch (e) { /* ohne Spiegelungen */ }
  }
}

let skyT = 0;
const cDay = new THREE.Color(0x8fd0ff), cDusk = new THREE.Color(0xf7a35c), cNight = new THREE.Color(0x0c1230), cTmp = new THREE.Color();
// dayT: 0..1 (0.25 Sonnenaufgang, 0.5 Mittag, 0.75 Sonnenuntergang)
export function updateSky(dayT, dt, center, scene) {
  const ang = (dayT - 0.25) * Math.PI * 2;
  const el = Math.sin(ang); // Sonnenhoehe -1..1
  const day = Math.min(1, Math.max(0, (el + 0.12) / 0.35));
  const dusk = Math.max(0, 1 - Math.abs(el) / 0.3);
  cTmp.copy(cNight).lerp(cDay, day).lerp(cDusk, dusk * 0.55 * (day > 0.02 ? 1 : 0.4));
  scene.background.copy(cTmp);
  scene.fog.color.copy(cTmp);
  const sy = Math.max(0.18, el);
  const dirX = Math.cos(ang) * 0.9, dirZ = 0.35;
  sun.position.set(center.x + dirX * 220, center.y + sy * 220, center.z + dirZ * 220);
  sun.target.position.copy(center);
  sun.intensity = 0.12 + 3.5 * day;
  sun.color.setHex(0xfff1d6).lerp(cDusk, dusk * 0.6);
  hemi.intensity = 0.26 + 0.72 * day;
  sky.position.copy(center); stars.position.copy(center);
  sky.material.uniforms.bottom.value.copy(cTmp);
  sky.material.uniforms.top.value.setRGB(0.03 + 0.1 * day, 0.05 + 0.3 * day, 0.14 + 0.62 * day);
  sunDisc.position.set(center.x + dirX * 25000, center.y + el * 25000, center.z + dirZ * 25000);
  sunDisc.visible = el > -0.06;
  stars.material.opacity = Math.max(0, 1 - day * 1.6);
  const nightGlow = Math.max(0, 1 - day * 1.4);
  skyT += dt;
  const sd = sky.material.uniforms.sunDir.value.set(dirX, el, dirZ).normalize();
  sky.material.uniforms.sunCol.value.setRGB(1, 0.92 - 0.3 * dusk, 0.75 - 0.5 * dusk).multiplyScalar(el > -0.08 ? 1 : 0);
  const wu = water.material.uniforms;
  wu.time.value = skyT; wu.sunDir.value.copy(sd); wu.sunCol.value.copy(sky.material.uniforms.sunCol.value);
  wu.skyTop.value.copy(sky.material.uniforms.top.value); wu.skyBot.value.copy(cTmp); wu.day.value = day;
  if (cloudMat) cloudMat.color.setRGB(0.16 + 0.84 * day, 0.17 + 0.8 * day - 0.12 * dusk, 0.22 + 0.76 * day - 0.25 * dusk);
  for (const c of clouds) {
    c.position.x += dt * 6;
    if (c.position.x - center.x > 12000) c.position.x -= 24000; else if (c.position.x - center.x < -12000) c.position.x += 24000;
    if (c.position.z - center.z > 12000) c.position.z -= 24000; else if (c.position.z - center.z < -12000) c.position.z += 24000;
  }
  wallMat.emissiveIntensity = nightGlow * 0.9; wallMatG.emissiveIntensity = nightGlow * 1.1;
  lampMat.color.setRGB(0.75 + 3.2 * nightGlow, 0.75 + 2.6 * nightGlow, 0.7 + 1.2 * nightGlow);
  scene.environmentIntensity = 0.08 + 0.75 * day;
  return day;
}
