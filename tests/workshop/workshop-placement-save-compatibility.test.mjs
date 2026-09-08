import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function section(startText, endText){
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `missing ${startText}`);
  const end = source.indexOf(endText, start + startText.length);
  assert.notEqual(end, -1, `missing ${endText}`);
  return source.slice(start, end);
}

test("download saves and loads raw coordinates without lattice migration", () => {
  const save = section("function saveWorld(){", "document.getElementById('loadFile')");
  const load = section("document.getElementById('loadFile')\n.addEventListener", "function setMoonEnvironment");
  assert.match(save, /x: block\.position\.x,[\s\S]*?y: block\.position\.y,[\s\S]*?z: block\.position\.z/);
  assert.match(load, /addBlock\(\s*data\.x,\s*data\.y,\s*data\.z,/);
  assert.doesNotMatch(load, /snapStandardWorkshopBlockGroundCenter|snapWorkshopValueToLatticePhase|Math\.round\(data\.[xyz]\)/);
});

test("autosave preserves integer, half-integer, and fractional coordinates exactly", () => {
  const autosave = section(
    '<script id="studentAutosaveAndCalmModeScript">',
    "</script>"
  );
  assert.match(autosave, /x:block\.position\.x, y:block\.position\.y, z:block\.position\.z/);
  assert.match(autosave, /addBlock\(data\.x, data\.y, data\.z,/);
  assert.doesNotMatch(autosave, /snapStandardWorkshopBlockGroundCenter|snapWorkshopValueToLatticePhase|Math\.round\(data\.[xyz]\)/);

  const coordinates = [
    { x:2, y:0, z:-4 },
    { x:2.5, y:0, z:-4.5 },
    { x:2.3, y:0.2, z:-4.7 }
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(coordinates)), coordinates);
});

test("unit switching changes presentation state but never object coordinates", () => {
  const unit = section("function setWorkshopMeasurementUnit(unit){", "var workshopEngineeringViewDirections");
  assert.doesNotMatch(unit, /blocks\s*\.|blocks\[|block\.position|addBlock|snapStandardWorkshopBlockGroundCenter/);
  assert.match(unit, /workshopMeasurementUnit=requestedUnit/);
});

test("save schema remains version 3 with no required lattice metadata", () => {
  const save = section("function saveWorld(){", "document.getElementById('loadFile')");
  assert.match(save, /version: 3/);
  assert.doesNotMatch(save, /latticePhase|snapLattice|cellCentered/);
});

test("Measurement remains bounds-derived rather than lattice-derived", () => {
  const measurement = section("function refreshWorkshopRulerSelectionHighlight(){", "function setWorkshopRulerSelectedObjects");
  assert.match(measurement, /new THREE\.Box3/);
  assert.match(measurement, /bounds\.expandByObject\(object\)/);
  assert.doesNotMatch(measurement, /snapStandardWorkshopBlockGroundCenter|snapWorkshopValueToLatticePhase/);
});

test("Resize reuses exact BoxGeometry dimensions without save schema changes", () => {
  assert.match(source,/sx: block\.geometry\.parameters\.width \|\| 1/);
  assert.match(source,/sy: block\.geometry\.parameters\.height \|\| 1/);
  assert.match(source,/sz: block\.geometry\.parameters\.depth \|\| 1/);
  assert.match(source,/sx:parameters\.width \|\| 1, sy:parameters\.height \|\| 1, sz:parameters\.depth \|\| 1/);
  assert.doesNotMatch(source,/resizeWidth|resizeHeight|resizeDepth|saveVersion:4/);
});
