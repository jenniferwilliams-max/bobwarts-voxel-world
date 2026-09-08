import test from "node:test";
import assert from "node:assert/strict";
import {
  PROJECTOR_PROJECTION_TIMING,
  PROJECTOR_PROJECTION_TRACE_ASSET,
  calculateActiveTraceOpacity,
  calculateProjectionActivePresentation,
  calculateProjectionStartingPresentation,
  mountProjectorProjectionActiveView,
} from "../../js/workshop/projector/projector-projection-active-view.mjs";

function element(tagName = "div") {
  const listeners = new Map();
  return {
    tagName, style: {}, dataset: {}, children: [], attributes: {},
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatch(name) { listeners.get(name)?.(); },
  };
}

function harness({ reduced = false } = {}) {
  let clock = 0;
  let hidden = false;
  let queue = [];
  const listeners = new Map();
  const document = {
    get hidden() { return hidden; },
    createElement: (tagName) => element(tagName),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  const mount = element();
  const lens = element("img");
  const view = mountProjectorProjectionActiveView({
    document, mount, lensElement: lens,
    requestAnimationFrame: (callback) => { queue.push(callback); },
    now: () => clock,
    reducedMotion: () => reduced,
  });
  const tick = (time) => {
    clock = time;
    const callbacks = queue;
    queue = [];
    callbacks.forEach((callback) => callback(time));
  };
  const setHidden = (value, time) => {
    clock = time;
    hidden = value;
    listeners.get("visibilitychange")?.();
  };
  return { view, mount, lens, tick, setHidden };
}

test("declares the approved trace and timing contract", () => {
  assert.equal(PROJECTOR_PROJECTION_TRACE_ASSET.endsWith("projector-projection-trace-v3-587x587.png"), true);
  assert.deepEqual(PROJECTOR_PROJECTION_TIMING, {
    startingDuration: 500, activeSettleDuration: 300,
    reducedStartingDuration: 150, reducedActiveSettleDuration: 120,
    activeBaseOpacity: 0.4, activeVariation: 0.02, activePeriod: 6000,
    poweredStandbyLensOpacity: 0.85, startingTraceOpacity: 0.45,
  });
});

test("calculates normal starting and active endpoints", () => {
  assert.deepEqual(calculateProjectionStartingPresentation(0), { lens: 0.85, trace: 0, progress: 0, complete: false });
  assert.deepEqual(calculateProjectionStartingPresentation(500), { lens: 1, trace: 0.45, progress: 1, complete: true });
  assert.deepEqual(calculateProjectionActivePresentation(0), { lens: 1, trace: 0.45, progress: 0, complete: false });
  assert.deepEqual(calculateProjectionActivePresentation(300), { lens: 1, trace: 0.4, progress: 1, complete: true });
});

test("uses bounded active luminance modulation", () => {
  assert.equal(calculateActiveTraceOpacity(0), 0.4);
  assert.ok(Math.abs(calculateActiveTraceOpacity(1500) - 0.408) < 1e-12);
  assert.ok(Math.abs(calculateActiveTraceOpacity(4500) - 0.392) < 1e-12);
});

test("mounts one decorative trace in powered standby", async () => {
  const { view, mount, lens } = harness();
  assert.equal(mount.children.length, 1);
  assert.equal(view.trace.attributes["aria-hidden"], "true");
  assert.equal(view.trace.alt, "");
  assert.equal(view.trace.style.opacity, "0");
  assert.equal(lens.style.opacity, "0.85");
  view.trace.dispatch("load");
  await view.ready;
});

test("runs starting and active settlement once in order", () => {
  const { view, tick } = harness();
  let started = 0;
  let active = 0;
  assert.equal(view.start({ transitionId: "t1", complete: () => { started += 1; } }).code, "ACCEPTED");
  tick(0); tick(500);
  assert.equal(started, 1);
  assert.equal(view.settleActive({ transitionId: "t1", complete: () => { active += 1; } }).code, "ACCEPTED");
  tick(500); tick(800);
  assert.equal(active, 1);
  assert.equal(view.getSnapshot().state, "FULLY_ACTIVE");
  tick(800); tick(2300);
  assert.ok(Math.abs(view.getSnapshot().values.trace - 0.408) < 1e-12);
});

test("rejects active settlement before starting completes", () => {
  const { view } = harness();
  view.start({ transitionId: "t2" });
  assert.equal(view.settleActive({ transitionId: "t2" }).code, "PROJECTION_START_NOT_SETTLED");
});

test("uses reduced-motion settlement and suppresses modulation", () => {
  const { view, tick } = harness({ reduced: true });
  view.start({ transitionId: "t3" });
  tick(0); tick(150);
  view.settleActive({ transitionId: "t3" });
  tick(150); tick(270); tick(6270);
  assert.equal(view.getSnapshot().state, "FULLY_ACTIVE");
  assert.equal(view.getSnapshot().values.trace, 0.4);
});

test("cancels from current values without stale completion", () => {
  const { view, tick } = harness();
  let stale = 0;
  let cancelled = 0;
  view.start({ transitionId: "t4", complete: () => { stale += 1; } });
  tick(0); tick(250);
  const before = view.getSnapshot().values.trace;
  assert.equal(view.cancelToStandby({ complete: () => { cancelled += 1; } }).code, "REVERSING");
  assert.equal(view.getSnapshot().values.trace, before);
  tick(250); tick(550);
  assert.equal(stale, 0);
  assert.equal(cancelled, 1);
  assert.equal(view.getSnapshot().state, "POWERED_ON");
});

test("holds hidden transitions and resumes their remaining duration", () => {
  const { view, tick, setHidden } = harness();
  let complete = 0;
  view.start({ transitionId: "t5", complete: () => { complete += 1; } });
  tick(0); tick(200);
  const held = view.getSnapshot().values.trace;
  setHidden(true, 200); tick(1000);
  assert.equal(view.getSnapshot().values.trace, held);
  setHidden(false, 1200); tick(1200); tick(1500);
  assert.equal(complete, 1);
});

test("settles active opacity while hidden and restarts modulation on visibility", () => {
  const { view, tick, setHidden } = harness();
  view.start({ transitionId: "t6" }); tick(0); tick(500);
  view.settleActive({ transitionId: "t6" }); tick(500); tick(800); tick(2300); tick(3800);
  assert.ok(Math.abs(view.getSnapshot().values.trace - 0.408) < 1e-12);
  setHidden(true, 2400);
  assert.equal(view.getSnapshot().values.trace, 0.4);
  setHidden(false, 3000); tick(3000);
  assert.equal(view.getSnapshot().values.trace, 0.4);
});
