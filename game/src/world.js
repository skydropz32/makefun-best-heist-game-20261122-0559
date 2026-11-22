// The game's rules and state, with no drawing and no browser in it: the thief, the patrolling
// guards with vision cones, the sweeping cameras, the loot, the alarm meter and the win/lose
// conditions. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sounds, announcements) without the world knowing about screens or sound.
// Geometry helpers (line of sight, ray casts) live here too, shared with the renderer.
import { CAMERAS, CASES, EXIT, FIELD, GUARDS, LOOT, SPAWN, TARGET_LOOT, TUNING, WALLS } from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_ALERT = 2;
export const EVENT_COIN = 4;
export const EVENT_HACK = 8;
export const EVENT_WIN = 16;
export const EVENT_LOSE = 32;

const TAU = Math.PI * 2;

function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** True when the segment a->b touches any solid wall rect. */
export function losClear(ax, ay, bx, by) {
  for (const w of WALLS) {
    if (segmentHitsRect(ax, ay, bx, by, w)) return false;
  }
  return true;
}

function segmentHitsRect(ax, ay, bx, by, r) {
  // Inside the rect counts as blocked.
  if (ax >= r.x && ax <= r.x + r.w && ay >= r.y && ay <= r.y + r.h) return true;
  const edges = [
    [r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h], [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [cx, cy, dx, dy] of edges) {
    if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return true;
  }
  return false;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const denom = cross(rx, ry, sx, sy);
  if (Math.abs(denom) < 1e-9) return false;
  const t = cross(cx - ax, cy - ay, sx, sy) / denom;
  const u = cross(cx - ax, cy - ay, rx, ry) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Distance from (ox,oy) along `angle` to the nearest wall, capped at maxDist. */
export function rayDistance(ox, oy, angle, maxDist) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = maxDist;
  for (const w of WALLS) {
    const edges = [
      [w.x, w.y, w.x + w.w, w.y], [w.x + w.w, w.y, w.x + w.w, w.y + w.h],
      [w.x + w.w, w.y + w.h, w.x, w.y + w.h], [w.x, w.y + w.h, w.x, w.y],
    ];
    for (const [ax, ay, bx, by] of edges) {
      const sx = bx - ax, sy = by - ay;
      const denom = cross(dx, dy, sx, sy);
      if (Math.abs(denom) < 1e-9) continue;
      const t = cross(ax - ox, ay - oy, sx, sy) / denom;
      const u = cross(ax - ox, ay - oy, dx, dy) / denom;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    }
  }
  return best;
}

/** Push a circle (x,y,r) out of every solid rect (walls + display cases). */
function collide(x, y, r) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const rect of [...WALLS, ...CASES.map((c) => ({ x: c.x - c.s / 2, y: c.y - c.s / 2, w: c.s, h: c.s }))]) {
      const cx = clamp(x, rect.x, rect.x + rect.w);
      const cy = clamp(y, rect.y, rect.y + rect.h);
      let ddx = x - cx, ddy = y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (ddx / d) * r;
        y = cy + (ddy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration.
        const left = x - rect.x, right = rect.x + rect.w - x;
        const top = y - rect.y, bottom = rect.y + rect.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = rect.x - r;
        else if (m === right) x = rect.x + rect.w + r;
        else if (m === top) y = rect.y - r;
        else y = rect.y + rect.h + r;
      }
    }
  }
  return { x: clamp(x, TUNING.playerRadius, FIELD.w - TUNING.playerRadius), y: clamp(y, TUNING.playerRadius, FIELD.h - TUNING.playerRadius) };
}

function moveWithCollision(x, y, dx, dy, r) {
  const p = collide(x + dx, y + dy, r);
  return p;
}

