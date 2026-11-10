// WIBA - Fahrzeuge: Bagger, Pritschenwagen, Propellerflieger, Kampfjet
import * as THREE from 'three';
import { G, net, clamp } from './state.js';
import { VEH } from './config.js';
import { getHeight, zoneName } from './terrain.js';
import { boxes, pointInBoxes } from './world.js';
import { makeBagger, makeAuto, makeFlieger, makeJet, poseBaggerArm } from './models.js';
import { sfx, engine } from './audio.js';
import { toast, toastOnce, setVehHud, setAim } from './ui.js';
import { fireHitscan, spawnProjectile, explode, fxExplosion, fxTracer, doDig, doFill, awardWiba, fxDust } from './combat.js';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _l = new THREE.Vector3(), _t = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export function isAir(v) { return v.type === 'flieger' || v.type === 'jet'; }

export function addVehicle(d) {
  let parts;
  if (d.type === 'bagger') parts = makeBagger();
  else if (d.type === 'auto') parts = makeAuto();
  else if (d.type === 'flieger') parts = makeFlieger();
  else parts = makeJet();
  const v = {
    id: d.id, type: d.type, spec: VEH[d.type], parts, group: parts.group,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), tPos: new THREE.Vector3(), tQuat: new THREE.Quaternion(),
    driver: 0, hp: d.hp, maxHp: d.maxHp, dead: false, heading: 0,
    speed: 0, yaw: 0, pitchS: 0, rollS: 0, cab: 0, reach: 6, digT: 0, digCd: 0, idleT: 0,
    throttle: 0, stickX: 0, stickY: 0, onGround: true, vy: 0, fireCd: 0, rearmT: 0, side: 1,
    ammo: {}, sendT: 0, hitCd: 0,
  };
  G.scene.add(v.group);
  G.vehicles.set(v.id, v);
  setVehicleState(v, d);
  return v;
}
export function setVehicleState(v, d) {
  v.pos.set(d.p[0], d.p[1], d.p[2]); v.tPos.copy(v.pos);
  v.quat.set(d.q[0], d.q[1], d.q[2], d.q[3]).normalize(); v.tQuat.copy(v.quat);
  v.driver = d.driver; v.hp = d.hp; v.dead = d.dead;
  v.group.visible = !d.dead;
  v.cab = d.e[0] || 0; v.reach = d.e[1] || 6; v.digT = 0; v.throttle = 0; v.speed = 0;
  v.heading = headingOf(v.quat); v.yaw = v.heading;
  v.onGround = true; v.pitchS = 0; v.rollS = 0;
  v.ammo = Object.assign({}, v.spec.ammo || {});
  v.group.position.copy(v.pos); v.group.quaternion.copy(v.quat);
}
function headingOf(q) { _f.copy(Z).applyQuaternion(q); return Math.atan2(_f.x, _f.z); }

