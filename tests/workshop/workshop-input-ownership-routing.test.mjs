import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const clickStart=source.indexOf("document.addEventListener('click', (event)=>{");
const contextStart=source.indexOf("document.addEventListener('contextmenu', (event)=>{");
const clickRouting=source.slice(clickStart,contextStart);
const contextEnd=source.indexOf("function animate()",contextStart);
const contextRouting=source.slice(contextStart,contextEnd);

test("Workshop selection routing derives intent from the canonical controller",()=>{
  assert.match(source,/function workshopCanonicalSelectionOwnsObjectInteraction\(\)[\s\S]*?getSnapshot\(\)[\s\S]*?snapshot\.state!=="INACTIVE"/);
  assert.match(clickRouting,/selectionInteractionOwned=workshopInteraction[\s\S]*?workshopCanonicalSelectionOwnsObjectInteraction\(\)[\s\S]*?: selectMode/);
  assert.match(clickRouting,/if\(selectionInteractionOwned\)[\s\S]*?selectConnectedBlocks\(hit,intersects\[0\]\.point\);[\s\S]*?return;/);
  assert.ok(clickRouting.indexOf("if(selectionInteractionOwned)") <
    clickRouting.indexOf("const newBlock = createStudentShape"));
});

test("controller and legacy selectMode divergence cannot fall through to placement",()=>{
  assert.doesNotMatch(clickRouting,/if\(selectMode\)\{/);
  assert.match(source,/state==="SELECT_MULTIPLE"[\s\S]*?firstSeedPending[\s\S]*?acceptFirstSeed\(selectedBlocks\)/);
  assert.match(source,/state==="SELECT_MULTIPLE"[\s\S]*?removeWorkshopSelectedBlock\(startBlock\)[\s\S]*?workshopSelectionFoundationController\.update\(selectedBlocks\)/);
  assert.match(source,/state==="SELECT_STACK"[\s\S]*?getWorkshopCanonicalVerticalStackSelection\(startBlock\)/);
});

test("Workshop canvas actions require genuine renderer ownership",()=>{
  assert.match(source,/function workshopEventOwnsRendererCanvas\(event\)[\s\S]*?event\.target===renderer\.domElement/);
  assert.match(clickRouting,/workshopInteraction && !workshopEventOwnsRendererCanvas\(event\)\) return/);
  assert.match(contextRouting,/workshopInteraction && !workshopEventOwnsRendererCanvas\(event\)\) return/);
  assert.match(source,/event\.target\s*!==\s*renderer\.domElement[\s\S]*?workshopCanvasOrbitPrepared\s*=\s*false/);
  assert.match(source,/previewWorkshopMoveAtPointer\(event\)[\s\S]*?event\.target!==renderer\.domElement/);
});

test("renderer-local coordinates own click, move preview, and right-click raycasts",()=>{
  assert.match(source,/function setBuilderPointerFromRendererEvent\(event\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?event\.clientX-bounds\.left[\s\S]*?event\.clientY-bounds\.top/);
  assert.match(clickRouting,/if\(!setBuilderPointerFromRendererEvent\(event\)\) return/);
  assert.match(contextRouting,/if\(!setBuilderPointerFromRendererEvent\(event\)\) return/);
  assert.match(source,/previewWorkshopMoveAtPointer\(event\)[\s\S]*?if\(!setBuilderPointerFromRendererEvent\(event\)\) return false/);
});

test("dashboard and native controls are explicitly excluded without keyboard duplication",()=>{
  assert.match(source,/function clickedUI\(event\)[\s\S]*?closest\("#workshopDashboard"\)/);
  assert.match(source,/"workshopDashboard",[\s\S]*?element\.addEventListener\("click"[\s\S]*?event\.stopPropagation\(\)/);
  assert.equal((source.match(/id="workshopSelectMultipleButton"/g)||[]).length,1);
  assert.doesNotMatch(source,/workshopSelectMultipleButton[\s\S]{0,500}addEventListener\("keydown"/);
});

test("right-click deletes only a renderer-targeted object and stale reader guards yield",()=>{
  assert.match(contextRouting,/raycaster\.intersectObjects\(blocks\)[\s\S]*?intersects\[0\]\.object[\s\S]*?scene\.remove\(blockToRemove\)/);
  assert.match(source,/window\.addEventListener\("contextmenu"[\s\S]*?workshopEventOwnsRendererCanvas\(event\)[\s\S]*?clearReadToBobPanelCompatibilitySuppression\(\)[\s\S]*?return/);
  assert.match(source,/window\.addEventListener\("contextmenu"[\s\S]*?workshopEventOwnsRendererCanvas\(event\)[\s\S]*?resetReadToBobModalInteractionOwnership\(\)[\s\S]*?return/);
});

test("Return to Mission is idempotent throughout canonical shutdown",()=>{
  assert.match(source,/requestedMode==="mission" && workshopCanonicalState==="SHUTTING_DOWN"\)[\s\S]*?return true/);
  assert.match(source,/switcher\.addEventListener\("click"[\s\S]*?workshopCanonicalState==="SHUTTING_DOWN"[\s\S]*?\? "mission"/);
  assert.match(source,/window\.toggleWorkspaceMode=function\(\)[\s\S]*?workshopCanonicalState==="SHUTTING_DOWN"[\s\S]*?\? "mission"/);
});

test("Select Stack and transform ownership remain unchanged",()=>{
  assert.equal((source.match(/function getWorkshopCanonicalVerticalStackSelection\(/g)||[]).length,1);
  assert.match(source,/function startMoveSelected\(\)/);
  assert.match(source,/function rotateWorkshopSelectionRight\(\)/);
  assert.match(source,/function resizeWorkshopSelection\(delta\)/);
});
