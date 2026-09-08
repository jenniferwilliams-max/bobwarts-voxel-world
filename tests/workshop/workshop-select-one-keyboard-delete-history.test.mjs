import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("Select One remains canonical and replaces the complete prior selection",()=>{
  const start=source.indexOf("function selectConnectedBlocks(startBlock,selectionPoint)");
  const end=source.indexOf("function startMoveSelected()",start);
  const routing=source.slice(start,end);
  assert.match(routing,/snapshot && snapshot\.state==="SELECT_ONE"/);
  assert.match(routing,/state==="SELECT_ONE"[\s\S]*?setWorkshopSelectedObjectsExact\(\[startBlock\]\)[\s\S]*?workshopSelectionFoundationController\.update\(selectedBlocks\)/);
  const selectOne=routing.slice(routing.indexOf('state==="SELECT_ONE"'),
    routing.indexOf("}else{",routing.indexOf('state==="SELECT_ONE"')));
  assert.doesNotMatch(selectOne,/reset\(\)|selectMode=false|getWorkshopConnectedComponent|getWorkshopCanonicalFaceConnectedSelection|getWorkshopCanonicalVerticalStackSelection/);
  assert.match(source,/function setWorkshopSelectedObjectsExact\(objects\)[\s\S]*?clearWorkshopSelectedBlocks\(\{preserveRestore:true\}\)[\s\S]*?selectedBlocks\.push\(block\)/);
});

test("right-click deletion prepares and commits exactly one atomic ledger operation",()=>{
  const start=source.indexOf("document.addEventListener('contextmenu', (event)=>{");
  const end=source.indexOf("function animate()",start);
  const routing=source.slice(start,end);
  assert.match(source,/function createWorkshopDeletionOperation\(objects,selection\)[\s\S]*?type:"DELETION"[\s\S]*?selection:Array\.isArray\(selection\)/);
  assert.match(routing,/workshopEditHistory\.prepare\([\s\S]*?createWorkshopDeletionOperation\(\[blockToRemove\],selectionBefore\)/);
  assert.ok(routing.indexOf("workshopEditHistory.prepare") <
    routing.indexOf("scene.remove(blockToRemove)"));
  assert.ok(routing.indexOf("scene.remove(blockToRemove)") <
    routing.indexOf("workshopEditHistory.commitPrepared"));
  assert.equal((routing.match(/commitPrepared\(/g)||[]).length,1);
  assert.match(routing,/if\(!committed\.ok\)[\s\S]*?blocks\.push\(blockToRemove\)[\s\S]*?scene\.add\(blockToRemove\)[\s\S]*?setWorkshopSelectedObjectsExact\(selectionBefore\)/);
});

test("deletion Undo restores exact transaction selection and Redo removes the same object",()=>{
  assert.match(source,/transaction\.type==="DELETION" && useBefore[\s\S]*?setWorkshopSelectedObjectsExact\(transaction\.selection\)/);
  const undoStart=source.indexOf("function undoLast()");
  const redoStart=source.indexOf("function redoLast()",undoStart);
  const undo=source.slice(undoStart,redoStart);
  assert.doesNotMatch(undo,/selectWorkshopConnectedBuilds\(result\.transaction\.entries/);
  assert.match(source,/transaction\.type==="DELETION" \? useBefore : true/);
  assert.match(source,/if\(transaction\.type==="DELETION"\) return direction==="UNDO" \? !present : present/);
});

test("native Workshop Enter and Space clicks bypass only stale compatibility suppression",()=>{
  assert.match(source,/function workshopNativeControlOwnsKeyboardClick\(event\)[\s\S]*?event\.detail!==0[\s\S]*?closest\("button,input,select,textarea"\)/);
  assert.match(source,/#workshopDashboard,#viewCubeBox,#workspaceUtilityRail/);
  assert.equal((source.match(/workshopNativeControlOwnsKeyboardClick\(event\)/g)||[]).length,3);
  assert.match(source,/workshopNativeControlOwnsKeyboardClick\(event\)[\s\S]*?clearReadToBobPanelCompatibilitySuppression\(\)[\s\S]*?return/);
  assert.match(source,/workshopNativeControlOwnsKeyboardClick\(event\)[\s\S]*?clearReadToBobCompatibilitySuppression\(\)[\s\S]*?resetReadToBobModalInteractionOwnership\(\)[\s\S]*?return/);
  const helperStart=source.indexOf("function workshopNativeControlOwnsKeyboardClick(event)");
  const helperEnd=source.indexOf("document.addEventListener('click'",helperStart);
  assert.doesNotMatch(source.slice(helperStart,helperEnd),/addEventListener\("keydown"/);
});

test("Select Multiple, Select Stack, and transforms keep their established owners",()=>{
  assert.match(source,/state==="SELECT_MULTIPLE"[\s\S]*?acceptFirstSeed\(selectedBlocks\)/);
  assert.match(source,/state==="SELECT_STACK"[\s\S]*?getWorkshopCanonicalVerticalStackSelection\(startBlock\)/);
  assert.match(source,/function startMoveSelected\(\)/);
  assert.match(source,/function rotateWorkshopSelectionRight\(\)/);
  assert.match(source,/function resizeWorkshopSelection\(delta\)/);
});
