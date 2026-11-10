// WIBA - Hintergrundradio: ORF Radio Salzburg (offizieller Livestream, wird nur abgespielt, nie gespeichert)
export const RADIO_STREAM = 'https://orf-live-sbg.mdn.ors.at/out/u/sbg/qxa/manifest.m3u8';
export const RADIO_FALLBACK_PAGE = 'https://sound.orf.at/radio/sbg';

export const radio = {
  status: 'aus', vol: 0.3, audio: null, hls: null, wanted: false, onChange: null,
  set(st) { this.status = st; if (this.onChange) this.onChange(); },
  start() {
    this.wanted = true;
    this.stop(true);
    const a = new Audio();
    a.volume = this.vol; a.preload = 'none';
    this.audio = a;
    a.addEventListener('playing', () => this.set('spielt'));
    a.addEventListener('waiting', () => { if (this.wanted) this.set('lädt'); });
    a.addEventListener('pause', () => { if (!this.wanted) this.set('pausiert'); });
    a.addEventListener('error', () => this.fail());
    this.set('lädt');
    const play = () => { const p = a.play(); if (p && p.catch) p.catch(() => this.set('pausiert')); };
    try {
      if (window.Hls && window.Hls.isSupported()) {
        const h = new window.Hls({ enableWorker: true, lowLatencyMode: false });
        this.hls = h;
        h.on(window.Hls.Events.MANIFEST_PARSED, play);
        h.on(window.Hls.Events.ERROR, (ev, d) => { if (d && d.fatal) this.fail(); });
        h.loadSource(RADIO_STREAM); h.attachMedia(a);
      } else if (a.canPlayType('application/vnd.apple.mpegurl')) { a.src = RADIO_STREAM; play(); }
      else this.fail();
    } catch (e) { this.fail(); }
  },
  fail() { this.stop(true); this.wanted = false; this.set('Verbindung fehlgeschlagen'); },
  stop(silent) {
    if (this.hls) { try { this.hls.destroy(); } catch (e) { /* */ } this.hls = null; }
    if (this.audio) { try { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } catch (e) { /* */ } this.audio = null; }
    if (!silent) this.set('pausiert');
  },
  toggle() {
    if (this.wanted && this.audio) { this.wanted = false; this.stop(); } else this.start();
  },
  setVol(v) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.audio) this.audio.volume = this.vol;
    if (this.onChange) this.onChange();
  },
};
