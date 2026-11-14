import {
  AdditiveBlending,
  AgXToneMapping,
  AmbientLight,
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import type { QualityTier } from "./index.ts";
import { islandPlacement, PORTAL_LOCAL } from "./layout.ts";

export interface PortalSpec {
  id: string;
  /** glTF node prefix, e.g. Portal_Knowledge for the Journal portal. */
  nodePrefix: string;
  file: string;
  href: string;
  title: string;
  summary: string;
  color: number;
}

export interface StageAssets {
  forge: string;
  island: string;
  env: string;
  portals: PortalSpec[];
  dracoPath?: string;
  basisPath?: string;
}

export interface StageOptions {
  tier: Exclude<QualityTier, "quiet">;
  assets: StageAssets;
}

export interface StageHandle {
  dispose: () => void;
  enterVR: () => Promise<void>;
}

interface Bob {
  node: Object3D;
  baseY: number;
  phase: number;
}

const raycaster = new Raycaster();
const pointer = new Vector2();
const tempMatrix = new Matrix4();
const aimOrigin = new Vector3();
const aimDirection = new Vector3(0, 0, -1);

export async function startStage(host: HTMLElement, options: StageOptions): Promise<StageHandle> {
  const desktop = options.tier === "high";
  const renderer = new WebGLRenderer({
    antialias: desktop,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setClearColor(0x07060c, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, desktop ? 1.5 : 1));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.xr.setFoveation(1);

  const canvas = renderer.domElement;
  canvas.className = "forge-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  scene.background = new Color(0x07060c);
  scene.add(new HemisphereLight(0x9eb0c8, 0x1a120e, 0.45));
  scene.add(new AmbientLight(0xffffff, 0.15));

  const platform = new Mesh(
    new CylinderGeometry(8.2, 8.8, 0.45, 48),
    new MeshStandardMaterial({ color: 0x141820, metalness: 0.55, roughness: 0.42 }),
  );
  platform.position.y = -0.28;
  scene.add(platform);

  const camera = new PerspectiveCamera(54, 1, 0.1, 400);
  const lookAt = new Vector3(0, 5, 0);
  const home = new Vector3(8, 11, 44);
  camera.position.copy(home);
  camera.lookAt(lookAt);

  const controls = desktop
    ? null
    : new OrbitControls(camera, canvas);
  if (controls) {
    controls.target.copy(lookAt);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = 0.35;
  }

  let composer: EffectComposer | null = null;
  if (desktop) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(canvas.width, canvas.height), 0.2, 0.16, 0.94);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  resize();

  const fadeMaterial = new MeshBasicMaterial({
    color: 0x000000,
    side: BackSide,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const fadeMesh = new Mesh(new SphereGeometry(0.18, 8, 8), fadeMaterial);
  fadeMesh.renderOrder = 999;
  fadeMesh.frustumCulled = false;
  let fade = 0;
  let fadeTarget = 0;

  let lost = false;
  let hidden = document.hidden;
  let onscreen = true;
  let disposed = false;
  let presenting = false;
  let baseReferenceSpace: XRReferenceSpace | null = null;
  let last = performance.now() / 1000;
  let frameAccum = 0;
  let frameCount = 0;
  const halos: Sprite[] = [];
  const bobs: Bob[] = [];
  const rings: Object3D[] = [];
  const spinGroups: Object3D[] = [];
  const energy: MeshStandardMaterial[] = [];
  const portalRoots: Object3D[] = [];
  const selectables: Object3D[] = [];
  let activePortal: PortalSpec | null = null;
  let stickArmed = false;
  let teleportPoint: Vector3 | null = null;
  const pinched = [false, false];

  const marker = new Mesh(
    new RingGeometry(0.28, 0.4, 24),
    new MeshBasicMaterial({ color: 0xd7fff6, side: 2, transparent: true, opacity: 0.9 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  const panel = makePanel();
  panel.root.visible = false;
  scene.add(panel.root);

  try {
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error("WebGL context lost on the first frame");
  } catch (error) {
    dispose();
    throw error;
  }

  const draco = new DRACOLoader();
  draco.setDecoderPath(options.assets.dracoPath ?? "/draco/");
  draco.setDecoderConfig({ type: "wasm" });
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(options.assets.basisPath ?? "/basis/");
  ktx2.detectSupport(renderer);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const hdrLoader = new HDRLoader();
  const loadedPortals = new Map<string, Group>();
  let islandTemplate: Group | null = null;

  void hdrLoader.loadAsync(options.assets.env).then((hdr) => {
    if (disposed) return;
    hdr.mapping = EquirectangularReflectionMapping;
    scene.environment = hdr;
  }).catch(() => undefined);

  void loader.loadAsync(options.assets.forge).then((gltf) => {
    if (disposed) return;
    const forge = gltf.scene;
    tuneMaterials(forge, options.tier);
    collectForge(forge);
    energy.push(...emissiveMaterials(forge));
    scene.add(forge);
    canvas.classList.add("is-ready");
    host.dataset.ready = "true";
    host.dataset.quality = options.tier;
  }).catch(() => undefined);

  void loader.loadAsync(options.assets.island).then((gltf) => {
    if (disposed) return;
    tuneMaterials(gltf.scene, options.tier);
    islandTemplate = gltf.scene;
    assemble();
  }).catch(() => undefined);

  for (const spec of options.assets.portals) {
    void loader.loadAsync(spec.file).then((gltf) => {
      if (disposed) return;
      tuneMaterials(gltf.scene, options.tier, spec.nodePrefix);
      gltf.scene.userData.spec = spec;
      loadedPortals.set(spec.id, gltf.scene);
      assemble();
    }).catch(() => undefined);
  }

  const controllerFactory = new XRControllerModelFactory();
  const handFactory = new XRHandModelFactory();
  let xrReady = false;
  function ensureXRInput() {
    if (xrReady) return;
    xrReady = true;
    for (let index = 0; index < 2; index += 1) {
      const controller = renderer.xr.getController(index);
      controller.addEventListener("select", () => onSelect(controller));
      scene.add(controller);
      const grip = renderer.xr.getControllerGrip(index);
      grip.add(controllerFactory.createControllerModel(grip));
      scene.add(grip);
      const hand = renderer.xr.getHand(index);
      hand.add(handFactory.createHandModel(hand, "spheres"));
      scene.add(hand);
      controller.add(rayLine());
    }
  }

  const onVisibility = () => {
    hidden = document.hidden;
  };
  document.addEventListener("visibilitychange", onVisibility);
  const observer = new IntersectionObserver(([entry]) => {
    onscreen = entry?.isIntersecting ?? true;
  });
  observer.observe(host);
  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    window.setTimeout(() => {
      if (lost) dispose();
    }, 1500);
  };
  const onRestored = () => {
    lost = false;
    resize();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  const onPointer = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener("pointermove", onPointer);
  const onClick = (event: PointerEvent) => {
    if (renderer.xr.isPresenting) return;
    const spec = specFromPointer(event);
    if (spec) window.location.assign(spec.href);
  };
  canvas.addEventListener("click", onClick);

  renderer.setAnimationLoop(() => {
    if (disposed || lost || hidden || !onscreen) return;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last);
    last = now;
    presenting = renderer.xr.isPresenting;
    fade += (fadeTarget - fade) * Math.min(1, dt * 14);
    fadeMaterial.opacity = fade;
    animate(now, dt);
    if (!presenting) {
      if (desktop) driftCamera(now);
      controls?.update();
      hoverFromCamera();
    } else {
      updateHands();
      updateTeleport();
    }
    for (const sprite of halos) sprite.visible = presenting;
    if (presenting || !composer) renderer.render(scene, camera);
    else composer.render();
    frameAccum += dt;
    frameCount += 1;
    if (frameAccum >= 1) {
      host.dataset.frameMs = String(Math.round((frameAccum / frameCount) * 1000));
      frameAccum = 0;
      frameCount = 0;
    }
  });

  function assemble() {
    if (!islandTemplate) return;
    for (const spec of options.assets.portals) {
      if (portalRoots.some((root) => root.userData.spec?.id === spec.id)) continue;
      const portal = loadedPortals.get(spec.id);
      if (!portal) continue;
      const index = options.assets.portals.indexOf(spec);
      const place = islandPlacement(index, options.assets.portals.length);
      const island = islandTemplate.clone(true);
      island.position.set(place.x, place.y, place.z);
      island.rotation.y = place.rotationY;
      island.scale.setScalar(place.scale);
      collectIsland(island, index);
      portal.position.set(PORTAL_LOCAL.x, PORTAL_LOCAL.y, PORTAL_LOCAL.z);
      portal.userData.spec = spec;
      collectPortal(portal, spec);
      island.add(portal);
      scene.add(island);
      portalRoots.push(portal);
      const halo = new Sprite(new SpriteMaterial({
        color: spec.color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0.45,
      }));
      halo.scale.set(1.6, 1.6, 1);
      halo.visible = false;
      halo.position.set(0, 4, 1.55);
      portal.add(halo);
      halos.push(halo);
    }
  }

  function animate(time: number, dt: number) {
    rings.forEach((ring, index) => {
      ring.rotation.y += dt * (index % 2 === 0 ? 0.35 : -0.28);
    });
    for (const group of spinGroups) group.rotation.y += dt * 0.18;
    for (const bob of bobs) {
      bob.node.position.y = bob.baseY + Math.sin(time * 1.3 + bob.phase) * 0.07;
    }
    const pulse = 0.82 + Math.sin(time * 1.7) * 0.18;
    for (const material of energy) {
      const base = material.userData.baseIntensity as number;
      material.emissiveIntensity = base * pulse;
    }
  }

  function driftCamera(time: number) {
    camera.position.set(
      home.x + pointer.x * 1.8,
      home.y + pointer.y * 0.8 + Math.sin(time * 0.35) * 0.35,
      home.z + Math.sin(time * 0.18) * 1.2,
    );
    camera.lookAt(lookAt);
  }

  function hoverFromCamera() {
    raycaster.setFromCamera(pointer, camera);
    const hit = firstSpec(raycaster.intersectObjects(selectables, true));
    showPanel(hit);
  }

  function specFromPointer(event: PointerEvent): PortalSpec | null {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    return firstSpec(raycaster.intersectObjects(selectables, true));
  }

  function onSelect(controller: Object3D) {
    aimRay(controller);
    const hit = firstSpec(raycaster.intersectObjects(selectables, true));
    if (hit) void openPortal(hit);
  }

  function updateHands() {
    for (let index = 0; index < 2; index += 1) {
      const hand = renderer.xr.getHand(index) as Object3D & { joints?: Record<string, Object3D | undefined> };
      const tip = hand.joints?.["index-finger-tip"];
      const thumb = hand.joints?.["thumb-tip"];
      if (!tip || !thumb) continue;
      const distance = tip.position.distanceTo(thumb.position);
      const now = distance < 0.018;
      if (now && !pinched[index]) {
        aimOrigin.setFromMatrixPosition(tip.matrixWorld);
        aimDirection.copy(tip.position).sub(thumb.position).normalize();
        raycaster.set(aimOrigin, aimDirection);
        const hit = firstSpec(raycaster.intersectObjects(selectables, true));
        if (hit) void openPortal(hit);
        else showPanel(null);
      }
      pinched[index] = now;
    }
  }

  function updateTeleport() {
    const session = renderer.xr.getSession();
    if (!session) return;
    let pushed = false;
    let aimer: Object3D | null = null;
    for (const source of session.inputSources) {
      const axes = source.gamepad?.axes;
      if (!axes || axes.length < 2) continue;
      const primary = Math.hypot(axes[0] ?? 0, axes[1] ?? 0);
      const secondary = axes.length >= 4 ? Math.hypot(axes[2] ?? 0, axes[3] ?? 0) : 0;
      if (primary > 0.55 || secondary > 0.55) {
        pushed = true;
        aimer = source.handedness === "left" ? renderer.xr.getController(0) : renderer.xr.getController(1);
      }
    }
    if (pushed && aimer) {
      aimRay(aimer);
      const floors = scene.children.filter((child) => child !== marker && child !== panel.root);
      const hits = raycaster.intersectObjects(floors, true).filter((hit) => !hasSpec(hit.object));
      const ground = hits[0];
      if (ground) {
        teleportPoint = ground.point.clone();
        marker.position.set(ground.point.x, ground.point.y + 0.05, ground.point.z);
        marker.visible = true;
      }
      stickArmed = true;
    } else if (stickArmed) {
      stickArmed = false;
      marker.visible = false;
      if (teleportPoint && baseReferenceSpace) {
        const point = teleportPoint;
        teleportPoint = null;
        void blink(() => {
          const offset = new XRRigidTransform({ x: -point.x, y: -point.y, z: -point.z });
          renderer.xr.setReferenceSpace(baseReferenceSpace!.getOffsetReferenceSpace(offset));
        });
      }
    }
  }

  function aimRay(controller: Object3D) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    aimOrigin.setFromMatrixPosition(controller.matrixWorld);
    aimDirection.set(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.set(aimOrigin, aimDirection);
  }

  async function openPortal(spec: PortalSpec) {
    showPanel(spec);
    fadeTarget = 1;
    await wait(180);
    const session = renderer.xr.getSession();
    if (session) await session.end();
    window.location.assign(spec.href);
  }

  async function enterVR() {
    if (!navigator.xr) return;
    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "hand-tracking"],
    });
    renderer.xr.setReferenceSpaceType("local-floor");
    renderer.xr.setFoveation(1);
    ensureXRInput();
    await renderer.xr.setSession(session);
    baseReferenceSpace = renderer.xr.getReferenceSpace();
    setTransmission(false);
    const head = renderer.xr.getCamera();
    head.add(fadeMesh);
    host.dataset.quality = "quest";
    session.addEventListener("end", () => {
      presenting = false;
      setTransmission(options.tier === "high");
      host.dataset.quality = options.tier;
      fadeTarget = 0;
      marker.visible = false;
      if (fadeMesh.parent) fadeMesh.parent.remove(fadeMesh);
    });
  }

  function showPanel(spec: PortalSpec | null) {
    activePortal = spec;
    if (!spec) {
      panel.root.visible = false;
      return;
    }
    const root = portalRoots.find((item) => item.userData.spec?.id === spec.id);
    if (!root) return;
    drawPanel(panel.canvas, panel.texture, spec);
    panel.root.visible = true;
    root.add(panel.root);
  }

  function setTransmission(enabled: boolean) {
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        const physical = material as MeshStandardMaterial & { transmission?: number };
        if (typeof physical.transmission !== "number") continue;
        if (physical.userData.transmission === undefined) physical.userData.transmission = physical.transmission;
        physical.transmission = enabled ? (physical.userData.transmission as number) : 0;
      }
    });
  }

  function resize() {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    observer.disconnect();
    resizeObserver.disconnect();
    controls?.dispose();
    draco.dispose();
    ktx2.dispose();
    composer?.dispose();
    renderer.dispose();
    canvas.remove();
    host.dataset.ready = "false";
    host.dataset.quality = "quiet";
  }

  return { dispose, enterVR };

  function collectForge(forge: Object3D) {
    forge.traverse((node) => {
      if (node.name.startsWith("Forge_OrbitRing")) rings.push(node);
      if (node.name === "Forge_ShardOrbit") spinGroups.push(node);
    });
  }

  function collectIsland(island: Object3D, index: number) {
    island.traverse((node) => {
      if (node.name.includes("Fragment")) {
        bobs.push({ node, baseY: node.position.y, phase: index + bobs.length });
      }
    });
  }

  function collectPortal(portal: Object3D, spec: PortalSpec) {
    selectables.push(portal);
    const prefix = spec.nodePrefix;
    portal.traverse((node) => {
      if (node.name.includes("_Ring_")) rings.push(node);
      if (node.name === `${prefix}_Symbol` || node.name === `${prefix}_Symbol_Cage` || node.name === `${prefix}_Symbol_Core`) {
        bobs.push({ node, baseY: node.position.y, phase: spec.id.length });
      }
    });
    energy.push(...emissiveMaterials(portal));
  }
}

