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
      for (let i = 0; i < 6; i++) {
        const a = -0.6 + i * 0.24;
        const s = cyl(i === 0 || i === 5 ? 0.03 : 0.05, i === 0 || i === 5 ? 0.045 : 0.05, 0.11, 6, i === 0 ? 0x6b4a1a : 0xffdd22, 0, Math.cos(a) * 0.3 - 0.28, -Math.sin(a) * 0.3,
          { emissive: 0x000000 });
        s.rotation.x = -a + Math.PI / 2;
        s.userData.peel = i !== 0;
        g.add(s);
      }
      g.rotation.x = 0.3;
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

// ---------- Spielfigur (Bauarbeiter, schaut nach +Z, Ursprung an den Fuessen) ----------
export function makeAvatar(color) {
  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);
  const mkLimb = (x, y, len, w, c, footC) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    piv.add(mkBox(w, len, w + 0.02, c, 0, -len / 2, 0));
    if (footC !== undefined) piv.add(mkBox(w + 0.02, 0.12, w + 0.14, footC, 0, -len + 0.06, 0.05));
    body.add(piv);
    return piv;
  };
  const legL = mkLimb(0.17, 0.85, 0.85, 0.26, 0x2d3e5c, 0x3a2a1e);
  const legR = mkLimb(-0.17, 0.85, 0.85, 0.26, 0x2d3e5c, 0x3a2a1e);
  body.add(mkBox(0.66, 0.66, 0.36, 0xff7a1a, 0, 1.18, 0));
  body.add(mkBox(0.68, 0.07, 0.38, 0xfff27a, 0, 1.08, 0));
  body.add(mkBox(0.68, 0.07, 0.38, 0xfff27a, 0, 1.3, 0));
  const armL = mkLimb(0.44, 1.46, 0.68, 0.19, 0xff7a1a);
  const armR = mkLimb(-0.44, 1.46, 0.68, 0.19, 0xff7a1a);
  armL.add(mkBox(0.17, 0.14, 0.17, 0xf0c39a, 0, -0.7, 0));
  armR.add(mkBox(0.17, 0.14, 0.17, 0xf0c39a, 0, -0.7, 0));
  const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.29, 1), lam(0xf0c39a));
  skull.position.y = 0.27; skull.castShadow = true; head.add(skull);
  head.add(mkBox(0.06, 0.08, 0.04, 0x222222, 0.1, 0.31, 0.27));
  head.add(mkBox(0.06, 0.08, 0.04, 0x222222, -0.1, 0.31, 0.27));
  head.add(mkBox(0.16, 0.03, 0.04, 0x7a3b2a, 0, 0.17, 0.27));
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lam(color));
  helm.position.y = 0.33; helm.castShadow = true; head.add(helm);
  head.add(mkBox(0.5, 0.04, 0.3, color, 0, 0.35, 0.2));
  const hand = new THREE.Group(); hand.position.set(0, -0.72, 0.08); hand.rotation.x = -Math.PI / 2; hand.rotation.z = Math.PI;
  armR.add(hand);
  // Fallschirm
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff4466, { side: THREE.DoubleSide }));
  canopy.position.y = 4.2; chute.add(canopy);
  for (const [x, z] of [[1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]]) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(x, 4.3, z)]);
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

// ---------- Pritschenwagen ----------
export function makeAuto() {
  const group = new THREE.Group();
  group.add(mkBox(1.9, 0.6, 4.4, 0xc8452f, 0, 0.75, 0));
  group.add(mkBox(1.8, 0.8, 1.5, 0xc8452f, 0, 1.45, 0.5));
  group.add(mkBox(1.7, 0.55, 1.52, 0x9fd8ff, 0, 1.5, 0.5, { transparent: true, opacity: 0.75 }));
  group.add(mkBox(1.9, 0.4, 0.1, 0x8a2f1f, 0, 1.2, -2.15));
  group.add(mkBox(0.1, 0.4, 1.9, 0x8a2f1f, 0.9, 1.2, -1.2));
  group.add(mkBox(0.1, 0.4, 1.9, 0x8a2f1f, -0.9, 1.2, -1.2));
  group.add(mkBox(1.6, 0.25, 0.2, 0xdddddd, 0, 0.6, 2.25));
  group.add(mkBox(0.3, 0.18, 0.1, 0xfff6a0, 0.65, 0.9, 2.21, { emissive: 0x554400 }));
  group.add(mkBox(0.3, 0.18, 0.1, 0xfff6a0, -0.65, 0.9, 2.21, { emissive: 0x554400 }));
  const wheels = [];
  for (const [x, z] of [[1, 1.4], [-1, 1.4], [1, -1.4], [-1, -1.4]]) {
    const w = cyl(0.42, 0.42, 0.3, 8, 0x1c1c1c, x, 0.42, z); w.rotation.z = Math.PI / 2;
    group.add(w); wheels.push(w);
  }
  return { group, wheels };
}

