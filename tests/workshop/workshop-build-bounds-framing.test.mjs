import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkshopDirectionalBuildFrame,
} from "../../js/workshop/runtime/workshop-build-bounds-framing.mjs";

const canvasBounds = { left: 0, top: 0, width: 1366, height: 768 };
const safeFrame = { left: 220, top: 60, width: 900, height: 590 };
const buildBounds = {
  min: { x: -3, y: -0.5, z: -4 },
  max: { x: 8, y: 12, z: 6 },
};

test("directional views frame only the complete student build plus margin", () => {
  ["front", "back", "left", "right", "bottom"].forEach((view) => {
    const frame = calculateWorkshopDirectionalBuildFrame({
      view, buildBounds, canvasBounds, safeFrame,
    });
    assert.ok(frame, view);
    assert.equal(frame.usedDefaultBounds, false, view);
    assert.deepEqual(frame.bounds.min, { x: -4, y: -1.5, z: -5 }, view);
    assert.deepEqual(frame.bounds.max, { x: 9, y: 13, z: 7 }, view);
    assert.ok(frame.distance >= 6 && frame.distance < 50, view);
    assert.equal(Object.isFrozen(frame), true, view);
  });
});

test("empty directional views use a deterministic bounded default", () => {
  const first = calculateWorkshopDirectionalBuildFrame({
    view: "front", canvasBounds, safeFrame,
  });
  const second = calculateWorkshopDirectionalBuildFrame({
    view: "front", canvasBounds, safeFrame,
  });
  assert.deepEqual(first, second);
  assert.equal(first.usedDefaultBounds, true);
  assert.deepEqual(first.target, { x: 0, y: 1.5, z: 0 });
  assert.ok(first.distance < 50);
});

test("invalid views and geometry fail closed", () => {
  assert.equal(calculateWorkshopDirectionalBuildFrame({
    view: "diagonal", canvasBounds, safeFrame, buildBounds,
  }), null);
  assert.equal(calculateWorkshopDirectionalBuildFrame({
    view: "front", canvasBounds: { width: 0, height: 0 }, safeFrame,
  }), null);
});
