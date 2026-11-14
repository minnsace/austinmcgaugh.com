/** Local pose of a portal on Island_01's plaza. three.js Y-up, portal faces +Z. */
export const PORTAL_LOCAL = { x: 0, y: 0.46, z: -2.2 } as const;

/** Eye height of someone standing on a deck. */
export const EYE_HEIGHT = 1.7;

/** Outer tread of the Forge dais, where a bridge landing rests. */
export const FORGE_TREAD_Y = 0.31;
export const FORGE_ANCHOR_RADIUS = 5.66;

/** Island_01's front rim, in island-local three.js metres. Local +Z faces the Forge. */
export const ISLAND_RIM_Z = 9.74;

/** A landing runs 3 m from its In snap to its Anchor. */
export const LANDING_REACH = 3;

/** Straight run between the two landings, in 4 m and 8 m pieces. */
export const BRIDGE_SPAN = 16;

/** World radius of every island rim. The centre radius grows with scale so the rim stays put. */
export const RIM_RADIUS = FORGE_ANCHOR_RADIUS + LANDING_REACH + BRIDGE_SPAN + LANDING_REACH;

const SCALES = [0.96, 1, 1.04] as const;
const HEIGHT_STEPS = [0, 1, 2] as const;

export const BRIDGE_IDS = ["Bridge_Landing", "Bridge_Span_8m", "Bridge_Straight_4m", "Bridge_Ramp_4m"] as const;
export const CRYSTAL_IDS = ["Crystals_01", "Crystals_02", "Crystals_03", "Crystals_04", "Crystals_05"] as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface IslandPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface PlacedPiece {
  id: (typeof BRIDGE_IDS)[number];
  pose: Pose;
}

export interface Stance {
  id: string;
  position: Vec3;
  look: Vec3;
}

/** Out snap of a piece whose root sits on its In snap. three.js, travel along local −Z. */
const SNAPS: Record<string, { x: number; y: number; z: number; yaw: number }> = {
  Bridge_Straight_2m: { x: 0, y: 0, z: -2, yaw: 0 },
  Bridge_Straight_4m: { x: 0, y: 0, z: -4, yaw: 0 },
  Bridge_Span_8m: { x: 0, y: 0, z: -8, yaw: 0 },
  Bridge_Ramp_4m: { x: 0, y: 1, z: -4, yaw: 0 },
  Bridge_Curve15_L: { x: -0.409, y: 0, z: -3.106, yaw: (15 * Math.PI) / 180 },
  Bridge_Curve15_R: { x: 0.409, y: 0, z: -3.106, yaw: (-15 * Math.PI) / 180 },
  Bridge_Curve30_L: { x: -1.608, y: 0, z: -6, yaw: (30 * Math.PI) / 180 },
  Bridge_Curve30_R: { x: 1.608, y: 0, z: -6, yaw: (-30 * Math.PI) / 180 },
  Bridge_Landing: { x: 0, y: 0, z: -3, yaw: 0 },
};

const MIDDLES: Record<number, PlacedPiece["id"][]> = {
  0: ["Bridge_Span_8m", "Bridge_Straight_4m", "Bridge_Straight_4m"],
  1: ["Bridge_Ramp_4m", "Bridge_Span_8m", "Bridge_Straight_4m"],
  2: ["Bridge_Ramp_4m", "Bridge_Ramp_4m", "Bridge_Span_8m"],
};

/**
 * Three islands around the Forge. Local +Z points at the origin, which is the
 * direction the portal faces and the side the bridge lands on.
 */
export function islandPlacement(index: number, count = 3): IslandPlacement {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  const scale = SCALES[index % SCALES.length] ?? 1;
  const radius = RIM_RADIUS + ISLAND_RIM_Z * scale;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const rotationY = Math.atan2(-Math.cos(angle), -Math.sin(angle));
  return {
    x,
    y: FORGE_TREAD_Y + (HEIGHT_STEPS[index % HEIGHT_STEPS.length] ?? 0),
    z,
    rotationY,
    scale,
  };
}

/** World direction of an object's local +Z after a Y rotation. */
export function localForwardY(rotationY: number): { x: number; z: number } {
  return { x: Math.sin(rotationY), z: Math.cos(rotationY) };
}

