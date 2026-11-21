// Solmar Bay — util.js
// One job: small math and collision helpers used by every other module.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed turn from angle a to target b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function randInt(lo, hi) {
  return Math.floor(rand(lo, hi + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Deterministic RNG (mulberry32) so the city layout is stable per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Circle vs axis-aligned box: push the circle out, return true if it hit.
export function collideCircleBox(cx, cy, r, bx, by, bw, bh) {
  const nx = clamp(cx, bx, bx + bw);
  const ny = clamp(cy, by, by + bh);
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * (r - d), y: cy + (dy / d) * (r - d), hit: true };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const left = cx - bx;
  const right = bx + bw - cx;
  const top = cy - by;
  const bottom = by + bh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: bx - r, y: cy, hit: true };
  if (m === right) return { x: bx + bw + r, y: cy, hit: true };
  if (m === top) return { x: cx, y: by - r, hit: true };
  return { x: cx, y: by + bh + r, hit: true };
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
