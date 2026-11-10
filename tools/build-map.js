'use strict';
// WIBA - Kartenbau: laedt echte Daten (OpenStreetMap + Hoehenmodell) fuer Voecklabruck - Attersee - Weissenbachtal
// und schreibt sie im Spielformat nach public/world/.
//
//   node tools/build-map.js [--out public/world] [--cache .cache/map]
//
// Daten: (c) OpenStreetMap-Mitwirkende (ODbL), Hoehen: Terrarium-Tiles (Mapzen: SRTM, EU-DEM u. a.)
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const CFG = {
  lat0: 48.0069, lon0: 13.6558, // Ursprung (0,0) = Stadtplatz Voecklabruck
  south: 47.78, north: 48.05, west: 13.44, east: 13.76,
  cell: 10, tile: 500, yoff: 400, hscale: 10, demZoom: 14, ovCell: 20,
};
const MX = 111320 * Math.cos((CFG.lat0 * Math.PI) / 180), MZ = 110574;
const proj = (lat, lon) => [(lon - CFG.lon0) * MX, -(lat - CFG.lat0) * MZ];
const unproj = (x, z) => [CFG.lat0 - z / MZ, CFG.lon0 + x / MX];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- HTTP ----------------
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: opts.method || 'GET', hostname: u.hostname, path: u.pathname + u.search, port: u.port || 443,
      headers: Object.assign({ 'User-Agent': 'WIBA-map-builder/1.0 (game map import)', 'Accept-Encoding': 'gzip' }, opts.headers || {}),
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve(request(new URL(res.headers.location, url).toString(), opts)); return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        try { if (res.headers['content-encoding'] === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) { reject(e); return; }
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode + ' ' + url + ' ' + buf.toString('utf8', 0, 160))); return; }
        resolve(buf);
      });
    });
    req.setTimeout(opts.timeout || 60000, () => req.destroy(new Error('Timeout ' + url)));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
async function retry(fn, tries, label) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(i); } catch (e) { last = e; log('  Fehler (' + label + ', Versuch ' + (i + 1) + '/' + tries + '): ' + String(e.message).slice(0, 200)); await sleep(2000 * (i + 1) * (i + 1)); }
  }
  throw last;
}

// ---------------- Overpass ----------------
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
function mainQuery(b) {
  const bb = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  return `[out:json][timeout:180];(
  way["building"](${bb});
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service|track|pedestrian)$"](${bb});
  way["railway"="rail"](${bb});
  way["waterway"~"^(river|stream|canal)$"](${bb});
  way["natural"~"^(water|wood|scrub|bare_rock|scree|wetland|grassland|heath)$"](${bb});
  way["landuse"~"^(forest|residential|commercial|industrial|retail|farmland|meadow|orchard|vineyard|quarry|cemetery|grass|allotments|construction|reservoir)$"](${bb});
  way["leisure"~"^(park|garden|pitch|golf_course)$"](${bb});
  way["aeroway"~"^(runway|taxiway|apron)$"](${bb});
  relation["natural"~"^(water|wood)$"](${bb});
  relation["landuse"~"^(forest|residential|commercial|industrial|retail|farmland|meadow|reservoir)$"](${bb});
  relation["building"](${bb});
  node["natural"="tree"](${bb});
);out geom;`;
}
function poiQuery(b) {
  const bb = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  return `[out:json][timeout:180];(
  nwr["place"~"^(city|town|village|hamlet|suburb|locality)$"]["name"](${bb});
  nwr["natural"~"^(peak|waterfall|spring|cave_entrance)$"]["name"](${bb});
  nwr["tourism"~"^(attraction|viewpoint|museum|gallery|hotel|camp_site)$"]["name"](${bb});
  nwr["historic"~"^(castle|tower|monument|archaeological_site|ruins|memorial|city_gate)$"]["name"](${bb});
  nwr["man_made"~"^(tower|observatory|works|water_tower)$"]["name"](${bb});
  nwr["amenity"~"^(pub|restaurant|cafe|biergarten|fuel|place_of_worship|townhall|school|hospital|fire_station|police)$"]["name"](${bb});
  nwr["amenity"="fuel"](${bb});
  nwr["shop"~"^(supermarket|doityourself|hardware|convenience|car_repair|car|bakery|butcher)$"](${bb});
  nwr["craft"~"^(carpenter|metal_construction|stonemason|joiner)$"](${bb});
  nwr["railway"="station"]["name"](${bb});
  nwr["aeroway"="aerodrome"](${bb});
);out center tags;`;
}
async function overpass(query, cacheFile) {
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(cacheFile)).toString());
  const body = 'data=' + encodeURIComponent(query);
  const buf = await retry((i) => request(OVERPASS[i % OVERPASS.length], { method: 'POST', body, timeout: 200000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), 6, 'Overpass');
  const json = JSON.parse(buf.toString('utf8'));
  if (json.remark && /error|timed out|runtime/i.test(json.remark) && !(json.elements || []).length) throw new Error('Overpass: ' + json.remark);
  if (cacheFile) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, zlib.gzipSync(JSON.stringify(json))); }
  return json;
}

