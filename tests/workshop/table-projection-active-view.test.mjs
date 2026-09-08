import test from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_PROJECTION_ACTIVE_GRID,
  TABLE_PROJECTION_ACTIVE_TIMING,
  calculateTableProjectionActivePresentation,
  createTableProjectionActiveView,
  tableProjectionPowerUpEasing,
} from "../../js/workshop/table/table-projection-active-view.mjs";

function harness({ reduced = false } = {}) {
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const frames = new Map();
  const fields = [];
  const grids = [];
  const visibility = [];
  let serial = 0;
  let clock = 0;
  let tableVisible = true;
  const view = createTableProjectionActiveView({
    document,
    getTableVisible: () => tableVisible,
    applyFieldOpacity(value) { fields.push(value); },
    applyGridScalar(value) { grids.push(value); },
    applyGridVisibility(value) { visibility.push(value); },
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    now: () => clock,
    reducedMotion: () => reduced,
  });
  const run = (time) => {
    clock = time;
    const next = frames.entries().next().value;
    assert.ok(next, "an animation frame should be pending");
    frames.delete(next[0]);
    next[1](time);
  };
  return {
    view, document, listeners, frames, fields, grids, visibility, run,
    setClock(value) { clock = value; },
    setTableVisible(value) { tableVisible = value; view.syncVisibility(); },
    visibilityChange(hidden) { document.hidden = hidden; listeners.get("visibilitychange")?.(); },
  };
}

function settleStarting(h) {
  h.view.setWorkshopActive(true);
  h.view.startProjectionGrid();
  h.run(0);
  h.run(500);
}

test("records approved Fully Active timing, grid endpoints, and zero-render expansion", () => {
  assert.deepEqual(TABLE_PROJECTION_ACTIVE_TIMING.easing, [0.16, 1, 0.3, 1]);
  assert.equal(TABLE_PROJECTION_ACTIVE_TIMING.duration, 300);
  assert.equal(TABLE_PROJECTION_ACTIVE_TIMING.reducedDuration, 150);
  assert.equal(TABLE_PROJECTION_ACTIVE_GRID.minorStartingOpacity, 0.099);
  assert.equal(TABLE_PROJECTION_ACTIVE_GRID.majorActiveOpacity, 0.2652);
  assert.equal(TABLE_PROJECTION_ACTIVE_GRID.maximumNewMeshes, 0);
  assert.equal(TABLE_PROJECTION_ACTIVE_GRID.maximumAdditionalRenderCalls, 0);
});

test("power-up easing preserves exact endpoints and stays monotonic", () => {
  let previous = 0;
  for (let index = 0; index <= 1000; index += 1) {
    const value = tableProjectionPowerUpEasing(index / 1000);
    assert.ok(value >= previous - 1e-12);
    previous = value;
  }
  assert.equal(tableProjectionPowerUpEasing(0), 0);
  assert.equal(tableProjectionPowerUpEasing(1), 1);
});

test("starts the existing world grid at scalar 0.55 in 500ms once", () => {
  const h = harness();
  let complete = 0;
  h.view.setWorkshopActive(true);
  const result = h.view.startProjectionGrid({ complete: () => { complete += 1; } });
  assert.equal(result.duration, 500);
  h.run(0); h.run(250); h.run(500);
  assert.equal(h.view.presentation.gridScalar, 0.55);
  assert.equal(h.view.presentation.fieldOpacity, 0.62);
  assert.equal(complete, 1);
  assert.equal(h.fields.length, 0);
});

test("settles field and grid to approved Fully Active endpoints in 300ms once", () => {
  const h = harness();
  let complete = 0;
  settleStarting(h);
  const result = h.view.settleActive({ complete: () => { complete += 1; } });
  assert.equal(result.duration, 300);
  h.run(500); h.run(650); h.run(800);
  assert.deepEqual(h.view.presentation, { fieldOpacity: 0.72, gridScalar: 0.78, heightRatio: 1, emitterOpacity: 1 });
  assert.equal(h.view.state, "FULLY_ACTIVE");
  assert.equal(complete, 1);
});

test("calculation keeps height and emitters fixed", () => {
  const middle = calculateTableProjectionActivePresentation(150);
  assert.equal(middle.heightRatio, 1);
  assert.equal(middle.emitterOpacity, 1);
  assert.ok(middle.fieldOpacity > 0.62 && middle.fieldOpacity < 0.72);
  assert.throws(() => calculateTableProjectionActivePresentation(-1), /finite nonnegative/);
});

test("reduced motion settles monotonically in 150ms", () => {
  const h = harness({ reduced: true });
  h.view.setWorkshopActive(true);
  const start = h.view.startProjectionGrid();
  assert.equal(start.duration, 150);
  h.run(0); h.run(150);
  const active = h.view.settleActive();
  assert.equal(active.duration, 150);
  h.run(150); h.run(225);
  assert.ok(Math.abs(h.view.presentation.fieldOpacity - 0.67) < 1e-12);
  h.run(300);
  assert.equal(h.view.presentation.fieldOpacity, 0.72);
});

