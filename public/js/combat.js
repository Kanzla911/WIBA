// WIBA - Schiessen, Projektile, Explosionen, Graben, Bauen, Effekte
import * as THREE from 'three';
import { G, net, invAdd, invCount, clamp } from './state.js';
import { PROJ, VEH } from './config.js';
import { getHeight, raycastTerrain, sculpt, isProtected } from './terrain.js';
import { rayBoxes, pointInBoxes, addBox, removeBox, mkBox, lam } from './world.js';
import { makeProjectile } from './models.js';
import { sfx } from './audio.js';
import { toast, toastOnce, hitmark } from './ui.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
let nextProj = 1;
const parts = [];
const fxList = [];
let flash = null;
const partGeo = new THREE.BoxGeometry(1, 1, 1);
const ballGeo = new THREE.IcosahedronGeometry(1, 1);

export function initCombat() {
  flash = new THREE.PointLight(0xffaa44, 0, 90, 1.5);
  flash.position.set(0, -500, 0);
  G.scene.add(flash);
}

export function distToCam(p) { return G.camera.position.distanceTo(p); }
export function volAt(p, range = 400) { return clamp(1 - distToCam(p) / range, 0, 1) ** 1.6; }

// ---------- Partikel / Effekte ----------
export function fxDust(pos, color, n = 6, speed = 3, size = 0.18) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 320) { const o = parts.shift(); G.scene.remove(o.m); }
    const m = new THREE.Mesh(partGeo, lam(color));
    const s = size * (0.6 + Math.random());
    m.scale.setScalar(s); m.position.copy(pos);
    G.scene.add(m);
    parts.push({ m, s, life: 0.5 + Math.random() * 0.5, max: 1, vx: (Math.random() - 0.5) * speed * 2, vy: Math.random() * speed * 1.6, vz: (Math.random() - 0.5) * speed * 2 });
  }
}
export function fxTracer(a, b, color = 0xfff2a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  G.scene.add(line);
  fxList.push({ kind: 'line', o: line, life: 0.07 });
}
export function fxExplosion(pos, scale = 1) {
  const m = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.95 }));
  m.position.copy(pos); m.scale.setScalar(0.5);
  G.scene.add(m);
  fxList.push({ kind: 'ball', o: m, life: 0.55, max: 0.55, size: 9 * scale });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(ballGeo, new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0.8, flatShading: true }));
    s.position.copy(pos).add(_v.set((Math.random() - 0.5) * 5 * scale, Math.random() * 2, (Math.random() - 0.5) * 5 * scale));
    s.scale.setScalar(1.5 * scale);
    G.scene.add(s);
    fxList.push({ kind: 'smoke', o: s, life: 1.6 + Math.random(), max: 2.6, size: (3 + Math.random() * 3) * scale });
  }
  fxDust(pos, 0x3a3028, 14, 11 * scale, 0.35);
  fxDust(pos, 0xff8a22, 8, 8 * scale, 0.25);
  flash.position.copy(pos).y += 2;
  flash.intensity = 900 * scale; flash.userData.t = 0.25;
  const v = volAt(pos, 900);
  sfx.explosion(v);
  G.me.shake = Math.max(G.me.shake, clamp(1.2 - distToCam(pos) / 70, 0, 1) * 0.9);
}
export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { G.scene.remove(p.m); parts.splice(i, 1); continue; }
    p.vy -= 14 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 4;
    p.m.scale.setScalar(p.s * Math.min(1, p.life * 3));
  }
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i];
    f.life -= dt;
    if (f.life <= 0) {
      G.scene.remove(f.o);
      if (f.kind === 'line') f.o.geometry.dispose();
      f.o.material.dispose();
      fxList.splice(i, 1);
      continue;
    }
    if (f.kind === 'ball') {
      const t = 1 - f.life / f.max;
      f.o.scale.setScalar(0.5 + f.size * Math.sqrt(t));
      f.o.material.opacity = 0.95 * (1 - t);
    } else if (f.kind === 'smoke') {
      const t = 1 - f.life / f.max;
      f.o.scale.setScalar(f.size * (0.5 + t));
      f.o.position.y += dt * 2.5;
      f.o.material.opacity = 0.75 * (1 - t);
    }
  }
  if (flash.userData.t > 0) {
    flash.userData.t -= dt;
    if (flash.userData.t <= 0) { flash.intensity = 0; flash.position.set(0, -500, 0); }
  }
}

// ---------- Hitscan ----------
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}

