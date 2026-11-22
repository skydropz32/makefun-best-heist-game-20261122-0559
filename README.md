# makefun-best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/skydropz32/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/skydropz32/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

The Gilded Vault — a stealth heist game built for the make.fun bounty **best-heist-game-20261122-0559**: steal at least **$8,000** of loot from the museum's three galleries, then slip out the GETAWAY door — without letting the alarm hit 100% or a guard catch you.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in a desktop browser
# (or open game/index.html directly — no network needed)
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=a7j4d7yw&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>

## How to play

Open `game/index.html` in a desktop browser (or serve the folder: `node serve.ts`, then
http://localhost:8080). No network needed; all art is drawn on canvas, all sound is
synthesised with WebAudio.

- **WASD / arrows** — move
- **Shift** — sneak (slower, harder to spot)
- **E (hold)** — pocket loot, crack the vault safe, hack a camera panel
- **Click** — toss a coin as a decoy (guards investigate the clink)
- **P / Esc** — pause · **M** — mute

## The museum

- **West Gallery, Vault Hall, East Gallery** — three rooms joined by guarded doors; the only
  way east runs through the vault antechamber.
- **3 guards** (Rook, Bishop, Knight) patrol with yellow vision cones — suspicion builds when
  they see you, they investigate noises, and they chase when sure.
- **2 cameras** sweep red cones; hack their wall panels to shut one down for 25 seconds.
- **8 loot targets** ($18,000 in all): paintings, gem cases and the $5,000 vault safe.
- **Alarm meter** — rises while you are seen, falls while you hide. At 100% the museum locks
  down. Finish with a rating: GHOST, SHADOW or LOUD.

## Screenshots

`1-start.jpg` (cover: guard cone, camera cone, loot and the alarm meter in one frame),
`2-play.jpg` (cracking the safe), `3-alarm.jpg` (the getaway goes loud), `4-end.jpg`
(clean getaway). All four are real renders of the game's own code (`?shot=start|play|alarm|end`).

## Files

- `main.ts` — hands `game/` + `screenshots/` to the grader and builds `dossier.json`
- `game/index.html`, `game/src/` — the game (config, world sim, renderer, audio, input, shots)
- `vendor/makefun-game.ts` — the make.fun library, unchanged
- `shots.json` — the four screenshot scenes

License: MIT.
