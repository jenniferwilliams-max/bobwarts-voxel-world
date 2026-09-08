import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const builderPerimeterCss=source.match(
  /<style id="builderNavigationNameplateAquaPerimeterCSS">([\s\S]*?)<\/style>/
)?.[1] ?? "";
test("the independent rectangular navigation overlay is removed",()=>{
  assert.doesNotMatch(source,/builderWorkshopNavigationAquaFrameCSS/);
  assert.doesNotMatch(source,/--major-navigation-frame-(?:color|width|inset|radius|glow)/);
  assert.doesNotMatch(source,/#(?:returnMissionsButton|workspaceModeSwitch)::after\{[\s\S]*major-navigation-frame/);
});

test("Workshop Return to Builder reuses the Builder navigation frame artwork",()=>{
  assert.match(source,/#workshopQuickAccessToolbar #workspaceModeSwitch\{[\s\S]*height:44px;[\s\S]*background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\)[\s\S]*background-size:100% 100%[\s\S]*box-shadow:none/);
  assert.doesNotMatch(source,/#workshopQuickAccessToolbar #workspaceModeSwitch\{[^}]*border-image-source:/);
});

test("Builder Return to Missions and Open Workshop retain the original decorative contour artwork",()=>{
  const face=/background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\) !important/;
  assert.match(source,new RegExp("#builderRightToolsPanel \\.dashboard139MissionZone #returnMissionsButton\\{[\\s\\S]*"+face.source));
  assert.match(source,new RegExp("#builderRightToolsPanel \\.dashboard139MissionZone #workspaceModeSwitch\\{[\\s\\S]*"+face.source));
  assert.match(source,/#builderRightToolsPanel \.dashboard139MissionZone #returnMissionsButton\{[\s\S]*height:38px !important/);
  assert.match(source,/#builderRightToolsPanel \.dashboard139MissionZone #workspaceUtilityRail button,[\s\S]*height:38px !important/);
});

test("Builder navigation strengthens the existing raster contour without new frame geometry",()=>{
  assert.match(builderPerimeterCss,/#returnMissionsButton,[\s\S]*#workspaceModeSwitch\{/);
  assert.match(builderPerimeterCss,/filter:brightness\(1\.10\) saturate\(1\.24\) contrast\(1\.06\)/);
  assert.doesNotMatch(builderPerimeterCss,/::(?:before|after)|\bborder\s*:|\boutline\s*:|clip-path|mask|inset:/);
  assert.doesNotMatch(builderPerimeterCss,/#(?:builderSaveButton|builderOpenButton|builderBadgesButton|builderPassportButton|helpButton)/);
});

test("navigation focus and ordinary controls remain unchanged",()=>{
  assert.match(source,/#returnMissionsButton:focus-visible\{outline:3px solid #36D8FF!important;outline-offset:4px!important\}/);
  assert.match(source,/#workspaceModeSwitch:focus-visible\{[\s\S]*outline:3px solid #8ff6ff !important/);
  assert.doesNotMatch(source,/#(?:builderSaveButton|builderOpenButton|helpButton|workshopViewHome|workshopUtilitySave|workshopUtilityOpen|bottomBuildTools|toolChest)::after\{[\s\S]*major-navigation-frame/);
});
