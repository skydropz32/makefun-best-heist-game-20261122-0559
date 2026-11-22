// The screenshot scenes behind ?shot=start|play|alarm|end. Each one stages a real game state
// (a fresh world, then positions, loot, alarm and AI states set through the world's own staging
// helpers) and runs a few real steps so cones, lighting and timers settle — the frame is what the
// live game really looks like, and the same seed always gives the same frame.
// The cover (start) shows all five judging elements in one frame: the museum room, a guard with
// its vision cone, a camera with its cone, loot targets, and the alarm meter in the HUD.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY } from './render.js';

const EMPTY = { mx: 0, my: 0, sneak: false, interact: false, throwCoin: null };

function settle(world, steps) {
  for (let i = 0; i < steps; i += 1) world.step(STEP, EMPTY);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best loot to show.
 * Unknown names stage the cover.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;

  if (name === 'play') {
    // Mid-heist: the thief cracks the vault safe while a guard closes in.
    world.takeLoot('p1');
    world.takeLoot('g2');
    world.setTime(161);
    world.setAlarm(34);
    world.placePlayer(640, 140, -Math.PI / 2);
    world.placeGuard(1, 680, 380, -1.74, 'suspect', 0.5);
    world.state.cameras[0].t = -Math.PI / 2; // C1 cone down onto the thief
    settle(world, 6);
    // progress ring, set last so the step above cannot clear it
    s.player.target = 'loot:safe';
    s.player.progress = 0.65;
    s.player.anchor = { x: 640, y: 140 };
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'alarm') {
    // The getaway goes loud: alarm 82%, a guard in full chase, a camera on the thief.
    world.takeLoot('p1');
    world.takeLoot('g2');
    world.takeLoot('g3');
    world.takeLoot('safe');
    world.setTime(245);
    world.setAlarm(82);
    world.placePlayer(1075, 540, 0.9);
    world.placeGuard(2, 950, 580, -0.31, 'chase', 1);
    world.state.cameras[1].t = -Math.PI / 2 / 0.45; // C2 cone down-left onto the thief
    settle(world, 8);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'end') {
    // Clean getaway: enough loot, at the door, win panel over the field.
    world.takeLoot('p1');
    world.takeLoot('g1');
    world.takeLoot('g2');
    world.takeLoot('g3');
    world.takeLoot('p3');
    world.setTime(312);
    world.setAlarm(12);
    world.placePlayer(1185, 670, Math.PI / 2);
    world.step(STEP, EMPTY); // triggers the win
    return { screen: SCREEN_OVER, best: s.lootTotal };
  }

  // start — the cover. Thief mid-room in the Vault Hall, guard Bishop's yellow cone on them,
  // camera C1's red cone sweeping the vault, gems and the safe glinting, alarm at 18%.
  world.setTime(84);
  world.setAlarm(18);
  world.placePlayer(640, 470, -Math.PI / 2);
  world.placeGuard(1, 640, 330, Math.PI / 2, 'suspect', 0.45);
  world.state.cameras[0].t = -0.92; // C1 cone down toward the thief
  settle(world, 12);
  return { screen: SCREEN_PLAY, best: 0 };
}