export function nearestVehicle(maxD) {
  let best = null, bd = maxD;
  for (const v of G.vehicles.values()) {
    if (v.dead || v.driver) continue;
    const d = Math.hypot(v.pos.x - G.me.pos.x, v.pos.z - G.me.pos.z, (v.pos.y - G.me.pos.y) * 0.5);
    const lim = maxD + v.spec.radius * 0.5;
    if (d < lim && d - v.spec.radius * 0.5 < bd) { bd = d - v.spec.radius * 0.5; best = v; }
  }
  return best;
}
export function tryEnter() {
  const v = nearestVehicle(3.6);
  if (!v) return false;
  net.send({ t: 'enter', id: v.id });
  return true;
}
function sendState(v) {
  net.send({
    t: 'v', id: v.id, p: [v.pos.x, v.pos.y, v.pos.z], q: [v.quat.x, v.quat.y, v.quat.z, v.quat.w],
    e: v.type === 'bagger' ? [v.cab, v.reach, v.digT, 0] : [v.throttle, 0, 0, 0],
  });
}
export function exitVehicle() {
  const v = G.me.vehicle;
  if (!v) return;
  const me = G.me;
  sendState(v);
  me.vehicle = null; v.driver = 0;
  net.send({ t: 'exit', id: v.id });
  engine(false);
  setVehHud(null); setAim(null, null);
  G.camera.up.set(0, 1, 0);
  me.yaw = v.heading + Math.PI; me.pitch = 0;
  if (isAir(v) && !v.onGround) {
    _f.copy(Z).applyQuaternion(v.quat);
    me.pos.copy(v.pos); me.pos.y += 2.5;
    me.vel.copy(_f).multiplyScalar(v.speed * 0.35); me.vel.y += 9;
    me.onGround = false; me.airT = 0;
    net.send({ t: 'vdmg', id: v.id, d: 99999 });
    toast('Schleudersitz! LEERTASTE = Fallschirm 🪂', 'good');
  } else {
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    const off = v.spec.radius * 0.75 + 0.8;
    me.pos.set(v.pos.x + lx * off, 0, v.pos.z + lz * off);
    me.pos.y = Math.max(getHeight(me.pos.x, me.pos.z), v.pos.y - 0.5);
    me.vel.set(0, 0, 0);
    v.speed = 0;
  }
}

// ---------- Netzwerk ----------
export function onVehDriver(m) {
  const v = G.vehicles.get(m.id);
  if (!v) return;
  v.driver = m.driver;
  if (m.driver === G.me.id) {
    G.me.vehicle = v; G.me.chute = false;
    v.yaw = v.heading; v.speed = 0; v.throttle = 0; v.stickX = 0; v.stickY = 0; v.idleT = 0; v.rearmT = 0;
    v.onGround = true;
    toast(`${v.spec.name} – F1 zeigt die Steuerung`);
  }
}
export function onVehDead(m, nameOf) {
  const v = G.vehicles.get(m.id);
  if (!v) return;
  v.dead = true; v.driver = 0; v.hp = 0; v.group.visible = false;
  fxExplosion(_t.copy(v.pos).setY(v.pos.y + 1), 1.4);
  if (G.me.vehicle === v) {
    G.me.vehicle = null;
    engine(false); setVehHud(null); setAim(null, null);
    G.camera.up.set(0, 1, 0);
    G.me.pos.copy(v.pos);
    net.send({ t: 'selfdmg', d: 999, by: m.by, w: v.spec.name + '-Wrack' });
  }
}
export function onVehHp(m) {
  const v = G.vehicles.get(m.id);
  if (!v) return;
  if (G.me.vehicle === v && m.hp < v.hp) { G.me.shake = Math.max(G.me.shake, 0.35); sfx.hurt(); }
  v.hp = m.hp;
}
export function onVehReset(m) {
  const v = G.vehicles.get(m.v.id);
  if (!v) { addVehicle(m.v); return; }
  if (G.me.vehicle === v) G.me.vehicle = null;
  setVehicleState(v, m.v);
}
export function onVehSnapshot(vs) {
  for (const a of vs) {
    const v = G.vehicles.get(a[0]);
    if (!v || v === G.me.vehicle) continue;
    v.tPos.set(a[1], a[2], a[3]);
    v.tQuat.set(a[4], a[5], a[6], a[7]).normalize();
    if (v.type === 'bagger') { v.cab = a[8]; v.reach = a[9] || 6; v.digT = a[10]; } else v.throttle = a[8];
  }
}

function crash(v, text) {
  if (v.dead) return;
  v.dead = true; v.group.visible = false;
  toast('💥 ' + text, 'bad');
  net.send({ t: 'vdmg', id: v.id, d: 99999 });
  explode(_t.copy(v.pos).setY(v.pos.y + 1), 'wrack', G.me.id, true, 0);
}

function boxBlocks(x, z, y) {
  for (const b of boxes) {
    if (x > b.x0 - 1.2 && x < b.x1 + 1.2 && z > b.z0 - 1.2 && z < b.z1 + 1.2 && b.y1 > y + 0.7 && b.y0 < y + 2.4) return true;
  }
  return false;
}

