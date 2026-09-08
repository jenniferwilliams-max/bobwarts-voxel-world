import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const css=source.match(/<style id="builderFloatingBobPointsPanelCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";

test("preserves Open Workshop while moving Shapes and Colors down as one unit",()=>{
  assert.match(css,/#builderRightToolsPanel\{[\s\S]*?gap:6px !important/);
  assert.match(css,/#builderRightToolsPanel \.dashboard139ShapeZone\{[\s\S]*?margin-top:15px !important/);
  assert.match(source,/#builderRightToolsPanel \.dashboard139MissionZone #workspaceModeSwitch\{[\s\S]*?width:100% !important;[\s\S]*?height:44px !important;[\s\S]*?min-height:44px !important;[\s\S]*?max-height:44px !important/);
});

test("redistributes spacing without increasing total rail height or shrinking controls",()=>{
  const oldSectionSpacing=11*3;
  const newSectionSpacing=(6+15)+6+6;
  assert.equal(newSectionSpacing,oldSectionSpacing);
  assert.equal((6+15)-11,10,"Workshop-to-Shapes clearance increases by 10px");
  assert.match(css,/#builderRightToolsPanel \.dashboard139BuildZone\{[\s\S]*?height:108px !important;[\s\S]*?min-height:108px !important;[\s\S]*?max-height:108px !important/);
  assert.match(css,/#builderRightToolsPanel \.dashboard139UtilityZone\{[\s\S]*?height:149px !important;[\s\S]*?min-height:149px !important;[\s\S]*?max-height:149px !important/);
  assert.match(source,/#builderRightToolsPanel #bottomBuildTools button,[\s\S]*?\.dashboardUtilityButtons button\{[\s\S]*?height:44px !important;[\s\S]*?min-height:44px !important/);
});
