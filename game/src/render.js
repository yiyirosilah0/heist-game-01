// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. A museum at night: checkerboard floor, a red carpet to the diamond, framed
// paintings, glass display cases, warm amber guard cones, red camera cones, a glowing
// diamond and a clean gold-on-dark HUD. Text that holds a number is rebuilt only when the
// number changes, so a frame allocates nothing.
import {
  CAMERA, CARPET, CASES, EXIT, FIELD, FONT, GUARD, LOOT, PALETTE, PAINTINGS, ROOM,
} from './config.js';
import { coneFan } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

const TILE = 64;
const LIFE_GLOW = 0.22;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const coinsLabel = cachedLabel('');
  const timeLabel = cachedLabel('');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a client (mouse) position into playfield coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function shadow(x, y, radius) {
    context.fillStyle = `rgba(0, 0, 0, ${0.45})`;
    context.beginPath();
    context.ellipse(x, y + radius * 0.75, radius * 1.05, radius * 0.42, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawFloor() {
    for (let ty = 0; ty < ROOM.height / TILE; ty += 1) {
      for (let tx = 0; tx < ROOM.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(ROOM.x + tx * TILE, ROOM.y + ty * TILE, TILE, TILE);
      }
    }
    // The red carpet from the entry door to the diamond, gold-edged.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(CARPET.x, CARPET.y, CARPET.width, CARPET.height);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(CARPET.x - 3, CARPET.y, 3, CARPET.height);
    context.fillRect(CARPET.x + CARPET.width, CARPET.y, 3, CARPET.height);
    // Wall trim and framed paintings.
    context.strokeStyle = PALETTE.wallTrim;
    context.lineWidth = 3;
    context.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    for (const painting of PAINTINGS) {
      context.fillStyle = painting.hue;
      context.fillRect(painting.x, painting.y, painting.width, painting.height);
      context.strokeStyle = PALETTE.carpetEdge;
      context.lineWidth = 2;
      context.strokeRect(painting.x, painting.y, painting.width, painting.height);
    }
  }

  function drawCases() {
    for (const rect of CASES) {
      context.fillStyle = PALETTE.caseTop;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.fillStyle = `rgba(127, 168, 201, 0.28)`;
      context.fillRect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12);
      context.strokeStyle = PALETTE.carpetEdge;
      context.lineWidth = 2;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  function drawExit(state) {
    const glow = state.lootTaken ? 0.9 : 0.45;
    const gradient = context.createLinearGradient(EXIT.x, EXIT.y, EXIT.x + EXIT.width, EXIT.y);
    gradient.addColorStop(0, `rgba(52, 211, 153, ${glow * 0.25})`);
    gradient.addColorStop(0.5, `rgba(52, 211, 153, ${glow})`);
    gradient.addColorStop(1, `rgba(52, 211, 153, ${glow * 0.25})`);
    context.fillStyle = gradient;
    context.fillRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height);
    context.fillStyle = PALETTE.exitGlow;
    context.font = `bold 13px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('EXIT', EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height + 16);
  }

  function drawDiamond(state) {
    if (state.lootTaken) return;
    const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 3);
    const halo = context.createRadialGradient(LOOT.x, LOOT.y, 4, LOOT.x, LOOT.y, 64 * pulse);
    halo.addColorStop(0, 'rgba(165, 243, 252, 0.55)');
    halo.addColorStop(1, 'rgba(165, 243, 252, 0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(LOOT.x, LOOT.y, 64 * pulse, 0, Math.PI * 2);
    context.fill();
    // Pedestal.
    context.fillStyle = PALETTE.caseTop;
    context.fillRect(LOOT.x - 26, LOOT.y + 14, 52, 26);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 2;
    context.strokeRect(LOOT.x - 26, LOOT.y + 14, 52, 26);
    // The diamond itself.
    context.fillStyle = PALETTE.diamond;
    context.beginPath();
    context.moveTo(LOOT.x, LOOT.y - 16);
    context.lineTo(LOOT.x + 13, LOOT.y);
    context.lineTo(LOOT.x, LOOT.y + 14);
    context.lineTo(LOOT.x - 13, LOOT.y);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.diamondCore;
    context.beginPath();
    context.moveTo(LOOT.x, LOOT.y - 16);
    context.lineTo(LOOT.x + 6, LOOT.y - 2);
    context.lineTo(LOOT.x, LOOT.y + 4);
    context.lineTo(LOOT.x - 6, LOOT.y - 2);
    context.closePath();
    context.fill();
  }

  function drawCoins(state) {
    for (const coin of state.coins) {
      if (coin.taken) continue;
      const bob = Math.sin(state.elapsed * 2 + coin.x) * 2;
      context.fillStyle = PALETTE.goldDark;
      context.beginPath();
      context.arc(coin.x, coin.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(coin.x, coin.y + bob, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.goldDark;
      context.font = `bold 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('$', coin.x, coin.y + bob + 4);
    }
  }

  function drawCone(ox, oy, angle, range, halfAngle, rgb, spotted) {
    const fan = coneFan(ox, oy, angle, range, halfAngle);
    const gradient = context.createRadialGradient(ox, oy, 10, ox, oy, range);
    const strength = spotted ? 0.5 : 0.28;
    gradient.addColorStop(0, `rgba(${rgb}, ${strength})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.02)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(fan[0].x, fan[0].y);
    for (let index = 1; index < fan.length; index += 1) context.lineTo(fan[index].x, fan[index].y);
    context.closePath();
    context.fill();
    context.strokeStyle = `rgba(${rgb}, ${spotted ? 0.85 : 0.45})`;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(ox, oy);
    context.lineTo(fan[1].x, fan[1].y);
    context.moveTo(ox, oy);
    context.lineTo(fan[fan.length - 1].x, fan[fan.length - 1].y);
    context.stroke();
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.coneHalfAngle, PALETTE.coneCamera, camera.spotted);
      shadow(camera.x, camera.y, 10);
      context.fillStyle = '#1f2937';
      context.beginPath();
      context.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = camera.spotted ? '#ef4444' : '#f97316';
      context.beginPath();
      context.arc(camera.x, camera.y, 4, 0, Math.PI * 2);
      context.fill();
      if (camera.spotted) {
        text('!', camera.x, camera.y - 16, 22, '#ef4444', 'center');
      }
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle, PALETTE.coneGuard, guard.spotted);
    }
    for (const guard of state.guards) {
      shadow(guard.x, guard.y, guard.radius);
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius - 3, 0, Math.PI * 2);
      context.fill();
      // The guard's gaze: a small visor line in the facing direction.
      context.strokeStyle = '#fff7ed';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4);
      context.lineTo(guard.x + Math.cos(guard.angle) * (guard.radius - 2), guard.y + Math.sin(guard.angle) * (guard.radius - 2));
      context.stroke();
      if (guard.spotted) {
        text('!', guard.x, guard.y - guard.radius - 10, 24, '#fbbf24', 'center');
      }
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    shadow(thief.x, thief.y, thief.radius);
    context.fillStyle = PALETTE.thiefDark;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius - 3, 0, Math.PI * 2);
    context.fill();
    // Mask: a dark band across the face, in the facing direction.
    context.fillStyle = '#0f172a';
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius - 6, thief.face - 0.9, thief.face + 0.9);
    context.lineTo(thief.x, thief.y);
    context.closePath();
    context.fill();
    // The stolen diamond rides on the thief's back once grabbed.
    if (thief.hasLoot) {
      context.fillStyle = PALETTE.diamond;
      context.beginPath();
      context.moveTo(thief.x, thief.y - thief.radius - 12);
      context.lineTo(thief.x + 7, thief.y - thief.radius - 4);
      context.lineTo(thief.x, thief.y - thief.radius + 2);
      context.lineTo(thief.x - 7, thief.y - thief.radius - 4);
      context.closePath();
      context.fill();
    }
    // Click target: a small gold ring where the thief is walking to.
    if (thief.clickX !== null) {
      context.strokeStyle = `rgba(242, 201, 76, 0.8)`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(thief.clickX, thief.clickY, 10, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawField(state) {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawFloor();
    drawExit(state);
    drawDiamond(state);
    drawCoins(state);
    drawCases();
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    // Night vignette: the room's edges fall into darkness.
    const vignette = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    vignette.addColorStop(0, 'rgba(5, 7, 15, 0)');
    vignette.addColorStop(1, `rgba(5, 7, 15, ${LIFE_GLOW + 0.18})`);
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Red flash at the edges while spotted.
    if (state.seen) {
      context.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      context.lineWidth = 6;
      context.strokeRect(3, 3, FIELD.width - 6, FIELD.height - 6);
    }
  }

  function alarmColor(alarm) {
    if (alarm < 40) return PALETTE.alarmLow;
    if (alarm < 75) return PALETTE.alarmMid;
    return PALETTE.alarmHigh;
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(5, 7, 15, 0.92)';
    context.fillRect(0, 0, FIELD.width, 76);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 76, FIELD.width, 2);
    context.textBaseline = 'top';
    text('MIDNIGHT MUSEUM HEIST', 24, 14, 24, PALETTE.text, 'left');
    text(scoreLabel(state.score), 24, 46, 18, PALETTE.muted, 'left');
    // Alarm meter, centre.
    const barX = FIELD.width / 2 - 170;
    const barY = 22;
    const barWidth = 340;
    const barHeight = 20;
    text('ALARM', barX - 12, barY + 2, 16, state.seen ? '#ef4444' : PALETTE.muted, 'right');
    context.fillStyle = '#1f2937';
    context.fillRect(barX, barY, barWidth, barHeight);
    context.fillStyle = alarmColor(state.alarm);
    context.fillRect(barX, barY, barWidth * (state.alarm / 100), barHeight);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barWidth, barHeight);
    text(state.seen ? 'SPOTTED!' : 'HIDDEN', barX + barWidth / 2, barY + 2, 14, state.alarm > 35 ? '#0f172a' : PALETTE.text, 'center');
    // Loot, coins and time, right.
    const coinsTaken = state.coins.filter((coin) => coin.taken).length;
    text(state.lootTaken ? '◆ LOOT SECURED' : '◇ LOOT: DIAMOND', FIELD.width - 24, 14, 18, state.lootTaken ? PALETTE.gold : PALETTE.muted, 'right');
    text(`${coinsLabel(coinsTaken)} / ${state.coins.length} coins   ${timeLabel(Math.floor(state.elapsed))}s`, FIELD.width - 24, 46, 18, PALETTE.muted, 'right');
  }

  function drawBanner(title, lines, prompt) {
    // A slim band across the top of the room: the title, one line and the prompt, with the
    // whole room — diamond, guards, cameras — still visible beneath it.
    context.fillStyle = 'rgba(5, 7, 15, 0.78)';
    context.fillRect(0, 100, FIELD.width, 96);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 100, FIELD.width, 2);
    context.fillRect(0, 194, FIELD.width, 2);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, 140, 40, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, 166 + index * 26, 18, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, 190, 18, PALETTE.gold, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 200 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 128 + index * 34, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 24, PALETTE.gold, 'center');
  }

  const TITLE_LINES = ['Slip past the guards, dodge the cameras, steal the diamond.'];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const WIN_LINES = ['', '', ''];
  const CAUGHT_LINES = ['', 'The alarm hit 100%. The museum woke up.'];

  /** Paint one frame: the field, then the HUD or a banner/panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state);
      drawBanner('MIDNIGHT MUSEUM HEIST', TITLE_LINES, 'Move with WASD or arrows, or click where to go — press Space to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = `Escaped in ${Math.floor(state.elapsed)} seconds.`;
      WIN_LINES[2] = bestLabel(best);
      drawPanel('CLEAN GETAWAY!', WIN_LINES, 'Press Space or click to steal again');
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = finalLabel(state.score);
      drawPanel('CAUGHT!', CAUGHT_LINES, 'Press Space or click to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
