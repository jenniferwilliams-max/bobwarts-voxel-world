import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../../index.html"),"utf8");

const functionSource=(name,nextName)=>{
  const start=source.indexOf(`function ${name}`);
  const end=source.indexOf(`function ${nextName}`,start);
  assert.notEqual(start,-1,`${name} must exist`);
  assert.notEqual(end,-1,`${nextName} must follow ${name}`);
  return source.slice(start,end);
};

test("runtime loads one Resize adapter owner",()=>{
  assert.equal((source.match(/import\("\.\/js\/workshop\/editing\/workshop-selection-resize-adapters\.mjs"\)/g)||[]).length,1);
  assert.match(source,/workshopSelectionResizeAdaptersModule=modules\[32\]/);
});

test("Bridge Beam and Support Column receive explicit trusted runtime identity",()=>{
  const bridge=functionSource("addBridgeBeam","addSupportColumn");
  const support=functionSource("addSupportColumn","addRamp");
  assert.match(bridge,/registerWorkshopSelectionResizeFamily/);
  assert.match(bridge,/WORKSHOP_SELECTION_RESIZE_FAMILIES\.BRIDGE_BEAM/);
  assert.match(support,/registerWorkshopSelectionResizeFamily/);
  assert.match(support,/WORKSHOP_SELECTION_RESIZE_FAMILIES\.SUPPORT_COLUMN/);
  assert.doesNotMatch(bridge,/userData|dimensions\s*===|geometry\.parameters/);
});

test("aggregate Resize requires an approved adapter for every selected member",()=>{
  const items=functionSource("createWorkshopAggregateResizeItems",
    "createWorkshopAggregateResizeCandidate");
  assert.match(items,/getWorkshopSelectionResizeAdapter\(object/);
  assert.match(items,/standardBlock:isStandardWorkshopBlock\(object\)/);
  assert.match(items,/if\(!resizeAdapter\) return null/);
  assert.match(items,/minimumDimensions:resizeAdapter\.minimumDimensions/);
  const resize=functionSource("resizeWorkshopSelection","rotateWorkshopSelectionRight");
  assert.match(resize,/One part of this selection can't be resized yet\./);
});

test("save schema remains free of Resize family persistence",()=>{
  const saveStart=source.indexOf("function saveCreation");
  const loadStart=source.indexOf("function loadCreation",saveStart);
  const saveAndLoad=source.slice(saveStart,loadStart+4000);
  assert.doesNotMatch(saveAndLoad,/workshopResizeFamily|BRIDGE_BEAM|SUPPORT_COLUMN/);
});

test("existing one-shot Grow and Shrink control ownership is unchanged",()=>{
  assert.equal((source.match(/onclick="resizeWorkshopSelection\(1\)"/g)||[]).length,1);
  assert.equal((source.match(/onclick="resizeWorkshopSelection\(-1\)"/g)||[]).length,1);
});

test("only the two approved catalog functions register Resize identity",()=>{
  assert.equal((source.match(/registerWorkshopSelectionResizeFamily\(/g)||[]).length,2);
  for(const family of ["BRIDGE_BEAM","SUPPORT_COLUMN"]){
    assert.equal((source.match(new RegExp(
      `WORKSHOP_SELECTION_RESIZE_FAMILIES\\.${family}`,"g"))||[]).length,1);
  }
});
