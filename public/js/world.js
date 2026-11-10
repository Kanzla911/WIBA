// WIBA - Welt: Himmel, Licht, Wasser, Dorf, Flugplatz, Baustelle, Baeume, Kollisionsboxen
import * as THREE from 'three';
import { HALF, GRID, CELL, ZONES } from './config.js';
import { getHeight, heights, editListeners } from './terrain.js';

export const boxes = []; // {x0,y0,z0,x1,y1,z1, sid?}
export const pois = []; // {x,y,z,kind,label}
export let sun = null, hemi = null, water = null;
const clouds = [];
let cloudMat = null;
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

function house(x, z, w, d, h, color, roofColor, ry = 0) {
  const g = new THREE.Group();
  const Y = 6;
  g.add(mkBox(w, h, d, color, 0, h / 2, 0));
  // Satteldach
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), lam(roofColor));
  roof.scale.set(w * 0.78, h * 0.55, d * 0.78);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + h * 0.275;
  roof.castShadow = true;
  g.add(roof);
  // Tuer + Fenster
  g.add(mkBox(1.3, 2.2, 0.15, 0x5a3a22, 0, 1.1, d / 2 + 0.03));
  const nWin = Math.max(1, Math.floor(w / 4));
  for (let i = 0; i < nWin; i++) {
    const wx = -w / 2 + (i + 0.5) * (w / nWin);
    if (Math.abs(wx) < 1.4) continue;
    g.add(mkBox(1.2, 1.2, 0.12, 0xbfe6ff, wx, h * 0.55, d / 2 + 0.03));
    g.add(mkBox(1.2, 1.2, 0.12, 0xbfe6ff, wx, h * 0.55, -d / 2 - 0.03));
  }
  g.position.set(x, Y, z);
  g.rotation.y = ry;
  sceneRef.add(g);
  const sw = ry ? d : w, sd = ry ? w : d;
  solid(x, Y, z, sw, h + 1.5, sd);
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
  ring.position.set(x, y + 0.08, z);
  sceneRef.add(ring);
}

