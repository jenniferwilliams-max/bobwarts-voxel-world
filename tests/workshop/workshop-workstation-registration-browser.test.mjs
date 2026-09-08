import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("loads one shared workstation registration contract", () => {
  const imports = source.match(/import\("\.\/js\/workshop\/runtime\/workshop-workstation-registration\.mjs"\)/g) || [];
  assert.equal(imports.length, 2);
  assert.match(source, /configureWorkshopWorkstationCorners\(workstationRegistrationModule\)/);
  assert.match(source, /window\.getWorkshopWorkstationRegistration=function\(\)/);
});

test("uses the canonical corner set for live rulers and stable Home registration", () => {
  assert.match(source, /module\.WORKSHOP_WORKSTATION_WORLD_CORNERS\.map/);
  assert.match(source, /function projectWorkshopWorkstationBounds\(projectionCamera\)/);
  assert.match(source, /projectWorkshopWorkstationBounds\(camera\)/);
  assert.match(source, /projectWorkshopWorkstationBounds\(referenceCamera\)/);
  assert.doesNotMatch(source, /new THREE\.Vector3\(-25,-0\.485,-25\)/);
});

test("keeps stable Home Table registration independent of the live camera", () => {
  const homeStart = source.indexOf("function getWorkshopTableHomeRegistrationBounds()");
  const homeEnd = source.indexOf("function applyResponsiveWorkshopHomeView()", homeStart);
  const homeFunction = source.slice(homeStart, homeEnd);
  assert.match(homeFunction, /getWorkshopHomeCameraConfig\(\)/);
  assert.match(homeFunction, /workshopTableHomeRegistrationCamera/);
  assert.match(homeFunction, /projectWorkshopWorkstationBounds\(referenceCamera\)/);
  assert.doesNotMatch(homeFunction, /projectWorkshopWorkstationBounds\(camera\)/);
});

test("preserves the physical platform and Grid elevations", () => {
  assert.match(source, /new THREE\.BoxGeometry\(50, 1, 50\)/);
  assert.match(source, /ground\.position\.y = -1/);
  assert.match(source, /engineeringGrid\.position\.y\s*=\s*-0\.498/);
});

test("exposes stable, live, protected-zone, and Table registration providers", () => {
  assert.match(source, /getStableHomeScreenBounds:getWorkshopTableHomeRegistrationBounds/);
  assert.match(source, /getLiveProjectedScreenBounds:function\(\)/);
  assert.match(source, /getLiveProjectedTabletop:function\(\)/);
  assert.match(source, /getProtectedBuildZone:function\(\)/);
  assert.match(source, /getTableRegistration:function\(\)/);
});

test("connects one isolated unified-surface view without changing Table ownership", () => {
  assert.match(source, /import\("\.\/js\/workshop\/runtime\/workshop-unified-workstation-view\.mjs"\)/);
  assert.match(source, /createWorkshopUnifiedWorkstationView\(\{/);
  assert.match(source, /top:document\.getElementById\("workshopRulerTop"\)/);
  assert.match(source, /engineeringGrid\.position\.y===-0\.498/);
  assert.match(source, /workshopPoweredOffTableCompositor\.registration/);
});
