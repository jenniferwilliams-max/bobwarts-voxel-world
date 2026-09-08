import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("Platform Color has one student-facing owner in Colors and Materials",()=>{
  assert.equal((source.match(/id="workshopPlatformColorButton"/g)||[]).length,1);
  const drawerStart=source.indexOf('id="engineeringDrawerColorsMaterialsContent"');
  const drawerEnd=source.indexOf('id="engineeringDrawerShapes"',drawerStart);
  const drawer=source.slice(drawerStart,drawerEnd);
  const remoteStart=source.indexOf('id="workshopEngineeringViewControls"');
  const remoteEnd=source.indexOf('id="workspaceUtilityRail"',remoteStart);
  const remote=source.slice(remoteStart,remoteEnd);
  assert.match(drawer,/id="engineeringPlatformColorHeading">Platform Color/);
  assert.match(drawer,/id="workshopPlatformColorButton"/);
  assert.doesNotMatch(remote,/workshopPlatformColorButton/);
});

test("relocated Platform Color reuses the authoritative color behavior",()=>{
  assert.match(source,/var platformColorButton=document\.getElementById\("workshopPlatformColorButton"\)/);
  assert.match(source,/platformColorButton\.addEventListener\("click",openPlatformColorDialog\)/);
  assert.doesNotMatch(source,/event\.target\.closest\("#workshopPlatformColorButton"\)/);
  assert.match(source,/function chooseWorkshopPlatformTint\(colorValue\)[\s\S]*workshopPlatformTint=numericColor[\s\S]*ground\.material\.color\.setHex\(workshopPlatformTint\)/);
  assert.match(source,/function enterPlatformColorMode\(\)[\s\S]*openEngineeringToolChestDrawer\("colors-materials"\)/);
  assert.match(source,/stopBuilderClickThrough\(engineeringToolChest\)/);
});

test("View Remote keeps only its approved view controls and scrolling",()=>{
  ["top","left","front","right","back","bottom","home"].forEach(view=>{
    assert.match(source,new RegExp(`data-workshop-view="${view}"`));
  });
  assert.match(source,/#workshopEngineeringViewControls\{[\s\S]*overflow-y:auto;[\s\S]*overscroll-behavior:contain;[\s\S]*scrollbar-width:thin/);
  assert.match(source,/#workshopEngineeringViewControls::-webkit-scrollbar-thumb\{[\s\S]*min-height:44px/);
});

test("Chromebook station gains height while retaining dashboard clearance",()=>{
  assert.match(source,/@media\(max-height:760px\)\{[\s\S]*?#viewCubeBox\{[\s\S]*?top:calc\(38px \+ 0\.5mm\) !important;[\s\S]*?max-height:calc\(100vh - 202px\) !important/);
  assert.match(source,/#workspaceUtilityRail\{[\s\S]*?flex:0 0 48px[\s\S]*?grid-template-rows:48px/);
});

test("Save and Open share one equal larger project row",()=>{
  assert.match(source,/#workspaceUtilityRail\{[\s\S]*grid-template-columns:repeat\(2,minmax\(44px,1fr\)\)/);
  assert.match(source,/\.workshopUtilityProjectButton\{[\s\S]*height:48px;[\s\S]*min-height:48px/);
  assert.match(source,/utilityProjectSave\.addEventListener\("click"[\s\S]*requestWorkshopProjectSave\(utilityProjectSave,false\)/);
  assert.match(source,/utilityProjectOpen\.addEventListener\("click"[\s\S]*requestWorkshopProjectAction\("OPEN",utilityProjectOpen\)/);
});

test("Platform Color remains a 44px contained Tool Chest control",()=>{
  assert.match(source,/#engineeringDrawerColorsMaterialsContent #workshopPlatformColorButton\{[\s\S]*width:100%;[\s\S]*min-height:44px/);
  assert.match(source,/#engineeringDrawerColorsMaterialsContent #workshopPlatformColorButton:focus-visible\{[\s\S]*outline:3px solid #8ff6ff/);
});
