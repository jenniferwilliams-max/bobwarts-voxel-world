import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const tableSource = await readFile(
  new URL("../../js/workshop/table/powered-off-table-view.mjs", import.meta.url),
  "utf8",
);

test("keeps the canonical world surface and Grid coordinates unchanged", () => {
  assert.match(source, /new THREE\.BoxGeometry\(50, 1, 50\)/);
  assert.match(source, /ground\.position\.y = -1/);
  assert.match(source, /engineeringGrid\.position\.y = -0\.498/);
  assert.match(source, /engineeringGrid\.raycast = function\(\)\{\}/);
});

test("updates edge presentation through the existing ruler frame loop", () => {
  assert.match(source, /function syncWorkshopUnifiedWorkstationView\(\)/);
  assert.match(source, /syncWorkshopUnifiedWorkstationView\(\);[\s\S]*?return true/);
  assert.match(source, /clearWorkshopProjectedRulerBounds\(\)[\s\S]*?workshopUnifiedWorkstationView\.reset\(\)/);
});

test("preserves stable Home Table compositor and bounded student pass", () => {
  assert.match(source, /getRegistrationBounds:getWorkshopTableHomeRegistrationBounds/);
  assert.match(tableSource, /camera\.add\(rearMesh\)/);
  assert.match(tableSource, /camera\.layers\.set\(WORKSHOP_STUDENT_COMPOSITE_LAYER\)/);
  assert.match(tableSource, /Camera changed during the bounded Table final student pass/);
  assert.doesNotMatch(tableSource, /unified-workstation-view/);
});

test("does not add prohibited integration or asset behavior", () => {
  const viewImportCount = (source.match(/workshop-unified-workstation-view\.mjs/g) || []).length;
  assert.equal(viewImportCount, 1);
  assert.doesNotMatch(source, /perspectiveWarp|directionalTableAsset|integratedProjector/);
});
