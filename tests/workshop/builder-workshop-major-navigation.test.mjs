import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("one authoritative navigation pair moves to the Builder lower-left owner",()=>{
  assert.equal((source.match(/id="returnMissionsButton"/g)||[]).length,1);
  assert.equal((source.match(/id="workspaceModeSwitch"/g)||[]).length,1);
  assert.match(source,/navigation\.appendChild\(returnButton\);[\s\S]*navigation\.appendChild\(workshopButton\)/);
  assert.match(source,/#builderMajorNavigation\{[\s\S]*bottom:8px;[\s\S]*grid-template-rows:44px 44px;[\s\S]*gap:5px/);
});

test("Builder navigation labels and arrows express Missions back and Workshop forward",()=>{
  assert.match(source,/aria-label","Return to Missions"/);
  assert.match(source,/majorNavigationArrow is-back" aria-hidden="true"><\/span><span>RETURN TO<\/span>[\s\S]*>MISSIONS<\/span>/);
  assert.match(source,/workspaceModeOpenWords">OPEN WORKSHOP<\/span><span class="majorNavigationArrow is-forward workspaceModeForwardIcon" aria-hidden="true"><\/span>/);
  assert.doesNotMatch(source,/workspaceMode(Return|Forward)Icon" aria-hidden="true">[←→]<\/span>/);
});

test("Workshop reuses the mode control and canonical shutdown as Return to Builder",()=>{
  assert.match(source,/modeSwitch\.title=workshopIsActive \? "Return to Builder" : "Open Workshop"/);
  assert.match(source,/majorNavigationArrow is-back workspaceModeReturnIcon" aria-hidden="true"><\/span>[\s\S]*workspaceModeReturnWords">RETURN TO<\/span>[\s\S]*workspaceModeBuilderLine">BUILDER<\/span>/);
  assert.match(source,/quickToolbar\.insertBefore\(modeSwitch,quickToolbar\.firstElementChild\)/);
  assert.match(source,/window\.returnToMission=function\(\)\{ return setWorkspaceMode\("mission"\); \}/);
});

test("parallel navigation controls share a bold CSS-drawn arrow family",()=>{
  assert.match(source,/\.majorNavigationArrow\{[\s\S]*width:18px;[\s\S]*height:12px;[\s\S]*color:#7fefff/);
  assert.match(source,/\.majorNavigationArrow::before\{[\s\S]*height:4px;[\s\S]*background:currentColor/);
  assert.match(source,/\.majorNavigationArrow\.is-back::after[\s\S]*border-right:8px solid currentColor/);
  assert.match(source,/\.majorNavigationArrow\.is-forward::after[\s\S]*border-left:8px solid currentColor/);
  assert.match(source,/\.builderNavigationSecondLine\{[\s\S]*font-size:14px/);
  assert.match(source,/\.workspaceModeBuilderLine\{[\s\S]*font:900 12px/);
});

test("navigation uses existing authored frame artwork without a second CSS contour",()=>{
  assert.match(source,/#builderMajorNavigation > button\{[\s\S]*builder-shortcut-grid-frame-glow\.png/);
  assert.match(source,/#workshopQuickAccessToolbar #workspaceModeSwitch\{[\s\S]*background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\)/);
  assert.doesNotMatch(source,/#workshopQuickAccessToolbar #workspaceModeSwitch\{[^}]*border-image-source:/);
  assert.doesNotMatch(source,/#builderMajorNavigation > button\{[\s\S]*box-shadow:inset 0 0 0/);
});
