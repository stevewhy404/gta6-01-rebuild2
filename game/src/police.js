// Solmar Bay — police.js
// One job: the wanted system. Stars rise with crime and fall when the heat
// dies down; police cars and foot cops spawn, chase, and try to bust the player.

import { CONFIG } from './config.js';
import { angleTo, clamp, dist, rand } from './util.js';
import { Car } from './vehicles.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.lastCrimeAt = -999;
    this.lastDecayAt = 0;
    this.hiddenSince = 0;
  }

  addCrime(stars, now) {
    this.stars = clamp(this.stars + stars, 0, CONFIG.wanted.maxStars);
    this.lastCrimeAt = now;
    this.hiddenSince = 0;
  }

  // now: game clock seconds. policeNear: any cop within view.
  update(now, policeNear) {
    if (this.stars === 0) return;
    if (now - this.lastCrimeAt < CONFIG.wanted.decayGrace) return;
    if (policeNear) {
      this.hiddenSince = 0;
      return;
    }
    if (!this.hiddenSince) this.hiddenSince = now;
    if (now - this.hiddenSince > CONFIG.wanted.decayInterval) {
      this.stars -= 1;
      this.hiddenSince = now;
      this.lastCrimeAt = now - CONFIG.wanted.decayGrace; // keep decaying
    }
  }
}

export class FootCop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = CONFIG.police.footSpeed;
    this.arrest = 0; // seconds of contact so far
  }
}

// Spawn a police car just off-screen from the player, on a road.
export function spawnPoliceCar(city, player) {
  const p = city.randomRoadPoint();
  // Prefer a spot 500-900 px away from the player.
  let best = p;
  let bestScore = -1;
  for (let i = 0; i < 6; i++) {
    const q = city.randomRoadPoint();
    const d = dist(q.x, q.y, player.x, player.y);
    const score = d > 450 && d < 1000 ? 1 : 0;
    if (score > bestScore) { bestScore = score; best = q; }
  }
  const car = new Car(best.x, best.y, 0, 'police', 'police');
  car.siren = true;
  car.speed = 200;
  return car;
}

export function spawnFootCop(city, player) {
  const a = rand(0, Math.PI * 2);
  const d = rand(420, 620);
  const x = player.x + Math.cos(a) * d;
  const y = player.y + Math.sin(a) * d;
  return new FootCop(x, y);
}

// Foot cops run at the player; contact builds an arrest timer.
// Returns 'busted' when the arrest completes.
export function updateFootCops(cops, player, dt, city) {
  for (const c of cops) {
    const a = angleTo(c.x, c.y, player.x, player.y);
    c.angle = a;
    const nx = c.x + Math.cos(a) * c.speed * dt;
    const ny = c.y + Math.sin(a) * c.speed * dt;
    const res = city.collide(nx, ny, 11);
    c.x = res.x;
    c.y = res.y;
    if (dist(c.x, c.y, player.x, player.y) < 26) {
      c.arrest += dt;
      if (c.arrest >= CONFIG.police.arrestTime) return 'busted';
    } else {
      c.arrest = Math.max(0, c.arrest - dt * 2);
    }
  }
  return null;
}

// How many police units the wanted level calls for.
export function policeQuota(stars) {
  return {
    cars: Math.min(CONFIG.police.maxCars, stars <= 1 ? 1 : stars <= 2 ? 2 : stars <= 3 ? 3 : stars === 4 ? 4 : 6),
    foot: stars >= 2 ? Math.min(CONFIG.police.maxFoot, (stars - 1) * 2) : 0,
  };
}
