// WIBA - Welt: Himmel, Licht, Wasser, Dorf, Flugplatz, Baustelle, Baeume, Kollisionsboxen
import * as THREE from 'three';
import { HALF, GRID, CELL } from './config.js';
import { getHeight, heights, editListeners, mask, maskAt, roadData, riverData } from './terrain.js';
import { ZONES, TOWN, PLACES, KAMMER, GAHBERG, SCHNEIDERBAUER, NOEHMER, NIXENFALL, lakeDist } from './geo.js';

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
  return best ? { t: bt, box: best } : null;
}
export function pointInBoxes(x, y, z, pad = 0) {
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

function house(x, z, w, d, h, color, roofColor, ry = 0, Yin) {
  const g = new THREE.Group();
  const Y = Yin === undefined ? getHeight(x, z) : Yin;
  g.add(mkBox(w, h, d, color, 0, h / 2, 0));
  g.add(mkBox(w, 4, d, 0x8d8a84, 0, -2, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), lam(roofColor));
  roof.scale.set(w * 0.78, h * 0.5, d * 0.78);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + h * 0.25;
  roof.castShadow = true;
  g.add(roof);
  g.add(mkBox(1.3, 2.2, 0.15, 0x5a3a22, 0, 1.1, d / 2 + 0.03));
  g.add(mkBox(0.9, 2.2, 0.9, 0x8d5a4a, w * 0.22, h + h * 0.36, 0));
  const hs = Math.abs(Math.round(x * 7 + z * 13)) % 3;
  if (hs === 0 && h < 7.5) { g.add(mkBox(w * 0.84, 0.9, 0.9, 0x7a4a22, 0, h * 0.5, d / 2 + 0.45)); g.add(mkBox(w * 0.84, 0.22, 0.5, 0xd0302a, 0, h * 0.5 + 0.5, d / 2 + 0.75)); }
  if (hs === 1) g.add(mkBox(w + 0.06, h * 0.34, d + 0.06, 0x8a5a2f, 0, h * 0.83, 0));
  const nWin = Math.max(1, Math.floor(w / 4));
  for (let i = 0; i < nWin; i++) {
    const wx = -w / 2 + (i + 0.5) * (w / nWin);
    if (Math.abs(wx) < 1.4) continue;
    g.add(mkBox(1.5, 1.5, 0.08, 0xffffff, wx, h * 0.55, d / 2 + 0.02));
    if (hs === 2) g.add(mkBox(1.3, 0.22, 0.32, 0xd0302a, wx, h * 0.55 - 0.78, d / 2 + 0.2));
    g.add(mkBox(1.2, 1.2, 0.12, 0xbfe6ff, wx, h * 0.55, d / 2 + 0.03));
    g.add(mkBox(1.2, 1.2, 0.12, 0xbfe6ff, wx, h * 0.55, -d / 2 - 0.03));
  }
  g.position.set(x, Y, z);
  g.rotation.y = ry;
  sceneRef.add(g);
  const sw = Math.abs(Math.sin(ry)) > 0.5 ? d : w, sd = Math.abs(Math.sin(ry)) > 0.5 ? w : d;
  solid(x, Y - 3, z, sw, h + 4.5, sd);
  return g;
}

function addPoi(x, z, kind, label, emoji) {
  const y = getHeight(x, z);
  pois.push({ x, y, z, kind, label });
  const sp = textSprite(emoji + ' ' + label, 0.9);
  sp.position.set(x, y + 3.6, z);
  sceneRef.add(sp);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 20), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, y + 0.3, z);
  sceneRef.add(ring);
}
function label(text, x, z, up = 9, size = 2.2) {
  const sp = textSprite(text, size);
  sp.position.set(x, getHeight(x, z) + up, z);
  sceneRef.add(sp);
}
function church(x, z, s = 1, onion = true, Yin) {
  const Y = Yin === undefined ? getHeight(x, z) : Yin;
  house(x, z, 9 * s, 16 * s, 8 * s, 0xfafafa, 0x7a2f2f, 0, Y);
  const tz = z + 10.5 * s;
  sceneRef.add(mkBox(5 * s, 18 * s, 5 * s, 0xfafafa, x, Y + 9 * s - 2, tz));
  solid(x, Y - 3, tz, 5 * s, 20 * s, 5 * s);
  if (onion) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(3 * s, 8, 6), lam(0x2f6f5a));
    o.scale.y = 1.25; o.position.set(x, Y + 19 * s, tz); o.castShadow = true; sceneRef.add(o);
  }
  const sp = new THREE.Mesh(new THREE.ConeGeometry((onion ? 0.8 : 2.8) * s, (onion ? 5 : 9) * s, 6), lam(onion ? 0x2f6f5a : 0x7a2f2f));
  sp.position.set(x, Y + (onion ? 24.5 : 21) * s, tz); sp.castShadow = true; sceneRef.add(sp);
}
function tree(x, z, s = 1) {
  const y = getHeight(x, z);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 2.4 * s, 5), lam(0x6b4a2a));
  t.position.set(x, y + 1.2 * s, z); sceneRef.add(t);
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0 * s, 0), lam(0x4f9a3c));
  b.position.set(x, y + 3.6 * s, z); b.castShadow = true; sceneRef.add(b);
}
function bench(x, z, ry = 0) {
  const y = getHeight(x, z);
  const g = new THREE.Group();
  g.add(mkBox(1.8, 0.1, 0.5, 0x8a5a2f, 0, 0.5, 0)); g.add(mkBox(1.8, 0.5, 0.08, 0x8a5a2f, 0, 0.85, -0.22));
  g.add(mkBox(0.1, 0.5, 0.45, 0x333333, -0.8, 0.25, 0)); g.add(mkBox(0.1, 0.5, 0.45, 0x333333, 0.8, 0.25, 0));
  g.position.set(x, y, z); g.rotation.y = ry; sceneRef.add(g);
}
function ribbon(pts, w, color, lift) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const p = pts[i];
    pos.push(p[0] - dz * w / 2, p[2] + lift, p[1] + dx * w / 2, p[0] + dz * w / 2, p[2] + lift, p[1] - dx * w / 2);
    if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  sceneRef.add(m);
}
function buildRoadsRivers() {
  for (const rd of roadData) {
    if (rd.pts.length < 2) continue;
    ribbon(rd.pts, rd.road.w, rd.road.col || 0x55555c, 0.3);
    if (rd.road.w >= 8) ribbon(rd.pts, 0.35, 0xe8e8e8, 0.36);
  }
  // Fluesse: unter Strassen unterbrochen (Bruecke/Durchlass)
  const rsamples = [];
  for (const rv of riverData) {
    let seg = [];
    for (const p of rv.pts) {
      rsamples.push([p[0], p[1], rv.river.w]);
      if (maskAt(p[0], p[1]) === 1) { if (seg.length > 1) ribbon(seg, rv.river.w + 3, 0x3a9ad8, 0); seg = []; } else seg.push(p);
    }
    if (seg.length > 1) ribbon(seg, rv.river.w + 3, 0x3a9ad8, 0);
  }
  // Brueckengelaender, wo Strassen Fluesse queren
  const post = new THREE.BoxGeometry(0.22, 1.1, 0.22), rail = lam(0xdadada);
  for (const rd of roadData) {
    for (let i = 1; i < rd.pts.length - 1; i++) {
      const p = rd.pts[i];
      let near = false;
      for (const r of rsamples) if (Math.abs(r[0] - p[0]) < 9 && Math.abs(r[1] - p[1]) < 9 && Math.hypot(r[0] - p[0], r[1] - p[1]) < r[2] / 2 + 4) { near = true; break; }
      if (!near) continue;
      const a = rd.pts[i - 1], b = rd.pts[i + 1];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      for (const sgn of [-1, 1]) for (const off of [-1.3, 1.3]) {
        const m = new THREE.Mesh(post, rail);
        m.position.set(p[0] - dz * sgn * (rd.road.w / 2 + 0.4) + dx * off, p[2] + 0.75, p[1] + dx * sgn * (rd.road.w / 2 + 0.4) + dz * off);
        sceneRef.add(m);
      }
    }
  }
}
function lamp(x, z) {
  const y = getHeight(x, z);
  sceneRef.add(mkBox(0.16, 4.2, 0.16, 0x2b2b2b, x, y + 2.1, z));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lampMat); b.position.set(x, y + 4.4, z); sceneRef.add(b);
}

