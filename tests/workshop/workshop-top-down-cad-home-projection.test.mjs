import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

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

test("Home uses the existing PerspectiveCamera with no second camera architecture", () => {
  assert.equal((source.match(/new THREE\.PerspectiveCamera\(/g) || []).length >= 1, true);
  assert.equal((source.match(/new THREE\.OrthographicCamera\(/g) || []).length, 0);
  assert.equal((source.match(/renderer\.render\(scene, camera\)/g) || []).length, 1);
});

test("Home camera is exactly perpendicular with deterministic negative-Z screen up", () => {
  const apply = functionSource("applyWorkshopEngineeringView");
  const home = apply.slice(0, apply.indexOf("var definition="));
  assert.match(home, /activeWorkshopEngineeringView==="home"/);
  assert.match(home, /camera\.position\.set\([\s\S]*?activeWorkshopEngineeringTarget\.x,[\s\S]*?cameraHeight,[\s\S]*?activeWorkshopEngineeringTarget\.z/);
  assert.match(home, /camera\.up\.set\(0,0,-1\)/);
  assert.match(home, /camera\.lookAt\(activeWorkshopEngineeringTarget\)/);
  assert.doesNotMatch(home, /cameraAngle/);
});

test("Home keeps camera, Grid, rulers, boundary, and zoom baseline in one settlement", () => {
  const apply = functionSource("applyResponsiveWorkshopHomeView");
  const grid = apply.indexOf("applyWorkshopCadGridPresentation(workshopHomeGridWorkspace,false)");
  const rulers = apply.indexOf("setWorkshopVisibleRulerRange(workshopHomeGridWorkspace)");
  const boundary = apply.indexOf("commitWorkshopActiveWorkspaceBoundary(workshopHomeGridWorkspace,\"HOME\")");
  const camera = apply.indexOf("updateCamera()");
  const baseline = apply.indexOf("captureZoomBaseline(");
  assert.ok(grid >= 0 && rulers > grid && boundary > rulers);
  assert.ok(camera > boundary && baseline > camera);
  assert.doesNotMatch(apply, /restoreWorkshopFullCadGrid|clearWorkshopVisibleRulerRange/);
});

test("directional definitions and Fit remain separate from Home projection", () => {
  assert.match(source, /front:\{position:\[0,0,1\],up:\[0,1,0\]\}/);
  assert.match(source, /back:\{position:\[0,0,-1\],up:\[0,1,0\]\}/);
  assert.match(source, /left:\{position:\[-1,0,0\],up:\[0,1,0\]\}/);
  assert.match(source, /right:\{position:\[1,0,0\],up:\[0,1,0\]\}/);
  assert.match(source, /top:\{position:\[0,1,0\],up:\[0,0,-1\]\}/);
  assert.match(source, /bottom:\{position:\[0,-1,0\],up:\[0,0,1\]\}/);
  assert.doesNotMatch(functionSource("fitWorkshopSelection"), /perpendicular/);
});