// ---------------- Geometrie ----------------
const ptsOf = (geom) => geom.map((g) => proj(g.lat, g.lon));
const keyOf = (g) => g.lat.toFixed(7) + ',' + g.lon.toFixed(7);
// Linienstuecke (Arrays von {lat,lon}) zu geschlossenen Ringen verbinden
function assembleRings(lines) {
  const segs = lines.filter((l) => l && l.length > 1).map((l) => l.slice());
  const rings = [];
  const used = new Array(segs.length).fill(false);
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let cur = segs[i].slice();
    let guard = 0;
    while (keyOf(cur[0]) !== keyOf(cur[cur.length - 1]) && guard++ < 5000) {
      const end = keyOf(cur[cur.length - 1]);
      let found = -1, rev = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (keyOf(segs[j][0]) === end) { found = j; break; }
        if (keyOf(segs[j][segs[j].length - 1]) === end) { found = j; rev = true; break; }
      }
      if (found < 0) break;
      used[found] = true;
      const s = rev ? segs[found].slice().reverse() : segs[found];
      cur = cur.concat(s.slice(1));
    }
    if (cur.length >= 4 && keyOf(cur[0]) === keyOf(cur[cur.length - 1])) rings.push(cur);
  }
  return rings;
}
function ringsOfElement(el) {
  if (el.rings) return el.rings;
  if (el.type === 'way' && el.geometry) {
    const g = el.geometry;
    if (g.length >= 4 && keyOf(g[0]) === keyOf(g[g.length - 1])) return [g];
    return [];
  }
  if (el.type === 'relation' && el.members) {
    const outer = [], inner = [];
    for (const m of el.members) {
      if (m.type !== 'way' || !m.geometry) continue;
      (m.role === 'inner' ? inner : outer).push(m.geometry);
    }
    return assembleRings(outer).concat(assembleRings(inner));
  }
  return [];
}
function ringArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }

