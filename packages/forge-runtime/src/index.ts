/**
 * Digital Forge runtime, phase 1.
 *
 * Quality, shots, and the decision to start the stage live here so the page
 * can import them without Three.js. The renderer itself is `startStage` in
 * `./stage`, loaded only after the first paint.
 */

export const FORGE_STAGE_ID = "forge-stage";

export const QUALITY_TIERS = ["quiet", "standard", "high", "quest"] as const;

export type QualityTier = (typeof QUALITY_TIERS)[number];

export const FORGE_CHOICE_KEY = "forge-choice";

export type ForgeChoice = "quiet" | "full";

export interface QualitySignals {
  /** Visitor asked the system to reduce motion. */
  reducedMotion?: boolean;
  /** Visitor asked the browser to save data. */
  saveData?: boolean;
  /** False when WebGL is missing or the frame probe failed. */
  webgl?: boolean;
  /** A wide screen with a fine pointer. Bloom and transmission stay here. */
  desktop?: boolean;
  /** An immersive session is starting. Skips the composer. */
  xr?: boolean;
  /** An explicit choice. Overrides the signals above. */
  force?: QualityTier;
}

/**
 * Pick a quality tier.
 *
 * Quiet mode is the poster and no loop. Phones get standard. Desktop gets
 * high. An immersive headset gets quest for the session.
 */
export function resolveQuality(signals: QualitySignals = {}): QualityTier {
  if (signals.force) return signals.force;
  if (signals.reducedMotion || signals.saveData || signals.webgl === false) return "quiet";
  if (signals.xr) return "quest";
  if (signals.desktop) return "high";
  return "standard";
}

export function readForgeChoice(storage: { getItem(key: string): string | null }): ForgeChoice | null {
  const value = storage.getItem(FORGE_CHOICE_KEY);
  return value === "quiet" || value === "full" ? value : null;
}

export function writeForgeChoice(storage: { setItem(key: string, value: string): void }, choice: ForgeChoice) {
  storage.setItem(FORGE_CHOICE_KEY, choice);
}

/**
 * Whether the stage should start. An explicit quiet choice sticks. An explicit
 * full choice still needs WebGL. Otherwise reduced motion, Save-Data, and a
 * failed probe stay on the poster.
 */
export function shouldStartForge(input: {
  choice: ForgeChoice | null;
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
}): boolean {
  if (input.choice === "quiet") return false;
  if (!input.webgl) return false;
  if (input.choice === "full") return true;
  if (input.reducedMotion || input.saveData) return false;
  return true;
}

export interface Shot {
  id: string;
  /** Seconds. Zero is a cut, not a travel. */
  duration: number;
}

export interface ShotSequencer {
  register(shot: Shot): void;
  /** Instant in phase 1. Phase 4 adds the clock and the skippable spline. */
  play(id: string): Shot | undefined;
  skip(): void;
  current(): Shot | undefined;
  list(): Shot[];
}

export function createShotSequencer(): ShotSequencer {
  const shots = new Map<string, Shot>();
  let active: Shot | undefined;

  return {
    register(shot) {
      if (!shot.id.trim()) throw new Error("Shot id is required");
      if (!Number.isFinite(shot.duration) || shot.duration < 0) {
        throw new Error("Shot duration cannot be negative");
      }
      shots.set(shot.id, shot);
    },
    play(id) {
      const shot = shots.get(id);
      if (!shot) return undefined;
      active = shot;
      return shot;
    },
    skip() {
      active = undefined;
    },
    current() {
      return active;
    },
    list() {
      return [...shots.values()];
    },
  };
}

export interface ForgeRenderer {
  readonly quality: QualityTier;
  readonly mounted: boolean;
  /** Phase 2 attaches the WebGLRenderer to this element. Phase 1 records it. */
  mount(host: HTMLElement): void;
  setQuality(quality: QualityTier): void;
  dispose(): void;
}

export function createRenderer(): ForgeRenderer {
  let quality: QualityTier = "quiet";
  let host: HTMLElement | null = null;

  return {
    get quality() {
      return quality;
    },
    get mounted() {
      return host !== null;
    },
    mount(next) {
      host = next;
    },
    setQuality(next) {
      quality = next;
    },
    dispose() {
      host = null;
    },
  };
}

export interface ForgeRuntime {
  renderer: ForgeRenderer;
  shots: ShotSequencer;
  setQuality(signals?: QualitySignals): QualityTier;
}

export { HUB_ASSETS, HUB_INSTANCES } from "./hub.ts";

export {
  BRIDGE_IDS,
  CRYSTAL_IDS,
  EYE_HEIGHT,
  bridgeRun,
  crystalSpots,
  isReadingPath,
  kitFile,
  panelAnchor,
  plazaStance,
  portalStance,
  stanceFor,
  stanceIdFromPath,
  smoothstep,
} from "./layout.ts";

export function createForgeRuntime(): ForgeRuntime {
  const renderer = createRenderer();
  const shots = createShotSequencer();

  return {
    renderer,
    shots,
    setQuality(signals = {}) {
      const tier = resolveQuality(signals);
      renderer.setQuality(tier);
      return tier;
    },
  };
}
