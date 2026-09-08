import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("Home ruler presentation is independent of canonical world registration", () => {
  assert.match(source, /import\("\.\/js\/workshop\/runtime\/workshop-visible-ruler-presentation\.mjs"\)/);
  assert.match(source, /workshopVisibleRulerPresentation=modules\[24\][\s\S]*?createWorkshopVisibleRulerPresentation\(\)/);
  assert.match(source, /function setWorkshopVisibleRulerRange\(range\)/);
  assert.match(source, /workshopHomeGridWorkspace[\s\S]*?setWorkshopVisibleRulerRange\(workshopHomeGridWorkspace\)/);
  assert.match(source, /var workshopRulerConfig=\{\s*xMin:-25,\s*xMax:25,\s*zMin:-25,\s*zMax:25/);
});

test("ruler ticks and coordinate mapping consume the active presentation range", () => {
  assert.match(source, /function getWorkshopRulerAxisRange\(axis\)[\s\S]*?if\(workshopVisibleRulerRange\)/);
  assert.match(source, /function renderWorkshopRulerTicks\(rulerElement\)[\s\S]*?getWorkshopRulerAxisRange\(axis\)/);
  assert.match(source, /function workshopModelToRulerPosition\(value,axis,rulerElement\)[\s\S]*?getWorkshopRulerAxisRange\(axis\)/);
  assert.match(source, /function workshopRulerPositionToModel\(position,axis,rulerElement\)[\s\S]*?getWorkshopRulerAxisRange\(axis\)/);
});

test("Home projects presentation corners without mutating canonical corners", () => {
  assert.match(source, /function projectWorkshopVisibleRulerTabletop\(projectionCamera\)/);
  assert.match(source, /createWorkshopVisibleRulerCorners\(workshopVisibleRulerRange\)/);
  assert.match(source, /getWorkshopRulerPresentationSnapshot\(\)[\s\S]*?orderedTabletopEdges:visibleTabletop\.edges/);
  assert.match(source, /var visibleTabletop=projectWorkshopVisibleRulerTabletop\(camera\)[\s\S]*?projectWorkshopWorkstationBounds\(camera\)/);
});

test("manual zoom updates the real Grid and ruler range after camera movement", () => {
  assert.match(source, /updateCamera\(\);\s*if\(document\.body\.classList\.contains\("workshopMode"\)[\s\S]*?refreshWorkshopManualVisibleRulerPresentation\(\)/);
  assert.match(source, /function calculateWorkshopManualVisibleRulerRange\(\)[\s\S]*?calculateZoomRange\(cameraDistance\)/);
  assert.doesNotMatch(source, /function calculateWorkshopManualVisibleRulerRange\(\)[\s\S]*?intersectPlane\(plane,intersection\)/);
  assert.match(source, /captureZoomBaseline\([\s\S]*?workshopHomeGridWorkspace,[\s\S]*?cameraDistance/);
  assert.match(source, /function refreshWorkshopManualVisibleRulerPresentation\(\)[\s\S]*?applyWorkshopCadGridPresentation\(range,false\)[\s\S]*?setWorkshopVisibleRulerRange\(range\)/);
  assert.match(source, /window\.markWorkshopManualCameraOverride=function\(\)[\s\S]*?activeWorkshopEngineeringView!=="home"[\s\S]*?restoreWorkshopFullCadGrid\(\)/);
  assert.match(source, /window\.refreshWorkshopManualVisibleRulerPresentation=\s*refreshWorkshopManualVisibleRulerPresentation/);
});

test("inspection, Fit, free orbit, and Mission restoration clear Home-only rulers", () => {
  assert.match(source, /function fitWorkshopSelection\(requestedView\)[\s\S]*?clearWorkshopVisibleRulerRange\(\)/);
  assert.match(source, /function beginWorkshopViewDiceDrag\(\)[\s\S]*?clearWorkshopVisibleRulerRange\(\)/);
  assert.match(source, /if\(view!=="home"\)\{\s*clearWorkshopVisibleRulerRange\(\);\s*restoreWorkshopFullCadGrid\(\)/);
  assert.match(source, /if\(requestedMode!=="workshop"\)\{[\s\S]*?clearWorkshopVisibleRulerRange\(\)/);
  assert.match(source, /snapshot\.workshop==="SHUTTING_DOWN"[\s\S]*?snapshot\.workshop==="FAULT_SAFE"[\s\S]*?clearWorkshopVisibleRulerRange\(\)/);
});