// ---------------- OSM auswerten ----------------
const HWY = { motorway: 0, motorway_link: 0, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2, secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4, residential: 5, unclassified: 5, living_street: 5, service: 6, track: 7, pedestrian: 8 };
const HWY_W = [14, 11, 9, 8, 7, 5.5, 4, 3, 6, 3.2, 30, 10];
const BKIND = {
  house: 0, detached: 0, residential: 0, semidetached_house: 0, terrace: 0, bungalow: 0, villa: 0,
  apartments: 1, dormitory: 1, commercial: 2, retail: 2, office: 2, supermarket: 2, hotel: 2, industrial: 3, warehouse: 3, factory: 3, manufacture: 3,
  church: 4, chapel: 4, cathedral: 4, monastery: 4, temple: 4, farm: 5, barn: 5, stable: 5, cowshed: 5, farm_auxiliary: 5, greenhouse: 5, shed: 5, hut: 5, garage: 5, garages: 5, carport: 5, roof: 5,
  school: 6, civic: 6, hospital: 6, kindergarten: 6, university: 6, government: 6, public: 6, train_station: 6, yes: 7,
};
const ROOF = { gabled: 1, skillion: 1, gambrel: 1, hipped: 2, half_hipped: 2, flat: 3, pyramidal: 4, dome: 4, cone: 4, round: 4 };
const num = (v) => { if (v === undefined) return 0; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

const AREA_ORDER = [2, 0, 10, 9, 8, 1, 3, 7, 6, 'water'];
function areaClass(t) {
  if (t.natural === 'water' || t.landuse === 'reservoir' || t.waterway === 'riverbank') return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 1;
  if (t.natural === 'scrub' || t.natural === 'heath') return 8;
  if (t.natural === 'wetland') return 9;
  if (t.natural === 'bare_rock' || t.natural === 'scree') return 6;
  if (t.natural === 'grassland') return 0;
  if (['residential', 'commercial', 'industrial', 'retail'].includes(t.landuse)) return 3;
  if (['farmland', 'orchard', 'vineyard', 'allotments'].includes(t.landuse)) return 2;
  if (t.landuse === 'meadow' || t.landuse === 'grass') return 0;
  if (t.landuse === 'quarry' || t.landuse === 'construction') return 7;
  if (t.landuse === 'cemetery' || ['park', 'garden', 'pitch', 'golf_course'].includes(t.leisure)) return 10;
  return null;
}

function newCtx() {
  return { buildings: new Map(), lines: new Map(), areas: new Map(), trees: new Map(), airways: new Map(), stats: { elements: 0 } };
}
function processElements(elements, ctx) {
  for (const el of elements) {
    ctx.stats.elements++;
    const t = el.tags || {};
    const id = el.type[0] + el.id;
    if (el.type === 'node') {
      if (t.natural === 'tree' && !ctx.trees.has(id)) ctx.trees.set(id, proj(el.lat, el.lon));
      continue;
    }
    if (t.building && t.building !== 'no') {
      if (ctx.buildings.has(id)) continue;
      const rings = ringsOfElement(el).filter((r) => ringArea(ptsOf(r)) !== 0);
      if (!rings.length) continue;
      // groesster Ring = Aussenkontur
      let best = null, ba = 0;
      for (const r of rings) { const a = Math.abs(ringArea(ptsOf(r))); if (a > ba) { ba = a; best = r; } }
      if (ba < 4) continue;
      ctx.buildings.set(id, { t, pts: ptsOf(best).slice(0, -1) });
      continue;
    }
    if (el.type === 'way' && el.geometry && !el.rings) {
      if (t.highway && HWY[t.highway] !== undefined) {
        if (ctx.lines.has(id) || t.tunnel === 'yes' || t.covered === 'yes' || t.tunnel === 'building_passage') continue;
        const cls = HWY[t.highway];
        let w = num(t.width);
        if (w < 2 || w > 40) w = HWY_W[cls];
        if (t.oneway === 'yes' && !num(t.width) && cls <= 4) w = Math.max(3.2, w * 0.7);
        ctx.lines.set(id, { kind: 'r', cls, w, bridge: t.bridge && t.bridge !== 'no' ? 1 : 0, pts: ptsOf(el.geometry) });
        continue;
      }
      if (t.railway === 'rail') { if (!ctx.lines.has(id) && t.tunnel !== 'yes') ctx.lines.set(id, { kind: 'r', cls: 9, w: 3.2, bridge: t.bridge && t.bridge !== 'no' ? 1 : 0, pts: ptsOf(el.geometry) }); continue; }
      if (t.waterway && /^(river|stream|canal)$/.test(t.waterway)) {
        if (!ctx.lines.has(id) && t.tunnel !== 'yes' && t.covered !== 'yes') ctx.lines.set(id, { kind: 'w', cls: 0, w: t.waterway === 'river' ? 14 : (t.waterway === 'canal' ? 8 : 3), bridge: 0, pts: ptsOf(el.geometry) });
        if (t.waterway !== 'riverbank') continue;
      }
      if (t.aeroway === 'runway' || t.aeroway === 'taxiway') {
        if (!ctx.lines.has(id)) { const w = num(t.width) || (t.aeroway === 'runway' ? 30 : 10); ctx.lines.set(id, { kind: 'r', cls: t.aeroway === 'runway' ? 10 : 11, w, bridge: 0, pts: ptsOf(el.geometry), name: t.ref || '' }); }
        continue;
      }
    }
    const ac = areaClass(t);
    if (ac !== null && (el.type === 'way' || el.type === 'relation') && !ctx.areas.has(id)) {
      const rings = ringsOfElement(el).map(ptsOf).filter((r) => r.length >= 4);
      if (rings.length) ctx.areas.set(id, { cls: ac, rings, t });
    }
  }
}

function classifyPois(els, pois, minX, maxX, minZ, maxZ) {
  const poiSeen = new Set();
  for (const el of els) {
    const id = el.type[0] + el.id;
    if (poiSeen.has(id)) continue;
    poiSeen.add(id);
    const t = el.tags || {};
    const lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat), lon = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
    if (lat === undefined) continue;
    const [x, z] = proj(lat, lon);
    let k = null;
    if (t.place) k = 'place';
    else if (t.natural === 'peak') k = 'peak';
    else if (t.natural === 'waterfall') k = 'fall';
    else if (t.amenity === 'fuel') k = 'tank';
    else if (['pub', 'restaurant', 'cafe', 'biergarten'].includes(t.amenity)) k = 'wirt';
    else if (['carpenter', 'metal_construction', 'stonemason', 'joiner'].includes(t.craft) || t.shop === 'car_repair' || t.man_made === 'works') k = 'werk';
    else if (['supermarket', 'doityourself', 'hardware', 'convenience', 'bakery', 'butcher', 'car'].includes(t.shop)) k = 'handel';
    else if (t.amenity === 'place_of_worship') k = 'kirche';
    else if (t.railway === 'station') k = 'bahnhof';
    else if (t.aeroway === 'aerodrome') k = 'flug';
    else if (t.man_made === 'observatory') k = 'sternwarte';
    else if (t.historic === 'castle' || t.historic === 'city_gate' || t.historic === 'tower') k = 'burg';
    else k = 'attr';
    const p = { k, n: t.name || '', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
    if (t.place) p.r = { city: 0, town: 1, village: 2, suburb: 3, hamlet: 4, locality: 5 }[t.place];
    if (t.ele) p.e = num(t.ele);
    if (t.amenity && t.amenity !== 'fuel' && k !== 'wirt' && k !== 'kirche') p.a = t.amenity;
    if (t.tourism) p.tr = t.tourism;
    if (t.shop) p.s = t.shop;
    if (t.craft) p.c = t.craft;
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    pois.push(p);
  }
}

// GeoJSON-Zeilen (osmium export -f geojsonseq) einlesen -> Elemente + POI-Kandidaten
const POI_SETS = {
  place: ['city', 'town', 'village', 'hamlet', 'suburb', 'locality'], natural: ['peak', 'waterfall', 'spring', 'cave_entrance'],
  tourism: ['attraction', 'viewpoint', 'museum', 'gallery', 'hotel', 'camp_site'], historic: ['castle', 'tower', 'monument', 'archaeological_site', 'ruins', 'memorial', 'city_gate'],
  man_made: ['tower', 'observatory', 'works', 'water_tower'], amenity: ['pub', 'restaurant', 'cafe', 'biergarten', 'fuel', 'place_of_worship', 'townhall', 'school', 'hospital', 'fire_station', 'police'],
  shop: ['supermarket', 'doityourself', 'hardware', 'convenience', 'car_repair', 'car', 'bakery', 'butcher'], craft: ['carpenter', 'metal_construction', 'stonemason', 'joiner'],
};
function isPoi(t) {
  if (t.amenity === 'fuel' || t.aeroway === 'aerodrome') return true;
  if (t.shop && POI_SETS.shop.includes(t.shop)) return true;
  if (t.craft && POI_SETS.craft.includes(t.craft)) return true;
  if (!t.name) return false;
  if (t.railway === 'station') return true;
  for (const k of ['place', 'natural', 'tourism', 'historic', 'man_made', 'amenity']) if (t[k] && POI_SETS[k].includes(t[k])) return true;
  return false;
}
async function loadGeojson(file) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const elements = [], pois = [], seenPoi = new Set();
  let id = 1, lines = 0;
  const G = (c) => ({ lat: c[1], lon: c[0] });
  for await (let line of rl) {
    line = line.replace(/^\x1e/, '').trim();
    if (!line || line[0] !== '{') continue;
    let f; try { f = JSON.parse(line); } catch (e) { continue; }
    if (!f || !f.geometry) continue;
    lines++;
    const t = f.properties || {}, g = f.geometry, n = id++;
    let center = null;
    if (g.type === 'Point') {
      center = G(g.coordinates);
      if (t.natural === 'tree') elements.push({ type: 'node', id: n, lat: center.lat, lon: center.lon, tags: t });
    } else if (g.type === 'LineString') {
      if (t.highway || t.railway || t.waterway || t.aeroway) elements.push({ type: 'way', id: n, tags: t, geometry: g.coordinates.map(G) });
    } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const o0 = polys[0] && polys[0][0];
      if (o0 && o0.length) { let a = 0, b = 0; for (const c of o0) { a += c[0]; b += c[1]; } center = { lat: b / o0.length, lon: a / o0.length }; }
      if (t.building && t.building !== 'no') {
        polys.forEach((p, i) => { if (p[0] && p[0].length >= 4) elements.push({ type: 'way', id: n + '_' + i, tags: t, rings: [p[0].map(G)] }); });
      } else if (t.natural || t.landuse || t.leisure || t.waterway === 'riverbank') {
        const rings = []; for (const p of polys) for (const r of p) if (r.length >= 4) rings.push(r.map(G));
        if (rings.length) elements.push({ type: 'relation', id: n, tags: t, rings });
      }
    }
    if (center && g.type !== 'LineString' && isPoi(t)) {
      const key = (t.name || '') + '|' + (t.place || t.amenity || t.shop || t.craft || t.natural || t.tourism || t.historic || '') + '|' + center.lat.toFixed(4) + ',' + center.lon.toFixed(4);
      if (!seenPoi.has(key)) { seenPoi.add(key); pois.push({ type: 'node', id: n, lat: center.lat, lon: center.lon, tags: t }); }
    }
  }
  log(`GeoJSON: ${lines} Objekte gelesen, ${elements.length} verwendet, ${pois.length} POI-Kandidaten`);
  return { elements, pois };
}

