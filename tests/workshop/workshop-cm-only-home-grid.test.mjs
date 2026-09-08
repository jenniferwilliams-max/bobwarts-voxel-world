import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateWorkshopCadGridPresentation,
} from "../../js/workshop/runtime/workshop-cad-workspace-presentation.mjs";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("default Home is exactly twenty one-centimeter cells by twenty", () => {
  const presentation = calculateWorkshopCadGridPresentation({
    workspace: { xMin: -10, xMax: 10, zMin: -10, zMax: 10 },
  });
  assert.deepEqual(presentation.bounds, {
    xMin: -10, xMax: 10, zMin: -10, zMax: 10,
  });
  assert.deepEqual(presentation.cells, { columns: 20, rows: 20 });
  assert.deepEqual(presentation.boundaries, { vertical: 21, horizontal: 21 });
  assert.equal(presentation.positions.minor.length / 6, 32);
  assert.equal(presentation.positions.major.length / 6, 8);
  assert.equal(presentation.positions.origin.length / 6, 2);
});

test("Home ruler presentation has twenty one ticks and five real-coordinate labels", () => {
  assert.match(source, /var subdivisions=centimeterOnly\s*\? 1/);
  assert.match(source, /var isLandmark=isMajor && Math\.abs\(value%5\)<1e-8/);
  assert.match(source, /if\(isMajor && \(!centimeterOnly \|\| isLandmark\)\)/);
  assert.match(source, /label\.textContent=normalizedValue>0\s*\? "\+"\+normalizedValue/);
  assert.doesNotMatch(
    source.slice(
      source.indexOf("function renderWorkshopRulerTicks"),
      source.indexOf("function renderWorkshopRulers"),
    ),
    /centimeterOnly[\s\S]*?subdivisions=10/,
  );
});

test("precision truth remains available outside bounded Home presentation", () => {
  assert.match(source, /millimetersPerCentimeter:10/);
  assert.match(source, /millimetersPerGridCell:10/);
  assert.match(source, /Engineering precision is one millimeter within each cell/);
  assert.match(source, /centimeterOnly\s*\? 1\s*:\s*workshopRulerConfig\.millimetersPerCentimeter/);
  assert.match(source, /restoreWorkshopFullCadGrid\(\)/);
});
