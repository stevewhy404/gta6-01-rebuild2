// Solmar Bay — vehicles.js
// One job: cars. Player driving physics, traffic that follows the roads,
// parked cars to steal, and police cars that chase.

import { CONFIG, CAR_COLORS } from './config.js';
import { angleDiff, clamp, dist, pick, rand, randInt } from './util.js';

const DIRS = [
  { dx: 1, dy: 0 }, // east
  { dx: 0, dy: 1 }, // south
  { dx: -1, dy: 0 }, // west
  { dx: 0, dy: -1 }, // north
];

export const CAR_TYPES = {
  sedan: { len: 46, wid: 24, top: 620, color: null },
  taxi: { len: 46, wid: 24, top: 600, color: '#f7dc3c' },
  van: { len: 56, wid: 26, top: 520, color: null },
  sports: { len: 48, wid: 24, top: 700, color: null },
  truck: { len: 64, wid: 28, top: 460, color: null },
  police: { len: 48, wid: 24, top: 640, color: '#f4f6f7' },
};

export class Car {
  constructor(x, y, angle, type, driver) {
    const t = CAR_TYPES[type] || CAR_TYPES.sedan;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.type = type;
    this.len = t.len;
    this.wid = t.wid;
    this.top = t.top;
    this.color = t.color || pick(CAR_COLORS);
    this.driver = driver || 'parked'; // player | traffic | police | parked
    this.health = 100;
    this.dir = 0; // traffic heading index (0=E,1=S,2=W,3=N)
    this.lane = 14; // right-hand lane offset from road centre
    this.lastTurnAt = 0;
    this.stuck = 0;
    this.siren = false;
  }
}

export function makeCar(x, y, angle, type, driver) {
  return new Car(x, y, angle, type, driver);
}

export function spawnTrafficCar(city) {
  const p = city.randomRoadPoint();
  const near = city.nearestRoad(p.x, p.y);
  const type = pick(['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']);
  const car = new Car(p.x, p.y, 0, type, 'traffic');
  if (near.vertical) {
    car.dir = Math.random() < 0.5 ? 1 : 3; // south or north
    car.x = near.line + (car.dir === 1 ? 14 : -14);
    car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.dir = Math.random() < 0.5 ? 0 : 2; // east or west
    car.y = near.line + (car.dir === 0 ? 14 : -14);
    car.angle = car.dir === 0 ? 0 : Math.PI;
  }
  car.speed = rand(CONFIG.traffic.speedMin, CONFIG.traffic.speedMax);
  return car;
}

export function spawnParkedCar(city) {
  const p = city.randomRoadPoint();
  const near = city.nearestRoad(p.x, p.y);
  const type = pick(['sedan', 'sedan', 'sports', 'van']);
  const car = new Car(p.x, p.y, 0, type, 'parked');
  if (near.vertical) {
    car.x = near.line + (Math.random() < 0.5 ? 34 : -34);
    car.y = p.y;
    car.angle = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
  } else {
    car.y = near.line + (Math.random() < 0.5 ? 34 : -34);
    car.x = p.x;
    car.angle = Math.random() < 0.5 ? 0 : Math.PI;
  }
  return car;
}