// ---------- Propellerflieger ----------
export function makeFlieger() {
  const group = new THREE.Group();
  const b = new THREE.Group(); b.position.y = 1.1; group.add(b);
  b.add(mkBox(1.15, 1.2, 4.2, 0xf4f4f4, 0, 0, 0.4));
  b.add(mkBox(0.8, 0.8, 2.8, 0xf4f4f4, 0, 0.1, -2.9));
  b.add(mkBox(1.17, 0.3, 4.22, 0xd0322a, 0, -0.2, 0.4));
  b.add(mkBox(1.0, 0.55, 1.3, 0x9fd8ff, 0, 0.55, 0.9, { transparent: true, opacity: 0.75 }));
  b.add(mkBox(11, 0.16, 1.7, 0xd0322a, 0, 0.72, 0.7));
  b.add(mkBox(3.6, 0.12, 1.0, 0xd0322a, 0, 0.3, -4.0));
  b.add(mkBox(0.14, 1.5, 1.1, 0xd0322a, 0, 0.9, -4.0));
  b.add(mkBox(0.9, 0.9, 0.5, 0x333333, 0, 0, 2.7));
  const prop = new THREE.Group(); prop.position.set(0, 0, 3.05); b.add(prop);
  prop.add(mkBox(2.6, 0.22, 0.06, 0x222222)); prop.add(mkBox(0.22, 2.6, 0.06, 0x222222));
  for (const x of [-0.9, 0.9]) {
    group.add(mkBox(0.1, 0.7, 0.1, 0x555555, x, 0.45, 1.0));
    const w = cyl(0.3, 0.3, 0.2, 8, 0x1c1c1c, x, 0.3, 1.0); w.rotation.z = Math.PI / 2; group.add(w);
  }
  const tw = cyl(0.16, 0.16, 0.12, 6, 0x1c1c1c, 0, 0.16, -3.9); tw.rotation.z = Math.PI / 2; group.add(tw);
  return { group, prop };
}

// ---------- Kampfjet ----------
export function makeJet() {
  const group = new THREE.Group();
  const b = new THREE.Group(); b.position.y = 1.3; group.add(b);
  const G1 = 0x7d8a96, G2 = 0x5b6772;
  b.add(mkBox(1.3, 1.1, 8.5, G1, 0, 0, -0.5));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.78, 3.4, 4), lam(G2));
  nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4; nose.position.z = 5.4; nose.castShadow = true; b.add(nose);
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 5), lam(0x1f3550, { transparent: true, opacity: 0.85 }));
  can.scale.set(0.9, 0.8, 2.3); can.position.set(0, 0.55, 2.2); b.add(can);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.6, 1.6); wingShape.lineTo(4.9, -3.2); wingShape.lineTo(4.9, -4.0); wingShape.lineTo(0.6, -4.0); wingShape.closePath();
  const wgeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.14, bevelEnabled: false });
  wgeo.rotateX(Math.PI / 2); // Shape-XY -> XZ (y der Shape wird z)
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(wgeo, lam(G1, { side: THREE.DoubleSide }));
    w.scale.x = s; w.position.y = -0.05; w.castShadow = true; b.add(w);
    const fin = mkBox(0.12, 1.7, 1.8, G2, s * 0.55, 1.1, -3.9); fin.rotation.z = -s * 0.25; b.add(fin);
    b.add(mkBox(1.9, 0.1, 1.3, G2, s * 1.5, 0.0, -4.4));
    b.add(mkBox(0.2, 0.2, 2.2, 0xe8e8e8, s * 3.2, -0.25, -2.2));
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 6), new THREE.MeshBasicMaterial({ color: 0xffa233, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -6.0; b.add(flame);
  b.add(mkBox(1.0, 0.9, 0.4, 0x222222, 0, 0, -4.8));
  for (const [x, z] of [[-1.1, -1.2], [1.1, -1.2], [0, 3.0]]) {
    group.add(mkBox(0.1, 0.8, 0.1, 0x555555, x, 0.5, z));
    const w = cyl(0.26, 0.26, 0.18, 8, 0x1c1c1c, x, 0.26, z); w.rotation.z = Math.PI / 2; group.add(w);
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
