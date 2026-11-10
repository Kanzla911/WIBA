// WIBA - Hauptspiel: Eingabe, Spieler, Gegenstaende, Effekte, Netzwerk, Schleife
import * as THREE from 'three';
import { G, net, clamp, invAdd, invCount } from './state.js';
import { ITEMS, WEAPONS, PROJ, PLAYER_COLORS, DAY_LENGTH } from './config.js';
import { M, loadWorld, applyAirfield, initTerrain, updateTerrain, getHeight, applyEdits, flushTerrain, raycastTerrain, isProtected, waterLevelAt, inWorld, landuseAt } from './terrain.js';
import { initWorld, updateSky, boxes, pois, textSprite, mkBox, polyAt, surfaceAt, updateObjects, updateMarkers } from './world.js';
import { makeAvatar, makeItem } from './models.js';
import { initAudio, sfx, engine, ambient } from './audio.js';
import * as UI from './ui.js';
import * as C from './combat.js';
import * as V from './vehicles.js';
import { initNpcs, updateNpcs } from './npc.js';
import { radio } from './radio.js';

const $ = (id) => document.getElementById(id);
const me = G.me;
const canvas = $('game');
const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Vector3(), _p = new THREE.Vector3();

// ---------- Renderer ----------
let lowGfx = false;
try { lowGfx = localStorage.getItem('wiba-gfx') === 'low'; } catch (e) { /* */ }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowGfx, powerPreference: 'high-performance' });
renderer.setPixelRatio(lowGfx ? 0.8 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowGfx;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.25, 70000);
camera.rotation.order = 'YXZ';
scene.add(camera);
G.scene = scene; G.camera = camera; G.renderer = renderer; G.canvas = canvas;
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

C.initCombat();
initNpcs();
let worldOk = false;
loadWorld((t) => { $('status').textContent = t; }).then(() => { worldOk = true; UI.initUI(); $('status').textContent = ''; $('hostinfo').dataset.ready = '1'; })
  .catch((e) => { $('status').textContent = 'Karte konnte nicht geladen werden: ' + e.message + ' – zuerst die Karte bauen (npm run map).'; });

// ---------- Sichtmodell (Gegenstand in der Hand) ----------
const vm = new THREE.Group();
vm.position.set(0.34, -0.34, -0.62);
camera.add(vm);
let vmItem = null, vmId = null;
const vmCloth = mkBox(0.1, 0.025, 0.1, 0xf4f4f4, -0.02, 0.06, -0.05);
vmCloth.visible = false; vmCloth.castShadow = false; vm.add(vmCloth);
function setViewItem(id) {
  if (id === vmId) return;
  vmId = id;
  if (vmItem) vm.remove(vmItem);
  vmItem = id ? makeItem(id) : null;
  if (vmItem) {
    vmItem.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    if (id === 'banane') { vmItem.scale.setScalar(1.5); vmItem.rotation.set(0.35, 0.5, -0.5); vmItem.position.set(-0.04, 0.08, 0.05); }
    else if (id === 'schaufel') { vmItem.scale.setScalar(0.5); vmItem.rotation.x = 1.1; vmItem.position.set(0.14, -0.42, 0.05); }
    else if (id === 'platte' || id === 'wand') { vmItem.position.set(0, 0.05, 0); }
    else if (ITEMS[id].use && id !== 'granate') { vmItem.scale.setScalar(1.5); }
    vm.add(vmItem);
  }
}
const ghosts = {
  platte: mkBox(5, 0.4, 5, 0x66ff88, 0, 0, 0, { transparent: true, opacity: 0.45 }),
  wand: mkBox(5, 3, 0.5, 0x66ff88, 0, 0, 0, { transparent: true, opacity: 0.45 }),
};
for (const k of Object.keys(ghosts)) { ghosts[k].visible = false; ghosts[k].castShadow = false; scene.add(ghosts[k]); }

// ---------- Speicherstand ----------
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('wiba-save-v2') || 'null');
    if (!s) return;
    if (s.name) me.name = String(s.name).slice(0, 16);
    if (typeof s.color === 'number') me.color = s.color;
    if (s.inv && typeof s.inv === 'object') {
      me.inv = {};
      for (const k of Object.keys(s.inv)) if (ITEMS[k] && s.inv[k] > 0) me.inv[k] = Math.floor(s.inv[k]);
      if (!me.inv.schaufel) me.inv.schaufel = 1;
      if (!me.inv.banane) me.inv.banane = 1;
    }
    if (typeof s.money === 'number') me.money = Math.max(0, Math.floor(s.money));
    if (typeof s.wiba === 'number') me.wiba = Math.max(0, Math.floor(s.wiba));
    if (s.mags) me.mags = s.mags;
    if (s.ip) $('ip').value = s.ip;
  } catch (e) { /* kein Speicherstand */ }
}
function saveGame() {
  try {
    localStorage.setItem('wiba-save-v2', JSON.stringify({
      name: me.name, color: me.color, inv: me.inv, money: me.money, wiba: me.wiba, mags: me.mags, ip: $('ip').value,
    }));
  } catch (e) { /* egal */ }
}
loadSave();
setInterval(() => { if (G.started) saveGame(); }, 5000);
window.addEventListener('beforeunload', () => { if (G.started) saveGame(); });

