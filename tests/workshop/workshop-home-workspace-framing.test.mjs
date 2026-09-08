import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_HOME_PITCH_DEGREES,
  WORKSHOP_HOME_MINIMUM_FILL,
  WORKSHOP_HOME_WORKSPACE_SIZE,
  calculateDeterministicWorkshopHomeFallback,
  calculateWorkshopHomeWorkspaceFrame,
  createWorkshopHomeWorkspaceFraming,
} from "../../js/workshop/runtime/workshop-home-workspace-framing.mjs";

const cases = [
  { label: "Mac", width: 1440, height: 900, zone: { left: 250, top: 70, width: 920, height: 690, inset: 12 } },
  { label: "Chromebook", width: 1366, height: 768, zone: { left: 220, top: 60, width: 900, height: 590, inset: 12 } },
  { label: "narrow Chromebook", width: 1024, height: 600, zone: { left: 170, top: 50, width: 670, height: 450, inset: 12 } },
];

test("frames a complete origin-centered 20 by 20 workspace responsively", () => {
  assert.equal(WORKSHOP_HOME_WORKSPACE_SIZE, 20);
  assert.equal(WORKSHOP_HOME_PITCH_DEGREES, 90);
  cases.forEach(({ label, width, height, zone }) => {
    const frame = calculateWorkshopHomeWorkspaceFrame({
      canvasBounds: { left: 0, top: 0, width, height },
      protectedBuildZone: { ...zone, blocked: false },
    });
    assert.ok(frame, label);
    assert.ok(Number.isFinite(frame.target.x), label);
    assert.ok(Number.isFinite(frame.target.y), label);
    assert.ok(Number.isFinite(frame.target.z), label);
    assert.deepEqual(frame.workspace, {
      size: 20,
      xMin: -10,
      xMax: 10,
      yMin: -0.5,
      yMax: -0.5,
      zMin: -10,
      zMax: 10,
    }, label);
    assert.ok(frame.horizontalDistance >= 6 && frame.horizontalDistance <= 80, label);
    assert.ok(frame.workspaceBounds.left >= frame.safeFrame.left, label);
    assert.ok(frame.workspaceBounds.right <= frame.safeFrame.right, label);
    assert.ok(frame.workspaceBounds.top >= frame.safeFrame.top, label);
    assert.ok(frame.workspaceBounds.bottom <= frame.safeFrame.bottom, label);
    assert.ok(frame.fillRatio >= WORKSHOP_HOME_MINIMUM_FILL, label);
    assert.equal(frame.fullSurfaceFullyVisible, false, label);
    assert.equal(frame.perpendicular, true, label);
    assert.equal(frame.target.y, -0.5, label);
    assert.equal(frame.height, frame.target.y + frame.horizontalDistance, label);
    assert.equal(Object.isFrozen(frame), true, label);
    assert.equal(Object.isFrozen(frame.workspace), true, label);
  });
});

test("projects every Home centimeter with uniform top-down screen spacing", () => {
  cases.forEach(({ label, width, height, zone }) => {
    const frame = calculateWorkshopHomeWorkspaceFrame({
      canvasBounds: { left: 0, top: 0, width, height },
      protectedBuildZone: { ...zone, blocked: false },
    });
    assert.ok(frame, label);
    const verticalTangent = Math.tan(frame.fov * Math.PI / 360);
    const horizontalTangent = verticalTangent * width / height;
    const depth = frame.height - frame.target.y;
    const projectX = (x) => width * (1 +
      (x - frame.target.x) / (depth * horizontalTangent)) / 2;
    const projectZ = (z) => height * (1 -
      (frame.target.z - z) / (depth * verticalTangent)) / 2;
    const xPixels = Array.from({ length: 21 }, (_, index) => projectX(index - 10));
    const zPixels = Array.from({ length: 21 }, (_, index) => projectZ(index - 10));
    const xStep = xPixels[1] - xPixels[0];
    const zStep = zPixels[1] - zPixels[0];
    xPixels.slice(1).forEach((pixel, index) => {
      assert.ok(Math.abs(pixel - xPixels[index] - xStep) < 1e-9, label);
    });
    zPixels.slice(1).forEach((pixel, index) => {
      assert.ok(Math.abs(pixel - zPixels[index] - zStep) < 1e-9, label);
    });
    assert.equal(xPixels.length - 1, 20, label);
    assert.equal(zPixels.length - 1, 20, label);
  });
});