function orientGround(v, dt, snap) {
  const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
  const L = v.type === 'bagger' ? 2.2 : 1.6, W = 1.2;
  const x = v.pos.x, z = v.pos.z;
  const hf = getHeight(x + sx * L, z + cz * L), hb = getHeight(x - sx * L, z - cz * L);
  const hl = getHeight(x + lx * W, z + lz * W), hr = getHeight(x - lx * W, z - lz * W);
  const pT = clamp(-Math.atan2(hf - hb, 2 * L), -0.9, 0.9), rT = clamp(Math.atan2(hl - hr, 2 * W), -0.9, 0.9);
  const k = snap ? 1 : Math.min(1, 9 * dt);
  v.pitchS += (pT - v.pitchS) * k; v.rollS += (rT - v.rollS) * k;
  v.quat.setFromEuler(_e.set(v.pitchS, v.yaw, v.rollS, 'YXZ'));
}

function simGround(v, dt) {
  const k = G.keys, m = G.mouse, isB = v.type === 'bagger';
  const fwdIn = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), rawTurn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
  // Alkohol: verzoegerte Lenkung + Schlangenlinien
  const dr = Math.min(8, G.me.drunk);
  v.steerS = (v.steerS || 0) + (rawTurn - (v.steerS || 0)) * Math.min(1, dt * (dr > 0.5 ? 9 / (1 + dr * 0.9) : 60));
  const turnIn = v.steerS + (Math.abs(v.speed) > 1 ? Math.sin(G.time * 1.6) * 0.09 * dr + Math.sin(G.time * 0.7 + 2) * 0.05 * dr : 0);
  if (isB) {
    v.speed += clamp(fwdIn * 5.2 - v.speed, -9 * dt, 9 * dt);
    v.yaw += turnIn * 0.95 * dt;
    v.cab -= m.dx * 0.0026;
    v.reach = clamp(v.reach - m.dy * 0.012, 3.6, 8.6);
  } else {
    if (fwdIn > 0) v.speed += (v.speed < 0 ? 24 : 11) * dt;
    else if (fwdIn < 0) v.speed -= (v.speed > 0 ? 24 : 7) * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 3.5 * dt);
    v.speed = clamp(v.speed, -9, 27);
    const grip = clamp(Math.abs(v.speed) / 5, 0, 1) * (1.7 - Math.min(0.9, Math.abs(v.speed) / 28));
    v.yaw += turnIn * grip * dt * (v.speed < 0 ? -1 : 1);
  }
  const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
  const dir = Math.sign(v.speed);
  if (dir !== 0) {
    const nx = v.pos.x + sx * v.speed * dt, nz = v.pos.z + cz * v.speed * dt;
    const probe = 2.5;
    const h0 = getHeight(v.pos.x, v.pos.z), h1 = getHeight(nx + sx * probe * dir, nz + cz * probe * dir);
    const maxSlope = isB ? 1.3 : 0.8;
    if ((h1 - h0) / probe > maxSlope || h1 < -1.2 || boxBlocks(nx + sx * probe * dir * 0.8, nz + cz * probe * dir * 0.8, v.pos.y)) {
      if (Math.abs(v.speed) > 12) { net.send({ t: 'vdmg', id: v.id, d: Math.abs(v.speed) * 2 }); sfx.dig(); }
      v.speed = 0;
    } else { v.pos.x = nx; v.pos.z = nz; }
  }
  const g = getHeight(v.pos.x, v.pos.z);
  v.pos.y += (g - v.pos.y) * Math.min(1, 14 * dt);
  if (v.pos.y < g) v.pos.y = g;
  orientGround(v, dt, false);

  if (isB) {
    v.digCd -= dt; v.digT = Math.max(0, v.digT - dt * 2.3);
    const cy = v.yaw + v.cab;
    const tx = v.pos.x + Math.sin(cy) * v.reach, tz = v.pos.z + Math.cos(cy) * v.reach;
    if ((m.l || m.r) && v.digCd <= 0) {
      v.digCd = 0.45; v.digT = 1; v.idleT = 0;
      if (m.l) {
        if (doDig(tx, tz, 3.0, 0.8, 1.5)) {
          for (const p of G.players.values()) {
            if (p.dead || p.v) continue;
            if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 2.4 && Math.abs(p.pos.y - getHeight(tx, tz)) < 3) {
              net.send({ t: 'hit', to: p.id, d: 40, w: 'Baggerschaufel' });
            }
          }
        }
      } else doFill(tx, tz, 3.0, 0.8);
    }
    if (Math.abs(v.speed) < 0.3 && fwdIn === 0 && rawTurn === 0 && !m.l && !m.r) {
      v.idleT += dt;
      if (v.idleT > 12) { v.idleT = 0; awardWiba(1, 5, 'Im Bagger sitzen und nix tun'); }
    } else v.idleT = 0;
  } else {
    // Leute ueber den Haufen fahren
    v.hitCd -= dt;
    if (Math.abs(v.speed) > 7 && v.hitCd <= 0) {
      for (const p of G.players.values()) {
        if (p.dead || p.v) continue;
        if (Math.hypot(p.pos.x - v.pos.x - sx * 1.5 * dir, p.pos.z - v.pos.z - cz * 1.5 * dir) < 2.0 && Math.abs(p.pos.y - v.pos.y) < 2) {
          net.send({ t: 'hit', to: p.id, d: Math.round(Math.abs(v.speed) * 3.2), w: 'Pritschenwagen' });
          v.hitCd = 0.8; sfx.hit();
        }
      }
    }
  }
  if (G.pressed.KeyH) { sfx.horn(); net.send({ t: 'fx', k: 'horn', p: [v.pos.x, v.pos.y, v.pos.z] }); }
  engine(true, 0.8 + Math.abs(v.speed) / (isB ? 6 : 16), 0.14, false);
}

