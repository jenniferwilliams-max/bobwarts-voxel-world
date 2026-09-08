import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} has no balanced closing brace`);
}

test("explicit Home has one canonical rendered-settlement owner", () => {
  const routing = functionSource("setWorkshopEngineeringView");
  const homeBranch = routing.slice(
    routing.indexOf('if(view==="home")'),
    routing.indexOf('if(!workshopEngineeringViewDirections[view])'),
  );
  assert.match(homeBranch, /prepareWorkshopHomeFrameSettlement\(\)/);
  assert.doesNotMatch(homeBranch, /applyResponsiveWorkshopHomeView/);
  assert.doesNotMatch(homeBranch, /scheduleWorkshopHomeFrameSettlement/);
});

test("Home cleanup precedes one atomic camera, Grid, and ruler settlement", () => {
  const prepare = functionSource("prepareWorkshopHomeFrameSettlement");
  assert.ok(prepare.indexOf("resetWorkshopBuildViewportWheelIntent()") <
    prepare.indexOf("cancelWorkshopHomeFrameSettlement()"));
  assert.ok(prepare.indexOf("cancelWorkshopHomeFrameSettlement()") <
    prepare.indexOf("scheduleWorkshopHomeFrameSettlement(function()"));
  assert.ok(prepare.indexOf("restoreWorkshopBottomPlatformPresentation()") <
    prepare.indexOf("scheduleWorkshopHomeFrameSettlement(function()"));
  assert.ok(prepare.indexOf("workshopHomeCameraConfigCache=null") <
    prepare.indexOf("scheduleWorkshopHomeFrameSettlement(function()"));
  assert.match(prepare, /var applied=applyResponsiveWorkshopHomeView\(\);/);
  assert.match(prepare, /if\(applied\) updateWorkshopProjectedRulerBounds\(\);/);
  assert.equal((prepare.match(/applyResponsiveWorkshopHomeView\(\)/g) || []).length, 1);
});

test("new camera, manual orbit, shutdown, fault, and Mission exit cancel Home", () => {
  assert.match(functionSource("setWorkshopEngineeringView"),
    /cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(functionSource("fitWorkshopSelection"),
    /cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(functionSource("beginWorkshopViewDiceDrag"),
    /cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(source,
    /window\.markWorkshopManualCameraOverride=function\(\)\{\s*cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(functionSource("syncWorkshopControllerPresentation"),
    /SHUTTING_DOWN[\s\S]*?FAULT_SAFE[\s\S]*?OFF[\s\S]*?cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(functionSource("applyWorkspaceModeVisuals"),
    /requestedMode!=="workshop"[\s\S]*?cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(functionSource("applyWorkspaceModeVisuals"),
    /requestedMode!=="workshop"[\s\S]*?workshopLastValidHomeCameraConfig=null/);
  assert.match(functionSource("applyWorkspaceModeVisuals"),
    /resetWorkshopBuildViewportWheelIntent\(\)/);
  assert.match(functionSource("setWorkshopEngineeringView"),
    /resetWorkshopBuildViewportWheelIntent\(\)/);
  assert.match(functionSource("fitWorkshopSelection"),
    /resetWorkshopBuildViewportWheelIntent\(\)/);
});

test("resize and asynchronous readiness replace rather than duplicate Home work", () => {
  const resizeStart = source.indexOf(
    'window.addEventListener("resize",function(){',
    source.indexOf("function setWorkshopEngineeringView"),
  );
  const resizeEnd = source.indexOf("if(switcher){", resizeStart);
  const resize = source.slice(resizeStart, resizeEnd);
  assert.match(resize, /prepareWorkshopHomeFrameSettlement\(\)/);
  assert.doesNotMatch(resize, /applyResponsiveWorkshopHomeView/);

  const initializationStart = source.indexOf("workshopHomeWorkspaceFraming=modules[21]");
  const initializationEnd = source.indexOf(
    "workshopToolChestPartsObjectsAdapter=", initializationStart,
  );
  const initialization = source.slice(initializationStart, initializationEnd);
  assert.match(initialization, /prepareWorkshopHomeFrameSettlement\(\)/);
  assert.doesNotMatch(initialization, /scheduleWorkshopHomeFrameSettlement\(\)/);
});

test("failed Fit and Fit exit cannot leave Home with full-world presentation", () => {
  const fit = functionSource("fitWorkshopSelection");
  const clear = fit.indexOf("clearWorkshopVisibleRulerRange()");
  assert.ok(fit.indexOf("var bounds=getWorkshopSelectedObjectBounds()") < clear);
  assert.ok(fit.indexOf("if(!safeFrame) return false") < clear);
  assert.ok(fit.indexOf("if(!Number.isFinite(fitDistance)) return false") < clear);
  assert.ok(fit.indexOf("activeWorkshopEngineeringView=definition ? requestedView : \"fit\"") > clear);
  const clearView = functionSource("clearWorkshopEngineeringView");
  assert.match(clearView,
    /activeWorkshopFitSelection[\s\S]*?activeWorkshopEngineeringView="home"[\s\S]*?prepareWorkshopHomeFrameSettlement\(\)/);
});

test("settled Home refuses to clear its bounded Grid or ruler range", () => {
  const apply = functionSource("applyResponsiveWorkshopHomeView");
  assert.match(apply, /if\(!config\.gridWorkspace\) return false;/);
  assert.match(apply, /applyWorkshopCadGridPresentation\(workshopHomeGridWorkspace,false\)/);
  assert.match(apply, /setWorkshopVisibleRulerRange\(workshopHomeGridWorkspace\)/);
  assert.doesNotMatch(apply, /restoreWorkshopFullCadGrid\(\)/);
  assert.doesNotMatch(apply, /clearWorkshopVisibleRulerRange\(\)/);
});
