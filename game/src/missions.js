// Solmar Bay — missions.js
// One job: the story. Five jobs from fixer Mara Solis, each a chain of
// objectives, plus the rival crew that fights back in mission four.

import { angleTo, dist } from './util.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: "Mara: Rook, you want work, you need wheels. Take any car on the street — nobody here locks theirs — and bring it to my garage.",
    reward: 300,
    steps: [
      { kind: 'inCar', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', place: 'garage', radius: 80, text: "Drive to Mara's Garage" },
    ],
  },
  {
    id: 'courier',
    title: 'Bayview Courier',
    briefing: "Mara: A package is waiting at the docks. Pick it up and get it to the Meridian Hotel. The buyer does not wait — ninety seconds, Rook.",
    reward: 500,
    steps: [
      { kind: 'goto', place: 'docks', radius: 80, text: 'Pick up the package at Solmar Docks' },
      { kind: 'timedGoto', place: 'hotel', radius: 80, time: 90, text: 'Deliver to the Meridian Hotel — fast!' },
    ],
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    briefing: "Mara: You ratted out a rival crew and now the whole precinct wants you. Three stars, Rook. Get to Splash Paint and get that car clean — or ditch it and run.",
    reward: 400,
    steps: [
      { kind: 'goto', place: 'paint', radius: 80, text: 'Reach Splash Paint and lose the heat', wantedAtStart: 3 },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Dispute',
    briefing: "Mara: The Vipers think the docks are theirs. Go down there and change their minds. Six of them, Rook. Fists or iron — your call.",
    reward: 800,
    steps: [
      { kind: 'goto', place: 'docks', radius: 100, text: 'Get to Solmar Docks' },
      { kind: 'defeat', count: 6, text: 'Take down the Viper crew (0/6)' },
    ],
  },
  {
    id: 'score',
    title: 'The Meridian Score',
    briefing: "Mara: This is the big one. The Meridian Bank vault, Friday night, thin crew. Crack it, grab the cash, and get to the safehouse before the city wakes up.",
    reward: 2000,
    steps: [
      { kind: 'goto', place: 'bank', radius: 80, text: 'Get to the Meridian Bank' },
      { kind: 'hold', place: 'bank', radius: 60, hold: 3, text: 'Crack the vault — hold E' },
      { kind: 'goto', place: 'safehouse', radius: 90, text: 'Escape to the Safehouse', wantedAtStart: 3 },
    ],
  },
];

export class Rival {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.hp = 100;
    this.alive = true;
    this.angle = 0;
    this.speed = 150;
    // Stagger the first punch so six rivals do not all hit on the same frame.
    this.punchAt = -Math.random() * 1.3;
  }
}

export class MissionManager {
  constructor() {
    this.index = 0; // next mission to start
    this.active = null; // mission object currently running
    this.step = 0;
    this.timer = 0;
    this.count = 0;
    this.holdProgress = 0;
    this.done = 0; // missions completed
    this.failed = null;
  }

  get current() {
    return this.active;
  }

  get stepDef() {
    if (!this.active) return null;
    return this.active.steps[this.step] || null;
  }

  get finished() {
    return this.index >= MISSIONS.length;
  }

  // The marker the player must reach to start the next mission (Mara's garage).
  startMarker() {
    if (this.finished || this.active) return null;
    return 'garage';
  }

  startNext() {
    if (this.finished || this.active) return null;
    this.active = MISSIONS[this.index];
    this.step = 0;
    this.timer = 0;
    this.count = 0;
    this.holdProgress = 0;
    this.failed = null;
    return this.active;
  }

  onRivalDown() {
    if (this.active && this.stepDef && this.stepDef.kind === 'defeat') {
      this.count += 1;
    }
  }

  // S: {inCar, x, y, holdingE, now}. Returns an event string or null.
  // Events: 'step' (step completed), 'done' (mission complete), 'failed' (reason in this.failed).
  update(dt, S, places) {
    if (!this.active) return null;
    const step = this.stepDef;
    if (!step) return null;
    if (step.kind === 'inCar') {
      if (S.inCar) return this._advance();
    } else if (step.kind === 'goto' || step.kind === 'timedGoto') {
      if (step.kind === 'timedGoto') {
        if (this.timer <= 0) this.timer = step.time;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.failed = 'Too slow — the buyer walked away.';
          return 'failed';
        }
      }
      const p = places[step.place];
      if (p && dist(S.x, S.y, p.x, p.y) < step.radius) return this._advance();
    } else if (step.kind === 'defeat') {
      if (this.count >= step.count) return this._advance();
    } else if (step.kind === 'hold') {
      const p = places[step.place];
      if (p && dist(S.x, S.y, p.x, p.y) < step.radius && S.holdingE) {
        this.holdProgress += dt;
        if (this.holdProgress >= step.hold) return this._advance();
      } else {
        this.holdProgress = Math.max(0, this.holdProgress - dt * 2);
      }
    }
    return null;
  }

  _advance() {
    this.step += 1;
    this.timer = 0;
    this.holdProgress = 0;
    if (this.step >= this.active.steps.length) {
      const done = this.active;
      this.active = null;
      this.index += 1;
      this.done += 1;
      return 'done';
    }
    return 'step';
  }

  abort() {
    this.active = null;
    this.step = 0;
    this.timer = 0;
    this.count = 0;
    this.holdProgress = 0;
  }

  // Objective text for the HUD.
  objectiveText(places) {
    if (!this.active) {
      if (this.finished) return 'All jobs done — Solmar Bay is yours, Rook.';
      return 'Drive to the M marker — Mara has work.';
    }
    const step = this.stepDef;
    if (!step) return '';
    let text = step.text;
    if (step.kind === 'defeat') text = `Take down the Viper crew (${this.count}/${step.count})`;
    if (step.kind === 'timedGoto') text += ` — ${Math.ceil(this.timer)}s left`;
    if (step.kind === 'hold' && this.holdProgress > 0) {
      text += ` — ${Math.round((this.holdProgress / step.hold) * 100)}%`;
    }
    return text;
  }

  // World position of the current objective (for the marker + minimap).
  marker(places) {
    if (!this.active) {
      const sm = this.startMarker();
      return sm ? { ...places[sm], label: 'M' } : null;
    }
    const step = this.stepDef;
    if (!step || !step.place) return null;
    const p = places[step.place];
    return p ? { ...p, label: '!' } : null;
  }
}

// Rival crew AI: walk at the player, punch when close.
// Returns damage dealt to the player this frame (0 if none).
export function updateRivals(rivals, player, dt, city, now) {
  let dmg = 0;
  for (const r of rivals) {
    if (!r.alive) continue;
    const d = dist(r.x, r.y, player.x, player.y);
    if (d > 700) continue;
    const a = angleTo(r.x, r.y, player.x, player.y);
    r.angle = a;
    if (d > 30) {
      const nx = r.x + Math.cos(a) * r.speed * dt;
      const ny = r.y + Math.sin(a) * r.speed * dt;
      const res = city.collide(nx, ny, 11);
      r.x = res.x;
      r.y = res.y;
    } else if (now - r.punchAt > 1.3) {
      r.punchAt = now;
      dmg += 6;
    }
  }
  return dmg;
}

export function spawnRivals(city, places, n) {
  const out = [];
  const dock = places.docks;
  for (let i = 0; i < n; i++) {
    out.push(new Rival(
      dock.x + (Math.random() - 0.5) * 260,
      dock.y + (Math.random() - 0.5) * 260,
    ));
  }
  return out;
}
