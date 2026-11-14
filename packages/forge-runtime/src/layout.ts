/** Local pose of a portal on Island_01's plaza. three.js Y-up, portal faces +Z. */
export const PORTAL_LOCAL = { x: 0, y: 0.46, z: -2.2 } as const;

export interface IslandPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

/**
 * Three islands around the origin. Local +Z of each island points at the Forge,
 * which is the direction the portal faces.
 */
export function islandPlacement(index: number, count = 3, radius = 32): IslandPlacement {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const rotationY = Math.atan2(-Math.cos(angle), -Math.sin(angle));
  const scales = [0.92, 1, 1.06];
  const heights = [1.4, 0.2, 2.2];
  return {
    x,
    y: heights[index % heights.length] ?? 0,
    z,
    rotationY,
    scale: scales[index % scales.length] ?? 1,
  };
}

/** World direction of an object's local +Z after a Y rotation. */
export function localForwardY(rotationY: number): { x: number; z: number } {
  return { x: Math.sin(rotationY), z: Math.cos(rotationY) };
}
