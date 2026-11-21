// Solmar Bay — render.js
// One job: everything the player sees. The world, every entity, the HUD
// (cash, health, wanted stars, objective) and the minimap.

import { CONFIG, PALETTE } from './config.js';
import { clamp, fmtMoney, fmtTime } from './util.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, g) {
  const city = g.city;
  const cam = g.cam;
  const W = CONFIG.canvas.w;
  const H = CONFIG.canvas.h;
  const vx0 = cam.x - W / 2 - 60;
  const vy0 = cam.y - H / 2 - 60;
  const vx1 = cam.x + W / 2 + 60;
  const vy1 = cam.y + H / 2 + 60;
  ctx.save();
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);

  // Ground: grass everywhere, then beach, water, docks concrete.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vx0, Math.max(vy0, city.beach.y), vx1 - vx0, city.beach.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(vx0, Math.max(vy0, 3280), vx1 - vx0, 120);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(vx0, Math.max(vy0, 3340), vx1 - vx0, 60);
  ctx.fillStyle = PALETTE.dock;
  ctx.fillRect(city.docks.x, vy0, city.docks.w, vy1 - vy0);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 3300; y < 3400; y += 24) {
    const off = (g.time * 12 + y) % 60;
    ctx.beginPath();
    ctx.moveTo(vx0 + off, y);
    ctx.lineTo(vx1 - 40 + off * 0.2, y);
    ctx.stroke();
  }

  // Parks and parking lots.
  for (const p of city.parks) {
    if (p.x > vx1 || p.x + p.w < vx0 || p.y > vy1 || p.y + p.h < vy0) continue;
    ctx.fillStyle = p.lot ? '#565d6b' : PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (p.lot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = p.x + 20; x < p.x + p.w - 10; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, p.y + 8);
        ctx.lineTo(x, p.y + 26);
        ctx.stroke();
      }
    }
  }

  // Roads: dark asphalt, lighter sidewalk edge, dashed centre line.
  for (const rx of city.roadsV) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - 52, vy0, 104, vy1 - vy0);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(rx - 42, vy0, 84, vy1 - vy0);
  }
  for (const ry of city.roadsH) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx0, ry - 52, vx1 - vx0, 104);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(vx0, ry - 42, vx1 - vx0, 84);
  }
  ctx.strokeStyle = PALETTE.dash;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(rx, vy0);
    ctx.lineTo(rx, vy1);
    ctx.stroke();
  }
  for (const ry of city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(vx0, ry);
    ctx.lineTo(vx1, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings: drop shadow, roof, windows, downtown height shading.
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + b.height * 0.4, b.y + b.height * 0.4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 8 + i * 26, b.y + 14 + j * 26, 12, 10);
      }
    }
  }

  // Trees and lamps.
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#37474f';
  for (const l of city.lamps) {
    if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }

  // Place labels.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.places)) {
    const p = city.places[key];
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(p.name).width + 12;
    rr(ctx, p.x - tw / 2, p.y - 34, tw, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, p.x, p.y - 20);
  }

  // Pickups (cash bags, health kits).
  for (const pk of g.pickups) {
    if (pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
    const bob = Math.sin(g.time * 3 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#27ae60';
      rr(ctx, -9, -7, 18, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('$', 0, 4);
    } else {
      ctx.fillStyle = '#fff';
      rr(ctx, -9, -9, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    }
    ctx.restore();
  }

  drawCars(ctx, g);
  drawPeds(ctx, g);
  drawCops(ctx, g);
  drawRivals(ctx, g);
  drawPlayer(ctx, g);
  drawBullets(ctx, g);
  drawParticles(ctx, g);

  // Objective marker (pulsing ring + letter).
  const marker = g.missions.marker(g.city.places);
  if (marker) {
    const pulse = 1 + Math.sin(g.time * 4) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#ffd93c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,60,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd93c';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(marker.label, 0, 9);
    ctx.restore();
    g._markerScreen = { x: marker.x, y: marker.y };
  } else {
    g._markerScreen = null;
  }

  ctx.restore();
}

function drawCarShape(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  const wl = car.len * 0.32;
  const ww = 7;
  ctx.fillRect(-wl, -car.wid / 2 - 3, 12, ww);
  ctx.fillRect(wl - 12, -car.wid / 2 - 3, 12, ww);
  ctx.fillRect(-wl, car.wid / 2 - 4, 12, ww);
  ctx.fillRect(wl - 12, car.wid / 2 - 4, 12, ww);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(20,40,60,0.85)';
  rr(ctx, -car.len * 0.12, -car.wid / 2 + 4, car.len * 0.24, car.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, -car.len * 0.42, -car.wid / 2 + 4, car.len * 0.2, car.wid - 8, 4);
  ctx.fill();
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 4; i++) ctx.fillRect(-car.len / 2 + 6 + i * 10, -3, 5, 6);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 3, car.len - 8, 5);
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
    rr(ctx, -8, -car.wid / 2 - 5, 16, 7, 3);
    ctx.fill();
    ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
    rr(ctx, -8, car.wid / 2 - 2, 16, 7, 3);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    rr(ctx, -car.len / 2 - 2, -car.wid / 2 - 2, car.len + 4, car.wid + 4, 9);
    ctx.stroke();
  }
  // Damage smoke.
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(-car.len / 2, 0, 6 + Math.sin(performance.now() / 90) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, g) {
  for (const car of g.cars) {
    if (car.driver === 'player' && g.player.car === car) continue;
    drawCarShape(ctx, car, false);
  }
  if (g.player.car) drawCarShape(ctx, g.player.car, true);
}

