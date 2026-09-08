import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("enables student-facing New Workshop Open Build and Save Build controls",()=>{
  assert.match(source,/id="workshopProjectNew" type="button">New Workshop<\/button>/);
  assert.match(source,/id="workshopProjectOpen" type="button">Open Build<\/button>/);
  assert.match(source,/id="workshopProjectSave" type="button">Save Build<\/button>/);
  assert.match(source,/id="workshopPanelProject"[\s\S]*?<button type="button" disabled>Screenshot<\/button>/);
});

test("keeps equal Save and Open controls below View Remote",()=>{
  assert.match(source,/id="workspaceModeSwitch"[\s\S]*?id="workshopUtilitySave"[\s\S]*?id="workshopUtilityOpen"/);
  assert.match(source,/id="workshopUtilitySave"[^>]*aria-label="Save Build"[^>]*>SAVE<\/button>/);
  assert.match(source,/id="workshopUtilityOpen"[^>]*aria-label="Open Build"[^>]*>OPEN<\/button>/);
  assert.match(source,/utilityProjectSave\.addEventListener\("click"[\s\S]*?requestWorkshopProjectSave\(utilityProjectSave,false\)/);
  assert.match(source,/utilityProjectOpen\.addEventListener\("click"[\s\S]*?requestWorkshopProjectAction\("OPEN",utilityProjectOpen\)/);
  assert.match(source,/#workspaceUtilityRail\{[\s\S]*?flex:0 0 48px[\s\S]*?grid-template-columns:repeat\(2,minmax\(44px,1fr\)\)[\s\S]*?grid-template-rows:48px/);
  assert.match(source,/quickToolbar\.insertBefore\(modeSwitch,quickToolbar\.firstElementChild\)/);
  assert.match(source,/\.workshopUtilityProjectButton\{display:none;\}/);
  assert.match(source,/\.workshopUtilityProjectButton\{[\s\S]*?display:block;[\s\S]*?min-height:48px;[\s\S]*?color:#ff4fa3[\s\S]*?font:900 9px/);
  assert.match(source,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeLabel\{[\s\S]*?color:#dffaff[\s\S]*?text-shadow:none/);
  assert.match(source,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeReturnIcon\{[\s\S]*?color:#fff[\s\S]*?-webkit-text-fill-color:#fff[\s\S]*?text-shadow:none/);
  assert.match(source,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeReturnWords\{[\s\S]*?color:#bff7ff/);
  assert.match(source,/workspaceModeReturnWords">RETURN TO<\/span>[\s\S]*workspaceModeBuilderLine">BUILDER<\/span>/);
  assert.doesNotMatch(source,/workspaceModeMissionLine/);
  assert.match(source,/majorNavigationArrow is-back workspaceModeReturnIcon[^>]*aria-hidden="true"><\/span><span class="workspaceModeReturnWords">RETURN TO<\/span>/);
});

test("Open chooser shows real Build Name and Last Saved metadata",()=>{
  assert.match(source,/title\.textContent="OPEN BUILD"/);
  assert.match(source,/buildName\.className="workshopProjectListName"/);
  assert.match(source,/lastSaved\.className="workshopProjectListSaved"/);
  assert.match(source,/lastSaved\.textContent="Last Saved: "\+\(/);
  assert.match(source,/savedDate\.toLocaleString\(\[\],\{/);
  assert.match(source,/button\.setAttribute\([\s\S]*?"aria-label",[\s\S]*?project\.name\+"\. "\+lastSaved\.textContent/);
  assert.match(source,/announceWorkshopProject\("Build saved!"\)/);
  assert.match(source,/showWorkshopProjectToast\("Build saved!"\)/);
});

test("successful Workshop saves show a bounded visible confirmation",()=>{
  assert.match(source,/id="workshopProjectToast" aria-hidden="true"/);
  assert.match(source,/#workshopProjectToast\{[\s\S]*position:fixed;[\s\S]*pointer-events:none;/);
  assert.match(source,/function showWorkshopProjectToast\(message\)[\s\S]*classList\.add\("isVisible"\)[\s\S]*},3000\);/);
  assert.match(source,/if\(requestedMode!=="workshop"\)\{\s*clearWorkshopProjectToast\(\);/);
});

test("invalid saved entries are reported without hiding valid builds",()=>{
  assert.match(source,/if\(result\.invalidCount>0\)/);
  assert.match(source,/saved data was invalid/);
});

test("loads isolated serializer storage and project workflow owners",()=>{
  ["workshop-project-serializer","workshop-project-storage","workshop-project-controller"]
    .forEach(name=>assert.match(source,new RegExp(`import\\("\\.\\/js\\/workshop\\/persistence\\/${name}\\.mjs"\\)`)));
  assert.match(source,/createWorkshopProjectStorage\(\{[\s\S]*?storage:\{[\s\S]*?window\.localStorage\.getItem\(key\)[\s\S]*?window\.localStorage\.setItem\(key,value\)/);
  assert.match(source,/createWorkshopProjectController\(\{/);
});

test("Builder Save Load and autosave remain unchanged and separate",()=>{
  assert.match(source,/app: "THINKamigBOB Builder",\s*version: 3/);
  assert.match(source,/var AUTOSAVE_KEY="thinkamigbob-student-autosave-v1"/);
  assert.doesNotMatch(source,/AUTOSAVE_KEY="thinkamigbob-workshop-projects-v1"/);
});

test("uses one accessible contained Chromebook dialog",()=>{
  assert.match(source,/id="workshopProjectDialog" role="dialog" aria-modal="true"/);
  assert.match(source,/#workshopProjectList\{[\s\S]*?overflow-y:scroll;[\s\S]*?scrollbar-gutter:stable;[\s\S]*?overscroll-behavior:contain/);
  assert.match(source,/#workshopProjectList::-webkit-scrollbar\{width:14px;\}/);
  assert.match(source,/id="workshopProjectScrollIndicator" aria-hidden="true" hidden/);
  assert.match(source,/#workshopProjectScrollIndicator\{[\s\S]*?pointer-events:none/);
  assert.match(source,/#workshopProjectList button,[\s\S]*?#workshopProjectDialogActions button\{[\s\S]*?min-height:44px/);
  assert.match(source,/event\.key==="Escape"[\s\S]*?closeWorkshopProjectDialog/);
  assert.match(source,/event\.key!=="Tab"[\s\S]*?event\.shiftKey/);
});

test("dirty Save Discard Cancel and duplicate replacement remain explicit",()=>{
  assert.match(source,/workshopProjectController\.getSnapshot\(\)\.dirty[\s\S]*?configureWorkshopProjectDialog\("DIRTY"\)/);
  assert.match(source,/id="workshopProjectSaveGuard" type="button" hidden>SAVE/);
  assert.match(source,/id="workshopProjectDiscard" type="button" hidden>DISCARD/);
  assert.match(source,/id="workshopProjectCancel" type="button">CANCEL/);
  assert.match(source,/workshopProjectDialogMode==="DUPLICATE"[\s\S]*?saveWorkshopProject\([\s\S]*?true/);
});

test("Open candidates validate before exact active replacement",()=>{
  assert.match(source,/createCandidate:createWorkshopProjectCandidate/);
  assert.match(source,/validateCandidates:validateWorkshopProjectCandidates/);
  assert.match(source,/replaceObjects:replaceWorkshopProjectObjects/);
  assert.match(source,/restoreTrustedResizeFamily\(object,record\.family\)/);
});

test("Open accepts saved one-centimeter cubes centered on the Workshop placement plane",()=>{
  assert.match(source,/bounds\.min\.y>=-0\.5/);
  assert.doesNotMatch(source,/bounds\.min\.y>=0;/);
});

test("successful project replacement clears transient presentation and settles Home",()=>{
  const start=source.indexOf("function settleWorkshopProjectPresentation(");
  const end=source.indexOf("function replaceWorkshopProjectObjects",start);
  const block=source.slice(start,end);
  assert.match(block,/clearWorkshopSelectedBlocks\(\)/);
  assert.match(block,/resetWorkshopEditFoundation\(\{preserveHistory:true\}\)/);
  assert.match(block,/resetEngineeringToolChest\(\)/);
  assert.match(block,/clearWorkshopEngineeringView\(\)/);
  assert.match(block,/prepareWorkshopHomeFrameSettlement\(onSettled\)/);
});

test("Open waits for visible Home settlement and rolls back before reporting failure",()=>{
  assert.match(source,/function verifyWorkshopProjectVisibleSettlement\(expectedCount\)/);
  assert.match(source,/object\.parent===scene && object\.visible!==false/);
  assert.match(source,/verifyWorkshopProjectVisibleSettlement\(opened\.project\.objects\.length\)[\s\S]*rollbackWorkshopProjectReplacement\(\)[\s\S]*restoreProjectIdentity\(opened\.previousProject\)/);
  assert.match(source,/commitWorkshopProjectReplacement\(\)[\s\S]*announceWorkshopProject\("Build opened!"\)/);
});