test("shutdown removes the grid in 400ms without changing the active field", () => {
  const h = harness();
  let complete = 0;
  settleStarting(h);
  h.view.settleActive(); h.run(500); h.run(800);
  const result = h.view.stopProjectionGrid({ complete: () => { complete += 1; } });
  assert.equal(result.duration, 400);
  h.run(800); h.run(1000);
  assert.ok(h.view.presentation.gridScalar > 0 && h.view.presentation.gridScalar < 0.78);
  assert.equal(h.view.presentation.fieldOpacity, 0.72);
  h.run(1200);
  assert.equal(h.view.presentation.gridScalar, 0);
  assert.equal(h.view.presentation.fieldOpacity, 0.72);
  assert.equal(h.view.state, "POWERED_ON");
  assert.equal(complete, 1);
});

test("reduced-motion shutdown removes the grid monotonically within 150ms", () => {
  const h = harness({ reduced: true });
  settleStarting(h);
  h.view.settleActive(); h.run(150); h.run(300);
  const result = h.view.stopProjectionGrid();
  assert.equal(result.duration, 150);
  h.run(300); h.run(375);
  assert.ok(h.view.presentation.gridScalar > 0 && h.view.presentation.gridScalar < 0.78);
  h.run(450);
  assert.equal(h.view.presentation.gridScalar, 0);
});

test("pauses hidden-tab time and resumes without a jump", () => {
  const h = harness();
  settleStarting(h);
  h.view.settleActive();
  h.run(500); h.run(600);
  const paused = h.view.presentation;
  h.setClock(600); h.visibilityChange(true);
  h.setClock(1600); h.visibilityChange(false);
  assert.deepEqual(h.view.presentation, paused);
  h.run(1600); h.run(1800);
  assert.equal(h.view.state, "FULLY_ACTIVE");
});

test("repeated activation is idempotent after settlement", () => {
  const h = harness();
  settleStarting(h);
  h.view.settleActive(); h.run(500); h.run(800);
  const result = h.view.settleActive();
  assert.equal(result.code, "IDEMPOTENT");
  assert.equal(result.duration, 0);
});

test("cancels from current values and rejects the stale active completion", () => {
  const h = harness();
  let active = 0;
  let reversed = 0;
  settleStarting(h);
  h.view.settleActive({ complete: () => { active += 1; } });
  h.run(500); h.run(600);
  const current = h.view.presentation;
  const reverse = h.view.cancelToProjectionStarting({ complete: () => { reversed += 1; } });
  assert.ok(reverse.duration > 0 && reverse.duration < 300);
  assert.deepEqual(h.view.presentation, current);
  h.run(600); h.run(600 + reverse.duration);
  assert.equal(h.view.presentation.fieldOpacity, 0.62);
  assert.equal(h.view.presentation.gridScalar, 0.55);
  assert.equal(active, 0);
  assert.equal(reversed, 1);
});

test("hides and restores without changing settled state", () => {
  const h = harness();
  settleStarting(h);
  h.view.settleActive(); h.run(500); h.run(800);
  const settled = h.view.presentation;
  h.setTableVisible(false);
  assert.equal(h.visibility.at(-1), false);
  h.setTableVisible(true);
  assert.equal(h.visibility.at(-1), true);
  assert.deepEqual(h.view.presentation, settled);
});

test("fault settlement clears and hides the grid without completing stability", () => {
  const h = harness();
  let stable = 0;
  let fault = 0;
  settleStarting(h);
  h.view.settleActive({ complete: () => { stable += 1; } });
  h.run(500); h.run(600);
  h.view.enterFaultSafe({ complete: () => { fault += 1; } });
  assert.equal(h.view.state, "FAULT_SAFE");
  assert.equal(h.view.presentation.gridScalar, 0);
  assert.equal(h.visibility.at(-1), false);
  assert.equal(stable, 0);
  assert.equal(fault, 1);
});

test("leaving Workshop resets grid ownership without changing field geometry", () => {
  const h = harness();
  settleStarting(h);
  h.view.setWorkshopActive(false);
  assert.equal(h.view.state, "POWERED_ON");
  assert.equal(h.view.presentation.gridScalar, 0);
  assert.equal(h.visibility.at(-1), false);
});

test("disposal removes listeners, frames, and visibility without renderer objects", () => {
  const h = harness();
  h.view.setWorkshopActive(true);
  h.view.startProjectionGrid();
  h.view.dispose();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.view.state, "DISPOSED");
  assert.equal(h.visibility.at(-1), false);
});
