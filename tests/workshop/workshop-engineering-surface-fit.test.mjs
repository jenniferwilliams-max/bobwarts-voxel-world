import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkshopFitDistance,
  calculateWorkshopFitSafeFrame,
  calculateWorkshopFitScreenTranslation,
  WORKSHOP_FIT_TARGET_FILL,
} from "../../js/workshop/runtime/workshop-engineering-surface-fit.mjs";

const canvasBounds = Object.freeze({ left: 0, top: 0, width: 1366, height: 768 });
const protectedBuildZone = Object.freeze({
  left: 200,
  top: 50,
  width: 900,
  height: 570,
  blocked: false,
});

test("creates an inset Fit frame inside the authoritative protected zone", () => {
  const frame = calculateWorkshopFitSafeFrame({ canvasBounds, protectedBuildZone });
  assert.deepEqual(frame, {
    left: 228,
    top: 78,
    right: 1072,
    bottom: 592,
    width: 844,
    height: 514,
    centerX: 650,
    centerY: 335,
  });
});

test("rejects blocked, invalid, and collapsed protected zones", () => {
  assert.equal(calculateWorkshopFitSafeFrame({
    canvasBounds,
    protectedBuildZone: { ...protectedBuildZone, blocked: true },
  }), null);
  assert.equal(calculateWorkshopFitSafeFrame({
    canvasBounds,
    protectedBuildZone: { left: 20, top: 20, width: 30, height: 30 },
  }), null);
  assert.equal(calculateWorkshopFitSafeFrame({ canvasBounds: null, protectedBuildZone }), null);
});

test("Fit distance responds to the safe frame without changing world geometry", () => {
  const safeFrame = calculateWorkshopFitSafeFrame({ canvasBounds, protectedBuildZone });
  const distance = calculateWorkshopFitDistance({
    halfWidth: 5,
    halfHeight: 3,
    verticalFovDegrees: 50,
    canvasBounds,
    safeFrame,
  });
  const narrowerDistance = calculateWorkshopFitDistance({
    halfWidth: 5,
    halfHeight: 3,
    verticalFovDegrees: 50,
    canvasBounds,
    safeFrame: { ...safeFrame, width: safeFrame.width / 2, right: safeFrame.left + safeFrame.width / 2 },
  });
  assert.ok(Number.isFinite(distance));
  assert.ok(narrowerDistance > distance);
  assert.equal(WORKSHOP_FIT_TARGET_FILL, 0.68);
});

test("calculates the screen translation needed to center a build in the safe frame", () => {
  const translation = calculateWorkshopFitScreenTranslation({
    subjectBounds: { left: 300, top: 200, width: 200, height: 100 },
    safeFrame: { left: 200, top: 100, width: 800, height: 500 },
  });
  assert.deepEqual(translation, { x: 200, y: 100 });
  assert.equal(calculateWorkshopFitScreenTranslation({ subjectBounds: null, safeFrame: {} }), null);
});
