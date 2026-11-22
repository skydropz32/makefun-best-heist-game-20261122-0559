// Keyboard and pointer input. Held keys give a 2D steering vector plus sneak and interact;
// one-shot presses (start or restart, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. Pointer clicks are
// queued as field coordinates (the renderer converts them); the loop decides what a click means
// on the current screen.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target, toField) {
  const held = { left: false, right: false, up: false, down: false, sneak: false, interact: false };
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (INTERACT.has(event.code)) held.interact = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
    else if (INTERACT.has(event.code)) held.interact = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = held.right = held.up = held.down = held.sneak = held.interact = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField ? toField(event.clientX, event.clientY) : { x: event.clientX, y: event.clientY };
    click = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering vector: -1..1 on each axis (0,0 when still or when opposite keys cancel). */
    move() {
      return { x: (held.right ? 1 : 0) - (held.left ? 1 : 0), y: (held.down ? 1 : 0) - (held.up ? 1 : 0) };
    },
    sneak() { return held.sneak; },
    interact() { return held.interact; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The queued pointer click in field coordinates, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