function drawPerson(ctx, x, y, angle, shirt, skin, scale) {
  const s = scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(4 * s, 0, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(10 * s, 0, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeds(ctx, g) {
  for (const p of g.peds) {
    if (p.state === 'down') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd93c';
      for (let i = 0; i < 3; i++) {
        const a = (performance.now() / 300 + i * 2.1) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 12, -8 + Math.sin(a) * 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.skin, 1);
    }
  }
}

function drawCops(ctx, g) {
  for (const c of g.cops) {
    drawPerson(ctx, c.x, c.y, c.angle, '#1c2f6e', '#f1c27d', 1.05);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = '#1c2f6e';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    if (c.arrest > 0) {
      ctx.fillStyle = '#ff2d2d';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -16);
    }
    ctx.restore();
  }
}

function drawRivals(ctx, g) {
  for (const r of g.rivals) {
    if (!r.alive) continue;
    drawPerson(ctx, r.x, r.y, r.angle, '#7b241c', '#e0ac69', 1.1);
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-14, -24, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-14, -24, 28 * (r.hp / 100), 5);
    ctx.restore();
  }
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.car) return;
  drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, '#f1c27d', 1.15);
  // Aim line when armed.
  if (p.weapon === 'pistol') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 12, 4);
    ctx.restore();
  }
  // Punch swing arc.
  if (p.punchAnim > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = `rgba(255,217,60,${p.punchAnim})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 26, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets(ctx, g) {
  ctx.fillStyle = '#ffd93c';
  for (const b of g.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx, g) {
  const W = CONFIG.canvas.w;
  const H = CONFIG.canvas.h;
  const p = g.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, 12, 12, 230, 88, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(fmtMoney(p.cash), 24, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, 24, 50, 200, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#58d68d' : '#e74c3c';
  rr(ctx, 24, 50, 200 * clamp(p.health / 100, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HEALTH', 24, 78);
  ctx.fillStyle = '#fff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(p.weapon === 'pistol' ? 'PISTOL [F to punch / click to shoot]' : 'FISTS [F to punch]', 24, 94);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, W - 232, 12, 220, 44, 10);
  ctx.fill();
  ctx.font = '24px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < g.wanted.stars ? '#ffd93c' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 214 + i * 40, 44);
  }

  // Top-centre: mission banner.
  const m = g.missions;
  const title = m.active ? m.active.title : (m.finished ? 'SOLMAR BAY' : 'MARA SOLIS');
  const obj = m.objectiveText(g.city.places);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const tw = Math.max(ctx.measureText(title).width, ctx.measureText(obj).width) + 32;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, W / 2 - tw / 2, 12, tw, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd93c';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), W / 2, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(obj, W / 2, 52);
  ctx.textAlign = 'left';

  // Bottom-right: speed + controls hint.
  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, W - 152, H - 64, 140, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.18) + ' km/h', W - 24, H - 32);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('E exit car · Space brake', W - 24, H - 18);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, W - 232, H - 40, 220, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD move · Shift run · E enter car · F punch', W - 24, H - 21);
    ctx.textAlign = 'left';
  }

  // Centre message (mission start / complete / failed).
  if (g.message && g.time < g.message.until) {
    const alpha = clamp((g.message.until - g.time) / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const mw = ctx.measureText(g.message.text).width + 48;
    rr(ctx, W / 2 - mw / 2, H / 2 - 86, mw, 62, 12);
    ctx.fill();
    ctx.fillStyle = g.message.color || '#ffd93c';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(g.message.text, W / 2, H / 2 - 48);
    if (g.message.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(g.message.sub, W / 2, H / 2 - 34);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Off-screen objective arrow.
  const mk = g._markerScreen;
  if (mk) {
    const sx = mk.x - (g.cam.x - W / 2);
    const sy = mk.y - (g.cam.y - H / 2);
    if (sx < 40 || sx > W - 40 || sy < 90 || sy > H - 40) {
      const cx = clamp(sx, 50, W - 50);
      const cy = clamp(sy, 100, H - 50);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd93c';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Hurt flash.
  if (g.hurtFlash > 0) {
    ctx.fillStyle = `rgba(231,76,60,${clamp(g.hurtFlash, 0, 0.22)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawMinimap(ctx, g);
}

function drawMinimap(ctx, g) {
  const size = 190;
  const x0 = 12;
  const y0 = CONFIG.canvas.h - size - 12;
  const s = size / CONFIG.world.w;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#7fae5c';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e9db4';
  ctx.fillRect(x0, y0 + 3280 * s, size, (3400 - 3280) * s);
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(x0, y0 + 3042 * s, size, 238 * s);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 3;
  for (const rx of g.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * s, y0);
    ctx.lineTo(x0 + rx * s, y0 + size);
    ctx.stroke();
  }
  for (const ry of g.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * s);
    ctx.lineTo(x0 + size, y0 + ry * s);
    ctx.stroke();
  }
  // Places.
  ctx.fillStyle = '#fff';
  for (const key of Object.keys(g.city.places)) {
    const pl = g.city.places[key];
    ctx.beginPath();
    ctx.arc(x0 + pl.x * s, y0 + pl.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker.
  const marker = g.missions.marker(g.city.places);
  if (marker) {
    ctx.fillStyle = '#ffd93c';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * s, y0 + marker.y * s, 5 + Math.sin(g.time * 4) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#2d7bff';
  for (const car of g.cars) {
    if (car.driver !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x0 + car.x * s, y0 + car.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of g.cops) {
    ctx.beginPath();
    ctx.arc(x0 + c.x * s, y0 + c.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x0 + g.player.x * s;
  const py = y0 + g.player.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
