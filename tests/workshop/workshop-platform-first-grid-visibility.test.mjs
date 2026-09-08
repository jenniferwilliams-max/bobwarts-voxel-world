import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const activeViewSource = fs.readFileSync(
  new URL("../../js/workshop/table/table-projection-active-view.mjs", import.meta.url),
  "utf8",
);

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} has no balanced closing brace`);
}

function visibilityHarness({
  mode = "workshop",
  workshopClass = true,
  tablePresentation = false,
  tableVisible = false,
  width = 1366,
  height = 768,
  devicePixelRatio = 1,
} = {}) {
  const context = {
    currentWorkspaceMode: mode,
    workshopClassroomTablePresentationEnabled: tablePresentation,
    workshopPoweredOffTableCompositor: { visible: tableVisible },
    window: { innerWidth: width, innerHeight: height, devicePixelRatio },
    document: {
      body: {
        classList: { contains: (name) => name === "workshopMode" && workshopClass },
      },
    },
  };
  vm.runInNewContext(
    `${functionSource("getWorkshopGridPresentationHostVisible")};` +
      "this.read=getWorkshopGridPresentationHostVisible",
    context,
  );
  return context.read();
}

test("platform-first Grid remains available when obsolete Table registration hides", () => {
  assert.equal(visibilityHarness({ tableVisible: false }), true);
  assert.equal(visibilityHarness({ tableVisible: true }), true);
});

test("Mac and Chromebook-responsive dimensions do not gate platform-first Grid", () => {
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 600]]) {
    assert.equal(visibilityHarness({ width, height, tableVisible: false }), true,
      `${width}x${height}`);
  }
});

test("device-pixel ratio does not alter logical Grid availability", () => {
  for (const devicePixelRatio of [1, 1.25, 1.5, 2]) {
    assert.equal(visibilityHarness({ devicePixelRatio, tableVisible: false }), true,
      `DPR ${devicePixelRatio}`);
  }
});

test("Mission and inactive Workshop presentation fail closed", () => {
  assert.equal(visibilityHarness({ mode: "mission" }), false);
  assert.equal(visibilityHarness({ workshopClass: false }), false);
});

test("legacy Table presentation still honors responsive registration", () => {
  assert.equal(visibilityHarness({ tablePresentation: true, tableVisible: false }), false);
  assert.equal(visibilityHarness({ tablePresentation: true, tableVisible: true }), true);
});

test("active lifecycle remains the sole scalar and final visibility owner", () => {
  assert.match(source,
    /createTableProjectionActiveView\([\s\S]*?applyGridScalar:applyWorkshopProjectionGridScalar,[\s\S]*?applyGridVisibility:setWorkshopProjectionGridVisible/);
  assert.match(source,
    /function setWorkshopProjectionGridVisible\(value\)[\s\S]*?engineeringGrid\.visible=value===true &&[\s\S]*?currentWorkspaceMode==="workshop"/);
  assert.match(activeViewSource,
    /enterFaultSafe\([\s\S]*?applyGridVisibility\(false\)/);
});