// Naechster Uferpunkt (achsparallel Richtung See)
function shore(x, z) {
  let best = null, bd = 1e9;
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let t = 0; t < 140; t += 2) {
      if (lakeDist(x + d[0] * t, z + d[1] * t) < -1) { if (t < bd) { bd = t; best = { x: x + d[0] * t, z: z + d[1] * t, dx: d[0], dz: d[1] }; } break; }
    }
  }
  return best;
}
function steg(sh, len = 18) {
  const cx = sh.x + sh.dx * (len / 2 - 3), cz = sh.z + sh.dz * (len / 2 - 3);
  const w = sh.dx ? len : 2.4, d = sh.dx ? 2.4 : len;
  sceneRef.add(mkBox(w, 0.25, d, 0xa87c4f, cx, 0.55, cz));
  solid(cx, -2, cz, w, 2.7, d);
}
function sailboat(x, z, ry) {
  const g = new THREE.Group();
  g.add(mkBox(1.8, 0.8, 5.5, 0xf4f4f4, 0, 0.3, 0));
  g.add(mkBox(0.12, 7, 0.12, 0xcccccc, 0, 3.8, 0.4));
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0.3), new THREE.Vector3(0, 7.2, 0.3), new THREE.Vector3(0, 0.9, -2.6)]);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })));
  g.position.set(x, 0, z); g.rotation.y = ry; sceneRef.add(g);
}
function scatterHouses(rnd, cx, cz, n, r, pal) {
  const cols = pal || [0xf7d9c4, 0xd9ead3, 0xfff2cc, 0xd0e0f0, 0xf4cccc, 0xe6d5f5, 0xfafafa];
  const roofs = [0x8a3b2a, 0x6b4a3a, 0x7a2f2f, 0x55606b];
  let made = 0;
  for (let t = 0; t < n * 14 && made < n; t++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const w = 9 + rnd() * 4, dd = 8 + rnd() * 3;
    const h0 = getHeight(x, z);
    if (h0 < 1.3) continue;
    let ok = true;
    for (const o of [[0, 0], [w / 2 + 3, dd / 2 + 3], [-w / 2 - 3, dd / 2 + 3], [w / 2 + 3, -dd / 2 - 3], [-w / 2 - 3, -dd / 2 - 3]]) {
      if (maskAt(x + o[0], z + o[1]) || Math.abs(getHeight(x + o[0], z + o[1]) - h0) > 2.6 || pointInBoxes(x + o[0], h0 + 1, z + o[1], 3)) { ok = false; break; }
    }
    if (!ok) continue;
    house(x, z, w, dd, 4.5 + rnd() * 2.5, cols[Math.floor(rnd() * cols.length)], roofs[Math.floor(rnd() * roofs.length)], rnd() < 0.5 ? 0 : Math.PI / 2);
    made++;
  }
}

