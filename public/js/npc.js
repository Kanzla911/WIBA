// WIBA - NPCs: Bewohner, Arbeiter, Badegaeste, Wanderer (lokal simuliert, nicht synchronisiert)
import * as THREE from 'three';
import { G } from './state.js';
import { getHeight } from './terrain.js';
import { npcSpots, pointInBoxes, textTexture } from './world.js';
import { makeAvatar } from './models.js';

const LINES = {
  stadt: ['Servus!', 'Grüß Gott!', 'Schönes Wetter heut, gö?', 'Am Stadtplatz is wieder nix los.', 'Heast, pass auf!', 'I muaß no zum Bäcker.'],
  park: ['Schen ruhig do an da Vöckla.', 'Servus!', 'A Bankerl in da Sunn – herrlich.'],
  dorf: ['Griaß di!', 'Servas!', 'Da See is heut bsonders sche.', 'Host a Bier für mi?'],
  bad: ['Des Wossa is frisch!', 'Sonnencreme vergessen…', 'Heit geh i nimma eini.', 'Türkis wia in da Karibik, gö?'],
  arbeit: ['Mahlzeit!', 'I hob grod Pause.', 'Net im Weg umadumstehn!', 'Da Chef kummt glei.', 'Des wird heit nix mehr.'],
  hof: ['Griaß di am Hof!', 'D’Kia san scho gmolkn.', 'Mogst an Most?', 'Vo do siagst an gonzn See.'],
  wander: ['Berg Heil!', 'Is no weit?', 'Schene Aussicht, gö?', 'Meine Haxn…'],
  scared: ['Hüfe!', 'Polizei!', 'Bist deppat?!', 'Aaah!', 'Renn!'],
  polish: ['Wos mochst denn du do?!', 'Na servas…', 'I schau weg.', 'Des is jo wohl net wahr.'],
  drunk: ['Du host aber an sitzn!', 'Geh ham, Bua.', 'Der is jo fett wia a Radierer.'],
};
const SHIRTS = [0xc0392b, 0x2f6fd0, 0x2e8b3a, 0xf2f2f2, 0x8e44ad, 0xe67e22, 0x16a085, 0x34495e, 0xf1c40f];
const PANTS = [0x2d3e5c, 0x3a3a3a, 0x6b4a2a, 0x556b2f];
const texCache = new Map();
const _v = new THREE.Vector3();
let rngS = 77123;
function rnd() { rngS = (Math.imul(rngS, 1664525) + 1013904223) >>> 0; return rngS / 4294967296; }

function okSpot(x, z) {
  const h = getHeight(x, z);
  return h > 0.9 && !pointInBoxes(x, h + 1, z, 0.7);
}

export function initNpcs() {
  for (const sp of npcSpots) {
    for (let i = 0; i < sp.n; i++) {
      let x = sp.x, z = sp.z, ok = false;
      for (let t = 0; t < 25 && !ok; t++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd()) * sp.r;
        x = sp.x + Math.cos(a) * d; z = sp.z + Math.sin(a) * d; ok = okSpot(x, z);
      }
      if (!ok) continue;
      const worker = sp.kind === 'arbeit';
      const look = worker ? null : { shirt: sp.kind === 'bad' ? 0xf0c39a : SHIRTS[Math.floor(rnd() * SHIRTS.length)], pants: sp.kind === 'bad' ? 0x2f6fd0 : PANTS[Math.floor(rnd() * PANTS.length)], hair: [0x3a2a1e, 0x1c1c1c, 0xb5651d, 0xd9c27a, 0x9a9a9a][Math.floor(rnd() * 5)] };
      const av = makeAvatar([0xffcc00, 0xffffff, 0xff9900][Math.floor(rnd() * 3)], look);
      av.group.visible = false;
      G.scene.add(av.group);
      G.npcs.push({
        av, pos: new THREE.Vector3(x, getHeight(x, z), z), home: sp, kind: sp.kind, tx: x, tz: z,
        state: 'idle', t: rnd() * 6, yaw: rnd() * 6.28, phase: rnd() * 6, spd: 0, sayT: 0, sayCd: rnd() * 5, bubble: null, visible: false,
      });
    }
  }
}

function say(n, group) {
  const arr = LINES[group] || LINES.dorf;
  const line = arr[Math.floor(Math.random() * arr.length)];
  let tex = texCache.get(line);
  if (!tex) { tex = textTexture(line, { size: 40 }); texCache.set(line, tex); }
  if (!n.bubble) {
    n.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    n.bubble.position.y = 2.55; n.av.group.add(n.bubble);
  }
  n.bubble.material.map = tex; n.bubble.material.needsUpdate = true;
  n.bubble.scale.set(0.42 * tex.userData.aspect, 0.42, 1);
  n.bubble.visible = true; n.sayT = 3.2; n.sayCd = 9 + Math.random() * 8;
}

