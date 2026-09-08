import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("runtime uses one canvas-owned safe-frame presentation owner", () => {
  assert.equal((source.match(/workshop-cad-workspace-presentation\.mjs/g) || []).length, 1);
  assert.match(source, /createWorkshopCadWorkspacePresentation\(\)/);
  assert.match(source, /protectedElements=\[[\s\S]*?viewCubeBox[\s\S]*?workshopEngineeringViewControls[\s\S]*?workshopMeasurementAssistant[\s\S]*?engineeringToolChest[\s\S]*?workshopDashboard/);
  assert.doesNotMatch(
    source.slice(source.indexOf("if(workshopCadWorkspacePresentation){"),
      source.indexOf("function clippedBounds", source.indexOf("if(workshopCadWorkspacePresentation){"))),
    /workshopViewportStage|workshopViewportContainer/,
  );
});

test("Home applies bounded Grid presentation and manual camera control restores capacity", () => {
  assert.match(source, /if\(!config\.gridWorkspace\) return false;/);
  assert.match(source, /workshopHomeGridWorkspace=config\.gridWorkspace/);
  assert.match(source, /applyWorkshopCadGridPresentation\(workshopHomeGridWorkspace,false\)/);
  assert.match(source, /markWorkshopManualCameraOverride=function\(\)[\s\S]*?restoreWorkshopFullCadGrid\(\)/);
  assert.match(source, /if\(view!=="home"\)\{\s*clearWorkshopVisibleRulerRange\(\);\s*restoreWorkshopFullCadGrid\(\)/);
});

test("Grid retains canonical boundaries with separate minor major and origin layers", () => {
  assert.match(source, /let gridBoundary = -gridHalfSize;/);
  assert.match(source, /gridBoundary <= gridHalfSize;/);
  assert.match(source, /gridBoundary === 0\s*\? originPositions/);
  assert.match(source, /engineeringGridOriginLines\.raycast = function\(\)\{\};/);
  assert.match(source, /depthFunc: THREE\.LessEqualDepth/g);
});

test("settled Home rulers expose centimeter boundaries without millimeter clutter", () => {
  assert.match(source, /var centimeterOnly=!!workshopVisibleRulerRange/);
  assert.match(source, /var subdivisions=centimeterOnly\s*\? 1\s*:\s*workshopRulerConfig\.millimetersPerCentimeter/);
  assert.match(source, /workshop-ruler-tick-centimeter/);
  assert.match(source, /if\(isMajor && \(!centimeterOnly \|\| isLandmark\)\)/);
  assert.match(source, /normalizedValue>0\s*\? "\+"\+normalizedValue/);
  assert.match(source, /workshop-ruler-tick-origin/);
  assert.match(source, /workshop-ruler-label\.is-origin/);
});

test("new camera commands invalidate stale Home work and Home can explicitly reframe", () => {
  const start = source.indexOf("function setWorkshopEngineeringView");
  const end = source.indexOf("function captureBuilderCameraState", start);
  const integration = source.slice(start, end);
  assert.match(integration, /cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(integration, /view===activeWorkshopEngineeringView && view!=="home"/);
  assert.match(source, /function fitWorkshopSelection\(requestedView\)[\s\S]*?cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(source, /deterministicSafeFrame/);
});
