import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECTOR_POWER_ON_ASSETS,
  PROJECTOR_POWER_ON_TIMING,
  calculateProjectorPowerPresentation,
  mountProjectorPowerOnView,
  powerUpEasing,
} from "../../js/workshop/projector/projector-power-on-view.mjs";

function fakeImage() {
  const listeners = new Map();
  return {
    attributes: new Map(),
    style: {},
    addEventListener(name, listener) { listeners.set(name, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name) { listeners.get(name)?.(); },
  };
}

function harness({ reduced = false } = {}) {
  const queue = [];
  const images = [];
  const mount = {
    children: [],
    dataset: {},
    appendChild(child) { this.children.push(child); },
  };
  const view = mountProjectorPowerOnView({
    document: { createElement(name) {
      assert.equal(name, "img");
      const image = fakeImage();
      images.push(image);
      return image;
    } },
    mount,
    requestAnimationFrame(callback) { queue.push(callback); },
    reducedMotion: () => reduced,
  });
  const tick = (timestamp) => {
    const callbacks = queue.splice(0);
    callbacks.forEach((callback) => callback(timestamp));
  };
  return { view, mount, images, tick, queue };
}

test("records the approved six assets and power-up timeline", () => {
  assert.equal(Object.keys(PROJECTOR_POWER_ON_ASSETS).length, 6);
  assert.deepEqual(PROJECTOR_POWER_ON_TIMING, {
    hold: 200,
    duration: 300,
    reducedDuration: 120,
    easing: [0.16, 1, 0.30, 1],
    layers: {
      lens: { start: 0, end: 300, opacity: 0.85 },
      lowerBars: { start: 0, end: 120, opacity: 1 },
      lowerStatusDots: { start: 40, end: 160, opacity: 1 },
      upperOuterBars: { start: 80, end: 200, opacity: 1 },
      upperInnerBars: { start: 120, end: 240, opacity: 1 },
      topRingPair: { start: 160, end: 280, opacity: 1 },
    },
  });
});

test("power-up easing preserves endpoints and is monotonic", () => {
  assert.equal(powerUpEasing(0), 0);
  assert.equal(powerUpEasing(1), 1);
  const samples = [0, 0.1, 0.25, 0.5, 0.75, 1].map(powerUpEasing);
  samples.slice(1).forEach((value, index) => assert.ok(value >= samples[index]));
});

test("normal presentation follows the approved order and endpoints", () => {
  const at39 = calculateProjectorPowerPresentation(39);
  assert.ok(at39.lowerBars > 0);
  assert.equal(at39.lowerStatusDots, 0);
  const at100 = calculateProjectorPowerPresentation(100);
  assert.ok(at100.lowerStatusDots > 0);
  assert.ok(at100.upperOuterBars > 0);
  assert.equal(at100.upperInnerBars, 0);
  const at300 = calculateProjectorPowerPresentation(300);
  assert.equal(at300.lens, 0.85);
  Object.keys(PROJECTOR_POWER_ON_TIMING.layers)
    .filter((name) => name !== "lens")
    .forEach((name) => assert.equal(at300[name], 1, name));
  assert.equal(at300.complete, true);
});

test("reduced motion settles every layer simultaneously within 120 ms", () => {
  const halfway = calculateProjectorPowerPresentation(60, { reducedMotion: true });
  assert.ok(halfway.lens > 0 && halfway.lens < 0.85);
  const normalizedLens = halfway.lens / 0.85;
  Object.keys(PROJECTOR_POWER_ON_TIMING.layers)
    .filter((name) => name !== "lens")
    .forEach((name) => assert.ok(Math.abs(halfway[name] - normalizedLens) < 1e-9, name));
  assert.equal(calculateProjectorPowerPresentation(120, { reducedMotion: true }).complete, true);
});

test("mounts six decorative registered overlays and waits for every asset", async () => {
  const { view, mount, images } = harness();
  assert.equal(images.length, 6);
  images.forEach((image) => {
    assert.equal(image.alt, "");
    assert.equal(image.attributes.get("aria-hidden"), "true");
    assert.equal(image.style.opacity, "0");
    image.dispatch("load");
  });
  assert.equal((await view.ready).length, 6);
  assert.equal(mount.dataset.projectorPowerState, "POWERED_OFF");
});

test("holds Powered Off for 200 ms then completes once at 500 ms", () => {
  const { view, tick } = harness();
  let begins = 0;
  let completions = 0;
  view.start({
    transitionId: "ws008-1",
    begin: () => { begins += 1; return true; },
    complete: () => { completions += 1; return true; },
  });
  tick(0);
  tick(199);
  assert.equal(begins, 0);
  assert.equal(view.getSnapshot().state, "POWERED_OFF");
  tick(200);
  assert.equal(begins, 1);
  assert.equal(view.getSnapshot().state, "POWERING_ON");
  tick(500);
  assert.equal(completions, 1);
  assert.equal(view.getSnapshot().state, "POWERED_ON");
  tick(800);
  assert.equal(completions, 1);
});

test("repeated activation does not restart an active transition", () => {
  const { view, tick } = harness();
  let begins = 0;
  assert.equal(view.start({ transitionId: "ws008-2", begin: () => { begins += 1; return true; } }).code, "ACCEPTED");
  assert.equal(view.start({ transitionId: "ws008-3" }).code, "IDEMPOTENT");
  tick(0);
  tick(200);
  assert.equal(begins, 1);
});

test("cancellation during the hold rejects stale begin and completion", () => {
  const { view, tick } = harness();
  let begins = 0;
  let completions = 0;
  let cancelled = 0;
  view.start({
    transitionId: "ws008-4",
    begin: () => { begins += 1; return true; },
    complete: () => { completions += 1; },
  });
  tick(0);
  view.cancel({ complete: () => { cancelled += 1; } });
  tick(500);
  assert.equal(begins, 0);
  assert.equal(completions, 0);
  assert.equal(cancelled, 1);
  assert.equal(view.getSnapshot().state, "POWERED_OFF");
});

test("mid-transition cancellation reverses current values without residue", () => {
  const { view, tick } = harness();
  let completions = 0;
  let cancelled = 0;
  view.start({ transitionId: "ws008-5", begin: () => true, complete: () => { completions += 1; } });
  tick(0);
  tick(200);
  tick(350);
  const before = view.getSnapshot().values.lens;
  assert.ok(before > 0 && before < 0.85);
  view.cancel({ complete: () => { cancelled += 1; } });
  tick(350);
  assert.equal(view.getSnapshot().values.lens, before);
  tick(650);
  assert.equal(cancelled, 1);
  assert.equal(completions, 0);
  Object.values(view.elements).forEach((image) => assert.equal(image.style.opacity, "0"));
  assert.equal(view.getSnapshot().state, "POWERED_OFF");
});

test("rejects invalid timing and incomplete hosts", () => {
  assert.throws(() => calculateProjectorPowerPresentation(-1), /finite nonnegative/);
  assert.throws(() => mountProjectorPowerOnView(), /document must provide/);
  const { view } = harness();
  assert.throws(() => view.start({ transitionId: "" }), /non-empty string/);
});
