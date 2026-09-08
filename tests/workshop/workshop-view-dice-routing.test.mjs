import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const indexSource = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = indexSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = indexSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < indexSource.length; index += 1) {
    if (indexSource[index] === "{") depth += 1;
    if (indexSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return indexSource.slice(start, index + 1);
    }
  }
  throw new Error(`${name} has no balanced closing brace`);
}

test("View Dice presets route through Workshop ownership without changing Mission routing", () => {
  const calls = [];
  const context = {
    document: { body: { classList: { contains: () => true } } },
    window: { setWorkshopEngineeringView: (view) => { calls.push(["workshop", view]); return "accepted"; } },
    setView: (view) => calls.push(["mission", view]),
  };
  vm.runInNewContext(`${extractFunction("requestViewDicePreset")};this.route=requestViewDicePreset`, context);
  assert.equal(context.route("bottom"), "accepted");
  assert.deepEqual(calls, [["workshop", "bottom"]]);

  context.document.body.classList.contains = () => false;
  assert.equal(context.route("home"), true);
  assert.deepEqual(calls, [["workshop", "bottom"], ["mission", "home"]]);
});

test("Workshop View Dice drag starts from the responsive safe orbit contract", () => {
  const context = {
    document: { body: { classList: { contains: () => true } } },
    activeWorkshopFitSelection: true,
    activeWorkshopEngineeringView: "fit",
    activeWorkshopEngineeringTarget: { id: "selected" },
    cameraAngle: 1,
    cameraDistance: 0.01,
    cameraHeight: -3,
    camera: {
      fov: 50,
      updateProjectionMatrix() { this.updated = true; },
      up: { set(x, y, z) { this.value = [x, y, z]; } },
    },
    getWorkshopHomeCameraConfig: () => ({ distance: 52.6, height: 44.6, fov: 59.5 }),
    cancelWorkshopHomeFrameSettlement: () => { context.homeCancelled = true; },
    clearWorkshopVisibleRulerRange: () => { context.rulerRangeCleared = true; },
    updateCamera: () => { context.cameraUpdated = true; },
    restoreWorkshopFullCadGrid: () => { context.gridRestored = true; },
    hideWorkshopPrecisionCursor: () => { context.cursorHidden = true; },
    syncWorkshopEngineeringViewButtons: () => { context.buttonsSynced = true; },
  };
  vm.runInNewContext(`${extractFunction("beginWorkshopViewDiceDrag")};this.begin=beginWorkshopViewDiceDrag`, context);
  assert.equal(context.begin(), true);
  assert.equal(context.activeWorkshopFitSelection, false);
  assert.equal(context.activeWorkshopEngineeringView, null);
  assert.equal(context.activeWorkshopEngineeringTarget, null);
  assert.equal(context.cameraAngle, 0);
  assert.equal(context.cameraDistance, 52.6);
  assert.equal(context.cameraHeight, 44.6);
  assert.equal(context.camera.fov, 59.5);
  assert.equal(context.camera.updated, true);
  assert.equal(context.homeCancelled, true);
  assert.equal(context.rulerRangeCleared, true);
  assert.equal(context.gridRestored, true);
  assert.deepEqual(context.camera.up.value, [0, 1, 0]);
  assert.equal(context.cameraUpdated, true);
  assert.equal(context.cursorHidden, true);
  assert.equal(context.buttonsSynced, true);
});

test("simple Workshop dice presses do not clear camera ownership before click routing", () => {
  const mousedownStart = indexSource.indexOf('viewCubeCanvas.addEventListener("mousedown"');
  const mousedownEnd = indexSource.indexOf("});", mousedownStart);
  const mousedownSource = indexSource.slice(mousedownStart, mousedownEnd);
  assert.doesNotMatch(mousedownSource, /clearWorkshopEngineeringView/);
  assert.match(indexSource, /window\.beginWorkshopViewDiceDrag\(\)/);
  assert.match(indexSource, /event\.target\.closest\("#viewCubeBox"\)/);
});
