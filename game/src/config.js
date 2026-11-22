// The Gilded Vault — level data and tuning.
// Original museum-heist layout: three galleries around one vault antechamber.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window.
export const FIELD = { w: 1280, h: 720 };
export const STEP = 1 / 60;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */

// Axis-aligned solid rectangles {x, y, w, h}. Block movement AND vision.
export const WALLS = [
  // outer shell
  { x: 0, y: 0, w: 1280, h: 24 }, { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 }, { x: 1256, y: 0, w: 24, h: 720 },
  // W1: west / central divider, door gap y 480..560
  { x: 420, y: 24, w: 24, h: 456 }, { x: 420, y: 560, w: 24, h: 136 },
  // W2: central / east divider, door gap y 140..216
  { x: 836, y: 24, w: 24, h: 116 }, { x: 836, y: 216, w: 24, h: 480 },
  // W3: vault antechamber wall, arch gap x 600..680
  { x: 444, y: 200, w: 156, h: 24 }, { x: 680, y: 200, w: 156, h: 24 },
  // pillars
  { x: 270, y: 270, w: 60, h: 60 }, { x: 530, y: 400, w: 60, h: 60 },
  { x: 730, y: 400, w: 60, h: 60 }, { x: 950, y: 270, w: 60, h: 60 },
  { x: 1020, y: 450, w: 60, h: 60 }, // east-gallery cover on the run to the exit
  // the vault safe (tall steel, blocks vision)
  { x: 590, y: 24, w: 100, h: 64 },
];

// Low glass display cases: block movement, NOT vision. {x, y} = centre, s = size.
export const CASES = [
  { id: "g1", x: 300, y: 620, s: 46 }, { id: "g2", x: 560, y: 320, s: 46 },
  { id: "g3", x: 720, y: 320, s: 46 }, { id: "g4", x: 980, y: 620, s: 46 },
];

// Loot. kind: painting (on a wall), gem (in a case), safe.
// px,py = where the thief stands to grab. grab = seconds holding E.
export const LOOT = [
  { id: "p1", kind: "painting", name: "Sunset Over the Docks", value: 1800, x: 60, y: 150, px: 96, py: 150, grab: 1.2, hue: 28 },
  { id: "p2", kind: "painting", name: "Lady in Gold", value: 2200, x: 60, y: 480, px: 96, py: 480, grab: 1.2, hue: 45 },
  { id: "g1", kind: "gem", name: "Emerald of the Nile", value: 1500, x: 300, y: 620, px: 300, py: 560, grab: 0.8, hue: 150 },
  { id: "safe", kind: "safe", name: "The Vault Safe", value: 5000, x: 640, y: 60, px: 640, py: 140, grab: 3.0, hue: 200 },
  { id: "g2", kind: "gem", name: "Ruby Heart", value: 1500, x: 560, y: 320, px: 560, py: 260, grab: 0.8, hue: 350 },
  { id: "g3", kind: "gem", name: "Sapphire Star", value: 2000, x: 720, y: 320, px: 720, py: 260, grab: 0.8, hue: 220 },
  { id: "p3", kind: "painting", name: "The Jade Mask", value: 2500, x: 1220, y: 150, px: 1184, py: 150, grab: 1.2, hue: 160 },
  { id: "g4", kind: "gem", name: "Topaz Sun", value: 1500, x: 980, y: 620, px: 980, py: 560, grab: 0.8, hue: 40 },
];

export const TARGET_LOOT = 8000;
export const SPAWN = { x: 70, y: 650 };
export const EXIT = { x: 1140, y: 648, w: 90, h: 48, label: "GETAWAY" };

// Guards: patrol waypoint loops.
export const GUARDS = [
  { name: "Rook", waypoints: [[120, 120], [340, 120], [340, 420], [120, 420]], speed: 70 },
  { name: "Bishop", waypoints: [[500, 300], [780, 300], [780, 560], [500, 560]], speed: 70 },
  { name: "Knight", waypoints: [[920, 120], [1180, 120], [1180, 420], [920, 420]], speed: 70 },
];

// Cameras: mounted on walls, sweep back and forth. panel = hack point.
export const CAMERAS = [
  { id: "c1", x: 520, y: 58, base: Math.PI / 2, sweep: 0.61, range: 320, speed: 0.5, panel: { x: 470, y: 56 }, mount: "ceiling" },
  { id: "c2", x: 1232, y: 300, base: Math.PI, sweep: 0.7, range: 320, speed: 0.45, panel: { x: 1208, y: 380 }, mount: "wall" },
];

export const TUNING = {
  playerSpeed: 170, sneakSpeed: 95, playerRadius: 14,
  guardVisionRange: 270, guardHalfFov: 0.66, // ~38 deg
  detectRate: 1.1, detectRateFar: 0.55, sneakDetectMul: 0.45,
  suspicionDecay: 0.5, chaseAt: 0.85, suspectAt: 0.35,
  chaseSpeed: 155, investigateSpeed: 115, catchDist: 26,
  alarmChase: 15, alarmSuspect: 6, alarmCamera: 16, alarmDecay: 11,
  coinCount: 3, coinThrowRange: 340, coinHearRange: 280,
  hackTime: 2.0, cameraDownTime: 25,
};

export const PALETTE = {
  floorA: "#2b2118", floorB: "#241b13", rug: "#5a1f24", rugTrim: "#c9a227",
  wall: "#3a3340", wallTop: "#574d63", wallTrim: "#c9a227",
  gold: "#e8c15a", goldDim: "#9a7d33", cream: "#f2e6c9",
  thief: "#1d2733", thiefHood: "#2e3d4f",
  guard: "#2c3e6b", guardCap: "#1c2a4a",
  coneGuard: "rgba(255, 214, 90, 0.20)", coneGuardEdge: "rgba(255, 214, 90, 0.55)",
  coneCam: "rgba(255, 90, 90, 0.16)", coneCamEdge: "rgba(255, 90, 90, 0.5)",
  alarm: "#ff4d4d", ok: "#7ddc8a",
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