function buildVoecklabruck(rnd) {
  const Y = 5, T = TOWN;
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(126, 34), lam(0xcdbf9f));
  pav.rotation.x = -Math.PI / 2; pav.position.set(T.x, Y + 0.1, -905); pav.receiveShadow = true; sceneRef.add(pav);
  // Wappentuerme an beiden Enden des Stadtplatzes (Tor ueber der Strasse)
  for (const [tx, col, nm] of [[T.x - 62, 0xf2e2b0, 'Oberer Stadtturm'], [T.x + 62, 0xe8d9c0, 'Unterer Stadtturm']]) {
    for (const s of [-1, 1]) { sceneRef.add(mkBox(8, 7, 2.6, col, tx, Y + 3.5, -905 + s * 6.6)); solid(tx, Y, -905 + s * 6.6, 8, 24, 2.6); }
    sceneRef.add(mkBox(8, 16, 15.8, col, tx, Y + 15, -905));
    const rf = new THREE.Mesh(new THREE.ConeGeometry(8.6, 9, 4), lam(0x7a2f2f)); rf.rotation.y = Math.PI / 4; rf.position.set(tx, Y + 27.5, -905); rf.castShadow = true; sceneRef.add(rf);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) sceneRef.add(mkBox(0.1, 1.6, 1.3, [0xc0392b, 0x2f6fd0, 0xe8c040, 0x2e8b3a, 0xffffff][i], tx + s * 4.06, Y + 13 + (i % 2) * 2.2, -910 + i * 2.5));
    sign(nm, 0.9, tx, Y + 9.2, -905 + 8.0, 0);
  }
  // Haeuserzeilen am Stadtplatz
  const pal = [0xf7d9c4, 0xfff2cc, 0xd9ead3, 0xf4cccc, 0xd0e0f0, 0xf2e2b0, 0xe6d5f5];
  let k = 0;
  for (let x = T.x - 52; x <= T.x + 52; x += 10.4) {
    if (Math.abs(x - T.x) < 9) continue;
    house(x, -927, 10, 10, 8 + (k % 3) * 1.5, pal[k % 7], 0x7a3b2a, 0, Y);
    house(x, -883, 10, 10, 8 + ((k + 1) % 3) * 1.5, pal[(k + 3) % 7], 0x6b4a3a, Math.PI, Y); k++;
  }
  sign('Gasthaus „Zum Faulen Bagger“', 1.0, T.x - 31, Y + 4.6, -921.8, 0);
  addPoi(T.x - 31, -917.5, 'wirt', 'Wirtshaus', '🍺');
  sign('WAFFENSCHMIEDE', 1.0, T.x + 31, Y + 4.6, -921.8, 0, { bg: '#2b3440', color: '#ffd21f' });
  addPoi(T.x + 31, -917.5, 'werk', 'Werkbank', '🔧');
  sign('Schrotthandel Hintermoser', 1.0, T.x + 31, Y + 4.6, -888.2, Math.PI);
  addPoi(T.x + 31, -892.5, 'handel', 'Schrotthandel', '💰');
  sign('Café am Stadtplatz', 0.9, T.x - 31, Y + 4.6, -888.2, Math.PI);
  for (let i = 0; i < 4; i++) { bench(T.x - 44 + i * 8, -896, Math.PI); sceneRef.add(mkBox(1, 0.8, 1, 0xb98a4f, T.x - 40 + i * 8, Y + 0.5, -893)); }
  const well = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1, 10), lam(0x9a9a9a)); well.position.set(T.x + 50, Y + 0.5, -916); sceneRef.add(well); solid(T.x + 50, Y, -916, 4, 1, 4);
  label('Stadtplatz Vöcklabruck', T.x, -905, 34, 2.6);
  for (let lx = T.x - 50; lx <= T.x + 50; lx += 20) { lamp(lx, -899); lamp(lx + 10, -911); }
  for (let lz = -870; lz <= -790; lz += 20) lamp(T.x + 5.5, lz);
  // Hinterstadt: Stadtpfarrkirche St. Ulrich, Heimathaus, Franz
  church(T.x + 40, -956, 1.0, false, Y); label('Stadtpfarrkirche St. Ulrich', T.x + 40, -950, 30, 1.6);
  house(T.x + 16, -952, 10, 9, 6, 0xf2e2b0, 0x6b4a3a, 0, Y); sign('Heimathaus · Stadtmuseum', 0.8, T.x + 16, Y + 3.6, -947.3, 0);
  house(T.x - 34, -954, 10, 8, 5, 0x7a5a3a, 0x3d2b1f, 0, Y); addPoi(T.x - 34, -946, 'dealer', 'Der Franz', '🌿');
  sign('Hinterstadt', 0.8, T.x - 12, Y + 2.2, -941, 0);
  // Bahnhof + Westbahn
  house(T.x - 70, -968, 28, 8, 6, 0xe8d9c0, 0x55606b, 0, Y); sign('Bahnhof Vöcklabruck', 1.0, T.x - 70, Y + 4.6, -963.8, 0);
  for (const dz of [-979.5, -981]) sceneRef.add(mkBox(296, 0.18, 0.2, 0x3a3a3a, T.x, Y + 0.12, dz));
  sceneRef.add(mkBox(296, 0.06, 3.2, 0x7a7468, T.x, Y + 0.04, -980.2));
  // Maria Schoendorf auf der Anhoehe
  church(535, -952, 1.1, false); label('Maria Schöndorf', 535, -948, 38, 1.8);
  // Stadtpark an der Voeckla
  for (let i = 0; i < 14; i++) tree(T.x - 130 + i * 20 + (i % 3) * 4, -858 - (i % 2) * 8, 1 + (i % 3) * 0.2);
  for (let i = 0; i < 5; i++) bench(T.x - 100 + i * 45, -849, 0);
  sign('Stadtpark · Vöckla-Ufer', 0.8, T.x - 14, Y + 2.2, -872, Math.PI);
  // Gewerbe suedlich der Voeckla
  const dx = T.x - 80, dzz = -806;
  house(dx, dzz, 24, 13, 6.5, 0xd8c9a8, 0x5c4033, 0, Y); sign('Tischlerei Dorfner', 1.2, dx, Y + 4.8, dzz + 6.7, 0, { bg: '#5c4033', color: '#fff' });
  for (let i = 0; i < 6; i++) sceneRef.add(mkBox(4, 0.5 + (i % 3) * 0.5, 1.2, 0xc9a56b, dx - 8 + (i % 3) * 5, Y + 0.3 + (i % 3) * 0.25, dzz + 10 + Math.floor(i / 3) * 2));
  solid(dx, Y, dzz + 11, 16, 1.2, 4);
  // Tankstelle
  const gx = T.x + 40, gz = -812;
  sceneRef.add(mkBox(16, 0.5, 9, 0xd0322a, gx, Y + 5, gz));
  for (const s of [-1, 1]) { sceneRef.add(mkBox(0.5, 5, 0.5, 0xdddddd, gx + s * 6.5, Y + 2.5, gz)); solid(gx + s * 6.5, Y, gz, 0.6, 5, 0.6); sceneRef.add(mkBox(0.8, 1.6, 0.6, 0xf2b90f, gx + s * 2.5, Y + 0.8, gz)); }
  house(gx, gz + 11, 12, 6, 4, 0xf4f4f4, 0x55606b, Math.PI, Y); sign('Tankstelle', 0.9, gx, Y + 5.9, gz - 4.6, Math.PI, { bg: '#d0322a', color: '#fff' });
  house(T.x + 95, -808, 26, 14, 6, 0xe6e6e6, 0x55606b, Math.PI, Y); sign('Nah & Frisch Markt', 1.1, T.x + 95, Y + 4.8, -815.2, Math.PI, { bg: '#2e8b3a', color: '#fff' });
  scatterHouses(rnd, T.x, T.z, 34, 150);
  sign('Vöcklabruck', 1.3, 266, Y + 3, -899, -Math.PI / 2, { bg: '#fff', color: '#111' });
  npcSpots.push({ x: T.x, z: -905, r: 55, n: 16, kind: 'stadt' }, { x: T.x, z: -945, r: 30, n: 5, kind: 'stadt' }, { x: T.x - 40, z: -855, r: 60, n: 6, kind: 'park' },
    { x: dx, z: dzz + 12, r: 10, n: 3, kind: 'arbeit' }, { x: gx, z: gz + 2, r: 12, n: 2, kind: 'stadt' }, { x: T.x - 70, z: -962, r: 14, n: 4, kind: 'stadt' }, { x: T.x + 95, z: -820, r: 14, n: 4, kind: 'stadt' });
}

