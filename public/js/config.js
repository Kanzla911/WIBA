// WIBA - zentrale Spielkonstanten
export const CELL = 2.5;
export const GRID = 384;
export const HALF = (GRID * CELL) / 2; // 480 m
export const DAY_LENGTH = 1200; // Sekunden pro Tag

export const ZONES = [
  { name: 'Dorf Faulenbach', x: 0, z: 0, rx: 100, rz: 100, h: 6, blend: 40, protect: true },
  { name: 'Flugplatz', x: 0, z: -330, rx: 220, rz: 45, h: 8, blend: 35, protect: true },
  { name: 'Baustelle', x: 230, z: 120, rx: 60, rz: 60, h: 7, blend: 30, protect: false },
];

export const ITEMS = {
  schaufel: { name: 'Schaufel', icon: '⛏️', hold: true },
  banane: { name: 'Banane', icon: '🍌', hold: true },
  pistole: { name: 'Pistole', icon: '🔫', hold: true },
  schrot: { name: 'Schrotflinte', icon: '💥', hold: true },
  stg: { name: 'Sturmgewehr', icon: '🎯', hold: true },
  pzf: { name: 'Panzerfaust', icon: '🚀', hold: true },
  granate: { name: 'Granate', icon: '💣', hold: true, use: true },
  bier: { name: 'Bier', icon: '🍺', hold: true, use: true },
  schnaps: { name: 'Marillenschnaps', icon: '🥃', hold: true, use: true },
  semmel: { name: 'Leberkässemmel', icon: '🥪', hold: true, use: true },
  gras: { name: 'Kräuterzigarette', icon: '🌿', hold: true, use: true },
  pilze: { name: 'Zauberschwammerl', icon: '🍄', hold: true, use: true },
  pulver: { name: 'Turbo-Pulver', icon: '⚡', hold: true, use: true },
  platte: { name: 'Betonplatte', icon: '⬜', hold: true, use: true },
  wand: { name: 'Betonwand', icon: '🧱', hold: true, use: true },
  muni: { name: 'Munition', icon: '•' },
  rakete: { name: 'Rakete', icon: '🧨' },
  erde: { name: 'Erde', icon: '🟫' },
  eisen: { name: 'Eisenerz', icon: '⚙️' },
  kohle: { name: 'Kohle', icon: '⚫' },
  schwefel: { name: 'Schwefel', icon: '🟡' },
};
export const HOTBAR_ORDER = ['schaufel', 'banane', 'pistole', 'schrot', 'stg', 'pzf', 'granate',
  'platte', 'wand', 'bier', 'schnaps', 'semmel', 'gras', 'pilze', 'pulver'];

export const WEAPONS = {
  pistole: { dmg: 24, rate: 0.26, mag: 12, reload: 1.2, spread: 0.012, auto: false, range: 160, pellets: 1, kick: 0.03 },
  schrot: { dmg: 10, rate: 0.85, mag: 6, reload: 2.0, spread: 0.075, auto: false, range: 55, pellets: 8, kick: 0.09 },
  stg: { dmg: 17, rate: 0.1, mag: 30, reload: 1.8, spread: 0.02, auto: true, range: 240, pellets: 1, kick: 0.011 },
  pzf: { rate: 1.2, mag: 1, reload: 2.4, auto: false, ammo: 'rakete', proj: 'rakete', kick: 0.12 },
};

export const PROJ = {
  rakete: { g: 2, r: 9, dmg: 125, crater: 1.0, life: 5, speed: 85, name: 'Rakete' },
  bombe: { g: 20, r: 13, dmg: 170, crater: 1.6, life: 20, speed: 0, name: 'Bombe' },
  jauche: { g: 20, r: 8, dmg: 75, crater: 0.6, life: 20, speed: 0, name: 'Jauchebombe' },
  wrack: { g: 0, r: 10, dmg: 130, crater: 0.8, life: 1, speed: 0, name: 'Absturz' },
  granate: { g: 18, r: 7, dmg: 105, crater: 0.5, life: 2.6, speed: 22, name: 'Granate', bounce: true },
};

export const RECIPES = [
  { out: 'muni', n: 30, cost: { eisen: 1, kohle: 1, schwefel: 1 } },
  { out: 'pistole', n: 1, cost: { eisen: 4 } },
  { out: 'schrot', n: 1, cost: { eisen: 8, kohle: 2 } },
  { out: 'stg', n: 1, cost: { eisen: 14, kohle: 4 } },
  { out: 'pzf', n: 1, cost: { eisen: 12, schwefel: 6 } },
  { out: 'rakete', n: 2, cost: { eisen: 3, schwefel: 3, kohle: 2 } },
  { out: 'granate', n: 2, cost: { eisen: 2, schwefel: 2 } },
  { out: 'platte', n: 2, cost: { erde: 6, eisen: 1 } },
  { out: 'wand', n: 2, cost: { erde: 6, eisen: 1 } },
];

export const SHOPS = {
  wirt: {
    title: 'Wirtshaus „Zum Faulen Bagger“', hint: 'Servus! Was darf’s sein?',
    buy: [['bier', 1, 5], ['schnaps', 1, 12], ['semmel', 1, 8]],
  },
  dealer: {
    title: 'Der Franz (hinterm Stadl)', hint: 'Pssst… alles bio, alles aus der Region.',
    buy: [['gras', 1, 20], ['pilze', 1, 30], ['pulver', 1, 40]],
  },
  handel: {
    title: 'Schrotthandel Hintermoser', hint: 'Ich kauf dein Graffel – und verkauf dir meins.',
    buy: [['muni', 30, 25], ['rakete', 1, 45], ['eisen', 1, 12], ['kohle', 1, 10], ['schwefel', 1, 14], ['banane', 1, 3]],
    sell: [['erde', 1], ['eisen', 5], ['kohle', 4], ['schwefel', 6]],
  },
  werk: { title: 'Werkstatt – Waffenschmiede', hint: 'Aus Erz wird Ernst.', craft: true },
};

export const VEH = {
  bagger: { name: 'Bagger', radius: 3.2, cy: 1.6, maxHp: 400 },
  auto: { name: 'Pritschenwagen', radius: 2.5, cy: 0.9, maxHp: 200 },
  flieger: {
    name: 'Propellerflieger', radius: 4.0, cy: 1.3, maxHp: 150,
    max: 58, stall: 17, takeoff: 23, accel: 10, pitch: 1.1, roll: 2.0, yaw: 0.6, cam: 15,
    ammo: { bombe: 6 }, bombKind: 'jauche',
  },
  jet: {
    name: 'Kampfjet', radius: 5.0, cy: 1.3, maxHp: 220,
    max: 120, stall: 36, takeoff: 48, accel: 24, pitch: 1.3, roll: 3.0, yaw: 0.5, cam: 22,
    ammo: { mg: 400, rakete: 8, bombe: 6 }, bombKind: 'bombe',
  },
};

export const SPAWNS = [[0, 28], [8, 30], [-8, 30], [14, 22], [-14, 22], [0, 38], [20, 34], [-20, 34]];
export const PLAYER_COLORS = [0xffcc00, 0xff5533, 0x33aaff, 0x55dd55, 0xff66cc, 0xffffff, 0xaa66ff, 0xff9900];
