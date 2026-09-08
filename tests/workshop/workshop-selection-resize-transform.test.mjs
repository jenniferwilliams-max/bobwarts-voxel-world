import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_RESIZE_MINIMUM_CM,
  WORKSHOP_RESIZE_STEP_CM,
  createWorkshopSelectionResizeCandidate,
} from "../../js/workshop/editing/workshop-selection-resize-transform.mjs";

const box = (name, position, overrides = {}) => ({
  object:{ name },
  geometryType:"BoxGeometry",
  dimensions:{ width:1, height:1, depth:1 },
  position,
  rotation:{ x:0, y:0, z:0 },
  scale:{ x:1, y:1, z:1 },
  ...overrides,
});

const candidate = (overrides = {}) => createWorkshopSelectionResizeCandidate({
  items:[box("box",{ x:5, y:4, z:-2 },{
    dimensions:{ width:2, height:3, depth:4 },
  })],
  bounds:{ min:{ x:4, y:2.5, z:-4 }, max:{ x:6, y:5.5, z:0 } },
  delta:WORKSHOP_RESIZE_STEP_CM,
  ...overrides,
});

test("single-box aggregate Grow changes each world axis by 1cm and preserves bottom Y", () => {
  const result=candidate();
  assert.deepEqual(result.beforeAggregateDimensions,{width:2,height:3,depth:4});
  assert.deepEqual(result.afterAggregateDimensions,{width:3,height:4,depth:5});
  assert.deepEqual(result.pivot,{x:5,y:2.5,z:-2});
  assert.deepEqual(result.entries[0].beforeDimensions,{width:2,height:3,depth:4});
  assert.deepEqual(result.entries[0].afterDimensions,{width:3,height:4,depth:5});
  assert.deepEqual(result.entries[0].after,{x:5,y:4.5,z:-2});
});

test("selection uses shared factors around aggregate X/Z center and bottom-Y anchor", () => {
  const first=box("first",{x:0.5,y:0.5,z:0.5});
  const second=box("second",{x:2.5,y:0.5,z:0.5});
  const result=createWorkshopSelectionResizeCandidate({
    items:[first,second],
    bounds:{min:{x:0,y:0,z:0},max:{x:3,y:1,z:1}},
    delta:1,
  });
  assert.deepEqual(result.afterAggregateDimensions,{width:4,height:2,depth:2});
  assert.deepEqual(result.pivot,{x:1.5,y:0,z:0.5});
  assert.deepEqual(result.factors,{x:4/3,y:2,z:2});
  assert.deepEqual(result.entries.map((entry)=>entry.after),[
    {x:0.166666666667,y:1,z:0.5},{x:2.833333333333,y:1,z:0.5},
  ]);
  assert.deepEqual(result.entries[0].afterDimensions,{
    width:1.333333333333,height:2,depth:2,
  });
});

test("quarter-turn Y rotations map world-axis factors to local BoxGeometry axes", () => {
  const result=createWorkshopSelectionResizeCandidate({
    items:[box("turned",{x:1,y:1,z:2},{
      dimensions:{width:2,height:2,depth:4},
      rotation:{x:0,y:Math.PI/2,z:0},
    })],
    bounds:{min:{x:-1,y:0,z:1},max:{x:3,y:2,z:3}},
    delta:1,
  });
  assert.deepEqual(result.afterAggregateDimensions,{width:5,height:3,depth:3});
  assert.deepEqual(result.entries[0].afterDimensions,{width:3,height:3,depth:5});
  assert.equal(result.entries[0].beforeRotationY,Math.PI/2);
  assert.equal(result.entries[0].afterRotationY,Math.PI/2);
});

test("Shrink permits the 1cm local minimum and rejects smaller candidates atomically", () => {
  const allowed=createWorkshopSelectionResizeCandidate({
    items:[box("box",{x:0.5,y:0.5,z:0.5},{dimensions:{width:2,height:2,depth:2}})],
    bounds:{min:{x:-0.5,y:-0.5,z:-0.5},max:{x:1.5,y:1.5,z:1.5}},
    delta:-1,
  });
  assert.deepEqual(allowed.entries[0].afterDimensions,{
    width:WORKSHOP_RESIZE_MINIMUM_CM,
    height:WORKSHOP_RESIZE_MINIMUM_CM,
    depth:WORKSHOP_RESIZE_MINIMUM_CM,
  });
  assert.equal(createWorkshopSelectionResizeCandidate({
    items:[box("small",{x:0,y:0,z:0},{dimensions:{width:1.5,height:2,depth:2}})],
    bounds:{min:{x:-0.75,y:-1,z:-1},max:{x:0.75,y:1,z:1}},
    delta:-1,
  }),null);
});

test("unsupported or mixed selections fail closed", () => {
  const valid=box("valid",{x:0,y:0.5,z:0});
  const bounds={min:{x:-0.5,y:0,z:-0.5},max:{x:1.5,y:1,z:0.5}};
  for(const unsupported of [
    box("sphere",{x:1,y:0.5,z:0},{geometryType:"SphereGeometry"}),
    box("x-rotated",{x:1,y:0.5,z:0},{rotation:{x:0.1,y:0,z:0}}),
    box("arbitrary-y",{x:1,y:0.5,z:0},{rotation:{x:0,y:0.2,z:0}}),
    box("bad-scale",{x:1,y:0.5,z:0},{scale:{x:1,y:0,z:1}}),
  ]) {
    assert.equal(createWorkshopSelectionResizeCandidate({
      items:[valid,unsupported],bounds,delta:1,
    }),null);
  }
});

test("invalid inputs fail closed and candidate snapshots are deeply immutable", () => {
  assert.equal(createWorkshopSelectionResizeCandidate(),null);
  assert.equal(candidate({delta:2}),null);
  const result=candidate();
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.entries),true);
  assert.equal(Object.isFrozen(result.entries[0]),true);
  assert.equal(Object.isFrozen(result.entries[0].before),true);
  assert.equal(Object.isFrozen(result.entries[0].afterDimensions),true);
  assert.equal(Object.isFrozen(result.pivot),true);
  assert.equal(Object.isFrozen(result.factors),true);
});