export function createWorld(random) {
  const state = {
    player: { x: SPAWN.x, y: SPAWN.y, dir: -Math.PI / 2, moving: false, sneaking: false, progress: 0, target: null, anchor: null },
    guards: [],
    cameras: [],
    loot: [],
    coins: TUNING.coinCount,
    flying: [], // thrown coins in the air
    pings: [], // landed coins, {x, y, ttl}
    alarm: 0, peakAlarm: 0, lootTotal: 0, time: 0,
    over: null, // 'win' | 'alarm' | 'caught'
    seen: false, // ever spotted by a guard or camera
  };

  function reset() {
    state.player = { x: SPAWN.x, y: SPAWN.y, dir: -Math.PI / 2, moving: false, sneaking: false, progress: 0, target: null, anchor: null };
    state.guards = GUARDS.map((g) => ({
      name: g.name, x: g.waypoints[0][0], y: g.waypoints[0][1],
      angle: angleTo(g.waypoints[0][0], g.waypoints[0][1], g.waypoints[1][0], g.waypoints[1][1]),
      wp: 1, mode: 'patrol', suspicion: 0, pause: 0, look: 0,
      investigate: null, lastSeen: null, loseSight: 0, speed: g.speed,
    }));
    state.cameras = CAMERAS.map((c) => ({ ...c, angle: c.base, down: 0, seen: false, t: random() * 10 }));
    state.loot = LOOT.map((l) => ({ ...l, taken: false }));
    state.coins = TUNING.coinCount;
    state.flying = [];
    state.pings = [];
    state.alarm = 0; state.peakAlarm = 0; state.lootTotal = 0; state.time = 0;
    state.over = null; state.seen = false;
  }

  function nearestInteractable() {
    const p = state.player;
    for (const l of state.loot) {
      if (!l.taken && dist(p.x, p.y, l.px, l.py) <= 56) return { kind: 'loot', ref: l, need: l.grab };
    }
    for (const c of state.cameras) {
      if (c.down <= 0 && dist(p.x, p.y, c.panel.x, c.panel.y) <= 48) return { kind: 'camera', ref: c, need: TUNING.hackTime };
    }
    return null;
  }

  function guardSees(g) {
    const p = state.player;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > TUNING.guardVisionRange) return 0;
    const a = angleTo(g.x, g.y, p.x, p.y);
    if (Math.abs(angleDiff(g.angle, a)) > TUNING.guardHalfFov) return 0;
    if (!losClear(g.x, g.y, p.x, p.y)) return 0;
    // Closer = spotted faster.
    return TUNING.detectRateFar + (TUNING.detectRate - TUNING.detectRateFar) * (1 - d / TUNING.guardVisionRange);
  }

  function stepGuard(g, dt, events) {
    const p = state.player;
    const seeRate = guardSees(g);
    if (seeRate > 0) {
      const rate = seeRate * (p.sneaking ? TUNING.sneakDetectMul : 1);
      g.suspicion = Math.min(1, g.suspicion + rate * dt);
      g.lastSeen = { x: p.x, y: p.y };
      g.loseSight = 0;
      state.seen = true;
      if (g.suspicion >= TUNING.chaseAt && g.mode !== 'chase') {
        g.mode = 'chase';
        events.flags |= EVENT_ALERT;
      } else if (g.suspicion >= TUNING.suspectAt && g.mode === 'patrol') {
        g.mode = 'suspect';
        g.investigate = { x: p.x, y: p.y };
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - TUNING.suspicionDecay * dt);
      if (g.mode === 'chase') {
        g.loseSight += dt;
        if (g.loseSight > 2.5) { g.mode = 'suspect'; g.investigate = g.lastSeen ? { ...g.lastSeen } : { x: g.x, y: g.y }; }
      }
    }

    let tx = null, ty = null, speed = g.speed;
    if (g.mode === 'chase' && g.lastSeen) {
      tx = g.lastSeen.x; ty = g.lastSeen.y; speed = TUNING.chaseSpeed;
    } else if (g.mode === 'suspect' && g.investigate) {
      tx = g.investigate.x; ty = g.investigate.y; speed = TUNING.investigateSpeed;
    } else if (g.mode === 'patrol') {
      if (g.pause > 0) { g.pause -= dt; }
      else {
        const wp = GUARDS[state.guards.indexOf(g)].waypoints[g.wp];
        tx = wp[0]; ty = wp[1];
        if (dist(g.x, g.y, tx, ty) < 8) {
          g.wp = (g.wp + 1) % GUARDS[state.guards.indexOf(g)].waypoints.length;
          g.pause = 0.8;
        }
      }
    }
    if (tx !== null) {
      const d = dist(g.x, g.y, tx, ty);
      if (d > 4) {
        const a = angleTo(g.x, g.y, tx, ty);
        g.angle += angleDiff(g.angle, a) * Math.min(1, dt * 8);
        const stepLen = Math.min(d, speed * dt);
        const np = moveWithCollision(g.x, g.y, Math.cos(a) * stepLen, Math.sin(a) * stepLen, 14);
        g.x = np.x; g.y = np.y;
      } else if (g.mode === 'suspect') {
        g.look += dt;
        g.angle += dt * 1.2; // scan the area
        if (g.look > 1.6) { g.look = 0; g.mode = 'patrol'; g.investigate = null; }
      }
    }
    if (g.mode === 'chase' && dist(g.x, g.y, p.x, p.y) < TUNING.catchDist) {
      state.over = 'caught';
      events.flags |= EVENT_LOSE;
    }
  }

  /**
   * One fixed step. `input` = { mx, my (-1..1), sneak, interact, throwCoin: {x,y}|null }.
   * Returns bit flags of what happened.
   */
  function step(dt, input) {
    const events = { flags: 0 };
    if (state.over) return 0;
    state.time += dt;
    const p = state.player;

    // --- player movement ---
    const len = Math.hypot(input.mx, input.my);
    p.moving = len > 0.1;
    p.sneaking = !!input.sneak && p.moving;
    if (p.moving) {
      const speed = p.sneaking ? TUNING.sneakSpeed : TUNING.playerSpeed;
      const nx = (input.mx / Math.max(1, len)) * speed * dt;
      const ny = (input.my / Math.max(1, len)) * speed * dt;
      const np = moveWithCollision(p.x, p.y, nx, ny, TUNING.playerRadius);
      p.dir = Math.atan2(ny, nx);
      p.x = np.x; p.y = np.y;
    }

    // --- thrown coins ---
    if (input.throwCoin && state.coins > 0) {
      const t = input.throwCoin;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > 8 && d <= TUNING.coinThrowRange) {
        state.coins -= 1;
        state.flying.push({ x: p.x, y: p.y, tx: t.x, ty: t.y, t: 0, dur: 0.5 });
      }
    }
    for (let i = state.flying.length - 1; i >= 0; i -= 1) {
      const c = state.flying[i];
      c.t += dt / c.dur;
      if (c.t >= 1) {
        state.flying.splice(i, 1);
        state.pings.push({ x: c.tx, y: c.ty, ttl: 2.5 });
        events.flags |= EVENT_COIN;
        for (const g of state.guards) {
          if (dist(g.x, g.y, c.tx, c.ty) <= TUNING.coinHearRange) {
            g.suspicion = Math.max(g.suspicion, 0.5);
            g.mode = 'suspect';
            g.investigate = { x: c.tx, y: c.ty };
            g.look = 0;
          }
        }
      }
    }
    for (let i = state.pings.length - 1; i >= 0; i -= 1) {
      state.pings[i].ttl -= dt;
      if (state.pings[i].ttl <= 0) state.pings.splice(i, 1);
    }

    // --- interact (hold E): grab loot or hack a camera ---
    const target = nearestInteractable();
    if (input.interact && target) {
      const key = `${target.kind}:${target.ref.id}`;
      if (p.target !== key) { p.target = key; p.progress = 0; p.anchor = { x: p.x, y: p.y }; }
      if (p.anchor && dist(p.x, p.y, p.anchor.x, p.anchor.y) > 14) { p.progress = 0; p.anchor = { x: p.x, y: p.y }; }
      p.progress += dt / target.need;
      if (p.progress >= 1) {
        if (target.kind === 'loot') {
          target.ref.taken = true;
          state.lootTotal += target.ref.value;
          events.flags |= EVENT_LOOT;
        } else {
          target.ref.down = TUNING.cameraDownTime;
          events.flags |= EVENT_HACK;
        }
        p.progress = 0; p.target = null; p.anchor = null;
      }
    } else {
      p.progress = 0; p.target = null; p.anchor = null;
    }

    // --- guards ---
    let alarmRise = 0;
    for (const g of state.guards) {
      stepGuard(g, dt, events);
      if (g.mode === 'chase') alarmRise = Math.max(alarmRise, TUNING.alarmChase);
      else if (g.mode === 'suspect') alarmRise = Math.max(alarmRise, TUNING.alarmSuspect);
      if (state.over) break;
    }

    // --- cameras ---
    for (const c of state.cameras) {
      c.t += dt;
      if (c.down > 0) { c.down -= dt; c.seen = false; continue; }
      c.angle = c.base + Math.sin(c.t * c.speed) * c.sweep;
      const d = dist(c.x, c.y, p.x, p.y);
      let seen = false;
      if (d <= c.range) {
        const a = angleTo(c.x, c.y, p.x, p.y);
        if (Math.abs(angleDiff(c.angle, a)) <= 0.42 && losClear(c.x, c.y, p.x, p.y)) seen = true;
      }
      if (seen && !c.seen) {
        events.flags |= EVENT_ALERT;
        state.seen = true;
        for (const g of state.guards) {
          if (g.mode === 'patrol') { g.mode = 'suspect'; g.investigate = { x: p.x, y: p.y }; g.suspicion = Math.max(g.suspicion, 0.5); }
        }
      }
      c.seen = seen;
      if (seen) alarmRise = Math.max(alarmRise, TUNING.alarmCamera);
    }

    // --- alarm ---
    if (alarmRise > 0) state.alarm = Math.min(100, state.alarm + alarmRise * dt);
    else state.alarm = Math.max(0, state.alarm - TUNING.alarmDecay * dt);
    state.peakAlarm = Math.max(state.peakAlarm, state.alarm);
    if (state.alarm >= 100 && !state.over) {
      state.over = 'alarm';
      events.flags |= EVENT_LOSE;
    }

    // --- win: enough loot, reach the getaway door ---
    if (!state.over && state.lootTotal >= TARGET_LOOT
      && p.x >= EXIT.x && p.x <= EXIT.x + EXIT.w && p.y >= EXIT.y && p.y <= EXIT.y + EXIT.h) {
      state.over = 'win';
      events.flags |= EVENT_WIN;
    }
    return events.flags;
  }

  // --- staging helpers for screenshots (used by shots.js) ---
  function placePlayer(x, y, dir) { state.player.x = x; state.player.y = y; if (dir !== undefined) state.player.dir = dir; }
  function placeGuard(i, x, y, angle, mode, suspicion) {
    const g = state.guards[i];
    g.x = x; g.y = y; g.angle = angle;
    if (mode) g.mode = mode;
    if (suspicion !== undefined) g.suspicion = suspicion;
    if (mode === 'chase') g.lastSeen = { x: state.player.x, y: state.player.y };
  }
  function setCamera(i, angle, down) { const c = state.cameras[i]; if (angle !== undefined) c.angle = angle; if (down !== undefined) c.down = down; }
  function setAlarm(v) { state.alarm = v; state.peakAlarm = Math.max(state.peakAlarm, v); }
  function setTime(t) { state.time = t; }
  function takeLoot(id) {
    const l = state.loot.find((item) => item.id === id);
    if (l && !l.taken) { l.taken = true; state.lootTotal += l.value; }
  }

  reset();
  return { state, reset, step, placePlayer, placeGuard, setCamera, setAlarm, setTime, takeLoot };
}
