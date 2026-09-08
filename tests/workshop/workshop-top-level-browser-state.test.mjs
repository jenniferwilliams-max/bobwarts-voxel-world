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

test("browser distinguishes host presentation from canonical Workshop lifecycle", () => {
  const declarations = between(
    "var currentWorkspaceMode=\"mission\";",
    "function getWorkshopStartupStatusElement(){",
  );
  assert.match(declarations, /Host-only asset\/presentation state/);
  assert.match(declarations, /var workshopStartupState="OFF";/);
  assert.match(declarations, /var workshopCanonicalState="OFF";/);
});

test("controller state callback is the sole canonical presentation bridge", () => {
  const sync = between(
    "function syncWorkshopControllerPresentation(snapshot){",
    "function workshopStartupDependenciesReady(){",
  );
  for (const state of ["STARTING", "READY", "SHUTTING_DOWN", "FAULT_SAFE", "OFF"]) {
    assert.match(sync, new RegExp(`snapshot\\.workshop===\"${state}\"`));
  }
  const creation = between(
    "workshopControllerReady=Promise.all([",
    "drivers:{",
  );
  assert.match(creation, /stateChanged:syncWorkshopControllerPresentation/);
  assert.doesNotMatch(creation, /eventName===\"workshop:ready\"/);
  assert.doesNotMatch(creation, /eventName===\"workshop:off\"/);
});

test("power and reversal routing consult canonical state", () => {
  const routing = between(
    "function requestWorkshopPowerOn(){",
    "function stopBuilderClickThrough(element){",
  );
  assert.match(routing, /workshopCanonicalState===\"STARTING\"/);
  assert.match(routing, /workshopCanonicalState===\"SHUTTING_DOWN\"/);
  assert.doesNotMatch(routing, /setWorkshopStartupState\(\"STARTING\"/);
  assert.doesNotMatch(routing, /setWorkshopStartupState\(\"STOPPING\"/);
});
