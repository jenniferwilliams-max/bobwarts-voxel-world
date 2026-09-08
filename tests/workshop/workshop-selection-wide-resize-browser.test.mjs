import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../../index.html"),"utf8");

const functionSource=(name,nextName)=>{
  const start=source.indexOf(`function ${name}`);
  const end=nextName ? source.indexOf(`function ${nextName}`,start) : source.length;
  assert.notEqual(start,-1,`${name} must exist`);
  return source.slice(start,end);
};

test("runtime derives Resize from the complete authoritative selection",()=>{
  const resize=functionSource("resizeWorkshopSelection","rotateWorkshopSelectionRight");
  assert.match(resize,/const selection=activeWorkshopBlocks\(selectedBlocks\)/);
  assert.doesNotMatch(resize,/selection\.length!==1|selection\[0\]/);
  assert.match(resize,/entries:candidate\.entries/);
  assert.match(resize,/selection:selection\.slice\(\)/);
  assert.match(resize,/pivot:candidate\.pivot/);
});

test("runtime preflights every geometry, bound, collision, and workspace before mutation",()=>{
  const resize=functionSource("resizeWorkshopSelection","rotateWorkshopSelectionRight");
  const mutation=resize.indexOf("entry.object.geometry=candidateGeometry.geometry");
  for(const preflight of ["new THREE.BoxGeometry","createWorkshopResizedObjectBounds",
    "workshopBoundsFitActiveWorkspace","workshopBoundsOverlap",
    "workshopEditHistory.prepare"]){
    assert.ok(resize.indexOf(preflight)>-1 && resize.indexOf(preflight)<mutation,
      `${preflight} must precede mutation`);
  }
  assert.match(resize,/const selectedSet=new Set\(selection\)/);
  assert.match(resize,/!selectedSet\.has\(existingBlock\)/);
});

test("runtime owns the approved messages and one selection refresh",()=>{
  const resize=functionSource("resizeWorkshopSelection","rotateWorkshopSelectionRight");
  for(const message of ["Selection grew.","Selection shrank.",
    "That would go outside your build space.",
    "That size would bump into another part.",
    "That's as small as this selection can go."]){
    assert.match(resize,new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  const success=resize.slice(resize.lastIndexOf("originals.forEach"));
  assert.equal((success.match(/syncWorkshopSelectionMeasurements\(\)/g)||[]).length,1);
  assert.doesNotMatch(resize,/addEventListener|dispatchEvent|setTimeout/);
});

test("unsupported geometry and compound ownership fail closed",()=>{
  const adapter=functionSource("createWorkshopAggregateResizeItems",
    "createWorkshopAggregateResizeCandidate");
  assert.match(adapter,/object\.geometry\.type!=="BoxGeometry"/);
  assert.match(adapter,/object\.children\.length>0/);
  const transform=fs.readFileSync(path.resolve(here,
    "../../js/workshop/editing/workshop-selection-resize-transform.mjs"),"utf8");
  assert.match(transform,/Math\.abs\(item\.rotation\.x\)\s*>\s*rotationTolerance/);
  assert.match(transform,/normalizeQuarterTurn/);
  assert.match(transform,/scale\.x\s*<=\s*0 \|\| scale\.y\s*<=\s*0 \|\|/);
});

test("native controls retain one click activation path",()=>{
  assert.match(source,/id="workshopGrowButton"[^>]*type="button"[^>]*onclick="resizeWorkshopSelection\(1\)"/);
  assert.match(source,/id="workshopShrinkButton"[^>]*type="button"[^>]*onclick="resizeWorkshopSelection\(-1\)"/);
  assert.equal((source.match(/onclick="resizeWorkshopSelection\(1\)"/g)||[]).length,1);
  assert.equal((source.match(/onclick="resizeWorkshopSelection\(-1\)"/g)||[]).length,1);
});
