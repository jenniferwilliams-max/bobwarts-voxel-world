import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("feedback does not recalculate Measurement Assistant values", () => {
  const start = source.indexOf("function updateWorkshopMeasurementAssistant");
  const end = source.indexOf("function clearWorkshopRulerSelectionHighlight", start);
  const measurement = source.slice(start, end);
  assert.match(measurement, /formatWorkshopMeasurement\(selectedBounds\.width\)/);
  assert.match(measurement, /formatWorkshopMeasurement\(selectedBounds\.length\)/);
  assert.match(measurement, /formatWorkshopMeasurement\(selectedBounds\.height\)/);
  assert.doesNotMatch(measurement, /workshopCadEngineeringFeedbackView/);
});

test("presentation reset follows canonical boundary cleanup", () => {
  const start = source.indexOf("function resetWorkshopActiveWorkspaceBoundary");
  const end = source.indexOf("function syncWorkshopCadEngineeringFeedback", start);
  assert.match(source.slice(start, end), /workshopCadEngineeringFeedbackView\.reset\(\)/);
  assert.match(source, /snapshot\.workshop==="SHUTTING_DOWN"[\s\S]*?resetWorkshopActiveWorkspaceBoundary\(\)/);
  assert.match(source, /snapshot\.workshop==="FAULT_SAFE"[\s\S]*?resetWorkshopActiveWorkspaceBoundary\(\)/);
});

test("placement snapping raycasting and save ownership remain separate", () => {
  assert.match(source, /function getWorkshopSnapIncrement\(\)/);
  assert.match(source, /function snapWorkshopValue\(value,offset\)/);
  assert.match(source, /engineeringGrid\.raycast = function\(\)\{\}/);
  assert.doesNotMatch(source, /workshopCadEngineeringFeedbackView\.(place|move|snap|raycast|save)/);
});