// --- Player driving ---
// input: {throttle -1..1, steer -1..1, brake bool}. Returns 'crash' when a hard hit happened.
export function updatePlayerCar(car, input, dt, city) {
  const cfg = CONFIG.car;
  const forward = input.throttle;
  if (forward > 0) car.speed += cfg.accel * forward * dt;
  else if (forward < 0) car.speed += cfg.reverseAccel * forward * dt;
  if (input.brake) {
    car.speed -= Math.sign(car.speed) * cfg.brake * dt;
    if (Math.abs(car.speed) < 20) car.speed = 0;
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * cfg.drag * dt;
  car.speed = clamp(car.speed, -cfg.maxReverse, cfg.top);
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  // Steering only works while moving; stronger at low speed.
  const steerAuthority = clamp(Math.abs(car.speed) / 200, 0, 1);
  car.angle += input.steer * cfg.turnRate * steerAuthority * Math.sign(car.speed || 1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const res = city.collide(nx, ny, cfg.radius);
  let crash = false;
  if (res.hit && Math.abs(car.speed) > 180) crash = true;
  if (res.hit) car.speed *= 0.45;
  car.x = res.x;
  car.y = res.y;
  return crash ? 'crash' : null;
}

// --- Traffic: follow roads, turn at intersections, slow for cars ahead ---
export function updateTrafficCar(car, dt, city, cars) {
  const d = DIRS[car.dir];
  // Slow down if a car is right ahead.
  let targetSpeed = rand(CONFIG.traffic.speedMin, CONFIG.traffic.speedMax);
  for (const o of cars) {
    if (o === car || o.driver === 'parked') continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const along = dx * d.dx + dy * d.dy;
    const side = Math.abs(dx * -d.dy + dy * d.dx);
    if (along > 0 && along < 70 && side < 30) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, o.speed - 20));
    }
  }
  car.speed += clamp(targetSpeed - car.speed, -400 * dt, 260 * dt);
  // Intersection? If the car is near a crossing road line, maybe turn.
  const crossing = car.dir === 0 || car.dir === 2
    ? nearestLine(city.roadsV, car.x)
    : nearestLine(city.roadsH, car.y);
  const now = performance.now();
  if (crossing.dist < 10 && now - car.lastTurnAt > 2500) {
    const roll = Math.random();
    let newDir = car.dir;
    if (roll < 0.16) newDir = (car.dir + 1) % 4; // right
    else if (roll < 0.32) newDir = (car.dir + 3) % 4; // left
    if (newDir !== car.dir) {
      car.dir = newDir;
      car.lastTurnAt = now;
      const nd = DIRS[newDir];
      // Snap onto the new road's lane.
      if (newDir === 0 || newDir === 2) {
        car.y = crossing.line + (newDir === 0 ? 14 : -14);
      } else {
        car.x = crossing.line + (newDir === 1 ? 14 : -14);
      }
      car.angle = Math.atan2(nd.dy, nd.dx);
    }
  }
  car.angle = Math.atan2(d.dy, d.dx);
  const nx = car.x + d.dx * car.speed * dt;
  const ny = car.y + d.dy * car.speed * dt;
  const res = city.collide(nx, ny, CONFIG.car.radius);
  car.x = res.x;
  car.y = res.y;
  if (res.hit) {
    // Bumped into a building at a road end: turn around.
    car.dir = (car.dir + 2) % 4;
    car.lastTurnAt = now;
  }
  // Wrap around the world edges on roads (keeps traffic flowing).
  if (car.x < 60) { car.x = city.w - 80; }
  if (car.x > city.w - 60) { car.x = 80; }
  if (car.y < 60) { car.y = city.h - 80; }
  if (car.y > city.h - 60) { car.y = 80; }
}

function nearestLine(lines, v) {
  let best = lines[0];
  let bestD = Math.abs(v - lines[0]);
  for (const l of lines) {
    const d = Math.abs(v - l);
    if (d < bestD) { bestD = d; best = l; }
  }
  return { line: best, dist: bestD };
}

// --- Police pursuit: steer straight at the target, ramming it ---
export function updatePoliceCar(car, target, dt, city) {
  const cfg = CONFIG.car;
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
  const d = dist(car.x, car.y, target.x, target.y);
  const desired = d > 320 ? CONFIG.police.carSpeed : CONFIG.police.carSpeed * 0.82;
  car.speed += clamp(desired - car.speed, -500 * dt, 420 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const res = city.collide(nx, ny, cfg.radius);
  if (res.hit) car.speed *= 0.5;
  car.x = res.x;
  car.y = res.y;
}

// Push overlapping cars apart; returns pairs that crashed hard.
export function carCarCollisions(cars, game) {
  const crashes = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 200) crashes.push([a, b]);
        a.speed *= 0.92;
        b.speed *= 0.92;
      }
    }
  }
  return crashes;
}

export function carColorHex(car) {
  return car.color;
}
