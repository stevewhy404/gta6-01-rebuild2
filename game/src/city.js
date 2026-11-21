// Solmar Bay — city.js
// One job: build the city once (roads, blocks, buildings, beach, docks, places)
// and answer collision and "where am I" questions about it.

import { CONFIG, PALETTE } from './config.js';
import { clamp, collideCircleBox, mulberry32, pick, randInt } from './util.js';

export class City {
  constructor(seed) {
    this.rng = mulberry32(seed || 20261121);
    const { w, h, block, road } = CONFIG.world;
    this.w = w;
    this.h = h;
    // Road centre lines: 8 each way, 400 apart, starting at 200.
    this.roadsV = [];
    this.roadsH = [];
    for (let i = 0; i < 8; i++) {
      this.roadsV.push(200 + i * block);
      this.roadsH.push(200 + i * block);
    }
    this.roadHalf = road / 2;
    this.buildings = [];
    this.trees = [];
    this.lamps = [];
    this.parks = [];
    this.water = [
      { x: 0, y: 3280, w: w, h: 120 }, // south sea
      { x: 0, y: 0, w: 62, h: h }, // west harbour water
    ];
    this.beach = { x: 0, y: 3042, w: w, h: 238 };
    this.docks = { x: 62, y: 0, w: 140, h: h };
    this._buildBlocks();
    this._buildPlaces();
  }

  _buildBlocks() {
    const rng = this.rng;
    const { road } = CONFIG.world;
    const inset = road / 2 + 14; // sidewalk margin inside a block
    for (let bx = 0; bx < 7; bx++) {
      for (let by = 0; by < 7; by++) {
        const x0 = 200 + bx * 400 + inset;
        const y0 = 200 + by * 400 + inset;
        const x1 = 200 + (bx + 1) * 400 - inset;
        const y1 = 200 + (by + 1) * 400 - inset;
        // Skip the southern beach row blocks (beach takes over below y 3042).
        if (y0 >= 3042) continue;
        const roll = rng();
        if (roll < 0.14) {
          // Park: green square with trees.
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          for (let t = 0; t < 7; t++) {
            this.trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40) });
          }
          continue;
        }
        if (roll < 0.22) {
          // Parking lot: flat asphalt, no buildings (parked cars spawn here).
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, lot: true });
          continue;
        }
        // Downtown core: tall towers.
        const downtown = bx >= 3 && bx <= 4 && by >= 3 && by <= 4;
        const n = downtown ? 1 : randInt(1, 3);
        const bw = (x1 - x0) / (n === 1 ? 1 : 2);
        const bh = (y1 - y0) / (n <= 2 ? 1 : 2);
        for (let i = 0; i < n; i++) {
          const gx = x0 + (i % 2) * bw;
          const gy = y0 + Math.floor(i / 2) * bh;
          const pad = 12;
          const w = bw - pad * 2 - rng() * 30;
          const h = bh - pad * 2 - rng() * 30;
          if (w < 40 || h < 40) continue;
          this.buildings.push({
            x: gx + pad + rng() * 10,
            y: gy + pad + rng() * 10,
            w, h,
            color: pick(PALETTE.buildingRoof),
            height: downtown ? randInt(26, 44) : randInt(8, 18),
            downtown,
          });
        }
        // Trees along the block edge.
        for (let t = 0; t < 3; t++) {
          this.trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * 8 });
          this.trees.push({ x: x0 + rng() * (x1 - x0), y: y1 - rng() * 8 });
        }
      }
    }
    // Dock containers (solid boxes) along the west quay.
    for (let i = 0; i < 10; i++) {
      this.buildings.push({
        x: 84 + (i % 2) * 56, y: 120 + Math.floor(i / 2) * 620 + (i % 3) * 40,
        w: 46, h: 120, color: ['#c0392b', '#2471a3', '#b7950b'][i % 3],
        height: 10, downtown: false, container: true,
      });
    }
    // Street lamps along every road, every 200 px.
    for (const rx of this.roadsV) {
      for (let y = 120; y < this.h; y += 200) {
        this.lamps.push({ x: rx + this.roadHalf + 6, y });
      }
    }
    for (const ry of this.roadsH) {
      for (let x = 120; x < this.w; x += 200) {
        this.lamps.push({ x, y: ry + this.roadHalf + 6 });
      }
    }
  }

  _buildPlaces() {
    // Named story spots, all on roads or open ground.
    this.places = {
      garage: { x: 1400, y: 2920, name: "Mara's Garage" },
      hotel: { x: 1800, y: 1400, name: 'Meridian Hotel' },
      docks: { x: 260, y: 1800, name: 'Solmar Docks' },
      bank: { x: 1800, y: 1800, name: 'Meridian Bank' },
      safehouse: { x: 3000, y: 600, name: 'Safehouse' },
      paint: { x: 3000, y: 2200, name: 'Splash Paint' },
      hospital: { x: 600, y: 600, name: 'Bay General' },
      station: { x: 2600, y: 1800, name: 'Bay PD HQ' },
    };
  }

  isOnRoad(x, y) {
    for (const rx of this.roadsV) {
      if (Math.abs(x - rx) <= this.roadHalf) return true;
    }
    for (const ry of this.roadsH) {
      if (Math.abs(y - ry) <= this.roadHalf) return true;
    }
    return false;
  }

  isWater(x, y) {
    return this.water.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }

  isBeach(x, y) {
    return y >= this.beach.y && y < this.beach.y + this.beach.h && !this.isWater(x, y);
  }

  // Resolve a circle against buildings, water and the world edge.
  // Returns {x, y, hit}.
  collide(x, y, r) {
    let hit = false;
    for (const b of this.buildings) {
      const res = collideCircleBox(x, y, r, b.x, b.y, b.w, b.h);
      if (res) { x = res.x; y = res.y; hit = true; }
    }
    for (const w of this.water) {
      const res = collideCircleBox(x, y, r, w.x, w.y, w.w, w.h);
      if (res) { x = res.x; y = res.y; hit = true; }
    }
    const cx = clamp(x, r, this.w - r);
    const cy = clamp(y, r, this.h - r);
    if (cx !== x || cy !== y) { x = cx; y = cy; hit = true; }
    return { x, y, hit };
  }

  // A random point on a road (for traffic / ped spawns).
  randomRoadPoint() {
    const rng = this.rng;
    if (rng() < 0.5) {
      return { x: pick(this.roadsV) + (rng() < 0.5 ? -14 : 14), y: 120 + rng() * (this.h - 240) };
    }
    return { x: 120 + rng() * (this.w - 240), y: pick(this.roadsH) + (rng() < 0.5 ? -14 : 14) };
  }

  // A random point on a sidewalk next to a road (for pedestrians).
  randomSidewalkPoint() {
    const p = this.randomRoadPoint();
    return { x: p.x + (this.rng() < 0.5 ? -52 : 52), y: p.y + (this.rng() < 0.5 ? -52 : 52) };
  }

  // Nearest road centre line and whether it is vertical.
  nearestRoad(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of this.roadsV) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { vertical: true, line: rx, dist: d }; }
    }
    for (const ry of this.roadsH) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { vertical: false, line: ry, dist: d }; }
    }
    return best;
  }
}
