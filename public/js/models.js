// WIBA - Low-Poly-Modelle: Spielfigur, Gegenstaende, Fahrzeuge
import * as THREE from 'three';
import { lam, mkBox } from './world.js';

function cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lam(color, opts));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

// ---------- Gegenstaende (zeigen nach -Z) ----------
export function makeItem(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'schaufel': {
      const st = cyl(0.03, 0.03, 1.1, 5, 0x9a6b3a); st.rotation.x = Math.PI / 2; st.position.z = -0.25; g.add(st);
      g.add(mkBox(0.26, 0.04, 0.34, 0x8d99a6, 0, 0, -0.95));
      g.add(mkBox(0.14, 0.05, 0.08, 0x333333, 0, 0, 0.3));
      break;
    }
    case 'banane': {
      const R = 0.17;
      for (let i = 0; i < 7; i++) {
        const a = -0.75 + i * 0.25;
        const tip = i === 0 || i === 6;
        const s = cyl(tip ? 0.014 : 0.03, tip ? 0.022 : 0.03, 0.058, 6, i === 0 ? 0x5a3d16 : (i === 6 ? 0x8a7a2a : 0xffd92e),
          0, Math.cos(a) * R - R, -Math.sin(a) * R);
        s.rotation.x = -a - Math.PI / 2;
        g.add(s);
      }
      break;
    }
    case 'pistole':
      g.add(mkBox(0.06, 0.09, 0.3, 0x2b2b2e, 0, 0.03, -0.12));
      g.add(mkBox(0.055, 0.16, 0.08, 0x3a2a1e, 0, -0.07, 0.0));
      break;
    case 'schrot':
      g.add(mkBox(0.07, 0.08, 0.85, 0x33302c, 0, 0.03, -0.4));
      g.add(mkBox(0.08, 0.07, 0.25, 0x7a4a22, 0, 0.0, -0.35));
      g.add(mkBox(0.07, 0.14, 0.34, 0x7a4a22, 0, -0.04, 0.2));
      break;
    case 'stg':
      g.add(mkBox(0.07, 0.11, 0.7, 0x2a2d30, 0, 0.03, -0.3));
      g.add(mkBox(0.04, 0.04, 0.3, 0x1c1c1c, 0, 0.04, -0.78));
      g.add(mkBox(0.06, 0.22, 0.09, 0x1c1c1c, 0, -0.13, -0.25));
      g.add(mkBox(0.055, 0.15, 0.08, 0x3a2a1e, 0, -0.09, 0.0));
      g.add(mkBox(0.06, 0.1, 0.3, 0x3a2a1e, 0, 0.0, 0.2));
      break;
    case 'pzf': {
      const t = cyl(0.07, 0.07, 1.3, 7, 0x4a5a3a); t.rotation.x = Math.PI / 2; t.position.set(0, 0.06, -0.2); g.add(t);
      const w = cyl(0.02, 0.11, 0.3, 7, 0x5a3a2a); w.rotation.x = -Math.PI / 2; w.position.set(0, 0.06, -0.95); g.add(w);
      g.add(mkBox(0.05, 0.14, 0.07, 0x2b2b2b, 0, -0.05, -0.1));
      break;
    }
    case 'granate': {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), lam(0x3f5a2a)); b.castShadow = true; g.add(b);
      g.add(mkBox(0.04, 0.05, 0.04, 0x999999, 0, 0.1, 0));
      break;
    }
    case 'bier':
      g.add(cyl(0.045, 0.05, 0.2, 7, 0x6b3a12, 0, 0, 0)); g.add(cyl(0.02, 0.035, 0.1, 6, 0x6b3a12, 0, 0.15, 0));
      g.add(cyl(0.051, 0.051, 0.08, 7, 0xf2e6c2, 0, 0, 0));
      break;
    case 'schnaps':
      g.add(cyl(0.04, 0.04, 0.16, 6, 0xffb347, 0, 0, 0, { transparent: true, opacity: 0.8 })); g.add(cyl(0.015, 0.02, 0.07, 5, 0xdddddd, 0, 0.11, 0));
      break;
    case 'semmel': {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), lam(0xd9a05b)); b.scale.y = 0.6; g.add(b);
      g.add(mkBox(0.24, 0.03, 0.2, 0xc8736a, 0, 0, 0));
      break;
    }
    case 'gras': {
      const j = cyl(0.012, 0.018, 0.2, 5, 0xf5f5f0); j.rotation.x = Math.PI / 2; j.position.z = -0.08; g.add(j);
      g.add(mkBox(0.03, 0.03, 0.03, 0xff6622, 0, 0, -0.19, { emissive: 0xff4400 }));
      break;
    }
    case 'pilze':
      g.add(cyl(0.025, 0.03, 0.12, 6, 0xf2ead8, 0, 0, 0));
      { const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xd0302a)); c.position.y = 0.05; g.add(c); }
      break;
    case 'pulver':
      g.add(mkBox(0.12, 0.14, 0.03, 0xf8f8ff, 0, 0, 0)); g.add(mkBox(0.06, 0.05, 0.035, 0xffd21f, 0, 0, 0));
      break;
    case 'platte':
      g.add(mkBox(0.3, 0.05, 0.3, 0xb0b0b0, 0, 0, -0.1));
      break;
    case 'wand':
      g.add(mkBox(0.3, 0.22, 0.05, 0xb0b0b0, 0, 0, -0.1));
      break;
    default:
      break;
  }
  return g;
}

