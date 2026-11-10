// WIBA - Geografie: Region Voecklabruck - Attersee - Weissenbachtal (verkleinert, ca. 1:12)
// Grundlage: topografische Karte des Gebiets. Kartenpixel (px,py) -> Weltkoordinaten.
// Norden = -Z, Osten = +X.
export const P = (px, py) => [(px - 333) * 1.8, (py - 540) * 1.8];
const L = (arr) => arr.map((p) => P(p[0], p[1]));

// Uferlinie Attersee (im Uhrzeigersinn, ab Nordspitze)
export const LAKE = L([
  [360, 308], [366, 318], [352, 372], [326, 440], [304, 500], [297, 560], [287, 620], [268, 700],
  [248, 770], [238, 830], [232, 900], [226, 950], [204, 976], [150, 986], [82, 1000], [52, 986],
  [52, 962], [100, 902], [148, 842], [164, 790], [160, 720], [165, 650], [170, 560], [176, 492],
  [200, 466], [215, 420], [221, 376], [270, 341], [312, 316],
]);

// Stadt- und Sonderzonen (eben)
export const TOWN = { x: 410, z: -880 };
export const ZONES = [
  { name: 'Vöcklabruck', x: TOWN.x, z: TOWN.z, rx: 150, rz: 105, h: 5, blend: 30, protect: true },
  { name: 'Flugplatz', x: -380, z: -610, rx: 220, rz: 45, h: 6, blend: 30, protect: true },
  { name: 'Baustelle Stadtrand', x: 690, z: -905, rx: 55, rz: 48, h: 5, blend: 25, protect: false },
];

// Hoehen-Stuetzpunkte [px, py, Hoehe, Radius(px)] - aus Hoehenlinien/Schummerung der Karte
export const HILLS = [
  [80, 180, 10, 90], [250, 40, 6, 70], [520, 180, 8, 80], [620, 250, 10, 70],     // Vorland / Hausruck-Auslaeufer
  [180, 405, 34, 42],                                                             // Buchberg
  [60, 520, 34, 95], [40, 700, 46, 110], [85, 860, 44, 80], [20, 400, 16, 80],     // Westufer-Hoehen / Mondseeberge
  [385, 458, 44, 46], [450, 500, 34, 80], [575, 430, 46, 85], [545, 575, 50, 95], // Gahberg, Hongar, Alpenberg
  [420, 640, 44, 80], [360, 590, 26, 50], [400, 705, 40, 55], [560, 690, 42, 80],
  [430, 890, 95, 62], [520, 905, 120, 85], [620, 990, 130, 95], [640, 840, 110, 80], // Hoellengebirge
  [330, 930, 70, 48], [350, 850, 55, 40],
  [110, 1050, 70, 70],                                                             // Richtung Schafberg
];

// Weissenbachtal (Talsohle, von der Muendung nach Osten ansteigend)
export const VALLEY = L([[244, 800], [300, 792], [380, 777], [440, 771], [520, 761], [600, 749], [720, 738]]);

// Strassen: {name, w, pts}
export const ROADS = [
  { name: 'A1 Westautobahn', w: 15, col: 0x3d4047, pts: L([[-240, 520], [0, 455], [110, 405], [160, 350], [215, 294], [300, 274], [362, 284], [430, 300], [520, 291], [666, 300], [910, 290]]) },
  { name: 'B1 Wiener Straße', w: 9, pts: [...L([[-240, 78], [50, 72], [250, 60], [400, 56]]), [262, -905], [560, -905], [760, -905], [1030, -880]] },
  { name: 'Stadt Nord-Süd', w: 8, pts: [[410, -984], [410, -905], [410, -776], [300, -700]] },
  { name: 'B151 Attersee Straße', w: 8, pts: [[300, -700], ...L([[410, 195], [382, 262], [392, 330]])] },
  { name: 'Ostufer', w: 8, pts: L([[392, 330], [378, 352], [350, 392], [334, 440], [313, 500], [307, 560], [298, 620], [279, 700], [259, 770], [250, 830], [243, 900], [236, 952], [206, 988], [150, 999], [82, 1012], [44, 998], [40, 962]]) },
  { name: 'Westufer', w: 8, pts: L([[362, 284], [334, 300], [300, 312], [262, 334], [212, 371], [207, 420], [192, 461], [167, 492], [161, 560], [156, 650], [151, 720], [155, 790], [140, 846], [92, 904], [42, 958], [40, 962]]) },
  { name: 'Gahbergstraße', w: 6, pts: L([[313, 500], [330, 512], [348, 505], [352, 492], [338, 482], [344, 470], [360, 472], [372, 480], [384, 470], [383, 459]]) },
  { name: 'Weißenbachtal Straße', w: 7, pts: L([[250, 800], [300, 792], [380, 777], [440, 771], [520, 761], [600, 749], [720, 738]]) },
  { name: 'Flugplatzstraße', w: 6, pts: [P(215, 294), [-250, -520], [-300, -566]] },
  { name: 'Attergaustraße', w: 7, pts: L([[70, 356], [120, 352], [160, 350]]) },
  { name: 'Gamperner Straße', w: 6, pts: L([[250, 60], [250, 140], [222, 230], [215, 294]]) },
  { name: 'Baustellenzufahrt', w: 7, pts: [[690, -905], [690, -860]] },
];

