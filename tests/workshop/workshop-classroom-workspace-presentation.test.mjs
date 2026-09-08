import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_CLASSROOM_CAMERA_VIEWS,
  WORKSHOP_CLASSROOM_RULER_MODES,
  createWorkshopClassroomWorkspacePresentation,
} from "../../js/workshop/runtime/workshop-classroom-workspace-presentation.mjs";

function fixture(overrides = {}) {
  const state = {
    active: true,
    cameraView: "home",
    fitSelection: false,
    geometryValid: true,
    reset: {
      active: true,
      protectedBuildZone: {
        left: 212, top: 54, right: 1102, bottom: 768,
        width: 890, height: 714, inset: 12, blocked: false,
      },
    },
    workstation: {
      blocked: false,
      protectedBuildZone: {
        left: 212, top: 54, right: 1102, bottom: 768,
        width: 890, height: 714, inset: 12, blocked: false,
      },
      tableRegistration: {
        width: 850, height: 566, imageLeft: 230, imageTop: 190,
        anchorScreenX: 657, anchorScreenY: 768,
        visible: {
          left: 250, top: 300, right: 1070, bottom: 760,
          width: 820, height: 460,
        },
        hidden: false,
      },
    },
    ruler: { mode: "edges", signature: "registered" },
    ...overrides,
  };
  const presentation = createWorkshopClassroomWorkspacePresentation({
    getActive: () => state.active,
    getCameraView: () => state.cameraView,
    getFitSelection: () => state.fitSelection,
    getGeometryValid: () => state.geometryValid,
    getResetSnapshot: () => state.reset,
    getWorkstationSnapshot: () => state.workstation,
    getRulerSnapshot: () => state.ruler,
  });
  return { state, presentation };
}

test("locks the approved camera and ruler vocabulary", () => {
  assert.deepEqual(WORKSHOP_CLASSROOM_CAMERA_VIEWS, [
    "HOME", "TOP", "FRONT", "BACK", "LEFT", "RIGHT", "BOTTOM",
    "FIT_SELECTION",
  ]);
  assert.deepEqual(WORKSHOP_CLASSROOM_RULER_MODES,
    ["EDGES", "READABLE_FALLBACK", "BLOCKED"]);
});

test("publishes one deeply frozen read-only production snapshot", () => {
  const { presentation } = fixture();
  const snapshot = presentation.getSnapshot();
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.cameraView, "HOME");
  assert.equal(snapshot.fitSelection, false);
  assert.equal(snapshot.geometryValid, true);
  assert.equal(snapshot.rulerMode, "EDGES");
  assert.equal(snapshot.protectedBuildZone.inset, 12);
  assert.equal(snapshot.tableRegistration.hidden, false);
  assert.equal(snapshot.workstationRegistration.blocked, false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.protectedBuildZone), true);
  assert.equal(Object.isFrozen(snapshot.tableRegistration.visible), true);
  assert.equal(Object.isFrozen(snapshot.workstationRegistration), true);
});

test("returns the identical object for unchanged state and a new object for change", () => {
  const { state, presentation } = fixture();
  const first = presentation.update();
  assert.equal(presentation.update(), first);
  state.cameraView = "top";
  const second = presentation.update();
  assert.notEqual(second, first);
  assert.equal(second.cameraView, "TOP");
  assert.equal(presentation.update(), second);
});

test("Fit Selection owns the reported camera state while preserving selection status", () => {
  const { state, presentation } = fixture({ cameraView: "front" });
  state.fitSelection = true;
  const snapshot = presentation.update();
  assert.equal(snapshot.cameraView, "FIT_SELECTION");
  assert.equal(snapshot.fitSelection, true);
  assert.equal(snapshot.geometryValid, true);
});

test("classifies the existing readable rectangular fallback without changing it", () => {
  const { state, presentation } = fixture();
  state.ruler = { mode: "fallback", signature: "fallback" };
  assert.equal(presentation.update().rulerMode, "READABLE_FALLBACK");
});

test("inactive, invalid, hidden, protected, unnamed, and throwing sources fail closed", () => {
  const cases = [
    { active: false },
    { geometryValid: false },
    { cameraView: null },
    { workstation: { blocked: true } },
    {
      workstation: {
        blocked: false,
        protectedBuildZone: { blocked: true },
        tableRegistration: { hidden: false },
      },
    },
    {
      workstation: {
        blocked: false,
        protectedBuildZone: { blocked: false },
        tableRegistration: { hidden: true },
      },
    },
  ];
  cases.forEach((overrides) => {
    const { presentation } = fixture(overrides);
    const snapshot = presentation.update();
    assert.equal(snapshot.geometryValid, false);
    assert.equal(snapshot.rulerMode, "BLOCKED");
  });
  const presentation = createWorkshopClassroomWorkspacePresentation({
    getActive: () => true,
    getCameraView: () => { throw new Error("stale camera"); },
    getFitSelection: () => false,
    getGeometryValid: () => true,
    getResetSnapshot: () => { throw new Error("stale reset"); },
    getWorkstationSnapshot: () => { throw new Error("stale registration"); },
    getRulerSnapshot: () => { throw new Error("stale rulers"); },
  });
  assert.equal(presentation.update().rulerMode, "BLOCKED");
});

test("Mission restoration clears all Workshop-only presentation geometry", () => {
  const { presentation } = fixture();
  presentation.update();
  const reset = presentation.reset();
  assert.deepEqual(reset, {
    active: false,
    cameraView: "HOME",
    fitSelection: false,
    geometryValid: false,
    rulerMode: "BLOCKED",
    protectedBuildZone: null,
    tableRegistration: null,
    workstationRegistration: null,
  });
  assert.equal(presentation.reset(), reset);
});

test("requires every read-only source provider", () => {
  assert.throws(() => createWorkshopClassroomWorkspacePresentation({}),
    /providers are required/);
});
