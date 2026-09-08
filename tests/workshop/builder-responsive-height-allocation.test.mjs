import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const css=source.match(/<style id="builderResponsiveHeightAllocationCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";
const navigation=source.match(/<script id="builderWorkshopMajorNavigationScript">([\s\S]*?)<\/script>/)?.[1] ?? "";

test("Builder sections use intrinsic height instead of rigid rail allocations",()=>{
  for(const zone of ["Mission","Shape","Build","Utility"]){
    assert.match(css,new RegExp(`dashboard139${zone}Zone[\\s\\S]*?height:auto !important;[\\s\\S]*?min-height:0 !important;[\\s\\S]*?max-height:none !important;`));
  }
});

test("major navigation is the distinct final rail group and cannot cover Utilities",()=>{
  assert.match(navigation,/panel\.appendChild\(navigation\)/);
  assert.doesNotMatch(navigation,/mission\.appendChild\(navigation\)/);
  assert.match(css,/#builderMajorNavigation\{[\s\S]*?position:static !important;[\s\S]*?grid-template-columns:repeat\(2,minmax\(44px,1fr\)\) !important;[\s\S]*?grid-template-rows:44px !important;/);
  assert.match(css,/@media\(max-height:660px\)[\s\S]*?#builderMajorNavigation\{[\s\S]*?margin-top:4px !important;[\s\S]*?border-top:1px solid/);
});

test("short-height tiers reduce decoration before bounded control size",()=>{
  assert.match(css,/@media\(max-height:760px\)[\s\S]*?#builderRightToolsPanel\{[\s\S]*?gap:3px !important;[\s\S]*?padding:2px !important;/);
  assert.match(css,/#builderProjectActionsLeft > button,[\s\S]*?#builderMajorNavigation > button\{[\s\S]*?height:44px !important;[\s\S]*?min-height:44px !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?--builder-left-compact-control-height:44px;[\s\S]*?--builder-left-compact-nav-height:44px;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#builderRightToolsPanel\{[\s\S]*?gap:var\(--builder-left-compact-section-gap\) !important;[\s\S]*?overflow-y:auto !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#builderProjectActionsLeft > button,[\s\S]*?height:var\(--builder-left-compact-control-height\) !important;/);
});

test("compact-height tiers protect Challenge and right BOB containment",()=>{
  assert.match(css,/@media\(max-height:660px\)[\s\S]*?--builder-swap-bottom-height:94px;/);
  assert.match(css,/@media\(max-height:660px\)[\s\S]*?#info\{[\s\S]*?grid-template-columns:138px minmax\(0,1fr\) !important;[\s\S]*?overflow:hidden !important;/);
  assert.match(css,/@media\(max-height:660px\)[\s\S]*?#challengeChecklist label\{[\s\S]*?font-size:10px !important;[\s\S]*?line-height:1\.04 !important;/);
  assert.match(css,/@media\(max-height:660px\)[\s\S]*?#builderBobRightPanel\{[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;/);
  assert.match(css,/@media\(max-height:620px\)[\s\S]*?--builder-swap-bottom-height:90px;/);
});

test("the left rail always exposes contained overflow instead of clipping Utilities",()=>{
  assert.match(css,/#builderRightToolsPanel\{[\s\S]*?overflow-x:hidden !important;[\s\S]*?overflow-y:auto !important;[\s\S]*?overscroll-behavior:contain !important;[\s\S]*?touch-action:pan-y !important;[\s\S]*?scrollbar-gutter:stable !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;[\s\S]*?scrollbar-width:thin !important;[\s\S]*?::-webkit-scrollbar\{[\s\S]*?display:block !important;/);
  assert.match(css,/@media\(max-height:600px\)[\s\S]*?overflow-y:auto !important;[\s\S]*?scrollbar-gutter:stable !important;[\s\S]*?::-webkit-scrollbar-thumb\{[\s\S]*?min-height:44px !important;/);
});

test("compact screens narrow both side menus and keep shortcuts readable",()=>{
  assert.match(css,/@media\(max-width:1100px\)[\s\S]*?--builder-swap-left-width:188px;[\s\S]*?--builder-swap-right-width:232px;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?\.dashboard139MissionZone\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#builderProjectActionsLeft,[\s\S]*?#builderMissionActions\{[\s\S]*?display:grid !important;[\s\S]*?grid-template-columns:repeat\(2,minmax\(44px,1fr\)\) !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#builderMajorNavigation > button\{[\s\S]*?grid-column:auto !important;[\s\S]*?min-width:0 !important;/);
});

test("Open Workshop moves into the visible compact Mission section",()=>{
  assert.match(navigation,/matchMedia\("\(max-height:700px\)"\)\.matches/);
  assert.match(navigation,/if\(compactBuilderHeight && compactMissionZone\) compactMissionZone\.appendChild\(workshopButton\)/);
  assert.match(navigation,/window\.addEventListener\("resize",installBuilderMajorNavigation/);
});

test("compact tier preserves all rail groups and gives color controls bounded space",()=>{
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?--builder-left-compact-swatch-size:44px;[\s\S]*?--builder-left-compact-slider-space:6px;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?\.dashboard139MissionZone[\s\S]*?grid-auto-rows:var\(--builder-left-compact-control-height\) !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#bottomBuildTools,[\s\S]*?\.dashboardUtilityButtons\{[\s\S]*?gap:0 !important;/);
  assert.match(css,/@media\(max-height:700px\)[\s\S]*?#builderMajorNavigation\{[\s\S]*?grid-template-rows:var\(--builder-left-compact-nav-height\) !important;/);
});