// Fluesse: {name, w, pts}
export const RIVERS = [
  { name: 'Ager', w: 9, pts: [...L([[362, 300], [386, 268], [404, 215], [420, 150]]), [190, -766], [420, -764], [600, -772], [700, -792], [1030, -800]] },
  { name: 'Vöckla', w: 8, pts: [[-1030, -826], [-500, -852], [-150, -838], [120, -858], [262, -838], [560, -838], [640, -790], [700, -792]] },
  { name: 'Weißenbach', w: 4, pts: L([[240, 808], [300, 801], [380, 786], [440, 780], [520, 770], [600, 758], [720, 747]]) },
];

// Orte: {name, x, z, n(Haeuser), r, church, lake}
const O = (name, px, py, n, r, opt = {}) => Object.assign({ name, x: P(px, py)[0], z: P(px, py)[1], n, r }, opt);
export const PLACES = [
  O('Timelkam', 300, 46, 10, 55, { church: true }),
  O('Vöcklamarkt', 50, 60, 8, 50, { church: true }),
  O('Gampern', 262, 140, 7, 45, { church: true }),
  O('Lenzing', 424, 196, 10, 55, {}),
  O('Seewalchen am Attersee', 330, 288, 10, 50, { church: true, lake: true }),
  O('Schörfling am Attersee', 408, 338, 12, 55, { church: true, lake: true }),
  O('St. Georgen im Attergau', 72, 340, 9, 50, { church: true }),
  O('Attersee am Attersee', 184, 462, 8, 45, { church: true, lake: true }),
  O('Nußdorf am Attersee', 148, 622, 7, 42, { church: true, lake: true }),
  O('Weyregg am Attersee', 318, 520, 11, 55, { church: true, lake: true }),
  O('Steinbach am Attersee', 286, 700, 8, 45, { church: true, lake: true }),
  O('Weißenbach am Attersee', 256, 826, 7, 42, { lake: true }),
  O('Unterach am Attersee', 36, 1000, 8, 45, { church: true, lake: true }),
];
export const GAHBERG = { x: P(383, 458)[0], z: P(383, 458)[1] };
export const SCHNEIDERBAUER = { x: P(336, 476)[0], z: P(336, 476)[1] };
export const KAMMER = { x: P(371, 327)[0], z: P(371, 327)[1] };
export const NOEHMER = { x: P(276, 786)[0], z: P(276, 786)[1] };
export const NIXENFALL = { x: P(330, 772)[0], z: P(330, 772)[1] };

export function placeName(x, z) {
  let best = null, bd = 1e9;
  for (const p of PLACES) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < p.r + 25 && d < bd) { bd = d; best = p.name; }
  }
  if (best) return best;
  if (Math.hypot(GAHBERG.x - x, GAHBERG.z - z) < 90) return 'Gahberg';
  return null;
}

// Punkt-in-Polygon + Abstand zum Ufer (positiv = ausserhalb des Sees)
export function lakeDist(x, z) {
  let inside = false, best = 1e12;
  for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
    const ax = LAKE[j][0], az = LAKE[j][1], bx = LAKE[i][0], bz = LAKE[i][1];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const ex = bx - ax, ez = bz - az;
    let t = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const dx = ax + ex * t - x, dz = az + ez * t - z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best);
}

// Polylinie gleichmaessig abtasten (Catmull-Rom geglaettet)
export function samplePath(pts, step) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}
