'use strict';
// WIBA - Routenplaner: Strassennetz aus den Kartenkacheln, schnellste Route per A*
const fs = require('fs');
const path = require('path');

// Richtgeschwindigkeit je Strassenklasse (km/h): Autobahn ... Fussgaengerzone
const SPEED = [130, 100, 90, 80, 70, 45, 25, 18, 10];
const VMAX = 130 / 3.6;

function buildGraph(dir) {
  const t0 = Date.now();
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const T = meta.tile * 10; // Kachelgroesse in dm
  const ids = new Map();
  const X = [], Z = [], adj = [];
  const node = (xd, zd) => {
    const k = xd * 4194304 + zd;
    let i = ids.get(k);
    if (i === undefined) { i = X.length; ids.set(k, i); X.push(xd / 10); Z.push(zd / 10); adj.push([]); }
    return i;
  };
  let edges = 0;
  for (const key of meta.tiles) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, 'tiles', key + '.json'), 'utf8')); } catch (e) { continue; }
    if (!d.r) continue;
    const [tx, tz] = key.split('_').map(Number);
    for (const r of d.r) {
      const cls = r[0];
      if (cls > 8) continue; // Bahn, Pisten
      const v = SPEED[cls] / 3.6;
      let prev = -1;
      for (let i = 3; i + 1 < r.length; i += 2) {
        const n = node(tx * T + r[i], tz * T + r[i + 1]);
        if (prev >= 0 && prev !== n) {
          const len = Math.hypot(X[n] - X[prev], Z[n] - Z[prev]);
          adj[prev].push(n, len / v, len); adj[n].push(prev, len / v, len);
          edges++;
        }
        prev = n;
      }
    }
  }
  // Rasterindex zum Einrasten auf die naechste Strasse
  const CELL = 60, grid = new Map();
  for (let i = 0; i < X.length; i++) {
    if (!adj[i].length) continue;
    const k = Math.floor(X[i] / CELL) * 100003 + Math.floor(Z[i] / CELL);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(i);
  }
  const g = { X: Float64Array.from(X), Z: Float64Array.from(Z), adj, grid, CELL, n: X.length, edges };
  console.log(`Routenplaner: ${g.n} Knoten, ${edges} Strassenstuecke (${Date.now() - t0} ms)`);
  return g;
}

function nearest(g, x, z) {
  const cx = Math.floor(x / g.CELL), cz = Math.floor(z / g.CELL);
  let best = -1, bd = Infinity;
  for (let r = 0; r <= 40; r++) {
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
      const list = g.grid.get((cx + a) * 100003 + cz + b);
      if (!list) continue;
      for (const i of list) { const d = (g.X[i] - x) ** 2 + (g.Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    if (best >= 0 && r * g.CELL > Math.sqrt(bd) + g.CELL) break;
  }
  return best;
}

// Binaerer Heap fuer A*
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

function route(g, ax, az, bx, bz) {
  const s = nearest(g, ax, az), t = nearest(g, bx, bz);
  if (s < 0 || t < 0) return null;
  const gs = new Float64Array(g.n).fill(Infinity), from = new Int32Array(g.n).fill(-1), done = new Uint8Array(g.n);
  const h = (i) => Math.hypot(g.X[i] - g.X[t], g.Z[i] - g.Z[t]) / VMAX;
  const heap = new Heap();
  gs[s] = 0; heap.push(h(s), s);
  let found = false, visited = 0;
  while (heap.size) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1; visited++;
    if (u === t) { found = true; break; }
    const a = g.adj[u];
    for (let i = 0; i < a.length; i += 3) {
      const w = a[i], ng = gs[u] + a[i + 1];
      if (ng < gs[w]) { gs[w] = ng; from[w] = u; heap.push(ng + h(w), w); }
    }
  }
  if (!found) return null;
  const pts = [];
  let dist = 0;
  for (let u = t; u >= 0; u = from[u]) {
    pts.push(Math.round(g.X[u] * 10) / 10, Math.round(g.Z[u] * 10) / 10);
    if (from[u] >= 0) dist += Math.hypot(g.X[u] - g.X[from[u]], g.Z[u] - g.Z[from[u]]);
  }
  // Reihenfolge Start -> Ziel
  const out = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
  return { pts: out, dist: Math.round(dist), time: Math.round(gs[t]), visited };
}

function createRouter(dir) {
  let graph = null, failed = false;
  const get = () => {
    if (graph || failed) return graph;
    try { graph = buildGraph(dir); } catch (e) { failed = true; console.error('Routenplaner nicht verfuegbar:', e.message); }
    return graph;
  };
  return {
    warm() { setTimeout(get, 50); },
    route(ax, az, bx, bz) { const g = get(); return g ? route(g, ax, az, bx, bz) : null; },
  };
}

module.exports = { createRouter, buildGraph, route, nearest };
