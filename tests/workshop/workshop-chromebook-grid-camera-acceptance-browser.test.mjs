import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("canonical Grid exposes fifty cells and twenty central Home cells", () => {
  assert.match(source, /const gridHalfSize = 25;/);
  assert.match(source, /let gridBoundary = -gridHalfSize;/);
  assert.match(source, /gridBoundary <= gridHalfSize;/);
  assert.match(source, /Math\.abs\(gridBoundary % majorSpacing\)/);
  assert.match(source, /engineeringGrid\.raycast = function\(\)\{\};/);
  const boundaries = Array.from({ length: 51 }, (_, index) => index - 25);
  assert.equal(boundaries.filter((value) => value >= -10 && value <= 10).length, 21);
  assert.equal(boundaries.filter((value) => value % 5 === 0).length, 11);
});

test("platform-first Grid reaches its full intended contrast endpoint", () => {
  assert.match(source, /var presentationScalar=workshopClassroomTablePresentationEnabled\s*\? scalar\s*: scalar\/0\.78;/);
  assert.match(source, /engineeringGridMinorMaterial\.opacity=gridTargets\.minor\*presentationScalar/);
  assert.match(source, /engineeringGridMajorMaterial\.opacity=gridTargets\.major\*presentationScalar/);
});

test("platform-first Grid visibility is independent of hidden Table registration", () => {
  assert.match(source,
    /getTableVisible:getWorkshopGridPresentationHostVisible/);
  assert.match(source,
    /function getWorkshopGridPresentationHostVisible\(\)[\s\S]*?currentWorkspaceMode!=="workshop"[\s\S]*?return false;[\s\S]*?!workshopClassroomTablePresentationEnabled[\s\S]*?return true;[\s\S]*?workshopPoweredOffTableCompositor\.visible/);
});

test("Home consumes visible build bounds without placement-driven camera calls", () => {
  assert.match(source, /var modelBounds=getWorkshopEngineeringModelBounds\(\);[\s\S]*?buildBounds:buildBounds/);
  assert.match(source, /window\.innerWidth,window\.innerHeight,buildSignature/);
  assert.doesNotMatch(source, /function addBlock[\s\S]{0,1500}applyResponsiveWorkshopHomeView/);
  assert.match(source, /markWorkshopManualCameraOverride/);
  assert.match(source, /activeWorkshopEngineeringView==="home" &&\s*!workshopManualCameraOverride/);
});

test("directional framing uses all build bounds and never ruler or platform size", () => {
  const start = source.indexOf("if(workshopBuildBoundsFramingModule){");
  const end = source.indexOf("if(!selectedBounds) return false;", start);
  const integration = source.slice(start, end);
  assert.match(integration, /getWorkshopEngineeringModelBounds\(\)/);
  assert.match(integration, /calculateWorkshopDirectionalBuildFrame/);
  assert.doesNotMatch(integration, /new THREE\.Vector3\(-25/);
  assert.doesNotMatch(integration, /workshopViewportContainer/);
});

test("Bottom ghosts only platform presentation and restores exact material state", () => {
  assert.match(source, /function activateWorkshopBottomPlatformPresentation\(\)[\s\S]*?ground\.material\.opacity=0\.1;[\s\S]*?ground\.material\.depthWrite=false;/);
  assert.match(source, /function restoreWorkshopBottomPlatformPresentation\(\)[\s\S]*?transparent=workshopBottomPlatformPresentationSnapshot\.transparent[\s\S]*?opacity=workshopBottomPlatformPresentationSnapshot\.opacity[\s\S]*?depthWrite=workshopBottomPlatformPresentationSnapshot\.depthWrite/);
  assert.match(source, /if\(view==="bottom"\) activateWorkshopBottomPlatformPresentation\(\)/);
  assert.match(source, /if\(view!=="bottom"\) restoreWorkshopBottomPlatformPresentation\(\)/);
  assert.match(source, /if\(requestedMode!=="workshop"\)\{[\s\S]*?restoreWorkshopBottomPlatformPresentation\(\)/);
  assert.doesNotMatch(source, /activateWorkshopBottomPlatformPresentation[\s\S]{0,700}(?:ground\.visible=false|ground\.raycast)/);
});

test("canonical Mission shutdown and restoration ownership remain intact", () => {
  assert.match(source, /REQUEST_POWER_OFF/);
  assert.match(source, /applyWorkspaceModeVisuals\("mission",transition\.complete\)/);
  assert.match(source, /function restoreBuilderSession\(\)/);
  assert.match(source, /if\(requestedMode!=="workshop"\) restoreBuilderCameraState\(\)/);
});
