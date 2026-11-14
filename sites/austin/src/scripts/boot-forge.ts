import {
  FORGE_STAGE_ID,
  readForgeChoice,
  resolveQuality,
  shouldStartForge,
  writeForgeChoice,
} from "@digital-forge/runtime";
import type { StageHandle } from "@digital-forge/runtime/stage";
import { brand } from "../brand/manifest";

const portals = [
  {
    id: "projects",
    nodePrefix: "Portal_Projects",
    file: "/models/Portal_Projects_web.glb",
    href: "/projects/",
    title: "Projects",
    summary: "Deadlight Tavern and FreeSnakeGame.",
    color: 0x3d7eff,
  },
  {
    id: "journal",
    nodePrefix: "Portal_Knowledge",
    file: "/models/Portal_Knowledge_web.glb",
    href: "/journal/i-bought-a-5-domain-on-impulse/",
    title: "Journal",
    summary: "I Bought a $5 Domain on Impulse. Now It's a Game.",
    color: 0x9b87ff,
  },
  {
    id: "workshop",
    nodePrefix: "Portal_Workshop",
    file: "/models/Portal_Workshop_web.glb",
    href: "/workshop/",
    title: "Workshop",
    summary: brand.organization.name,
    color: 0xff8a3d,
  },
];

export function bootForge() {
  const host = document.getElementById(FORGE_STAGE_ID);
  if (!host) return;

  const controls = document.createElement("div");
  controls.className = "forge-controls";
  const quietButton = document.createElement("button");
  quietButton.type = "button";
  quietButton.className = "forge-quiet";
  const vrButton = document.createElement("button");
  vrButton.type = "button";
  vrButton.className = "forge-vr";
  vrButton.textContent = "Enter VR";
  vrButton.hidden = true;
  controls.append(quietButton, vrButton);
  document.body.append(controls);

  let handle: StageHandle | null = null;
  let starting = false;

  const signals = () => ({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: (navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData === true,
    webgl: probeWebGL(),
    desktop: window.matchMedia("(min-width: 900px) and (pointer: fine)").matches,
  });

  const refreshQuietLabel = () => {
    quietButton.textContent = handle ? "Quiet" : "Show the forge";
  };

  const launch = async () => {
    if (handle || starting) return;
    const current = signals();
    if (!current.webgl) {
      host.dataset.quality = "quiet";
      return;
    }
    starting = true;
    const tier = resolveQuality(current);
    if (tier === "quiet") {
      starting = false;
      return;
    }
    try {
      const stage = await import("@digital-forge/runtime/stage");
      handle = await stage.startStage(host, {
        tier,
        assets: {
          forge: "/models/Forge_Asset01_web.glb",
          island: "/models/Island_01_web.glb",
          env: "/models/Forge_Env_Nebula.hdr",
          portals,
        },
      });
      host.dataset.quality = tier;
      void offerVR();
    } catch (error) {
      console.error(error);
      host.dataset.quality = "quiet";
      handle = null;
    } finally {
      starting = false;
      refreshQuietLabel();
    }
  };

  quietButton.addEventListener("click", () => {
    if (handle) {
      writeForgeChoice(localStorage, "quiet");
      handle.dispose();
      handle = null;
      vrButton.hidden = true;
      host.dataset.quality = "quiet";
      refreshQuietLabel();
      return;
    }
    writeForgeChoice(localStorage, "full");
    void launch();
  });

  vrButton.addEventListener("click", () => {
    void handle?.enterVR();
  });

  refreshQuietLabel();
  const choice = readForgeChoice(localStorage);
  const current = signals();
  if (shouldStartForge({ choice, ...current })) {
    const start = () => void launch();
    const requestIdle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
    if (requestIdle) requestIdle(start, { timeout: 1500 });
    else window.addEventListener("load", () => window.setTimeout(start, 200), { once: true });
  }

  async function offerVR() {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    if (!handle || !xr) return;
    vrButton.hidden = !(await xr.isSessionSupported("immersive-vr"));
  }
}

interface NetworkInformation {
  saveData?: boolean;
}

function probeWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return Boolean(gl && gl.getParameter(gl.VERSION));
  } catch {
    return false;
  }
}
