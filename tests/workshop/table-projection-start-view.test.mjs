import test from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_PROJECTION_FIELD_CONFIGURATION,
  TABLE_PROJECTION_START_TIMING,
  calculateRegisteredFieldPoints,
  calculateTableProjectionPresentation,
  createTableProjectionStartView,
  projectionSettleEasing,
} from "../../js/workshop/table/table-projection-start-view.mjs";

class Geometry {
  constructor() { this.attributes = {}; this.disposed = false; }
  setAttribute(name, value) { this.attributes[name] = value; }
  computeBoundingSphere() {}
  dispose() { this.disposed = true; }
}
class Attribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
class Material {
  constructor(options = {}) { Object.assign(this, options); this.uniforms ||= {}; this.disposed = false; }
  dispose() { this.disposed = true; }
}
class Object3D {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.visible = true; this.renderOrder = 0; }
}
const THREE = {
  BufferGeometry: Geometry,
  Float32BufferAttribute: Attribute,
  ShaderMaterial: Material,
  Mesh: Object3D,
  LineBasicMaterial: Material,
  LineSegments: Object3D,
};

function harness({ reduced = false } = {}) {
  const children = [];
  const camera = {
    add(object) { children.push(object); },
    remove(object) { const index = children.indexOf(object); if (index >= 0) children.splice(index, 1); },
  };
  const registration = {
    transform: { x: 0, y: 0, z: -800, width: 1761, height: 1174 },
  };
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const frames = new Map();
  let serial = 0;
  let clock = 0;
  let tableVisible = true;
  const emitterValues = [];
  const audio = [];
  const view = createTableProjectionStartView({
    THREE,
    camera,
    getRegistration: () => registration,
    getTableVisible: () => tableVisible,
    adoptEmitterOpacity(value) { emitterValues.push(value); },
    document,
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    now: () => clock,
    reducedMotion: () => reduced,
    audio: { trigger: (token) => audio.push(token) },
  });
  const run = (time) => {
    clock = time;
    const next = frames.entries().next().value;
    assert.ok(next, "an animation frame should be pending");
    frames.delete(next[0]);
    next[1](time);
  };
  return {
    view, camera, children, registration, document, listeners, frames, emitterValues, audio, run,
    setClock(value) { clock = value; },
    setTableVisible(value) { tableVisible = value; view.syncRegistration(); },
    visibility(hidden) { document.hidden = hidden; listeners.get("visibilitychange")?.(); },
  };
}

test("records the approved geometry, colors, alpha, and timing", () => {
  assert.equal(TABLE_PROJECTION_START_TIMING.duration, 500);
  assert.equal(TABLE_PROJECTION_START_TIMING.reducedDuration, 150);
  assert.equal(TABLE_PROJECTION_START_TIMING.endingFieldOpacity, 0.62);
  assert.equal(TABLE_PROJECTION_FIELD_CONFIGURATION.emitterPlane.length, 4);
  assert.equal(TABLE_PROJECTION_FIELD_CONFIGURATION.colors.base, 0x55ddf5);
  assert.equal(TABLE_PROJECTION_FIELD_CONFIGURATION.alpha.topPerimeter, 0.36);
  assert.throws(() => calculateTableProjectionPresentation(-1), /finite nonnegative/);
});

test("maps all four approved emitters into the registered Table transform", () => {
  const points = calculateRegisteredFieldPoints({ transform: { x: 0, y: 0, z: -800, width: 1761, height: 1174 } }, 1);
  assert.equal(points.base.length, 4);
  assert.ok(Math.abs(points.height - 93.92) < 1e-9);
  assert.ok(Math.abs(points.base[0].x - (-880.5 + 0.104486 * 1761)) < 1e-9);
  assert.ok(Math.abs(points.top[0].y - points.base[0].y - 93.92) < 1e-9);
});

test("creates exactly two non-raycasting meshes and no renderer dependency", () => {
  const h = harness();
  assert.equal(h.children.length, 2);
  assert.equal(h.view.meshes.field.renderOrder, 0);
  assert.equal(h.view.meshes.traces.renderOrder, 0);
  assert.equal(typeof h.view.meshes.field.raycast, "function");
  h.view.dispose();
});

test("reaches height 1H, field 0.62, and emitters 1 in 500ms once", () => {
  const h = harness();
  let complete = 0;
  h.view.setWorkshopActive(true);
  const result = h.view.start({ complete: () => { complete += 1; } });
  assert.equal(result.duration, 500);
  h.run(0);
  h.run(250);
  assert.ok(h.view.presentation.fieldOpacity > 0 && h.view.presentation.fieldOpacity < 0.62);
  h.run(500);
  assert.deepEqual(h.view.presentation, { heightRatio: 1, fieldOpacity: 0.62, emitterOpacity: 1 });
  assert.equal(complete, 1);
  assert.equal(h.view.state, "PROJECTION_STARTED");
});

