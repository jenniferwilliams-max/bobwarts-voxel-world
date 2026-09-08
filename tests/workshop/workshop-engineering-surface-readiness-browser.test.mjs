import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} has no balanced closing brace`);
}

test("Fit Selection consumes the shared protected build zone", () => {
  const fitSource = extractFunction("fitWorkshopSelection");
  assert.match(source, /import\("\.\/js\/workshop\/runtime\/workshop-engineering-surface-fit\.mjs"\)/);
  assert.match(fitSource, /window\.getWorkshopProtectedBuildZone\(\)/);
  assert.match(fitSource, /calculateWorkshopFitSafeFrame/);
  assert.match(fitSource, /calculateWorkshopFitDistance/);
  assert.match(fitSource, /correctWorkshopFitSelectionProtectedZone\(bounds,safeFrame\)/);
  assert.doesNotMatch(fitSource, /getElementById\("viewCubeBox"\)|getElementById\("engineeringToolChest"\)/);
});

test("Fit correction moves only camera framing and never student geometry", () => {
  const correctionSource = extractFunction("correctWorkshopFitSelectionProtectedZone");
  assert.match(correctionSource, /calculateWorkshopFitScreenTranslation/);
  assert.match(correctionSource, /activeWorkshopEngineeringTarget\.add\(worldTranslation\)/);
  assert.match(correctionSource, /camera\.position\.add\(worldTranslation\)/);
  assert.doesNotMatch(correctionSource, /block\.position|selectedBlocks|blocks\.forEach|raycast/);
});

test("resize reapplies Home, Fit, and directional Workshop views", () => {
  assert.match(source, /window\.addEventListener\("resize",function\(\)\{[\s\S]*?activeWorkshopFitSelection[\s\S]*?fitWorkshopSelection\(\)[\s\S]*?activeWorkshopEngineeringView==="home"[\s\S]*?prepareWorkshopHomeFrameSettlement\(\)[\s\S]*?setWorkshopEngineeringView\(activeWorkshopEngineeringView,\{force:true\}\)/);
  assert.match(source, /function setWorkshopEngineeringView\(view,options\)/);
});

test("final Workshop controls retain Chromebook-sized targets", () => {
  assert.match(source, /body\.workshopMode:not\(\.starterScreenActive\) #workshopEngineeringViewControls button\{[\s\S]*?min-height:44px/);
  assert.match(source, /#workshopQuickAccessToolbar button,[\s\S]*?#workshopConsoleTabs button\{[\s\S]*?height:44px;[\s\S]*?min-height:44px/);
  assert.match(source, /\.workshop-dashboard-controls button\{[\s\S]*?min-height:44px/);
});

test("ruler readability improves without changing scale or measurement ownership", () => {
  assert.match(source, /\.workshop-ruler-label\{\s*font-size:10px/);
  assert.match(source, /\.workshop-ruler-measurement-label\{[\s\S]*?font-size:10px/);
  assert.match(source, /workshop-ruler-horizontal \.workshop-ruler-tick-minor\{\s*height:3px;\s*opacity:\.28/);
  assert.match(source, /workshop-ruler-vertical \.workshop-ruler-tick-medium\{\s*width:6px;\s*opacity:\.52/);
  assert.match(source, /millimetersPerGridCell:10/);
  assert.match(source, /standardBlockSnapIncrement:1/);
});
