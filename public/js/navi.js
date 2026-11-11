// WIBA - Navigation: schnellste Route zum Wegpunkt (wie in GTA), Linie auf Karte und Strasse
import * as THREE from 'three';
import { G } from './state.js';
import { surfaceAt } from './world.js';

export const nav = { route: null, idx: 0, pending: false, lastReq: 0, mesh: null, meshT: 0 };
const mat = new THREE.MeshBasicMaterial({ color: 0xc23cff, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });

function from() { const v = G.me.vehicle; return v ? v.pos : G.me.pos; }

export function requestRoute() {
  const wp = G.waypoint;
  if (!wp || nav.pending) return;
  nav.pending = true; nav.lastReq = performance.now();
  const p = from();
  fetch(`/route?ax=${p.x.toFixed(1)}&az=${p.z.toFixed(1)}&bx=${wp.x.toFixed(1)}&bz=${wp.z.toFixed(1)}`)
    .then((r) => r.json()).catch(() => null)
    .then((r) => {
      nav.pending = false;
      if (!G.waypoint || G.waypoint !== wp) return;
      nav.route = r && r.pts && r.pts.length >= 4 ? r : null;
      nav.idx = 0; nav.meshT = 0;
    });
}
export function clearRoute() {
  nav.route = null;
  if (nav.mesh) { G.scene.remove(nav.mesh); nav.mesh.geometry.dispose(); nav.mesh = null; }
}

// Restdistanz ab dem aktuellen Routenpunkt
export function routeLeft() {
  const r = nav.route; if (!r) return null;
  const p = from(), P = r.pts;
  let d = Math.hypot(P[nav.idx * 2] - p.x, P[nav.idx * 2 + 1] - p.z);
  for (let i = nav.idx * 2 + 2; i < P.length; i += 2) d += Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]);
  return { dist: d, time: r.dist > 0 ? (r.time * d) / r.dist : 0 };
}

let checkT = 0;
export function updateNav(dt) {
  const wp = G.waypoint;
  if (!wp) { if (nav.route || nav.mesh) clearRoute(); return; }
  const p = from();
  if (Math.hypot(wp.x - p.x, wp.z - p.z) < 25) { G.waypoint = null; clearRoute(); return; } // angekommen
  if (!nav.route) { if (!nav.pending && performance.now() - nav.lastReq > 4000) requestRoute(); return; }
  checkT -= dt;
  if (checkT <= 0) {
    checkT = 0.4;
    // naechsten Routenpunkt suchen (nur vorwaerts) und vom Weg abgekommen?
    const P = nav.route.pts;
    let best = nav.idx, bd = Infinity;
    for (let i = nav.idx; i < Math.min(P.length / 2, nav.idx + 120); i++) {
      const d = (P[i * 2] - p.x) ** 2 + (P[i * 2 + 1] - p.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best !== nav.idx) { nav.idx = best; nav.meshT = 0; }
    if (Math.sqrt(bd) > 45 && performance.now() - nav.lastReq > 2500) requestRoute();
  }
  // Linie auf der Strasse rund um den Spieler (alle 0,5 s neu)
  nav.meshT -= dt;
  if (nav.meshT > 0) return;
  nav.meshT = 0.5;
  const P = nav.route.pts, pos = [], W = 0.9;
  let used = 0, prevL = null, prevR = null;
  for (let i = nav.idx; i < P.length / 2 - 1 && used < 450; i++) {
    const ax = P[i * 2], az = P[i * 2 + 1], bx = P[i * 2 + 2], bz = P[i * 2 + 3];
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.01) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len, k = Math.max(1, Math.ceil(len / 4));
    for (let s = 0; s < k; s++) {
      const x = ax + (bx - ax) * (s / k), z = az + (bz - az) * (s / k), y = surfaceAt(x, z, 1e9) + 0.45;
      const L = [x - dz * W, y, z + dx * W], Rr = [x + dz * W, y, z - dx * W];
      if (prevL) pos.push(...prevL, ...L, ...prevR, ...prevR, ...L, ...Rr);
      prevL = L; prevR = Rr; used += len / k;
    }
  }
  if (nav.mesh) { G.scene.remove(nav.mesh); nav.mesh.geometry.dispose(); nav.mesh = null; }
  if (pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    nav.mesh = new THREE.Mesh(g, mat); nav.mesh.renderOrder = 3; nav.mesh.frustumCulled = false;
    G.scene.add(nav.mesh);
  }
}