function tuneMaterials(root: Object3D, tier: QualityTier, nodePrefix = "") {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      const named = material as MeshStandardMaterial;
      if (material.name.includes("Membrane")) {
        named.emissiveIntensity = nodePrefix.includes("Workshop") || material.name.includes("Workshop") ? 0.5 : 0.65;
      }
      if (tier !== "high" && "transmission" in named && typeof named.transmission === "number" && named.transmission > 0) {
        named.transmission = 0;
        named.needsUpdate = true;
      }
    }
  });
}

function emissiveMaterials(root: Object3D): MeshStandardMaterial[] {
  const found: MeshStandardMaterial[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (material.name.includes("Membrane")) continue;
      if (!material.name.includes("Energy") && !material.name.includes("SymbolCore") && !material.name.includes("Crystal")) continue;
      const named = material as MeshStandardMaterial;
      if (named.userData.baseIntensity !== undefined) continue;
      named.userData.baseIntensity = named.emissiveIntensity || 1;
      found.push(named);
    }
  });
  return found;
}

function makePanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const root = new Group();
  const board = new Mesh(
    new PlaneGeometry(2.1, 1.05),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  board.position.set(0, 1.35, 2.35);
  root.add(board);
  return { root, canvas, texture };
}

function drawPanel(canvas: HTMLCanvasElement, texture: CanvasTexture, spec: PortalSpec) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(12, 14, 18, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `#${spec.color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, 14, canvas.height);
  context.fillStyle = "#f4f0e6";
  context.font = "600 54px sans-serif";
  context.fillText(spec.title, 48, 110);
  context.font = "32px sans-serif";
  wrapText(context, spec.summary, 48, 180, 680, 42);
  context.fillStyle = "#5ee7d8";
  context.font = "600 30px sans-serif";
  context.fillText("Open", 48, 330);
  texture.needsUpdate = true;
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number) {
  const words = text.split(" ");
  let row = "";
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (context.measureText(next).width > width) {
      context.fillText(row, x, y);
      row = word;
      y += line;
    } else {
      row = next;
    }
  }
  context.fillText(row, x, y);
}

function firstSpec(hits: { object: Object3D }[]): PortalSpec | null {
  for (const hit of hits) {
    let node: Object3D | null = hit.object;
    while (node) {
      const spec = node.userData.spec as PortalSpec | undefined;
      if (spec) return spec;
      node = node.parent;
    }
  }
  return null;
}

function hasSpec(object: Object3D): boolean {
  let node: Object3D | null = object;
  while (node) {
    if (node.userData.spec) return true;
    node = node.parent;
  }
  return false;
}

function rayLine() {
  const mesh = new Mesh(
    new CylinderGeometry(0.004, 0.004, 1, 6),
    new MeshBasicMaterial({ color: 0xd7fff6, transparent: true, opacity: 0.7 }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = -0.5;
  mesh.geometry.translate(0, 0.5, 0);
  return mesh;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