// ---------- Materialien (PBR) ----------
const stdCache = new Map();
export function std(color, rough = 0.8, metal = 0, extra) {
  const key = color + '|' + rough + '|' + metal + (extra ? JSON.stringify(extra) : '');
  let m = stdCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {})); stdCache.set(key, m); }
  return m;
}
function part(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
  return m;
}
let AG = null;
function avatarGeo() {
  if (AG) return AG;
  const V2 = (r, y) => new THREE.Vector2(r, y);
  AG = {
    sphere: new THREE.SphereGeometry(1, 20, 14),
    thigh: new THREE.CapsuleGeometry(0.078, 0.34, 6, 14), shin: new THREE.CapsuleGeometry(0.058, 0.34, 6, 14),
    uarm: new THREE.CapsuleGeometry(0.046, 0.22, 6, 12), farm: new THREE.CapsuleGeometry(0.037, 0.22, 6, 12),
    torso: new THREE.LatheGeometry([V2(0.001, 0.9), V2(0.15, 0.92), V2(0.158, 1.0), V2(0.148, 1.1), V2(0.168, 1.24), V2(0.192, 1.36), V2(0.18, 1.44), V2(0.09, 1.5), V2(0.05, 1.53), V2(0.001, 1.54)], 20),
    hips: new THREE.LatheGeometry([V2(0.001, 0.8), V2(0.13, 0.82), V2(0.162, 0.9), V2(0.163, 0.99), V2(0.152, 1.04), V2(0.001, 1.05)], 20),
    neck: new THREE.CylinderGeometry(0.048, 0.055, 0.12, 12),
    hair: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    helm: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    brim: new THREE.CylinderGeometry(0.148, 0.152, 0.014, 20),
    band: new THREE.CylinderGeometry(1, 1, 0.04, 20, 1, true),
    canopy: new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  return AG;
}
const SKINS = [0xe8b998, 0xd9a47f, 0xf0c8a8, 0xc68e6a];

// ---------- Spielfigur (schaut nach +Z, Ursprung an den Fuessen, ca. 1,80 m) ----------
export function makeAvatar(color, look) {
  const A = avatarGeo();
  const worker = !look;
  const SH = worker ? 0xf26a12 : look.shirt, PA = worker ? 0x2d3e5c : look.pants;
  const skin = std(SKINS[(color + (look ? look.shirt : 0)) % SKINS.length], 0.62);
  const shirt = std(SH, 0.9), pants = std(PA, 0.92), shoe = std(0x2a2019, 0.7), dark = std(0x1c1a18, 0.5);
  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);
  const leg = (x) => {
    const p = new THREE.Group(); p.position.set(x, 0.93, 0);
    p.add(part(A.thigh, pants, 0, -0.24, 0)); p.add(part(A.shin, pants, 0, -0.65, 0));
    p.add(part(A.sphere, shoe, 0, -0.89, 0.045, 0.062, 0.05, 0.135));
    body.add(p); return p;
  };
  const legL = leg(0.092), legR = leg(-0.092);
  body.add(part(A.hips, pants, 0, 0, 0, 1, 1, 0.7));
  body.add(part(A.torso, shirt, 0, 0, 0, 1, 1, 0.66));
  if (worker) for (const y of [1.1, 1.3]) body.add(part(A.band, std(0xf6ee6a, 0.5, 0, { emissive: 0x554a00 }), 0, y, 0, y > 1.2 ? 0.19 : 0.158, 1, y > 1.2 ? 0.127 : 0.105));
  body.add(part(A.neck, skin, 0, 1.56, 0));
  const arm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.43, 0);
    p.add(part(A.sphere, shirt, 0, 0, 0, 0.058, 0.058, 0.058));
    p.add(part(A.uarm, shirt, 0, -0.16, 0)); p.add(part(A.farm, worker ? shirt : skin, 0, -0.42, 0));
    p.add(part(A.sphere, skin, 0, -0.6, 0.005, 0.038, 0.055, 0.03));
    body.add(p); return p;
  };
  const armL = arm(0.225), armR = arm(-0.225);
  const head = new THREE.Group(); head.position.set(0, 1.6, 0); body.add(head);
  head.add(part(A.sphere, skin, 0, 0.115, 0, 0.097, 0.118, 0.106));
  head.add(part(A.sphere, skin, 0, 0.055, 0.018, 0.078, 0.075, 0.085));
  head.add(part(A.sphere, skin, 0, 0.1, 0.104, 0.016, 0.022, 0.02));
  for (const s of [-1, 1]) {
    head.add(part(A.sphere, std(0xf4f4f0, 0.3), s * 0.036, 0.132, 0.088, 0.017, 0.012, 0.012));
    head.add(part(A.sphere, dark, s * 0.036, 0.132, 0.098, 0.0075, 0.0085, 0.006));
    head.add(part(A.sphere, skin, s * 0.097, 0.115, 0, 0.012, 0.026, 0.018));
    const brow = part(A.sphere, std(look ? look.hair : 0x3a2a1e, 0.9), s * 0.037, 0.158, 0.093, 0.022, 0.005, 0.008); head.add(brow);
  }
  head.add(part(A.sphere, std(0x9c4a40, 0.6), 0, 0.058, 0.094, 0.026, 0.006, 0.01));
  if (worker) {
    const hm = std(color, 0.35, 0.05);
    head.add(part(A.helm, hm, 0, 0.14, 0, 0.122, 0.118, 0.132));
    head.add(part(A.brim, hm, 0, 0.142, 0.028, 1, 1, 1.12));
  } else {
    const h = part(A.hair, std(look.hair, 0.95), 0, 0.125, -0.008, 0.103, 0.118, 0.114); h.rotation.x = -0.32; head.add(h);
  }
  const hand = new THREE.Group(); hand.position.set(0, -0.62, 0.05); hand.rotation.x = -Math.PI / 2; hand.rotation.z = Math.PI;
  armR.add(hand);
  // Fallschirm
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(A.canopy, std(0xe8334f, 0.8, 0, { side: THREE.DoubleSide }));
  canopy.position.y = 4.2; chute.add(canopy);
  for (const [x, z] of [[1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]]) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(x, 4.3, z)]);
    chute.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x333333 })));
  }
  chute.visible = false; group.add(chute);
  let itemId = null, itemObj = null;
  return {
    group, body, legL, legR, armL, armR, head, hand, chute,
    setItem(id) {
      if (id === itemId) return;
      itemId = id;
      if (itemObj) hand.remove(itemObj);
      itemObj = id ? makeItem(id) : null;
      if (itemObj) hand.add(itemObj);
    },
  };
}

