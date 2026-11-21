// Solmar Bay — peds.js
// One job: pedestrians. They stroll the sidewalks, wait at crossings, and
// run away screaming from gunfire, speeding cars and police chases.

import { CONFIG, PED_SHIRTS } from './config.js';
import { angleLerp, angleTo, clamp, dist, pick, rand } from './util.js';

export class Ped {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = rand(0, Math.PI * 2);
    this.speed = rand(CONFIG.peds.speedMin, CONFIG.peds.speedMax);
    this.state = 'walk'; // walk | flee | down
    this.shirt = pick(PED_SHIRTS);
    this.skin = pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']);
    this.target = null;
    this.wait = rand(0, 3);
    this.fleeUntil = 0;
    this.panic = 0;
  }
}

export function spawnPed(city) {
  const p = city.randomSidewalkPoint();
  return new Ped(p.x, p.y);
}

// peds: array of Ped. danger: {x, y, radius} or null (a scare source).
export function updatePeds(peds, dt, city, danger, playerCar) {
  const now = performance.now() / 1000;
  for (const p of peds) {
    if (p.state === 'down') continue;
    // Flee from danger.
    if (danger && dist(p.x, p.y, danger.x, danger.y) < danger.radius) {
      p.state = 'flee';
      p.fleeUntil = now + rand(2.5, 5);
    }
    if (playerCar && dist(p.x, p.y, playerCar.x, playerCar.y) < 90 && Math.abs(playerCar.speed) > 260) {
      p.state = 'flee';
      p.fleeUntil = now + 3;
    }
    if (p.state === 'flee') {
      if (now > p.fleeUntil && !danger) {
        p.state = 'walk';
      } else if (danger) {
        const a = angleTo(danger.x, danger.y, p.x, p.y);
        p.angle = angleLerp(p.angle, a, clamp(dt * 6, 0, 1));
        const sp = 190;
        const nx = p.x + Math.cos(p.angle) * sp * dt;
        const ny = p.y + Math.sin(p.angle) * sp * dt;
        const res = city.collide(nx, ny, 10);
        p.x = res.x;
        p.y = res.y;
        continue;
      }
    }
    // Stroll: pick a sidewalk target, walk to it, idle a while.
    if (!p.target || dist(p.x, p.y, p.target.x, p.target.y) < 12) {
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      p.target = city.randomSidewalkPoint();
      p.wait = rand(0, 2.5);
    }
    const a = angleTo(p.x, p.y, p.target.x, p.target.y);
    p.angle = angleLerp(p.angle, a, clamp(dt * 4, 0, 1));
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    const res = city.collide(nx, ny, 10);
    p.x = res.x;
    p.y = res.y;
  }
}
