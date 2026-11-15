import assert from "node:assert/strict";
import { test } from "node:test";
import { decideShell, isQuestUa, shellScript, toFullPath, toMobilePath } from "../src/lib/shell.ts";

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const pixel =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const quest =
  "Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/33.0.0.0.0 Chrome/128.0.6613.119 Safari/537.36";
const desktop =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

test("phones with a coarse pointer and a small viewport use the mobile shell", () => {
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: true, small: true, uaMobile: true, ua: iphone }),
    "mobile",
  );
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: true, small: true, uaMobile: null, ua: pixel }),
    "mobile",
  );
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: true, small: true, uaMobile: null, ua: iphone }),
    "mobile",
  );
});

test("desktop, a fine pointer, and Quest stay on the full scene", () => {
  assert.equal(isQuestUa(quest), true);
  assert.equal(
    decideShell({ choice: null, quest: true, coarse: true, small: true, uaMobile: true, ua: quest }),
    "full",
  );
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: false, small: false, uaMobile: false, ua: desktop }),
    "full",
  );
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: false, small: true, uaMobile: false, ua: desktop }),
    "full",
  );
  assert.equal(
    decideShell({ choice: null, quest: false, coarse: true, small: true, uaMobile: false, ua: desktop }),
    "full",
  );
});

test("an explicit choice is remembered", () => {
  assert.equal(
    decideShell({ choice: "full", quest: false, coarse: true, small: true, uaMobile: true, ua: iphone }),
    "full",
  );
  assert.equal(
    decideShell({ choice: "mobile", quest: false, coarse: false, small: false, uaMobile: false, ua: desktop }),
    "mobile",
  );
  assert.equal(
    decideShell({ choice: "mobile", quest: true, coarse: true, small: true, uaMobile: true, ua: quest }),
    "mobile",
  );
});

test("paths swap between the full site and /m/", () => {
  assert.equal(toMobilePath("/404.html"), "/m/");
  assert.equal(toMobilePath("/"), "/m/");
  assert.equal(toMobilePath("/projects/"), "/m/projects/");
  assert.equal(toMobilePath("/projects/the-lethecary/"), "/m/projects/the-lethecary/");
  assert.equal(toMobilePath("/m/journal/"), "/m/journal/");
  assert.equal(toFullPath("/m/"), "/");
  assert.equal(toFullPath("/m/projects/the-lethecary/"), "/projects/the-lethecary/");
  assert.equal(toFullPath("/journal/"), "/journal/");
});

test("the early script carries the same signals", () => {
  assert.match(shellScript, /forge-shell/);
  assert.match(shellScript, /pointer: coarse/);
  assert.match(shellScript, /max-width: 900px/);
  assert.match(shellScript, /max-height: 500px/);
  assert.match(shellScript, /userAgentData/);
  assert.match(shellScript, /OculusBrowser/);
  assert.match(shellScript, /iPhone/);
});
