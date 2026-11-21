# Solmar Bay

[![make.fun competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/stevewhy404/gta6-01-rebuild2/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/stevewhy404/gta6-01-rebuild2/reward.svg)](https://make.fun/bounty/gta6-01)

A top-down open-world crime game set in Solmar Bay, a fictional coastal city.
You are Rio "Rook" Vance, a driver who came back to town with nothing but a name
and a debt. Fixer Mara Solis has work — five jobs, from a stolen car to the
Meridian Bank vault. Steal cars, lose the heat, settle the Viper crew, and run
this town.

[Play it on make.fun](https://make.fun/bounty/gta6-01)

## How to play

Serve the `game/` folder with any static server and open `index.html` — the
game runs entirely offline, no downloads, no requests, plain canvas and
vanilla JavaScript.

```
python3 -m http.server -d game 8080
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot / drive |
| Shift | Run |
| E | Enter / exit a car · hold E to crack the vault |
| Space | Handbrake |
| F or left click | Punch |
| Left click (with pistol) | Shoot — aim with the mouse |
| Esc | Pause |
| M | Mute |

## The five jobs

1. **First Wheels** — Steal a car and bring it to Mara's Garage. ($300)
2. **Bayview Courier** — Pick up a package at the docks and deliver it to the
   Meridian Hotel in 90 seconds. ($500)
3. **Heat Wave** — You start with three wanted stars. Reach Splash Paint and
   get clean. ($400)
4. **Dockside Dispute** — Take down six Viper rivals at the docks. ($800)
5. **The Meridian Score** — Crack the Meridian Bank vault, then escape to the
   Safehouse with three stars on your tail. ($2,000)

## Systems

- **A living city** — 3,400 × 3,400 px of roads, downtown towers, parks, a
  beach and a harbour. Traffic cars follow the roads and turn at
  intersections; pedestrians stroll the sidewalks and flee from gunfire and
  speeding cars.
- **Driving** — Acceleration, braking, handbrake turns, car damage and
  wrecks. Any car on the street can be taken — the driver will not thank you.
- **Wanted level** — Crime raises your stars (0–5). Police cars chase and ram
  you; foot cops try to arrest you. Hide to let the heat decay, or pay $200
  at Splash Paint for a clean car.
- **Combat** — Fists and a pistol (Mara gives you one after the second job).
  Bullets, muzzle sparks, smoke and skid particles. No gore — hits burst
  into stars.
- **HUD and minimap** — Cash, health, wanted stars, the current objective,
  speed, and a live minimap with police blips and the mission marker.
- **Save** — Progress, cash and jobs completed save to localStorage, so you
  can continue later. Getting busted or wasted costs a fee and drops you at
  the police station or the hospital.
- **Sound** — Synthesised WebAudio: engine hum, sirens, gunshots, jingles.
  No audio files, nothing downloaded.

## Structure

```
game/
  index.html        menus, canvas, HUD shell
  src/
    config.js       every tunable number, colour and name
    util.js         math and formatting helpers
    audio.js        WebAudio sound engine
    input.js        keyboard + mouse
    city.js         the city: roads, buildings, beach, docks, collisions
    vehicles.js     player driving, traffic, police pursuit
    peds.js         pedestrians
    police.js       wanted stars, police cars, foot cops
    combat.js       bullets, particles, melee
    missions.js     the five jobs and the rival crew
    render.js       world, entities, HUD, minimap
    main.js         the game: state machine, loop, save/load
main.ts             hand-in program: copies game/ + screenshots/ to /output
                    and writes dossier.json
screenshots/       four real in-game shots (first is the cover)
```

All art, names and story are original, drawn in code. No third-party assets.

---

Built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).
Referral: `qnz0c663`