// o, d: THREE.Vector3 (d normalisiert). Liefert Endpunkt (neuer Vector3).
export const lastHit = { kind: null };
export function fireHitscan(o, d, range, dmg, opt = {}) {
  let best = range, kind = null, obj = null, head = false;
  const tT = raycastTerrain(o.x, o.y, o.z, d.x, d.y, d.z, range);
  if (tT >= 0 && tT < best) { best = tT; kind = 'terrain'; }
  const hb = rayBoxes(o.x, o.y, o.z, d.x, d.y, d.z, best);
  if (hb) { best = hb.t; kind = 'box'; obj = hb.box; }
  for (const p of G.players.values()) {
    if (p.dead || p.v) continue;
    const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.pos.x, p.pos.y + 1.77, p.pos.z, 0.32);
    const tb = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.pos.x, p.pos.y + 1.15, p.pos.z, 0.46);
    const tl = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.pos.x, p.pos.y + 0.45, p.pos.z, 0.4);
    let t = -1, isHead = false;
    if (tb >= 0) t = tb;
    if (tl >= 0 && (t < 0 || tl < t)) t = tl;
    if (th >= 0 && (t < 0 || th <= t)) { t = th; isHead = true; }
    if (t >= 0 && t < best) { best = t; kind = 'player'; obj = p; head = isHead; }
  }
  for (const v of G.vehicles.values()) {
    if (v.dead || v.id === opt.ignoreVeh) continue;
    const sp = VEH[v.type];
    const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, v.pos.x, v.pos.y + sp.cy, v.pos.z, sp.radius * 0.8);
    if (t >= 0 && t < best) { best = t; kind = 'veh'; obj = v; }
  }
  const end = new THREE.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
  lastHit.kind = kind;
  if (kind === 'player') {
    net.send({ t: 'hit', to: obj.id, d: Math.round(dmg * (head ? 1.8 : 1)), w: opt.weapon || 'Waffe' });
    hitmark(); sfx.hit();
    fxDust(end, 0xcc2222, 5, 2.5, 0.1);
  } else if (kind === 'veh') {
    net.send({ t: 'vdmg', id: obj.id, d: dmg * 0.6 });
    hitmark();
    fxDust(end, 0xffdd66, 4, 4, 0.08);
  } else if (kind === 'box') {
    if (obj.sid) net.send({ t: 'sdmg', id: obj.sid, d: dmg * (opt.structMul || 0.25) });
    fxDust(end, 0xaaaaaa, 3, 2.5, 0.09);
  } else if (kind === 'terrain') {
    fxDust(end, 0x7a5a3a, 3, 2.5, 0.09);
  }
  return end;
}

// ---------- Projektile ----------
export function spawnProjectile(kind, pos, vel, mine, id, ownerId, ignoreVeh) {
  const mesh = makeProjectile(kind);
  mesh.position.copy(pos);
  G.scene.add(mesh);
  const pr = {
    id: id || (G.me.id * 100000 + nextProj++), kind, mesh, mine,
    pos: pos.clone(), vel: vel.clone(), life: PROJ[kind].life, age: 0,
    owner: ownerId || G.me.id, ignoreVeh: ignoreVeh || 0, stopped: false,
  };
  G.projectiles.push(pr);
  if (mine) net.send({ t: 'proj', id: pr.id, k: kind, p: [pos.x, pos.y, pos.z], v: [vel.x, vel.y, vel.z] });
  return pr;
}
function removeProjectile(pr) {
  G.scene.remove(pr.mesh);
  const i = G.projectiles.indexOf(pr);
  if (i >= 0) G.projectiles.splice(i, 1);
}
export function removeProjectileById(id) {
  const pr = G.projectiles.find((p) => p.id === id);
  if (pr) removeProjectile(pr);
}

