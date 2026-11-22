// The game's rules and state, with no drawing and no browser in it: the thief, the patrolling
// guards and their vision cones, the sweeping wall cameras, the alarm meter, the diamond and
// the coins, the exit door. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. Nothing
// here allocates after createWorld returns.
import {
  ALARM, CAMERA, CAMERA_SPOTS, CASES, COIN, COIN_SPOTS, EXIT, FIELD, GUARD,
  GUARD_PATROLS, LOOT, ROOM, THIEF,
} from './config.js';
import { canSee } from './vision.js';

export const EVENT_LOOT = 1;
export const EVENT_COIN = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_WIN = 8;
export const EVENT_CAUGHT = 16;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Push a circle out of a solid rectangle, so the thief slides along display cases. */
function pushOutOfRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distance = Math.hypot(dx, dy);
  if (distance >= circle.radius || distance === 0) return;
  circle.x = nearestX + (dx / distance) * circle.radius;
  circle.y = nearestY + (dy / distance) * circle.radius;
}

export function createWorld(random) {
  const thief = {
    x: 640, y: 620, radius: THIEF.radius, face: -Math.PI / 2,
    clickX: null, clickY: null, hasLoot: false,
  };
  const guards = GUARD_PATROLS.map((patrol) => ({
    waypoints: patrol.waypoints,
    index: 0,
    x: patrol.waypoints[0].x,
    y: patrol.waypoints[0].y,
    radius: GUARD.radius,
    angle: 0,
    baseAngle: 0,
    pause: 0,
    sweepPhase: random() * Math.PI * 2,
    spotted: false,
  }));
  const cameras = CAMERA_SPOTS.map((spot) => ({
    x: spot.x, y: spot.y, baseAngle: spot.baseAngle, angle: spot.baseAngle, spotted: false,
  }));
  const coins = COIN_SPOTS.map((spot) => ({ x: spot.x, y: spot.y, taken: false }));
  const state = {
    thief, guards, cameras, coins,
    alarm: 0, score: 0, elapsed: 0, seen: false, spottedBy: null,
    lootTaken: false, won: false, caught: false,
  };

  function reset() {
    thief.x = 640;
    thief.y = 620;
    thief.face = -Math.PI / 2;
    thief.clickX = null;
    thief.clickY = null;
    thief.hasLoot = false;
    for (let index = 0; index < guards.length; index += 1) {
      const guard = guards[index];
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.index = 0;
      guard.angle = 0;
      guard.pause = 0;
      guard.spotted = false;
    }
    for (let index = 0; index < cameras.length; index += 1) {
      cameras[index].angle = cameras[index].baseAngle;
      cameras[index].spotted = false;
    }
    for (const coin of coins) coin.taken = false;
    state.alarm = 0;
    state.score = 0;
    state.elapsed = 0;
    state.seen = false;
    state.spottedBy = null;
    state.lootTaken = false;
    state.won = false;
    state.caught = false;
  }

  /** Where the thief is heading: the keys, or the clicked point, or nowhere. */
  function steering(move) {
    if (move.x !== 0 || move.y !== 0) {
      thief.clickX = null;
      thief.clickY = null;
      return move;
    }
    if (thief.clickX !== null) {
      const dx = thief.clickX - thief.x;
      const dy = thief.clickY - thief.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) {
        thief.clickX = null;
        thief.clickY = null;
        return { x: 0, y: 0 };
      }
      return { x: dx / distance, y: dy / distance };
    }
    return { x: 0, y: 0 };
  }

  function moveThief(dt, move) {
    const dir = steering(move);
    if (dir.x === 0 && dir.y === 0) return;
    thief.face = Math.atan2(dir.y, dir.x);
    thief.x += dir.x * THIEF.speed * dt;
    thief.y += dir.y * THIEF.speed * dt;
    thief.x = clamp(thief.x, ROOM.x + thief.radius, ROOM.x + ROOM.width - thief.radius);
    thief.y = clamp(thief.y, ROOM.y + thief.radius, ROOM.y + ROOM.height - thief.radius);
    for (const rect of CASES) pushOutOfRect(thief, rect);
  }

  function moveGuard(guard, dt, hurried) {
    const speed = hurried ? GUARD.alertSpeed : GUARD.patrolSpeed;
    if (guard.pause > 0) {
      guard.pause = Math.max(0, guard.pause - dt);
      // At a waypoint the guard sweeps its gaze back and forth around where it faces.
      guard.sweepPhase += dt * 2.2;
      guard.angle = guard.baseAngle + Math.sin(guard.sweepPhase) * GUARD.sweep;
      return;
    }
    const target = guard.waypoints[(guard.index + 1) % guard.waypoints.length];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) {
      guard.index = (guard.index + 1) % guard.waypoints.length;
      guard.pause = GUARD.waypointPause;
      guard.baseAngle = guard.angle;
      return;
    }
    guard.angle = Math.atan2(dy, dx);
    guard.x += (dx / distance) * speed * dt;
    guard.y += (dy / distance) * speed * dt;
  }

  function sweepCameras() {
    for (const camera of cameras) {
      camera.angle = camera.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed) * CAMERA.sweep;
    }
  }

  /** True when any guard or camera has the thief in sight right now. */
  function watch() {
    let seen = false;
    let by = null;
    for (const guard of guards) {
      guard.spotted = canSee(thief.x, thief.y, guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle, CASES);
      if (guard.spotted) {
        seen = true;
        by = guard;
      }
    }
    for (const camera of cameras) {
      camera.spotted = canSee(thief.x, thief.y, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.coneHalfAngle, CASES);
      if (camera.spotted) {
        seen = true;
        by = by ?? camera;
      }
    }
    return { seen, by };
  }

  /**
   * One fixed step. `move` is the keyboard steering vector. With `harmless` set (the title
   * screen's backdrop) the thief stands still, nothing is spotted and nothing scores.
   */
  function step(dt, move, harmless) {
    let events = 0;
    state.elapsed += dt;
    const hurried = state.alarm > 50;

    if (!harmless) moveThief(dt, move);
    for (const guard of guards) moveGuard(guard, dt, hurried);
    sweepCameras();

    if (harmless) return events;

    const watchResult = watch();
    const wasSeen = state.seen;
    state.seen = watchResult.seen;
    state.spottedBy = watchResult.by;
    if (state.seen) {
      if (!wasSeen) events |= EVENT_SPOTTED;
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.rise * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.fall * dt);
    }
    if (state.alarm >= ALARM.max) {
      state.caught = true;
      return events | EVENT_CAUGHT;
    }

    if (!state.lootTaken && Math.hypot(thief.x - LOOT.x, thief.y - LOOT.y) < LOOT.grabRadius) {
      state.lootTaken = true;
      thief.hasLoot = true;
      state.score += LOOT.points;
      events |= EVENT_LOOT;
    }
    for (const coin of coins) {
      if (!coin.taken && Math.hypot(thief.x - coin.x, thief.y - coin.y) < COIN.grabRadius) {
        coin.taken = true;
        state.score += COIN.points;
        events |= EVENT_COIN;
      }
    }
    if (state.lootTaken && thief.x > EXIT.x && thief.x < EXIT.x + EXIT.width
      && thief.y > EXIT.y - 6 && thief.y < EXIT.y + EXIT.height + 6) {
      state.won = true;
      state.score += Math.max(0, 300 - Math.floor(state.elapsed));
      return events | EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
