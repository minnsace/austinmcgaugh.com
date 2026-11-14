import assert from "node:assert/strict";
import { test } from "node:test";
import { islandPlacement, localForwardY, PORTAL_LOCAL } from "../src/layout.ts";
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
    assert.ok(Math.abs(distance - 32) < 0.001);
    const forward = localForwardY(place.rotationY);
    const toward = { x: -place.x / distance, z: -place.z / distance };
    assert.ok(Math.abs(forward.x - toward.x) < 0.001);
    assert.ok(Math.abs(forward.z - toward.z) < 0.001);
  }
  const spread = new Set(places.map((place) => Math.round(place.scale * 100)));
  assert.equal(spread.size, 3);
  assert.deepEqual(PORTAL_LOCAL, { x: 0, y: 0.46, z: -2.2 });
});