// ---------- Startbildschirm ----------
$('name').value = me.name === 'Hawara' ? '' : me.name;
PLAYER_COLORS.forEach((c) => {
  const d = document.createElement('div');
  d.style.background = '#' + c.toString(16).padStart(6, '0');
  if (c === me.color) d.classList.add('sel');
  d.onclick = () => { me.color = c; for (const o of $('colors').children) o.classList.remove('sel'); d.classList.add('sel'); };
  $('colors').appendChild(d);
});
function status(t) { $('status').textContent = t; }
$('btnGfx').textContent = '🖥️ Grafik: ' + (lowGfx ? 'Niedrig (schneller)' : 'Hoch');
$('btnGfx').onclick = () => {
  try { localStorage.setItem('wiba-gfx', lowGfx ? 'high' : 'low'); } catch (e) { /* */ }
  me.name = ($('name').value.trim() || me.name).slice(0, 16);
  saveGame();
  location.reload();
};
let connecting = false;
async function start(url) {
  if (connecting || G.started) return;
  if (!worldOk) { status('Die Karte lädt noch – einen Moment…'); return; }
  connecting = true;
  initAudio();
  status('Verbinde…');
  me.name = ($('name').value.trim() || 'Hawara').slice(0, 16);
  try { await net.connect(url); } catch (e) {
    status('Keine Verbindung (' + e.message + '). Läuft das Spiel beim Host? Stimmt die IP?');
    connecting = false; return;
  }
  net.send({ t: 'join', name: me.name, color: me.color, wiba: me.wiba });
  radio.start();
}
$('btnHost').onclick = () => start((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
$('btnJoin').onclick = () => {
  let ip = $('ip').value.trim().replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '');
  if (!ip) { status('Bitte die IP-Adresse vom Host eintragen.'); return; }
  if (!/:\d+$/.test(ip)) ip += ':31337';
  start('ws://' + ip);
};
$('ip').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
fetch('/info').then((r) => r.json()).then((i) => {
  if (i.ips && i.ips.length) {
    $('hostinfo').textContent = 'Wenn du hostest, geben Freunde im selben Netzwerk ein: ' + i.ips.map((ip) => ip + (i.port === 31337 ? '' : ':' + i.port)).join('  oder  ');
  }
}).catch(() => {});

// ---------- Mitspieler ----------
function addPlayer(d) {
  if (d.id === me.id || G.players.has(d.id)) return;
  const avatar = makeAvatar(d.color);
  const tag = textSprite(d.name, 0.42);
  tag.position.y = 2.5;
  avatar.group.add(tag);
  scene.add(avatar.group);
  const p = {
    id: d.id, name: d.name, color: d.color, avatar,
    pos: new THREE.Vector3(d.p[0], d.p[1], d.p[2]), tPos: new THREE.Vector3(d.p[0], d.p[1], d.p[2]),
    yaw: d.yaw || 0, tYaw: d.yaw || 0, pitch: 0, tPitch: 0, a: 0, w: '', v: d.v || 0,
    hp: d.hp, dead: d.dead, k: d.k || 0, d: d.d || 0, wiba: d.wiba || 0, phase: 0, spd: 0,
  };
  G.players.set(p.id, p);
}
function removePlayer(id) {
  const p = G.players.get(id);
  if (!p) return;
  scene.remove(p.avatar.group);
  G.players.delete(id);
}
function nameOf(id) {
  if (id === me.id) return me.name;
  const p = G.players.get(id);
  return p ? p.name : 'Irgendwer';
}
function updatePlayers(dt) {
  const k = 1 - Math.exp(-14 * dt);
  const trip = me.fx.pilze > 0 ? 2.3 : 1;
  for (const p of G.players.values()) {
    const ox = p.pos.x, oz = p.pos.z;
    if (p.pos.distanceToSquared(p.tPos) > 900) p.pos.copy(p.tPos); else p.pos.lerp(p.tPos, k);
    let dy = (p.tYaw - p.yaw) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2; else if (dy < -Math.PI) dy += Math.PI * 2;
    p.yaw += dy * k; p.pitch += (p.tPitch - p.pitch) * k;
    const sp = Math.hypot(p.pos.x - ox, p.pos.z - oz) / Math.max(dt, 0.001);
    p.spd += (sp - p.spd) * Math.min(1, 10 * dt);
    const av = p.avatar;
    av.group.visible = !p.v;
    if (p.v) continue;
    av.group.position.copy(p.pos);
    av.group.rotation.y = p.yaw + Math.PI;
    av.setItem(p.w || null);
    av.head.scale.setScalar(trip);
    if (p.dead) {
      av.body.rotation.x = -Math.PI / 2; av.body.position.y = 0.25;
      av.chute.visible = false;
      continue;
    }
    av.body.rotation.x = 0; av.body.position.y = 0;
    p.phase += p.spd * dt * 1.7;
    const sw = Math.sin(p.phase) * 0.75 * Math.min(1, p.spd / 4);
    av.legL.rotation.x = sw; av.legR.rotation.x = -sw;
    av.armL.rotation.x = -sw; av.armL.rotation.z = 0;
    av.head.rotation.x = -p.pitch * 0.7;
    if (p.a & 4) {
      av.armR.rotation.x = -1.25 + Math.sin(G.time * 24) * 0.22;
      av.armL.rotation.x = -1.2; av.armL.rotation.z = -0.45;
    } else if (p.w && (WEAPONS[p.w] || p.w === 'schaufel')) av.armR.rotation.x = -Math.PI / 2 - p.pitch;
    else if (p.w) av.armR.rotation.x = -0.9;
    else av.armR.rotation.x = sw;
    av.chute.visible = !!(p.a & 8);
  }
}

// ---------- Netzwerk ----------
const SPAWN = [-90, -140]; // Stadtplatz Voecklabruck (zwischen den Stadttuermen)
// Spawn am Stadtplatz: erst wenn die Umgebung geladen ist, einen freien Platz suchen
function spawnMe() {
  me.pos.set(SPAWN[0] + (Math.random() - 0.5) * 20, 0, SPAWN[1] + (Math.random() - 0.5) * 20);
  me.pos.y = getHeight(me.pos.x, me.pos.z) + 1;
  me.vel.set(0, 0, 0); me.yaw = 0; me.pitch = 0; me.chute = false;
  G.spawnPending = 0.01;
  UI.setBlack(true, 'Lade Umgebung…');
}
function finishSpawn() {
  for (let t = 0; t < 200; t++) {
    const a = Math.random() * 6.283, d = Math.sqrt(t) * 5;
    const x = t ? SPAWN[0] + Math.cos(a) * d : me.pos.x, z = t ? SPAWN[1] + Math.sin(a) * d : me.pos.z;
    if (!polyAt(x, z, 1.2) && waterLevelAt(x, z) < -1e8) { me.pos.set(x, getHeight(x, z), z); break; }
  }
  me.vel.set(0, 0, 0);
  G.spawnPending = 0;
  UI.setBlack(false);
}
net.on('welcome', (m) => {
  me.id = m.id;
  G.serverTimeOffset = m.time - performance.now() / 1000;
  applyAirfield(m.air || null);
  initTerrain(scene, lowGfx);
  initWorld(scene, lowGfx);
  applyEdits(m.digs);
  for (const s of m.structs) C.addStruct(s);
  for (const v of m.vehicles) V.addVehicle(v);
  for (const p of m.players) addPlayer(p);
  spawnMe();
  $('start').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('clickhint').classList.remove('hidden');
  G.started = true;
  saveGame();
  UI.toast('Servus in Vöcklabruck! F1 zeigt die Steuerung.', 'good');
  UI.addChat('', 'Tipp: [M] große Karte · [B] Bier · [P] Radio · Die Welt ist 1:1 – nimm ein Auto. Der Attersee liegt ca. 9 km südwestlich.');
});
net.on('join', (m) => { addPlayer(m.p); UI.addFeed(`➕ ${m.p.name} ist jetzt dabei`); });
net.on('leave', (m) => { UI.addFeed(`➖ ${nameOf(m.id)} ist weg`); removePlayer(m.id); });
net.on('ss', (m) => {
  for (const a of m.l) {
    if (a[0] === me.id) continue;
    const p = G.players.get(a[0]);
    if (!p) continue;
    p.tPos.set(a[1], a[2], a[3]); p.tYaw = a[4]; p.tPitch = a[5]; p.a = a[6]; p.w = a[7]; p.v = a[8];
  }
  V.onVehSnapshot(m.vs);
});
net.on('chat', (m) => UI.addChat(nameOf(m.id), m.m));
net.on('dig', (m) => applyEdits(m.e));
net.on('build', (m) => { C.addStruct(m.s); if (C.distToCam(_p.set(m.s.x, m.s.y, m.s.z)) < 60) sfx.place(); });
net.on('unbuild', (m) => C.removeStruct(m.id));
net.on('hp', (m) => {
  if (m.id === me.id) {
    if (m.hp < me.hp) { UI.hurtFlash(); sfx.hurt(); me.shake = Math.max(me.shake, 0.3); }
    me.hp = m.hp;
  } else { const p = G.players.get(m.id); if (p) p.hp = m.hp; }
});
net.on('kill', (m) => {
  const self = m.k === m.v;
  UI.addFeed(self ? `💀 ${nameOf(m.v)} hat sich selbst erledigt (${m.w})` : `☠️ ${nameOf(m.k)} ➜ ${nameOf(m.v)} (${m.w})`);
  if (m.v === me.id) {
    me.dead = true; me.deadT = 5; me.deaths++; me.chute = false;
    if (me.vehicle) { me.vehicle = null; engine(false); UI.setVehHud(null); UI.setAim(null, null); camera.up.set(0, 1, 0); }
    UI.showDeath(self ? `Selber schuld. (${m.w})` : `${nameOf(m.k)} hat dich erwischt – mit: ${m.w}`);
    sfx.death();
  } else {
    const p = G.players.get(m.v);
    if (p) { p.dead = true; p.d++; }
    if (m.k === me.id) { me.kills++; me.money += 50; UI.toast(`+50 € Kopfgeld für ${nameOf(m.v)}`, 'good'); }
  }
  if (!self && m.k !== me.id) { const kp = G.players.get(m.k); if (kp) kp.k++; }
});
net.on('spawn', (m) => {
  if (m.id === me.id) {
    me.dead = false; me.hp = 100; me.drunk = 0;
    me.fx.gras = me.fx.pilze = me.fx.pulver = me.fx.crash = me.fx.blackout = 0;
    UI.setBlack(false);
    spawnMe(); UI.hideDeath();
  } else { const p = G.players.get(m.id); if (p) { p.dead = false; p.hp = 100; } }
});
net.on('sc', (m) => {
  if (m.id === me.id) { me.kills = m.k; me.deaths = m.d; return; }
  const p = G.players.get(m.id);
  if (p) { p.k = m.k; p.d = m.d; p.wiba = m.w; }
});
net.on('vdriver', V.onVehDriver);
net.on('vdead', (m) => {
  const v = G.vehicles.get(m.id);
  if (v && m.drv !== m.by) UI.addFeed(`💥 ${nameOf(m.by)} hat einen ${v.spec.name} zerlegt`);
  V.onVehDead(m);
});
net.on('vhp', V.onVehHp);
net.on('vreset', V.onVehReset);
net.on('proj', (m) => {
  if (!PROJ[m.k] || !Array.isArray(m.p) || !Array.isArray(m.v)) return;
  C.spawnProjectile(m.k, _p.set(m.p[0], m.p[1], m.p[2]), _m.set(m.v[0], m.v[1], m.v[2]), false, m.id, m.by);
  if (m.k === 'rakete') sfx.shot('rakete', C.volAt(_p, 300));
});
net.on('boom', (m) => {
  if (!Array.isArray(m.p)) return;
  C.removeProjectileById(m.id);
  C.explode(new THREE.Vector3(m.p[0], m.p[1], m.p[2]), m.k, m.by, false);
});
net.on('fx', (m) => {
  if (m.k === 'shot' && Array.isArray(m.a) && Array.isArray(m.bs)) {
    const a = new THREE.Vector3(m.a[0], m.a[1], m.a[2]);
    for (const b of m.bs.slice(0, 10)) C.fxTracer(a, new THREE.Vector3(b[0], b[1], b[2]));
    sfx.shot(m.w, C.volAt(a, 350));
  } else if (m.k === 'horn' && Array.isArray(m.p)) {
    sfx.horn(C.volAt(_p.set(m.p[0], m.p[1], m.p[2]), 250));
  }
});
net.on('closed', () => {
  if (!G.started) return;
  G.started = false;
  saveGame();
  UI.setBlack(true, 'Verbindung zum Host verloren – zurück zum Menü…');
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => location.reload(), 2500);
});