// ---------- Bagger ----------
export const BAGGER = { L1: 5.0, L2: 4.0, SY: 2.2, SZ: 1.1 };
export function makeBagger() {
  const group = new THREE.Group();
  const Y = 0xf2b90f, D = 0x2e2f33;
  for (const sx of [-1.25, 1.25]) {
    group.add(mkBox(0.75, 0.8, 4.6, D, sx, 0.4, 0));
    group.add(mkBox(0.8, 0.5, 3.6, 0x1e1f22, sx, 0.45, 0));
  }
  group.add(mkBox(2.0, 0.5, 2.8, 0x44464c, 0, 0.9, 0));
  const upper = new THREE.Group(); upper.position.y = 1.2; group.add(upper);
  upper.add(mkBox(2.7, 1.0, 3.3, Y, 0, 0.5, -0.4));
  upper.add(mkBox(2.7, 1.1, 0.9, 0x3a3b40, 0, 0.55, -2.2));
  upper.add(mkBox(1.15, 1.6, 1.5, Y, 0.72, 1.8, 0.35));
  upper.add(mkBox(1.0, 0.9, 1.52, 0x9fd8ff, 0.72, 2.0, 0.36, { transparent: true, opacity: 0.7 }));
  upper.add(mkBox(1.25, 0.1, 1.6, 0x3a3b40, 0.72, 2.65, 0.35));
  const ex = cyl(0.09, 0.09, 0.9, 6, 0x222222, -0.9, 1.4, -1.4); upper.add(ex);
  const boom = new THREE.Group(); boom.position.set(-0.25, 1.0, BAGGER.SZ); upper.add(boom);
  boom.add(mkBox(0.5, 0.55, BAGGER.L1, Y, 0, 0, BAGGER.L1 / 2));
  const stick = new THREE.Group(); stick.position.set(0, 0, BAGGER.L1); boom.add(stick);
  stick.add(mkBox(0.36, 0.42, BAGGER.L2, Y, 0, 0, BAGGER.L2 / 2));
  const bucket = new THREE.Group(); bucket.position.set(0, 0, BAGGER.L2); stick.add(bucket);
  bucket.add(mkBox(1.2, 0.9, 0.9, 0x44464c, 0, -0.2, 0.2));
  for (let i = -2; i <= 2; i++) bucket.add(mkBox(0.12, 0.3, 0.14, 0xd0d0d0, i * 0.25, -0.75, 0.5));
  return { group, upper, boom, stick, bucket };
}
// r: horizontale Reichweite ab Drehpunkt, ty: Zielhoehe relativ zum Baggerursprung
export function poseBaggerArm(parts, r, ty) {
  const { L1, L2, SY, SZ } = BAGGER;
  const dz = r - SZ, dy = ty - SY;
  let d = Math.hypot(dz, dy);
  d = Math.min(L1 + L2 - 0.05, Math.max(Math.abs(L1 - L2) + 0.3, d));
  const a = Math.atan2(dy, dz);
  const th1 = a + Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const ez = Math.cos(th1) * L1, ey = Math.sin(th1) * L1;
  const tz = Math.cos(a) * d, tyy = Math.sin(a) * d;
  const th2 = Math.atan2(tyy - ey, tz - ez);
  parts.boom.rotation.x = -th1;
  parts.stick.rotation.x = th1 - th2;
  parts.bucket.rotation.x = th2 + 0.9;
}