function buildVillages(rnd) {
  for (const p of PLACES) {
    scatterHouses(rnd, p.x, p.z, p.n, p.r);
    if (p.church) {
      for (let t = 0; t < 30; t++) {
        const x = p.x + (rnd() - 0.5) * 50, z = p.z + (rnd() - 0.5) * 50;
        if (getHeight(x, z) > 1.5 && !maskAt(x, z) && !maskAt(x, z + 11) && !pointInBoxes(x, getHeight(x, z) + 1, z, 9) && !pointInBoxes(x, getHeight(x, z) + 1, z + 10, 6)) { church(x, z, 0.8, true); break; }
      }
    }
    label(p.name, p.x, p.z, 22, 2.4);
    npcSpots.push({ x: p.x, z: p.z, r: p.r * 0.8, n: 5, kind: 'dorf' });
    if (p.lake) {
      const sh = shore(p.x, p.z);
      if (sh) {
        steg(sh, 20); lamp(sh.x - sh.dx * 5 + sh.dz * 3, sh.z - sh.dz * 5 + sh.dx * 3);
        sailboat(sh.x + sh.dx * 26 + sh.dz * 8, sh.z + sh.dz * 26 + sh.dx * 8, rnd() * 6);
        sailboat(sh.x + sh.dx * 40 - sh.dz * 12, sh.z + sh.dz * 40 - sh.dx * 12, rnd() * 6);
        const bx = sh.x - sh.dx * 9, bz = sh.z - sh.dz * 9;
        for (let i = 0; i < 3; i++) {
          const ux = bx + sh.dz * (i - 1) * 5, uz = bz + sh.dx * (i - 1) * 5, uy = getHeight(ux, uz);
          sceneRef.add(mkBox(0.1, 2.2, 0.1, 0xffffff, ux, uy + 1.1, uz));
          const c = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 8), lam([0xff5533, 0x33aaff, 0xffcc00][i])); c.position.set(ux, uy + 2.3, uz); sceneRef.add(c);
        }
        sign('Strandbad ' + p.name.split(' ')[0], 0.8, bx - sh.dx * 4, getHeight(bx - sh.dx * 4, bz - sh.dz * 4) + 2.4, bz - sh.dz * 4, sh.dx ? Math.PI / 2 : 0);
        npcSpots.push({ x: bx, z: bz, r: 9, n: 4, kind: 'bad' });
      }
    }
  }
}

