import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("Chromebook dashboard caps Quick Access while preserving the seven-tab track", () => {
  assert.match(
    source,
    /@media\(min-width:901px\) and \(max-width:1280px\)\{\s*body\.workshopMode:not\(\.starterScreenActive\) #workshopEngineeringDashboard\{\s*grid-template-columns:minmax\(360px,390px\) minmax\(0,1fr\);\s*\}\s*\}/
  );
  assert.match(source, /#workshopQuickAccessToolbar\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(source, /#workshopConsoleTabs\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(source, /#workshopQuickAccessToolbar button,[\s\S]*?#workshopConsoleTabs button\{[\s\S]*?min-height:44px/);
});

test("opening mission popup stacks above the interactive right HUD", () => {
  assert.match(source, /#missionPopup\{\s*z-index:1270;\s*\}/);
  assert.match(source, /body:not\(\.starterScreenActive\) #rightHudColumn\{[\s\S]*?z-index:1265 !important/);
  assert.match(source, /body:not\(\.starterScreenActive\) #rightHudColumn > #stemCoach[\s\S]*?pointer-events:auto !important/);
});