function buildTown() {
  const Y = 6;
  // Strassen
  const road = lam(0x55555c);
  const mkRoad = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road);
    m.rotation.x = -Math.PI / 2; m.position.set(x, Y + 0.04, z); m.receiveShadow = true;
    sceneRef.add(m);
  };
  mkRoad(0, 0, 190, 9); mkRoad(0, 22.5, 9, 145);
  // Dorfplatz
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(17, 20), lam(0xcdbf9f));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, Y + 0.06, 0); plaza.receiveShadow = true;
  sceneRef.add(plaza);
  // Maibaum
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 22, 6), lam(0xf2f2f2));
  pole.position.set(0, Y + 11, 0); pole.castShadow = true; sceneRef.add(pole);
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.2, 6), lam(0x2f6fd0));
    st.position.set(0, Y + 2 + i * 3.4, 0); sceneRef.add(st);
  }
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.28, 5, 10), lam(0x2e8b3a));
  wreath.rotation.x = Math.PI / 2; wreath.position.set(0, Y + 18, 0); sceneRef.add(wreath);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3, 6), lam(0x2e8b3a));
  top.position.set(0, Y + 23, 0); sceneRef.add(top);
  solid(0, Y, 0, 0.8, 22, 0.8);
  sign('WIBA', 1.6, 0, Y + 4.2, 0.4, 0, { bg: '#ffd21f', color: '#222' });
  sign('WIBA', 1.6, 0, Y + 4.2, -0.4, Math.PI, { bg: '#ffd21f', color: '#222' });

  // Wirtshaus
  house(-34, -30, 20, 13, 7, 0xf3e3b5, 0x8a3b2a);
  sign('Wirtshaus „Zum Faulen Bagger“', 1.1, -34, Y + 5.2, -23.3, 0);
  addPoi(-34, -20.5, 'wirt', 'Wirtshaus', '🍺');
  // Biertische
  for (let i = 0; i < 3; i++) {
    const tx = -44 + i * 5, tz = -17;
    sceneRef.add(mkBox(2.6, 0.12, 0.9, 0xb98a4f, tx, Y + 0.85, tz));
    sceneRef.add(mkBox(2.6, 0.1, 0.4, 0xb98a4f, tx, Y + 0.5, tz - 0.9));
    sceneRef.add(mkBox(2.6, 0.1, 0.4, 0xb98a4f, tx, Y + 0.5, tz + 0.9));
    sceneRef.add(mkBox(0.12, 0.85, 0.7, 0x6b4a2a, tx - 1.1, Y + 0.42, tz));
    sceneRef.add(mkBox(0.12, 0.85, 0.7, 0x6b4a2a, tx + 1.1, Y + 0.42, tz));
  }
  // Werkstatt
  house(36, -30, 18, 14, 6, 0x9fb3c8, 0x4a5560);
  sign('WERKSTATT', 1.2, 36, Y + 4.6, -22.8, 0, { bg: '#2b3440', color: '#ffd21f' });
  addPoi(36, -20, 'werk', 'Werkbank', '🔧');
  sceneRef.add(mkBox(3, 1, 1.2, 0x6b5a48, 36, Y + 0.5, -21.6));
  // Schrotthandel
  house(38, 32, 20, 14, 6, 0xc98f5a, 0x5c4033);
  sign('Schrotthandel Hintermoser', 1.1, 38, Y + 4.6, 24.8, Math.PI);
  addPoi(38, 22, 'handel', 'Schrotthandel', '💰');
  for (let i = 0; i < 5; i++) sceneRef.add(mkBox(1.4, 1.2 + (i % 3) * 0.5, 1.4, [0x8a5a3a, 0x777f88, 0x996633][i % 3], 26 + i * 1.7, Y + 0.6 + (i % 3) * 0.25, 23));
  // Dealer-Stadl
  house(-62, 44, 12, 10, 5, 0x7a5a3a, 0x3d2b1f, Math.PI / 2);
  addPoi(-52.5, 44, 'dealer', 'Der Franz', '🌿');
  // Kirche mit Zwiebelturm
  house(0, -72, 14, 24, 10, 0xfafafa, 0x7a2f2f);
  sceneRef.add(mkBox(6, 22, 6, 0xfafafa, 0, Y + 11, -56));
  solid(0, Y, -56, 6, 24, 6);
  const onion = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 6), lam(0x2f6f5a));
  onion.scale.y = 1.25; onion.position.set(0, Y + 25.5, -56); onion.castShadow = true; sceneRef.add(onion);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 6), lam(0x2f6f5a));
  spire.position.set(0, Y + 32, -56); sceneRef.add(spire);
  sceneRef.add(mkBox(0.25, 2.4, 0.25, 0xe8c040, 0, Y + 36, -56));
  sceneRef.add(mkBox(1.4, 0.25, 0.25, 0xe8c040, 0, Y + 36.3, -56));
  // Wohnhaeuser
  const cols = [0xf7d9c4, 0xd9ead3, 0xfff2cc, 0xd0e0f0, 0xf4cccc, 0xe6d5f5];
  const roofs = [0x8a3b2a, 0x6b4a3a, 0x7a2f2f, 0x55606b];
  const spots = [
    [-70, -34, 12, 10, 0], [-72, -60, 11, 11, 0], [-40, -64, 12, 10, 0], [70, -34, 12, 11, 0], [72, -62, 11, 10, 0],
    [42, -66, 12, 10, 0], [-34, 34, 13, 10, 0], [-36, 66, 12, 11, 0], [-70, 74, 11, 10, 0], [72, 34, 11, 12, 0],
    [70, 66, 12, 10, 0], [40, 68, 13, 11, 0], [-84, 10, 10, 12, 1], [84, 12, 10, 12, 1], [-84, -12, 10, 11, 1],
  ];
  spots.forEach((s, i) => house(s[0], s[1], s[2], s[3], 5 + (i % 3), cols[i % cols.length], roofs[i % roofs.length], s[4] ? Math.PI / 2 : 0));
  // Brunnen
  const well = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1, 10), lam(0x9a9a9a));
  well.position.set(10, Y + 0.5, 10); well.castShadow = true; sceneRef.add(well);
  const ww = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 10), lam(0x4aa3df));
  ww.position.set(10, Y + 0.95, 10); sceneRef.add(ww);
  solid(10, Y, 10, 4, 1, 4);
  sign('Ortsgebiet FAULENBACH – Hier wird nix g’arbeitet', 1.0, 0, Y + 3, 96, Math.PI);
}