export function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    const spec = PROJ[pr.kind];
    pr.life -= dt; pr.age += dt;
    let hit = pr.life <= 0;
    if (!pr.stopped && !hit) {
      const speed = pr.vel.length();
      const steps = Math.max(1, Math.ceil((speed * dt) / 1.5));
      const sdt = dt / steps;
      for (let s = 0; s < steps && !hit; s++) {
        pr.vel.y -= spec.g * sdt;
        pr.pos.addScaledVector(pr.vel, sdt);
        const g = getHeight(pr.pos.x, pr.pos.z);
        if (pr.pos.y <= Math.max(g, -0.5)) {
          if (spec.bounce) {
            pr.pos.y = Math.max(g, -0.5) + 0.06;
            pr.vel.y = Math.abs(pr.vel.y) * 0.35; pr.vel.x *= 0.6; pr.vel.z *= 0.6;
            if (pr.vel.lengthSq() < 1) pr.stopped = true;
          } else { hit = true; pr.pos.y = Math.max(g, -0.5) + 0.1; }
          continue;
        }
        if (pointInBoxes(pr.pos.x, pr.pos.y, pr.pos.z, 0.1)) {
          if (spec.bounce) { pr.pos.addScaledVector(pr.vel, -sdt); pr.vel.x *= -0.3; pr.vel.z *= -0.3; pr.vel.y *= 0.3; }
          else hit = true;
          continue;
        }
        if (spec.bounce) continue;
        for (const p of G.players.values()) {
          if (p.dead || p.v || p.id === pr.owner) continue;
          if (_v.set(p.pos.x, p.pos.y + 1.1, p.pos.z).distanceToSquared(pr.pos) < 1.2) { hit = true; break; }
        }
        if (!hit) {
          for (const v of G.vehicles.values()) {
            if (v.dead || (v.id === pr.ignoreVeh && pr.age < 1.2)) continue;
            const sp = VEH[v.type];
            if (_v.set(v.pos.x, v.pos.y + sp.cy, v.pos.z).distanceToSquared(pr.pos) < sp.radius * sp.radius * 0.7) { hit = true; break; }
          }
        }
      }
    }
    pr.mesh.position.copy(pr.pos);
    if (pr.kind !== 'granate' && pr.vel.lengthSq() > 0.01) pr.mesh.lookAt(_v.copy(pr.pos).add(pr.vel));
    else { pr.mesh.rotation.x += dt * 8; }
    if (pr.kind === 'rakete' && Math.random() < 0.7) fxDust(pr.pos, 0xcccccc, 1, 0.6, 0.2);
    if (hit) {
      if (pr.mine) { removeProjectile(pr); explode(pr.pos, pr.kind, G.me.id, true, pr.id); }
      else if (pr.life <= -1.5) removeProjectile(pr);
      else pr.stopped = true;
    }
  }
}

// ---------- Explosion ----------
export function explode(pos, kind, ownerId, mine, projId) {
  const spec = PROJ[kind] || PROJ.rakete;
  fxExplosion(pos, spec.r / 9);
  if (mine) {
    net.send({ t: 'boom', id: projId || 0, k: kind, p: [pos.x, pos.y, pos.z] });
    const g = getHeight(pos.x, pos.z);
    if (pos.y - g < 3 && !isProtected(pos.x, pos.z)) {
      const res = sculpt(pos.x, pos.z, spec.r * 0.5, spec.crater);
      if (res.edits.length) net.send({ t: 'dig', e: res.edits });
    }
    for (const v of G.vehicles.values()) {
      if (v.dead) continue;
      const sp = VEH[v.type];
      const d = _v.set(v.pos.x, v.pos.y + sp.cy, v.pos.z).distanceTo(pos);
      const R = spec.r + sp.radius * 0.6;
      if (d < R) net.send({ t: 'vdmg', id: v.id, d: spec.dmg * 1.3 * (1 - d / R) });
    }
    for (const s of G.structs.values()) {
      const b = s.box;
      const d = _v.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2).distanceTo(pos);
      if (d < spec.r) net.send({ t: 'sdmg', id: s.id, d: spec.dmg * 1.6 * (1 - d / spec.r) });
    }
  }
  // Eigener Schaden (jeder Client rechnet fuer sich, inkl. Deckung)
  const me = G.me;
  if (!me.dead && !me.vehicle) {
    _v.set(me.pos.x, me.pos.y + 1.1, me.pos.z);
    const d = _v.distanceTo(pos);
    if (d < spec.r) {
      let dmg = spec.dmg * (1 - d / spec.r);
      if (d > 0.5) {
        _v2.copy(_v).sub(pos); _v2.y -= 0.6; _v2.normalize();
        const tT = raycastTerrain(pos.x, pos.y + 0.6, pos.z, _v2.x, _v2.y, _v2.z, d);
        const tB = rayBoxes(pos.x, pos.y + 0.6, pos.z, _v2.x, _v2.y, _v2.z, d - 0.3);
        if ((tT >= 0 && tT < d - 0.4) || tB) { dmg *= 0.12; toastOnce('cover', 'Der Bunker hält! 💪', 'good', 4000); }
      }
      if (dmg >= 1) {
        net.send({ t: 'selfdmg', d: Math.round(dmg), by: ownerId, w: spec.name });
        _v2.copy(_v).sub(pos).normalize();
        me.vel.addScaledVector(_v2, 8 * (1 - d / spec.r)); me.vel.y += 4 * (1 - d / spec.r);
      }
    }
  }
}