function simAir(v, dt) {
  const sp = v.spec, k = G.keys, m = G.mouse;
  v.throttle = clamp(v.throttle + ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)) * 0.6 * dt, 0, 1);
  v.stickX = clamp(v.stickX + m.dx * 0.004, -1, 1); v.stickY = clamp(v.stickY + m.dy * 0.004, -1, 1);
  const decay = Math.exp(-2.5 * dt); v.stickX *= decay; v.stickY *= decay;
  const pitchIn = clamp(v.stickY + (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0), -1, 1);
  const rollIn = clamp(v.stickX + (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), -1, 1);
  const yawIn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
  const auth = clamp(v.speed / sp.takeoff, 0, 1.15);
  _f.copy(Z).applyQuaternion(v.quat);
  v.speed += clamp(v.throttle * sp.max - v.speed, -sp.accel * 0.7 * dt, sp.accel * dt);
  if (!v.onGround) v.speed -= _f.y * 9.81 * dt;
  v.speed = clamp(v.speed, 0, sp.max * 1.25);
  let sink = 0;
  if (v.onGround) {
    if (v.throttle < 0.05) v.speed = Math.max(0, v.speed - 14 * dt);
    const yaw = Math.atan2(_f.x, _f.z) + yawIn * 0.9 * dt * clamp(v.speed / 4, 0, 1);
    let up = Math.asin(clamp(_f.y, -1, 1));
    if (v.speed > sp.takeoff * 0.85) up = clamp(up + pitchIn * sp.pitch * 0.7 * dt, 0, 0.4);
    else up = Math.max(0, up - 1.5 * dt);
    v.quat.setFromEuler(_e.set(-up, yaw, 0, 'YXZ'));
  } else {
    _q.setFromAxisAngle(X, -pitchIn * sp.pitch * auth * dt); v.quat.multiply(_q);
    _q.setFromAxisAngle(Z, rollIn * sp.roll * auth * dt); v.quat.multiply(_q);
    _q.setFromAxisAngle(Y, yawIn * sp.yaw * auth * dt); v.quat.multiply(_q);
    _l.copy(X).applyQuaternion(v.quat);
    _q.setFromAxisAngle(Y, -_l.y * 0.85 * auth * dt); v.quat.premultiply(_q);
    if (v.speed < sp.stall) {
      const s = 1 - v.speed / sp.stall;
      _q.setFromAxisAngle(X, 0.5 * s * dt); v.quat.multiply(_q);
      sink = s * 22;
      toastOnce('stall', '⚠️ Strömungsabriss – Schub geben!', 'bad', 3000);
    }
    v.quat.normalize();
  }
  _f.copy(Z).applyQuaternion(v.quat); _u.copy(Y).applyQuaternion(v.quat); _l.copy(X).applyQuaternion(v.quat);
  const vy = _f.y * v.speed - sink;
  v.pos.x += _f.x * v.speed * dt; v.pos.z += _f.z * v.speed * dt; v.pos.y += vy * dt;
  v.vy = vy;
  if (Math.abs(v.pos.x) > 2600) v.pos.x = -Math.sign(v.pos.x) * 2590;
  if (Math.abs(v.pos.z) > 2600) v.pos.z = -Math.sign(v.pos.z) * 2590;
  if (v.pos.y > 1100) v.pos.y = 1100;
  const g = getHeight(v.pos.x, v.pos.z);
  const surf = Math.max(g, 0);
  if (v.pos.y <= surf + 0.02) {
    if (g < -0.3) { crash(v, 'Platsch! Flieger versenkt.'); return; }
    if (!v.onGround && (vy < -10 || Math.abs(_l.y) > 0.5 || _f.y < -0.4)) { crash(v, 'Bruchlandung!'); return; }
    const fl = Math.hypot(_f.x, _f.z) || 1;
    const ahead = getHeight(v.pos.x + (_f.x / fl) * 4, v.pos.z + (_f.z / fl) * 4);
    if (v.speed > 14 && Math.abs(ahead - g) > 1.7) { crash(v, 'In den Hang gekracht!'); return; }
    if (!v.onGround) fxDust(v.pos, 0xcccccc, 6, 3, 0.2);
    v.onGround = true; v.pos.y = g;
  } else if (v.pos.y > surf + 0.45) v.onGround = false;
  if (v.speed > 4 && pointInBoxes(v.pos.x, v.pos.y + 1.2, v.pos.z, 0.6)) { crash(v, 'Das war ein Gebäude.'); return; }

  // Bewaffnung
  v.fireCd -= dt;
  if (v.type === 'jet') {
    if (m.l && v.fireCd <= 0 && v.ammo.mg > 0) {
      v.fireCd = 0.075; v.ammo.mg--;
      _t.copy(v.pos).addScaledVector(_f, 6).addScaledVector(_u, 1.2);
      _t2.copy(_f); _t2.x += (Math.random() - 0.5) * 0.02; _t2.y += (Math.random() - 0.5) * 0.02; _t2.z += (Math.random() - 0.5) * 0.02; _t2.normalize();
      const end = fireHitscan(_t, _t2, 650, 14, { weapon: 'Bord-MG', ignoreVeh: v.id });
      fxTracer(_t.clone(), end, 0xffe070);
      if (v.ammo.mg % 2 === 0) { sfx.shot('mg', 0.5); net.send({ t: 'fx', k: 'shot', w: 'mg', a: [_t.x, _t.y, _t.z], bs: [[end.x, end.y, end.z]] }); }
    }
    if (m.rp && v.ammo.rakete > 0) {
      v.ammo.rakete--; v.side = -v.side;
      _t.copy(v.pos).addScaledVector(_f, 3).addScaledVector(_l, 3 * v.side).addScaledVector(_u, 0.9);
      spawnProjectile('rakete', _t, _t2.copy(_f).multiplyScalar(v.speed + 95), true, 0, 0, v.id);
      sfx.shot('rakete', 0.8);
    }
  }
  if (G.pressed.Space && v.ammo.bombe > 0 && !v.onGround) {
    v.ammo.bombe--;
    _t.copy(v.pos).addScaledVector(_u, 0.2);
    _t2.copy(_f).multiplyScalar(v.speed); _t2.y = vy - 2;
    spawnProjectile(sp.bombKind, _t, _t2, true, 0, 0, v.id);
    sfx.reload();
  }
  // Aufmunitionieren
  if (v.onGround && v.speed < 0.5 && zoneName(v.pos.x, v.pos.z) === 'Flugplatz') {
    const full = Object.keys(sp.ammo).every((a) => v.ammo[a] >= sp.ammo[a]) && v.hp >= v.maxHp;
    if (!full) {
      v.rearmT += dt;
      if (v.rearmT > 2) {
        v.rearmT = 0; v.ammo = Object.assign({}, sp.ammo);
        net.send({ t: 'vrepair', id: v.id });
        toast('🔧 Aufmunitioniert & repariert', 'good'); sfx.buy();
      }
    }
  } else v.rearmT = 0;
  engine(true, 0.6 + v.throttle * 1.2 + v.speed / sp.max * 0.6, 0.1 + v.throttle * 0.12, v.type === 'jet');
}

