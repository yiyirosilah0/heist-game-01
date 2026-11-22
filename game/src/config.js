// Every tuning number, colour and room fixture in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The museum is one room: a red carpet runs from the entry door at the
// bottom to the diamond pedestal at the top, display cases block sight and movement, three
// guards patrol and two wall cameras sweep.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The room's inner walls (the HUD strip sits above it). */
export const ROOM = { x: 36, y: 92, width: 1208, height: 592 };

/** The red carpet from the entry to the diamond. */
export const CARPET = { x: 596, y: 108, width: 88, height: 556 };

export const THIEF = { radius: 14, speed: 235 };

export const GUARD = {
  radius: 15,
  patrolSpeed: 72,
  alertSpeed: 108,
  coneRange: 238,
  coneHalfAngle: 0.61,
  waypointPause: 1.2,
  sweep: 0.7,
};

export const CAMERA = {
  range: 268,
  coneHalfAngle: 0.5,
  sweep: 0.55,
  sweepSpeed: 0.55,
};

/** Alarm: how fast it fills while any eye is on the thief, and how fast it drains hidden. */
export const ALARM = { rise: 30, fall: 22, max: 100 };

export const LOOT = { x: 640, y: 210, grabRadius: 36, points: 500 };
export const COIN = { radius: 11, grabRadius: 28, points: 100 };
export const EXIT = { x: 600, y: 656, width: 80, height: 28 };

/** Display cases: solid, they block movement and sight. */
export const CASES = [
  { x: 228, y: 248, width: 132, height: 64 },
  { x: 920, y: 248, width: 132, height: 64 },
  { x: 228, y: 478, width: 132, height: 64 },
  { x: 920, y: 478, width: 132, height: 64 },
  { x: 412, y: 356, width: 92, height: 58 },
  { x: 776, y: 356, width: 92, height: 58 },
];

/** Gold coins tucked in the corners, away from the safe carpet. */
export const COIN_SPOTS = [
  { x: 138, y: 158 },
  { x: 1142, y: 158 },
  { x: 138, y: 612 },
  { x: 1142, y: 612 },
];

/** Guard patrols: waypoints the guard walks between, pausing and sweeping at each end. */
export const GUARD_PATROLS = [
  { waypoints: [{ x: 170, y: 280 }, { x: 1110, y: 280 }] },
  { waypoints: [{ x: 1110, y: 522 }, { x: 170, y: 522 }] },
  { waypoints: [{ x: 380, y: 352 }, { x: 900, y: 352 }] },
];

/** Wall cameras: position and the direction they face at rest. */
export const CAMERA_SPOTS = [
  { x: 64, y: 118, baseAngle: 0.96 },
  { x: 1216, y: 118, baseAngle: Math.PI - 0.96 },
];

/** Framed paintings hung on the walls, for the room's look only. */
export const PAINTINGS = [
  { x: 150, y: 100, width: 74, height: 52, hue: '#8a5a2b' },
  { x: 420, y: 100, width: 74, height: 52, hue: '#2b5a8a' },
  { x: 786, y: 100, width: 74, height: 52, hue: '#5a2b8a' },
  { x: 1056, y: 100, width: 74, height: 52, hue: '#2b8a5a' },
  { x: 150, y: 620, width: 74, height: 52, hue: '#8a2b3d' },
  { x: 1056, y: 620, width: 74, height: 52, hue: '#b08a2b' },
];

export const PALETTE = {
  backdrop: '#05070f',
  floorA: '#151b31',
  floorB: '#11162a',
  carpet: '#6e1b26',
  carpetEdge: '#c9a227',
  wall: '#232c4a',
  wallTrim: '#c9a227',
  caseTop: '#2c3a5e',
  caseGlass: '#7fa8c9',
  thief: '#2dd4bf',
  thiefDark: '#0f766e',
  guard: '#e5484d',
  guardDark: '#7f1d1d',
  coneGuard: '255, 176, 32',
  coneCamera: '255, 92, 60',
  diamond: '#a5f3fc',
  diamondCore: '#ecfeff',
  gold: '#f2c94c',
  goldDark: '#b8860b',
  exitGlow: '#34d399',
  text: '#f4ead5',
  muted: '#9aa3b8',
  panel: '#0d1226',
  alarmLow: '#34d399',
  alarmMid: '#f2c94c',
  alarmHigh: '#ef4444',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-museum-heist.best';
