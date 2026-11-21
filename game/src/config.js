// Solmar Bay — config.js
// One job: every tunable number, colour and name of the game in one place.

export const CONFIG = {
  world: { w: 3400, h: 3400, block: 400, road: 84 },
  canvas: { w: 1280, h: 800 },
  player: {
    walkSpeed: 210,
    runSpeed: 330,
    radius: 13,
    health: 100,
    punchDamage: 25,
    punchRange: 34,
    punchCooldown: 0.38,
  },
  car: {
    accel: 520,
    reverseAccel: 320,
    maxSpeed: 640,
    maxReverse: 220,
    turnRate: 2.6,
    brake: 900,
    drag: 0.55,
    radius: 20,
  },
  police: {
    carSpeed: 600,
    footSpeed: 250,
    maxCars: 6,
    maxFoot: 8,
    arrestTime: 1.1,
  },
  traffic: { count: 42, speedMin: 130, speedMax: 210 },
  peds: { count: 64, speedMin: 34, speedMax: 62 },
  wanted: {
    decayGrace: 18, // seconds with no crime before stars start to fall
    decayInterval: 9, // seconds per lost star while hidden
    paintPrice: 200,
    maxStars: 5,
  },
  money: { startCash: 150, hospitalFee: 100, bustFee: 150 },
};

export const PALETTE = {
  grass: '#8fbf6b',
  grassDark: '#7fae5c',
  sand: '#e9d8a6',
  water: '#2e9db4',
  waterDeep: '#238a9f',
  road: '#3a3f4a',
  roadEdge: '#2f333d',
  sidewalk: '#c9c2b4',
  dash: '#f5d76e',
  buildingRoof: ['#f2a65a', '#e87e6b', '#7fb3d5', '#f7dc6f', '#a569bd', '#58d68d', '#ec7063', '#5dade2'],
  buildingWall: '#5d6d7e',
  park: '#6faf4f',
  dock: '#8a6f4d',
  player: '#2e86ff',
  police: '#f4f6f7',
  taxi: '#f7dc3c',
};

export const CAR_COLORS = [
  '#d64545', '#3f7fbf', '#e8a13c', '#5fb85f', '#8e6fc0', '#e06ba7',
  '#3fb8af', '#c0c8d0', '#7a5c3e', '#4a4a55',
];

export const PED_SHIRTS = [
  '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#fd79a8', '#636e72', '#dfe6e9',
];

// Story places (world coordinates, set by city.js at build time).
export const PLACES = {
  garage: 'Mara\'s Garage',
  hotel: 'Meridian Hotel',
  docks: 'Solmar Docks',
  bank: 'Meridian Bank',
  safehouse: 'Safehouse',
  paint: 'Splash Paint',
  hospital: 'Bay General',
  station: 'Bay PD HQ',
};