function hudFor(v) {
  const hp = Math.max(0, Math.round((v.hp / v.maxHp) * 100));
  if (v.type === 'bagger') {
    return `<h3>🚜 ${v.spec.name}</h3>Zustand: ${hp}%<br>Erde geladen: ${G.me.inv.erde || 0}
      <small>Linksklick graben · Rechtsklick abladen<br>Maus: drehen &amp; Arm · H Hupe · E raus</small>`;
  }
  if (v.type === 'auto') {
    return `<h3>🛻 ${v.spec.name}</h3>Zustand: ${hp}%<br>Tempo: ${Math.round(Math.abs(v.speed) * 3.6)} km/h<small>W/S Gas · A/D lenken · H Hupe · E raus</small>`;
  }
  const alt = Math.max(0, Math.round(v.pos.y));
  let a = '';
  if (v.type === 'jet') a = `MG ${v.ammo.mg} · Raketen ${v.ammo.rakete} · Bomben ${v.ammo.bombe}`;
  else a = `Jauchebomben ${v.ammo.bombe}`;
  return `<h3>${v.type === 'jet' ? '✈️' : '🛩️'} ${v.spec.name}</h3>Zustand: ${hp}% · Schub: ${Math.round(v.throttle * 100)}%<br>
    Tempo: ${Math.round(v.speed * 3.6)} km/h (Abheben ab ${Math.round(v.spec.takeoff * 3.6)})<br>Höhe: ${alt} m<br>${a}
    <small>W/S Schub · Maus zurück = hoch · A/D Ruder<br>${v.type === 'jet' ? 'LMB MG · RMB Rakete · ' : ''}Leertaste Bombe · E Schleudersitz</small>`;
}

