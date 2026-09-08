import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_VISIBLE_RULER_ELEVATION,
  calculateWorkshopVisibleRulerZoomRange,
  createWorkshopVisibleRulerZoomBaseline,
  createWorkshopVisibleRulerCorners,
  createWorkshopVisibleRulerPresentation,
  normalizeWorkshopVisibleRulerRange,
} from "../../js/workshop/runtime/workshop-visible-ruler-presentation.mjs";

test("fresh Home exposes exactly twenty cells from minus ten through plus ten", () => {
  const range = normalizeWorkshopVisibleRulerRange({
    xMin: -10,
    xMax: 10,
    zMin: -10,
    zMax: 10,
  });
  assert.deepEqual(range, {
    xMin: -10,
    xMax: 10,
    zMin: -10,
    zMax: 10,
    columns: 20,
    rows: 20,
  });
  assert.ok(Object.isFrozen(range));
});

test("visible ranges round outward and clamp to canonical world truth", () => {
  assert.deepEqual(normalizeWorkshopVisibleRulerRange({
    xMin: -12.2,
    xMax: 13.1,
    zMin: -27,
    zMax: 26,
  }), {
    xMin: -13,
    xMax: 14,
    zMin: -25,
    zMax: 25,
    columns: 27,
    rows: 50,
  });
});

test("presentation corners retain real coordinates and ruler elevation", () => {
  const corners = createWorkshopVisibleRulerCorners({
    xMin: -10,
    xMax: 10,
    zMin: -10,
    zMax: 10,
  });
  assert.deepEqual(corners, [
    { x: -10, y: WORKSHOP_VISIBLE_RULER_ELEVATION, z: -10 },
    { x: -10, y: WORKSHOP_VISIBLE_RULER_ELEVATION, z: 10 },
    { x: 10, y: WORKSHOP_VISIBLE_RULER_ELEVATION, z: -10 },
    { x: 10, y: WORKSHOP_VISIBLE_RULER_ELEVATION, z: 10 },
  ]);
  assert.ok(Object.isFrozen(corners));
  corners.forEach((corner) => assert.ok(Object.isFrozen(corner)));
});

test("repeated ranges are idempotent and reset clears presentation state", () => {
  const presentation = createWorkshopVisibleRulerPresentation();
  const first = presentation.update({ xMin: -10, xMax: 10, zMin: -10, zMax: 10 });
  const repeated = presentation.update({ xMin: -10, xMax: 10, zMin: -10, zMax: 10 });
  assert.equal(repeated, first);
  presentation.reset();
  assert.equal(presentation.getRange(), null);
  assert.notEqual(
    presentation.update({ xMin: -10, xMax: 10, zMin: -10, zMax: 10 }),
    first,
  );
});

test("zoom ranges expand and contract monotonically without leaving the world", () => {
  const baseline = createWorkshopVisibleRulerZoomBaseline({
    xMin: -10, xMax: 10, zMin: -10, zMax: 10,
  }, 40, 80);
  const firstOut = calculateWorkshopVisibleRulerZoomRange({ baseline, cameraDistance: 40.5 });
  const farther = calculateWorkshopVisibleRulerZoomRange({ baseline, cameraDistance: 60 });
  const sameThreshold = calculateWorkshopVisibleRulerZoomRange({ baseline, cameraDistance: 40.5 });
  const home = calculateWorkshopVisibleRulerZoomRange({ baseline, cameraDistance: 40 });
  assert.deepEqual(firstOut, {
    xMin: -11, xMax: 11, zMin: -11, zMax: 11, columns: 22, rows: 22,
  });
  assert.ok(farther.xMin <= firstOut.xMin && farther.xMax >= firstOut.xMax);
  assert.deepEqual(sameThreshold, firstOut);
  assert.deepEqual(home, baseline.range);
});

test("zoom scaling clamps to canonical capacity and preserves expanded Home baselines", () => {
  const baseline = createWorkshopVisibleRulerZoomBaseline({
    xMin: -14, xMax: 12, zMin: -11, zMax: 16,
  }, 40, 80);
  assert.deepEqual(calculateWorkshopVisibleRulerZoomRange({
    baseline, cameraDistance: 40,
  }), baseline.range);
  assert.deepEqual(calculateWorkshopVisibleRulerZoomRange({
    baseline, cameraDistance: 80,
  }), {
    xMin: -25, xMax: 25, zMin: -25, zMax: 25, columns: 50, rows: 50,
  });
});

test("presentation owns and resets the deterministic Home zoom baseline", () => {
  const presentation = createWorkshopVisibleRulerPresentation();
  const baseline = presentation.captureZoomBaseline({
    xMin: -10, xMax: 10, zMin: -10, zMax: 10,
  }, 40, 80);
  assert.ok(Object.isFrozen(baseline));
  assert.deepEqual(presentation.calculateZoomRange(40.5), {
    xMin: -11, xMax: 11, zMin: -11, zMax: 11, columns: 22, rows: 22,
  });
  presentation.reset();
  assert.equal(presentation.getZoomBaseline(), null);
  assert.equal(presentation.calculateZoomRange(41), null);
});

test("invalid and collapsed ranges fail closed", () => {
  assert.equal(normalizeWorkshopVisibleRulerRange(), null);
  assert.equal(normalizeWorkshopVisibleRulerRange({
    xMin: 2, xMax: 2, zMin: -1, zMax: 1,
  }), null);
  assert.equal(createWorkshopVisibleRulerCorners({
    xMin: -1, xMax: 1, zMin: 4, zMax: 4,
  }), null);
});
