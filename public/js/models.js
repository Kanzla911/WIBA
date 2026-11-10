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
  const steel = std(0x1f2124, 0.38, 0.85), wood = std(0x6b4526, 0.75), poly = std(0x16171a, 0.6, 0.2);
  const tube = (r, len, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; return m; };
  switch (id) {
    case 'schaufel': {
      g.add(tube(0.02, 1.15, std(0x9a6b3a, 0.7), 0, 0, -0.22));
      const bl = extrudeSide([[-1.18, 0], [-1.1, 0.012], [-0.78, 0.02], [-0.76, -0.012], [-1.1, -0.012]], 0.24, 0.006, std(0x8d99a6, 0.35, 0.9)); g.add(bl);
      const gr = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 14), poly); gr.position.set(0, 0, 0.4); gr.rotation.y = Math.PI / 2; g.add(gr);
      break;
    }
    case 'banane': {
      const pts = []; for (let i = 0; i <= 12; i++) { const a = -0.8 + i * 0.133; pts.push(new THREE.Vector3(0, Math.cos(a) * 0.17 - 0.17, -Math.sin(a) * 0.17)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 24, 0.03, 10, false);
      const pos = geo.attributes.position; // zu den Enden verjuengen
      for (let i = 0; i < pos.count; i++) {
        const ring = Math.floor(i / 11), t = ring / 24, c = curve.getPoint(t), k = 0.35 + 0.65 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) ** 0.6;
        pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, std(0xf5cf1c, 0.5)); m.castShadow = true; g.add(m);
      const e0 = curve.getPoint(0), e1 = curve.getPoint(1);
      g.add(part(avatarGeo().sphere, std(0x4a3212, 0.8), e0.x, e0.y, e0.z, 0.013, 0.013, 0.022)); g.add(part(avatarGeo().sphere, std(0x6b5a1a, 0.8), e1.x, e1.y, e1.z, 0.012, 0.012, 0.012));
      break;
    }
    case 'pistole':
      g.add(extrudeSide([[-0.27, 0.085], [0.05, 0.085], [0.06, 0.03], [-0.02, 0.02], [-0.27, 0.02]], 0.034, 0.005, steel));
      g.add(extrudeSide([[-0.06, 0.02], [0.05, 0.03], [0.085, -0.13], [0.02, -0.14], [-0.01, -0.03], [-0.07, -0.02]], 0.03, 0.006, poly));
      g.add(tube(0.008, 0.02, steel, 0, 0.055, -0.28));
      break;
    case 'schrot':
      g.add(tube(0.017, 0.74, steel, 0, 0.045, -0.5)); g.add(tube(0.02, 0.5, steel, 0, 0.012, -0.38));
      g.add(extrudeSide([[-0.6, 0.0], [-0.36, 0.0], [-0.36, -0.03], [-0.6, -0.03]], 0.05, 0.008, wood));
      g.add(extrudeSide([[-0.14, 0.07], [0.02, 0.07], [0.1, 0.03], [0.44, 0.0], [0.44, -0.12], [0.12, -0.05], [0.04, -0.12], [-0.02, -0.11], [0.0, -0.01], [-0.14, -0.01]], 0.045, 0.008, wood));
      break;
    case 'stg':
      g.add(extrudeSide([[-0.5, 0.075], [0.06, 0.075], [0.06, 0.0], [-0.5, 0.0]], 0.05, 0.006, steel));
      g.add(tube(0.011, 0.34, steel, 0, 0.04, -0.66)); g.add(tube(0.017, 0.07, steel, 0, 0.04, -0.85));
      g.add(extrudeSide([[-0.48, 0.0], [-0.2, 0.0], [-0.2, -0.035], [-0.48, -0.035]], 0.055, 0.008, poly));
      g.add(extrudeSide([[-0.2, 0.0], [-0.12, 0.0], [-0.14, -0.21], [-0.21, -0.22]], 0.035, 0.004, steel));
      g.add(extrudeSide([[-0.02, 0.0], [0.05, 0.0], [0.09, -0.14], [0.03, -0.15]], 0.034, 0.006, poly));
      g.add(extrudeSide([[0.06, 0.07], [0.38, 0.055], [0.38, -0.06], [0.3, -0.06], [0.2, 0.0], [0.06, 0.0]], 0.04, 0.006, poly));
      g.add(extrudeSide([[-0.3, 0.075], [-0.12, 0.075], [-0.12, 0.1], [-0.3, 0.1]], 0.02, 0.003, steel));
      break;
    case 'pzf':
      g.add(tube(0.045, 1.25, std(0x4a5a3a, 0.6, 0.3), 0, 0.06, -0.2));
      { const w = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3, 16), std(0x5a3a2a, 0.5, 0.3)); w.rotation.x = -Math.PI / 2; w.position.set(0, 0.06, -0.97); w.castShadow = true; g.add(w); }
      g.add(extrudeSide([[-0.14, 0.02], [-0.07, 0.02], [-0.04, -0.12], [-0.11, -0.12]], 0.03, 0.005, poly));
      g.add(tube(0.06, 0.1, std(0x2e3a26, 0.6, 0.3), 0, 0.06, 0.42));
      break;
    case 'granate':
      g.add(part(avatarGeo().sphere, std(0x3f5a2a, 0.6, 0.3), 0, 0, 0, 0.055, 0.068, 0.055));
      g.add(part(new THREE.CylinderGeometry(0.02, 0.022, 0.04, 10), steel, 0, 0.075, 0));
      { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 12), std(0xb9bcc2, 0.3, 0.9)); r.position.set(0.03, 0.09, 0); g.add(r); }
      break;
    case 'bier': {
      const b = lathe([[-0.1, 0.001], [-0.1, 0.032], [0.02, 0.033], [0.06, 0.016], [0.13, 0.013], [0.135, 0.015], [0.14, 0.001]], std(0x5a2f0e, 0.15, 0.1, { transparent: true, opacity: 0.92 }), 16);
      b.rotation.x = -Math.PI / 2; g.add(b);
      g.add(part(new THREE.CylinderGeometry(0.0335, 0.0335, 0.06, 16, 1, true), std(0xf2e6c2, 0.7), 0, -0.03, 0));
      g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 12), std(0xc9a227, 0.3, 0.9), 0, 0.142, 0));
      break;
    }
    case 'schnaps': {
      const b = lathe([[-0.07, 0.001], [-0.07, 0.03], [0.03, 0.03], [0.05, 0.012], [0.09, 0.011], [0.095, 0.001]], std(0xf6c66a, 0.08, 0.1, { transparent: true, opacity: 0.75 }), 14);
      b.rotation.x = -Math.PI / 2; g.add(b);
      g.add(part(new THREE.CylinderGeometry(0.013, 0.013, 0.02, 10), std(0x2a2a2a, 0.5), 0, 0.1, 0));
      break;
    }
    case 'semmel':
      g.add(part(avatarGeo().sphere, std(0xd9a05b, 0.8), 0, 0.012, 0, 0.1, 0.045, 0.085)); g.add(part(avatarGeo().sphere, std(0xcf9550, 0.8), 0, -0.025, 0, 0.098, 0.03, 0.083));
      g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 16), std(0xc8736a, 0.7), 0, -0.006, 0, 1, 1, 0.85));
      break;
    case 'gras':
      g.add(tube(0.006, 0.1, std(0xf5f5f0, 0.9), 0, 0, -0.05)); g.add(tube(0.0065, 0.03, std(0xd9b06a, 0.9), 0, 0, 0.012));
      g.add(part(avatarGeo().sphere, std(0xff6622, 0.5, 0, { emissive: 0xff4400, emissiveIntensity: 1.5 }), 0, 0, -0.102, 0.006, 0.006, 0.006));
      break;
    case 'pilze':
      g.add(part(new THREE.CylinderGeometry(0.014, 0.02, 0.1, 12), std(0xf2ead8, 0.8), 0, 0, 0));
      { const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc9261f, 0.5)); c.position.y = 0.04; c.castShadow = true; g.add(c);
        for (let i = 0; i < 6; i++) g.add(part(avatarGeo().sphere, std(0xffffff, 0.8), Math.cos(i * 1.05) * 0.035, 0.078, Math.sin(i * 1.05) * 0.035, 0.008, 0.004, 0.008)); }
      break;
    case 'pulver':
      g.add(extrudeSide([[-0.045, -0.06], [0.045, -0.06], [0.05, 0.06], [-0.05, 0.06]], 0.016, 0.006, std(0xf4f4f8, 0.4, 0, { transparent: true, opacity: 0.9 })));
      g.add(part(new THREE.BoxGeometry(0.03, 0.04, 0.06), std(0xffd21f, 0.6), 0, 0, 0));
      break;
    case 'platte':
      g.add(part(new THREE.BoxGeometry(0.3, 0.05, 0.3), std(0xb0b0b0, 0.95), 0, 0, -0.1));
      break;
    case 'wand':
      g.add(part(new THREE.BoxGeometry(0.3, 0.22, 0.05), std(0xb0b0b0, 0.95), 0, 0, -0.1));
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
  const yel = std(0xf0b20a, 0.45, 0.35), dark = std(0x26272b, 0.75, 0.4), steel = std(0x3c3e44, 0.5, 0.7), chrome = std(0xd5d8dc, 0.15, 1.0);
  const cylX = (r, len, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; return m; };
  // Raupenfahrwerk: Kettenprofil + Laufrollen
  for (const sx of [-1.25, 1.25]) {
    const tr = extrudeSide([[-2.3, 0.3], [-2.1, 0.75], [-1.7, 0.86], [1.7, 0.86], [2.1, 0.75], [2.3, 0.3], [2.0, 0.02], [-2.0, 0.02]], 0.72, 0.05, dark); tr.position.x = sx; group.add(tr);
    for (const z of [-1.95, 1.95]) group.add(cylX(0.36, 0.78, steel, sx, 0.42, z));
    for (const z of [-1.2, -0.4, 0.4, 1.2]) group.add(cylX(0.17, 0.78, steel, sx, 0.2, z));
    const fr = extrudeSide([[-1.6, 0.3], [1.6, 0.3], [1.5, 0.6], [-1.5, 0.6]], 0.5, 0.03, yel); fr.position.x = sx * 0.98; group.add(fr);
  }
  group.add(part(new THREE.BoxGeometry(2.0, 0.45, 2.4), steel, 0, 0.72, 0));
  group.add(part(new THREE.CylinderGeometry(0.85, 0.9, 0.28, 24), dark, 0, 1.06, 0));
  const upper = new THREE.Group(); upper.position.y = 1.2; group.add(upper);
  const hull = extrudeSide([[-2.65, 0.05], [-2.7, 0.75], [-2.4, 1.1], [-0.2, 1.1], [0.9, 0.85], [1.35, 0.4], [1.3, 0.05]], 2.7, 0.08, yel); upper.add(hull);
  upper.add(part(new THREE.BoxGeometry(2.74, 0.95, 0.5), dark, 0, 0.55, -2.55));
  // Kabine mit Verglasung
  const cab = extrudeSide([[-0.45, 1.05], [-0.45, 2.55], [0.75, 2.6], [1.12, 1.9], [1.15, 1.05]], 1.12, 0.05, yel); cab.position.x = 0.76; upper.add(cab);
  const gl = extrudeSide([[-0.36, 1.45], [-0.36, 2.46], [0.7, 2.5], [1.04, 1.88], [1.06, 1.45]], 1.16, 0, GLASS()); gl.position.x = 0.76; upper.add(gl);
  upper.add(part(new THREE.BoxGeometry(0.9, 0.9, 0.04), GLASS(), 0.76, 1.95, 1.13));
  upper.add(part(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12), dark, -0.9, 1.5, -1.5));
  upper.add(part(new THREE.BoxGeometry(0.05, 0.6, 0.05), dark, -1.3, 1.4, 1.0)); upper.add(part(new THREE.BoxGeometry(0.22, 0.14, 0.03), chrome, -1.3, 1.72, 1.0));
  // Ausleger, Stiel, Loeffel mit Hydraulikzylindern
  const boom = new THREE.Group(); boom.position.set(-0.25, 1.0, BAGGER.SZ); upper.add(boom);
  boom.add(extrudeSide([[0, -0.28], [0, 0.3], [2.3, 0.62], [BAGGER.L1 + 0.15, 0.24], [BAGGER.L1 + 0.15, -0.2], [2.5, -0.22]], 0.46, 0.04, yel));
  { const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.9, 12), steel); c1.rotation.x = 1.25; c1.position.set(0, -0.45, 1.25); boom.add(c1);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12), chrome); c2.rotation.x = 1.25; c2.position.set(0, -0.2, 2.1); boom.add(c2);
    const c3 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 12), steel); c3.rotation.x = 1.72; c3.position.set(0, 0.72, 3.3); boom.add(c3); }
  const stick = new THREE.Group(); stick.position.set(0, 0, BAGGER.L1); boom.add(stick);
  stick.add(extrudeSide([[-0.5, 0.42], [0.2, 0.4], [BAGGER.L2 + 0.1, 0.16], [BAGGER.L2 + 0.1, -0.14], [0, -0.22], [-0.5, 0.1]], 0.34, 0.03, yel));
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 12), chrome); c.rotation.x = 1.5; c.position.set(0, 0.4, 2.4); stick.add(c); }
  const bucket = new THREE.Group(); bucket.position.set(0, 0, BAGGER.L2); stick.add(bucket);
  bucket.add(extrudeSide([[-0.25, 0.3], [0.55, 0.3], [0.95, -0.1], [0.9, -0.6], [0.5, -0.98], [0.0, -0.9], [-0.25, -0.4]], 1.2, 0.03, steel));
  for (let i = -2; i <= 2; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), chrome); t.position.set(i * 0.25, -1.05, 0.6); t.rotation.x = 2.6; bucket.add(t); }
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