function buildAirfield() {
  const Y = 8;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(420, 26), lam(0x3c3f46));
  rw.rotation.x = -Math.PI / 2; rw.position.set(0, Y + 0.05, -340); rw.receiveShadow = true; sceneRef.add(rw);
  const white = lam(0xf0f0f0);
  for (let i = -9; i <= 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.9), white);
    m.rotation.x = -Math.PI / 2; m.position.set(i * 21, Y + 0.08, -340); sceneRef.add(m);
  }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), lam(0x4a4e57));
  apron.rotation.x = -Math.PI / 2; apron.position.set(-180, Y + 0.045, -312); apron.receiveShadow = true; sceneRef.add(apron);
  // Hangar
  const hx = -120, hz = -296;
  sceneRef.add(mkBox(30, 9, 1, 0x8f9aa6, hx, Y + 4.5, hz - 9));
  sceneRef.add(mkBox(1, 9, 18, 0x8f9aa6, hx - 15, Y + 4.5, hz));
  sceneRef.add(mkBox(1, 9, 18, 0x8f9aa6, hx + 15, Y + 4.5, hz));
  sceneRef.add(mkBox(32, 0.8, 20, 0x5f6a75, hx, Y + 9.4, hz));
  solid(hx, Y, hz - 9, 30, 9, 1); solid(hx - 15, Y, hz, 1, 9, 18); solid(hx + 15, Y, hz, 1, 9, 18);
  solid(hx, Y + 9, hz, 32, 0.8, 20);
  sign('FLUGPLATZ FAULENBACH', 1.6, hx, Y + 11, hz + 10.1, Math.PI, { bg: '#1f2a36', color: '#fff' });
  // Tower
  sceneRef.add(mkBox(5, 14, 5, 0xe6e6e6, -70, Y + 7, -296));
  sceneRef.add(mkBox(8, 3, 8, 0x66c2ff, -70, Y + 15.5, -296, { transparent: true, opacity: 0.75 }));
  sceneRef.add(mkBox(9, 0.6, 9, 0xcc3333, -70, Y + 17.3, -296));
  solid(-70, Y, -296, 6, 18, 6);
  sign('Aufmunitionieren: einfach hier landen & stehenbleiben', 0.8, -150, Y + 2.2, -291.5, Math.PI);
}

function buildSite() {
  const Y = 7;
  const cx = 230, cz = 120;
  sign('BAUSTELLE – Graben ausdrücklich erwünscht', 1.2, cx - 40, Y + 3, cz - 52, 0, { bg: '#ffd21f', color: '#222' });
  sceneRef.add(mkBox(0.3, 3, 0.3, 0x555555, cx - 40, Y + 1.5, cz - 52.2));
  // Container
  sceneRef.add(mkBox(6, 2.6, 2.5, 0x2f7fd0, cx - 50, Y + 1.3, cz - 30)); solid(cx - 50, Y, cz - 30, 6, 2.6, 2.5);
  sceneRef.add(mkBox(6, 2.6, 2.5, 0xd04a2f, cx - 50, Y + 1.3, cz - 24)); solid(cx - 50, Y, cz - 24, 6, 2.6, 2.5);
  // Huetchen
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), lam(0xff6a1a));
    c.position.set(cx - 55 + i * 5, Y + 0.4, cz - 45); sceneRef.add(c);
  }
  // Dixi-Klo
  sceneRef.add(mkBox(1.4, 2.4, 1.4, 0x2a9d8f, cx - 42, Y + 1.2, cz - 36)); solid(cx - 42, Y, cz - 36, 1.4, 2.4, 1.4);
}

function buildTrees() {
  const rnd = mulberry(4711);
  const V = GRID + 1;
  const list = [];
  for (let n = 0; n < 9000 && list.length < 1500; n++) {
    const gi = 6 + Math.floor(rnd() * (GRID - 12)), gj = 6 + Math.floor(rnd() * (GRID - 12));
    const idx = gi + gj * V;
    const h = heights[idx];
    const x = (gi - GRID / 2) * CELL, z = (gj - GRID / 2) * CELL;
    if (h < 2.2 || h > 36) continue;
    let bad = false;
    for (const zn of ZONES) if (Math.abs(x - zn.x) < zn.rx + 14 && Math.abs(z - zn.z) < zn.rz + 14) bad = true;
    if (bad) continue;
    if (Math.abs(heights[idx + 1] - heights[idx - 1]) > 3 || Math.abs(heights[idx + V] - heights[idx - V]) > 3) continue;
    list.push({ idx, x, y: h, z, s: 0.8 + rnd() * 0.9, round: h < 16 && rnd() < 0.55, c: rnd() });
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
  scene.fog = new THREE.Fog(0x9fd6ff, 250, 1500);
  scene.background = new THREE.Color(0x9fd6ff);

  water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ color: 0x2f8fd6, transparent: true, opacity: 0.82 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0;
  scene.add(water);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), lam(0x1d5f96));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -13.9;
  scene.add(floor);

  buildTown(); buildAirfield(); buildSite(); buildTrees(); buildClouds();
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
  if (cloudMat) cloudMat.emissive.setScalar(0.06 + 0.5 * day);
  for (const c of clouds) {
    c.position.x += dt * 4;
    if (c.position.x > 1300) c.position.x = -1300;
  }
  return day;
}
