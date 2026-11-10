// WIBA - HUD, Menues, Chat, Rangliste, Minimap
import { G, net, invCount, invAdd } from './state.js';
import { ITEMS, HOTBAR_ORDER, SHOPS, RECIPES, HALF, VEH, WEAPONS } from './config.js';
import { minimapImage, zoneName } from './terrain.js';
import { pois } from './world.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
let mapImg = null, mapCtx = null;
let hotbarKey = '';

export function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function initUI() {
  mapImg = minimapImage(190);
  mapCtx = $('minimap').getContext('2d');
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
  $('loc').textContent = `📍 ${zoneName(me.pos.x, me.pos.z)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} Uhr`;
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

function drawMinimap() {
  const ctx = mapCtx, S = 190;
  ctx.drawImage(mapImg, 0, 0);
  const tx = (x) => ((x + HALF) / (2 * HALF)) * S;
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pois) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(tx(p.x) - 1.5, tx(p.z) - 1.5, 3, 3); }
  for (const v of G.vehicles.values()) {
    if (v.dead) continue;
    ctx.fillStyle = v.type === 'bagger' ? '#f2b90f' : (v.type === 'auto' ? '#e0553f' : '#ffffff');
    const x = tx(v.pos.x), y = tx(v.pos.z);
    if (v.type === 'jet' || v.type === 'flieger') { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3.5, y + 3); ctx.lineTo(x - 3.5, y + 3); ctx.fill(); }
    else ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  for (const p of G.players.values()) {
    if (p.dead) continue;
    ctx.fillStyle = '#ff4433'; ctx.beginPath(); ctx.arc(tx(p.pos.x), tx(p.pos.z), 3.2, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
  const me = G.me;
  let yaw = me.yaw;
  if (me.vehicle) yaw = me.vehicle.heading + Math.PI;
  ctx.save();
  ctx.translate(Math.max(4, Math.min(S - 4, tx(me.pos.x))), Math.max(4, Math.min(S - 4, tx(me.pos.z))));
  ctx.rotate(-yaw);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
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
