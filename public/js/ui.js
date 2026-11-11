// WIBA - HUD, Menues, Chat, Rangliste, Minimap
import { G, net, invCount, invAdd } from './state.js';
import { ITEMS, HOTBAR_ORDER, SHOPS, RECIPES, VEH, WEAPONS } from './config.js';
import { M, zoneName } from './terrain.js';
import { pois } from './world.js';
import { sfx } from './audio.js';
import { nav, requestRoute, clearRoute, routeLeft } from './navi.js';

const $ = (id) => document.getElementById(id);
let mapCtx = null;
let hotbarKey = '';

export function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function initUI() {
  mapCtx = $('minimap').getContext('2d');
  initBigMap();
}

export function toast(msg, kind = '') {
  const d = document.createElement('div');
  d.textContent = msg; if (kind) d.className = kind;
  const box = $('toasts');
  box.appendChild(d);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
}
const lastToast = {};
export function toastOnce(key, msg, kind, gap = 2500) {
  const now = performance.now();
  if (lastToast[key] && now - lastToast[key] < gap) return;
  lastToast[key] = now; toast(msg, kind);
}

export function addFeed(text) {
  const d = document.createElement('div');
  d.textContent = text;
  const box = $('feed');
  box.appendChild(d);
  while (box.children.length > 6) box.removeChild(box.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 9000);
}
export function addChat(name, msg) {
  const d = document.createElement('div');
  const b = document.createElement('b'); b.textContent = name ? name + ': ' : '';
  d.appendChild(b); d.appendChild(document.createTextNode(msg));
  const box = $('chatlog');
  box.appendChild(d);
  while (box.children.length > 7) box.removeChild(box.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 20000);
}

export function setPrompt(text) {
  const p = $('prompt');
  if (!text) { p.classList.add('hidden'); return; }
  if (p.textContent !== text) p.textContent = text;
  p.classList.remove('hidden');
}

export function hotbarItems() {
  return HOTBAR_ORDER.filter((id) => invCount(id) > 0);
}

export function hitmark() {
  const h = $('hitmark');
  h.style.transition = 'none'; h.style.opacity = '1';
  requestAnimationFrame(() => { h.style.transition = 'opacity .35s'; h.style.opacity = '0'; });
}
export function hurtFlash() {
  const v = $('vignette');
  v.style.opacity = '1';
  setTimeout(() => { v.style.opacity = '0'; }, 220);
}

let hudT = 0;
export function updateHUD(dt) {
  hudT -= dt;
  const me = G.me;
  // Hotbar (nur bei Aenderung neu bauen)
  const items = hotbarItems();
  const key = items.map((id) => id + invCount(id)).join(',') + '|' + me.held + '|' + (me.vehicle ? 1 : 0);
  if (key !== hotbarKey) {
    hotbarKey = key;
    const hb = $('hotbar');
    hb.innerHTML = '';
    items.forEach((id, i) => {
      const s = document.createElement('div');
      s.className = 'slot' + (id === me.held ? ' sel' : '');
      const n = invCount(id);
      s.innerHTML = `<i>${i < 9 ? i + 1 : ''}</i>${ITEMS[id].icon}${n > 1 ? `<b>${n}</b>` : ''}`;
      hb.appendChild(s);
    });
    $('heldname').textContent = me.vehicle ? '' : (ITEMS[me.held] ? ITEMS[me.held].name : '');
  }
  if (hudT > 0) return;
  hudT = 0.1;
  $('hpfill').style.width = Math.max(0, me.hp) + '%';
  $('hptext').textContent = Math.ceil(me.hp) + ' HP';
  $('money').textContent = me.money;
  $('wiba').textContent = me.wiba;
  const w = WEAPONS[me.held];
  if (w && !me.vehicle) {
    const res = w.ammo || 'muni';
    $('ammo').textContent = me.reloadT > 0 ? '🔄 lädt nach…' : `🔫 ${me.mags[me.held] || 0} / ${invCount(res)}`;
  } else $('ammo').textContent = '';
  $('promille').textContent = me.drunk > 0.05 ? `🍺 ${(me.drunk * 0.45).toFixed(1)} ‰` : '';
  const fx = [];
  if (me.fx.gras > 0) fx.push('🌿 entspannt ' + Math.ceil(me.fx.gras) + 's');
  if (me.fx.pilze > 0) fx.push('🍄 auf Reise ' + Math.ceil(me.fx.pilze) + 's');
  if (me.fx.pulver > 0) fx.push('⚡ Turbo ' + Math.ceil(me.fx.pulver) + 's');
  if (me.fx.crash > 0) fx.push('🥱 komplett fertig ' + Math.ceil(me.fx.crash) + 's');
  if (me.chute) fx.push('🪂 Fallschirm offen');
  $('effects').textContent = fx.join(' · ');
  const hrs = (G.dayT * 24);
  const hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
  const rl = routeLeft();
  const wpt = G.waypoint ? ` · 📌 ${rl ? (rl.dist / 1000).toFixed(1) + ' km · ' + Math.max(1, Math.round(rl.time / 60)) + ' min' : (Math.hypot(G.waypoint.x - me.pos.x, G.waypoint.z - me.pos.z) / 1000).toFixed(1) + ' km'}` : '';
  $('loc').textContent = `📍 ${zoneName(me.pos.x, me.pos.z)} · ${Math.round(me.pos.y + M.meta.yoff)} m · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} Uhr${wpt}`;
  drawMinimap();
  if (!$('score').classList.contains('hidden')) renderScore();
}

