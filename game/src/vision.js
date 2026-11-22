// Sight math: vision cones and line of sight. A guard or a camera sees the thief when the
// thief is inside its cone and no display case stands between them. Sight is checked by
// sampling points along the line, which is cheap and exact enough for a room this size.

/** True when the point (px, py) lies inside the cone from (ox, oy) facing `angle`. */
export function inCone(px, py, ox, oy, angle, range, halfAngle) {
  const dx = px - ox;
  const dy = py - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 1) return true;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfAngle;
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

/** True when any rectangle blocks the straight line from (x1, y1) to (x2, y2). */
export function lineBlocked(x1, y1, x2, y2, rects) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (let r = 0; r < rects.length; r += 1) {
      if (pointInRect(px, py, rects[r])) return true;
    }
  }
  return false;
}

/** True when the watcher at (ox, oy) facing `angle` can see the point (px, py). */
export function canSee(px, py, ox, oy, angle, range, halfAngle, rects) {
  return inCone(px, py, ox, oy, angle, range, halfAngle) && !lineBlocked(ox, oy, px, py, rects);
}

/** The fan of points that outlines a cone, for drawing it as a filled wedge. */
export function coneFan(ox, oy, angle, range, halfAngle) {
  const points = [{ x: ox, y: oy }];
  const steps = 14;
  for (let index = 0; index <= steps; index += 1) {
    const a = angle - halfAngle + (2 * halfAngle * index) / steps;
    points.push({ x: ox + Math.cos(a) * range, y: oy + Math.sin(a) * range });
  }
  return points;
}