// ---------- Hilfen fuer runde Formen ----------
function extrudeSide(pts, width, bevel, mat) {
  const sh = new THREE.Shape();
  pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function lathe(profile, mat, seg = 24) { // profile: [z, r] entlang der Laengsachse
  const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(Math.max(0.001, p[1]), p[0])), seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function wheel(r, w, x, y, z) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), std(0x151515, 0.95)); t.rotation.z = Math.PI / 2; t.castShadow = true; g.add(t);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 20), std(0xb9bcc2, 0.3, 0.9)); rim.rotation.z = Math.PI / 2; g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 12), std(0x30323a, 0.4, 0.8)); hub.rotation.z = Math.PI / 2; g.add(hub);
  g.position.set(x, y, z);
  return g;
}
const GLASS = () => std(0x0c1820, 0.06, 0.9);

// ---------- Auto (Kombi) ----------
const CAR_COLORS = [0xb3261e, 0x1f3f8a, 0xe9e9ea, 0x2b2d31, 0x8a8f96, 0x1f6b3a, 0xd6a11b];
let carN = 0;
export function makeAuto() {
  const group = new THREE.Group();
  const paint = std(CAR_COLORS[carN++ % CAR_COLORS.length], 0.32, 0.55);
  group.add(extrudeSide([[-2.12, 0.34], [-2.2, 0.62], [-2.16, 0.92], [-1.98, 1.04], [-1.62, 1.44], [-1.3, 1.5], [0.15, 1.5], [0.42, 1.44], [1.02, 1.03], [1.9, 0.94], [2.14, 0.84], [2.2, 0.6], [2.16, 0.34]], 1.78, 0.09, paint));
  group.add(extrudeSide([[-1.86, 1.07], [-1.56, 1.4], [-1.3, 1.45], [0.12, 1.45], [0.36, 1.4], [0.9, 1.06]], 1.81, 0, GLASS()));
  const trim = std(0x18191c, 0.6, 0.2);
  group.add(part(new THREE.BoxGeometry(1.8, 0.2, 0.16), trim, 0, 0.42, 2.14)); group.add(part(new THREE.BoxGeometry(1.8, 0.2, 0.16), trim, 0, 0.42, -2.14));
  group.add(part(new THREE.BoxGeometry(1.84, 0.1, 3.0), trim, 0, 0.3, 0));
  for (const s of [-1, 1]) {
    group.add(part(new THREE.BoxGeometry(0.42, 0.14, 0.08), std(0xfff8e0, 0.2, 0.1, { emissive: 0xfff0c0, emissiveIntensity: 0.9 }), s * 0.62, 0.76, 2.17));
    group.add(part(new THREE.BoxGeometry(0.36, 0.12, 0.08), std(0xc01818, 0.3, 0.1, { emissive: 0x900808, emissiveIntensity: 0.8 }), s * 0.66, 0.84, -2.18));
    group.add(part(new THREE.BoxGeometry(0.1, 0.09, 0.16), paint, s * 0.98, 1.08, 0.82));
  }
  group.add(part(new THREE.BoxGeometry(0.9, 0.16, 0.05), std(0x202226, 0.5, 0.4), 0, 0.62, 2.2));
  const wheels = [];
  for (const [x, z] of [[0.82, 1.36], [-0.82, 1.36], [0.82, -1.34], [-0.82, -1.34]]) { const w = wheel(0.34, 0.24, x, 0.34, z); group.add(w); wheels.push(w); }
  return { group, wheels };
}