let hudT = 0;
export function updateVehicles(dt) {
  const mine = G.me.vehicle;
  for (const v of G.vehicles.values()) {
    if (v.dead) continue;
    if (v === mine) {
      if (isAir(v)) simAir(v, dt); else simGround(v, dt);
      if (G.me.vehicle !== v) continue; // abgestuerzt
      v.heading = headingOf(v.quat);
      G.me.pos.copy(v.pos);
      v.sendT -= dt;
      if (v.sendT <= 0) { v.sendT = 0.066; sendState(v); }
    } else if (v.driver) {
      const k = 1 - Math.exp(-12 * dt);
      v.pos.lerp(v.tPos, k); v.quat.slerp(v.tQuat, k);
      v.heading = headingOf(v.quat);
      if (v.type === 'bagger') v.digT = Math.max(0, v.digT - dt * 2.3);
    } else if (!isAir(v)) {
      v.yaw = v.heading;
      const g = getHeight(v.pos.x, v.pos.z);
      if (Math.abs(g - v.pos.y) > 0.01) { v.pos.y += (g - v.pos.y) * Math.min(1, 8 * dt); }
      orientGround(v, dt, false);
    }
    v.group.position.copy(v.pos); v.group.quaternion.copy(v.quat);
    if (v.type === 'bagger') {
      v.parts.upper.rotation.y = v.cab;
      const cy = v.heading + v.cab;
      const g = getHeight(v.pos.x + Math.sin(cy) * v.reach, v.pos.z + Math.cos(cy) * v.reach);
      poseBaggerArm(v.parts, v.reach, clamp(g - v.pos.y, -7, 5) + 1.5 - Math.sin(v.digT * Math.PI) * 2.1);
    } else if (v.type === 'flieger') {
      v.parts.prop.rotation.z += dt * (v.driver ? 14 + v.throttle * 40 : 0);
    } else if (v.type === 'jet') {
      v.parts.flame.visible = !!v.driver && v.throttle > 0.05;
      v.parts.flame.scale.set(1, 0.4 + v.throttle * 1.2, 1);
    } else if (v.type === 'auto' && v === mine) {
      for (const w of v.parts.wheels) w.rotation.x += v.speed * dt * 2.2;
    }
  }
  if (mine && G.me.vehicle === mine) {
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.12; setVehHud(hudFor(mine)); }
  }
}