// ---------------- Raster ----------------
function fillRings(rings, grid, NX, NZ, minX, minZ, cell, value) {
  let zmin = Infinity, zmax = -Infinity;
  for (const r of rings) for (const p of r) { if (p[1] < zmin) zmin = p[1]; if (p[1] > zmax) zmax = p[1]; }
  const j0 = Math.max(0, Math.ceil((zmin - minZ) / cell)), j1 = Math.min(NZ - 1, Math.floor((zmax - minZ) / cell));
  const xs = [];
  for (let j = j0; j <= j1; j++) {
    const z = minZ + j * cell + 1e-6;
    xs.length = 0;
    for (const r of rings) {
      for (let k = 0, n = r.length; k < n; k++) {
        const a = r[k], b = r[(k + 1) % n];
        if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - minX) / cell)), i1 = Math.min(NX - 1, Math.floor((xs[k + 1] - minX) / cell));
      for (let i = i0; i <= i1; i++) grid[i + j * NX] = value;
    }
  }
}

// ---------------- Hoehenmodell ----------------
function demProviderTerrarium(cacheDir) {
  const Z = CFG.demZoom, N = 2 ** Z;
  const merc = (lat, lon) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return [((lon + 180) / 360) * N, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N];
  };
  return async function load() {
    const [tx0, ty0] = merc(CFG.north, CFG.west).map(Math.floor);
    const [tx1, ty1] = merc(CFG.south, CFG.east).map(Math.floor);
    const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256;
    log(`Hoehenmodell: ${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} Kacheln (z${Z}), ${W}x${H} px`);
    const mosaic = new Float32Array(W * H);
    const { PNG } = require('pngjs');
    const jobs = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
    let done = 0;
    async function worker() {
      while (jobs.length) {
        const [tx, ty] = jobs.pop();
        const cf = cacheDir ? path.join(cacheDir, `dem_${Z}_${tx}_${ty}.png`) : null;
        let buf;
        if (cf && fs.existsSync(cf)) buf = fs.readFileSync(cf);
        else {
          buf = await retry(() => request(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`, { timeout: 60000 }), 5, `DEM ${tx}/${ty}`);
          if (cf) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cf, buf); }
        }
        const png = PNG.sync.read(buf);
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const o = (y * 256 + x) * 4;
          mosaic[((ty - ty0) * 256 + y) * W + (tx - tx0) * 256 + x] = png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
        }
        if (++done % 40 === 0) log(`  DEM ${done} Kacheln`);
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    return (lat, lon) => {
      const [fx, fy] = merc(lat, lon);
      const px = (fx - tx0) * 256 - 0.5, py = (fy - ty0) * 256 - 0.5;
      const x0 = Math.max(0, Math.min(W - 2, Math.floor(px))), y0 = Math.max(0, Math.min(H - 2, Math.floor(py)));
      const ax = Math.max(0, Math.min(1, px - x0)), ay = Math.max(0, Math.min(1, py - y0));
      const a = mosaic[y0 * W + x0], b = mosaic[y0 * W + x0 + 1], c = mosaic[(y0 + 1) * W + x0], d = mosaic[(y0 + 1) * W + x0 + 1];
      return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + d * ax * ay;
    };
  };
}

// ---------------- Hauptablauf ----------------
async function buildMap(o) {
  const out = o.outDir;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'tiles'), { recursive: true });
  const cell = CFG.cell;
  const minX = proj(CFG.lat0, CFG.west)[0];
  const maxX = proj(CFG.lat0, CFG.east)[0];
  const minZ = proj(CFG.north, CFG.lon0)[1], maxZ = proj(CFG.south, CFG.lon0)[1];
  const NX = Math.ceil((maxX - minX) / cell) + 1, NZ = Math.ceil((maxZ - minZ) / cell) + 1;
  log(`Raster: ${NX} x ${NZ} Punkte (${((NX * cell) / 1000).toFixed(1)} x ${((NZ * cell) / 1000).toFixed(1)} km)`);

  // 1) OSM
  const ctx = newCtx();
  const pois = [];
  const step = o.step || 0.04;
  const cells = [];
  for (let la = CFG.south; la < CFG.north - 1e-9; la += step) for (let lo = CFG.west; lo < CFG.east - 1e-9; lo += step) cells.push([la, lo, Math.min(la + step, CFG.north), Math.min(lo + step, CFG.east)]);
  if (o.geo) { processElements(o.geo.elements, ctx); log(`OSM (Auszug): Gebaeude ${ctx.buildings.size}, Linien ${ctx.lines.size}, Flaechen ${ctx.areas.size}, Baeume ${ctx.trees.size}`); }
  else log(`OSM: ${cells.length} Abfragen`);
  let n = 0;
  for (const c of o.geo ? [] : cells) {
    const json = await o.osm(mainQuery(c), o.cache ? `${o.cache}/osm_${c[0].toFixed(3)}_${c[1].toFixed(3)}.json.gz` : null);
    processElements(json.elements || [], ctx);
    n++;
    log(`  OSM ${n}/${cells.length}: ${(json.elements || []).length} Elemente | Gebaeude ${ctx.buildings.size}, Linien ${ctx.lines.size}, Flaechen ${ctx.areas.size}, Baeume ${ctx.trees.size}`);
    if (!o.noSleep) await sleep(1200);
  }
  const pq = [];
  const hs = (CFG.north - CFG.south) / 2, ws = (CFG.east - CFG.west) / 2;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) pq.push([CFG.south + a * hs, CFG.west + b * ws, CFG.south + (a + 1) * hs, CFG.west + (b + 1) * ws]);
  if (!o.geo) {
    const poiEls = [];
    for (const c of pq) {
      const json = await o.osm(poiQuery(c), o.cache ? `${o.cache}/poi_${c[0].toFixed(3)}_${c[1].toFixed(3)}.json.gz` : null);
      poiEls.push(...(json.elements || []));
      if (!o.noSleep) await sleep(1200);
    }
    classifyPois(poiEls, pois, minX, maxX, minZ, maxZ);
  } else classifyPois(o.geo.pois, pois, minX, maxX, minZ, maxZ);
  log(`POIs: ${pois.length}`);

  // 2) Landnutzung
  const landuse = new Uint8Array(NX * NZ); // 0 = Wiese
  const buckets = new Map(AREA_ORDER.map((k) => [k, []]));
  for (const a of ctx.areas.values()) if (buckets.has(a.cls)) buckets.get(a.cls).push(a);
  for (const key of AREA_ORDER) {
    const list = buckets.get(key);
    for (const a of list) fillRings(a.rings, landuse, NX, NZ, minX, minZ, cell, key === 'water' ? 4 : key);
  }
  // 3) Hoehen
  const sample = await o.dem();
  const raw = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const [lat, lon] = unproj(minX + i * cell, minZ + j * cell);
    raw[i + j * NX] = sample(lat, lon);
  }
  // 4) Gewaesser: Seen (flache Oberflaeche) erkennen, Seeboden formen
  const lakeid = new Uint8Array(NX * NZ);
  const lakes = [];
  const seen = new Uint8Array(NX * NZ);
  const comps = [];
  for (let s = 0; s < NX * NZ; s++) {
    if (landuse[s] !== 4 || seen[s]) continue;
    const stack = [s], cells2 = [];
    seen[s] = 1;
    while (stack.length) {
      const c = stack.pop(); cells2.push(c);
      const i = c % NX, j = (c - i) / NX;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
        const q = ii + jj * NX;
        if (landuse[q] === 4 && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    comps.push(cells2);
  }
  comps.sort((a, b) => b.length - a.length);
  for (const cs of comps) {
    const els = cs.map((c) => raw[c]).sort((a, b) => a - b);
    const med = els[els.length >> 1], p5 = els[Math.floor(els.length * 0.05)], p95 = els[Math.floor(els.length * 0.95)];
    const isLake = cs.length >= 12 && p95 - p5 < 6 && lakes.length < 250;
    if (!isLake) { for (const c of cs) landuse[c] = 5; continue; }
    const id = lakes.length + 1;
    lakes.push({ id, level: Math.round((med - CFG.yoff) * 100) / 100, cells: cs.length });
    for (const c of cs) lakeid[c] = id;
  }
  // Tiefe: Abstand zum Ufer (Mehrquellen-BFS)
  const dist = new Int16Array(NX * NZ).fill(-1);
  let queue = [];
  for (let c = 0; c < NX * NZ; c++) {
    if (!lakeid[c]) continue;
    const i = c % NX, j = (c - i) / NX;
    let edge = i === 0 || j === 0 || i === NX - 1 || j === NZ - 1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < NX && jj < NZ && !lakeid[ii + jj * NX]) edge = true; }
    if (edge) { dist[c] = 1; queue.push(c); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi], i = c % NX, j = (c - i) / NX;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
      const q = ii + jj * NX;
      if (lakeid[q] && dist[q] < 0) { dist[q] = dist[c] + 1; queue.push(q); }
    }
  }
  queue = null;
  const heights = new Int16Array(NX * NZ);
  for (let c = 0; c < NX * NZ; c++) {
    let h = raw[c];
    if (lakeid[c]) {
      const lk = lakes[lakeid[c] - 1];
      const maxD = Math.max(3, Math.min(70, 4 + Math.sqrt(lk.cells * cell * cell) / 60));
      h = lk.level + CFG.yoff - Math.min(maxD, 1.2 + dist[c] * cell * 0.12);
    }
    heights[c] = Math.max(-32000, Math.min(32000, Math.round((h - CFG.yoff) * CFG.hscale)));
  }
  log(`Seen: ${lakes.length}, groesster: ${lakes[0] ? lakes[0].cells * cell * cell / 1e6 : 0} km2, Ebene ${lakes[0] ? lakes[0].level + CFG.yoff : '-'} m`);

  // 5) Kacheln
  const T = CFG.tile;
  const tiles = new Map();
  const tileOf = (x, z) => Math.floor(x / T) + '_' + Math.floor(z / T);
  const getTile = (key) => { let t = tiles.get(key); if (!t) { t = { b: [], r: [], w: [], t: [] }; tiles.set(key, t); } return t; };
  const rel = (key, x, z) => { const [tx, tz] = key.split('_').map(Number); return [Math.round((x - tx * T) * 10), Math.round((z - tz * T) * 10)]; };
  let nb = 0;
  for (const b of ctx.buildings.values()) {
    const p = b.pts;
    let cx = 0, cz = 0; for (const q of p) { cx += q[0]; cz += q[1]; }
    cx /= p.length; cz /= p.length;
    if (cx < minX || cx > maxX || cz < minZ || cz > maxZ) continue;
    const key = tileOf(cx, cz);
    const t = b.t;
    let h = num(t.height);
    let lv = parseInt(t['building:levels'], 10) || 0;
    const kind = BKIND[t.building] !== undefined ? BKIND[t.building] : 7;
    const rf = ROOF[t['roof:shape']] || 0;
    let pts = p;
    if (ringArea(pts) < 0) pts = pts.slice().reverse(); // einheitlich im Uhrzeigersinn
    const flat = [];
    for (const q of pts) { const r = rel(key, q[0], q[1]); flat.push(r[0], r[1]); }
    getTile(key).b.push([Math.round(h * 10), lv, rf, kind, Math.round(num(t.min_height) * 10), ...flat]);
    nb++;
  }
  let nr = 0, nw = 0;
  for (const l of ctx.lines.values()) {
    const p = l.pts;
    if (p.length < 2) continue;
    let run = [p[0]], rk = tileOf((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
    const flush = () => {
      if (run.length < 2) return;
      const flat = [];
      for (const q of run) { const r = rel(rk, q[0], q[1]); flat.push(r[0], r[1]); }
      if (l.kind === 'r') { getTile(rk).r.push([l.cls, Math.round(l.w * 10), l.bridge, ...flat]); nr++; } else { getTile(rk).w.push([Math.round(l.w * 10), ...flat]); nw++; }
    };
    for (let k = 1; k < p.length; k++) {
      const key = tileOf((p[k - 1][0] + p[k][0]) / 2, (p[k - 1][1] + p[k][1]) / 2);
      if (key !== rk) { flush(); run = [p[k - 1]]; rk = key; }
      run.push(p[k]);
    }
    flush();
  }
  let nt = 0;
  for (const q of ctx.trees.values()) {
    if (q[0] < minX || q[0] > maxX || q[1] < minZ || q[1] > maxZ) continue;
    const key = tileOf(q[0], q[1]); const r = rel(key, q[0], q[1]); getTile(key).t.push(r[0], r[1]); nt++;
  }
  for (const [key, t] of tiles) {
    const o2 = {};
    if (t.b.length) o2.b = t.b; if (t.r.length) o2.r = t.r; if (t.w.length) o2.w = t.w; if (t.t.length) o2.t = t.t;
    fs.writeFileSync(path.join(out, 'tiles', key + '.json'), JSON.stringify(o2));
  }
  log(`Kacheln: ${tiles.size} | Gebaeude ${nb}, Strassenstuecke ${nr}, Wasserlinien ${nw}, Baeume ${nt}`);

  // 6) Flugplatz (laengste Piste)
  let airfield = null;
  for (const l of ctx.lines.values()) {
    if (l.cls !== 10) continue;
    const a = l.pts[0], b = l.pts[l.pts.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!airfield || len > airfield.len) airfield = { x0: Math.round(a[0]), z0: Math.round(a[1]), x1: Math.round(b[0]), z1: Math.round(b[1]), w: l.w, len: Math.round(len) };
  }

  // 7) Dateien
  fs.writeFileSync(path.join(out, 'heights.bin'), Buffer.from(heights.buffer));
  fs.writeFileSync(path.join(out, 'landuse.bin'), Buffer.from(landuse.buffer));
  fs.writeFileSync(path.join(out, 'lakeid.bin'), Buffer.from(lakeid.buffer));
  fs.writeFileSync(path.join(out, 'pois.json'), JSON.stringify(pois));
  const meta = {
    version: 1, generated: new Date().toISOString(), origin: { lat: CFG.lat0, lon: CFG.lon0 }, mx: MX, mz: MZ,
    minX, minZ, cell, nx: NX, nz: NZ, yoff: CFG.yoff, hscale: CFG.hscale, tile: T, lakes, airfield,
    tiles: [...tiles.keys()], counts: { buildings: nb, roads: nr, water: nw, trees: nt, pois: pois.length },
    classes: ['wiese', 'wald', 'acker', 'siedlung', 'see', 'fluss', 'fels', 'abbau', 'gebuesch', 'moor', 'park'],
    attribution: '© OpenStreetMap-Mitwirkende (ODbL) · Höhendaten: Terrarium/Mapzen (SRTM, EU-DEM u. a.)',
  };
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta));
  await writeOverview(out, meta, heights, landuse, ctx);
  const size = fs.readdirSync(out).reduce((s, f) => s + (fs.statSync(path.join(out, f)).isFile() ? fs.statSync(path.join(out, f)).size : 0), 0)
    + fs.readdirSync(path.join(out, 'tiles')).reduce((s, f) => s + fs.statSync(path.join(out, 'tiles', f)).size, 0);
  log(`Fertig: ${(size / 1048576).toFixed(1)} MB in ${out}`);
  return meta;
}

// Uebersichtskarte fuer die Minimap (1 px = 20 m)
async function writeOverview(out, meta, heights, landuse, ctx) {
  const { PNG } = require('pngjs');
  const S = Math.round(CFG.ovCell / meta.cell);
  const W = Math.ceil(meta.nx / S), H = Math.ceil(meta.nz / S);
  const png = new PNG({ width: W, height: H });
  const COL = [[139, 178, 84], [58, 110, 54], [196, 184, 96], [196, 170, 150], [70, 140, 200], [90, 150, 205], [150, 148, 142], [165, 140, 110], [105, 135, 70], [110, 140, 110], [122, 176, 90]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.min(meta.nx - 1, x * S), j = Math.min(meta.nz - 1, y * S), c = i + j * meta.nx;
    const col = COL[landuse[c]] || COL[0];
    const hn = heights[Math.min(meta.nx - 1, i + 1) + j * meta.nx], hw = heights[Math.max(0, i - 1) + j * meta.nx];
    const hs = heights[i + Math.min(meta.nz - 1, j + 1) * meta.nx], hnn = heights[i + Math.max(0, j - 1) * meta.nx];
    const shade = Math.max(0.6, Math.min(1.35, 1 + ((hw - hn) + (hnn - hs)) * 0.012));
    const o = (y * W + x) * 4;
    png.data[o] = Math.min(255, col[0] * shade); png.data[o + 1] = Math.min(255, col[1] * shade); png.data[o + 2] = Math.min(255, col[2] * shade); png.data[o + 3] = 255;
  }
  const plot = (px, pz, r, g, b) => {
    const x = Math.round((px - meta.minX) / CFG.ovCell), y = Math.round((pz - meta.minZ) / CFG.ovCell);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b;
  };
  const roadCol = [[240, 150, 30], [240, 150, 30], [250, 200, 60], [255, 230, 120], [255, 250, 200], [255, 255, 255], [235, 235, 235], null, null, [70, 70, 70]];
  for (const l of ctx.lines.values()) {
    if (l.kind !== 'r' || !roadCol[l.cls]) continue;
    const c = roadCol[l.cls];
    for (let k = 1; k < l.pts.length; k++) {
      const a = l.pts[k - 1], b = l.pts[k], len = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CFG.ovCell * 0.6)));
      for (let s = 0; s <= len; s++) plot(a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len, c[0], c[1], c[2]);
    }
  }
  for (const l of ctx.lines.values()) {
    if (l.kind !== 'w') continue;
    for (let k = 1; k < l.pts.length; k++) {
      const a = l.pts[k - 1], b = l.pts[k], len = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CFG.ovCell * 0.6)));
      for (let s = 0; s <= len; s++) plot(a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len, 70, 140, 210);
    }
  }
  fs.writeFileSync(path.join(out, 'overview.png'), PNG.sync.write(png));
  fs.writeFileSync(path.join(out, 'overview.json'), JSON.stringify({ w: W, h: H, cellM: CFG.ovCell }));
}

module.exports = { CFG, proj, unproj, buildMap, loadGeojson, processElements, newCtx, assembleRings, fillRings, mainQuery, poiQuery, demProviderTerrarium, overpass };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const outDir = path.resolve(arg('--out', 'public/world'));
  const cache = path.resolve(arg('--cache', '.cache/map'));
  const gj = arg('--geojson', null);
  (gj ? loadGeojson(path.resolve(gj)) : Promise.resolve(null)).then((geo) => buildMap({ outDir, cache, geo, osm: overpass, dem: demProviderTerrarium(cache) })).catch((e) => { console.error('KARTENBAU FEHLGESCHLAGEN:', e); process.exit(1); });
}
