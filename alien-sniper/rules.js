/** Shared wall / robot geometry. World y is measured upwards from the wall's lower edge. */
export const WALL = Object.freeze({ width: 18, height: 10, holeRadius: 0.58 });
export const TARGET_BOUNDS = Object.freeze({ minX: -7.8, maxX: 7.8, minY: 1.35, maxY: 8.65 });
export const POSES = Object.freeze(['stand', 'crouch', 'lean']);

export function getTargetParts(target) {
  if (!target) return [];
  const x = target.x, y = target.y;
  const part = (name, dx, dy, rx, ry, kind = 'body') => ({ part: name, kind, x: x + dx, y: y + dy, rx, ry });
  if (target.pose === 'crouch') return [
    part('head', 0, 0.35, 0.42, 0.42, 'head'),
    part('torso', 0, -0.35, 0.48, 0.42),
    part('left-leg', -0.27, -0.9, 0.28, 0.25), part('right-leg', 0.27, -0.9, 0.28, 0.25),
    part('left-arm', -0.55, -0.36, 0.16, 0.35), part('right-arm', 0.55, -0.36, 0.16, 0.35),
  ];
  if (target.pose === 'lean') return [
    part('head', 0.42, 0.72, 0.42, 0.42, 'head'),
    part('torso', 0.12, -0.05, 0.46, 0.6),
    part('left-leg', -0.2, -0.86, 0.16, 0.42), part('right-leg', 0.25, -0.86, 0.16, 0.42),
    part('left-arm', -0.44, -0.13, 0.16, 0.56), part('right-arm', 0.7, 0.05, 0.16, 0.56),
  ];
  return [
    part('head', 0, 0.85, 0.42, 0.42, 'head'),
    part('torso', 0, -0.05, 0.42, 0.62),
    part('left-leg', -0.23, -0.86, 0.16, 0.42), part('right-leg', 0.23, -0.86, 0.16, 0.42),
    part('left-arm', -0.58, -0.12, 0.16, 0.58), part('right-arm', 0.58, -0.12, 0.16, 0.58),
  ];
}

/** Head has priority where the stylised body ellipses overlap. */
export function hitTarget(target, x, y) {
  const parts = getTargetParts(target);
  for (const kind of ['head', 'body']) {
    if (parts.some(p => p.kind === kind && ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1)) return kind;
  }
  return 'miss';
}

function circleTouchesEllipse(hole, ellipse) {
  const px = Math.abs(hole.x - ellipse.x), py = Math.abs(hole.y - ellipse.y);
  const a = ellipse.rx, b = ellipse.ry, radius = WALL.holeRadius;
  if (px > a + radius || py > b + radius) return false;
  if ((px / a) ** 2 + (py / b) ** 2 <= 1) return true;
  // The nearest point on an ellipse is found by the monotonic Lagrange multiplier equation.
  const aa = a * a, bb = b * b;
  const value = t => (a * px / (t + aa)) ** 2 + (b * py / (t + bb)) ** 2;
  let low = 0, high = Math.max(a * px, b * py, 1);
  while (value(high) > 1) high *= 2;
  for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (value(mid) > 1) low = mid; else high = mid; }
  const qx = aa * px / (high + aa), qy = bb * py / (high + bb);
  return (px - qx) ** 2 + (py - qy) ** 2 <= radius * radius + 1e-8;
}

export function targetVisible(target, holes) {
  const parts = getTargetParts(target);
  return Boolean(target) && holes.some(hole => parts.some(part => circleTouchesEllipse(hole, part)));
}
