'use strict';
// Schnelltest fuer den WIBA-Server: zwei Spieler verbinden sich, sehen einander,
// graben, bauen, schiessen und steigen in Fahrzeuge. Laeuft ohne Grafik.
const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { startServer } = require('../server');
const fs = require('fs');
const path = require('path');

function client(port, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port);
    const c = { ws, msgs: [], welcome: null };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      c.msgs.push(m);
      if (m.t === 'welcome') { c.welcome = m; resolve(c); }
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, color: 0xff0000 })));
    ws.on('error', reject);
    c.send = (o) => ws.send(JSON.stringify(o));
    c.find = (t, pred) => c.msgs.find((m) => m.t === t && (!pred || pred(m)));
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

(async () => {
  const srv = await startServer({ port: 0, saveFile: null });
  try {
    const page = await get(srv.port, '/');
    assert.strictEqual(page.status, 200);
    assert.ok(page.body.includes('WIBA'));
    assert.strictEqual((await get(srv.port, '/js/game.js')).status, 200);
    assert.strictEqual((await get(srv.port, '/vendor/three.module.js')).status, 200);
    assert.strictEqual((await get(srv.port, '/../server.js')).status, 403);
    assert.strictEqual((await get(srv.port, '/gibtsnicht.js')).status, 404);

    // Routenplaner (nur mit echter Karte)
    if (fs.existsSync(path.join(__dirname, '..', 'public', 'world', 'meta.json'))) {
      const r = JSON.parse((await get(srv.port, '/route?ax=-90&az=-140&bx=-4700&bz=6600')).body);
      assert.ok(r.pts && r.pts.length > 20 && r.dist > 5000 && r.time > 60, 'Route Voecklabruck -> Kammer');
    }
    const a = await client(srv.port, 'Sepp');
    const b = await client(srv.port, 'Franz');
    assert.ok(a.welcome.vehicles.length >= 10, 'Fahrzeuge vorhanden');
    assert.strictEqual(b.welcome.players.length, 1, 'B sieht A');
    await wait(100);
    assert.ok(a.find('join', (m) => m.p.name === 'Franz'), 'A sieht B beitreten');

    // Bewegung -> Snapshot
    a.send({ t: 's', p: [10, 6, 20], y: 1, x: 0, a: 1, w: 'stg' });
    await wait(200);
    const ss = b.msgs.filter((m) => m.t === 'ss').pop();
    assert.ok(ss && ss.l.find((e) => e[0] === a.welcome.id && e[1] === 10 && e[7] === 'stg'), 'Position kommt an');

    // Graben + Bauen
    a.send({ t: 'dig', e: [[5000, 3.25], [5001, 2.5]] });
    a.send({ t: 'build', k: 'platte', x: 150, y: 9, z: 0, r: 0 });
    await wait(100);
    assert.ok(b.find('dig', (m) => m.e.length === 2), 'Graben wird verteilt');
    const built = b.find('build');
    assert.ok(built && built.s.k === 'platte', 'Bauteil wird verteilt');
    a.send({ t: 'sdmg', id: built.s.id, d: 999 });
    await wait(100);
    assert.ok(b.find('unbuild', (m) => m.id === built.s.id), 'Bauteil zerstoerbar');

    // Kampf
    for (let i = 0; i < 5; i++) a.send({ t: 'hit', to: b.welcome.id, d: 25, w: 'Sturmgewehr' });
    await wait(100);
    const kill = b.find('kill');
    assert.ok(kill && kill.v === b.welcome.id && kill.k === a.welcome.id, 'Kill wird gemeldet');
    b.send({ t: 'respawn' });
    await wait(100);
    assert.ok(a.find('spawn', (m) => m.id === b.welcome.id), 'Respawn');

    // Fahrzeuge
    const jet = a.welcome.vehicles.find((v) => v.type === 'jet');
    a.send({ t: 'enter', id: jet.id });
    await wait(100);
    assert.ok(b.find('vdriver', (m) => m.id === jet.id && m.driver === a.welcome.id), 'Einsteigen');
    b.send({ t: 'enter', id: jet.id });
    b.send({ t: 'vdmg', id: jet.id, d: 99999 });
    await wait(100);
    assert.ok(a.find('vdead', (m) => m.id === jet.id && m.drv === a.welcome.id), 'Fahrzeug zerstoerbar');

    // Neuer Spieler bekommt die veraenderte Welt
    const c = await client(srv.port, 'Nachzuegler');
    assert.strictEqual(c.welcome.digs.length, 2, 'Gegrabenes bleibt erhalten');
    assert.strictEqual(c.welcome.players.length, 2);

    // WIBA-Punkte
    a.send({ t: 'wiba', n: 1 });
    await wait(100);
    assert.ok(b.find('sc', (m) => m.id === a.welcome.id && m.w === 1), 'WIBA-Punkte werden verteilt');

    a.ws.close(); b.ws.close(); c.ws.close();
    await wait(100);
    console.log('WIBA-Server-Schnelltest: alles in Ordnung');
  } finally {
    srv.close();
  }
  process.exit(0);
})().catch((e) => { console.error('Schnelltest FEHLGESCHLAGEN:', e); process.exit(1); });