function buildLandmarks(rnd) {
  // Schloss Kammer am Nordostufer
  { const sh = shore(KAMMER.x + 14, KAMMER.z) || { x: KAMMER.x, z: KAMMER.z, dx: -1, dz: 0 };
    const x = sh.x - sh.dx * 16, z = sh.z - sh.dz * 16, Y = Math.max(1.2, getHeight(x, z));
    sceneRef.add(mkBox(26, 11, 16, 0xfbf6e6, x, Y + 5.5, z)); solid(x, Y - 2, z, 26, 13, 16);
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), lam(0x8a3b2a)); rf.scale.set(21, 7, 13); rf.rotation.y = Math.PI / 4; rf.position.set(x, Y + 14.5, z); sceneRef.add(rf);
    for (const [ox, oz] of [[-13, -8], [13, -8], [-13, 8], [13, 8]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 14, 8), lam(0xfbf6e6)); t.position.set(x + ox, Y + 7, z + oz); t.castShadow = true; sceneRef.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.9, 5, 8), lam(0x8a3b2a)); c.position.set(x + ox, Y + 16.5, z + oz); sceneRef.add(c);
    }
    label('Schloss Kammer', x, z, 26, 2.2);
    for (let i = 1; i <= 6; i++) { tree(x + 14 + i * 9, z - 5, 1.2); tree(x + 14 + i * 9, z + 5, 1.2); }
    sign('Schlossallee', 0.7, x + 20, Y + 2, z, Math.PI / 2);
    house(x + 62, z + 22, 14, 9, 5, 0xf4f4f4, 0x55606b, 0); sign('Klimt-Zentrum', 0.9, x + 62, getHeight(x + 62, z + 22) + 3.8, z + 26.7, 0, { bg: '#c9a227', color: '#111' });
    npcSpots.push({ x: x + 40, z: z + 6, r: 22, n: 5, kind: 'dorf' });
  }
  // Pfahlbau-Pavillon Seewalchen
  { const pl = PLACES.find((p) => p.name.startsWith('Seewalchen')); const sh = shore(pl.x + 30, pl.z + 20);
    if (sh) { const x = sh.x - sh.dx * 8 + 14, z = sh.z - sh.dz * 8, Y = getHeight(x, z);
      for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) sceneRef.add(mkBox(0.3, 3, 0.3, 0x8a5a2f, x + ox, Y + 1.5, z + oz));
      const c = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.6, 4), lam(0xb08a4a)); c.rotation.y = Math.PI / 4; c.position.set(x, Y + 4.3, z); sceneRef.add(c);
      sign('Pfahlbau-Pavillon · UNESCO-Welterbe (Fundstelle im See)', 0.6, x, Y + 1.6, z, 0); } }
  // Gahberg: Sternwarte, Kapelle, Aussicht
  { const x = GAHBERG.x, z = GAHBERG.z - 12, Y = getHeight(x, z);
    sceneRef.add(mkBox(9, 4, 7, 0xe6e6e6, x, Y + 2, z)); solid(x, Y - 2, z, 9, 6, 7);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xf8f8f8)); dome.position.set(x, Y + 4, z); dome.castShadow = true; sceneRef.add(dome);
    sceneRef.add(mkBox(0.8, 2.6, 0.3, 0x333333, x, Y + 5.6, z + 2.2));
    label('Sternwarte Gahberg', x, z, 12, 1.8);
    const kx = x + 22, kz = z + 6, kY = getHeight(kx, kz);
    house(kx, kz, 4.5, 6, 3.6, 0xfafafa, 0x7a2f2f, 0); sceneRef.add(mkBox(0.2, 1.6, 0.2, 0xe8c040, kx, kY + 7, kz)); sceneRef.add(mkBox(0.9, 0.2, 0.2, 0xe8c040, kx, kY + 7.2, kz));
    sign('Gahbergkapelle', 0.6, kx, kY + 2.6, kz + 3.2, 0);
    sign('Aussicht: Attersee · Höllengebirge · Schafberg · Traunstein', 0.6, x - 14, getHeight(x - 14, z + 16) + 1.6, z + 16, 0.6);
    bench(x - 12, z + 20, 0.6); bench(x - 8, z + 22, 0.6);
    npcSpots.push({ x, z: z + 14, r: 18, n: 4, kind: 'wander' });
  }
  // Schneiderbauerhof (Gahbergstrasse, halbe Hoehe)
  { let x = SCHNEIDERBAUER.x, z = SCHNEIDERBAUER.z;
    for (let t = 0; t < 40 && (maskAt(x, z) || maskAt(x + 9, z + 7) || maskAt(x - 9, z - 7)); t++) z -= 2;
    const Y = getHeight(x, z);
    house(x, z, 14, 9, 5.5, 0xfaf3e0, 0x6b4a3a, 0); house(x + 17, z - 4, 12, 8, 5, 0x8a5a2f, 0x5c4033, Math.PI / 2);
    sign('Schneiderbauerhof', 0.9, x, Y + 4.4, z + 4.7, 0);
    for (let i = 0; i < 5; i++) { const cx = x - 16 - (i % 3) * 5, cz = z - 6 + Math.floor(i / 3) * 6 + i, cy = getHeight(cx, cz);
      const cow = new THREE.Group(); cow.add(mkBox(0.9, 0.9, 1.9, i % 2 ? 0x6b4a2a : 0xfafafa, 0, 1.0, 0)); cow.add(mkBox(0.5, 0.5, 0.6, 0x6b4a2a, 0, 1.3, 1.15));
      for (const [lx, lz] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) cow.add(mkBox(0.18, 0.6, 0.18, 0x3a2a1e, lx, 0.3, lz));
      cow.position.set(cx, cy, cz); cow.rotation.y = i * 1.3; sceneRef.add(cow); }
    for (let i = 0; i < 6; i++) { const hx = x + 4 + (i % 3) * 1.4, hz = z + 8 + Math.floor(i / 3) * 1.5; sceneRef.add(mkBox(0.3, 0.35, 0.45, i % 2 ? 0xffffff : 0xb5651d, hx, getHeight(hx, hz) + 0.25, hz)); }
    sceneRef.add(mkBox(3, 1.2, 1.2, 0xc9a56b, x - 9, getHeight(x - 9, z + 7) + 0.6, z + 7));
    npcSpots.push({ x: x + 4, z: z + 9, r: 12, n: 3, kind: 'hof' });
  }
  // Noehmer Stein & Beton (Betriebshof am Taleingang)
  { let x = NOEHMER.x, z = NOEHMER.z - 26; const Y = getHeight(x, z);
    house(x, z, 20, 10, 6, 0xbfc4c9, 0x55606b, 0); sign('Nöhmer Stein & Beton', 1.1, x, Y + 4.8, z + 5.2, 0, { bg: '#2b3440', color: '#fff' });
    for (let i = 0; i < 9; i++) { const sx = x - 14 + (i % 5) * 6.5, sz = z + 12 + Math.floor(i / 5) * 6, sy = getHeight(sx, sz);
      const st = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + (i % 3) * 0.5, 0), lam([0x9a9a94, 0xb5b0a4, 0x7d7a74][i % 3])); st.position.set(sx, sy + 0.8, sz); st.castShadow = true; sceneRef.add(st); }
    for (let i = 0; i < 4; i++) { const sx = x + 14, sz = z + 2 + i * 3.4; sceneRef.add(mkBox(2.6, 1.4, 2.6, 0xc8c2b4, sx, getHeight(sx, sz) + 0.7, sz)); }
    const kies = new THREE.Mesh(new THREE.ConeGeometry(5, 3.4, 8), lam(0xb9b2a0)); kies.position.set(x - 18, getHeight(x - 18, z) + 1.7, z); sceneRef.add(kies);
    npcSpots.push({ x: x, z: z + 12, r: 12, n: 3, kind: 'arbeit' });
  }
  // Nixenfall im Weissenbachtal
  { const x = NIXENFALL.x, z = NIXENFALL.z - 30, Y = getHeight(x, z + 14);
    sceneRef.add(mkBox(16, 30, 6, 0x6f6c66, x, Y + 13, z)); solid(x, Y - 4, z, 16, 34, 6);
    sceneRef.add(mkBox(2.2, 29, 0.6, 0xcfeaff, x, Y + 13.5, z + 3.2, { transparent: true, opacity: 0.85 }));
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 12), lam(0x3a9ad8)); pool.position.set(x, getHeight(x, z + 8) + 0.3, z + 8); sceneRef.add(pool);
    const nx = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 6), lam(0x2a9d8f)); nx.position.set(x + 5, getHeight(x + 5, z + 10) + 0.7, z + 10); sceneRef.add(nx);
    sign('Nixenfall – Sage: Hier badet die Nixe bei Vollmond', 0.6, x - 5, getHeight(x - 5, z + 14) + 1.6, z + 14, 0);
    label('Nixenfall', x, z + 4, 34, 1.8);
    sign('P · Wanderweg Nixenfall', 0.7, x, getHeight(x, NIXENFALL.z + 8) + 1.8, NIXENFALL.z + 8, 0, { bg: '#2f6fd0', color: '#fff' });
    npcSpots.push({ x, z: z + 16, r: 12, n: 3, kind: 'wander' });
  }
  npcSpots.push({ x: 690, z: -905, r: 30, n: 4, kind: 'arbeit' }, { x: -480, z: -590, r: 18, n: 2, kind: 'arbeit' });
}

