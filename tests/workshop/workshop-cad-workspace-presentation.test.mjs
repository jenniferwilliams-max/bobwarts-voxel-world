import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkshopCadGridPresentation,
  calculateWorkshopCadSafeFrame,
  createWorkshopCadWorkspacePresentation,
} from "../../js/workshop/runtime/workshop-cad-workspace-presentation.mjs";

test("safe frame is canvas-owned and excludes visible edge controls", () => {
  const frame = calculateWorkshopCadSafeFrame({
    canvasBounds: { left: 0, top: 0, width: 1366, height: 768 },
    protectedBounds: [
      { left: 8, top: 50, width: 184, height: 514 },
      { left: 1120, top: 46, width: 234, height: 444 },
      { left: 0, top: 650, width: 1366, height: 118 },
    ],
  });
  assert.deepEqual(frame, {
    left: 204,
    top: 12,
    right: 1108,
    bottom: 638,
    width: 904,
    height: 626,
    inset: 12,
    blocked: false,
  });
});

test("offscreen rectangles do not corrupt the canvas safe frame", () => {
  const frame = calculateWorkshopCadSafeFrame({
    canvasBounds: { left: 0, top: 0, width: 1280, height: 720 },
    protectedBounds: [
      { left: -83301, top: 732, width: 167883, height: 18333 },
    ],
  });
  assert.equal(frame.left, 12);
  assert.equal(frame.top, 12);
  assert.equal(frame.right, 1268);
  assert.equal(frame.bottom, 708);
});

test("default Home exposes exactly twenty rows and columns with distinct origins", () => {
  const grid = calculateWorkshopCadGridPresentation({
    workspace: { xMin: -10, xMax: 10, zMin: -10, zMax: 10 },
  });
  assert.deepEqual(grid.bounds, { xMin: -10, xMax: 10, zMin: -10, zMax: 10 });
  assert.deepEqual(grid.cells, { columns: 20, rows: 20 });
  assert.deepEqual(grid.boundaries, { vertical: 21, horizontal: 21 });
  assert.equal(grid.unit, "CENTIMETER");
  assert.equal(grid.visibleMillimeterSubdivisions, false);
  assert.equal(grid.positions.origin.length, 12);
  assert.equal(grid.positions.minor.length / 6, 32);
  assert.equal(grid.positions.major.length / 6, 8);
});

test("Home expands by integer cells and full Grid remains available", () => {
  const expanded = calculateWorkshopCadGridPresentation({
    workspace: { xMin: -10, xMax: 18.2, zMin: -10, zMax: 10 },
  });
  assert.deepEqual(expanded.bounds, { xMin: -10, xMax: 19, zMin: -10, zMax: 10 });
  assert.deepEqual(expanded.cells, { columns: 29, rows: 20 });
  const full = calculateWorkshopCadGridPresentation({ fullGrid: true });
  assert.deepEqual(full.cells, { columns: 50, rows: 50 });
  assert.equal(full.fullGrid, true);
});

test("presentation snapshots are idempotent and invalid geometry fails closed", () => {
  const owner = createWorkshopCadWorkspacePresentation();
  const input = {
    canvasBounds: { left: 0, top: 0, width: 1280, height: 720 },
    protectedBounds: [],
  };
  const first = owner.update(input);
  assert.equal(owner.update(input), first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(owner.update({ canvasBounds: { width: 0, height: 0 } }), null);
  owner.reset();
  assert.notEqual(owner.update(input), first);
});
