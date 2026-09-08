import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function listenerSource(type) {
  const marker = `document.addEventListener('${type}', (event)=>{`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${type} listener must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${type} listener has no balanced closing brace`);
}

test("Workshop canvas press records intent without clearing bounded Home", () => {
  const mousedown = listenerSource("mousedown");
  assert.match(source, /const WORKSHOP_CANVAS_ORBIT_DRAG_THRESHOLD = 4;/);
  assert.match(mousedown, /event\.target !== renderer\.domElement/);
  assert.match(mousedown, /workshopCanvasOrbitStartX = event\.clientX/);
  assert.match(mousedown, /workshopCanvasOrbitStartY = event\.clientY/);
  assert.match(mousedown, /workshopCanvasOrbitPrepared = false/);
  assert.doesNotMatch(mousedown, /clearWorkshopEngineeringView/);
});

test("only threshold-crossing Workshop movement acquires orbit ownership", () => {
  const mousemove = listenerSource("mousemove");
  const threshold = mousemove.indexOf(
    "orbitDistance < WORKSHOP_CANVAS_ORBIT_DRAG_THRESHOLD",
  );
  const prepare = mousemove.indexOf("workshopCanvasOrbitPrepared = true");
  const clear = mousemove.indexOf("window.clearWorkshopEngineeringView()");
  const camera = mousemove.indexOf("cameraAngle += changeX * 0.01");
  assert.ok(threshold >= 0);
  assert.ok(threshold < prepare);
  assert.ok(prepare < clear);
  assert.ok(clear < camera);
  assert.match(mousemove, /if\(orbitDistance < WORKSHOP_CANVAS_ORBIT_DRAG_THRESHOLD\)\{\s*return;/);
  assert.match(mousemove, /!workshopCanvasOrbitPrepared/);
  assert.equal(
    (mousemove.match(/clearWorkshopEngineeringView/g) || []).length,
    2,
    "one availability guard and one clear call remain in the single acquisition path",
  );
});

test("Mission retains the existing orbit path and semantic clicks remain gated", () => {
  const mousemove = listenerSource("mousemove");
  assert.match(mousemove,
    /if\(document\.body\.classList\.contains\("workshopMode"\) &&[\s\S]*?!workshopCanvasOrbitPrepared\)/);
  assert.match(mousemove, /mouseMoved = true;[\s\S]*?updateCamera\(\)/);
  assert.match(source,
    /document\.addEventListener\('click',[\s\S]*?if\(mouseMoved\) return;/);
});

test("mouseup releases pending orbit ownership without changing click behavior", () => {
  const mouseupStart = source.indexOf("document.addEventListener('mouseup', ()=>{");
  const mouseupEnd = source.indexOf("document.addEventListener(\"keydown\"", mouseupStart);
  const mouseup = source.slice(mouseupStart, mouseupEnd);
  assert.match(mouseup, /isDragging = false/);
  assert.match(mouseup, /workshopCanvasOrbitPrepared = false/);
  assert.match(mouseup, /setTimeout\(\(\)=>\{\s*mouseMoved = false;/);
});
