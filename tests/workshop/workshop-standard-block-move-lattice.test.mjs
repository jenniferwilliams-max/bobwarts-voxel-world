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

function createHarness(unit = "cm"){
  const context = vm.createContext({
    document:{ body:{ classList:{ contains:() => true } } },
    window:{
      snapWorkshopValue(value){
        const increment = unit === "mm" ? 0.1 : 1;
        return Number((Math.round(value / increment) * increment).toFixed(4));
      }
    }
  });
  vm.runInContext([
    extractFunction("workshopPrecisionSnappingActive"),
    extractFunction("snapGroundBuildCoordinate"),
    extractFunction("isStandardWorkshopBlock"),
    extractFunction("getWorkshopCoordinateLatticePhase"),
    extractFunction("snapWorkshopValueToLatticePhase"),
    extractFunction("snapStandardWorkshopBlockGroundCenter"),
    extractFunction("calculateWorkshopMoveTranslation")
  ].join("\n"), context);
  return context;
}

function block(shape, x, z){
  return { userData:{ builderShape:shape }, position:{ x, z } };
}

test("placement and movement share one standard-block predicate", () => {
  assert.match(source, /const standardWorkshopBlock = isStandardWorkshopBlock\(newBlock\);/);
  assert.match(source, /selectedObjects\.filter\(isStandardWorkshopBlock\)/);
  const harness = createHarness("mm");
  for(const shape of ["cube", "sphere", "trianglePrism"]){
    assert.equal(harness.isStandardWorkshopBlock(block(shape, 0, 0)), true);
  }
  assert.equal(harness.isStandardWorkshopBlock(block("precisionPart", 0, 0)), false);
});

test("standard-block selections use one whole-centimeter delta in CM and MM", () => {
  for(const unit of ["cm", "mm"]){
    const harness = createHarness(unit);
    const selected = [block("cube", 0, 0), block("sphere", 2, 1)];
    const movement = harness.calculateWorkshopMoveTranslation(selected, { x:3.4, z:-2.6 });
    assert.deepEqual(
      JSON.parse(JSON.stringify(movement)),
      { changeX:3, changeZ:-3, containsStandardObjects:true }
    );
    const moved = selected.map(item => ({
      x:item.position.x + movement.changeX,
      z:item.position.z + movement.changeZ
    }));
    assert.deepEqual(moved, [{ x:3, z:-3 }, { x:5, z:-2 }]);
  }
});

test("a shared delta preserves connected and mixed-selection geometry", () => {
  const harness = createHarness("mm");
  const selected = [
    block("cube", 1, 2),
    block("precisionPart", 1.25, 2.4)
  ];
  const beforeOffset = {
    x:selected[1].position.x - selected[0].position.x,
    z:selected[1].position.z - selected[0].position.z
  };
  const movement = harness.calculateWorkshopMoveTranslation(selected, { x:4.3, z:5.4 });
  const moved = selected.map(item => ({
    x:item.position.x + movement.changeX,
    z:item.position.z + movement.changeZ
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(movement)),
    { changeX:3, changeZ:3, containsStandardObjects:true }
  );
  assert.ok(Math.abs((moved[1].x - moved[0].x) - beforeOffset.x) < 1e-9);
  assert.ok(Math.abs((moved[1].z - moved[0].z) - beforeOffset.z) < 1e-9);
});

test("movement preserves half-integer and historical fractional lattice phases", () => {
  const harness = createHarness("mm");
  for(const fixture of [
    { start:0.5, point:4.2, expectedTarget:4.5 },
    { start:0, point:4.2, expectedTarget:4 },
    { start:0.3, point:4.2, expectedTarget:4.3 }
  ]){
    const selected = [block("cube", fixture.start, fixture.start)];
    const movement = harness.calculateWorkshopMoveTranslation(selected, {
      x:fixture.point,
      z:fixture.point
    });
    assert.equal(
      Number((selected[0].position.x + movement.changeX).toFixed(4)),
      fixture.expectedTarget
    );
    assert.equal(
      Number((selected[0].position.z + movement.changeZ).toFixed(4)),
      fixture.expectedTarget
    );
  }
});

test("movement preserves the selected grab point offset", () => {
  const harness=createHarness("cm");
  const selected=[block("cube",1,2),block("cube",2,2)];
  const movement=harness.calculateWorkshopMoveTranslation(
    selected,
    {x:8.25,z:6.5},
    {x:0.25,z:0.5}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(movement)),
    {changeX:7,changeZ:4,containsStandardObjects:true}
  );
});

test("nonstandard-only selections retain active CM/MM precision", () => {
  const mm = createHarness("mm");
  const cm = createHarness("cm");
  const selected = [block("precisionPart", 0.2, -0.2)];
  assert.deepEqual(
    JSON.parse(JSON.stringify(mm.calculateWorkshopMoveTranslation(selected, { x:2.36, z:-3.74 }))),
    { changeX:2.2, changeZ:-3.5, containsStandardObjects:false }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(cm.calculateWorkshopMoveTranslation(selected, { x:2.36, z:-3.74 }))),
    { changeX:2, changeZ:-4, containsStandardObjects:false }
  );
});

test("movement does not migrate objects until the canonical move branch runs", () => {
  const movementStart = source.indexOf("if(moveSelectedMode && hit === ground)");
  const movementEnd = source.indexOf("const newBlock = createStudentShape", movementStart);
  const movementBranch = source.slice(movementStart, movementEnd);
  assert.doesNotMatch(movementBranch, /Math\.round\(block\.position/);
  assert.match(movementBranch, /block\.position\.x = Number\(\(block\.position\.x \+ changeX\)\.toFixed\(4\)\);/);
  assert.match(movementBranch, /block\.position\.z = Number\(\(block\.position\.z \+ changeZ\)\.toFixed\(4\)\);/);
});

test("mouse and compatibility-touch placement retain the single click/raycast path", () => {
  assert.match(source, /document\.addEventListener\('click', \(event\)=>\{[\s\S]*?raycaster\.setFromCamera\(mouse, camera\);[\s\S]*?calculateWorkshopPlacementCandidate/);
  assert.equal((source.match(/document\.addEventListener\('click', \(event\)=>\{/g) || []).length, 1);
});
