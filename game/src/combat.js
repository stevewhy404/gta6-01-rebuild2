// Solmar Bay — combat.js
// One job: fighting. Fists and a pistol, bullets, muzzle flash, hit sparks,
// smoke and skid particles. No gore: hits burst into stars.

import { CONFIG } from './config.js';
import { dist, rand } from './util.js';

export class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 900;
    this.vy = Math.sin(angle) * 900;
    this.life = 0.9;
  }
}

export class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }
}

export function spawnSparks(particles, x, y, color, n) {
  for (let i = 0; i < (n || 10); i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(60, 260);
    particles.push(new Particle(
      x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      rand(0.2, 0.5), color || '#ffd93c', rand(2, 4),
    ));
  }
}

export function spawnSmoke(particles, x, y, n) {
  for (let i = 0; i < (n || 6); i++) {
    particles.push(new Particle(
      x + rand(-8, 8), y + rand(-8, 8), rand(-14, 14), rand(-30, -8),
      rand(0.6, 1.2), '#9aa5ad', rand(5, 9),
    ));
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}

// Move bullets; test hits against peds, cops, rivals and cars.
// ctx: {city, peds, cops, rivals, cars, player, onPedHit, onCopHit, onRivalHit, onCarHit}
export function updateBullets(bullets, dt, ctx) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead) {
      const res = ctx.city.collide(b.x, b.y, 2);
      if (res.hit) {
        spawnSparks(ctx.particles, b.x, b.y, '#ffb347', 6);
        dead = true;
      }
    }
    if (!dead) {
      for (const p of ctx.peds) {
        if (p.state !== 'down' && dist(b.x, b.y, p.x, p.y) < 14) {
          p.state = 'down';
          spawnSparks(ctx.particles, p.x, p.y, '#ffd93c', 12);
          ctx.onPedHit && ctx.onPedHit(p);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const c of ctx.cops) {
        if (dist(b.x, b.y, c.x, c.y) < 14) {
          spawnSparks(ctx.particles, c.x, c.y, '#ffd93c', 12);
          ctx.onCopHit && ctx.onCopHit(c);
          dead = true;
          break;
        }
      }
    }
    if (!dead && ctx.rivals) {
      for (const r of ctx.rivals) {
        if (r.alive && dist(b.x, b.y, r.x, r.y) < 15) {
          r.hp -= 34;
          spawnSparks(ctx.particles, r.x, r.y, '#ff6b6b', 10);
          if (r.hp <= 0) {
            r.alive = false;
            ctx.onRivalDown && ctx.onRivalDown(r);
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && ctx.cars) {
      for (const car of ctx.cars) {
        if (car.driver === 'player') continue;
        if (dist(b.x, b.y, car.x, car.y) < 24) {
          car.health -= 12;
          spawnSparks(ctx.particles, b.x, b.y, '#ffb347', 6);
          if (car.health <= 0 && car.driver === 'traffic') {
            car.driver = 'parked';
            car.speed = 0;
            spawnSmoke(ctx.particles, car.x, car.y, 12);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

// Melee swing: hits anything close in front of the attacker.
// Returns the list of things hit.
export function meleeHit(x, y, angle, range, ctx) {
  const hit = [];
  const fx = x + Math.cos(angle) * range * 0.6;
  const fy = y + Math.sin(angle) * range * 0.6;
  for (const p of ctx.peds) {
    if (p.state !== 'down' && dist(fx, fy, p.x, p.y) < range * 0.7) {
      p.state = 'down';
      spawnSparks(ctx.particles, p.x, p.y, '#ffd93c', 10);
      hit.push({ kind: 'ped', obj: p });
    }
  }
  for (const c of ctx.cops) {
    if (dist(fx, fy, c.x, c.y) < range * 0.7) {
      spawnSparks(ctx.particles, c.x, c.y, '#ffd93c', 10);
      hit.push({ kind: 'cop', obj: c });
    }
  }
  if (ctx.rivals) {
    for (const r of ctx.rivals) {
      if (r.alive && dist(fx, fy, r.x, r.y) < range * 0.7) {
        r.hp -= CONFIG.player.punchDamage;
        spawnSparks(ctx.particles, r.x, r.y, '#ff6b6b', 8);
        if (r.hp <= 0) { r.alive = false; hit.push({ kind: 'rivalDown', obj: r }); }
        else hit.push({ kind: 'rival', obj: r });
      }
    }
  }
  return hit;
}