// ---------- Eingabe ----------
function relock() { if (!G.forceLock && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* */ } } }
document.addEventListener('pointerlockchange', () => {
  G.locked = document.pointerLockElement === canvas;
  if (!G.locked) { G.keys = {}; G.mouse.l = G.mouse.r = false; }
  $('clickhint').classList.toggle('hidden', G.locked || !G.started || !!G.menu || G.chat);
});
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  if (!G.started) return;
  if (!G.locked && !G.forceLock) { if (!G.menu && !G.chat) relock(); return; }
  if (e.button === 0) { G.mouse.l = true; G.mouse.lp = true; }
  else if (e.button === 2) { G.mouse.r = true; G.mouse.rp = true; }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouse.l = false; else if (e.button === 2) G.mouse.r = false; });
document.addEventListener('mousemove', (e) => {
  if (!G.locked && !G.forceLock) return;
  G.mouse.dx += e.movementX || 0; G.mouse.dy += e.movementY || 0;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('wheel', (e) => { if (G.started && !G.menu && !G.chat) G.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });

function openChat() {
  G.chat = true; G.keys = {};
  if (document.pointerLockElement) document.exitPointerLock();
  const ci = $('chatinput');
  ci.classList.remove('hidden'); ci.value = ''; ci.focus();
}
function closeChat() {
  G.chat = false;
  const ci = $('chatinput');
  ci.classList.add('hidden'); ci.blur();
  relock();
}
document.addEventListener('keydown', (e) => {
  if (e.target === $('chatinput')) {
    if (e.key === 'Enter') { const t = e.target.value.trim(); if (t) net.send({ t: 'chat', m: t }); closeChat(); e.preventDefault(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (!G.started) return;
  const code = e.code;
  if (code === 'F1') { $('help').classList.toggle('hidden'); e.preventDefault(); return; }
  if (code === 'Tab') { e.preventDefault(); UI.showScore(true); return; }
  if (code === 'Escape') { if (G.menu === 'map') UI.toggleMap(); else if (G.menu) UI.closeMenu(); $('help').classList.add('hidden'); return; }
  if (code === 'Enter') { e.preventDefault(); if (!G.menu) openChat(); return; }
  if (G.menu) {
    if (G.menu === 'map') { if (code === 'KeyM' || code === 'KeyE') { UI.toggleMap(); relock(); } return; }
    if (code === 'KeyE' || code === 'KeyI') { UI.closeMenu(); relock(); }
    return;
  }
  if (!e.repeat) G.pressed[code] = true;
  G.keys[code] = true;
  if (code === 'Space' || code.startsWith('Arrow') || code === 'F5' || (e.ctrlKey && code !== 'KeyR')) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  G.keys[e.code] = false;
  if (e.code === 'Tab') UI.showScore(false);
});
window.addEventListener('blur', () => { G.keys = {}; G.mouse.l = G.mouse.r = false; });

// ---------- Spielerbewegung ----------
const R = 0.4, HGT = 1.9, STEP = 0.55;
function blockedAt(x, z, y) {
  for (const b of boxes) {
    if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R && y + STEP < b.y1 && y + HGT > b.y0) return true;
  }
  const pp = polyAt(x, z, R);
  return !!(pp && y + STEP < pp.top && y + HGT > pp.base);
}
function groundAt(x, z, y) {
  let g = surfaceAt(x, z, y);
  const pp = polyAt(x, z, R * 0.5);
  if (pp && pp.top <= y + STEP + 0.01 && pp.top > g) g = pp.top;
  for (const b of boxes) {
    if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R && b.y1 <= y + STEP + 0.01 && b.y1 > g) g = b.y1;
  }
  return g;
}
function ceilingAt(x, z, y) {
  let c = Infinity;
  for (const b of boxes) {
    if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R && b.y0 >= y + HGT - 0.35 && b.y0 < c) c = b.y0;
  }
  return c;
}
function hurtSelf(d, cause) { if (d >= 1 && !me.dead) net.send({ t: 'selfdmg', d: Math.round(d), by: me.id, w: cause }); }

let stepT = 0;
function updatePlayer(dt, ctl) {
  const k = ctl ? G.keys : {};
  if (ctl) {
    me.yaw -= G.mouse.dx * 0.0022;
    me.pitch = clamp(me.pitch - G.mouse.dy * 0.0022, -1.55, 1.55);
  }
  let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  let speed = k.ShiftLeft || k.ShiftRight ? 8.6 : 5.2;
  if (me.fx.pulver > 0) speed *= 1.6;
  if (me.fx.crash > 0) speed *= 0.65;
  if (me.fx.gras > 0) speed *= 0.88;
  if (me.drunk > 5) speed *= 0.85;
  if (me.inWater) speed *= 0.5;
  if (me.polishing) speed *= 0.4;
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx = (wx / wl) * speed; wz = (wz / wl) * speed; }
  if (me.drunk > 1.5 && wl > 0) {
    const st = Math.sin(G.time * 1.3) * Math.min(3, me.drunk * 0.35);
    wx += cy * st; wz += -sy * st;
  }
  const acc = Math.min(1, (me.onGround ? 12 : 2.5) * dt);
  me.vel.x += (wx - me.vel.x) * acc;
  me.vel.z += (wz - me.vel.z) * acc;

  if (ctl && G.pressed.Space) {
    if (me.onGround && !me.inWater) { me.vel.y = me.fx.pulver > 0 ? 8.5 : 6.8; me.onGround = false; }
    else if (!me.onGround && !me.chute && me.vel.y < -7 && me.airT > 0.4) { me.chute = true; sfx.chute(); UI.toast('🪂 Fallschirm offen', 'good'); }
  }

  let x = me.pos.x, y = me.pos.y, z = me.pos.z;
  const stuck = blockedAt(x, z, y);
  const h0 = getHeight(x, z);
  // X
  let nx = x + me.vel.x * dt;
  if (nx !== x) {
    const h1 = getHeight(nx, z);
    if ((!stuck && blockedAt(nx, z, y)) || (h1 > y + 0.04 && (h1 - h0) > Math.abs(nx - x) * 1.6) || !inWorld(nx, z, 15)) { me.vel.x = 0; nx = x; }
  }
  x = nx;
  const h0b = getHeight(x, z);
  let nz = z + me.vel.z * dt;
  if (nz !== z) {
    const h1 = getHeight(x, nz);
    if ((!stuck && blockedAt(x, nz, y)) || (h1 > y + 0.04 && (h1 - h0b) > Math.abs(nz - z) * 1.6) || !inWorld(x, nz, 15)) { me.vel.z = 0; nz = z; }
  }
  z = nz;
  // Vertikal
  me.vel.y -= 22 * dt;
  if (me.chute) me.vel.y = Math.max(me.vel.y, -4.5);
  if (me.vel.y < -60) me.vel.y = -60;
  let ny = y + me.vel.y * dt;
  const g = groundAt(x, z, y);
  const wasGround = me.onGround;
  if (ny <= g || (wasGround && me.vel.y <= 0 && g >= y - 0.5)) {
    if (!wasGround && me.vel.y < -15 && !me.inWater) hurtSelf((-me.vel.y - 15) * 5.5, 'Schwerkraft');
    ny = g; me.vel.y = 0; me.onGround = true; me.chute = false; me.airT = 0;
  } else { me.onGround = false; me.airT += dt; }
  const c = ceilingAt(x, z, y);
  if (ny + HGT > c) { ny = c - HGT; if (me.vel.y > 0) me.vel.y = 0; }
  me.inWater = false;
  const wlv = waterLevelAt(x, z);
  if (wlv > -1e8 && ny < wlv - 1.3) { ny = wlv - 1.3; me.vel.y = 0; me.inWater = true; me.onGround = true; me.chute = false; }
  me.pos.set(x, ny, z);

  if (me.onGround && wl > 0 && !me.inWater) {
    stepT -= dt * (speed / 5);
    if (stepT <= 0) { stepT = 0.42; sfx.step(); }
  }
}

// ---------- Gegenstaende ----------
function selectHeld(id) {
  if (id === me.held) return;
  me.held = id; me.reloadT = 0; me.polishing = false; me.cooldown = Math.max(me.cooldown, 0.2);
}
function startReload(w) {
  const res = w.ammo || 'muni';
  if (invCount(res) <= 0) { UI.toastOnce('noammo', `Keine ${ITEMS[res].name} mehr! (Werkstatt oder Schrotthandel)`, 'bad'); return; }
  me.reloadT = w.reload; me.reloadW = me.held; sfx.reload();
}
function consume(id) {
  invAdd(id, -1);
  me.cooldown = 0.7; me.useT = 1;
  switch (id) {
    case 'bier': me.drunk += 1; net.send({ t: 'heal', a: 5 }); sfx.drink(); UI.toast('Prost! 🍺'); break;
    case 'schnaps': me.drunk += 2.5; net.send({ t: 'heal', a: 10 }); sfx.drink(); UI.toast('Zum Wohl! Der brennt gscheit. 🥃'); break;
    case 'semmel': net.send({ t: 'heal', a: 40 }); sfx.eat(); UI.toast('Mahlzeit! +40 HP 🥪', 'good'); break;
    case 'gras': me.fx.gras = 45; sfx.smoke(); UI.toast('Alles wird gaaanz gemütlich… 🌿'); break;
    case 'pilze': me.fx.pilze = 40; sfx.eat(); UI.toast('Die Farben… die FARBEN! 🍄'); break;
    case 'pulver': me.fx.pulver = 25; me.fx.crash = 0; sfx.smoke(); UI.toast('TURBO! ⚡', 'good'); break;
    default: break;
  }
  if (me.drunk >= 9 && me.fx.blackout <= 0) {
    me.fx.blackout = 5.5;
    UI.setBlack(true, 'Filmriss…');
  }
}
let squeakT = 0, vmSwing = 0;
function updateHeld(dt, ctl) {
  const hot = UI.hotbarItems();
  if (!invCount(me.held)) selectHeld(hot[0] || null);
  if (ctl) {
    for (let i = 1; i <= 9; i++) if (G.pressed['Digit' + i] && hot[i - 1]) selectHeld(hot[i - 1]);
    if (G.mouse.wheel && hot.length) {
      const i = hot.indexOf(me.held);
      selectHeld(hot[(i + Math.sign(G.mouse.wheel) + hot.length) % hot.length]);
    }
  }
  setViewItem(me.held);
  me.cooldown -= dt;
  me.recoil = Math.max(0, me.recoil - dt * 7);
  me.useT = Math.max(0, me.useT - dt * 2.5);
  vmSwing = Math.max(0, vmSwing - dt * 4);
  const id = me.held, w = WEAPONS[id];
  const m = ctl ? G.mouse : { l: false, r: false, lp: false, rp: false };
  camera.getWorldDirection(_d);
  const eye = camera.position;
  let ghost = null;
  let polishing = false;

  if (me.reloadT > 0) {
    me.reloadT -= dt;
    if (me.reloadT <= 0 && me.reloadW === id && w) {
      const res = w.ammo || 'muni';
      const n = Math.min(w.mag - (me.mags[id] || 0), invCount(res));
      me.mags[id] = (me.mags[id] || 0) + n; invAdd(res, -n);
    }
  }
  if (w) {
    const mag = me.mags[id] || 0;
    const trig = w.auto ? m.l : m.lp;
    if (me.reloadT <= 0) {
      if ((ctl && G.pressed.KeyR && mag < w.mag) || (trig && mag <= 0)) startReload(w);
      else if (trig && me.cooldown <= 0 && mag > 0) {
        me.mags[id] = mag - 1; me.cooldown = w.rate; me.recoil = 1;
        me.pitch = Math.min(1.55, me.pitch + w.kick * (0.6 + Math.random() * 0.5));
        _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
        const muzzle = new THREE.Vector3().copy(eye).addScaledVector(_d, 0.7).addScaledVector(_r, 0.25).addScaledVector(_u, -0.2);
        if (w.proj) {
          _p.copy(eye).addScaledVector(_d, 1.0);
          C.spawnProjectile(w.proj, _p, _m.copy(_d).multiplyScalar(PROJ[w.proj].speed), true);
          sfx.shot('pzf');
        } else {
          const spread = w.spread * (m.r ? 0.5 : 1) * (1 + me.drunk * 0.35);
          const bs = [];
          for (let i = 0; i < w.pellets; i++) {
            _m.set(_d.x + (Math.random() - 0.5) * 2 * spread, _d.y + (Math.random() - 0.5) * 2 * spread, _d.z + (Math.random() - 0.5) * 2 * spread).normalize();
            const end = C.fireHitscan(eye, _m, w.range, w.dmg, { weapon: ITEMS[id].name });
            C.fxTracer(muzzle, end);
            bs.push([+end.x.toFixed(1), +end.y.toFixed(1), +end.z.toFixed(1)]);
          }
          sfx.shot(id);
          net.send({ t: 'fx', k: 'shot', w: id, a: [+muzzle.x.toFixed(1), +muzzle.y.toFixed(1), +muzzle.z.toFixed(1)], bs });
        }
      }
    }
  } else if (id === 'schaufel') {
    if ((m.l || m.r) && me.cooldown <= 0) {
      me.cooldown = 0.38; vmSwing = 1;
      let done = false;
      if (m.l) {
        C.fireHitscan(eye, _d, 2.7, 22, { weapon: 'Schaufel', structMul: 1.6 });
        done = C.lastHit.kind === 'player' || C.lastHit.kind === 'veh' || C.lastHit.kind === 'box';
        if (done) sfx.dig(0.6);
      }
      if (!done) {
        const t = raycastTerrain(eye.x, eye.y, eye.z, _d.x, _d.y, _d.z, 4.6);
        if (t >= 0) {
          const px = eye.x + _d.x * t, pz = eye.z + _d.z * t;
          if (m.l) C.doDig(px, pz, 1.9, 0.5, 1.2); else C.doFill(px, pz, 1.9, 0.5);
        }
      }
    }
  } else if (id === 'banane') {
    if (m.l) {
      polishing = true;
      me.wibaProg += dt / 5;
      squeakT -= dt;
      if (squeakT <= 0) { squeakT = 0.16; sfx.squeak(); }
      if (me.wibaProg >= 1) { me.wibaProg = 0; C.awardWiba(1, 10, 'Banane auf Hochglanz gewichst'); }
    } else me.wibaProg = Math.max(0, me.wibaProg - dt * 0.15);
  } else if (id === 'granate') {
    if (m.lp && me.cooldown <= 0) {
      invAdd('granate', -1); me.cooldown = 0.8; vmSwing = 1;
      _p.copy(eye).addScaledVector(_d, 0.8);
      _m.copy(_d).multiplyScalar(PROJ.granate.speed); _m.y += 4; _m.x += me.vel.x; _m.z += me.vel.z;
      C.spawnProjectile('granate', _p, _m, true);
      sfx.reload();
    }
  } else if (id === 'platte' || id === 'wand') {
    if (ctl && G.pressed.KeyR) me.buildRot = me.buildRot ? 0 : 1;
    const t = C.buildTarget(id, me.buildRot, eye, _d);
    const dm = C.structDims(id, me.buildRot);
    ghost = ghosts[id];
    ghost.position.set(t.x, t.y + dm.yOff + dm.h / 2, t.z);
    ghost.rotation.y = id === 'wand' && me.buildRot ? Math.PI / 2 : 0;
    if (m.lp && me.cooldown <= 0) {
      me.cooldown = 0.3;
      if (isProtected(t.x, t.z)) { UI.toastOnce('nobuild', 'Im Ortsgebiet und am Flugplatz wird nicht gebaut!', 'bad'); sfx.deny(); }
      else { net.send({ t: 'build', k: id, x: t.x, y: t.y, z: t.z, r: me.buildRot }); invAdd(id, -1); vmSwing = 1; }
    }
  } else if (id && ITEMS[id].use) {
    if (m.lp && me.cooldown <= 0) consume(id);
  }
  me.polishing = polishing;
  UI.setWibaBar(id === 'banane' ? me.wibaProg : 0);
  for (const kk of Object.keys(ghosts)) ghosts[kk].visible = ghosts[kk] === ghost;

  // Sichtmodell animieren
  const bob = me.onGround ? Math.sin(G.time * 9) * 0.012 * Math.min(1, Math.hypot(me.vel.x, me.vel.z) / 5) : 0;
  vm.position.set(0.34, -0.34 + bob - me.useT * 0.1, -0.62 + me.recoil * 0.09);
  vm.rotation.set(me.recoil * 0.22 - vmSwing * 0.9 + me.useT * 0.5, 0, 0);
  vmCloth.visible = polishing;
  if (polishing) {
    vm.position.x = 0.16; vm.position.y = -0.26;
    const ph = Math.sin(G.time * 26);
    vmCloth.position.set(-0.04 - ph * 0.05, 0.1 + ph * 0.03, -0.02 - ph * 0.07);
    vmCloth.rotation.set(0.3, 0.5, -0.5);
    vm.rotation.z = ph * 0.04;
  }
  if (me.reloadT > 0) vm.rotation.x = -0.6;
}

// ---------- Rausch & Effekte ----------
let lastFilter = '', filterT = 0, healT = 0, blackoutDone = false;
function updateEffects(dt) {
  const fx = me.fx;
  me.drunk = Math.max(0, me.drunk - dt / 22);
  const hadPulver = fx.pulver > 0;
  fx.gras = Math.max(0, fx.gras - dt); fx.pilze = Math.max(0, fx.pilze - dt);
  fx.pulver = Math.max(0, fx.pulver - dt); fx.crash = Math.max(0, fx.crash - dt);
  if (hadPulver && fx.pulver <= 0) { fx.crash = 12; UI.toast('Der Turbo ist aus. Alles tut weh. 🥱', 'bad'); }
  if (fx.gras > 0 && me.hp < 100 && !me.dead) {
    healT += dt;
    if (healT > 2.5) { healT = 0; net.send({ t: 'heal', a: 3 }); }
  }
  if (fx.blackout > 0) {
    fx.blackout -= dt;
    if (fx.blackout < 2 && !blackoutDone) {
      blackoutDone = true;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * 6.28, d = 20 + Math.random() * 50;
        const x = me.pos.x + Math.cos(a) * d, z = me.pos.z + Math.sin(a) * d;
        if (waterLevelAt(x, z) < -1e8 && !polyAt(x, z, 1.5) && !me.vehicle) { me.pos.set(x, getHeight(x, z), z); break; }
      }
      me.drunk = 3.5; me.yaw = Math.random() * 6.28;
      hurtSelf(10, 'Alkohol');
      UI.setBlack(false);
      UI.toast('Wo… wo bin ich? 🥴');
    }
    if (fx.blackout <= 0) blackoutDone = false;
  }
  filterT -= dt;
  if (filterT <= 0) {
    filterT = 0.05;
    const f = [];
    if (me.drunk > 1.5) f.push(`blur(${Math.min(4.5, (me.drunk - 1.5) * (me.vehicle ? 0.6 : 0.45)).toFixed(1)}px)`);
    if (fx.pilze > 0) { f.push(`hue-rotate(${Math.round((G.time * 70) % 360)}deg)`); f.push('saturate(2.3)'); }
    else if (fx.gras > 0) { f.push('saturate(1.45)'); f.push('sepia(0.25)'); }
    if (fx.pulver > 0) f.push('contrast(1.3)');
    if (fx.crash > 0) f.push('grayscale(0.7)');
    const s = f.join(' ') || 'none';
    if (s !== lastFilter) { lastFilter = s; canvas.style.filter = s; }
    if (fx.gras > 0) UI.setTint('#3cff6a', 0.07); else if (fx.pulver > 0) UI.setTint('#ffffff', 0.05); else UI.setTint('#000', 0);
  }
  let fov = 75;
  if (fx.pulver > 0) fov += 14;
  if (fx.pilze > 0) fov += Math.sin(G.time * 1.7) * 9;
  if (fx.gras > 0) fov += 5;
  if (!me.vehicle && G.mouse.r && WEAPONS[me.held]) fov -= 28;
  if (me.vehicle && V.isAir(me.vehicle)) fov += me.vehicle.throttle * 10;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 10 * dt); camera.updateProjectionMatrix(); }
  me.shake = Math.max(0, me.shake - dt * 1.8);
}

