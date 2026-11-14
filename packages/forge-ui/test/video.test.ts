import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVideo } from "../src/video.ts";

test("youtube watch, share, and shorts URLs become a nocookie embed", () => {
  const watch = resolveVideo("https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(watch.provider, "youtube");
  assert.equal(watch.embed, "https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0");
  assert.equal(watch.poster, "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
  assert.equal(watch.embed?.includes("autoplay"), false);

  const share = resolveVideo("https://youtu.be/abcdefghijk");
  assert.equal(share.embed, watch.embed);

  const shorts = resolveVideo("https://www.youtube.com/shorts/abcdefghijk");
  assert.equal(shorts.provider, "youtube");
});

test("a placeholder id and a non-video URL stay plain links", () => {
  const placeholder = resolveVideo("https://www.youtube.com/watch?v=REPLACE_ME");
  assert.equal(placeholder.provider, undefined);
  assert.equal(placeholder.embed, undefined);

  const site = resolveVideo("https://freesnakegame.com/");
  assert.deepEqual(site, { href: "https://freesnakegame.com/" });

  const junk = resolveVideo("not a url");
  assert.deepEqual(junk, { href: "not a url" });
});

test("vimeo becomes a player URL", () => {
  const video = resolveVideo("https://vimeo.com/123456789");
  assert.equal(video.provider, "vimeo");
  assert.equal(video.embed, "https://player.vimeo.com/video/123456789");
  assert.equal(video.poster, undefined);
});