// ---------- Propellerflieger ----------
export function makeFlieger() {
  const group = new THREE.Group();
  const b = new THREE.Group(); b.position.y = 1.25; group.add(b);
  const white = std(0xf2f3f5, 0.35, 0.3), red = std(0xc22a22, 0.35, 0.35);
  const fus = lathe([[-4.4, 0.05], [-4.0, 0.16], [-2.4, 0.32], [-0.9, 0.56], [0.6, 0.64], [1.9, 0.6], [2.7, 0.46], [3.0, 0.3], [3.12, 0.05]], white); fus.scale.set(0.92, 1.0, 1); b.add(fus);
  const cab = part(avatarGeo().sphere, GLASS(), 0, 0.42, 0.75, 0.5, 0.42, 1.15); b.add(cab);
  const wing = extrudeSide([[-0.75, 0], [-0.55, 0.09], [0.35, 0.11], [0.8, 0.03], [0.75, -0.04], [-0.7, -0.03]], 11, 0.04, red); wing.position.set(0, 0.74, 0.75); b.add(wing);
  const stab = extrudeSide([[-0.45, 0], [-0.3, 0.05], [0.3, 0.06], [0.5, 0.01], [-0.4, -0.02]], 3.7, 0.03, red); stab.position.set(0, 0.22, -3.95); b.add(stab);
  const fin = extrudeSide([[-0.6, 0], [-0.75, 1.35], [-0.25, 1.4], [0.75, 0]], 0.12, 0.03, red); fin.position.set(0, 0.2, -3.85); b.add(fin);
  for (const s of [-1, 1]) { const st = part(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), std(0x9aa0a8, 0.4, 0.7), s * 1.25, 0.18, 0.75); st.rotation.z = s * 1.02; b.add(st); }
  b.add(part(new THREE.ConeGeometry(0.22, 0.5, 16), std(0x2a2c30, 0.4, 0.6), 0, 0, 3.3).rotateX(Math.PI / 2));
  const prop = new THREE.Group(); prop.position.set(0, 0, 3.22); b.add(prop);
  for (const a of [0, Math.PI / 2]) { const bl = part(new THREE.BoxGeometry(2.7, 0.16, 0.035), std(0x1a1a1c, 0.5, 0.3)); bl.rotation.z = a; prop.add(bl); }
  for (const x of [-1.05, 1.05]) {
    const lg = part(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), std(0x9aa0a8, 0.4, 0.7), x * 0.8, 0.62, 1.0); lg.rotation.z = x > 0 ? -0.5 : 0.5; group.add(lg);
    group.add(wheel(0.24, 0.16, x, 0.24, 1.0));
  }
  group.add(wheel(0.13, 0.1, 0, 0.13, -3.7));
  return { group, prop };
}