export function alarmNpcs(pos, radius) {
  for (const n of G.npcs) {
    if (!n.visible || n.state === 'down') continue;
    const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
    if (d > radius) continue;
    const a = Math.atan2(n.pos.z - pos.z, n.pos.x - pos.x) + (Math.random() - 0.5);
    n.state = 'flee'; n.t = 5 + Math.random() * 4;
    n.tx = n.pos.x + Math.cos(a) * 40; n.tz = n.pos.z + Math.sin(a) * 40;
    if (Math.random() < 0.5 && n.sayT <= 0) say(n, 'scared');
  }
}
export function hitNpc(n) {
  if (n.state === 'down') return;
  n.state = 'down'; n.t = 22 + Math.random() * 10;
  if (n.bubble) n.bubble.visible = false;
  alarmNpcs(n.pos, 45);
}

export function updateNpcs(dt) {
  const me = G.me, veh = me.vehicle;
  for (const n of G.npcs) {
    const pd = Math.hypot(n.pos.x - me.pos.x, n.pos.z - me.pos.z);
    const vis = pd < 240;
    if (vis !== n.visible) { n.visible = vis; n.av.group.visible = vis; }
    if (n.state === 'down') { n.t -= dt; if (n.t <= 0) { n.state = 'idle'; n.t = 2; } }
    if (!vis) continue;
    const av = n.av;
    let speed = 0;
    if (n.state === 'idle') {
      n.t -= dt;
      if (n.t <= 0) {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * n.home.r;
        const x = n.home.x + Math.cos(a) * d, z = n.home.z + Math.sin(a) * d;
        if (okSpot(x, z)) { n.tx = x; n.tz = z; n.state = 'walk'; } else n.t = 1;
      }
    } else if (n.state === 'walk' || n.state === 'flee') {
      speed = n.state === 'flee' ? 5.2 : 1.4;
      const dx = n.tx - n.pos.x, dz = n.tz - n.pos.z, d = Math.hypot(dx, dz);
      if (n.state === 'flee') { n.t -= dt; }
      if (d < 0.6 || (n.state === 'flee' && n.t <= 0)) { n.state = 'idle'; n.t = 2 + Math.random() * 7; speed = 0; }
      else {
        const nx = n.pos.x + (dx / d) * speed * dt, nz = n.pos.z + (dz / d) * speed * dt;
        if (okSpot(nx, nz)) { n.pos.x = nx; n.pos.z = nz; n.yaw = Math.atan2(dx, dz); }
        else { n.state = 'idle'; n.t = 0.5 + Math.random() * 2; speed = 0; }
      }
    }
    n.pos.y = getHeight(n.pos.x, n.pos.z);
    // Reaktionen auf den Spieler
    if (n.state !== 'down') {
      if (veh && pd < 9) {
        const vs = Math.abs(veh.speed || 0);
        if (pd < 2.4 && vs > 5) hitNpc(n);
        else if (vs > 3 && n.state !== 'flee') { const a = Math.atan2(n.pos.z - me.pos.z, n.pos.x - me.pos.x) + 1.2; n.state = 'flee'; n.t = 2.5; n.tx = n.pos.x + Math.cos(a) * 12; n.tz = n.pos.z + Math.sin(a) * 12; if (n.sayT <= 0 && Math.random() < 0.4) say(n, 'scared'); }
      } else if (!veh && pd < 5.5 && n.state !== 'flee') {
        n.sayCd -= dt;
        if (n.sayCd <= 0) {
          say(n, me.polishing ? 'polish' : (me.drunk > 4 ? 'drunk' : n.kind));
          if (me.polishing) n.yaw = Math.atan2(n.pos.x - me.pos.x, n.pos.z - me.pos.z);
          else { n.yaw = Math.atan2(me.pos.x - n.pos.x, me.pos.z - n.pos.z); if (n.state === 'walk') { n.state = 'idle'; n.t = 2.5; } }
        }
      }
    }
    if (n.sayT > 0) { n.sayT -= dt; if (n.sayT <= 0 && n.bubble) n.bubble.visible = false; }
    // Darstellung
    n.spd += (speed - n.spd) * Math.min(1, 8 * dt);
    av.group.position.copy(n.pos);
    av.group.rotation.y = n.yaw;
    if (n.state === 'down') { av.body.rotation.x = -Math.PI / 2; av.body.position.y = 0.25; continue; }
    av.body.rotation.x = 0; av.body.position.y = 0;
    n.phase += n.spd * dt * 2.2;
    const sw = Math.sin(n.phase) * 0.7 * Math.min(1, n.spd / 1.4);
    av.legL.rotation.x = sw; av.legR.rotation.x = -sw; av.armL.rotation.x = -sw;
    av.armR.rotation.x = n.state === 'flee' ? -2.6 : sw;
    if (n.state === 'flee') av.armL.rotation.x = -2.6;
  }
}
