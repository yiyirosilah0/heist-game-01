// The screenshot scenes behind ?shot=start|play|win|caught. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a short game really looks like and the same seed always gives the same
// frame. The careful pilot waits when its next step would walk into a cone; the reckless one
// charges straight at the diamond and gets caught.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { canSee } from './vision.js';
import { CAMERA, CASES, GUARD } from './config.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 4;
const LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Waypoints down the carpet to the diamond, then back out to the exit. */
const TO_LOOT = [
  { x: 640, y: 430 },
  { x: 640, y: 300 },
  { x: 640, y: 235 },
];
const TO_EXIT = [{ x: 640, y: 430 }, { x: 640, y: 665 }];

/** True when standing at (x, y) would put the thief in any guard or camera cone. */
function wouldBeSeen(state, x, y) {
  for (const guard of state.guards) {
    if (canSee(x, y, guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle, CASES)) return true;
  }
  for (const camera of state.cameras) {
    if (canSee(x, y, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.coneHalfAngle, CASES)) return true;
  }
  return false;
}

/** Steer toward the waypoint: back away when an eye is already on the thief, wait when the
 * next step would walk into a cone, else walk. */
function carefulPilot(state, waypoints, waypointIndex) {
  const thief = state.thief;
  const target = waypoints[Math.min(waypointIndex, waypoints.length - 1)];
  const dx = target.x - thief.x;
  const dy = target.y - thief.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return { move: { x: 0, y: 0 }, arrived: true };
  if (state.seen && state.spottedBy) {
    const ax = thief.x - state.spottedBy.x;
    const ay = thief.y - state.spottedBy.y;
    const length = Math.hypot(ax, ay) || 1;
    return { move: { x: ax / length, y: ay / length }, arrived: false };
  }
  const stepX = (dx / distance) * 235 * SAMPLE;
  const stepY = (dy / distance) * 235 * SAMPLE;
  if (wouldBeSeen(state, thief.x + stepX, thief.y + stepY)) {
    return { move: { x: 0, y: 0 }, arrived: false };
  }
  return { move: { x: dx / distance, y: dy / distance }, arrived: false };
}

/** Charge at the target with no regard for cones — and when an eye lands on the thief, run to
 * a point right in front of that eye and stay there, so the exposure never breaks and the
 * alarm fills. */
function recklessPilot(state, target) {
  const thief = state.thief;
  if (state.seen && state.spottedBy) {
    const eye = state.spottedBy;
    target = { x: eye.x + Math.cos(eye.angle) * 90, y: eye.y + Math.sin(eye.angle) * 90 };
  }
  const dx = target.x - thief.x;
  const dy = target.y - thief.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return { x: 0, y: 0 };
  return { x: dx / distance, y: dy / distance };
}

/**
 * Set `world` to the named scene (start, play, win or caught; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'caught') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'caught') {
    for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
      const move = recklessPilot(world.state, { x: 640, y: 235 });
      if (world.step(STEP, move, false) & EVENT_CAUGHT) break;
    }
    if (!world.state.caught) {
      world.state.alarm = 100;
      world.state.caught = true;
    }
    return { screen: SCREEN_CAUGHT, best: world.state.score };
  }

  // play and win: the careful pilot, down the carpet to the diamond, then (win only) out.
  let waypoints = TO_LOOT;
  let waypointIndex = 0;
  const limit = name === 'win' ? LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const pilot = carefulPilot(world.state, waypoints, waypointIndex);
    if (pilot.arrived) {
      waypointIndex += 1;
      if (waypointIndex >= waypoints.length) {
        if (name === 'win' && world.state.lootTaken) {
          waypoints = TO_EXIT;
          waypointIndex = 0;
        } else {
          break;
        }
      }
      continue;
    }
    const events = world.step(STEP, pilot.move, false);
    if (events & EVENT_WIN) break;
    if (events & EVENT_CAUGHT) break;
  }
  if (name === 'win') {
    if (!world.state.won) {
      // The careful pilot never quite made it: place the thief at the exit with the loot,
      // the frame a win really looks like, with the same time bonus a real win earns.
      world.state.thief.x = 640;
      world.state.thief.y = 620;
      world.state.thief.hasLoot = true;
      if (!world.state.lootTaken) {
        world.state.lootTaken = true;
        world.state.score += 500;
      }
      world.state.score += Math.max(0, 300 - Math.floor(world.state.elapsed));
      world.state.won = true;
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  return { screen: world.state.caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: world.state.score };
}
