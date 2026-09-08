import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("user retraction closes the canonical active drawer before cabinet movement", () => {
  const request = source.match(/function requestEngineeringToolChestCabinetRetraction\(\)\{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(request, /getSnapshot\(\)/);
  assert.match(request, /snapshot\.activeDrawer/);
  assert.match(request, /action:"CLOSE_DRAWER"/);
  assert.match(request, /engineeringToolChestPendingRetraction=/);
  assert.match(request, /if\(!logicalId\)\{\s*setEngineeringToolChestCabinetState\("retracted"\);\s*return true;\s*\}[\s\S]*?engineeringToolChestPendingRetraction=[\s\S]*?action:"CLOSE_DRAWER"/);
  assert.doesNotMatch(request.slice(request.indexOf("var token=")), /setEngineeringToolChestCabinetState\("retracted"\)/);
});

test("rendered drawer close completion is the sole gate to pending cabinet retraction", () => {
  const finish = source.match(/function finishEngineeringToolChestPendingRetraction\(drawerName\)\{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(finish, /pending\.token!==engineeringToolChestRetractionToken/);
  assert.match(finish, /snapshot\.activeDrawer!==null/);
  assert.match(finish, /snapshot\.drawers\[pending\.logicalId\]!=="CLOSED"/);
  assert.match(finish, /setEngineeringToolChestCabinetState\("retracted"\)/);
  assert.match(source, /var completionAccepted=complete\(\);[\s\S]*?finishEngineeringToolChestPendingRetraction\(drawerName\)/);
});

test("handle reversal, reset, and lifecycle state changes invalidate pending retraction", () => {
  assert.match(source, /function clearEngineeringToolChestPendingRetraction\(\)\{[\s\S]*?engineeringToolChestRetractionToken\+=1;[\s\S]*?engineeringToolChestPendingRetraction=null;/);
  assert.match(source, /if\(engineeringToolChestPendingRetraction\)\{\s*clearEngineeringToolChestPendingRetraction\(\);\s*return;/);
  assert.match(source, /function resetEngineeringToolChest\(\)\{\s*clearEngineeringToolChestDrawerSwitch\(\);\s*clearEngineeringToolChestPendingRetraction\(\);/);
  assert.match(source, /requestedState==="expanded"\) clearEngineeringToolChestPendingRetraction\(\)/);
  assert.match(source, /snapshot\.workshop!=="READY"\)\{\s*clearEngineeringToolChestDrawerSwitch\(\);\s*clearEngineeringToolChestPendingRetraction\(\);/);
});

test("handle and outside-canvas closing share the canonical retraction path", () => {
  assert.equal((source.match(/requestEngineeringToolChestCabinetRetraction\(\);/g) || []).length >= 2, true);
  const outside = source.match(/function handleWorkshopToolChestOutsidePointerDown\(event\)\{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(outside, /requestEngineeringToolChestCabinetRetraction\(\)/);
  assert.doesNotMatch(outside, /setEngineeringToolChestCabinetState\("retracted"\)/);
});

test("the imported canonical drawer map supplies the browser reverse lookup", () => {
  assert.match(source, /Object\.keys\(module\.WORKSHOP_UI_DRAWER_MAP \|\| \{\}\)/);
  assert.match(source, /workshopDrawerUiByLogicalId\[module\.WORKSHOP_UI_DRAWER_MAP\[uiDrawer\]\]=uiDrawer/);
});
