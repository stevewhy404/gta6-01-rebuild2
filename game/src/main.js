// Solmar Bay — main.js
// One job: the game itself. State machine (menu / playing / paused / over),
// the frame loop, and the wiring between every other module.

import { CONFIG } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Car, makeCar, spawnParkedCar, spawnTrafficCar, updatePlayerCar, updatePoliceCar, updateTrafficCar, carCarCollisions } from './vehicles.js';
import { spawnPed, updatePeds } from './peds.js';
import { FootCop, Wanted, policeQuota, spawnFootCop, spawnPoliceCar, updateFootCops } from './police.js';
import { Bullet, meleeHit, spawnSmoke, spawnSparks, updateBullets, updateParticles } from './combat.js';
import { MISSIONS, MissionManager, spawnRivals, updateRivals } from './missions.js';
import { drawHUD, drawWorld } from './render.js';
import { clamp, dist, fmtMoney, pick, rand } from './util.js';

const SAVE_KEY = 'solmar-bay-save-v1';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.city = new City(20261121);
    this.missions = new MissionManager();
    this.wanted = new Wanted();
    this.state = 'menu'; // menu | playing | paused | over
    this.time = 0;
    this.clock = 0;
    this.cam = { x: 1700, y: 1700 };
    this.player = null;
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.rivals = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.message = null;
    this.hurtFlash = 0;
    this.overKind = null;
    this.lastDamageAt = -99;
    this.lastShotAt = -99;
    this.danger = null;
    this.paintCooldown = 0;
    this._markerScreen = null;
    this.menuPan = 0;
    this.resetWorld();
    this._wireMenu();
    this._last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  resetWorld() {
    const g = this.city.places.garage;
    this.player = {
      x: g.x + 60, y: g.y + 40, angle: -Math.PI / 2,
      health: 100, cash: CONFIG.money.startCash,
      weapon: 'fists', car: null,
      punchCooldown: 0, punchAnim: 0, shootCooldown: 0,
    };
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.rivals = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.wanted = new Wanted();
    this.missions = new MissionManager();
    this.time = 0;
    this.clock = 0;
    this.hurtFlash = 0;
    this.message = null;
    for (let i = 0; i < CONFIG.traffic.count; i++) this.cars.push(spawnTrafficCar(this.city));
    for (let i = 0; i < 14; i++) this.cars.push(spawnParkedCar(this.city));
    for (let i = 0; i < CONFIG.peds.count; i++) this.peds.push(spawnPed(this.city));
    for (let i = 0; i < 4; i++) this._spawnPickup();
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
  }

  _spawnPickup() {
    const p = this.city.randomRoadPoint();
    this.pickups.push({
      x: p.x, y: p.y,
      kind: Math.random() < 0.55 ? 'cash' : 'health',
    });
  }

  // ---- save / load ----
  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        done: this.missions.done,
        weapon: this.player.weapon,
        x: this.player.x, y: this.player.y,
      }));
    } catch (e) { /* storage unavailable: play on without saving */ }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ---- menus (DOM) ----
  _wireMenu() {
    const $ = (id) => document.getElementById(id);
    const save = this.loadSave();
    if (save && save.done > 0) {
      $('continue-btn').style.display = 'block';
      $('continue-btn').textContent = `Continue — ${save.done} job${save.done === 1 ? '' : 's'} done, ${fmtMoney(save.cash)}`;
    }
    $('new-btn').addEventListener('click', () => this.startGame(true));
    $('continue-btn').addEventListener('click', () => this.startGame(false));
    $('resume-btn').addEventListener('click', () => this.togglePause());
    $('quit-btn').addEventListener('click', () => this.toMenu());
    $('respawn-btn').addEventListener('click', () => this.respawn());
    $('mute-btn').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      $('mute-btn').textContent = this.audio.muted ? 'Sound: Off' : 'Sound: On';
    });
    $('menu').style.display = 'flex';
  }

  _show(id) {
    for (const el of ['menu', 'pause', 'over']) {
      document.getElementById(el).style.display = el === id ? 'flex' : 'none';
    }
  }

  startGame(fresh) {
    this.audio.ensure();
    this.audio.click();
    if (fresh) {
      this.resetWorld();
    } else {
      const save = this.loadSave();
      this.resetWorld();
      if (save) {
        this.player.cash = save.cash;
        this.player.weapon = save.weapon || 'fists';
        this.player.x = save.x;
        this.player.y = save.y;
        this.missions.done = save.done;
        this.missions.index = save.done;
      }
    }
    this.state = 'playing';
    this._show(null);
    this.showMessage('SOLMAR BAY', 'Mara has work — drive to the M marker.', '#ffd93c', 4);
    this.audio.missionStart();
  }

  toMenu() {
    this.state = 'menu';
    this.saveGame();
    this._show('menu');
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this._show('pause');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this._show(null);
      this.audio.ensure();
    }
  }

  respawn() {
    const fee = this.overKind === 'busted' ? CONFIG.money.bustFee : CONFIG.money.hospitalFee;
    this.player.cash = Math.max(0, this.player.cash - fee);
    const spot = this.overKind === 'busted' ? this.city.places.station : this.city.places.hospital;
    this.player.x = spot.x + 40;
    this.player.y = spot.y + 40;
    this.player.health = 100;
    this.player.car = null;
    this.wanted = new Wanted();
    this.cops = [];
    this.cars = this.cars.filter((c) => c.driver !== 'police');
    this.missions.abort();
    this.state = 'playing';
    this._show(null);
    this.showMessage(this.overKind === 'busted' ? 'BUSTED' : 'WASTED', `You lost ${fmtMoney(fee)}. Mara is waiting at the garage.`, '#e74c3c', 4);
  }

  showMessage(text, sub, color, secs) {
    this.message = { text, sub: sub || '', color: color || '#ffd93c', until: this.time + (secs || 3) };
  }

  gameOver(kind) {
    this.overKind = kind;
    this.state = 'over';
    this.audio.fail();
    const fee = kind === 'busted' ? CONFIG.money.bustFee : CONFIG.money.hospitalFee;
    document.getElementById('over-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    document.getElementById('over-text').textContent =
      kind === 'busted'
        ? `The Bay PD hauled you in. Bail costs ${fmtMoney(fee)}.`
        : `You woke up at Bay General. The bill is ${fmtMoney(fee)}.`;
    this._show('over');
  }

  // ---- frame loop ----
  _frame(t) {
    const dt = clamp((t - this._last) / 1000, 0, 0.05);
    this._last = t;
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'paused') {
      // Esc is the only input the paused screen listens for (update() is
      // not running while paused, so the key would otherwise be lost).
      if (this.input.justPressed('Escape')) this.togglePause();
    } else if (this.state === 'menu') {
      this.menuPan += dt * 24;
      this.cam.x = 1700 + Math.sin(this.menuPan / 240) * 500;
      this.cam.y = 1700 + Math.cos(this.menuPan / 300) * 400;
      this.time += dt;
      updateParticles(this.particles, dt);
    }
    this.render();
    this.input.endFrame();
    requestAnimationFrame((nt) => this._frame(nt));
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
    drawWorld(ctx, this);
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'over') {
      drawHUD(ctx, this);
    }
  }

  // ---- update ----
  update(dt) {
    this.time += dt;
    this.clock += dt;
    const p = this.player;
    const input = this.input;

    if (input.justPressed('Escape')) { this.togglePause(); return; }
    if (input.justPressed('KeyM')) {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
    }

    // Aim: mouse position in world space (pistol) or movement direction.
    const mx = this.input.mouse.x + (this.cam.x - CONFIG.canvas.w / 2);
    const my = this.input.mouse.y + (this.cam.y - CONFIG.canvas.h / 2);
    if (p.weapon === 'pistol' && !p.car) {
      p.angle = Math.atan2(my - p.y, mx - p.x);
    }

    if (p.car) this._updateDriving(dt);
    else this._updateOnFoot(dt, mx, my);

    // Traffic + pedestrians.
    for (const car of this.cars) {
      if (car.driver === 'traffic') updateTrafficCar(car, dt, this.city, this.cars);
      else if (car.driver === 'police') updatePoliceCar(car, p, dt, this.city);
    }
    const danger = this.danger && this.clock - this.danger.at < 1.2 ? this.danger : null;
    updatePeds(this.peds, dt, this.city, danger, p.car);
    // Keep the streets full.
    if (this.cars.filter((c) => c.driver === 'traffic').length < CONFIG.traffic.count) {
      const c = spawnTrafficCar(this.city);
      if (dist(c.x, c.y, p.x, p.y) > 500) this.cars.push(c);
    }
    if (this.peds.filter((x) => x.state !== 'down').length < CONFIG.peds.count) {
      const ped = spawnPed(this.city);
      if (dist(ped.x, ped.y, p.x, p.y) > 400) this.peds.push(ped);
    }
    if (this.pickups.length < 5 && Math.random() < dt * 0.08) this._spawnPickup();

    this._updatePolice(dt);
    this._updateCombat(dt);
    this._updateMissions(dt);
    this._updatePickups();
    this._updatePaintShop(dt);

    // Car-car crashes.
    const crashes = carCarCollisions(this.cars, this);
    for (const [a, b] of crashes) {
      spawnSparks(this.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffb347', 10);
      if (a.driver === 'player' || b.driver === 'player') {
        this.audio.crash();
        this._damagePlayer(6);
        const pc = a.driver === 'player' ? a : b;
        pc.health -= 12;
      }
    }
    // Player car running over pedestrians.
    if (p.car) {
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        if (dist(ped.x, ped.y, p.car.x, p.car.y) < 26 && Math.abs(p.car.speed) > 80) {
          ped.state = 'down';
          spawnSparks(this.particles, ped.x, ped.y, '#ffd93c', 12);
          this.wanted.addCrime(1, this.clock);
          this.audio.crash();
          this.showMessage('PEDESTRIAN DOWN', 'The cops saw that.', '#e74c3c', 2);
        }
      }
    }
    // Health regen after 8 quiet seconds.
    if (this.clock - this.lastDamageAt > 8 && p.health > 0 && p.health < 100) {
      p.health = Math.min(100, p.health + 2.5 * dt);
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // Camera follows the player.
    const tx = clamp(p.x, CONFIG.canvas.w / 2, this.city.w - CONFIG.canvas.w / 2);
    const ty = clamp(p.y, CONFIG.canvas.h / 2, this.city.h - CONFIG.canvas.h / 2);
    this.cam.x += (tx - this.cam.x) * clamp(dt * 5, 0, 1);
    this.cam.y += (ty - this.cam.y) * clamp(dt * 5, 0, 1);

    // Engine + siren audio.
    this.audio.engine(p.car ? Math.abs(p.car.speed) / p.car.top : 0, !!p.car);
    const anySiren = this.cars.some((c) => c.driver === 'police');
    this.audio.siren(anySiren, dt);

    // Wasted?
    if (p.health <= 0) this.gameOver('wasted');
  }

  _updateOnFoot(dt, mx, my) {
    const p = this.player;
    const input = this.input;
    const run = input.down('ShiftLeft', 'ShiftRight');
    const sp = run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    const mxv = input.moveX();
    const myv = input.moveY();
    if (mxv !== 0 || myv !== 0) {
      const len = Math.hypot(mxv, myv);
      const nx = p.x + (mxv / len) * sp * dt;
      const ny = p.y + (myv / len) * sp * dt;
      const res = this.city.collide(nx, ny, CONFIG.player.radius);
      p.x = res.x;
      p.y = res.y;
      if (p.weapon === 'fists') p.angle = Math.atan2(myv, mxv);
    }
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.punchAnim = Math.max(0, p.punchAnim - dt * 2.4);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);

    // Enter a car.
    if (input.justPressed('KeyE')) {
      let best = null;
      let bestD = 60;
      for (const car of this.cars) {
        if (car.driver === 'player' || car.driver === 'police') continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) this._enterCar(best);
    }
    // Punch (F or left click with fists).
    if (input.justPressed('KeyF') || (input.mouse.clicked && p.weapon === 'fists')) {
      this._punch();
    }
    // Shoot (left click with pistol).
    if (input.mouse.down && p.weapon === 'pistol' && p.shootCooldown <= 0) {
      p.shootCooldown = 0.22;
      const a = Math.atan2(my - p.y, mx - p.x);
      this.bullets.push(new Bullet(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a));
      this.audio.shot();
      this.lastShotAt = this.clock;
      this.danger = { x: p.x, y: p.y, radius: 320, at: this.clock };
      if (this.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 600)) {
        this.wanted.addCrime(1, this.clock);
      }
    }
    // Start a mission at Mara's garage.
    const start = this.missions.startMarker();
    if (start) {
      const pl = this.city.places[start];
      if (dist(p.x, p.y, pl.x, pl.y) < 80) {
        const m = this.missions.startNext();
        if (m) {
          this.showMessage(m.title.toUpperCase(), m.briefing, '#ffd93c', 6);
          this.audio.missionStart();
          this._applyStepSideEffects();
        }
      }
    }
  }

  _enterCar(car) {
    const p = this.player;
    if (car.driver === 'traffic') {
      // Shove the driver out: they become a fleeing pedestrian.
      this.peds.push(Object.assign(spawnPed(this.city), { x: car.x + 30, y: car.y + 30, state: 'flee', fleeUntil: performance.now() / 1000 + 4 }));
      this.wanted.addCrime(1, this.clock);
      this.showMessage('CAR JACKED', 'That was somebody\'s ride.', '#e74c3c', 2);
    }
    car.driver = 'player';
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    this.audio.click();
  }

  _updateDriving(dt) {
    const p = this.player;
    const input = this.input;
    const car = p.car;
    const res = updatePlayerCar(car, {
      throttle: input.down('KeyW', 'ArrowUp') ? 1 : input.down('KeyS', 'ArrowDown') ? -1 : 0,
      steer: input.down('KeyD', 'ArrowRight') ? 1 : input.down('KeyA', 'ArrowLeft') ? -1 : 0,
      brake: input.down('Space'),
    }, dt, this.city);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (res === 'crash') {
      this.audio.crash();
      spawnSparks(this.particles, car.x, car.y, '#ffb347', 10);
      car.health -= 14;
      this._damagePlayer(5);
    }
    if (car.health <= 0) {
      spawnSmoke(this.particles, car.x, car.y, 16);
      this.audio.crash();
      this.showMessage('CAR WRECKED', 'That ride is done.', '#e74c3c', 3);
      p.car = null;
      this.cars = this.cars.filter((c) => c !== car);
      p.x = car.x + 40;
      p.y = car.y + 40;
    }
    if (input.justPressed('KeyE')) {
      // Exit the car.
      p.car = null;
      car.driver = 'parked';
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      const r2 = this.city.collide(p.x, p.y, CONFIG.player.radius);
      p.x = r2.x;
      p.y = r2.y;
    }
    // Driving into the M marker starts the next job too (classic
    // drive-through pickup — the player may finish a job in the car).
    const start = this.missions.startMarker();
    if (start) {
      const pl = this.city.places[start];
      if (dist(p.x, p.y, pl.x, pl.y) < 80) {
        const m = this.missions.startNext();
        if (m) {
          this.showMessage(m.title.toUpperCase(), m.briefing, '#ffd93c', 6);
          this.audio.missionStart();
          this._applyStepSideEffects();
        }
      }
    }
  }

  _punch() {
    const p = this.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = CONFIG.player.punchCooldown;
    p.punchAnim = 1;
    this.audio.punch();
    const hits = meleeHit(p.x, p.y, p.angle, CONFIG.player.punchRange, {
      peds: this.peds, cops: this.cops, rivals: this.rivals, particles: this.particles,
    });
    for (const h of hits) {
      if (h.kind === 'ped') {
        this.wanted.addCrime(1, this.clock);
        this.showMessage('PEDESTRIAN DOWN', 'The cops saw that.', '#e74c3c', 2);
      } else if (h.kind === 'cop') {
        this.wanted.addCrime(2, this.clock);
        this.showMessage('YOU HIT A COP', 'That was a bad idea.', '#e74c3c', 2);
      } else if (h.kind === 'rivalDown') {
        this.missions.onRivalDown();
      }
    }
  }

  _updatePolice(dt) {
    const p = this.player;
    const quota = policeQuota(this.wanted.stars);
    const policeCars = this.cars.filter((c) => c.driver === 'police');
    const policeNear = policeCars.some((c) => dist(c.x, c.y, p.x, p.y) < 700)
      || this.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 700);
    this.wanted.update(this.clock, policeNear);
    // Spawn up to quota.
    if (this.wanted.stars > 0) {
      if (policeCars.length < quota.cars && Math.random() < dt * 1.2) {
        this.cars.push(spawnPoliceCar(this.city, p));
      }
      if (this.cops.length < quota.foot && !p.car && Math.random() < dt * 1.0) {
        this.cops.push(spawnFootCop(this.city, p));
      }
    } else {
      // Heat gone: police give up and drive off.
      this.cars = this.cars.filter((c) => c.driver !== 'police' || dist(c.x, c.y, p.x, p.y) < 900);
      if (this.cops.length > 0 && Math.random() < dt) this.cops.pop();
    }
    // Foot cops arrest.
    if (this.wanted.stars > 0 && !p.car) {
      const res = updateFootCops(this.cops, p, dt, this.city);
      if (res === 'busted') this.gameOver('busted');
    }
    // Police cars ram the player.
    for (const car of policeCars) {
      if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < 40) {
        p.car.health -= 6 * dt * 10;
        this._damagePlayer(2 * dt * 10);
      }
    }
  }

  _updateCombat(dt) {
    const p = this.player;
    updateBullets(this.bullets, dt, {
      city: this.city, peds: this.peds, cops: this.cops, rivals: this.rivals,
      cars: this.cars, player: p, particles: this.particles,
      onPedHit: () => {
        this.wanted.addCrime(1, this.clock);
        this.showMessage('PEDESTRIAN DOWN', 'The cops saw that.', '#e74c3c', 2);
      },
      onCopHit: () => {
        this.wanted.addCrime(2, this.clock);
        this.showMessage('YOU SHOT A COP', 'Five stars incoming.', '#e74c3c', 2);
      },
      onRivalDown: () => this.missions.onRivalDown(),
    });
    updateParticles(this.particles, dt);
    // Rivals fight back.
    if (this.rivals.length > 0) {
      const dmg = updateRivals(this.rivals, p, dt, this.city, this.clock);
      if (dmg > 0) {
        this._damagePlayer(dmg);
        spawnSparks(this.particles, p.x, p.y, '#ff6b6b', 6);
      }
      this.rivals = this.rivals.filter((r) => r.alive || Math.random() < 0.5);
    }
  }

  _updateMissions(dt) {
    const p = this.player;
    const ev = this.missions.update(dt, {
      inCar: !!p.car,
      x: p.x, y: p.y,
      holdingE: this.input.down('KeyE'),
      now: this.clock,
    }, this.city.places);
    if (ev === 'step') {
      this.audio.click();
      this._applyStepSideEffects();
    } else if (ev === 'done') {
      const m = this.missions;
      const reward = MISSIONS[Math.max(0, m.index - 1)].reward;
      p.cash += reward;
      this.audio.missionDone();
      this.showMessage('JOB COMPLETE', `Mara paid ${fmtMoney(reward)}.`, '#7ee787', 4);
      this.saveGame();
      if (m.done === 2 && p.weapon === 'fists') {
        p.weapon = 'pistol';
        this.showMessage('NEW WEAPON', 'Mara gave you a pistol. Click to shoot.', '#ffd93c', 4);
      }
      if (m.finished) {
        this.showMessage('SOLMAR BAY IS YOURS', 'Every job done. Rook runs this town now.', '#7ee787', 6);
      }
    } else if (ev === 'failed') {
      this.audio.fail();
      this.showMessage('JOB FAILED', this.missions.failed || 'Try again.', '#e74c3c', 4);
      this.missions.abort();
    }
  }

  _applyStepSideEffects() {
    const step = this.missions.stepDef;
    if (!step) return;
    if (step.wantedAtStart) {
      this.wanted.stars = step.wantedAtStart;
      this.wanted.lastCrimeAt = this.clock;
    }
    if (step.kind === 'defeat') {
      this.rivals = spawnRivals(this.city, this.city.places, step.count);
      this.showMessage('VIPER CREW', 'They are coming for you.', '#e74c3c', 3);
    }
    if (step.kind === 'hold') {
      this.showMessage('CRACK THE VAULT', 'Hold E at the bank doors.', '#ffd93c', 3);
    }
  }

  _updatePickups() {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (dist(p.x, p.y, pk.x, pk.y) < 28) {
        if (pk.kind === 'cash') {
          p.cash += 50;
          this.audio.cash();
          spawnSparks(this.particles, pk.x, pk.y, '#7ee787', 8);
        } else {
          p.health = Math.min(100, p.health + 30);
          this.audio.pickup();
          spawnSparks(this.particles, pk.x, pk.y, '#fff', 8);
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  _updatePaintShop(dt) {
    this.paintCooldown = Math.max(0, this.paintCooldown - dt);
    const p = this.player;
    if (!p.car || this.wanted.stars === 0 || this.paintCooldown > 0) return;
    const pl = this.city.places.paint;
    if (dist(p.x, p.y, pl.x, pl.y) < 80) {
      if (p.cash >= CONFIG.wanted.paintPrice) {
        p.cash -= CONFIG.wanted.paintPrice;
        this.wanted.stars = 0;
        this.cars = this.cars.filter((c) => c.driver !== 'police');
        this.cops = [];
        this.audio.cash();
        this.showMessage('CLEAN RIDE', 'New paint, no heat. That will be $200.', '#7ee787', 3);
        this.paintCooldown = 5;
      } else {
        this.showMessage('SPLASH PAINT', 'A repaint costs $200 — you are short.', '#e74c3c', 3);
        this.paintCooldown = 5;
      }
    }
  }

  _damagePlayer(amount) {
    const p = this.player;
    if (amount <= 0) return;
    p.health -= amount;
    this.lastDamageAt = this.clock;
    this.hurtFlash = 0.5;
  }

  // ---- screenshot scenes (?scene=street|drive|chase|mission) ----
  applyScene(name) {
    const p = this.player;
    const places = this.city.places;
    if (name === 'drive') {
      const car = makeCar(1000, 1400, 0, 'sports', 'player');
      this.cars.push(car);
      p.car = car;
      p.x = car.x; p.y = car.y;
      car.speed = 420;
      this.missions.startNext();
    } else if (name === 'chase') {
      const car = makeCar(1000, 1800, 0, 'sedan', 'player');
      this.cars.push(car);
      p.car = car;
      p.x = car.x; p.y = car.y;
      car.speed = 380;
      this.wanted.stars = 3;
      this.wanted.lastCrimeAt = this.clock;
      for (let i = 0; i < 3; i++) this.cars.push(spawnPoliceCar(this.city, p));
      this.missions.startNext();
      this.missions.step = 0;
    } else if (name === 'mission') {
      p.x = places.docks.x + 300;
      p.y = places.docks.y + 40;
      p.weapon = 'pistol';
      this.missions.index = 3;
      this.missions.startNext();
      this.missions.step = 1;
      this._applyStepSideEffects();
    } else {
      // street: on foot at a busy intersection, mission 1 live.
      p.x = 1800;
      p.y = 1800;
      this.missions.startNext();
    }
    this.cam.x = p.x;
    this.cam.y = p.y;
  }
}
