import {
  AdditiveBlending,
  AgXToneMapping,
  AmbientLight,
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  EquirectangularReflectionMapping,
  Euler,
  FogExp2,
  Group,
  HemisphereLight,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RepeatWrapping,
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
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import type { QualityTier } from "./index.ts";
import {
  bridgeRun,
  crystalSpots,
  islandPlacement,
  panelAnchor,
  plazaStance,
  PORTAL_LOCAL,
  smoothstep,
  stanceFor,
  type Stance,
} from "./layout.ts";

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

export interface KitPiece {
  id: string;
  file: string;
}

export interface StageAssets {
  forge: string;
  island: string;
  env: string;
  portals: PortalSpec[];
  bridges?: KitPiece[];
  crystals?: KitPiece[];
  dracoPath?: string;
  basisPath?: string;
}

export interface GlassPanel {
  id: string;
  element: HTMLElement;
}

export type StagePresentation = "world" | "list" | "dock";

export interface StageOptions {
  tier: Exclude<QualityTier, "quiet">;
  assets: StageAssets;
  initialStance?: string;
  initialReading?: boolean;
  reducedMotion?: boolean;
  panels?: GlassPanel[];
  onNavigate?: (href: string) => void;
}

export interface StageHandle {
  dispose: () => void;
  enterVR: () => Promise<void>;
  goTo: (id: string, options?: { fly?: boolean; reading?: boolean }) => void;
  setPresentation: (mode: StagePresentation) => void;
  enableMotion: () => Promise<boolean>;
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
const up = new Vector3(0, 1, 0);

const YAW_LIMIT = 2.35;
const PITCH_LIMIT = 0.42;
const GLASS_CSS_WIDTH = 820;

export async function startStage(host: HTMLElement, options: StageOptions): Promise<StageHandle> {
  const desktop = options.tier === "high";
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setClearColor(0x07060c, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, desktop ? 2 : 1.5));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.xr.setFoveation(1);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const canvas = renderer.domElement;
  canvas.className = "forge-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  scene.background = makeSky();
  scene.fog = new FogExp2(0x160c22, 0.015);
  scene.add(new HemisphereLight(0xb7c4de, 0x2a1420, 0.55));
  scene.add(new AmbientLight(0xffffff, 0.18));

  const camera = new PerspectiveCamera(60, 1, 0.08, 400);
  const rig = new PerspectiveCamera();
  const stancePos = new Vector3();
  const stanceQuat = new Quaternion();
  const lookEuler = new Euler(0, 0, 0, "YXZ");
  const yawQuat = new Quaternion();
  const pitchQuat = new Quaternion();
  const flightFromPos = new Vector3();
  const flightToPos = new Vector3();
  const flightFromQuat = new Quaternion();
  const flightToQuat = new Quaternion();
  const camRight = new Vector3();
  const projectCenter = new Vector3();
  const projectEdge = new Vector3();
  const panelCorners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  let yaw = 0;
  let pitch = 0;
  let yawTarget = 0;
  let pitchTarget = 0;
  let flying = false;
  let flightT = 1;
  let flightDuration = 2.1;
  let currentId = "plaza";
  let readingMode = options.initialReading === true;
  let presentation: StagePresentation = "world";
  let panelSide = 0.9;
  let panelDistance = 2.25;
  let dragging = false;
  let dragId = -1;
  let dragX = 0;
  let dragY = 0;
  let dragDistance = 0;
  let overCanvas = false;
  let edgeX = 0;
  let edgeY = 0;
  let motionEnabled = false;

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  const samples = Math.min(4, renderer.capabilities.maxSamples || 0);
  if (desktop) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.renderTarget1.samples = samples;
    composer.renderTarget2.samples = samples;
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.18, 0.18, 0.94);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new FXAAPass());
  }
  host.dataset.aa = desktop ? `msaa${samples}+fxaa` : "msaa";

  resize();
  goTo(options.initialStance || "plaza", { fly: false, reading: readingMode });

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
  panel.root.userData.noGround = true;
  panel.root.visible = false;
  scene.add(panel.root);
  fadeMesh.userData.noGround = true;
  marker.userData.noGround = true;

  const glassSlots = makeGlass(scene, options.panels ?? []);
  const edgeMaterials = new Set<MeshStandardMaterial>();
  const bridgeTemplates = new Map<string, Group>();
  const crystalTemplates = new Map<string, Group>();
  const islandGroups: Group[] = [];
  let bridgesPlaced = false;

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
    hdr.anisotropy = maxAniso;
    scene.environment = hdr;
  }).catch(() => undefined);

  void loader.loadAsync(options.assets.forge).then((gltf) => {
    if (disposed) return;
    const forge = gltf.scene;
    tuneMaterials(forge, options.tier, "");
    sharpenTextures(forge, maxAniso);
    collectForge(forge);
    energy.push(...emissiveMaterials(forge));
    scene.add(forge);
    canvas.classList.add("is-ready");
    host.dataset.ready = "true";
    host.dataset.quality = options.tier;
  }).catch(() => undefined);

  void loader.loadAsync(options.assets.island).then((gltf) => {
    if (disposed) return;
    tuneMaterials(gltf.scene, options.tier, "");
    sharpenTextures(gltf.scene, maxAniso);
    islandTemplate = gltf.scene;
    assemble();
  }).catch(() => undefined);

  for (const spec of options.assets.portals) {
    void loader.loadAsync(spec.file).then((gltf) => {
      if (disposed) return;
      tuneMaterials(gltf.scene, options.tier, spec.nodePrefix);
      sharpenTextures(gltf.scene, maxAniso);
      gltf.scene.userData.spec = spec;
      loadedPortals.set(spec.id, gltf.scene);
      assemble();
    }).catch(() => undefined);
  }

  for (const piece of options.assets.bridges ?? []) {
    void loader.loadAsync(piece.file).then((gltf) => {
      if (disposed) return;
      tuneMaterials(gltf.scene, options.tier, "");
      sharpenTextures(gltf.scene, maxAniso);
      bridgeTemplates.set(piece.id, gltf.scene);
      placeBridges();
    }).catch(() => undefined);
  }

  for (const piece of options.assets.crystals ?? []) {
    void loader.loadAsync(piece.file).then((gltf) => {
      if (disposed) return;
      tuneMaterials(gltf.scene, options.tier, "");
      sharpenTextures(gltf.scene, maxAniso);
      crystalTemplates.set(piece.id, gltf.scene);
      dressCrystals();
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
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || renderer.xr.isPresenting) return;
    dragging = true;
    dragId = event.pointerId;
    dragX = event.clientX;
    dragY = event.clientY;
    dragDistance = 0;
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    edgeX = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
    edgeY = -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1);
    overCanvas = true;
    if (!dragging || event.pointerId !== dragId) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    if (presentation === "list") return;
    yawTarget = clamp(yawTarget - dx * 0.0032, -YAW_LIMIT, YAW_LIMIT);
    pitchTarget = clamp(pitchTarget + dy * 0.0022, -PITCH_LIMIT, PITCH_LIMIT);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== dragId) return;
    dragging = false;
    dragId = -1;
    if (dragDistance < 8 && !renderer.xr.isPresenting) {
      const spec = specFromPointer(event);
      if (spec) {
        if (options.onNavigate) options.onNavigate(spec.href);
        else window.location.assign(spec.href);
      }
    }
  };
  const onPointerLeave = () => {
    overCanvas = false;
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);

  renderer.setAnimationLoop(() => {
    if (disposed || lost || hidden || !onscreen) return;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last);
    last = now;
    presenting = renderer.xr.isPresenting;
    fade += (fadeTarget - fade) * Math.min(1, dt * 14);
    fadeMaterial.opacity = fade;
    animate(now, dt);
    if (!presenting) updateLook(dt);
    else {
      updateHands();
      updateTeleport();
    }
    syncGlass();
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
      island.userData.index = index;
      scene.add(island);
      islandGroups.push(island);
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
    dressCrystals();
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
    const edgePulse = 0.72 + Math.sin(time * 1.45) * 0.28;
    for (const material of edgeMaterials) {
      const base = (material.userData.baseIntensity as number) || 1;
      material.emissiveIntensity = base * edgePulse;
      if (material.emissiveMap) material.emissiveMap.offset.y = (time * 0.12) % 1;
    }
  }

  function placeBridges() {
    if (bridgesPlaced) return;
    for (const piece of options.assets.bridges ?? []) {
      if (!bridgeTemplates.has(piece.id)) return;
    }
    if (!options.assets.bridges?.length) return;
    bridgesPlaced = true;
    for (let index = 0; index < options.assets.portals.length; index += 1) {
      for (const placed of bridgeRun(index)) {
        const template = bridgeTemplates.get(placed.id);
        if (!template) continue;
        const node = template.clone(true);
        node.position.set(placed.pose.x, placed.pose.y, placed.pose.z);
        node.rotation.y = placed.pose.yaw;
        scene.add(node);
        dressBridge(node);
      }
    }
  }

  function dressBridge(root: Object3D) {
    root.traverse((node) => {
      if (node.name.endsWith("_Pylons")) bobs.push({ node, baseY: node.position.y, phase: bobs.length });
      if (!node.name.endsWith("_EdgeLight")) return;
      const mesh = node as Mesh;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        const named = material as MeshStandardMaterial | undefined;
        if (!named) continue;
        if (named.userData.baseIntensity === undefined) named.userData.baseIntensity = named.emissiveIntensity || 1;
        const map = named.emissiveMap;
        if (map) {
          map.wrapS = RepeatWrapping;
          map.wrapT = RepeatWrapping;
          map.needsUpdate = true;
        }
        edgeMaterials.add(named);
      }
    });
    energy.push(...emissiveMaterials(root));
  }

  function dressCrystals() {
    for (const island of islandGroups) {
      if (island.userData.dressed) continue;
      const index = island.userData.index as number;
      const spots = crystalSpots(index);
      if (spots.some((spot) => !crystalTemplates.has(spot.id))) continue;
      for (const spot of spots) {
        const template = crystalTemplates.get(spot.id);
        if (!template) continue;
        const cluster = template.clone(true);
        cluster.position.set(spot.x, spot.y, spot.z);
        cluster.rotation.y = spot.yaw;
        island.add(cluster);
        const cores = cluster.getObjectByName(`${spot.id}_Cores`);
        if (cores) energy.push(...emissiveMaterials(cores));
      }
      island.userData.dressed = true;
    }
  }

  function motionReduced() {
    return options.reducedMotion === true || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function goTo(id: string, next?: { fly?: boolean; reading?: boolean }) {
    const stance = stanceFor(id) ?? plazaStance();
    currentId = stance.id;
    if (next && "reading" in next && next.reading !== undefined) readingMode = next.reading;
    host.dataset.stance = currentId;
    host.dataset.reading = readingMode ? "true" : "false";
    rig.position.set(stance.position.x, stance.position.y, stance.position.z);
    rig.lookAt(stance.look.x, stance.look.y, stance.look.z);
    stancePos.copy(rig.position);
    stanceQuat.copy(rig.quaternion);
    const distance = camera.position.distanceTo(stancePos);
    const travel = next?.fly !== false && !motionReduced() && distance > 0.4;
    yawTarget = 0;
    pitchTarget = 0;
    if (!travel) {
      flying = false;
      flightT = 1;
      yaw = 0;
      pitch = 0;
      applyLook();
      host.dataset.flying = "false";
      return;
    }
    flightFromPos.copy(camera.position);
    flightFromQuat.copy(camera.quaternion);
    flightToPos.copy(stancePos);
    flightToQuat.copy(stanceQuat);
    flightT = 0;
    flightDuration = Math.min(2.5, Math.max(1.5, 1.15 + distance / 36));
    flying = true;
    host.dataset.flying = "true";
  }

  function applyLook() {
    yawQuat.setFromAxisAngle(up, yaw);
    lookEuler.set(pitch, 0, 0);
    pitchQuat.setFromEuler(lookEuler);
    camera.position.copy(stancePos);
    camera.quaternion.copy(yawQuat).multiply(stanceQuat).multiply(pitchQuat);
  }

  function updateLook(dt: number) {
    if (flying) {
      flightT += dt / flightDuration;
      const blend = smoothstep(Math.min(1, flightT));
      camera.position.lerpVectors(flightFromPos, flightToPos, blend);
      camera.quaternion.slerpQuaternions(flightFromQuat, flightToQuat, blend);
      if (flightT >= 1) {
        flying = false;
        yaw = 0;
        pitch = 0;
        yawTarget = 0;
        pitchTarget = 0;
        applyLook();
        host.dataset.flying = "false";
      }
      return;
    }
    if (desktop && overCanvas && !dragging && presentation === "world") {
      if (edgeX > 0.84) yawTarget = clamp(yawTarget - dt * 0.38, -YAW_LIMIT, YAW_LIMIT);
      if (edgeX < -0.84) yawTarget = clamp(yawTarget + dt * 0.38, -YAW_LIMIT, YAW_LIMIT);
      if (edgeY > 0.84) pitchTarget = clamp(pitchTarget - dt * 0.26, -PITCH_LIMIT, PITCH_LIMIT);
      if (edgeY < -0.84) pitchTarget = clamp(pitchTarget + dt * 0.26, -PITCH_LIMIT, PITCH_LIMIT);
    }
    const blend = 1 - Math.exp(-8 * dt);
    yaw += (yawTarget - yaw) * blend;
    pitch += (pitchTarget - pitch) * blend;
    applyLook();
  }

  function syncGlass() {
    const stance = stanceFor(currentId) ?? plazaStance();
    const reading = readingMode && currentId !== "plaza";
    const sideTarget = reading ? 0.05 : currentId === "plaza" ? 0.78 : 0.42;
    const distanceTarget = reading ? 1.85 : 2.15;
    const blend = 1 - Math.exp(-4 * 0.016);
    panelSide += (sideTarget - panelSide) * blend;
    panelDistance += (distanceTarget - panelDistance) * blend;
    const project = presentation === "world" && !presenting;
    for (const slot of glassSlots) {
      const slotStance = stanceFor(slot.id) ?? plazaStance();
      const active = slot.id === currentId;
      const anchor = panelAnchor(active ? stance : slotStance, active ? panelDistance : 2.4, active ? panelSide : 0);
      const metersWide = active ? (reading ? 1.48 : 1.58) : 1.7;
      slot.root.position.set(anchor.x, anchor.y, anchor.z);
      slot.root.up.set(0, 1, 0);
      if (reading && active) anchor.y -= 0.42;
      slot.root.lookAt(camera.position);
      slot.root.rotateY(active ? (reading ? -0.1 : -0.26) : 0.16);
      slot.label.visible = presenting;
      if (!slot.element) continue;
      if (!project) {
        slot.element.style.width = "";
        slot.element.style.maxHeight = "";
        slot.element.style.transform = "";
        if (presentation === "dock" && active) {
          slot.element.style.visibility = "visible";
          slot.element.style.opacity = "1";
          slot.element.style.pointerEvents = "auto";
        } else {
          slot.element.style.visibility = "hidden";
          slot.element.style.pointerEvents = "none";
        }
        continue;
      }
      projectPanel(slot, metersWide, active, reading, flying);
    }
  }

  function projectPanel(slot: GlassSlot, metersWide: number, active: boolean, reading: boolean, inFlight: boolean) {
    const element = slot.element;
    if (!element) return;
    element.style.width = `${GLASS_CSS_WIDTH}px`;
    element.style.transformOrigin = "0 0";
    const cap = reading ? 760 : 700;
    const natural = element.scrollHeight;
    if (natural > cap + 8) {
      element.style.maxHeight = `${cap}px`;
      element.style.overflow = "auto";
    } else {
      element.style.maxHeight = "none";
      element.style.overflow = "visible";
    }
    const boxW = element.offsetWidth || GLASS_CSS_WIDTH;
    const boxH = element.offsetHeight || cap;
    const metersTall = metersWide * (boxH / boxW);
    slot.label.scale.set(metersWide / 2.2, metersTall / 1.32, 1);
    slot.root.updateMatrixWorld(true);
    const normal = projectCenter.set(0, 0, 1).applyQuaternion(slot.root.quaternion);
    const facing = normal.dot(camRight.copy(camera.position).sub(slot.root.position));
    if (facing < (inFlight ? 0.72 : 0.25)) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
      return;
    }
    const hx = metersWide / 2;
    const hy = metersTall / 2;
    const local = [
      [-hx, hy],
      [hx, hy],
      [hx, -hy],
      [-hx, -hy],
    ];
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    const bounds = host.getBoundingClientRect();
    const dest: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      panelCorners[i].set(local[i][0], local[i][1], 0).applyMatrix4(slot.root.matrixWorld);
      projectEdge.copy(panelCorners[i]).project(camera);
      if (projectEdge.z < -1 || projectEdge.z > 1) {
        element.style.visibility = "hidden";
        element.style.pointerEvents = "none";
        return;
      }
      dest.push((projectEdge.x * 0.5 + 0.5) * width + bounds.left, (-projectEdge.y * 0.5 + 0.5) * height + bounds.top);
    }
    const projectedWidth = Math.hypot(dest[2] - dest[0], dest[3] - dest[1]);
    const area = Math.abs(
      dest[0] * (dest[3] - dest[7]) +
      dest[2] * (dest[5] - dest[1]) +
      dest[4] * (dest[7] - dest[3]) +
      dest[6] * (dest[1] - dest[5]),
    ) / 2;
    const offscreen = dest.some((value, index) => (
      index % 2 === 0
        ? value < -width * 0.35 || value > width * 1.35
        : value < -height * 0.35 || value > height * 1.35
    ));
    if (offscreen || area < 8000 || area > width * height * 0.62 || (!active && projectedWidth < 90)) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
      return;
    }
    const matrix = homographyMatrix(
      [0, 0, boxW, 0, boxW, boxH, 0, boxH],
      dest,
    );
    if (!matrix) {
      element.style.visibility = "hidden";
      return;
    }
    element.style.visibility = "visible";
    element.style.pointerEvents = active ? "auto" : "none";
    element.style.opacity = active ? "1" : "0.82";
    element.style.transform = `matrix3d(${matrix.join(",")})`;
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
      const hits = raycaster.intersectObjects(floors, true).filter((hit) => !blocked(hit.object));
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
    if (!composer || !bloom) return;
    const ratio = renderer.getPixelRatio();
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    // UnrealBloomPass halves whatever size it is given. Pass twice the
    // drawing buffer so the bright pass stays at full resolution.
    bloom.setSize(Math.max(2, width * ratio * 2), Math.max(2, height * ratio * 2));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("deviceorientation", onOrientation);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    observer.disconnect();
    resizeObserver.disconnect();
    draco.dispose();
    ktx2.dispose();
    composer?.dispose();
    renderer.dispose();
    canvas.remove();
    host.dataset.ready = "false";
    host.dataset.quality = "quiet";
    host.dataset.flying = "false";
  }

  function setPresentation(mode: StagePresentation) {
    presentation = mode;
    host.dataset.presentation = mode;
  }

  async function enableMotion() {
    const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof orientation.requestPermission === "function") {
      const result = await orientation.requestPermission();
      if (result !== "granted") return false;
    }
    if (motionEnabled) return true;
    motionEnabled = true;
    window.addEventListener("deviceorientation", onOrientation);
    return true;
  }

  function onOrientation(event: DeviceOrientationEvent) {
    if (dragging || flying || presentation !== "world") return;
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 70;
    yawTarget = clamp((-gamma / 38) * YAW_LIMIT, -YAW_LIMIT, YAW_LIMIT);
    pitchTarget = clamp(((beta - 68) / 32) * PITCH_LIMIT, -PITCH_LIMIT, PITCH_LIMIT);
  }

  return { dispose, enterVR, goTo, setPresentation, enableMotion };

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
      if (node.name.includes("_Ring_")) {
        node.scale.multiplyScalar(1.08);
        rings.push(node);
      }
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

