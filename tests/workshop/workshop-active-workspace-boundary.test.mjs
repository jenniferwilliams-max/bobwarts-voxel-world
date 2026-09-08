import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkshopActiveWorkspaceBoundary,
  normalizeWorkshopActiveWorkspaceRange,
  workshopBoundsFitActiveWorkspace
} from "../../js/workshop/runtime/workshop-active-workspace-boundary.mjs";

const home = { xMin: -10, xMax: 10, zMin: -10, zMax: 10 };

test("normalizes and freezes the default Home workspace", () => {
  const snapshot = normalizeWorkshopActiveWorkspaceRange(home, "HOME");
  assert.deepEqual(snapshot, {
    ...home,
    columns: 20,
    rows: 20,
    source: "HOME",
    valid: true
  });
  assert.equal(Object.isFrozen(snapshot), true);
});

test("fails closed for invalid, unsupported, and out-of-world ranges", () => {
  assert.equal(normalizeWorkshopActiveWorkspaceRange(null, "HOME"), null);
  assert.equal(normalizeWorkshopActiveWorkspaceRange(home, "FIT"), null);
  assert.equal(normalizeWorkshopActiveWorkspaceRange({
    xMin: 30, xMax: 40, zMin: -10, zMax: 10
  }, "HOME"), null);
});

test("contains complete candidate bounds and rejects partial overhang", () => {
  const snapshot = normalizeWorkshopActiveWorkspaceRange(home, "HOME");
  assert.equal(workshopBoundsFitActiveWorkspace({
    min: { x: -10, z: -10 }, max: { x: 10, z: 10 }
  }, snapshot), true);
  assert.equal(workshopBoundsFitActiveWorkspace({
    min: { x: 9.5, z: -0.5 }, max: { x: 10.5, z: 0.5 }
  }, snapshot), false);
  assert.equal(workshopBoundsFitActiveWorkspace(null, snapshot), false);
});

test("updates idempotently, expands by manual zoom, and resets", () => {
  const owner = createWorkshopActiveWorkspaceBoundary();
  const first = owner.update(home, "HOME");
  assert.equal(owner.update(home, "HOME"), first);
  const expanded = owner.update({
    xMin: -15, xMax: 15, zMin: -14, zMax: 14
  }, "MANUAL_ZOOM");
  assert.notEqual(expanded, first);
  assert.equal(expanded.columns, 30);
  assert.equal(owner.contains({
    min: { x: -14.5, z: -13.5 }, max: { x: 14.5, z: 13.5 }
  }), true);
  assert.equal(owner.reset(), true);
  assert.equal(owner.read(), null);
  assert.equal(owner.contains({ min: { x: 0, z: 0 }, max: { x: 1, z: 1 } }), false);
});
