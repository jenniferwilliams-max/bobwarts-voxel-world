import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("runtime loads one ledger and connects the approved Move controller", () => {
  assert.equal((source.match(/import\("\.\/js\/workshop\/editing\/workshop-edit-history\.mjs"\)/g) || []).length, 1);
  assert.equal((source.match(/import\("\.\/js\/workshop\/editing\/workshop-selection-move-controller\.mjs"\)/g) || []).length, 1);
  assert.match(source, /workshopEditHistory=modules\[27\]\.createWorkshopEditHistory/);
  assert.match(source, /workshopSelectionMoveController=\s*modules\[28\]\.createWorkshopSelectionMoveController/);
  assert.match(source, /workshopSelectionMoveController\.arm\(/);
  assert.match(source, /workshopSelectionMoveController\.preview\(/);
  assert.match(source, /workshopSelectionMoveController\.beginCommit\(/);
  assert.match(source, /workshopSelectionMoveController\.complete\(/);
  assert.match(source, /workshopSelectionMoveController\.cancel\(/);
});

test("placement and deletion feed the chronological ledger", () => {
  assert.match(source, /blocks\.push\(block\);\s*recordWorkshopPlacementHistory\(block\)/);
  assert.match(source, /blocks\.push\(newBlock\);\s*recordWorkshopPlacementHistory\(newBlock\)/);
  assert.match(source, /recordWorkshopDeletionHistory\(deletedSelection\)/);
  assert.match(source, /workshopEditHistory\.undo\(\)/);
  assert.match(source, /workshopEditHistory\.redo\(\)/);
});

test("existing controls expose bounded Move and history availability", () => {
  assert.match(source, /const canUndo = editHistorySnapshot[\s\S]*?editHistorySnapshot\.canUndo/);
  assert.match(source, /const canRedo = editHistorySnapshot[\s\S]*?editHistorySnapshot\.canRedo/);
  assert.match(source, /undoButton\.disabled = !canUndo/);
  assert.match(source, /redoButton\.disabled = !canRedo/);
  assert.match(source, /id="workshopMoveButton"[^>]*aria-pressed="false"[^>]*onclick="startMoveSelected\(\)"[^>]*disabled/);
  assert.match(source, /id="workshopCancelMoveButton"[^>]*onclick="cancelWorkshopMove/);
  assert.match(source, /#workshopCancelMoveButton\[hidden\]\{\s*display:none !important/);
  assert.match(source, /\.workshop-dashboard-controls button\{[\s\S]*?min-height:44px/);
});

test("Move commit remains one validated atomic history transaction", () => {
  const moveStart=source.indexOf("if(moveSelectedMode && hit === ground)");
  const moveEnd=source.indexOf("const newBlock = createStudentShape",moveStart);
  const move=source.slice(moveStart,moveEnd);
  assert.match(move, /workshopTranslatedSelectionCollides/);
  assert.ok(move.indexOf("beginCommit") < move.indexOf("selectedBlocks.forEach(block =>"));
  assert.ok(move.indexOf("selectedBlocks.forEach(block =>") < move.indexOf('type:"MOVE"'));
  assert.match(move, /translation:\{x:changeX,z:changeZ\}/);
  assert.match(move, /selection:selectedBlocks\.slice\(\)/);
  assert.match(move, /workshopSelectionMoveController\.complete\(moveToken\)/);
  assert.doesNotMatch(move, /clearWorkshopSelectedBlocks\(\);/);
});

test("Move cancellation, preview, and selection synchronization use existing owners", () => {
  assert.match(source, /function previewWorkshopMoveAtPointer\(event\)/);
  assert.match(source, /event\.key==="Escape"[\s\S]*?cancelWorkshopMove/);
  assert.match(source, /document\.addEventListener\("pointermove",previewWorkshopMoveAtPointer\)/);
  assert.match(source, /function applyWorkshopEditTransaction[\s\S]*?transaction\.type==="MOVE"[\s\S]*?setWorkshopSelectedObjectsExact\(transaction\.selection\)/);
  assert.match(source, /syncWorkshopSelectionMeasurements\(\);[\s\S]*?updateUndoRedoButtons\(\)/);
});

test("load, reset, Mission restoration, shutdown, and faults clear ownership", () => {
  assert.match(source, /function resetWorld\([\s\S]*?resetWorkshopEditFoundation\(\)/);
  assert.match(source, /function restoreSavedBuild\(state\)[\s\S]*?resetWorkshopEditFoundation\(\)/);
  assert.match(source, /function clearActiveWorkshopObjects\([\s\S]*?resetWorkshopEditFoundation\(\)/);
  assert.match(source, /snapshot\.workshop==="SHUTTING_DOWN"[\s\S]*?workshopSelectionMoveController\.reset\(\)/);
  assert.match(source, /snapshot\.workshop==="FAULT_SAFE"/);
  assert.match(source, /snapshot\.workshop==="OFF"/);
});

test("save and autosave schema remain unchanged", () => {
  const saveBlock = source.slice(source.indexOf("function saveNow("), source.indexOf("function scheduleSave("));
  assert.doesNotMatch(saveBlock, /workshopEditHistory|workshopSelectionMoveController|MOVE/);
  assert.match(saveBlock, /version:1/);
  assert.match(saveBlock, /blocks:blocks\.map\(blockRecord\)/);
});

test("Rotate uses one native immediate control and the prepared history owner", () => {
  assert.match(source,/id="workshopRotateRightButton"[^>]*aria-label="Rotate selection right 90 degrees"[^>]*onclick="rotateWorkshopSelectionRight\(\)"[^>]*disabled/);
  assert.match(source,/\.workshop-dashboard-controls button\{[\s\S]*?min-height:44px/);
  const start=source.indexOf("function rotateWorkshopSelectionRight()");
  const end=source.indexOf("function previewWorkshopMoveAtPointer",start);
  const rotate=source.slice(start,end);
  assert.match(rotate,/cancelWorkshopMove\(\{announce:false,restoreFocus:false\}\)/);
  assert.match(rotate,/createWorkshopSelectionRotateCandidate/);
  assert.match(rotate,/createWorkshopRotatedObjectBounds/);
  assert.match(rotate,/workshopBoundsFitActiveWorkspace/);
  assert.match(rotate,/workshopRotatedSelectionCollides/);
  assert.ok(rotate.indexOf("workshopEditHistory.prepare") < rotate.indexOf("entry.object.position.set"));
  assert.ok(rotate.indexOf("entry.object.position.set") < rotate.indexOf("commitPrepared"));
  assert.match(rotate,/type:"ROTATE"/);
  assert.match(rotate,/setWorkshopSelectedObjectsExact\(selection\)/);
  assert.doesNotMatch(rotate,/raycaster|addEventListener|snapWorkshop/);
});

test("Rotate history restores exact positions, Y rotations, and selection", () => {
  assert.match(source,/transaction\.type==="ROTATE" && direction==="PREPARE"/);
  assert.match(source,/workshopEditTransformMatches\([\s\S]*?entry\.beforeRotationY/);
  assert.match(source,/entry\.object\.rotation\.y=useBefore[\s\S]*?entry\.beforeRotationY[\s\S]*?entry\.afterRotationY/);
  assert.match(source,/transaction\.type==="MOVE" \|\| transaction\.type==="ROTATE"/);
  assert.match(source,/result\.transaction\.type==="ROTATE"[\s\S]*?Rotation undone/);
  assert.match(source,/result\.transaction\.type==="ROTATE" \? "↪️ Rotation restored\."/);
});

test("Rotate leaves persistence and camera rotation owners unchanged", () => {
  assert.match(source,/rotationY: block\.rotation\.y \|\| 0/);
  assert.match(source,/version: 3/);
  assert.match(source,/if\(event\.key === "ArrowLeft"\)[\s\S]*?cameraAngle -= 0\.2/);
  assert.match(source,/if\(event\.key === "ArrowRight"\)[\s\S]*?cameraAngle \+= 0\.2/);
});

test("Resize uses two native immediate controls and one prepared transaction", () => {
  assert.match(source,/id="workshopGrowButton"[^>]*aria-label="Grow selected boxes by 1 centimeter"[^>]*onclick="resizeWorkshopSelection\(1\)"[^>]*disabled/);
  assert.match(source,/id="workshopShrinkButton"[^>]*aria-label="Shrink selected boxes by 1 centimeter"[^>]*onclick="resizeWorkshopSelection\(-1\)"[^>]*disabled/);
  assert.match(source,/\.workshop-dashboard-controls button\{[\s\S]*?min-height:44px/);
  const start=source.indexOf("function resizeWorkshopSelection(delta)");
  const end=source.indexOf("function rotateWorkshopSelectionRight()",start);
  const resize=source.slice(start,end);
  assert.match(resize,/cancelWorkshopMove\(\{announce:false,restoreFocus:false\}\)/);
  assert.match(resize,/createWorkshopAggregateResizeCandidate/);
  assert.match(resize,/new THREE\.BoxGeometry/);
  assert.match(resize,/createWorkshopResizedObjectBounds/);
  assert.match(resize,/workshopBoundsFitActiveWorkspace/);
  assert.match(resize,/workshopBoundsOverlap/);
  assert.ok(resize.indexOf("workshopEditHistory.prepare") <
    resize.indexOf("entry.object.geometry=candidateGeometry.geometry"));
  assert.ok(resize.indexOf("entry.object.geometry=candidateGeometry.geometry") <
    resize.indexOf("commitPrepared"));
  assert.match(resize,/type:"RESIZE"/);
  assert.equal((resize.match(/syncWorkshopSelectionMeasurements\(\)/g)||[]).length,2);
  assert.doesNotMatch(resize,/raycaster|addEventListener|snapWorkshop/);
});

test("Resize history compares and restores exact dimensions atomically", () => {
  assert.match(source,/transaction\.type==="RESIZE" && direction==="PREPARE"/);
  assert.match(source,/workshopEditDimensionsMatch\(entry\.object,entry\.beforeDimensions\)/);
  assert.match(source,/transaction\.type==="RESIZE"[\s\S]*?new THREE\.BoxGeometry/);
  assert.match(source,/state\.geometry\) state\.object\.geometry=state\.geometry/);
  assert.match(source,/transaction\.type==="MOVE" \|\| transaction\.type==="ROTATE" \|\|[\s\S]*?transaction\.type==="RESIZE"/);
  assert.match(source,/result\.transaction\.type==="RESIZE"[\s\S]*?Resize undone/);
  assert.match(source,/result\.transaction\.type==="RESIZE" \? "↪️ Resize restored\."/);
});

test("Resize loads one pure transform owner without changing save versions", () => {
  assert.equal((source.match(/import\("\.\/js\/workshop\/editing\/workshop-selection-resize-transform\.mjs"\)/g) || []).length,1);
  assert.match(source,/workshopSelectionResizeTransformModule=modules\[30\]/);
  assert.match(source,/sx: block\.geometry\.parameters\.width \|\| 1/);
  assert.match(source,/version: 3/);
  assert.match(source,/version:1/);
});

test("WS-013D1 keeps one canonical selection and existing transform consumers", () => {
  assert.equal((source.match(/import\("\.\/js\/workshop\/editing\/workshop-selection-foundation\.mjs"\)/g)||[]).length,1);
  assert.match(source,/workshopSelectionFoundationController=\s*modules\[31\]\.createWorkshopSelectionFoundationController/);
  assert.match(source,/function setWorkshopSelectedObjectsExact\(objects\)/);
  assert.match(source,/workshopSelectionMoveController\.arm\(\s*selectedBlocks\.slice\(\)/);
  assert.match(source,/createWorkshopSelectionRotateCandidate\([\s\S]*?selection\.map/);
  assert.match(source,/recordWorkshopDeletionHistory\(deletedSelection\)/);
  assert.match(source,/window\.setWorkshopRulerSelectedObjects\(selectedBlocks\)/);
  assert.match(source,/const resizeSelection=activeWorkshopBlocks\(selectedBlocks\)/);
  assert.match(source,/createWorkshopAggregateResizeCandidate\(resizeSelection,1\)/);
});

test("selection commands preserve placement ownership and make ground non-mutating", () => {
  assert.match(source,/id="workshopSelectButton"[\s\S]*?<span>Select One<\/span>/);
  assert.match(source,/id="workshopSelectMultipleButton"[^>]*onclick="startWorkshopSelectMultiple\(\)"/);
  assert.match(source,/id="workshopSelectConnectedButton"[^>]*onclick="startWorkshopSelectStack\(\)"/);
  assert.match(source,/id="workshopClearSelectionButton"[^>]*onclick="clearWorkshopSelectionCommand\(\)"/);
  const selectionClick=source.slice(source.indexOf("if(selectionInteractionOwned){"),
    source.indexOf("if(moveSelectedMode && hit === ground)"));
  assert.match(selectionClick,/Selection unchanged\. Choose an object or use Clear\./);
  assert.doesNotMatch(selectionClick,/clearWorkshopSelectedBlocks/);
  assert.match(source,/const newBlock = createStudentShape/);
  assert.match(source,/selectWorkshopConnectedBuild\(newBlock\)/);
});

test("Select Multiple expands only its first seed then refines individual items", () => {
  const start=source.indexOf("function selectConnectedBlocks(startBlock,selectionPoint)");
  const end=source.indexOf("function startMoveSelected()",start);
  const selection=source.slice(start,end);
  assert.match(selection,/snapshot\.firstSeedPending/);
  assert.match(selection,/getWorkshopCanonicalFaceConnectedSelection\(startBlock\)/);
  assert.match(selection,/setWorkshopSelectedObjectsExact\(firstSelection\)/);
  assert.match(selection,/acceptFirstSeed\(selectedBlocks\)/);
  assert.match(selection,/if\(selectedBlocks\.includes\(startBlock\)\)[\s\S]*?removeWorkshopSelectedBlock\(startBlock\)/);
  assert.match(selection,/selectedBlocks\.push\(startBlock\)/);
  assert.match(selection,/workshopSelectionFoundationController\.update\(selectedBlocks\)/);
});
