import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `expected ${start} before ${end}`);
  return source.slice(startIndex, endIndex);
}

test("accepted startup establishes the Workshop shell before Projector power", () => {
  const driver = between(
    "powerOnProjector:function(transition){",
    "powerOnTable:function(transition){",
  );
  const accepted = driver.indexOf("transition.begin()");
  const shell = driver.indexOf("applyWorkspaceModeVisuals(");
  const projector = driver.indexOf("workshopProjectorPowerOnView.start(");
  assert.ok(accepted >= 0 && accepted < shell && shell < projector);
  assert.match(driver, /deferProjectionStart:true/);
});

test("early Workshop shell holds Projection primitives at zero", () => {
  const buildArea = between(
    "function applyWorkshopBuildAreaVisuals(workshopIsActive,onComplete,options){",
    "function applyWorkspaceModeVisuals(requestedMode,onComplete,options){",
  );
  assert.match(buildArea, /if\(deferProjectionStart\)\{[\s\S]*applyWorkshopProjectionProgress\(0\);[\s\S]*return;/);
});

test("WS-013 starts Projection without re-entering the visual shell", () => {
  const driver = between(
    "startTableProjection:function(transition){",
    "startProjectorProjection:function(transition){",
  );
  assert.match(driver, /startWorkshopProjectionVisuals\(\);/);
  assert.doesNotMatch(driver, /applyWorkspaceModeVisuals/);
});
