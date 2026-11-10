// WIBA - Spielcode-Multiplayer: Verbindung ueber WebRTC (PeerJS), kein Router-Einstellen noetig.
// Der Host leitet jede Peer-Verbindung an seinen lokalen Spielserver weiter.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'wiba-game-';
export function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function newCode() { let c = ''; for (let i = 0; i < 6; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; }

export const host = { code: '', status: 'aus', peer: null, players: 0, onChange: null };
function set(st) { host.status = st; if (host.onChange) host.onChange(); }

// Host: Code anmelden und eingehende Verbindungen an den lokalen Server durchreichen
export function startHost(localWsUrl) {
  if (!window.Peer) { set('nicht verfügbar'); return; }
  if (host.peer) return;
  let code = '';
  try { code = cleanCode(localStorage.getItem('wiba-code')); } catch (e) { /* */ }
  if (code.length !== 6) code = newCode();
  const open = (tries) => {
    set('verbindet');
    const peer = new window.Peer(PREFIX + code, { debug: 0 });
    host.peer = peer;
    peer.on('open', () => { host.code = code; try { localStorage.setItem('wiba-code', code); } catch (e) { /* */ } set('bereit'); });
    peer.on('connection', (conn) => {
      const ws = new WebSocket(localWsUrl);
      const queue = [];
      let closed = false;
      const close = () => { if (closed) return; closed = true; host.players = Math.max(0, host.players - 1); try { ws.close(); } catch (e) { /* */ } try { conn.close(); } catch (e) { /* */ } if (host.onChange) host.onChange(); };
      host.players++; if (host.onChange) host.onChange();
      conn.on('data', (d) => { if (typeof d !== 'string') return; if (ws.readyState === 1) ws.send(d); else if (queue.length < 200) queue.push(d); });
      ws.onopen = () => { for (const d of queue) ws.send(d); queue.length = 0; };
      ws.onmessage = (ev) => { if (conn.open) { try { conn.send(ev.data); } catch (e) { close(); } } };
      ws.onclose = close; ws.onerror = close;
      conn.on('close', close); conn.on('error', close);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) { set('verbindet'); try { peer.reconnect(); } catch (e) { /* */ } } });
    peer.on('error', (e) => {
      if (e && e.type === 'unavailable-id' && tries < 4) { try { peer.destroy(); } catch (x) { /* */ } host.peer = null; code = newCode(); open(tries + 1); }
      else if (e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed')) set('kein Internet');
    });
  };
  open(0);
}

// Mitspieler: Verbindung zum Host-Code; liefert ein WebSocket-aehnliches Objekt
export function joinByCode(codeRaw) {
  return new Promise((resolve, reject) => {
    if (!window.Peer) { reject(new Error('Spielcode-Verbindung nicht verfügbar')); return; }
    const code = cleanCode(codeRaw);
    const peer = new window.Peer({ debug: 0 });
    let done = false;
    const fail = (msg) => { if (done) return; done = true; clearTimeout(timer); try { peer.destroy(); } catch (e) { /* */ } reject(new Error(msg)); };
    const timer = setTimeout(() => fail('Zeitüberschreitung – stimmt der Code und läuft das Spiel beim Host?'), 20000);
    peer.on('error', (e) => fail(e && e.type === 'peer-unavailable' ? 'Kein Spiel mit diesem Code gefunden' : 'Verbindung fehlgeschlagen (' + ((e && e.type) || '?') + ')'));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
      const sock = {
        readyState: 0, onmessage: null, onclose: null,
        send(s) { if (conn.open) conn.send(s); },
        close() { this.readyState = 3; try { conn.close(); } catch (e) { /* */ } try { peer.destroy(); } catch (e) { /* */ } },
      };
      conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); sock.readyState = 1; resolve(sock); });
      conn.on('data', (d) => { if (sock.onmessage) sock.onmessage({ data: d }); });
      const gone = () => { if (sock.readyState === 3) return; sock.readyState = 3; if (sock.onclose) sock.onclose(); };
      conn.on('close', gone); conn.on('error', () => { if (!done) fail('Verbindung fehlgeschlagen'); else gone(); });
    });
  });
}
