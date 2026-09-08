import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const starterStart=source.indexOf('<div id="startScreen"');
const starter=source.slice(starterStart,source.indexOf('<script id="starterLoadingCoverScript"',starterStart));
const polish=source.match(/<style id="starterMissionProjectEntryPolishCSS">([\s\S]*?)<\/style>/)?.[1] || "";
const primaryAction=source.match(/<style id="starterMissionPrimaryActionPolish">([\s\S]*?)<\/style>/)?.[1] || "";
const approvedArtwork=source.match(/<style id="starterMissionApprovedArtworkAndTitleRestoreCSS">([\s\S]*?)<\/style>/)?.[1] || "";
const resumeClearance=source.match(/<style id="starterMultiMissionResumeClearanceCSS">([\s\S]*?)<\/style>/)?.[1] || "";
const scrolling=source.match(/<script id="starterMissionProjectEntryScrollScript">([\s\S]*?)<\/script>/)?.[1] || "";

test("starter project entry uses the approved hierarchy and canonical mission start",()=>{
  assert.doesNotMatch(starter,/>\s*Before You Start\s*</i);
  assert.match(starter,/id="startBuildingButton" onclick="startSelectedWorld\(\)" aria-label="Start a Mission"/);
  assert.match(starter,/>START A MISSION<\/span>/);
  assert.doesNotMatch(starter,/>START MISSION</);
  assert.match(polish,/#startBuildingButton[\s\S]*place-items:center/);
  assert.match(primaryAction,/#startBuildingButton\{[\s\S]*border:2px solid #ffe18a[\s\S]*linear-gradient\(180deg,#f9d96b/);
  assert.match(primaryAction,/\.startMissionActionLabel\{[\s\S]*font-size:18px[\s\S]*font-weight:900/);
  assert.match(primaryAction,/#startBuildingButton:not\(\.missionLaunchButtonPulse\):hover[\s\S]*scale\(1\.025\)/);
  assert.match(primaryAction,/#startBuildingButton:focus-visible[\s\S]*outline:3px solid #35dcff/);
  assert.match(approvedArtwork,/background-image:url\("assets\/images\/start-a-mission-button-transparent\.png"\)/);
  assert.match(approvedArtwork,/\.startMissionActionLabel\{[\s\S]*position:absolute[\s\S]*clip:rect\(0 0 0 0\)/);
  assert.match(approvedArtwork,/\.starterTitleBanner\{[\s\S]*width:min\(1320px,92vw\)/);
  assert.match(approvedArtwork,/grid-template-rows:minmax\(170px,200px\) minmax\(0,1fr\) auto auto/);
  assert.match(approvedArtwork,/\.startBeforePanel\{[\s\S]*grid-template-rows:105px 44px[\s\S]*overflow:visible/);
  assert.match(approvedArtwork,/#startBuildingButton\{[\s\S]*width:min\(320px,100%\)/);
  assert.match(approvedArtwork,/\.startMissionGrid\{[\s\S]*grid-template-rows:repeat\(2,56px\)/);
});

test("Open stays fixed at the far left and reuses the validated Builder file input",()=>{
  const openIndex=starter.indexOf('id="starterOpenSavedBuildButton"');
  const resumeIndex=starter.indexOf('id="starterResumeViewport"');
  assert.ok(openIndex>0 && resumeIndex>openIndex);
  assert.match(starter,/id="starterOpenSavedBuildButton"[^>]*onclick="openStarterSavedBuild\(\)"[^>]*>OPEN A SAVED BUILD<\/button>/);
  assert.match(polish,/\.starterProjectEntryRow\{[\s\S]*grid-template-columns:184px minmax\(0,1fr\)/);
  assert.match(polish,/#starterOpenSavedBuildButton\{[\s\S]*border:2px solid #f7fbff;[\s\S]*color:#fff;/);
  assert.match(source,/function openStarterSavedBuild\(\)\{[\s\S]*getElementById\('loadFile'\)[\s\S]*input\.click\(\)/);
  assert.equal((source.match(/id="loadFile"/g)||[]).length,1);
  assert.match(source,/validateBuilderProjectFile\(loadedData\)/);
});

test("Resume retains dynamic mission naming and canonical autosave restoration",()=>{
  assert.match(starter,/id="starterResumeTrack" class="starterResumeTrack">\s*<\/div>/);
  assert.match(source,/var AUTOSAVE_COLLECTION_KEY="thinkamigbob-student-autosaves-v2"/);
  assert.match(source,/savedBuilds\[state\.selectedStartWorld\]=state/);
  assert.match(source,/Object\.keys\(savedBuilds\)\.map/);
  assert.match(source,/button\.className="resumeAutosaveButton"/);
  assert.match(source,/button\.textContent="↻ Resume Saved Build — "\+label/);
  assert.match(source,/button\.addEventListener\("click",function\(\)\{ resumeSavedBuild\(missionKey\); \}\)/);
  assert.match(source,/function resumeSavedBuild\(missionKey\)\{[\s\S]*readAutosaves\(\)\[missionKey\][\s\S]*window\.selectedStartWorld=state\.selectedStartWorld[\s\S]*window\.startSelectedWorld\(\)/);
  assert.match(source,/var legacy=readAutosave\(\)[\s\S]*builds\[legacy\.selectedStartWorld\]=legacy/);
  assert.match(source,/resumeRestorePending=true[\s\S]*restoreSavedBuild\(state\)[\s\S]*resumeRestorePending=false/);
  assert.match(polish,/\.starterResumeTrack\{[\s\S]*flex-wrap:nowrap;[\s\S]*width:max-content/);
  assert.match(polish,/\.resumeAutosaveButton\{[\s\S]*border:2px solid #8df5ff;[\s\S]*color:#eaffff;/);
});

test("custom Resume scroller is visible only for overflow and owns all scroll input",()=>{
  assert.match(starter,/id="starterResumeScrollRail"[^>]*role="scrollbar"[^>]*aria-orientation="horizontal"/);
  assert.match(polish,/\.starterResumeScrollControls\{[\s\S]*grid-template-columns:44px minmax\(0,1fr\) 44px/);
  assert.match(polish,/\.starterResumeScrollThumb\{[\s\S]*min-width:44px/);
  assert.match(scrolling,/controls\.hidden=!overflow/);
  assert.match(scrolling,/left\.disabled=viewport\.scrollLeft<=1/);
  assert.match(scrolling,/right\.disabled=viewport\.scrollLeft>=max-1/);
  assert.match(scrolling,/viewport\.addEventListener\("wheel"[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)/);
  assert.match(scrolling,/thumb\.addEventListener\("pointerdown"[\s\S]*setPointerCapture/);
  for(const key of ["ArrowLeft","ArrowRight","PageUp","PageDown","Home","End"]){
    assert.match(scrolling,new RegExp(`event\\.key===\"${key}\"`));
  }
});

test("multi-mission Resume controls remain below the Start a Mission artwork",()=>{
  assert.match(resumeClearance,/\.startBeforePanel\{[\s\S]*grid-template-rows:105px minmax\(91px,auto\)[\s\S]*min-height:216px[\s\S]*overflow:hidden/);
  assert.match(resumeClearance,/#starterProjectEntryRow\{[\s\S]*grid-template-rows:minmax\(91px,auto\)[\s\S]*min-height:91px/);
  assert.match(resumeClearance,/\.starterResumeRegion\{[\s\S]*grid-template-rows:44px 44px[\s\S]*min-height:91px/);
});

test("starter scope keeps the ten missions and four help cards without Workshop or Inventor entry",()=>{
  assert.equal((starter.match(/<button[^>]*class="[^"]*\bmissionTile\b[^"]*"/g)||[]).length,10);
  assert.equal((starter.match(/<div class="startTip">/g)||[]).length,4);
  assert.doesNotMatch(starter,/Open Workshop/i);
  assert.doesNotMatch(starter,/Inventor(?:'s|’s)? Mission/i);
  assert.match(source,/body\.starterScreenActive,\s*#startScreen\{[\s\S]*height:100dvh;[\s\S]*overflow:hidden !important;/);
});