// ---------- Interaktion ----------
function nearestPoi(maxD) {
  let best = null, bd = maxD;
  for (const p of pois) {
    const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z);
    if (d < bd && Math.abs(p.y - me.pos.y) < 4) { bd = d; best = p; }
  }
  return best;
}
let promptT = 0;
function updateInteraction(dt, ctl) {
  if (ctl && G.pressed.KeyE && !me.dead) {
    if (me.vehicle) V.exitVehicle();
    else if (!V.tryEnter()) { const p = nearestPoi(4.2); if (p) { UI.openMenu(p.kind); $('clickhint').classList.add('hidden'); } }
  }
  if (ctl && G.pressed.KeyI) { UI.openMenu('inv'); $('clickhint').classList.add('hidden'); }
  promptT -= dt;
  if (promptT > 0) return;
  promptT = 0.15;
  if (me.vehicle || me.dead || G.menu) { UI.setPrompt(null); return; }
  const v = V.nearestVehicle(3.6);
  if (v) { UI.setPrompt(`[E] ${v.spec.name} einsteigen`); return; }
  const p = nearestPoi(4.2);
  if (p) { UI.setPrompt(`[E] ${p.label}`); return; }
  if (!me.onGround && !me.chute && me.vel.y < -7) { UI.setPrompt('[LEERTASTE] Fallschirm!'); return; }
  UI.setPrompt(null);
}