interface GlassSlot {
  id: string;
  element: HTMLElement | null;
  root: Group;
  label: Mesh;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function blocked(object: Object3D): boolean {
  let node: Object3D | null = object;
  while (node) {
    if (node.userData.spec || node.userData.noGround) return true;
    node = node.parent;
  }
  return false;
}

function makeSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new Color(0x140818);
  const wash = context.createLinearGradient(0, 0, 0, canvas.height);
  wash.addColorStop(0, "#07010f");
  wash.addColorStop(0.42, "#140824");
  wash.addColorStop(0.72, "#241038");
  wash.addColorStop(1, "#09060f");
  context.fillStyle = wash;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const clouds: [number, number, number, string][] = [
    [360, 280, 320, "rgba(155, 135, 255, 0.38)"],
    [980, 360, 420, "rgba(61, 126, 255, 0.3)"],
    [1560, 240, 280, "rgba(255, 79, 163, 0.24)"],
    [720, 640, 340, "rgba(94, 231, 216, 0.14)"],
    [1680, 700, 260, "rgba(255, 138, 61, 0.18)"],
  ];
  for (const [x, y, radius, color] of clouds) {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = 0; i < 900; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = (i * 57) % canvas.height;
    const size = i % 18 === 0 ? 2 : 1;
    const alpha = 0.35 + ((i * 17) % 60) / 100;
    context.fillStyle = `rgba(244, 240, 230, ${alpha})`;
    context.fillRect(x, y, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function homographyMatrix(src: number[], dst: number[]): number[] | null {
  const rows: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const x = src[i * 2];
    const y = src[i * 2 + 1];
    const u = dst[i * 2];
    const v = dst[i * 2 + 1];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-8) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let c = col; c < 9; c += 1) rows[col][c] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let c = col; c < 9; c += 1) rows[row][c] -= factor * rows[col][c];
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map((row) => row[8]);
  return [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
}

function makeGlass(scene: Scene, panels: GlassPanel[]): GlassSlot[] {
  return ["plaza", "projects", "journal", "workshop"].map((id) => {
    const element = panels.find((panel) => panel.id === id)?.element ?? null;
    const root = new Group();
    root.userData.noGround = true;
    const label = makeLabel(id);
    label.position.z = 0.02;
    label.visible = false;
    label.userData.noGround = true;
    root.add(label);
    scene.add(root);
    return { id, element, root, label };
  });
}

function makeLabel(id: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  const titles: Record<string, string> = {
    plaza: "The Forge",
    projects: "Projects",
    journal: "Journal",
    workshop: "Workshop",
  };
  const lines: Record<string, string> = {
    plaza: "Standing on the plaza.",
    projects: "Software and games.",
    journal: "Articles and videos.",
    workshop: "Minnsace Inc.",
  };
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f4f0e6";
    context.font = "600 84px sans-serif";
    context.fillText(titles[id] ?? id, 72, 200);
    context.fillStyle = "#c3bdb2";
    context.font = "40px sans-serif";
    context.fillText(lines[id] ?? "", 72, 280);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return new Mesh(
    new PlaneGeometry(2.2, 1.32),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
}

function sharpenTextures(root: Object3D, anisotropy: number) {
  const keys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"] as const;
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (!material) continue;
      const named = material as MeshStandardMaterial;
      for (const key of keys) {
        const texture = named[key];
        if (!texture) continue;
        texture.anisotropy = anisotropy;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.needsUpdate = true;
      }
    }
  });
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