function buildAirfield() {
  const Y = 6, ox = -380, oz = -280;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(420, 26), lam(0x3c3f46));
  rw.rotation.x = -Math.PI / 2; rw.position.set(ox, Y + 0.05, oz - 340); rw.receiveShadow = true; sceneRef.add(rw);
  const white = lam(0xf0f0f0);
  for (let i = -9; i <= 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.9), white);
    m.rotation.x = -Math.PI / 2; m.position.set(ox + i * 21, Y + 0.08, oz - 340); sceneRef.add(m);
  }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), lam(0x4a4e57));
  apron.rotation.x = -Math.PI / 2; apron.position.set(ox - 180, Y + 0.045, oz - 312); apron.receiveShadow = true; sceneRef.add(apron);
  const hx = ox - 120, hz = oz - 296;
  sceneRef.add(mkBox(30, 9, 1, 0x8f9aa6, hx, Y + 4.5, hz - 9));
  sceneRef.add(mkBox(1, 9, 18, 0x8f9aa6, hx - 15, Y + 4.5, hz));
  sceneRef.add(mkBox(1, 9, 18, 0x8f9aa6, hx + 15, Y + 4.5, hz));
  sceneRef.add(mkBox(32, 0.8, 20, 0x5f6a75, hx, Y + 9.4, hz));
  solid(hx, Y, hz - 9, 30, 9, 1); solid(hx - 15, Y, hz, 1, 9, 18); solid(hx + 15, Y, hz, 1, 9, 18);
  solid(hx, Y + 9, hz, 32, 0.8, 20);
  sign('FLUGPLATZ ATTERGAU', 1.6, hx, Y + 11, hz + 10.1, Math.PI, { bg: '#1f2a36', color: '#fff' });
  sceneRef.add(mkBox(5, 14, 5, 0xe6e6e6, ox - 70, Y + 7, oz - 296));
  sceneRef.add(mkBox(8, 3, 8, 0x66c2ff, ox - 70, Y + 15.5, oz - 296, { transparent: true, opacity: 0.75 }));
  sceneRef.add(mkBox(9, 0.6, 9, 0xcc3333, ox - 70, Y + 17.3, oz - 296));
  solid(ox - 70, Y, oz - 296, 6, 18, 6);
  sign('Aufmunitionieren: einfach hier landen & stehenbleiben', 0.8, ox - 150, Y + 2.2, oz - 291.5, Math.PI);
}