// Kamera hinter dem Fahrzeug
export function vehicleCamera(v, dt) {
  const cam = G.camera;
  if (isAir(v)) {
    _f.copy(Z).applyQuaternion(v.quat); _u.copy(Y).applyQuaternion(v.quat);
    const d = v.spec.cam;
    _t.copy(v.pos).addScaledVector(_f, -d).addScaledVector(_u, d * 0.3);
    cam.position.lerp(_t, 1 - Math.exp(-16 * dt));
    cam.up.lerp(_u, 1 - Math.exp(-5 * dt)).normalize();
    cam.lookAt(_t2.copy(v.pos).addScaledVector(_f, 25).addScaledVector(_u, 2));
    // Zielmarke
    _t.copy(v.pos).addScaledVector(_f, 400).project(cam);
    if (_t.z < 1) setAim((_t.x * 0.5 + 0.5) * window.innerWidth, (-_t.y * 0.5 + 0.5) * window.innerHeight);
    else setAim(null, null);
  } else {
    const yaw = v.type === 'bagger' ? v.yaw + v.cab : v.yaw;
    const sx = Math.sin(yaw), cz = Math.cos(yaw);
    const back = v.type === 'bagger' ? 11.5 : 9, up = v.type === 'bagger' ? 7.5 : 4.2;
    const side = v.type === 'bagger' ? 4.5 : 0;
    _t.set(v.pos.x - sx * back - cz * side, v.pos.y + up, v.pos.z - cz * back + sx * side);
    const gh = getHeight(_t.x, _t.z) + 1.2;
    if (_t.y < gh) _t.y = gh;
    cam.position.lerp(_t, 1 - Math.exp(-9 * dt));
    cam.up.set(0, 1, 0);
    cam.lookAt(_t2.set(v.pos.x + sx * 5, v.pos.y + 1.6, v.pos.z + cz * 5));
    setAim(null, null);
  }
  const gh = getHeight(cam.position.x, cam.position.z) + 0.6;
  if (cam.position.y < gh) cam.position.y = gh;
  // Schwindel beim Fahren
  const dr = Math.min(8, G.me.drunk);
  if (dr > 0.3) {
    cam.rotateZ(Math.sin(G.time * 0.9) * 0.022 * dr);
    cam.rotateX(Math.sin(G.time * 0.6 + 1) * 0.008 * dr);
    cam.rotateY(Math.sin(G.time * 0.45) * 0.012 * dr);
  }
}