// ---------- Graben & Auffuellen ----------
export function doDig(x, z, radius, amount, lootMul) {
  if (isProtected(x, z)) { toastOnce('prot', 'Hier wird nicht gegraben! (Ortsgebiet / Flugplatz)', 'bad'); sfx.deny(); return false; }
  const res = sculpt(x, z, radius, amount);
  if (!res.edits.length) { toastOnce('rock', 'Fels! Tiefer geht’s hier nicht.', 'bad'); return false; }
  net.send({ t: 'dig', e: res.edits });
  if (invCount('erde') < 600) invAdd('erde', Math.max(1, Math.round(res.moved * lootMul)));
  const bonus = 1 + Math.min(2, Math.max(0, res.depth) / 5);
  const rolls = Math.max(1, Math.round(res.moved * lootMul * 0.5));
  const got = { eisen: 0, kohle: 0, schwefel: 0 };
  for (let i = 0; i < rolls; i++) {
    const r = Math.random();
    if (r < 0.10 * bonus) got.eisen++; else if (r < 0.17 * bonus) got.kohle++; else if (r < 0.22 * bonus) got.schwefel++;
  }
  const txt = [];
  if (got.eisen) { invAdd('eisen', got.eisen); txt.push(`+${got.eisen} Eisenerz`); }
  if (got.kohle) { invAdd('kohle', got.kohle); txt.push(`+${got.kohle} Kohle`); }
  if (got.schwefel) { invAdd('schwefel', got.schwefel); txt.push(`+${got.schwefel} Schwefel`); }
  if (txt.length) toast('⛏️ ' + txt.join(', '), 'good');
  sfx.dig();
  fxDust(_v.set(x, getHeight(x, z) + 0.3, z), 0x7a5a3a, 7, 3.5, 0.22);
  return true;
}
export function doFill(x, z, radius, amount) {
  if (isProtected(x, z)) { toastOnce('prot', 'Hier wird nix aufgeschüttet! (Ortsgebiet / Flugplatz)', 'bad'); sfx.deny(); return false; }
  if (invCount('erde') < 2) { toastOnce('noerde', 'Keine Erde dabei – erst graben!', 'bad'); return false; }
  const res = sculpt(x, z, radius, -amount);
  if (!res.edits.length) return false;
  net.send({ t: 'dig', e: res.edits });
  invAdd('erde', -Math.min(invCount('erde'), Math.max(1, Math.ceil(res.moved))));
  sfx.dig(0.7);
  fxDust(_v.set(x, getHeight(x, z) + 0.5, z), 0x8a6a4a, 5, 2.5, 0.2);
  return true;
}

export function awardWiba(n, euro, text) {
  G.me.wiba += n; G.me.money += euro;
  net.send({ t: 'wiba', n });
  toast(`🍌 +${n} WIBA-Punkt – ${text} (+${euro} €)`, 'good');
  sfx.wiba();
}

// ---------- Bauteile ----------
export function structDims(k, r) {
  if (k === 'platte') return { w: 5, h: 0.4, d: 5, yOff: -0.4 };
  return r ? { w: 0.5, h: 3, d: 5, yOff: 0 } : { w: 5, h: 3, d: 0.5, yOff: 0 };
}
export function addStruct(s) {
  if (G.structs.has(s.id)) return;
  const dm = structDims(s.k, s.r);
  const shade = 0xa9abae - ((s.id * 7) % 5) * 0x030303;
  const mesh = mkBox(dm.w, dm.h, dm.d, shade, s.x, s.y + dm.yOff + dm.h / 2, s.z);
  G.scene.add(mesh);
  const box = addBox({
    x0: s.x - dm.w / 2, x1: s.x + dm.w / 2, y0: s.y + dm.yOff, y1: s.y + dm.yOff + dm.h,
    z0: s.z - dm.d / 2, z1: s.z + dm.d / 2, sid: s.id,
  });
  G.structs.set(s.id, { id: s.id, k: s.k, mesh, box });
}
export function removeStruct(id) {
  const s = G.structs.get(id);
  if (!s) return;
  G.scene.remove(s.mesh); removeBox(s.box);
  G.structs.delete(id);
  fxDust(s.mesh.position, 0x999999, 10, 4, 0.3);
}
// Liefert Platzierungsposition fuer ein Bauteil anhand des Blickstrahls
export function buildTarget(kind, rot, o, d) {
  let t = 6;
  const tT = raycastTerrain(o.x, o.y, o.z, d.x, d.y, d.z, 6);
  if (tT >= 0) t = Math.min(t, tT);
  const hb = rayBoxes(o.x, o.y, o.z, d.x, d.y, d.z, t);
  if (hb) t = hb.t;
  t = Math.max(1.5, t);
  const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
  let x, z;
  if (kind === 'platte') { x = Math.round(px / 5) * 5; z = Math.round(pz / 5) * 5; }
  else if (rot) { x = Math.round((px - 2.5) / 5) * 5 + 2.5; z = Math.round(pz / 5) * 5; }
  else { x = Math.round(px / 5) * 5; z = Math.round((pz - 2.5) / 5) * 5 + 2.5; }
  const y = Math.ceil(py * 2 - 0.2) / 2;
  return { x, y, z };
}
