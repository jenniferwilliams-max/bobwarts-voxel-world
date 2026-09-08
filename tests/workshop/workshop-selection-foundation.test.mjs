import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSHOP_SELECTION_STATES,
  createWorkshopSelectionFoundationController,
  getWorkshopConnectedSelection,
  workshopBoundsShareFace,
} from "../../js/workshop/editing/workshop-selection-foundation.mjs";

const box=(min,max) => ({min:{...min},max:{...max}});

test("Select One and Select Multiple keep immutable restoration ownership", () => {
  const first={id:"first"};
  const second={id:"second"};
  const controller=createWorkshopSelectionFoundationController();
  assert.equal(controller.beginSelectOne([first]).snapshot.state,
    WORKSHOP_SELECTION_STATES.SELECT_ONE);
  controller.reset();
  const begun=controller.beginSelectMultiple([first]);
  assert.equal(Object.isFrozen(begun.snapshot.entrySelection),true);
  assert.equal(begun.snapshot.firstSeedPending,true);
  const seeded=controller.acceptFirstSeed([first,second,second]);
  assert.deepEqual(seeded.selection,[first,second]);
  assert.equal(seeded.snapshot.firstSeedPending,false);
  assert.equal(controller.acceptFirstSeed([first]).code,"FIRST_SEED_NOT_PENDING");
  const cancelled=controller.cancel();
  assert.deepEqual(cancelled.selection,[first]);
  assert.equal(cancelled.snapshot.state,WORKSHOP_SELECTION_STATES.INACTIVE);
});

test("Done retains the intentional working selection and reset is final", () => {
  const first={};
  const second={};
  const controller=createWorkshopSelectionFoundationController();
  assert.equal(controller.finish().code,"NOT_MULTIPLE");
  controller.beginSelectMultiple([first]);
  controller.acceptFirstSeed([first]);
  controller.update([first,second]);
  assert.deepEqual(controller.finish().selection,[first,second]);
  assert.equal(controller.getSnapshot().state,WORKSHOP_SELECTION_STATES.INACTIVE);
  assert.deepEqual(controller.reset().selection,[]);
  assert.equal(controller.getSnapshot().firstSeedPending,false);
});

test("face contact requires one meeting axis and positive overlap on both others", () => {
  const origin=box({x:0,y:0,z:0},{x:1,y:1,z:1});
  assert.equal(workshopBoundsShareFace(origin,
    box({x:1,y:0,z:0},{x:2,y:1,z:1})),true);
  assert.equal(workshopBoundsShareFace(origin,
    box({x:1,y:1,z:0},{x:2,y:2,z:1})),false,"edge-only contact");
  assert.equal(workshopBoundsShareFace(origin,
    box({x:1,y:1,z:1},{x:2,y:2,z:2})),false,"corner-only contact");
  assert.equal(workshopBoundsShareFace(origin,
    box({x:1.01,y:0,z:0},{x:2.01,y:1,z:1})),false,"gap");
  assert.equal(workshopBoundsShareFace(origin,
    box({x:.5,y:0,z:0},{x:1.5,y:1,z:1})),false,"volume overlap");
});

test("connected traversal uses current bounds and only the requested seed", () => {
  const first={id:1};
  const second={id:2};
  const third={id:3};
  const current=new Map([
    [first,box({x:0,y:0,z:0},{x:1,y:1,z:1})],
    [second,box({x:1,y:0,z:0},{x:2,y:1,z:1})],
    [third,box({x:2,y:0,z:0},{x:3,y:1,z:1})],
  ]);
  const connected=getWorkshopConnectedSelection({
    seed:first,objects:[first,second,third],getBounds:(object)=>current.get(object),
  });
  assert.deepEqual(connected,[first,second,third]);
  assert.equal(Object.isFrozen(connected),true);
  current.set(second,box({x:5,y:0,z:0},{x:6,y:1,z:1}));
  assert.deepEqual(getWorkshopConnectedSelection({
    seed:first,objects:[first,second,third],getBounds:(object)=>current.get(object),
  }),[first]);
  assert.deepEqual(getWorkshopConnectedSelection({
    seed:{},objects:[first],getBounds:(object)=>current.get(object),
  }),[]);
});
