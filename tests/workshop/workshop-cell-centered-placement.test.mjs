import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function extractFunction(name){
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for(let index = bodyStart; index < source.length; index += 1){
    if(source[index] === "{") depth += 1;
    if(source[index] === "}"){
      depth -= 1;
      if(depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

const context = vm.createContext({});
vm.runInContext([
  extractFunction("getWorkshopCoordinateLatticePhase"),
  extractFunction("snapWorkshopValueToLatticePhase"),
  extractFunction("snapStandardWorkshopBlockGroundCenter")
].join("\n"), context);

test("standard ground centers occupy real integer-bounded cells", () => {
  for(const fixture of [
    { hit:-24.99, center:-24.5 },
    { hit:-10, center:-9.5 },
    { hit:-0.01, center:-0.5 },
    { hit:0, center:0.5 },
    { hit:9.99, center:9.5 },
    { hit:24.99, center:24.5 }
  ]){
    const center = context.snapStandardWorkshopBlockGroundCenter(fixture.hit);
    assert.equal(center, fixture.center);
    assert.equal(center - 0.5, Math.floor(center));
    assert.equal(center + 0.5, Math.floor(center) + 1);
  }
});

test("platform-edge placement clamps complete blocks inside canonical bounds", () => {
  assert.equal(context.snapStandardWorkshopBlockGroundCenter(-25), -24.5);
  assert.equal(context.snapStandardWorkshopBlockGroundCenter(25), 24.5);
  assert.equal(context.snapStandardWorkshopBlockGroundCenter(-100), -24.5);
  assert.equal(context.snapStandardWorkshopBlockGroundCenter(100), 24.5);
});

test("ground placement changes X and Z only and preserves calculated Y", () => {
  const placement = extractFunction("calculateWorkshopPlacementCandidate");
  assert.match(placement, /snapStandardWorkshopBlockGroundCenter\(intersection\.point\.x\)/);
  assert.match(placement, /groundBounds\.max\.y \+ halfSize\.y/);
  assert.match(placement, /snapStandardWorkshopBlockGroundCenter\(intersection\.point\.z\)/);
  assert.match(placement, /if\(!standardWorkshopBlock\)\{[\s\S]*?\["x","y","z"\]/);
});

test("CM and MM share the same standard-block cell-center helper", () => {
  const placement = extractFunction("calculateWorkshopPlacementCandidate");
  assert.match(placement, /const standardWorkshopBlock = isStandardWorkshopBlock\(newBlock\)/);
  assert.match(placement, /const increment = standardWorkshopBlock \? 1 : window\.getWorkshopSnapIncrement\(\)/);
  assert.equal((placement.match(/snapStandardWorkshopBlockGroundCenter/g) || []).length, 2);
});

test("face alignment inherits the contacted object's real lattice phase", () => {
  for(const offset of [0, 0.5, 0.3, -1.5]){
    const phase = context.getWorkshopCoordinateLatticePhase(offset);
    const snapped = context.snapWorkshopValueToLatticePhase(4.18, phase);
    assert.ok(Math.abs(context.getWorkshopCoordinateLatticePhase(snapped) - phase) < 1e-9);
  }
  const placement = extractFunction("calculateWorkshopPlacementCandidate");
  assert.match(placement, /alignmentOffset = \{[\s\S]*?x:contactedCenter\.x[\s\S]*?y:contactedCenter\.y[\s\S]*?z:contactedCenter\.z/);
  assert.match(placement, /snapWorkshopValueToLatticePhase\([\s\S]*?getWorkshopCoordinateLatticePhase\(offset\)/);
  assert.match(placement, /hitBounds\.max\[contactAxis\] \+ halfSize\[contactAxis\]/);
  assert.match(placement, /hitBounds\.min\[contactAxis\] - halfSize\[contactAxis\]/);
});

test("canonical Grid and bounded Home coordinate truth remain unchanged", () => {
  assert.match(source, /const gridHalfSize = 25;/);
  assert.match(source, /let gridBoundary = -gridHalfSize;/);
  assert.match(source, /gridBoundary <= gridHalfSize;/);
  const boundaries = Array.from({ length:51 }, (_, index) => index - 25);
  assert.equal(boundaries.filter(value => value >= -10 && value <= 10).length, 21);
});