export function setWibaBar(prog, text) {
  const b = $('wibabar');
  if (prog <= 0) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  $('wibafill').style.width = Math.min(100, prog * 100) + '%';
  if (text) $('wibatext').textContent = text;
}

export function setVehHud(html) {
  const v = $('vehhud');
  if (!html) { v.classList.add('hidden'); return; }
  v.classList.remove('hidden');
  if (v.innerHTML !== html) v.innerHTML = html;
}
export function setAim(x, y) {
  const a = $('aim');
  if (x === null) { a.classList.add('hidden'); return; }
  a.classList.remove('hidden');
  a.style.left = x + 'px'; a.style.top = y + 'px';
}
export function setCrosshair(on) { $('crosshair').style.display = on ? '' : 'none'; }

// ---------- Karten ----------
const ICON = { wirt: '🍺', werk: '🔧', handel: '💰', tank: '⛽', dealer: '🌿', kirche: '⛪', bahnhof: '🚉', flug: '✈️', sternwarte: '🔭', burg: '🏰', fall: '💧', attr: '★' };
const VICON = { bagger: '🚜', auto: '🛻', flieger: '🛩️', jet: '✈️' };
// Zeichnet die Karte: Mittelpunkt (cx,cz) in Weltmetern, s = Pixel pro Meter
function drawMap(ctx, W, H, cx, cz, s, big) {
  const ov = M.overview, m = M.meta;
  ctx.fillStyle = '#16222e'; ctx.fillRect(0, 0, W, H);
  const X = (x) => (x - cx) * s + W / 2, Y = (z) => (z - cz) * s + H / 2;
  if (ov) {
    ctx.imageSmoothingEnabled = s < 0.12;
    const pm = 20; // Meter pro Uebersichtspixel
    ctx.drawImage(ov, X(m.minX - pm / 2), Y(m.minZ - pm / 2), ov.width * pm * s, ov.height * pm * s);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const vis = (x, z, pad = 20) => { const a = X(x), b = Y(z); return a > -pad && b > -pad && a < W + pad && b < H + pad; };
  const text = (t, x, y, size, col = '#fff', bold = true) => { ctx.font = `${bold ? 'bold ' : ''}${size}px "Trebuchet MS", Arial, sans-serif`; ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); };
  // Sehenswuerdigkeiten, Laeden, Gipfel
  for (const p of M.pois) {
    if (p.k === 'place' || !vis(p.x, p.z)) continue;
    const x = X(p.x), y = Y(p.z);
    if (p.k === 'peak') { if (s > 0.035 || (p.e || 0) > 1400) text('▲' + (s > 0.06 && p.n ? ' ' + p.n : ''), x, y, big ? 11 : 9, '#e8e2d0', false); continue; }
    const lim = p.k === 'wirt' || p.k === 'werk' || p.k === 'handel' || p.k === 'tank' ? 0.1 : (p.k === 'kirche' ? 0.22 : 0.06);
    if (s < lim) continue;
    ctx.font = (big ? 15 : 12) + 'px sans-serif'; ctx.fillText(ICON[p.k] || '•', x, y);
    if (big && s > 0.5 && p.n) text(p.n, x, y + 14, 10, '#ffe9a8', false);
  }
  if (s >= 0.1) for (const p of pois) if (p.kind === 'dealer' && vis(p.x, p.z)) { ctx.font = (big ? 15 : 12) + 'px sans-serif'; ctx.fillText(ICON.dealer, X(p.x), Y(p.z)); }
  // Ortsnamen
  for (const p of M.pois) {
    if (p.k !== 'place' || !vis(p.x, p.z, 80)) continue;
    const need = [0, 0, 0.02, 0.07, 0.07, 0.3][p.r];
    if (s < need) continue;
    text(p.n, X(p.x), Y(p.z), (big ? [20, 17, 13, 11, 11, 10] : [13, 12, 10, 9, 9, 8])[p.r], p.r <= 1 ? '#fff' : '#f3ead2', p.r <= 2);
  }
  if (M.air && vis((M.air.x0 + M.air.x1) / 2, (M.air.z0 + M.air.z1) / 2)) { ctx.font = (big ? 18 : 13) + 'px sans-serif'; ctx.fillText('✈️', X((M.air.x0 + M.air.x1) / 2), Y((M.air.z0 + M.air.z1) / 2)); }
  // Fahrzeuge
  for (const v of G.vehicles.values()) {
    if (v.dead || v === G.me.vehicle || !vis(v.pos.x, v.pos.z)) continue;
    if (big && s < 0.05 && v.type !== 'jet' && v.type !== 'flieger') continue;
    ctx.font = (big ? 16 : 12) + 'px sans-serif'; ctx.fillText(VICON[v.type], X(v.pos.x), Y(v.pos.z));
  }
  // Route (violett wie in GTA)
  if (nav.route && G.waypoint) {
    const P = nav.route.pts;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, c] of [[big ? 8 : 6, 'rgba(40,0,60,0.8)'], [big ? 5 : 3.6, '#c23cff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      const me0 = G.me.vehicle ? G.me.vehicle.pos : G.me.pos;
      ctx.moveTo(X(me0.x), Y(me0.z));
      for (let i = nav.idx * 2; i < P.length; i += 2) ctx.lineTo(X(P[i]), Y(P[i + 1]));
      ctx.lineTo(X(G.waypoint.x), Y(G.waypoint.z));
      ctx.stroke();
    }
  }
  // Wegpunkt
  const wp = G.waypoint;
  if (wp) {
    let x = X(wp.x), y = Y(wp.z);
    if (!big) { const dx = x - W / 2, dy = y - H / 2, d = Math.hypot(dx, dy), lim = W / 2 - 9; if (d > lim) { x = W / 2 + (dx / d) * lim; y = H / 2 + (dy / d) * lim; } }
    ctx.fillStyle = '#ff3df0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, big ? 8 : 5, 0, 6.3); ctx.fill(); ctx.stroke();
    if (big && !nav.route) { ctx.strokeStyle = 'rgba(255,61,240,0.75)'; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(X(G.me.pos.x), Y(G.me.pos.z)); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
  }
  // Mitspieler
  for (const p of G.players.values()) {
    if (p.dead) continue;
    let x = X(p.pos.x), y = Y(p.pos.z);
    if (!big) { const dx = x - W / 2, dy = y - H / 2, d = Math.hypot(dx, dy), lim = W / 2 - 7; if (d > lim) { x = W / 2 + (dx / d) * lim; y = H / 2 + (dy / d) * lim; } }
    ctx.fillStyle = '#' + (p.color || 0xff4433).toString(16).padStart(6, '0'); ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, big ? 7 : 4.5, 0, 6.3); ctx.fill(); ctx.stroke();
    if (big) text(p.name, x, y - 15, 13, '#fff');
  }
  // Ich
  const me = G.me;
  ctx.save();
  ctx.translate(X(me.pos.x), Y(me.pos.z));
  ctx.rotate(-(me.vehicle ? me.vehicle.heading + Math.PI : me.yaw));
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  const k = big ? 1.5 : 1;
  ctx.beginPath(); ctx.moveTo(0, -8 * k); ctx.lineTo(6 * k, 6 * k); ctx.lineTo(0, 2.5 * k); ctx.lineTo(-6 * k, 6 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (big) text(me.name, X(me.pos.x), Y(me.pos.z) - 18, 13, '#ffd21f');
}
function drawMinimap() {
  if (!M.ready) return;
  const z = G.me.vehicle && Math.abs(G.me.vehicle.speed || 0) > 30 ? 0.05 : 0.14;
  drawMap(mapCtx, 190, 190, G.me.pos.x, G.me.pos.z, z, false);
  if (bigOpen) drawBig();
}
// Grosse Karte (Taste M): ziehen = verschieben, Mausrad = zoomen, Klick = Wegpunkt
let bigOpen = false, bigCv = null, bigCtx = null, bcx = 0, bcz = 0, bs = 0.04, drag = null;
function initBigMap() {
  bigCv = $('bigmap'); bigCtx = bigCv.getContext('2d');
  bigCv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: bcx, cz: bcz, moved: false, btn: e.button }; });
  window.addEventListener('mousemove', (e) => {
    if (!drag || !bigOpen) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) { bcx = drag.cx - dx / bs; bcz = drag.cz - dy / bs; drawBig(); }
  });
  window.addEventListener('mouseup', (e) => {
    if (!drag || !bigOpen) { drag = null; return; }
    if (!drag.moved) {
      if (drag.btn === 2) { G.waypoint = null; clearRoute(); }
      else {
        let wx = bcx + (e.clientX - bigCv.width / 2) / bs, wz = bcz + (e.clientY - bigCv.height / 2) / bs, label = null;
        let bd = 14 / bs; // auf Symbole in der Naehe einrasten
        for (const q of M.pois) { if (q.k === 'peak' || (q.k === 'place' && q.r > 3)) continue; const d = Math.hypot(q.x - wx, q.z - wz); if (d < bd) { bd = d; label = q.n || null; wx = q.x; wz = q.z; } }
        for (const q of pois) { const d = Math.hypot(q.x - wx, q.z - wz); if (d < bd) { bd = d; label = q.label; wx = q.x; wz = q.z; } }
        G.waypoint = { x: wx, z: wz, label }; clearRoute(); requestRoute(); sfx.buy();
      }
      drawBig();
    }
    drag = null;
  });
  bigCv.addEventListener('wheel', (e) => {
    const f = e.deltaY < 0 ? 1.25 : 0.8, ns = Math.max(0.012, Math.min(1.6, bs * f));
    const wx = bcx + (e.clientX - bigCv.width / 2) / bs, wz = bcz + (e.clientY - bigCv.height / 2) / bs;
    bs = ns; bcx = wx - (e.clientX - bigCv.width / 2) / bs; bcz = wz - (e.clientY - bigCv.height / 2) / bs;
    drawBig(); e.preventDefault();
  }, { passive: false });
}
function drawBig() {
  const W = bigCv.width, H = bigCv.height, ctx = bigCtx;
  drawMap(ctx, W, H, bcx, bcz, bs, true);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(18,21,27,0.85)'; ctx.fillRect(14, H - 118, 700, 104);
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 15px "Trebuchet MS", Arial'; ctx.fillText('KARTE – Vöcklabruck · Attersee · Höllengebirge', 26, H - 94);
  ctx.fillStyle = '#fff'; ctx.font = '13px "Trebuchet MS", Arial';
  ctx.fillText('Ziehen = verschieben · Mausrad = zoomen · Klick = Ziel setzen (schnellste Route) · Rechtsklick = löschen · M = zu', 26, H - 72);
  ctx.fillText('🍺 Wirtshaus  🔧 Werkstatt  💰 Laden  ⛽ Tankstelle  🌿 Der Franz  ⛪ Kirche  ★ Sehenswert  ▲ Gipfel', 26, H - 50);
  const rl = routeLeft();
  const wtxt = G.waypoint ? `   ·   ${G.waypoint.label ? G.waypoint.label + ': ' : 'Ziel: '}` + (rl ? `${(rl.dist / 1000).toFixed(1)} km, ca. ${Math.max(1, Math.round(rl.time / 60))} min` : (nav.pending ? 'Route wird berechnet…' : `${(Math.hypot(G.waypoint.x - G.me.pos.x, G.waypoint.z - G.me.pos.z) / 1000).toFixed(1)} km Luftlinie`)) : '';
  ctx.fillText('🚜 Bagger  🛻 Auto  🛩️ Flieger  ✈️ Jet / Flugplatz  ● Mitspieler  ▲ du' + wtxt, 26, H - 28);
  // Massstab
  const km = bs > 0.3 ? 0.1 : (bs > 0.06 ? 1 : 5), len = km * 1000 * bs;
  ctx.fillStyle = 'rgba(18,21,27,0.85)'; ctx.fillRect(W - len - 44, H - 52, len + 30, 38);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W - len - 30, H - 26); ctx.lineTo(W - 30, H - 26); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText(km < 1 ? '100 m' : km + ' km', W - len - 30, H - 34);
  ctx.font = '11px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; ctx.fillText(M.meta.attribution || '', W - 12, 16);
}
export function toggleMap() {
  bigOpen = !bigOpen;
  bigCv.classList.toggle('hidden', !bigOpen);
  if (bigOpen) {
    G.menu = 'map';
    if (document.pointerLockElement) document.exitPointerLock();
    bigCv.width = window.innerWidth; bigCv.height = window.innerHeight;
    bcx = G.me.pos.x; bcz = G.me.pos.z; bs = 0.09;
    drawBig();
  } else G.menu = null;
}

