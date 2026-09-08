import assert from "node:assert/strict";
import test from "node:test";

import { createWorkshopSelectionResizeCandidate } from
  "../../js/workshop/editing/workshop-selection-resize-transform.mjs";

const item=(object,x,y,z,options={})=>({
  object,
  geometryType:"BoxGeometry",
  dimensions:options.dimensions || {width:1,height:1,depth:1},
  position:{x,y,z},
  rotation:options.rotation || {x:0,y:0,z:0},
  scale:options.scale || {x:1,y:1,z:1},
});

test("aggregate resize uses one shared translation and preserves relative structure",()=>{
  const first={},second={},third={};
  const result=createWorkshopSelectionResizeCandidate({
    items:[item(first,0.5,0.5,0.5),item(second,1.5,0.5,0.5),
      item(third,1.5,1.5,0.5)],
    bounds:{min:{x:0,y:0,z:0},max:{x:2,y:2,z:1}},
    delta:1,
  });
  assert.equal(result.entries.length,3);
  assert.deepEqual(result.afterAggregateDimensions,{width:3,height:3,depth:2});
  assert.deepEqual(result.entries.map((entry)=>entry.object),[first,second,third]);
  assert.deepEqual(result.entries.map((entry)=>entry.after),[
    {x:0.25,y:0.75,z:0.5},
    {x:1.75,y:0.75,z:0.5},
    {x:1.75,y:2.25,z:0.5},
  ]);
});

test("mixed selection fails atomically when one member is unsupported",()=>{
  const first={},second={};
  const items=[item(first,0.5,0.5,0.5),item(second,1.5,0.5,0.5)];
  items[1].geometryType="SphereGeometry";
  assert.equal(createWorkshopSelectionResizeCandidate({
    items,bounds:{min:{x:0,y:0,z:0},max:{x:2,y:1,z:1}},delta:1,
  }),null);
  assert.deepEqual(items[0].position,{x:0.5,y:0.5,z:0.5});
  assert.deepEqual(items[0].dimensions,{width:1,height:1,depth:1});
});

test("candidate retains the complete authoritative selection identity",()=>{
  const objects=[{id:1},{id:2},{id:3}];
  const result=createWorkshopSelectionResizeCandidate({
    items:objects.map((object,index)=>item(object,index+0.5,0.5,0.5)),
    bounds:{min:{x:0,y:0,z:0},max:{x:3,y:1,z:1}},delta:1,
  });
  assert.deepEqual(result.entries.map((entry)=>entry.object),objects);
  assert.equal(new Set(result.entries.map((entry)=>entry.object)).size,3);
});