function buildSite() {
  const Y = 5, cx = 690, cz = -905;
  sign('BAUSTELLE – Graben ausdrücklich erwünscht', 1.2, cx, Y + 3, cz + 44, 0, { bg: '#ffd21f', color: '#222' });
  sceneRef.add(mkBox(6, 2.6, 2.5, 0x2f7fd0, cx - 44, Y + 1.3, cz - 30)); solid(cx - 44, Y, cz - 30, 6, 2.6, 2.5);
  sceneRef.add(mkBox(6, 2.6, 2.5, 0xd04a2f, cx - 44, Y + 1.3, cz - 24)); solid(cx - 44, Y, cz - 24, 6, 2.6, 2.5);
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), lam(0xff6a1a));
    c.position.set(cx - 25 + i * 5, Y + 0.4, cz + 40); sceneRef.add(c);
  }
  sceneRef.add(mkBox(1.4, 2.4, 1.4, 0x2a9d8f, cx - 40, Y + 1.2, cz - 38)); solid(cx - 40, Y, cz - 38, 1.4, 2.4, 1.4);
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 8), lam(0x9a9a94)); p.rotation.z = Math.PI / 2; p.position.set(cx + 36, Y + 0.6 + Math.floor(i / 3) * 1.1, cz - 30 + (i % 3) * 1.3); sceneRef.add(p); }
}

function buildTrees() {
  const rnd = mulberry(4711);
  const V = GRID + 1;
  const list = [];
  for (let n = 0; n < 90000 && list.length < 7000; n++) {
    const gi = 4 + Math.floor(rnd() * (GRID - 8)), gj = 4 + Math.floor(rnd() * (GRID - 8));
    const idx = gi + gj * V;
    const h = heights[idx];
    const x = (gi - GRID / 2) * CELL, z = (gj - GRID / 2) * CELL;
    if (h < 1.3 || h > 82 || mask[idx] || mask[idx + 1] || mask[idx - 1] || mask[idx + V] || mask[idx - V]) continue;
    if (h < 14 && rnd() > 0.16) continue;
    let bad = false;
    for (const zn of ZONES) if (Math.abs(x - zn.x) < zn.rx + 8 && Math.abs(z - zn.z) < zn.rz + 8) bad = true;
    if (bad) continue;
    if (Math.abs(heights[idx + 1] - heights[idx - 1]) > 9 || Math.abs(heights[idx + V] - heights[idx - V]) > 9) continue;
    if (pointInBoxes(x, h + 1, z, 2.5)) continue;
    list.push({ idx, x, y: h, z, s: 0.8 + rnd() * 0.9, round: h < 22 && rnd() < 0.5, c: rnd() });
  }
  const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 5);
  const coneG = new THREE.ConeGeometry(1.7, 4.6, 6);
  const ballG = new THREE.IcosahedronGeometry(2.0, 0);
  const cones = list.filter((t) => !t.round), balls = list.filter((t) => t.round);
  const trunks = new THREE.InstancedMesh(trunkG, lam(0x6b4a2a), list.length);
  const coneM = new THREE.InstancedMesh(coneG, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, cones.length));
  const ballM = new THREE.InstancedMesh(ballG, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, balls.length));
  coneM.count = cones.length; ballM.count = balls.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const treeAt = new Map();
  let ci = 0, bi = 0;
  list.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.c * 6.28);
    sc.set(t.s, t.s, t.s);
    m.compose(p.set(t.x, t.y + 1.2 * t.s, t.z), q, sc); trunks.setMatrixAt(i, m);
    let part;
    if (t.round) {
      m.compose(p.set(t.x, t.y + 3.6 * t.s, t.z), q, sc); ballM.setMatrixAt(bi, m);
      ballM.setColorAt(bi, col.setHSL(0.27 + t.c * 0.06, 0.55, 0.36 + t.c * 0.1));
      part = [ballM, bi++];
    } else {
      m.compose(p.set(t.x, t.y + 4.3 * t.s, t.z), q, sc); coneM.setMatrixAt(ci, m);
      coneM.setColorAt(ci, col.setHSL(0.36 + t.c * 0.04, 0.5, 0.24 + t.c * 0.08));
      part = [coneM, ci++];
    }
    treeAt.set(t.idx, [i, part[0], part[1]]);
  });
  for (const im of [trunks, coneM, ballM]) {
    im.castShadow = true; im.frustumCulled = false;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    sceneRef.add(im);
  }
  // Baum verschwindet, wenn darunter gegraben wird
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  editListeners.push((idx) => {
    const t = treeAt.get(idx);
    if (!t) return;
    treeAt.delete(idx);
    trunks.setMatrixAt(t[0], zero); trunks.instanceMatrix.needsUpdate = true;
    t[1].setMatrixAt(t[2], zero); t[1].instanceMatrix.needsUpdate = true;
  });
}