test("expands Home only when complete build bounds require it", () => {
  const common = {
    canvasBounds: { left: 0, top: 0, width: 1366, height: 768 },
    protectedBuildZone: {
      left: 220, top: 60, width: 900, height: 590, blocked: false,
    },
  };
  const contained = calculateWorkshopHomeWorkspaceFrame({
    ...common,
    buildBounds: {
      min: { x: -4, y: -0.5, z: -3 },
      max: { x: 5, y: 4, z: 6 },
    },
  });
  assert.ok(contained);
  assert.equal(contained.workspace.xMin, -10);
  assert.equal(contained.workspace.xMax, 10);
  assert.equal(contained.workspace.zMin, -10);
  assert.equal(contained.workspace.zMax, 10);

  const outside = calculateWorkshopHomeWorkspaceFrame({
    ...common,
    buildBounds: {
      min: { x: 8, y: -0.5, z: -2 },
      max: { x: 18, y: 8, z: 7 },
    },
  });
  assert.ok(outside);
  assert.equal(outside.workspace.xMin, -10);
  assert.equal(outside.workspace.xMax, 19);
  assert.equal(outside.workspace.zMin, -10);
  assert.equal(outside.workspace.zMax, 10);
  assert.ok(outside.workspaceBounds.left >= outside.safeFrame.left);
  assert.ok(outside.workspaceBounds.right <= outside.safeFrame.right);
  assert.equal(outside.fullSurfaceFullyVisible, false);
});

test("returns the identical frame for unchanged responsive geometry", () => {
  const framing = createWorkshopHomeWorkspaceFraming();
  const input = {
    canvasBounds: { left: 0, top: 0, width: 1366, height: 768 },
    protectedBuildZone: { left: 220, top: 60, width: 900, height: 590, inset: 12, blocked: false },
  };
  const first = framing.update(input);
  assert.equal(framing.update(input), first);
  framing.reset();
  assert.notEqual(framing.update(input), first);
});

test("fails closed for blocked or invalid geometry and centers off-axis zones", () => {
  const canvasBounds = { left: 0, top: 0, width: 1366, height: 768 };
  assert.equal(calculateWorkshopHomeWorkspaceFrame({
    canvasBounds,
    protectedBuildZone: { left: 0, top: 0, width: 1366, height: 768, blocked: true },
  }), null);
  const offAxis = calculateWorkshopHomeWorkspaceFrame({
    canvasBounds,
    protectedBuildZone: { left: 800, top: 0, width: 500, height: 700, blocked: false },
  });
  assert.ok(offAxis);
  assert.ok(offAxis.workspaceBounds.left >= offAxis.safeFrame.left);
  assert.ok(offAxis.workspaceBounds.right <= offAxis.safeFrame.right);
  assert.equal(calculateWorkshopHomeWorkspaceFrame(), null);
});

test("creates a real bounded Home fallback instead of exposing the full world", () => {
  const fallback = calculateDeterministicWorkshopHomeFallback({
    canvasBounds: { left: 0, top: 0, width: 1366, height: 768 },
    protectedBuildZone: { blocked: true },
  });
  assert.ok(fallback);
  assert.deepEqual(fallback.workspace, {
    size: 20,
    xMin: -10,
    xMax: 10,
    yMin: -0.5,
    yMax: -0.5,
    zMin: -10,
    zMax: 10,
  });
  assert.equal(fallback.fullSurfaceFullyVisible, false);
});
