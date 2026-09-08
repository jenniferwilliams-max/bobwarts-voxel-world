import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkshopClassroomWorkspacePresentation,
} from "../../js/workshop/runtime/workshop-classroom-workspace-presentation.mjs";

const VIEWPORTS = Object.freeze([
  Object.freeze({ id: "mac", width: 1440, height: 900 }),
  Object.freeze({ id: "chromebook", width: 1366, height: 768 }),
  Object.freeze({ id: "narrow-chromebook", width: 1024, height: 600 }),
]);
const VIEWS = Object.freeze([
  "home", "top", "front", "back", "left", "right", "bottom", "fit",
]);

function matrixPresentation(viewport, view) {
  const left = viewport.width >= 1200 ? 212 : 208;
  const right = viewport.width - (viewport.width >= 1200 ? 264 : 224);
  const bottom = viewport.height - (viewport.height <= 650 ? 138 : 124);
  const protectedBuildZone = {
    left, top: 54, right, bottom,
    width: right - left, height: bottom - 54, inset: 12, blocked: false,
  };
  const fitSelection = view === "fit";
  const directionalFallback = [
    "top", "front", "back", "left", "right", "bottom", "fit",
  ].includes(view);
  return createWorkshopClassroomWorkspacePresentation({
    getActive: () => true,
    getCameraView: () => fitSelection ? "home" : view,
    getFitSelection: () => fitSelection,
    getGeometryValid: () => true,
    getResetSnapshot: () => ({ active: true, protectedBuildZone }),
    getWorkstationSnapshot: () => ({
      blocked: false,
      protectedBuildZone,
      tableRegistration: {
        hidden: false,
        width: Math.min(1150, protectedBuildZone.width * 0.96),
        height: Math.min(767, protectedBuildZone.height),
        imageLeft: left,
        imageTop: 54,
        anchorScreenX: (left + right) / 2,
        anchorScreenY: bottom,
        visible: { ...protectedBuildZone },
      },
      stableHomeScreenBounds: { ...protectedBuildZone },
      liveProjectedScreenBounds: { ...protectedBuildZone },
    }),
    getRulerSnapshot: () => ({
      mode: directionalFallback ? "fallback" : "edges",
      signature: `${viewport.id}:${view}`,
    }),
  });
}

test("locks all approved views at Mac and Chromebook viewport sizes", () => {
  VIEWPORTS.forEach((viewport) => {
    VIEWS.forEach((view) => {
      const snapshot = matrixPresentation(viewport, view).getSnapshot();
      assert.equal(snapshot.geometryValid, true, `${viewport.id}:${view}`);
      assert.equal(snapshot.cameraView,
        view === "fit" ? "FIT_SELECTION" : view.toUpperCase());
      assert.equal(snapshot.rulerMode,
        view === "home" ? "EDGES" : "READABLE_FALLBACK");
      assert.equal(snapshot.protectedBuildZone.inset, 12);
      assert.ok(snapshot.tableRegistration.width >= 320);
      assert.ok(snapshot.tableRegistration.width <= 1150);
      assert.equal(snapshot.tableRegistration.hidden, false);
      assert.deepEqual(snapshot.workstationRegistration.stableHomeScreenBounds,
        snapshot.protectedBuildZone);
    });
  });
});

test("Fit Selection never replaces stable Home Table registration", () => {
  VIEWPORTS.forEach((viewport) => {
    const home = matrixPresentation(viewport, "home").getSnapshot();
    const fit = matrixPresentation(viewport, "fit").getSnapshot();
    assert.deepEqual(fit.workstationRegistration.stableHomeScreenBounds,
      home.workstationRegistration.stableHomeScreenBounds);
    assert.equal(fit.cameraView, "FIT_SELECTION");
    assert.equal(fit.rulerMode, "READABLE_FALLBACK");
  });
});