function buildClouds() {
  const rnd = mulberry(99);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a8f99, flatShading: true, transparent: true, opacity: 0.92 });
  cloudMat = mat;
  const geo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(18 + rnd() * 22, 8 + rnd() * 6, 14 + rnd() * 16);
      m.position.set((k - n / 2) * 20 + rnd() * 8, rnd() * 5, rnd() * 14);
      g.add(m);
    }
    g.position.set((rnd() - 0.5) * 2400, 190 + rnd() * 120, (rnd() - 0.5) * 2400);
    sceneRef.add(g); clouds.push(g);
  }
}

export function initWorld(scene, lowGfx) {
  sceneRef = scene;
  hemi = new THREE.HemisphereLight(0xcfe9ff, 0x8a7a55, 1.0);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = lowGfx !== true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(0x9fd6ff, 350, 2600);
  scene.background = new THREE.Color(0x9fd6ff);

  water = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1500), new THREE.MeshPhongMaterial({ color: 0x2fb9c6, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.74 }));
  sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f7fe0) }, bottom: { value: new THREE.Color(0x9fd6ff) } },
    vertexShader: 'varying float vh; void main(){ vh = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vh; void main(){ float t = pow(clamp(vh, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(bottom, top, t), 1.0);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -10; scene.add(sky);
  sunDisc = new THREE.Mesh(new THREE.SphereGeometry(110, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false }));
  scene.add(sunDisc);
  { const pts = []; const r = mulberry(5);
    for (let i = 0; i < 700; i++) { const a = r() * 6.283, e = Math.asin(r() * 0.95 + 0.04); pts.push(Math.cos(a) * Math.cos(e) * 3900, Math.sin(e) * 3900, Math.sin(a) * Math.cos(e) * 3900); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(stars); }
  water.rotation.x = -Math.PI / 2; water.position.set(-200, 0, 180);
  scene.add(water);
  for (const [ox, oz, w, d] of [[0, -HALF - 3000, 12000, 6000], [0, HALF + 3000, 12000, 6000], [-HALF - 3000, 0, 6000, HALF * 2], [HALF + 3000, 0, 6000, HALF * 2]]) {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lam(0x4f8a3c));
    outer.rotation.x = -Math.PI / 2; outer.position.set(ox, 3.9, oz);
    scene.add(outer);
  }
  // Fernkulisse: Hoellengebirge, Schafberg, Traunstein
  for (const [mx, mz, r, hh, c] of [[900, 1500, 520, 330, 0x8a8d92], [300, 1600, 480, 300, 0x94979c], [1700, 1100, 520, 300, 0x8a8d92], [-900, 1500, 380, 260, 0x7f8f88], [2300, 300, 420, 290, 0x8f9298], [1500, 1700, 600, 380, 0x9a9da2]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 7), lam(c)); m.position.set(mx, hh / 2, mz); scene.add(m);
    const sn = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, hh * 0.3, 7), lam(0xf4f6fa)); sn.position.set(mx, hh * 0.86, mz); scene.add(sn);
  }
  const rnd = mulberry(2024);
  buildRoadsRivers(); buildVoecklabruck(rnd); buildVillages(rnd); buildLandmarks(rnd); buildAirfield(); buildSite(); buildTrees(); buildClouds();
}

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
  sun.position.set(center.x + dirX * 160, center.y + sy * 160, center.z + dirZ * 160);
  sun.target.position.copy(center);
  sun.intensity = 0.15 + 2.2 * day;
  sun.color.setHex(0xfff1d6).lerp(cDusk, dusk * 0.6);
  hemi.intensity = 0.32 + 0.75 * day;
  sky.position.copy(center); stars.position.copy(center);
  sky.material.uniforms.bottom.value.copy(cTmp);
  sky.material.uniforms.top.value.setRGB(0.03 + 0.1 * day, 0.05 + 0.3 * day, 0.14 + 0.62 * day);
  sunDisc.position.set(center.x + dirX * 3600, center.y + el * 3600, center.z + dirZ * 3600);
  sunDisc.visible = el > -0.06;
  stars.material.opacity = Math.max(0, 1 - day * 1.6);
  const nightGlow = Math.max(0, 1 - day * 1.4);
  lam(0xbfe6ff).emissive.setRGB(1.0 * nightGlow, 0.72 * nightGlow, 0.3 * nightGlow);
  lampMat.color.setRGB(0.5 + 0.5 * nightGlow, 0.5 + 0.42 * nightGlow, 0.45 + 0.15 * nightGlow);
  water.material.color.setRGB(0.05 + 0.13 * day, 0.2 + 0.52 * day, 0.28 + 0.5 * day);
  if (cloudMat) cloudMat.emissive.setScalar(0.06 + 0.5 * day);
  for (const c of clouds) {
    c.position.x += dt * 4;
    if (c.position.x > 1300) c.position.x = -1300;
  }
  return day;
}
