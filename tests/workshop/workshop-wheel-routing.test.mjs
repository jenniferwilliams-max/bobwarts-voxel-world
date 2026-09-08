import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const wheelHandlers = source.match(/document\.addEventListener\(['"]wheel['"]/g) || [];
const cameraWheel = source.match(/document\.addEventListener\('wheel',[\s\S]*?\}, \{ passive: false \}\);/)?.[0] || "";

test("keeps exactly one global camera wheel handler", () => {
  assert.equal(wheelHandlers.length, 1);
  assert.match(cameraWheel, /builderUiBlocksCanvasEvent\(event\)/);
  assert.match(cameraWheel, /event\.preventDefault\(\)/);
  assert.match(cameraWheel, /workshopBuildViewportOwnsWheel\(event\)/);
  assert.ok(cameraWheel.indexOf("#workshopMeasurementAssistant") <
    cameraWheel.indexOf("workshopBuildViewportOwnsWheel(event)"));
  assert.ok(cameraWheel.indexOf("workshopBuildViewportOwnsWheel(event)") <
    cameraWheel.indexOf("markWorkshopManualCameraOverride"));
});

test("routes Assistant wheel and trackpad input to native contained scrolling", () => {
  assert.match(cameraWheel, /event\.target\.closest\("#workshopMeasurementAssistant"\)/);
  assert.match(source, /#workshopMeasurementAssistant\{[\s\S]*?overflow-y:auto;[\s\S]*?overscroll-behavior:contain;/);
});

test("preserves camera zoom direction, bounds, and calculations", () => {
  assert.match(cameraWheel, /event\.deltaY < 0[\s\S]*?cameraDistance -= 0\.5/);
  assert.match(cameraWheel, /event\.deltaY > 0[\s\S]*?cameraDistance \+= 0\.5/);
  assert.match(cameraWheel, /cameraDistance < 6/);
  assert.match(cameraWheel, /workshopMode[\s\S]*?\? 80 : 50/);
  assert.match(cameraWheel, /updateCamera\(\)/);
});

test("requires fresh Workshop canvas intent without changing Mission routing", () => {
  assert.match(source, /let workshopBuildViewportWheelIntentArmed = false;/);
  assert.match(source, /function workshopWheelEventTargetsBuildViewport\(event\)/);
  assert.match(source, /event\.target !== renderer\.domElement/);
  assert.match(source,
    /function workshopBuildViewportOwnsWheel\(event\)[\s\S]*?!document\.body\.classList\.contains\("workshopMode"\)\) return true;/);
  assert.match(source,
    /function moveWorkshopPrecisionCursor\(event\)[\s\S]*?armWorkshopBuildViewportWheelIntent\(event\)/);
  assert.equal((source.match(/document\.addEventListener\(['"]wheel['"]/g) || []).length, 1);
});