// ---------- Rangliste ----------
export function showScore(on) {
  $('score').classList.toggle('hidden', !on);
  if (on) renderScore();
}
function renderScore() {
  const rows = [{ id: G.me.id, name: G.me.name, k: G.me.kills, d: G.me.deaths, w: G.me.wiba, me: true }];
  for (const p of G.players.values()) rows.push({ id: p.id, name: p.name, k: p.k, d: p.d, w: p.wiba });
  rows.sort((a, b) => b.w - a.w || b.k - a.k);
  let h = '<h2>🍌 WIBA-Rangliste 🚜</h2><table><tr><th>#</th><th>Name</th><th>WIBA-Punkte</th><th>Kills</th><th>Tode</th></tr>';
  rows.forEach((r, i) => { h += `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.w}</td><td>${r.k}</td><td>${r.d}</td></tr>`; });
  h += '</table>';
  $('score').innerHTML = h;
}

// ---------- Menues ----------
function costText(cost) {
  return Object.keys(cost).map((k) => `${cost[k]}× ${ITEMS[k].name}`).join(', ');
}
function canAfford(cost) { return Object.keys(cost).every((k) => invCount(k) >= cost[k]); }

export function openMenu(kind) {
  G.menu = kind;
  if (document.pointerLockElement) document.exitPointerLock();
  renderMenu();
  $('menu').classList.remove('hidden');
}
export function closeMenu() {
  G.menu = null;
  $('menu').classList.add('hidden');
}
function renderMenu() {
  const kind = G.menu;
  const el = $('menu');
  let h = '';
  if (kind === 'inv') {
    h += '<h2>🎒 Inventar</h2><div class="hint">Alles, was du dir zusammengeschnorrt hast.</div><div class="inv">';
    const ids = Object.keys(G.me.inv);
    if (!ids.length) h += '<div>Gähnende Leere.</div>';
    for (const id of ids) h += `<div>${ITEMS[id].icon} ${esc(ITEMS[id].name)} <b>×${invCount(id)}</b></div>`;
    h += '</div>';
  } else {
    const shop = SHOPS[kind];
    h += `<h2>${esc(shop.title)}</h2><div class="hint">${esc(shop.hint)}</div>`;
    if (shop.buy) {
      h += '<h4>Kaufen</h4>';
      shop.buy.forEach((b, i) => {
        const it = ITEMS[b[0]];
        h += `<div class="item"><div class="ic">${it.icon}</div><div class="nm">${esc(it.name)}${b[1] > 1 ? ' ×' + b[1] : ''}<small>Du hast: ${invCount(b[0])}</small></div>
          <button data-act="buy" data-i="${i}" ${G.me.money < b[2] ? 'disabled' : ''}>${b[2]} €</button></div>`;
      });
    }
    if (shop.sell) {
      h += '<h4>Verkaufen</h4>';
      shop.sell.forEach((s, i) => {
        const it = ITEMS[s[0]], n = invCount(s[0]);
        h += `<div class="item"><div class="ic">${it.icon}</div><div class="nm">${esc(it.name)}<small>Du hast: ${n} · ${s[1]} € pro Stück</small></div>
          <button data-act="sell" data-i="${i}" ${n < 1 ? 'disabled' : ''}>Alle: +${n * s[1]} €</button></div>`;
      });
    }
    if (shop.craft) {
      h += '<h4>Herstellen</h4>';
      RECIPES.forEach((r, i) => {
        const it = ITEMS[r.out];
        h += `<div class="item"><div class="ic">${it.icon}</div><div class="nm">${esc(it.name)}${r.n > 1 ? ' ×' + r.n : ''}<small>${esc(costText(r.cost))} · Du hast: ${invCount(r.out)}</small></div>
          <button data-act="craft" data-i="${i}" ${canAfford(r.cost) ? '' : 'disabled'}>Bauen</button></div>`;
      });
      h += '<div class="hint" style="margin-top:8px">Erz bekommst du beim Graben (Bagger oder Schaufel) – je tiefer, desto mehr.</div>';
    }
  }
  h += `<div class="foot"><span>💶 ${G.me.money} €</span><button class="btn alt" data-act="close" style="flex:none;padding:8px 18px;font-size:14px">Schließen (E / ESC)</button></div>`;
  el.innerHTML = h;
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('#menu button');
  if (!b || !G.menu) return;
  const act = b.dataset.act, i = parseInt(b.dataset.i, 10);
  const shop = SHOPS[G.menu];
  if (act === 'close') { closeMenu(); return; }
  if (act === 'buy' && shop) {
    const [id, n, price] = shop.buy[i];
    if (G.me.money >= price) { G.me.money -= price; invAdd(id, n); sfx.buy(); } else sfx.deny();
  } else if (act === 'sell' && shop) {
    const [id, price] = shop.sell[i];
    const n = invCount(id);
    if (n > 0) { G.me.money += n * price; invAdd(id, -n); sfx.buy(); }
  } else if (act === 'craft') {
    const r = RECIPES[i];
    if (canAfford(r.cost)) {
      for (const k of Object.keys(r.cost)) invAdd(k, -r.cost[k]);
      invAdd(r.out, r.n); sfx.buy();
      toast(`${ITEMS[r.out].name} hergestellt!`, 'good');
    } else sfx.deny();
  }
  if (G.menu) renderMenu();
});

export function showDeath(text) {
  $('death').classList.remove('hidden');
  $('deathtext').textContent = text;
}
export function setDeathTimer(t) { $('deathtimer').textContent = t > 0 ? `Wiedergeburt in ${Math.ceil(t)}…` : ''; }
export function hideDeath() { $('death').classList.add('hidden'); }
export function setBlack(on, text = '') {
  const b = $('black');
  b.style.opacity = on ? '1' : '0';
  b.textContent = text;
}
export function setTint(color, opacity) {
  const t = $('tint');
  t.style.background = color; t.style.opacity = opacity;
}
export function vehInfo(v) {
  return VEH[v.type];
}
export { net };
