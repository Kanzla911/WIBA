// WIBA - gemeinsamer Spielzustand + Netzwerk
import * as THREE from 'three';

export const G = {
  scene: null, camera: null, renderer: null, canvas: null,
  started: false, time: 0, serverTimeOffset: 0, dayT: 0.4, daylight: 1,
  me: {
    id: 0, name: 'Hawara', color: 0xffcc00,
    pos: new THREE.Vector3(0, 6, 28), vel: new THREE.Vector3(),
    yaw: Math.PI, pitch: 0, onGround: false, inWater: false,
    hp: 100, dead: false, deadT: 0, vehicle: null, chute: false, airT: 0,
    inv: { schaufel: 1, banane: 1, bier: 2, semmel: 1 }, money: 150, wiba: 0, kills: 0, deaths: 0,
    held: 'schaufel', mags: {}, cooldown: 0, reloadT: 0, reloadW: null, useT: 0, recoil: 0,
    drunk: 0, fx: { gras: 0, pilze: 0, pulver: 0, crash: 0, blackout: 0 },
    wibaProg: 0, polishing: false, idleT: 0, buildRot: 0, shake: 0,
  },
  players: new Map(), vehicles: new Map(), structs: new Map(), projectiles: [],
  keys: {}, mouse: { dx: 0, dy: 0, l: false, r: false, lp: false, rp: false, wheel: 0 },
  pressed: {}, locked: false, menu: null, chat: false,
};

export const net = {
  ws: null, handlers: {},
  on(type, fn) { this.handlers[type] = fn; },
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); },
  connect(url) {
    return new Promise((resolve, reject) => {
      let done = false;
      const ws = new WebSocket(url);
      const timer = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) { /* */ } reject(new Error('Zeitüberschreitung')); } }, 6000);
      ws.onopen = () => { if (done) return; done = true; clearTimeout(timer); this.ws = ws; resolve(); };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject(new Error('Verbindung fehlgeschlagen')); } };
      ws.onclose = () => { if (this.ws === ws && this.handlers.closed) this.handlers.closed(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        const h = this.handlers[m.t];
        if (h) h(m);
      };
    });
  },
};

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function invCount(id) { return G.me.inv[id] || 0; }
export function invAdd(id, n) {
  const v = (G.me.inv[id] || 0) + n;
  if (v <= 0) delete G.me.inv[id]; else G.me.inv[id] = v;
}
