import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const handler = source.match(
  /function handleWorkshopToolChestOutsidePointerDown\(event\)\{[\s\S]*?\n  \}/,
)?.[0] || "";

test("valid build-viewport pointer input retains the expanded Tool Chest", () => {
  assert.match(handler, /if\(workshopPointerIsOverBuildViewport\(event\)\) return;/);
  assert.ok(
    handler.indexOf("workshopPointerIsOverBuildViewport(event)") <
      handler.indexOf("requestEngineeringToolChestCabinetRetraction()"),
  );
});

test("non-build canvas input retains the canonical outside-close path", () => {
  assert.match(handler, /event\.target!==renderer\.domElement/);
  assert.match(handler, /requestEngineeringToolChestCabinetRetraction\(\)/);
  assert.doesNotMatch(handler, /setEngineeringToolChestCabinetState\("retracted"\)/);
  assert.doesNotMatch(handler, /preventDefault|stopPropagation|setTimeout|setInterval/);
});

test("the existing single capture listener remains the only outside-pointer owner", () => {
  assert.equal((source.match(/handleWorkshopToolChestOutsidePointerDown,/g) || []).length, 1);
  assert.match(source, /document\.addEventListener\(\s*"pointerdown",\s*handleWorkshopToolChestOutsidePointerDown,\s*true\s*\)/);
});

test("shape and Parts and Objects activation paths remain isolated from retraction", () => {
  assert.match(source, /if\(tile\.dataset\.engineeringObjectAction==="build-shape"\)\{\s*chooseWorkshopBuildShape/);
  assert.match(source, /toolChest\.addEventListener\("click",function\(event\)\{[\s\S]*?event\.stopPropagation\(\)/);
  assert.match(source, /partsObjectsViewModule\.createToolChestPartsObjectsView/);
  assert.match(source, /partsObjectsAdapterModule\.createToolChestPartsObjectsAdapter/);
});

test("the established Builder click placement pipeline remains authoritative", () => {
  assert.match(source, /document\.addEventListener\('click', \(event\)=>\{[\s\S]*?raycaster\.setFromCamera\(mouse, camera\)/);
  assert.match(source, /const newBlock = createStudentShape\([\s\S]*?scene\.add\(newBlock\);\s*blocks\.push\(newBlock\);/);
});