test("limits projection-settle height overshoot to two percent", () => {
  let maximum = 0;
  for (let index = 0; index <= 1000; index += 1) maximum = Math.max(maximum, projectionSettleEasing(index / 1000));
  assert.ok(maximum <= 1.02);
  assert.equal(projectionSettleEasing(1), 1);
});

test("uses a monotonic 150ms reduced-motion settlement", () => {
  const h = harness({ reduced: true });
  const result = h.view.start();
  assert.equal(result.duration, 150);
  h.run(0);
  h.run(75);
  const middle = h.view.presentation;
  assert.equal(middle.heightRatio, 0.54);
  h.run(150);
  assert.equal(h.view.presentation.fieldOpacity, 0.62);
});

test("reverses continuously from current values and rejects stale completion", () => {
  const h = harness();
  let started = 0;
  let stopped = 0;
  h.view.start({ complete: () => { started += 1; } });
  h.run(0);
  h.run(100);
  const current = h.view.presentation;
  const reverse = h.view.stopToPoweredOn({ complete: () => { stopped += 1; } });
  assert.ok(reverse.duration > 0 && reverse.duration < 500);
  assert.deepEqual(h.view.presentation, current);
  h.run(100);
  h.run(100 + reverse.duration);
  assert.deepEqual(h.view.presentation, { heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 });
  const settledHandoffs = h.emitterValues.length;
  h.view.syncRegistration();
  assert.equal(h.emitterValues.length, settledHandoffs);
  assert.equal(started, 0);
  assert.equal(stopped, 1);
});

test("repeated activation is idempotent after the rendered endpoint", () => {
  const h = harness();
  h.view.start(); h.run(0); h.run(500);
  const result = h.view.start();
  assert.equal(result.code, "IDEMPOTENT");
  assert.equal(result.duration, 0);
});

test("adopts only the bounded Fully Active opacity after Projection Starting settles", () => {
  const h = harness();
  assert.equal(h.view.adoptActiveFieldOpacity(0.72).code, "PROJECTION_START_NOT_SETTLED");
  h.view.start(); h.run(0); h.run(500);
  const result = h.view.adoptActiveFieldOpacity(0.72);
  assert.deepEqual(result, { ok: true, code: "ADOPTED", fieldOpacity: 0.72 });
  assert.deepEqual(h.view.presentation, { heightRatio: 1, fieldOpacity: 0.72, emitterOpacity: 1 });
  assert.throws(() => h.view.adoptActiveFieldOpacity(0.73), /between 0.62 and 0.72/);
});

test("reverses an adopted Fully Active field continuously", () => {
  const h = harness();
  h.view.start(); h.run(0); h.run(500);
  h.view.adoptActiveFieldOpacity(0.72);
  const reverse = h.view.stopToPoweredOn();
  assert.deepEqual(h.view.presentation, { heightRatio: 1, fieldOpacity: 0.72, emitterOpacity: 1 });
  h.run(500); h.run(500 + reverse.duration);
  assert.deepEqual(h.view.presentation, { heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 });
});

test("pauses hidden-tab time and resumes without a jump", () => {
  const h = harness();
  h.view.start(); h.run(0); h.run(100);
  const paused = h.view.presentation;
  h.setClock(100); h.visibility(true);
  h.setClock(1100); h.visibility(false);
  assert.deepEqual(h.view.presentation, paused);
  h.run(1100); h.run(1500);
  assert.equal(h.view.presentation.fieldOpacity, 0.62);
});

test("inherits Table hiding and restores without restarting", () => {
  const h = harness();
  h.view.setWorkshopActive(true);
  h.view.start(); h.run(0); h.run(250);
  h.setTableVisible(false);
  assert.equal(h.view.meshes.field.visible, false);
  const current = h.view.presentation;
  h.setTableVisible(true);
  assert.equal(h.view.meshes.field.visible, true);
  assert.deepEqual(h.view.presentation, current);
});

test("fault settlement cancels motion and clears the field", () => {
  const h = harness();
  let fault = 0;
  h.view.start(); h.run(0); h.run(100);
  h.view.enterFaultSafe({ complete: () => { fault += 1; } });
  assert.deepEqual(h.view.presentation, { heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 });
  assert.equal(h.view.state, "FAULT_SAFE");
  assert.equal(fault, 1);
});

test("disposes geometry, materials, listeners, and camera children", () => {
  const h = harness();
  const field = h.view.meshes.field;
  const traces = h.view.meshes.traces;
  h.view.dispose();
  assert.equal(h.children.length, 0);
  assert.equal(field.geometry.disposed, true);
  assert.equal(traces.geometry.disposed, true);
  assert.equal(field.material.disposed, true);
  assert.equal(h.listeners.size, 0);
});
