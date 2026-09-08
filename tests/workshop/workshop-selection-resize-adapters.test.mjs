import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_SELECTION_RESIZE_FAMILIES,
  getWorkshopSelectionResizeAdapter,
  registerWorkshopSelectionResizeFamily,
} from "../../js/workshop/editing/workshop-selection-resize-adapters.mjs";
import { createWorkshopSelectionResizeCandidate } from
  "../../js/workshop/editing/workshop-selection-resize-transform.mjs";

const boxItem = (object, dimensions, position, rotationY = 0, minimumDimensions) => ({
  object,
  geometryType:"BoxGeometry",
  dimensions,
  position,
  rotation:{ x:0, y:rotationY, z:0 },
  scale:{ x:1, y:1, z:1 },
  minimumDimensions,
});

test("trusted families are runtime-only object identities", () => {
  const bridge={};
  const lookalike={};
  assert.equal(registerWorkshopSelectionResizeFamily(
    bridge,WORKSHOP_SELECTION_RESIZE_FAMILIES.BRIDGE_BEAM),true);
  assert.deepEqual(getWorkshopSelectionResizeAdapter(bridge),{
    family:"BRIDGE_BEAM",
    minimumDimensions:{ width:1, height:0.5, depth:1 },
  });
  assert.equal(getWorkshopSelectionResizeAdapter(lookalike),null);
  assert.equal(getWorkshopSelectionResizeAdapter({ dimensions:[6,0.5,1] }),null);
});

test("standard blocks and trusted Support Columns use the 1cm minimum", () => {
  const standard={};
  const support={};
  assert.deepEqual(getWorkshopSelectionResizeAdapter(standard,{ standardBlock:true }),{
    family:"STANDARD_BLOCK",
    minimumDimensions:{ width:1, height:1, depth:1 },
  });
  registerWorkshopSelectionResizeFamily(
    support,WORKSHOP_SELECTION_RESIZE_FAMILIES.SUPPORT_COLUMN);
  assert.deepEqual(getWorkshopSelectionResizeAdapter(support),{
    family:"SUPPORT_COLUMN",
    minimumDimensions:{ width:1, height:1, depth:1 },
  });
});

test("Bridge Beam Grow then Shrink restores exact authored dimensions", () => {
  const bridge={};
  const minimum={ width:1, height:0.5, depth:1 };
  const grown=createWorkshopSelectionResizeCandidate({
    items:[boxItem(bridge,{ width:6, height:0.5, depth:1 },
      { x:0, y:2, z:0 },0,minimum)],
    bounds:{ min:{ x:-3, y:1.75, z:-0.5 }, max:{ x:3, y:2.25, z:0.5 } },
    delta:1,
  });
  assert.deepEqual(grown.entries[0].afterDimensions,
    { width:7, height:1.5, depth:2 });
  const restored=createWorkshopSelectionResizeCandidate({
    items:[boxItem(bridge,grown.entries[0].afterDimensions,
      grown.entries[0].after,0,minimum)],
    bounds:grown.afterBounds,
    delta:-1,
  });
  assert.deepEqual(restored.entries[0].afterDimensions,
    { width:6, height:0.5, depth:1 });
  assert.deepEqual(restored.entries[0].after,{ x:0, y:2, z:0 });
});

test("Bridge Beam authored minimum works at every quarter turn", () => {
  for(const turns of [0,1,2,3]){
    const rotationY=turns*Math.PI/2;
    const horizontal=turns%2===0;
    const beforeBounds=horizontal
      ? { min:{x:-3,y:1.75,z:-0.5},max:{x:3,y:2.25,z:0.5} }
      : { min:{x:-0.5,y:1.75,z:-3},max:{x:0.5,y:2.25,z:3} };
    const grown=createWorkshopSelectionResizeCandidate({
      items:[boxItem({}, {width:6,height:0.5,depth:1},
        {x:0,y:2,z:0},rotationY,{width:1,height:0.5,depth:1})],
      bounds:beforeBounds,
      delta:1,
    });
    assert.ok(grown,`quarter turn ${turns} should be supported`);
    assert.equal(grown.entries[0].afterRotationY,rotationY);
  }
});

