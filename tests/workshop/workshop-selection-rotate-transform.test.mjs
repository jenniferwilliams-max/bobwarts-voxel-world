import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_ROTATE_RIGHT_ANGLE,
  createWorkshopSelectionRotateCandidate,
  normalizeWorkshopRotationY,
} from "../../js/workshop/editing/workshop-selection-rotate-transform.mjs";

const object = (name, x, y, z, rotationY = 0) => ({
  object:{ name }, position:{ x, y, z }, rotationY,
});

test("Rotate Right uses the approved visible-clockwise quarter turn", () => {
  const top={};
  const candidate=createWorkshopSelectionRotateCandidate({
    bounds:{ min:{x:-1,z:-1}, max:{x:1,z:1} },
    objects:[{ object:top, position:{x:0,y:2,z:-1}, rotationY:0 }],
  });
  assert.equal(candidate.angle,WORKSHOP_ROTATE_RIGHT_ANGLE);
  assert.deepEqual(candidate.pivot,{x:0,z:0});
  assert.deepEqual(candidate.entries[0].after,{x:1,y:2,z:0});
  assert.equal(candidate.entries[0].afterRotationY,Math.PI/2);
});

test("connected and composed members rotate rigidly around one bounds center", () => {
  const candidate=createWorkshopSelectionRotateCandidate({
    bounds:{ min:{x:0,z:1}, max:{x:6,z:5} },
    objects:[object("a",1,3,2,0),object("b",5,7,4,Math.PI)],
  });
  assert.deepEqual(candidate.pivot,{x:3,z:3});
  assert.deepEqual(candidate.entries.map((entry)=>entry.after),[
    {x:4,y:3,z:1},{x:2,y:7,z:5},
  ]);
  const beforeDistance=Math.hypot(1-5,2-4);
  const afterDistance=Math.hypot(4-2,1-5);
  assert.equal(afterDistance,beforeDistance);
  assert.equal(candidate.noOp,false);
  assert.equal(Object.isFrozen(candidate.entries),true);
});

test("fractional coordinates and exact Y values survive four canonical turns", () => {
  let item=object("fractional",0.25,1.75,-0.4,-Math.PI/2);
  const bounds={ min:{x:-1.5,z:-1.5}, max:{x:1.5,z:1.5} };
  for(let turn=0;turn<4;turn+=1){
    const candidate=createWorkshopSelectionRotateCandidate({bounds,objects:[item]});
    const entry=candidate.entries[0];
    item=object("fractional",entry.after.x,entry.after.y,entry.after.z,entry.afterRotationY);
  }
  assert.deepEqual(item.position,{x:0.25,y:1.75,z:-0.4});
  assert.equal(item.rotationY,normalizeWorkshopRotationY(-Math.PI/2));
});

test("invalid snapshots fail closed without a candidate", () => {
  assert.equal(createWorkshopSelectionRotateCandidate(),null);
  assert.equal(createWorkshopSelectionRotateCandidate({
    bounds:{min:{x:0,z:0},max:{x:1,z:1}},
    objects:[object("bad",0,0,0,NaN)],
  }),null);
});