// ---------- Kampfjet ----------
export function makeJet() {
  const group = new THREE.Group();
  const b = new THREE.Group(); b.position.y = 1.45; group.add(b);
  const g1 = std(0x77828d, 0.45, 0.6), g2 = std(0x59636e, 0.5, 0.6);
  const fus = lathe([[-5.3, 0.42], [-5.0, 0.56], [-3.5, 0.72], [-0.5, 0.78], [2.0, 0.7], [3.8, 0.5], [5.4, 0.22], [6.4, 0.02]], g1, 28); fus.scale.set(1.05, 0.82, 1); b.add(fus);
  b.add(part(avatarGeo().sphere, GLASS(), 0, 0.42, 2.6, 0.42, 0.42, 1.5));
  const wingPts = [[-4.0, 0.62], [-4.0, 4.9], [-3.2, 4.9], [1.7, 0.62]];
  for (const s of [1, -1]) {
    const sh = new THREE.Shape(); wingPts.forEach((p, i) => (i ? sh.lineTo(p[1] * s, p[0]) : sh.moveTo(p[1] * s, p[0]))); sh.closePath();
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.05, bevelSegments: 2 });
    wg.rotateX(Math.PI / 2);
    const w = new THREE.Mesh(wg, std(0x77828d, 0.45, 0.6, { side: THREE.DoubleSide })); w.position.y = -0.02; w.castShadow = true; b.add(w);
    const fin = extrudeSide([[-0.9, 0], [-1.3, 1.75], [-0.75, 1.8], [0.9, 0]], 0.1, 0.03, g2); fin.position.set(s * 0.58, 0.45, -3.9); fin.rotation.z = -s * 0.3; b.add(fin);
    const tail = extrudeSide([[-0.75, 0], [-0.6, 0.04], [0.65, 0.04], [0.8, 0], [-0.7, -0.03]], 2.0, 0.03, g2); tail.position.set(s * 1.55, -0.02, -4.5); b.add(tail);
    const intake = lathe([[-1.0, 0.3], [1.0, 0.3], [1.3, 0.24]], g2, 14); intake.position.set(s * 0.82, -0.2, 0.9); intake.scale.set(1, 0.8, 1); b.add(intake);
    const msl = lathe([[-1.1, 0.07], [0.9, 0.07], [1.25, 0.01]], std(0xe6e7ea, 0.4, 0.4), 10); msl.position.set(s * 3.3, -0.22, -2.3); b.add(msl);
  }
  b.add(lathe([[-5.75, 0.36], [-5.3, 0.44]], std(0x202124, 0.5, 0.8, { side: THREE.DoubleSide }), 20));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.36, 2.8, 14), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -6.9; b.add(flame);
  for (const [x, z] of [[-1.15, -1.3], [1.15, -1.3], [0, 3.2]]) {
    group.add(part(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8), std(0xa0a6ae, 0.4, 0.8), x, 0.6, z));
    group.add(wheel(0.25, 0.16, x, 0.25, z));
  }
  return { group, flame };
}

export function makeProjectile(kind) {
  if (kind === 'granate') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), lam(0x3f5a2a)); return m;
  }
  const g = new THREE.Group();
  const c = kind === 'jauche' ? 0x6b4a1a : (kind === 'bombe' ? 0x3a4a3a : 0xdddddd);
  const body = cyl(0.16, 0.16, 1.0, 6, c); body.rotation.x = Math.PI / 2; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), lam(0xcc3333)); tip.rotation.x = Math.PI / 2; tip.position.z = 0.7; g.add(tip);
  g.add(mkBox(0.6, 0.04, 0.3, 0x444444, 0, 0, -0.5)); g.add(mkBox(0.04, 0.6, 0.3, 0x444444, 0, 0, -0.5));
  return g;
}
