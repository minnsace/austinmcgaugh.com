import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRIDGE_SPAN,
  appendPiece,
  bridgeRun,
  crystalSpots,
  EYE_HEIGHT,
  FORGE_ANCHOR_RADIUS,
  FORGE_TREAD_Y,
  ISLAND_RIM_Z,
  islandLocalToWorld,
  islandPlacement,
  isReadingPath,
  kitFile,
  LANDING_REACH,
  localForwardY,
  panelAnchor,
  plazaStance,
  PORTAL_LOCAL,
  portalStance,
  RIM_RADIUS,
  smoothstep,
  stanceIdFromPath,
  vrPlateLayout,
} from "../src/layout.ts";
import { readForgeChoice, resolveQuality, shouldStartForge } from "../src/index.ts";

test("desktop is high, a headset session is quest, and quiet signals still win", () => {
  assert.equal(resolveQuality({ desktop: true }), "high");
  assert.equal(resolveQuality({ xr: true }), "quest");
  assert.equal(resolveQuality({ desktop: true, reducedMotion: true }), "quiet");
  assert.equal(resolveQuality({ xr: true, saveData: true }), "quiet");
  assert.equal(resolveQuality({ force: "quest" }), "quest");
});

test("the remembered choice starts or holds the stage", () => {
  assert.equal(shouldStartForge({ choice: null, reducedMotion: false, saveData: false, webgl: true }), true);
  assert.equal(shouldStartForge({ choice: null, reducedMotion: true, saveData: false, webgl: true }), false);
  assert.equal(shouldStartForge({ choice: "quiet", reducedMotion: false, saveData: false, webgl: true }), false);
  assert.equal(shouldStartForge({ choice: "full", reducedMotion: true, saveData: false, webgl: true }), true);
  assert.equal(shouldStartForge({ choice: "full", reducedMotion: false, saveData: false, webgl: false }), false);
  assert.equal(readForgeChoice({ getItem: () => "full" }), "full");
  assert.equal(readForgeChoice({ getItem: () => "nope" }), null);
});

test("each island faces the forge and the portal sits on the plaza", () => {
  const places = [0, 1, 2].map((index) => islandPlacement(index));
  for (const place of places) {
    const distance = Math.hypot(place.x, place.z);
    const expected = RIM_RADIUS + ISLAND_RIM_Z * place.scale;
    assert.ok(Math.abs(distance - expected) < 0.001);
    const forward = localForwardY(place.rotationY);
    const toward = { x: -place.x / distance, z: -place.z / distance };
    assert.ok(Math.abs(forward.x - toward.x) < 0.001);
    assert.ok(Math.abs(forward.z - toward.z) < 0.001);
    const rim = islandLocalToWorld(place, { x: 0, y: 0, z: ISLAND_RIM_Z }, false);
    assert.ok(Math.abs(Math.hypot(rim.x, rim.z) - RIM_RADIUS) < 0.02);
  }
  const spread = new Set(places.map((place) => Math.round(place.scale * 100)));
  assert.equal(spread.size, 3);
  assert.deepEqual(PORTAL_LOCAL, { x: 0, y: 0.46, z: -2.2 });
});

test("bridges meet the dais and the island deck", () => {
  for (const index of [0, 1, 2]) {
    const place = islandPlacement(index);
    const run = bridgeRun(index);
    const forgeLanding = run[0];
    const forgeAnchor = appendPiece(forgeLanding.pose, "Bridge_Landing");
    assert.ok(Math.abs(Math.hypot(forgeAnchor.x, forgeAnchor.z) - FORGE_ANCHOR_RADIUS) < 0.02);
    assert.ok(Math.abs(forgeAnchor.y - FORGE_TREAD_Y) < 0.001);
    const islandLanding = run[run.length - 1];
    const islandAnchor = appendPiece(islandLanding.pose, "Bridge_Landing");
    const rim = islandLocalToWorld(place, { x: 0, y: 0, z: ISLAND_RIM_Z }, false);
    assert.ok(Math.hypot(islandAnchor.x - rim.x, islandAnchor.z - rim.z) < 0.05);
    assert.ok(Math.abs(islandAnchor.y - place.y) < 0.02);
    const middle = run.slice(1, -1).reduce((sum, piece) => {
      const next = appendPiece(piece.pose, piece.id);
      return sum + Math.hypot(next.x - piece.pose.x, next.z - piece.pose.z);
    }, 0);
    assert.ok(Math.abs(middle - BRIDGE_SPAN) < 0.02);
    assert.ok(Math.abs(place.y - (FORGE_TREAD_Y + index)) < 0.001);
  }
  assert.equal(LANDING_REACH, 3);
});

test("the visitor stands at eye level and routes name a stance", () => {
  const plaza = plazaStance();
  assert.ok(Math.abs(plaza.position.y - EYE_HEIGHT) < 0.001);
  const ring = Math.hypot(plaza.position.x, plaza.position.z);
  assert.ok(ring > 8 && ring < 17);
  const journal = portalStance(1);
  assert.ok(Math.abs(journal.position.y - (1 + EYE_HEIGHT)) < 0.001);
  const portalReach = Math.hypot(40.729, -23.515);
  const standReach = Math.hypot(journal.position.x, journal.position.z);
  assert.ok(standReach < portalReach);
  const ahead = panelAnchor(journal, 2, 0);
  const gaze = Math.hypot(journal.look.x - journal.position.x, journal.look.z - journal.position.z);
  const panel = Math.hypot(ahead.x - journal.position.x, ahead.z - journal.position.z);
  assert.ok(panel < gaze);
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(stanceIdFromPath("/journal/i-bought-a-5-domain-on-impulse/"), "journal");
  assert.equal(stanceIdFromPath("/"), "plaza");
  assert.equal(isReadingPath("/journal/i-bought-a-5-domain-on-impulse/"), true);
  assert.equal(isReadingPath("/journal/"), false);
  assert.equal(isReadingPath("/journal/tags/devlog/"), false);
  assert.equal(kitFile("Crystals_01", false), "/models/Crystals_01_web.glb");
  assert.equal(kitFile("Bridge_Landing", true), "/models/quest/Bridge_Landing_quest.glb");
  assert.equal(crystalSpots(0).length, 5);
});

test("quest plates form an arc 1.2 to 1.5 metres from the eye", () => {
  const plates = vrPlateLayout();
  assert.equal(plates.length, 3);
  const [left, center, right] = plates;
  assert.ok(left && center && right);
  for (const plate of plates) {
    assert.ok(plate.distance >= 1.2 && plate.distance <= 1.5, `distance ${plate.distance}`);
  }
  assert.ok(left.x < center.x && center.x < right.x);
  assert.ok(center.distance < left.distance && center.distance < right.distance);
  assert.ok(left.yaw > 0.15 && right.yaw < -0.15);
  const gap = center.x - left.x - left.width / 2 - center.width / 2;
  assert.ok(gap > 0.05, `gap ${gap}`);
});
