import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  POWERED_OFF_PROJECTOR_ASSET,
  POWERED_OFF_PROJECTOR_STATE,
  mountPoweredOffProjector,
} from "../../js/workshop/projector/powered-off-projector-view.mjs";

function createFakeImage() {
  const listeners = new Map();
  return {
    attributes: new Map(),
    addEventListener(name, listener) { listeners.set(name, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name) { listeners.get(name)?.(); },
  };
}

function createHarness() {
  const image = createFakeImage();
  const mount = {
    children: [],
    replaceChildren(...children) { this.children = children; },
  };
  return {
    image,
    mount,
    document: { createElement: (name) => {
      assert.equal(name, "img");
      return image;
    } },
  };
}

test("defines the approved powered-off runtime asset and fixed endpoint", () => {
  assert.equal(
    POWERED_OFF_PROJECTOR_ASSET,
    "assets/images/workshop/runtime/derivatives/projector/projector-powered-off-sample-587x587.png",
  );
  assert.deepEqual(POWERED_OFF_PROJECTOR_STATE, {
    name: "POWERED_OFF",
    opacity: 1,
    scale: 1,
  });
  assert.equal(Object.isFrozen(POWERED_OFF_PROJECTOR_STATE), true);
});

test("mounts one decorative structural image with no interactive semantics", async () => {
  const harness = createHarness();
  const view = mountPoweredOffProjector(harness);

  assert.deepEqual(harness.mount.children, [harness.image]);
  assert.equal(harness.image.className, "workshop-projector-powered-off");
  assert.equal(harness.image.alt, "");
  assert.equal(harness.image.attributes.get("aria-hidden"), "true");
  assert.equal(harness.image.attributes.get("data-projector-state"), "POWERED_OFF");
  assert.equal(harness.image.src, POWERED_OFF_PROJECTOR_ASSET);
  assert.equal(harness.image.draggable, false);

  harness.image.dispatch("load");
  assert.equal(await view.ready, harness.image);
});

test("reports asset decode failure without changing state", async () => {
  const harness = createHarness();
  const view = mountPoweredOffProjector(harness);
  harness.image.dispatch("error");

  await assert.rejects(view.ready, /Powered-off Projector failed to load/);
  assert.equal(view.state, POWERED_OFF_PROJECTOR_STATE);
});

test("rejects incomplete hosts and empty asset paths", () => {
  assert.throws(() => mountPoweredOffProjector(), /document must provide createElement/);
  assert.throws(
    () => mountPoweredOffProjector({ document: {}, mount: {} }),
    /document must provide createElement/,
  );
  const harness = createHarness();
  assert.throws(
    () => mountPoweredOffProjector({ ...harness, assetPath: "" }),
    /assetPath must be a non-empty string/,
  );
});

test("remains isolated from powered states, animation, events, and positioning", async () => {
  const source = await readFile(
    new URL("../../js/workshop/projector/powered-off-projector-view.mjs", import.meta.url),
    "utf8",
  );
  [
    "requestAnimationFrame",
    "dispatchEvent",
    "POWERING_ON",
    "PROJECTION_STARTING",
    "FULLY_ACTIVE",
    "projector:powered-on",
    "projector:active",
    "style.left",
    "style.top",
    "style.transform",
  ].forEach((forbidden) => assert.equal(source.includes(forbidden), false, forbidden));
});
