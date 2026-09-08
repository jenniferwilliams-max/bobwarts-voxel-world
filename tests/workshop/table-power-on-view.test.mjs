import test from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_POWER_TIMING,
  calculateTableEmitterPresentation,
  createTablePowerOnView,
} from "../../js/workshop/table/table-power-on-view.mjs";

function harness({ reduced = false } = {}) {
  const materials = { rear: { opacity: 1, visible: true }, front: { opacity: 1, visible: true } };
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const frames = new Map();
  let frameSerial = 0;
  let clock = 0;
  const audio = [];
  const view = createTablePowerOnView({
    materials,
    document,
    requestAnimationFrame(callback) { const id = ++frameSerial; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    now: () => clock,
    reducedMotion: () => reduced,
    audio: { trigger: (token) => audio.push(token) },
  });
  const run = (time) => {
    clock = time;
    const next = frames.entries().next().value;
    const callback = next?.[1];
    assert.equal(typeof callback, "function");
    frames.delete(next[0]);
    callback(time);
  };
  return {
    view, materials, document, frames, audio, run,
    setClock(value) { clock = value; },
    visibility(hidden) { document.hidden = hidden; listeners.get("visibilitychange")?.(); },
    listeners,
  };
}

test("defines the approved timing and deterministic endpoints", () => {
  assert.deepEqual(TABLE_POWER_TIMING, {
    duration: 400,
    shutdownDuration: 350,
    reducedDuration: 150,
    endpointOpacity: 0.75,
    easing: [0.16, 1, 0.30, 1],
  });
  assert.equal(calculateTableEmitterPresentation(0).opacity, 0);
  assert.equal(calculateTableEmitterPresentation(400).opacity, 0.75);
  assert.equal(calculateTableEmitterPresentation(400).complete, true);
});

test("powers both emitter layers to 0.75 in 400ms and completes once", () => {
  const h = harness();
  let begins = 0;
  let completions = 0;
  const result = h.view.powerOn({ begin: () => { begins += 1; return true; }, complete: () => { completions += 1; } });
  assert.equal(result.duration, 400);
  assert.equal(h.view.state, "POWERING_ON");
  assert.deepEqual(h.audio, ["relay-on"]);
  h.run(0);
  h.run(200);
  assert.ok(h.view.opacity > 0 && h.view.opacity < 0.75);
  h.run(400);
  assert.equal(h.view.opacity, 0.75);
  assert.equal(h.materials.rear.opacity, 0.75);
  assert.equal(h.materials.front.opacity, 0.75);
  assert.equal(h.view.state, "POWERED_ON");
  assert.equal(begins, 1);
  assert.equal(completions, 1);
});

test("uses a flicker-free 150ms reduced-motion fade", () => {
  const h = harness({ reduced: true });
  let complete = 0;
  const result = h.view.powerOn({ complete: () => { complete += 1; } });
  assert.equal(result.duration, 150);
  h.run(0);
  h.run(150);
  assert.equal(h.view.opacity, 0.75);
  assert.equal(complete, 1);
});

test("reverses from the current value with proportional duration and rejects stale completion", () => {
  const h = harness();
  let poweredOn = 0;
  let poweredOff = 0;
  h.view.powerOn({ complete: () => { poweredOn += 1; } });
  h.run(0);
  h.run(200);
  const current = h.view.opacity;
  const result = h.view.powerOff({ complete: () => { poweredOff += 1; } });
  assert.ok(Math.abs(result.duration - 350 * current / 0.75) < 0.001);
  h.run(200);
  h.run(200 + result.duration);
  assert.equal(h.view.opacity, 0);
  assert.equal(h.view.state, "POWERED_OFF");
  assert.equal(poweredOn, 0);
  assert.equal(poweredOff, 1);
});

test("pauses while the browser tab is hidden and resumes without a jump", () => {
  const h = harness();
  let complete = 0;
  h.view.powerOn({ complete: () => { complete += 1; } });
  h.run(0);
  h.run(100);
  const paused = h.view.opacity;
  h.setClock(100);
  h.visibility(true);
  h.setClock(1100);
  h.visibility(false);
  assert.equal(h.view.opacity, paused);
  h.run(1100);
  h.run(1400);
  assert.equal(h.view.opacity, 0.75);
  assert.equal(complete, 1);
});

test("fault settlement cancels animation and forces both emitters off", () => {
  const h = harness();
  let startup = 0;
  let fault = 0;
  h.view.powerOn({ complete: () => { startup += 1; } });
  h.run(0);
  h.run(100);
  assert.ok(h.view.opacity > 0);
  h.view.enterFaultSafe({ complete: () => { fault += 1; } });
  assert.equal(h.view.state, "FAULT_SAFE");
  assert.equal(h.view.opacity, 0);
  assert.equal(h.materials.rear.visible, false);
  assert.equal(h.materials.front.visible, false);
  assert.equal(startup, 0);
  assert.equal(fault, 1);
});

test("missing or failed audio never gates visual completion", () => {
  const materials = { rear: {}, front: {} };
  const callbacks = [];
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const view = createTablePowerOnView({
    materials,
    document,
    requestAnimationFrame(callback) { callbacks.push(callback); return callbacks.length; },
    now: () => 0,
    reducedMotion: () => false,
    audio: { trigger() { throw new Error("audio unavailable"); } },
  });
  let complete = 0;
  view.powerOn({ complete: () => { complete += 1; } });
  callbacks.shift()(0);
  callbacks.shift()(400);
  assert.equal(complete, 1);
  view.dispose();
});

test("adopts projection emitter opacity without animation, audio, or completion", () => {
  const h = harness();
  h.view.powerOn(); h.run(0); h.run(400);
  const audioCount = h.audio.length;
  const result = h.view.adoptProjectionOpacity(1);
  assert.deepEqual(result, { ok: true, code: "ADOPTED", opacity: 1 });
  assert.equal(h.view.opacity, 1);
  assert.equal(h.materials.rear.opacity, 1);
  assert.equal(h.materials.front.opacity, 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.audio.length, audioCount);
  assert.throws(() => h.view.adoptProjectionOpacity(0.74), /between 0.75 and 1/);
});

test("returns to the WS-012 endpoint before power-down without a jump", () => {
  const h = harness();
  h.view.powerOn(); h.run(0); h.run(400);
  h.view.adoptProjectionOpacity(1);
  h.view.adoptProjectionOpacity(0.75);
  const result = h.view.powerOff();
  assert.equal(result.duration, 350);
  assert.equal(h.view.opacity, 0.75);
  h.run(400);
  assert.equal(h.view.opacity, 0.75);
  h.run(750);
  assert.equal(h.view.opacity, 0);
});