// ---------- Hauptschleife ----------
let last = performance.now(), sendT = 0, ambT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (!G.started) return;
  G.time += dt;
  const ctl = !G.menu && !G.chat && !me.dead && me.fx.blackout <= 2 && !G.spawnPending;

  if (me.dead) {
    me.deadT -= dt;
    UI.setDeathTimer(me.deadT);
    if (me.deadT <= 0 && me.deadT > -100) { me.deadT = -1000; net.send({ t: 'respawn' }); }
  }
  updateInteraction(dt, ctl);
  if (ctl && G.pressed.KeyB) { if (invCount('bier') > 0) consume('bier'); else UI.toastOnce('nobier', 'Kein Bier mehr! Ab ins Wirtshaus.', 'bad'); }
  if (G.pressed.KeyP && !G.chat) radio.toggle();
  if (G.pressed.KeyM && !G.chat && !G.menu) UI.toggleMap();
  if (G.pressed.Comma) radio.setVol(radio.vol - 0.1);
  if (G.pressed.Period) radio.setVol(radio.vol + 0.1);
  if (me.vehicle) {
    if (!ctl) { G.mouse.dx = G.mouse.dy = 0; }
    vm.visible = false; UI.setWibaBar(0);
    for (const kk of Object.keys(ghosts)) ghosts[kk].visible = false;
    me.polishing = false;
  } else if (!me.dead && !G.spawnPending) {
    updatePlayer(dt, ctl);
  }
  V.updateVehicles(dt);
  updatePlayers(dt);


  // Kamera
  if (me.vehicle) {
    V.vehicleCamera(me.vehicle, dt);
    UI.setCrosshair(false);
  } else {
    const sh = me.shake;
    camera.position.set(
      me.pos.x + (Math.random() - 0.5) * sh * 0.5,
      me.pos.y + (me.dead ? 0.35 : 1.7) + (Math.random() - 0.5) * sh * 0.5 + (me.drunk > 1 ? Math.sin(G.time * 1.1) * 0.03 * me.drunk : 0),
      me.pos.z + (Math.random() - 0.5) * sh * 0.5,
    );
    const dr = me.drunk;
    camera.rotation.set(
      me.pitch + Math.sin(G.time * 0.8) * 0.012 * dr,
      me.yaw + Math.sin(G.time * 0.6) * 0.02 * dr,
      (me.dead ? 1.2 : 0) + Math.sin(G.time * 0.95) * 0.028 * dr + (me.fx.pilze > 0 ? Math.sin(G.time * 0.7) * 0.08 : 0),
    );
    camera.updateMatrixWorld();
    vm.visible = !me.dead;
    UI.setCrosshair(!me.dead);
    if (!me.dead) updateHeld(dt, ctl);
  }
  C.updateProjectiles(dt);
  C.updateFx(dt);
  updateEffects(dt);
  flushTerrain();
  const sx = me.vehicle ? me.vehicle.pos.x : me.pos.x, sz = me.vehicle ? me.vehicle.pos.z : me.pos.z;
  const pend = updateObjects(sx, sz, G.spawnPending ? 40 : 6);
  const tpend = updateTerrain(sx, sz, G.spawnPending ? 40 : 5);
  if (G.spawnPending) { G.spawnPending += dt; if ((!pend && !tpend) || G.spawnPending > 25) finishSpawn(); }
  updateMarkers(sx, sz, dt);
  updateNpcs(dt, !pend);
  const st = G.serverTimeOffset + now / 1000;
  G.dayT = ((st / DAY_LENGTH) + 0.36) % 1;
  G.daylight = updateSky(G.dayT, dt, me.pos, scene);
  UI.updateHUD(dt);
  ambT -= dt;
  if (ambT <= 0) {
    ambT = 0.3;
    const p = camera.position;
    const inTown = landuseAt(me.pos.x, me.pos.z) === 3;
    let wn = 0;
    for (const [ox, oz] of [[0, 0], [25, 0], [-25, 0], [0, 25], [0, -25]]) if (waterLevelAt(p.x + ox, p.z + oz) > p.y - 25) wn++;
    const agl = p.y - getHeight(p.x, p.z);
    const wat = wn ? 0.02 + wn * 0.008 : 0;
    const air = me.vehicle && V.isAir(me.vehicle);
    ambient(inTown && !air ? 0.03 + 0.04 * G.daylight : 0, wat, Math.min(0.09, Math.max(0, agl - 20) / 900 + Math.max(0, p.y + M.meta.yoff - 900) / 9000 + (air ? 0.05 : 0.004)));
    if (!inTown && !air && G.daylight > 0.3 && agl < 60 && Math.random() < 0.09) sfx.bird();
    if (inTown && Math.random() < 0.004) sfx.bell();
  }

  sendT -= dt;
  if (sendT <= 0) {
    sendT = 0.08;
    let a = 0;
    if (Math.hypot(me.vel.x, me.vel.z) > 0.5) a |= 1;
    if (me.polishing) a |= 4;
    if (me.chute) a |= 8;
    net.send({
      t: 's', p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)],
      y: +me.yaw.toFixed(3), x: +me.pitch.toFixed(3), a, w: me.vehicle ? '' : (me.held || ''),
    });
  }
  if (!G.noRender) renderer.render(scene, camera);
  G.mouse.dx = 0; G.mouse.dy = 0; G.mouse.lp = false; G.mouse.rp = false; G.mouse.wheel = 0;
  G.pressed = {};
}
requestAnimationFrame(frame);

window.WIBA = { G, net, C, V, UI, getHeight };

radio.onChange = () => {
  const el = $('radio');
  const st = radio.status;
  el.textContent = `📻 Radio Salzburg – ${st}${st === 'Verbindung fehlgeschlagen' ? ' · [P] neu verbinden' : (st === 'spielt' || st === 'lädt' ? ' · [P] Pause' : ' · [P] Start')} · [,][.] Lautstärke ${Math.round(radio.vol * 100)}%`;
};
radio.onChange();
