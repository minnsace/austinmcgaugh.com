import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeRuntime,
  createRenderer,
  createShotSequencer,
  resolveQuality,
} from "../src/index.ts";

test("quiet mode wins for reduced motion, save-data, and no WebGL", () => {
  assert.equal(resolveQuality({}), "standard");
  assert.equal(resolveQuality({ reducedMotion: true }), "quiet");
  assert.equal(resolveQuality({ saveData: true }), "quiet");
  assert.equal(resolveQuality({ webgl: false }), "quiet");
  assert.equal(resolveQuality({ reducedMotion: true, force: "high" }), "high");
});

test("the quality switch stores the tier on the runtime", () => {
  const forge = createForgeRuntime();
  assert.equal(forge.setQuality({ force: "quiet" }), "quiet");
  assert.equal(forge.renderer.quality, "quiet");
  assert.equal(forge.setQuality({}), "standard");
  assert.equal(forge.renderer.quality, "standard");
});

test("phase 1 mount records a host and does not need a canvas", () => {
  const renderer = createRenderer();
  assert.equal(renderer.mounted, false);
  renderer.mount({} as HTMLElement);
  assert.equal(renderer.mounted, true);
  renderer.setQuality("high");
  assert.equal(renderer.quality, "high");
  renderer.dispose();
  assert.equal(renderer.mounted, false);
});

test("the shot sequencer plays, skips, and rejects a bad shot", () => {
  const shots = createShotSequencer();
  shots.register({ id: "arrive", duration: 3 });
  shots.register({ id: "cut", duration: 0 });
  assert.equal(shots.play("missing"), undefined);
  assert.equal(shots.current(), undefined);
  assert.equal(shots.play("arrive")?.id, "arrive");
  assert.equal(shots.current()?.duration, 3);
  shots.skip();
  assert.equal(shots.current(), undefined);
  assert.equal(shots.list().length, 2);
  assert.throws(() => shots.register({ id: " ", duration: 1 }));
  assert.throws(() => shots.register({ id: "bad", duration: -0.1 }));
});
