// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour.
// Static art (floor, walls, rugs, paintings, cases, safe) is painted once to an offscreen canvas;
// each frame draws the vision cones, the characters, the loot glints, the lighting mask and the HUD.
import { CAMERAS, CASES, EXIT, FIELD, FONT, LOOT, PALETTE, TARGET_LOOT, TUNING, WALLS } from './config.js';
import { rayDistance } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 78 };
const CONE_RAYS = 26;

function rating(peakAlarm) {
  if (peakAlarm <= 25) return 'GHOST — never raised a brow';
  if (peakAlarm <= 60) return 'SHADOW — a few close calls';
  return 'LOUD — the whole museum heard you';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = FIELD.w;
  staticCanvas.height = FIELD.h;
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = FIELD.w;
  lightCanvas.height = FIELD.h;
  const lightCtx = lightCanvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.w, height / FIELD.h);
    view.x = (width - FIELD.w * view.scale) / 2;
    view.y = (height - FIELD.h * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function money(v) { return '$' + v.toLocaleString('en-US'); }

  // ---------- static art ----------
  function paintStatic() {
    const c = staticCanvas.getContext('2d');
    // parquet floor
    for (let y = 0; y < FIELD.h; y += 40) {
      for (let x = 0; x < FIELD.w; x += 40) {
        c.fillStyle = ((x / 40 + y / 40) % 2 === 0) ? PALETTE.floorA : PALETTE.floorB;
        c.fillRect(x, y, 40, 40);
      }
    }
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1;
    for (let x = 0; x <= FIELD.w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, FIELD.h); c.stroke(); }
    for (let y = 0; y <= FIELD.h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(FIELD.w, y); c.stroke(); }

    // rugs
    for (const [rx, ry, rw, rh] of [[72, 270, 300, 180], [480, 460, 320, 170], [896, 270, 300, 180]]) {
      c.fillStyle = PALETTE.rug;
      c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = PALETTE.rugTrim;
      c.lineWidth = 3;
      c.strokeRect(rx + 8, ry + 8, rw - 16, rh - 16);
    }
    // room labels
    c.fillStyle = 'rgba(232, 193, 90, 0.16)';
    c.font = '600 26px ' + FONT;
    c.textAlign = 'center';
    c.fillText('WEST GALLERY', 222, 104);
    c.fillText('VAULT HALL', 640, 636);
    c.fillText('EAST GALLERY', 1048, 104);

    // paintings (framed mini art, hue per loot)
    for (const l of LOOT) {
      if (l.kind !== 'painting') continue;
      const fx = l.x < 640 ? 26 : 1200;
      c.fillStyle = PALETTE.goldDim;
      c.fillRect(fx, l.y - 38, 54, 76);
      const g = c.createLinearGradient(fx, l.y - 38, fx + 54, l.y + 38);
      g.addColorStop(0, `hsl(${l.hue}, 55%, 45%)`);
      g.addColorStop(1, `hsl(${(l.hue + 40) % 360}, 60%, 22%)`);
      c.fillStyle = g;
      c.fillRect(fx + 4, l.y - 34, 46, 68);
      c.fillStyle = `hsl(${(l.hue + 180) % 360}, 70%, 65%)`;
      c.beginPath(); c.arc(fx + 27, l.y - 10, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(20, 12, 8, 0.55)';
      c.beginPath(); c.moveTo(fx + 4, l.y + 34); c.lineTo(fx + 22, l.y + 2); c.lineTo(fx + 40, l.y + 34); c.closePath(); c.fill();
    }

    // display cases
    for (const cs of CASES) {
      c.fillStyle = '#6b5a2e';
      c.fillRect(cs.x - cs.s / 2, cs.y - cs.s / 2 + cs.s / 2 - 6, cs.s, 10);
      c.fillStyle = 'rgba(180, 210, 230, 0.22)';
      c.fillRect(cs.x - cs.s / 2, cs.y - cs.s / 2, cs.s, cs.s);
      c.strokeStyle = 'rgba(220, 235, 245, 0.5)';
      c.lineWidth = 1.5;
      c.strokeRect(cs.x - cs.s / 2, cs.y - cs.s / 2, cs.s, cs.s);
    }

    // the vault safe
    c.fillStyle = '#4a4f58';
    c.fillRect(590, 24, 100, 64);
    c.fillStyle = '#33373f';
    c.fillRect(596, 30, 88, 52);
    c.strokeStyle = PALETTE.gold;
    c.lineWidth = 2;
    c.strokeRect(596, 30, 88, 52);
    c.fillStyle = '#c8ccd4';
    c.beginPath(); c.arc(640, 56, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#33373f';
    c.beginPath(); c.arc(640, 56, 7, 0, Math.PI * 2); c.fill();

    // exit / getaway door
    c.fillStyle = '#1e4d2a';
    c.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    c.fillStyle = '#2f7a44';
    c.fillRect(EXIT.x + 6, EXIT.y + 6, EXIT.w - 12, EXIT.h - 12);
    c.fillStyle = '#bff5cd';
    c.font = '700 13px ' + FONT;
    c.textAlign = 'center';
    c.fillText('GETAWAY', EXIT.x + EXIT.w / 2, EXIT.y - 8);

    // service entrance (spawn)
    c.fillStyle = '#3d2f1e';
    c.fillRect(40, 660, 70, 36);
    c.fillStyle = PALETTE.cream;
    c.font = '700 11px ' + FONT;
    c.fillText('SERVICE', 75, 654);

    // camera hack panels
    for (const cam of CAMERAS) {
      c.fillStyle = '#22262e';
      c.fillRect(cam.panel.x - 12, cam.panel.y - 12, 24, 24);
      c.strokeStyle = PALETTE.goldDim;
      c.lineWidth = 2;
      c.strokeRect(cam.panel.x - 12, cam.panel.y - 12, 24, 24);
      c.fillStyle = '#39d353';
      c.beginPath(); c.arc(cam.panel.x, cam.panel.y, 4, 0, Math.PI * 2); c.fill();
    }

    // walls on top of the floor
    for (const w of WALLS) {
      c.fillStyle = PALETTE.wall;
      c.fillRect(w.x, w.y, w.w, w.h);
      c.fillStyle = PALETTE.wallTop;
      if (w.h <= 24) c.fillRect(w.x, w.y, w.w, 5);
      else c.fillRect(w.x, w.y, 5, w.h);
    }
    c.strokeStyle = 'rgba(201, 162, 39, 0.5)';
    c.lineWidth = 1.5;
    for (const w of WALLS) {
      if (w.h <= 24) { c.beginPath(); c.moveTo(w.x, w.y + w.h); c.lineTo(w.x + w.w, w.y + w.h); c.stroke(); }
    }
  }

  // ---------- dynamic drawing ----------
  function cone(cx, cy, angle, halfFov, range, fill, edge) {
    context.beginPath();
    context.moveTo(cx, cy);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const a = angle - halfFov + (i / CONE_RAYS) * halfFov * 2;
      const d = rayDistance(cx, cy, a, range);
      context.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawCones(state) {
    for (const g of state.guards) cone(g.x, g.y, g.angle, TUNING.guardHalfFov, TUNING.guardVisionRange, PALETTE.coneGuard, PALETTE.coneGuardEdge);
    for (const cam of state.cameras) {
      if (cam.down > 0) continue;
      cone(cam.x, cam.y, cam.angle, 0.42, cam.range, PALETTE.coneCam, PALETTE.coneCamEdge);
    }
  }

  function drawLoot(state) {
    for (const l of state.loot) {
      if (l.taken) continue;
      if (l.kind === 'gem') {
        const tw = 0.6 + 0.4 * Math.sin(state.time * 3 + l.x);
        context.save();
        context.translate(l.x, l.y);
        context.rotate(Math.PI / 4);
        context.fillStyle = `hsl(${l.hue}, 85%, ${55 + 15 * tw}%)`;
        context.fillRect(-9, -9, 18, 18);
        context.strokeStyle = 'rgba(255,255,255,0.8)';
        context.lineWidth = 1.5;
        context.strokeRect(-9, -9, 18, 18);
        context.restore();
        // sparkle
        const s = 4 + 3 * Math.sin(state.time * 5 + l.y);
        context.strokeStyle = 'rgba(255,255,255,0.9)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(l.x - s, l.y); context.lineTo(l.x + s, l.y);
        context.moveTo(l.x, l.y - s); context.lineTo(l.x, l.y + s);
        context.stroke();
      } else if (l.kind === 'painting') {
        // gold glint on the frame corner
        context.fillStyle = `rgba(255, 240, 180, ${0.4 + 0.3 * Math.sin(state.time * 2 + l.y)})`;
        context.fillRect(l.x < 640 ? 26 : 1200, l.y - 38, 54, 4);
      } else if (l.kind === 'safe') {
        context.fillStyle = `rgba(255, 240, 180, ${0.35 + 0.3 * Math.sin(state.time * 2)})`;
        context.beginPath(); context.arc(640, 56, 18, 0, Math.PI * 2); context.stroke();
      }
    }
  }

  function drawFigure(x, y, r, body, hood, dir) {
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath(); context.ellipse(x, y + r * 0.85, r * 0.95, r * 0.4, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = body;
    context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill();
    // hood / cap pointing at dir
    context.fillStyle = hood;
    context.beginPath();
    context.moveTo(x + Math.cos(dir) * r * 1.15, y + Math.sin(dir) * r * 1.15);
    context.arc(x, y, r * 0.72, dir + 2.2, dir - 2.2);
    context.closePath();
    context.fill();
    // eyes
    const ex = Math.cos(dir + Math.PI / 2), ey = Math.sin(dir + Math.PI / 2);
    context.fillStyle = PALETTE.cream;
    context.beginPath(); context.arc(x + Math.cos(dir) * 5 + ex * 4, y + Math.sin(dir) * 5 + ey * 4, 1.8, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(x + Math.cos(dir) * 5 - ex * 4, y + Math.sin(dir) * 5 - ey * 4, 1.8, 0, Math.PI * 2); context.fill();
  }

  function drawCharacters(state) {
    for (const cam of state.cameras) {
      // ceiling / wall mount arm
      context.strokeStyle = '#3a3f47';
      context.lineWidth = 4;
      context.beginPath();
      if (cam.mount === 'ceiling') { context.moveTo(cam.x, 24); context.lineTo(cam.x, cam.y - 8); }
      else { context.moveTo(1256, cam.y); context.lineTo(cam.x + 12, cam.y); }
      context.stroke();
      context.fillStyle = cam.down > 0 ? '#3a3f47' : '#22262e';
      context.fillRect(cam.x - 12, cam.y - 8, 24, 16);
      context.strokeStyle = '#565d68';
      context.lineWidth = 1.5;
      context.strokeRect(cam.x - 12, cam.y - 8, 24, 16);
      context.fillStyle = cam.down > 0 ? '#666' : (Math.floor(state.time * 2) % 2 === 0 ? '#ff3b30' : '#ff8a80');
      context.beginPath(); context.arc(cam.x + (cam.x > 640 ? -7 : 7), cam.y, 4.5, 0, Math.PI * 2); context.fill();
      if (cam.down > 0) text('OFF', cam.x, cam.y + 26, 11, '#9aa0aa', 'center', '700');
    }
    for (const g of state.guards) {
      drawFigure(g.x, g.y, 14, PALETTE.guard, PALETTE.guardCap, g.angle);
      // cap brim
      context.strokeStyle = PALETTE.guardCap;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(g.x + Math.cos(g.angle) * 10, g.y + Math.sin(g.angle) * 10);
      context.lineTo(g.x + Math.cos(g.angle) * 18, g.y + Math.sin(g.angle) * 18);
      context.stroke();
      if (g.mode === 'chase') text('!', g.x, g.y - 24, 26, '#ff4d4d', 'center', '800');
      else if (g.mode === 'suspect') text('?', g.x, g.y - 24, 24, '#ffc93b', 'center', '800');
    }
    const p = state.player;
    drawFigure(p.x, p.y, TUNING.playerRadius, PALETTE.thief, PALETTE.thiefHood, p.dir);
    if (state.lootTotal > 0) {
      context.fillStyle = PALETTE.gold;
      context.fillRect(p.x - Math.cos(p.dir) * 12 - 5, p.y - Math.sin(p.dir) * 12 - 5, 10, 10);
    }
    // interact progress ring
    if (p.target && p.progress > 0) {
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.lineWidth = 5;
      context.beginPath(); context.arc(p.x, p.y - 26, 11, 0, Math.PI * 2); context.stroke();
      context.strokeStyle = PALETTE.gold;
      context.beginPath(); context.arc(p.x, p.y - 26, 11, -Math.PI / 2, -Math.PI / 2 + p.progress * Math.PI * 2); context.stroke();
    }
    // coins
    for (const c of state.flying) {
      const t = c.t;
      const x = c.x + (c.tx - c.x) * t;
      const y = c.y + (c.ty - c.y) * t - Math.sin(t * Math.PI) * 40;
      context.fillStyle = PALETTE.gold;
      context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#7a5c14';
      context.lineWidth = 1.5;
      context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.stroke();
    }
    for (const ping of state.pings) {
      const a = ping.ttl / 2.5;
      context.strokeStyle = `rgba(232, 193, 90, ${a})`;
      context.lineWidth = 2;
      context.beginPath(); context.arc(ping.x, ping.y, 12 + (1 - a) * 26, 0, Math.PI * 2); context.stroke();
    }
  }

  function drawLighting(state) {
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.clearRect(0, 0, FIELD.w, FIELD.h);
    lightCtx.fillStyle = 'rgba(5, 7, 16, 0.34)';
    lightCtx.fillRect(0, 0, FIELD.w, FIELD.h);
    lightCtx.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, strength) {
      const g = lightCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = g;
      lightCtx.beginPath(); lightCtx.arc(x, y, r, 0, Math.PI * 2); lightCtx.fill();
    }
    const p = state.player;
    hole(p.x, p.y, 250, 0.95);
    for (const g of state.guards) hole(g.x, g.y, 120, 0.5);
    for (const cam of state.cameras) if (cam.down <= 0) hole(cam.x, cam.y, 140, 0.45);
    for (const l of state.loot) if (!l.taken) hole(l.x, l.y, 85, 0.55);
    hole(EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2, 140, 0.6);
    lightCtx.globalCompositeOperation = 'source-over';
    context.drawImage(lightCanvas, 0, 0);
    // alarm vignette
    if (state.alarm > 50) {
      const a = ((state.alarm - 50) / 50) * (0.28 + 0.12 * Math.sin(state.time * 6));
      const g = context.createRadialGradient(640, 360, 240, 640, 360, 720);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255, 30, 30, ${a})`);
      context.fillStyle = g;
      context.fillRect(0, 0, FIELD.w, FIELD.h);
    }
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(8, 8, 14, 0.78)';
    context.fillRect(0, 0, FIELD.w, 46);
    context.textBaseline = 'alphabetic';
    const lootText = `LOOT ${money(state.lootTotal)} / ${money(TARGET_LOOT)}`;
    text(lootText, 24, 30, 22, state.lootTotal >= TARGET_LOOT ? '#7ddc8a' : PALETTE.gold, 'left', '700');
    // alarm meter
    const bx = 470, bw = 300;
    text('ALARM', bx - 12, 30, 20, state.alarm > 60 ? PALETTE.alarm : PALETTE.cream, 'right', '700');
    context.fillStyle = '#1a1a22';
    context.fillRect(bx, 12, bw, 22);
    const ac = state.alarm > 60 ? '#ff4d4d' : state.alarm > 30 ? '#ffb02e' : '#7ddc8a';
    context.fillStyle = ac;
    context.fillRect(bx, 12, bw * (state.alarm / 100), 22);
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1.5;
    context.strokeRect(bx, 12, bw, 22);
    text(`${Math.round(state.alarm)}%`, bx + bw + 10, 30, 20, ac, 'left', '700');
    // coins + time
    text(`◉ × ${state.coins}`, 900, 30, 20, PALETTE.gold, 'left', '700');
    const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
    const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
    text(`${mm}:${ss}`, 1256, 30, 20, PALETTE.cream, 'right', '700');

    // bottom hint
    context.fillStyle = 'rgba(8, 8, 14, 0.6)';
    context.fillRect(0, FIELD.h - 30, FIELD.w, 30);
    let hint = 'WASD / arrows move · Shift sneak · E grab / hack · Click throw a coin · P pause · M mute';
    const p = state.player;
    if (p.target) {
      const kind = p.target.startsWith('loot') ? 'loot' : 'camera';
      hint = kind === 'loot' ? 'Hold E — pocketing it…' : 'Hold E — hacking the camera…';
    } else if (state.lootTotal >= TARGET_LOOT) {
      hint = 'You have enough — get to the GETAWAY door, bottom right!';
    }
    text(hint, FIELD.w / 2, FIELD.h - 9, 16, '#c9c2ae', 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.w - PANEL.width) / 2;
    const y = (FIELD.h - height) / 2;
    context.fillStyle = 'rgba(10, 10, 16, 0.92)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.goldDim;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.w / 2, y + 72, 44, accent || PALETTE.gold, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.w / 2, y + PANEL.top + i * PANEL.line, 20, '#d8d2c0', 'center');
    }
    text(prompt, FIELD.w / 2, y + height - 36, 22, PALETTE.gold, 'center', '700');
  }

  /** Map a pointer position (client coordinates) onto the 1280x720 playfield. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (clientX - rect.left) * (canvas.width / rect.width);
    const deviceY = (clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: Math.max(0, Math.min(FIELD.w, (deviceX - view.x) / view.scale)),
      y: Math.max(0, Math.min(FIELD.h, (deviceY - view.y) / view.scale)),
    };
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0d12';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.drawImage(staticCanvas, 0, 0);
    drawCones(state);
    drawLoot(state);
    drawCharacters(state);
    drawLighting(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'One night. One museum. One very quiet thief.',
        `Steal at least ${money(TARGET_LOOT)} of loot, then slip out the GETAWAY door.`,
        'Guards patrol with torches of sight — stay out of the yellow cones.',
        'Cameras sweep red cones. Hack their wall panels to shut them down.',
        'Hold E to pocket loot and crack the safe. Click to toss a coin as a decoy.',
        'Shift to sneak. If the alarm hits 100%, or a guard grabs you, it is over.',
        best > 0 ? `Best haul so far: ${money(best)}` : '',
      ];
      drawPanel('THE GILDED VAULT', lines, 'Press Enter or click to begin');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      if (state.over === 'win') {
        const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
        const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
        drawPanel('CLEAN GETAWAY!', [
          `Loot: ${money(state.lootTotal)} in ${mm}:${ss}`,
          rating(state.peakAlarm),
          best > 0 ? `Best haul: ${money(best)}` : '',
        ], 'Press Enter or click to play again', '#7ddc8a');
      } else if (state.over === 'alarm') {
        drawPanel('ALARM TRIPPED!', [`The museum locks down. Loot kept: ${money(state.lootTotal)}`], 'Press Enter or click to try again', PALETTE.alarm);
      } else {
        drawPanel('CAUGHT!', [`A guard got you. Loot kept: ${money(state.lootTotal)}`], 'Press Enter or click to try again', PALETTE.alarm);
      }
    }
  }

  paintStatic();
  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