/** Travel direction (local −Z) after a Y rotation. */
export function travelOf(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function yawFromTravel(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

export function appendPiece(pose: Pose, id: string): Pose {
  const snap = SNAPS[id];
  if (!snap) throw new Error(`Unknown bridge piece ${id}`);
  const cos = Math.cos(pose.yaw);
  const sin = Math.sin(pose.yaw);
  return {
    x: pose.x + snap.x * cos + snap.z * sin,
    y: pose.y + snap.y,
    z: pose.z - snap.x * sin + snap.z * cos,
    yaw: pose.yaw + snap.yaw,
  };
}

export function islandLocalToWorld(place: IslandPlacement, local: Vec3, scaleVertical = true): Vec3 {
  const x = local.x * place.scale;
  const y = scaleVertical ? local.y * place.scale : local.y;
  const z = local.z * place.scale;
  const cos = Math.cos(place.rotationY);
  const sin = Math.sin(place.rotationY);
  return {
    x: place.x + x * cos + z * sin,
    y: place.y + y,
    z: place.z - x * sin + z * cos,
  };
}

/** One radial bridge from the dais tread to an island rim. Pieces are posed on their In snap. */
export function bridgeRun(index: number): PlacedPiece[] {
  const place = islandPlacement(index);
  const theta = Math.atan2(place.z, place.x);
  const outwardX = Math.cos(theta);
  const outwardZ = Math.sin(theta);
  const inPoint = {
    x: outwardX * (FORGE_ANCHOR_RADIUS + LANDING_REACH),
    y: FORGE_TREAD_Y,
    z: outwardZ * (FORGE_ANCHOR_RADIUS + LANDING_REACH),
  };
  const pieces: PlacedPiece[] = [
    {
      id: "Bridge_Landing",
      pose: { ...inPoint, yaw: yawFromTravel(-outwardX, -outwardZ) },
    },
  ];
  let cursor: Pose = { ...inPoint, yaw: yawFromTravel(outwardX, outwardZ) };
  for (const id of MIDDLES[index] ?? MIDDLES[0]) {
    pieces.push({ id, pose: { ...cursor } });
    cursor = appendPiece(cursor, id);
  }
  pieces.push({ id: "Bridge_Landing", pose: { ...cursor } });
  return pieces;
}

export function crystalSpots(index: number): { id: (typeof CRYSTAL_IDS)[number]; x: number; y: number; z: number; yaw: number }[] {
  const turn = index * 0.35;
  const spots = [
    { id: "Crystals_01" as const, x: -6.4, y: 0, z: -5.6, yaw: 0.4 },
    { id: "Crystals_02" as const, x: 6.6, y: 0, z: -3.8, yaw: -0.5 },
    { id: "Crystals_03" as const, x: -7.1, y: 0, z: 1.6, yaw: 0.8 },
    { id: "Crystals_04" as const, x: 6.3, y: 0, z: 2.2, yaw: 2.4 },
    { id: "Crystals_05" as const, x: 2.2, y: 0, z: -7.1, yaw: 0.2 },
  ];
  return spots.map((spot) => ({ ...spot, yaw: spot.yaw + turn }));
}

export function kitFile(id: string, quest: boolean): string {
  return quest ? `/models/quest/${id}_quest.glb` : `/models/${id}_web.glb`;
}

/** Portal poses from Hub_Layout.json, three.js Y-up. Deck height is the island's y. */
const HUB_PORTALS = [
  { id: "projects", x: 0, y: 0.46, z: 45.181, deckY: 0 },
  { id: "journal", x: 40.729, y: 1.46, z: -23.515, deckY: 1 },
  { id: "workshop", x: -35.841, y: 0.46, z: -20.693, deckY: 0 },
] as const;

export function plazaStance(): Stance {
  // On the central deck ring, looking through the Forge toward the Projects bridge.
  return {
    id: "plaza",
    position: { x: 1.4, y: EYE_HEIGHT, z: -11.2 },
    look: { x: 0, y: 5.6, z: 14 },
  };
}

export function portalStance(index: number): Stance {
  const portal = HUB_PORTALS[index] ?? HUB_PORTALS[0];
  const reach = Math.hypot(portal.x, portal.z) || 1;
  const stand = 6.4;
  return {
    id: portal.id,
    position: {
      x: portal.x - (portal.x / reach) * stand,
      y: portal.deckY + EYE_HEIGHT,
      z: portal.z - (portal.z / reach) * stand,
    },
    look: { x: portal.x, y: portal.deckY + 2.15, z: portal.z },
  };
}

export function stanceFor(id: string): Stance | null {
  if (id === "plaza" || id === "home" || id === "about") return plazaStance();
  const index = ["projects", "journal", "workshop"].indexOf(id);
  if (index < 0) return null;
  return portalStance(index);
}

/** A point `distance` metres along the stance's gaze, shifted `side` metres to the right. */
export function panelAnchor(stance: Stance, distance = 2.2, side = 0.9): Vec3 {
  const dx = stance.look.x - stance.position.x;
  const dy = stance.look.y - stance.position.y;
  const dz = stance.look.z - stance.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  const horizontal = Math.hypot(fx, fz) || 1;
  const rightX = fz / horizontal;
  const rightZ = -fx / horizontal;
  return {
    x: stance.position.x + fx * distance + rightX * side,
    y: stance.position.y + (dy / len) * distance + 0.34,
    z: stance.position.z + fz * distance + rightZ * side,
  };
}

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function stanceIdFromPath(pathname: string): "plaza" | "projects" | "journal" | "workshop" {
  const path = pathname.toLowerCase();
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/journal")) return "journal";
  if (path.startsWith("/workshop")) return "workshop";
  return "plaza";
}

export function isReadingPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return false;
  if (parts[1] === "tags" || parts[1] === "rss.xml") return false;
  return parts[0] === "journal" || parts[0] === "projects";
}

/** How far the Quest panel arc sits in front of the headset, in metres. */
export const VR_PANEL_DISTANCE = 1.28;

export interface VrPlate {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  /** Metres from the eye to the plate. */
  distance: number;
}

/**
 * Three glass plates in a gentle arc, each facing the wearer.
 * Local +Z points back at the camera. Distances stay between 1.2 m and 1.5 m.
 */
export function vrPlateLayout(): VrPlate[] {
  const specs = [
    { x: -0.62, y: -0.05, z: -0.05, width: 0.56, height: 0.4 },
    { x: 0, y: -0.08, z: 0.08, width: 0.46, height: 0.34 },
    { x: 0.62, y: -0.05, z: -0.05, width: 0.52, height: 0.38 },
  ];
  return specs.map((spec) => {
    const depth = VR_PANEL_DISTANCE - spec.z;
    const distance = Math.hypot(spec.x, spec.y, depth);
    const yaw = Math.atan2(-spec.x, depth);
    return { ...spec, yaw, distance };
  });
}
