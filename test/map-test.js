'use strict';
// Test der Kartenbau-Pipeline mit Fake-OSM-Daten und synthetischem Hoehenmodell (kein Internet noetig)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CFG, buildMap, unproj, assembleRings } = require('../tools/build-map');

const G = (lat, lon) => ({ lat, lon });
const box = (lat, lon, dla, dlo) => [G(lat, lon), G(lat, lon + dlo), G(lat + dla, lon + dlo), G(lat + dla, lon), G(lat, lon)];

// Ringe aus Teilstuecken zusammensetzen
{
  const a = [G(0, 0), G(0, 1), G(1, 1)], b = [G(1, 0), G(0, 0)], c = [G(1, 1), G(1, 0)];
  const r = assembleRings([a, c, b]);
  assert.strictEqual(r.length, 1, 'ein Ring');
  assert.strictEqual(r[0].length, 5);
}

const elements = [
  { type: 'way', id: 1, tags: { building: 'house', 'building:levels': '2', 'roof:shape': 'gabled' }, geometry: box(48.0069, 13.6558, 0.0001, 0.00015) },
  { type: 'way', id: 2, tags: { building: 'church' }, geometry: box(48.0075, 13.6565, 0.0002, 0.0001) },
  { type: 'way', id: 3, tags: { highway: 'primary' }, geometry: [G(48.0, 13.60), G(48.0069, 13.6558), G(48.01, 13.70)] },
  { type: 'way', id: 4, tags: { highway: 'residential', bridge: 'yes' }, geometry: [G(48.0069, 13.6558), G(48.0069, 13.67)] },
  { type: 'way', id: 5, tags: { highway: 'residential', tunnel: 'yes' }, geometry: [G(48.0, 13.6), G(48.0, 13.61)] },
  { type: 'way', id: 6, tags: { waterway: 'river' }, geometry: [G(48.0, 13.5), G(48.0, 13.62), G(48.003, 13.7)] },
  { type: 'way', id: 7, tags: { natural: 'wood' }, geometry: box(47.95, 13.60, 0.01, 0.02) },
  { type: 'way', id: 8, tags: { landuse: 'residential' }, geometry: box(48.0, 13.64, 0.012, 0.03) },
  // See als Relation aus zwei Teilstuecken
  { type: 'relation', id: 9, tags: { type: 'multipolygon', natural: 'water' }, members: [
    { type: 'way', role: 'outer', geometry: [G(47.9, 13.52), G(47.9, 13.58), G(47.97, 13.58)] },
    { type: 'way', role: 'outer', geometry: [G(47.97, 13.58), G(47.97, 13.52), G(47.9, 13.52)] },
  ] },
  { type: 'node', id: 10, lat: 48.0, lon: 13.65, tags: { natural: 'tree' } },
  { type: 'way', id: 11, tags: { aeroway: 'runway', width: '30' }, geometry: [G(47.99, 13.45), G(47.99, 13.46)] },
];
const pois = [
  { type: 'node', id: 20, lat: 48.0069, lon: 13.6558, tags: { amenity: 'pub', name: 'Zum Test' } },
  { type: 'node', id: 21, lat: 48.0, lon: 13.6, tags: { place: 'town', name: 'Testdorf' } },
  { type: 'node', id: 22, lat: 47.86, lon: 13.65, tags: { natural: 'peak', name: 'Testberg', ele: '1500' } },
];

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wiba-map-'));
  let calls = 0;
  const meta = await buildMap({
    outDir: out, noSleep: true, step: 0.2,
    osm: async (q) => { calls++; return { elements: /place/.test(q) ? pois : elements }; },
    // Synthetisches Hoehenmodell: See bei 469 m, Huegel im Osten
    dem: async () => (lat, lon) => (lat < 47.97 && lat > 47.9 && lon > 13.52 && lon < 13.58 ? 469 + Math.sin(lat * 900) * 0.4 : 500 + (lon - 13.44) * 1500 + Math.sin(lon * 500) * 6),
  });
  assert.ok(meta.nx > 2000 && meta.nz > 2500, 'Rastergroesse');
  assert.ok(calls >= 4, 'Abfragen');
  const files = fs.readdirSync(out);
  for (const f of ['meta.json', 'heights.bin', 'landuse.bin', 'lakeid.bin', 'pois.json', 'overview.png']) assert.ok(files.includes(f), f + ' fehlt');
  assert.strictEqual(fs.statSync(path.join(out, 'heights.bin')).size, meta.nx * meta.nz * 2);
  assert.strictEqual(fs.statSync(path.join(out, 'landuse.bin')).size, meta.nx * meta.nz);
  assert.ok(meta.counts.buildings >= 2, 'Gebaeude ' + meta.counts.buildings);
  assert.ok(meta.counts.roads >= 2, 'Strassen');
  assert.strictEqual(meta.counts.pois, 3);
  assert.strictEqual(meta.lakes.length, 1, 'ein See');
  assert.ok(Math.abs(meta.lakes[0].level + meta.yoff - 469) < 1, 'Seespiegel ' + meta.lakes[0].level);
  assert.ok(meta.airfield && meta.airfield.w === 30, 'Piste');
  // Landnutzung am See / im Wald / in der Siedlung
  const lu = fs.readFileSync(path.join(out, 'landuse.bin'));
  const heights = new Int16Array(fs.readFileSync(path.join(out, 'heights.bin')).buffer.slice(0));
  const at = (lat, lon) => { const x = (lon - CFG.lon0) * meta.mx, z = -(lat - CFG.lat0) * meta.mz; const i = Math.round((x - meta.minX) / meta.cell), j = Math.round((z - meta.minZ) / meta.cell); return i + j * meta.nx; };
  assert.strictEqual(lu[at(47.935, 13.55)], 4, 'See');
  assert.strictEqual(lu[at(47.955, 13.61)], 1, 'Wald');
  assert.strictEqual(lu[at(48.005, 13.655)], 3, 'Siedlung');
  // Seeboden liegt unter dem Spiegel, Mitte tiefer als Rand
  const mid = heights[at(47.935, 13.55)] / meta.hscale, edge = heights[at(47.9015, 13.5205)] / meta.hscale;
  assert.ok(mid < meta.lakes[0].level - 3 && edge > mid, `Seeboden mid=${mid} edge=${edge}`);
  // Kacheln
  const tilePath = path.join(out, 'tiles', meta.tiles[0] + '.json');
  assert.ok(fs.existsSync(tilePath));
  const tt = meta.tiles.map((k) => JSON.parse(fs.readFileSync(path.join(out, 'tiles', k + '.json'))));
  const bs = tt.flatMap((t) => t.b || []);
  const house = bs.find((b) => b[1] === 2);
  assert.ok(house && house[2] === 1, 'Haus: 2 Geschosse, Satteldach');
  assert.ok(house.length === 5 + 8, 'Grundriss mit 4 Ecken: ' + house.length);
  const rs = tt.flatMap((t) => t.r || []);
  assert.ok(rs.some((r) => r[0] === 2) && rs.some((r) => r[2] === 1), 'Primaerstrasse + Bruecke');
  assert.ok(!rs.some((r) => r[0] === 5 && r[2] === 0 && r.length === 3 + 4 && false), 'Tunnel fehlt');
  assert.ok(tt.some((t) => t.w), 'Fluss');
  assert.ok(unproj(0, 0)[0] === CFG.lat0);
  fs.rmSync(out, { recursive: true, force: true });

  // Zweiter Weg: GeoJSON-Zeilen wie von "osmium export -f geojsonseq"
  const { loadGeojson } = require('../tools/build-map');
  const C = (g) => [g.lon, g.lat];
  const feats = [
    { type: 'Feature', properties: { building: 'house', 'building:levels': '2', 'roof:shape': 'gabled', amenity: 'pub', name: 'Zum Test' }, geometry: { type: 'Polygon', coordinates: [box(48.0069, 13.6558, 0.0001, 0.00015).map(C)] } },
    { type: 'Feature', properties: { building: 'house' }, geometry: { type: 'LineString', coordinates: box(48.0069, 13.6558, 0.0001, 0.00015).map(C) } },
    { type: 'Feature', properties: { highway: 'primary' }, geometry: { type: 'LineString', coordinates: [G(48.0, 13.60), G(48.0069, 13.6558), G(48.01, 13.70)].map(C) } },
    { type: 'Feature', properties: { waterway: 'river' }, geometry: { type: 'LineString', coordinates: [G(48.0, 13.5), G(48.0, 13.62)].map(C) } },
    { type: 'Feature', properties: { natural: 'water' }, geometry: { type: 'MultiPolygon', coordinates: [[box(47.9, 13.52, 0.07, 0.06).map(C)]] } },
    { type: 'Feature', properties: { natural: 'wood' }, geometry: { type: 'Polygon', coordinates: [box(47.95, 13.60, 0.01, 0.02).map(C)] } },
    { type: 'Feature', properties: { place: 'town', name: 'Testdorf' }, geometry: { type: 'Point', coordinates: [13.6, 48.0] } },
    { type: 'Feature', properties: { natural: 'tree' }, geometry: { type: 'Point', coordinates: [13.65, 48.0] } },
  ];
  const gjFile = path.join(os.tmpdir(), 'wiba-test.geojsonseq');
  fs.writeFileSync(gjFile, feats.map((f) => '\x1e' + JSON.stringify(f)).join('\n') + '\n');
  const geo = await loadGeojson(gjFile);
  assert.strictEqual(geo.pois.length, 2, 'POIs aus GeoJSON: ' + geo.pois.length);
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wiba-map2-'));
  const meta2 = await buildMap({ outDir: out2, noSleep: true, geo, osm: async () => { throw new Error('darf nicht abgefragt werden'); },
    dem: async () => (lat, lon) => (lat < 47.97 && lat > 47.9 && lon > 13.52 && lon < 13.58 ? 469 : 500 + (lon - 13.44) * 1500) });
  assert.strictEqual(meta2.counts.buildings, 1, 'Gebaeude (nur Flaeche, nicht die Linie)');
  assert.ok(meta2.counts.roads >= 1 && meta2.counts.water >= 1 && meta2.counts.trees === 1 && meta2.counts.pois === 2);
  assert.strictEqual(meta2.lakes.length, 1, 'See aus MultiPolygon');
  const lu2 = fs.readFileSync(path.join(out2, 'landuse.bin'));
  assert.strictEqual(lu2[at(47.955, 13.61)], 1, 'Wald aus Polygon');
  fs.rmSync(out2, { recursive: true, force: true }); fs.rmSync(gjFile);
  console.log('Kartenbau-Test: alles in Ordnung');
})().catch((e) => { console.error('Kartenbau-Test FEHLGESCHLAGEN:', e); process.exit(1); });