test("initial Bridge Beam Shrink fails atomically below its approved minimum", () => {
  const item=boxItem({}, {width:6,height:0.5,depth:1},
    {x:0,y:2,z:0},0,{width:1,height:0.5,depth:1});
  assert.equal(createWorkshopSelectionResizeCandidate({
    items:[item],
    bounds:{ min:{x:-3,y:1.75,z:-0.5},max:{x:3,y:2.25,z:0.5} },
    delta:-1,
  }),null);
  assert.deepEqual(item.dimensions,{width:6,height:0.5,depth:1});
  assert.deepEqual(item.position,{x:0,y:2,z:0});
});

test("Support Column uses the existing Box path and restores after Grow then Shrink", () => {
  const support={};
  const minimum={width:1,height:1,depth:1};
  const grown=createWorkshopSelectionResizeCandidate({
    items:[boxItem(support,{width:1,height:4,depth:1},
      {x:0,y:2,z:0},0,minimum)],
    bounds:{min:{x:-0.5,y:0,z:-0.5},max:{x:0.5,y:4,z:0.5}},
    delta:1,
  });
  assert.deepEqual(grown.entries[0].afterDimensions,
    {width:2,height:5,depth:2});
  const restored=createWorkshopSelectionResizeCandidate({
    items:[boxItem(support,grown.entries[0].afterDimensions,
      grown.entries[0].after,0,minimum)],
    bounds:grown.afterBounds,
    delta:-1,
  });
  assert.deepEqual(restored.entries[0].afterDimensions,
    {width:1,height:4,depth:1});
  assert.deepEqual(restored.entries[0].after,{x:0,y:2,z:0});
});

test("standard block, Bridge Beam, and Support Column share one aggregate pivot", () => {
  const minimum={width:1,height:1,depth:1};
  const bridgeMinimum={width:1,height:0.5,depth:1};
  const standard={name:"standard"};
  const bridge={name:"bridge"};
  const support={name:"support"};
  const result=createWorkshopSelectionResizeCandidate({
    items:[
      boxItem(standard,{width:1,height:1,depth:1},{x:-3.5,y:0.5,z:0},0,minimum),
      boxItem(bridge,{width:6,height:0.5,depth:1},{x:0,y:2,z:0},0,bridgeMinimum),
      boxItem(support,{width:1,height:4,depth:1},{x:3.5,y:2,z:0},0,minimum),
    ],
    bounds:{min:{x:-4,y:0,z:-0.5},max:{x:4,y:4,z:0.5}},
    delta:1,
  });
  assert.ok(result);
  assert.deepEqual(result.entries.map((entry)=>entry.object),
    [standard,bridge,support]);
  assert.deepEqual(result.pivot,{x:0,y:0,z:0});
  assert.equal(result.afterBounds.min.y,0);
  assert.deepEqual(result.afterAggregateDimensions,
    {width:9,height:5,depth:2});
});

test("one unsupported mixed member rejects the complete candidate", () => {
  const supported=boxItem({}, {width:2,height:2,depth:2},
    {x:0,y:1,z:0},0,{width:1,height:1,depth:1});
  const unsupported={...boxItem({}, {width:2,height:2,depth:2},
    {x:2,y:1,z:0}),geometryType:"SphereGeometry"};
  assert.equal(createWorkshopSelectionResizeCandidate({
    items:[supported,unsupported],
    bounds:{min:{x:-1,y:0,z:-1},max:{x:3,y:2,z:1}},
    delta:1,
  }),null);
  assert.deepEqual(supported.dimensions,{width:2,height:2,depth:2});
});

test("unsupported family names fail closed", () => {
  const unsupported={};
  assert.equal(registerWorkshopSelectionResizeFamily(unsupported,"RAMP"),false);
  assert.equal(getWorkshopSelectionResizeAdapter(unsupported),null);
});
