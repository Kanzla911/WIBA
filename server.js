'use strict';
// WIBA - Spielserver (statische Dateien + WebSocket-Multiplayer)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream',
};

const VEH_HP = { bagger: 400, auto: 200, flieger: 150, jet: 220 };
const E = Math.PI / 2; // Blick nach Osten (+X)
const FALLBACK_SPAWNS = [
  ['bagger', 30, 0, 30, 0], ['bagger', 40, 0, 30, 0], ['auto', -10, 0, 12, 0], ['auto', -18, 0, 12, 0], ['auto', 12, 0, -14, 0],
  ['flieger', 300, 0, 300, E], ['flieger', 300, 0, 315, E], ['jet', 300, 0, 330, E], ['jet', 300, 0, 345, E], ['jet', 320, 0, 338, E],
];

// Echte Karte (public/world) lesen: Fahrzeuge auf Strassen stellen, Flugplatz bestimmen
function planWorld() {
  const dir = path.join(PUBLIC, 'world');
  let meta, pois, H, L;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    pois = JSON.parse(fs.readFileSync(path.join(dir, 'pois.json'), 'utf8'));
    H = new Int16Array(new Uint8Array(fs.readFileSync(path.join(dir, 'heights.bin'))).buffer);
    L = fs.readFileSync(path.join(dir, 'landuse.bin'));
  } catch (e) { return { spawns: FALLBACK_SPAWNS, air: null }; }
  const { nx, nz, cell, minX, minZ, hscale, tile } = meta;
  const ci = (x, z) => { const i = Math.round((x - minX) / cell), j = Math.round((z - minZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : i + j * nx; };
  const hAt = (x, z) => { const c = ci(x, z); return c < 0 ? 0 : H[c] / hscale; };
  const tiles = new Set(meta.tiles), cache = new Map(), used = [];
  const tileRoads = (tx, tz) => {
    const k = tx + '_' + tz;
    if (!cache.has(k)) {
      let d = {};
      if (tiles.has(k)) { try { d = JSON.parse(fs.readFileSync(path.join(dir, 'tiles', k + '.json'), 'utf8')); } catch (e) { d = {}; } }
      cache.set(k, (d.r || []).filter((r) => r[0] >= 3 && r[0] <= 6 && !r[2]).map((r) => { const p = []; for (let i = 3; i < r.length; i += 2) p.push([tx * tile + r[i] / 10, tz * tile + r[i + 1] / 10]); return p; }));
    }
    return cache.get(k);
  };
  // naechster freier Punkt auf einer Strasse
  const roadSpot = (x, z) => {
    let best = null, bd = 1e9;
    const tx = Math.floor(x / tile), tz = Math.floor(z / tile);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const line of tileRoads(tx + a, tz + b)) {
      for (let i = 1; i < line.length; i++) {
        const p = line[i - 1], q = line[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        for (let t = 4; t < len - 3; t += 9) {
          const px = p[0] + ((q[0] - p[0]) * t) / len, pz = p[1] + ((q[1] - p[1]) * t) / len, d = Math.hypot(px - x, pz - z);
          if (d >= bd || used.some((u) => Math.hypot(u[0] - px, u[1] - pz) < 14)) continue;
          bd = d; best = [px, pz, Math.atan2(q[0] - p[0], q[1] - p[1])];
        }
      }
    }
    if (!best) best = [x, z, 0];
    used.push(best);
    return best;
  };
  const spawns = [];
  const put = (type, x, z) => { const s = roadSpot(x, z); spawns.push([type, s[0], hAt(s[0], s[1]), s[1], s[2]]); };
  for (const [dx, dz] of [[20, 20], [-30, 10], [10, -40], [-50, -50]]) put('auto', dx, dz);
  for (const [dx, dz] of [[120, 90], [140, 100], [-160, 120]]) put('bagger', dx, dz);
  const places = pois.filter((p) => p.k === 'place' && p.r <= 2 && Math.hypot(p.x, p.z) > 400).sort((a, b) => a.r - b.r).slice(0, 45);
  for (const p of places) { put('auto', p.x + 15, p.z + 10); if (p.r <= 1) { put('auto', p.x - 40, p.z - 30); put('bagger', p.x + 80, p.z - 60); } }
  // Flugplatz: echter (OSM) oder flachster Wiesenstreifen in Stadtnaehe
  let air = null;
  if (meta.airfield && meta.airfield.len > 350) {
    const a = meta.airfield; air = { x0: a.x0, z0: a.z0, x1: a.x1, z1: a.z1, w: a.w, level: hAt(a.x0, a.z0), made: false };
  } else {
    let best = null;
    for (let cz = -7000; cz <= 7000; cz += 200) for (let cx = -7000; cx <= 7000; cx += 200) {
      let lo = 1e9, hi = -1e9, sum = 0, n = 0, ok = true;
      for (let x = cx - 380; x <= cx + 380 && ok; x += 20) for (let z = cz - 40; z <= cz + 40; z += 20) {
        const c = ci(x, z);
        if (c < 0 || (L[c] !== 0 && L[c] !== 2)) { ok = false; break; }
        const h = H[c] / hscale; if (h < lo) lo = h; if (h > hi) hi = h; sum += h; n++;
      }
      if (!ok) continue;
      const score = (hi - lo) + Math.hypot(cx, cz) / 2500;
      if (!best || score < best.score) best = { score, cx, cz, level: sum / n };
    }
    if (best) air = { x0: best.cx - 350, z0: best.cz, x1: best.cx + 350, z1: best.cz, w: 30, level: Math.round(best.level * 10) / 10, made: true };
  }
  if (air) {
    const len = Math.hypot(air.x1 - air.x0, air.z1 - air.z0), dx = (air.x1 - air.x0) / len, dz = (air.z1 - air.z0) / len, yaw = Math.atan2(dx, dz);
    ['jet', 'flieger', 'jet', 'flieger', 'jet'].forEach((type, i) => {
      const along = 14 + Math.floor(i / 2) * 26, side = (i % 2 ? 1 : -1) * 8;
      spawns.push([type, air.x0 + dx * along - dz * side, air.level, air.z0 + dz * along + dx * side, yaw]);
    });
    spawns.push(['auto', air.x0 - dx * 12 - dz * 22, air.level, air.z0 - dz * 12 + dx * 22, yaw]);
  }
  return { spawns, air };
}

function num(v, d = 0) { return typeof v === 'number' && Number.isFinite(v) ? v : d; }
function r2(v) { return Math.round(v * 100) / 100; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function yawQuat(y) { return [0, Math.sin(y / 2), 0, Math.cos(y / 2)]; }

function lanIPs() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs)) {
    for (const i of ifs[k] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

function startServer(opts = {}) {
  const wantPort = opts.port === undefined ? 31337 : opts.port;
  const saveFile = opts.saveFile || null;

  const players = new Map();
  const vehicles = new Map();
  const digs = new Map();
  const structs = new Map();
  let nextId = 1, nextStruct = 1, dirty = false;
  const t0 = Date.now();

  const plan = planWorld();
  plan.spawns.forEach((s, i) => {
    const id = i + 1;
    vehicles.set(id, {
      id, type: s[0], home: { p: [s[1], s[2], s[3]], q: yawQuat(s[4]) },
      p: [s[1], s[2], s[3]], q: yawQuat(s[4]), e: [0, 0, 0, 0],
      driver: 0, hp: VEH_HP[s[0]], dead: false, respawnAt: 0,
    });
  });

  // ---- Welt laden/speichern ----
  if (saveFile) {
    try {
      const d = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
      for (const [i, h] of d.digs || []) digs.set(i, h);
      for (const s of d.structs || []) { structs.set(s.id, s); nextStruct = Math.max(nextStruct, s.id + 1); }
    } catch (e) { /* keine gespeicherte Welt */ }
  }
  function save() {
    if (!saveFile || !dirty) return;
    dirty = false;
    try {
      fs.writeFileSync(saveFile, JSON.stringify({ digs: [...digs.entries()], structs: [...structs.values()] }));
    } catch (e) { /* egal */ }
  }

  // ---- HTTP ----
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ips: lanIPs(), port: server.address().port, players: players.size }));
      return;
    }
    if (url === '/') url = '/index.html';
    const file = path.normalize(path.join(PUBLIC, url));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end('Nein.'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Nicht gefunden'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server, maxPayload: 1 << 20 });

  function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const p of players.values()) if (p.ws !== except && p.ws.readyState === 1 && p.joined) p.ws.send(s);
  }
  function vehState(v) {
    return { id: v.id, type: v.type, p: v.p, q: v.q, e: v.e, driver: v.driver, hp: v.hp, dead: v.dead, maxHp: VEH_HP[v.type] };
  }
  function pubPlayer(p) {
    return { id: p.id, name: p.name, color: p.color, p: p.p, yaw: p.yaw, hp: p.hp, dead: p.dead, k: p.k, d: p.d, wiba: p.wiba, v: p.v };
  }
  function damagePlayer(target, dmg, byId, weapon) {
    if (!target || target.dead || !target.joined) return;
    target.hp = Math.max(0, Math.min(100, target.hp - dmg));
    broadcast({ t: 'hp', id: target.id, hp: target.hp, by: byId });
    if (target.hp <= 0) {
      target.dead = true; target.d++;
      const killer = players.get(byId);
      if (killer && killer !== target) killer.k++;
      if (target.v) releaseVehicle(target);
      broadcast({ t: 'kill', v: target.id, k: byId, w: String(weapon || '?').slice(0, 20) });
      broadcast({ t: 'sc', id: target.id, k: target.k, d: target.d, w: target.wiba });
      if (killer && killer !== target) broadcast({ t: 'sc', id: killer.id, k: killer.k, d: killer.d, w: killer.wiba });
    }
  }
  function releaseVehicle(p) {
    const v = vehicles.get(p.v);
    p.v = 0;
    if (v && v.driver === p.id) { v.driver = 0; broadcast({ t: 'vdriver', id: v.id, driver: 0 }); }
  }
  function resetVehicle(v) {
    v.p = v.home.p.slice(); v.q = v.home.q.slice(); v.e = [0, 0, 0, 0];
    v.hp = VEH_HP[v.type]; v.dead = false; v.driver = 0; v.respawnAt = 0;
    broadcast({ t: 'vreset', v: vehState(v) });
  }

  wss.on('connection', (ws) => {
    const p = {
      id: nextId++, ws, joined: false, name: 'Hawara', color: 0xffcc00,
      p: [0, 0, 0], yaw: 0, pitch: 0, a: 0, w: '', v: 0,
      hp: 100, dead: false, k: 0, d: 0, wiba: 0,
    };
    players.set(p.id, p);

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      try { handle(m); } catch (e) { /* kaputte Nachricht ignorieren */ }
    });

    function handle(m) {
      if (m.t === 'join') {
        if (p.joined) return;
        p.name = String(m.name || 'Hawara').replace(/[<>&]/g, '').trim().slice(0, 16) || 'Hawara';
        p.color = num(m.color, 0xffcc00) & 0xffffff;
        p.wiba = Math.max(0, Math.min(1e6, Math.floor(num(m.wiba, 0))));
        p.joined = true;
        send(ws, {
          t: 'welcome', id: p.id, time: (Date.now() - t0) / 1000,
          players: [...players.values()].filter((o) => o.joined && o !== p).map(pubPlayer),
          vehicles: [...vehicles.values()].map(vehState),
          digs: [...digs.entries()],
          air: plan.air,
          structs: [...structs.values()],
        });
        broadcast({ t: 'join', p: pubPlayer(p) }, ws);
        return;
      }
      if (!p.joined) return;
      switch (m.t) {
        case 's': {
          if (!Array.isArray(m.p)) return;
          p.p = [num(m.p[0]), num(m.p[1]), num(m.p[2])];
          p.yaw = num(m.y); p.pitch = num(m.x);
          p.a = num(m.a) | 0; p.w = String(m.w || '').slice(0, 12);
          break;
        }
        case 'chat': {
          const msg = String(m.m || '').slice(0, 160);
          if (msg) broadcast({ t: 'chat', id: p.id, m: msg });
          break;
        }
        case 'dig': {
          if (!Array.isArray(m.e)) return;
          const out = [];
          for (const e of m.e.slice(0, 400)) {
            if (!Array.isArray(e)) continue;
            const i = num(e[0], -1) | 0, h = r2(num(e[1]));
            if (i < 0 || i > 4e8 || h < -600 || h > 4000) continue;
            digs.set(i, h); out.push([i, h]);
          }
          if (out.length) { dirty = true; broadcast({ t: 'dig', e: out }, ws); }
          break;
        }
        case 'build': {
          if (structs.size >= 2500) return;
          const s = {
            id: nextStruct++, k: m.k === 'wand' ? 'wand' : 'platte',
            x: r2(num(m.x)), y: r2(num(m.y)), z: r2(num(m.z)), r: num(m.r) ? 1 : 0, hp: 250, o: p.id,
          };
          structs.set(s.id, s); dirty = true;
          broadcast({ t: 'build', s });
          break;
        }
        case 'sdmg': {
          const s = structs.get(num(m.id));
          if (!s) return;
          s.hp -= Math.max(0, num(m.d));
          if (s.hp <= 0) { structs.delete(s.id); dirty = true; broadcast({ t: 'unbuild', id: s.id }); }
          break;
        }
        case 'hit': {
          if (p.dead) return;
          damagePlayer(players.get(num(m.to)), Math.max(0, Math.min(400, num(m.d))), p.id, m.w);
          break;
        }
        case 'selfdmg': {
          const by = players.has(num(m.by)) ? num(m.by) : p.id;
          damagePlayer(p, Math.max(0, Math.min(1000, num(m.d))), by, m.w);
          break;
        }
        case 'heal': {
          if (p.dead) return;
          p.hp = Math.min(100, p.hp + Math.max(0, Math.min(100, num(m.a))));
          broadcast({ t: 'hp', id: p.id, hp: p.hp, by: 0 });
          break;
        }
        case 'respawn': {
          if (!p.dead) return;
          p.dead = false; p.hp = 100;
          broadcast({ t: 'spawn', id: p.id });
          broadcast({ t: 'hp', id: p.id, hp: 100, by: 0 });
          break;
        }
        case 'enter': {
          const v = vehicles.get(num(m.id));
          if (!v || v.dead || v.driver || p.dead || p.v) return;
          v.driver = p.id; p.v = v.id;
          broadcast({ t: 'vdriver', id: v.id, driver: p.id });
          break;
        }
        case 'exit': {
          if (p.v) releaseVehicle(p);
          break;
        }
        case 'v': {
          const v = vehicles.get(num(m.id));
          if (!v || v.driver !== p.id || v.dead) return;
          if (!Array.isArray(m.p) || !Array.isArray(m.q)) return;
          v.p = [num(m.p[0]), num(m.p[1]), num(m.p[2])];
          v.q = [num(m.q[0]), num(m.q[1]), num(m.q[2]), num(m.q[3], 1)];
          if (Array.isArray(m.e)) v.e = [num(m.e[0]), num(m.e[1]), num(m.e[2]), num(m.e[3])];
          break;
        }
        case 'vdmg': {
          const v = vehicles.get(num(m.id));
          if (!v || v.dead) return;
          v.hp -= Math.max(0, num(m.d));
          if (v.hp <= 0) {
            v.hp = 0; v.dead = true; v.respawnAt = Date.now() + 15000;
            const drv = players.get(v.driver);
            broadcast({ t: 'vdead', id: v.id, by: p.id, drv: v.driver });
            if (drv) { drv.v = 0; }
            v.driver = 0;
          } else {
            broadcast({ t: 'vhp', id: v.id, hp: v.hp, by: p.id });
          }
          break;
        }
        case 'vrepair': {
          const v = vehicles.get(num(m.id));
          if (!v || v.dead || v.driver !== p.id) return;
          v.hp = VEH_HP[v.type];
          broadcast({ t: 'vhp', id: v.id, hp: v.hp, by: 0 });
          break;
        }
        case 'proj': case 'boom': case 'fx': {
          m.by = p.id;
          broadcast(m, ws);
          break;
        }
        case 'wiba': {
          p.wiba += Math.max(0, Math.min(5, num(m.n) | 0));
          broadcast({ t: 'sc', id: p.id, k: p.k, d: p.d, w: p.wiba });
          break;
        }
        default: break;
      }
    }

    ws.on('close', () => {
      if (p.v) {
        const v = vehicles.get(p.v);
        releaseVehicle(p);
        if (v && (v.type === 'flieger' || v.type === 'jet')) resetVehicle(v);
      }
      players.delete(p.id);
      if (p.joined) broadcast({ t: 'leave', id: p.id });
    });
    ws.on('error', () => {});
  });

  // ---- Tick: Snapshots ----
  const tick = setInterval(() => {
    const now = Date.now();
    for (const v of vehicles.values()) if (v.dead && now >= v.respawnAt) resetVehicle(v);
    if (!players.size) return;
    const l = [];
    for (const p of players.values()) {
      if (!p.joined) continue;
      l.push([p.id, r2(p.p[0]), r2(p.p[1]), r2(p.p[2]), r3(p.yaw), r3(p.pitch), p.a, p.w, p.v]);
    }
    const vs = [];
    for (const v of vehicles.values()) {
      if (!v.driver || v.dead) continue;
      vs.push([v.id, r2(v.p[0]), r2(v.p[1]), r2(v.p[2]), r3(v.q[0]), r3(v.q[1]), r3(v.q[2]), r3(v.q[3]),
        r3(v.e[0]), r3(v.e[1]), r3(v.e[2]), r3(v.e[3])]);
    }
    broadcast({ t: 'ss', l, vs });
  }, 66);
  const saver = setInterval(save, 30000);

  return new Promise((resolve, reject) => {
    server.once('error', (e) => { clearInterval(tick); clearInterval(saver); reject(e); });
    server.listen(wantPort, '0.0.0.0', () => {
      resolve({
        port: server.address().port,
        ips: lanIPs(),
        close() { save(); clearInterval(tick); clearInterval(saver); wss.close(); server.close(); },
      });
    });
  });
}

module.exports = { startServer };

if (require.main === module) {
  const port = parseInt(process.env.PORT || process.argv[2] || '31337', 10);
  startServer({ port, saveFile: path.join(__dirname, 'world-save-v3.json') }).then((s) => {
    console.log('WIBA-Server laeuft auf Port ' + s.port);
    console.log('Lokal:    http://localhost:' + s.port);
    for (const ip of s.ips) console.log('Netzwerk: ' + ip + ':' + s.port);
    process.on('SIGINT', () => { s.close(); process.exit(0); });
  }).catch((e) => { console.error('Server konnte nicht starten:', e.message); process.exit(1); });
}
