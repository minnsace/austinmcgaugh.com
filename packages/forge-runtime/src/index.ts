/**
 * Digital Forge runtime, phase 1.
 *
 * The website ships this as a typed contract only. `mount` does not create a
 * canvas and this module does not import three. Phase 2 puts a Three.js
 * WebGLRenderer inside the stage element and starts the frame loop from here,
 * still behind the same quality switch.
 */

export const FORGE_STAGE_ID = "forge-stage";

export const QUALITY_TIERS = ["quiet", "standard", "high"] as const;

export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualitySignals {
  /** Visitor asked the system to reduce motion. */
  reducedMotion?: boolean;
  /** Visitor asked the browser to save data. */
  saveData?: boolean;
  /** False when WebGL is missing or the frame probe failed. */
  webgl?: boolean;
  /** An explicit choice. Overrides the signals above. */
  force?: QualityTier;
}

/**
 * Pick a quality tier.
 *
 * Quiet mode is the poster and no loop. Phase 1 forces quiet at render time
 * because there is no scene yet. Phase 2 stops forcing it and passes the
 * real signals from the browser.
 */
export function resolveQuality(signals: QualitySignals = {}): QualityTier {
  if (signals.force) return signals.force;
  if (signals.reducedMotion || signals.saveData || signals.webgl === false) return "quiet";
  return "standard";
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
