import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_EDIT_OPERATION_TYPES,
  createWorkshopEditHistory,
} from "../../js/workshop/editing/workshop-edit-history.mjs";

function coordinates(x, y = 0, z = 0) { return { x, y, z }; }

function harness() {
  const present = new Set();
  const positions = new Map();
  const applied = [];
  const validate = (transaction, direction) => transaction.entries.every((entry) => {
    const exists = present.has(entry.object);
    if (direction === "COMMIT") {
      return transaction.type === "PLACEMENT" ? exists :
        transaction.type === "DELETION" ? !exists : exists;
    }
    if (transaction.type === "PLACEMENT") return direction === "UNDO" ? exists : !exists;
    if (transaction.type === "DELETION") return direction === "UNDO" ? !exists : exists;
    return exists;
  });
  const apply = (transaction, direction) => {
    applied.push(`${direction}:${transaction.type}`);
    for (const entry of transaction.entries) {
      const useBefore = direction === "UNDO";
      const exists = transaction.type === "PLACEMENT" ? !useBefore :
        transaction.type === "DELETION" ? useBefore : true;
      if (exists) present.add(entry.object); else present.delete(entry.object);
      const point = useBefore ? entry.before : entry.after;
      if (point) positions.set(entry.object, { ...point });
    }
    return true;
  };
  return { present, positions, applied, history:createWorkshopEditHistory({ validate, apply }) };
}

test("ledger preserves chronological placement, deletion, and Move ordering", () => {
  const { present, applied, history } = harness();
  const first = {}, second = {};
  present.add(first);
  assert.equal(history.commit({
    type:WORKSHOP_EDIT_OPERATION_TYPES.PLACEMENT,
    entries:[{ object:first, before:null, after:coordinates(0) }],
  }).ok, true);
  present.add(second);
  assert.equal(history.commit({
    type:WORKSHOP_EDIT_OPERATION_TYPES.PLACEMENT,
    entries:[{ object:second, before:null, after:coordinates(1) }],
  }).ok, true);
  present.delete(first);
  assert.equal(history.commit({
    type:WORKSHOP_EDIT_OPERATION_TYPES.DELETION,
    entries:[{ object:first, before:coordinates(0), after:null }],
  }).ok, true);
  assert.equal(history.undo().transaction.type, "DELETION");
  assert.equal(history.undo().transaction.entries[0].object, second);
  assert.equal(history.undo().transaction.entries[0].object, first);
  assert.deepEqual(applied, ["UNDO:DELETION", "UNDO:PLACEMENT", "UNDO:PLACEMENT"]);
  assert.equal(history.redo().transaction.entries[0].object, first);
  assert.equal(history.redo().transaction.entries[0].object, second);
  assert.equal(history.redo().transaction.type, "DELETION");
});

test("transactions and nested coordinate snapshots are deeply immutable", () => {
  const { present, history } = harness();
  const object = {};
  present.add(object);
  const result = history.commit({
    type:"MOVE",
    entries:[{ object, before:coordinates(1, 2, 3), after:coordinates(4, 5, 6) }],
    translation:{ x:3, z:3 },
    selection:[object],
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.transaction), true);
  assert.equal(Object.isFrozen(result.transaction.entries), true);
  assert.equal(Object.isFrozen(result.transaction.entries[0]), true);
  assert.equal(Object.isFrozen(result.transaction.entries[0].before), true);
  assert.equal(Object.isFrozen(result.transaction.entries[0].after), true);
  assert.equal(Object.isFrozen(result.transaction.translation), true);
  assert.equal(Object.isFrozen(result.transaction.selection), true);
});

test("new edits clear Redo and repeated commits are rejected", () => {
  const { present, history } = harness();
  const first = {}, second = {};
  present.add(first);
  const operation = { type:"PLACEMENT", entries:[{ object:first, before:null, after:coordinates(0) }] };
  assert.equal(history.commit(operation).ok, true);
  assert.equal(history.commit(operation).code, "REPEATED");
  assert.equal(history.undo().ok, true);
  assert.equal(history.getSnapshot().canRedo, true);
  present.add(second);
  assert.equal(history.commit({
    type:"PLACEMENT",
    entries:[{ object:second, before:null, after:coordinates(2) }],
  }).ok, true);
  assert.equal(history.getSnapshot().canRedo, false);
});

test("invalid, missing-object, and failed operations leave both stacks atomic", () => {
  const object = {};
  const present = new Set([object]);
  let failApply = false;
  const history = createWorkshopEditHistory({
    validate(transaction, direction) {
      return direction === "COMMIT" || present.has(transaction.entries[0].object);
    },
    apply() { return !failApply; },
  });
  assert.equal(history.commit({ type:"PLACEMENT", entries:[] }).code, "INVALID_TRANSACTION");
  assert.equal(history.commit({
    type:"PLACEMENT", entries:[{ object, before:null, after:coordinates(0) }],
  }).ok, true);
  present.delete(object);
  const beforeMissing = history.getSnapshot();
  assert.equal(history.undo().code, "INVALID_OBJECTS");
  assert.deepEqual(history.getSnapshot(), beforeMissing);
  present.add(object);
  failApply = true;
  const beforeFailure = history.getSnapshot();
  assert.equal(history.undo().code, "APPLY_FAILED");
  assert.deepEqual(history.getSnapshot(), beforeFailure);
});

test("reset clears the session-only ledger", () => {
  const { present, history } = harness();
  const object = {};
  present.add(object);
  history.commit({ type:"PLACEMENT", entries:[{ object, before:null, after:coordinates(0) }] });
  assert.equal(history.reset().ok, true);
  assert.deepEqual(history.getSnapshot(), {
    undoCount:0, redoCount:0, canUndo:false, canRedo:false,
    latestUndo:null, latestRedo:null,
  });
});

test("prepared Rotate reserves one ID without changing history stacks", () => {
  const object={};
  const present=new Set([object]);
  let transform="before";
  const history=createWorkshopEditHistory({
    validate(transaction,direction){
      if(!present.has(transaction.entries[0].object)) return false;
      if(direction==="PREPARE") return transform==="before";
      if(direction==="COMMIT") return transform==="after";
      return true;
    },
    apply(){return true;},
  });
  const operation={
    type:WORKSHOP_EDIT_OPERATION_TYPES.ROTATE,
    entries:[{
      object,before:coordinates(0),after:coordinates(1),
      beforeRotationY:0,afterRotationY:Math.PI/2,
    }],
    pivot:{x:0,z:0},angle:Math.PI/2,selection:[object],
  };
  const before=history.getSnapshot();
  const prepared=history.prepare(operation);
  assert.equal(prepared.ok,true);
  assert.deepEqual(history.getSnapshot(),before);
  assert.equal(history.commit(operation).code,"BUSY");
  assert.equal(history.undo().code,"BUSY");
  assert.equal(history.redo().code,"BUSY");
  assert.equal(history.prepare(operation).code,"BUSY");
  transform="after";
  const committed=history.commitPrepared(prepared.token);
  assert.equal(committed.ok,true);
  assert.equal(committed.transaction.id,1);
  assert.equal(history.getSnapshot().undoCount,1);
  assert.equal(Object.isFrozen(committed.transaction.pivot),true);
});

test("prepared Rotate cancellation and reset reject stale tokens without ID gaps", () => {
  const object={};
  const history=createWorkshopEditHistory({validate(){return true;},apply(){return true;}});
  const operation={
    type:"ROTATE",
    entries:[{
      object,before:coordinates(0),after:coordinates(1),
      beforeRotationY:0,afterRotationY:Math.PI/2,
    }],
    pivot:{x:0,z:0},angle:Math.PI/2,
  };
  const first=history.prepare(operation);
  assert.equal(history.cancelPrepared(first.token).ok,true);
  assert.equal(history.commitPrepared(first.token).code,"STALE");
  const second=history.prepare(operation);
  assert.equal(second.transaction.id,1);
  history.reset();
  assert.equal(history.commitPrepared(second.token).code,"STALE");
  const third=history.prepare(operation);
  assert.equal(third.transaction.id,1);
});

test("failed prepared settlement retains reservation for browser rollback", () => {
  const object={};
  let validAfter=false;
  const history=createWorkshopEditHistory({
    validate(transaction,direction){return direction!=="COMMIT" || validAfter;},
    apply(){return true;},
  });
  const prepared=history.prepare({
    type:"ROTATE",
    entries:[{
      object,before:coordinates(0),after:coordinates(1),
      beforeRotationY:0,afterRotationY:Math.PI/2,
    }],
    pivot:{x:0,z:0},angle:Math.PI/2,
  });
  assert.equal(history.commitPrepared(prepared.token).code,"INVALID_OBJECTS");
  assert.equal(history.getSnapshot().undoCount,0);
  assert.equal(history.commit({
    type:"PLACEMENT",entries:[{object,before:null,after:coordinates(0)}],
  }).code,"BUSY");
  assert.equal(history.cancelPrepared(prepared.token).ok,true);
  assert.equal(history.getSnapshot().undoCount,0);
});

test("prepared Resize stores one immutable exact dimension transaction", () => {
  const object={};
  let state="before";
  const history=createWorkshopEditHistory({
    validate(transaction,direction){
      return direction==="PREPARE" ? state==="before" :
        direction==="COMMIT" ? state==="after" : true;
    },
    apply(){return true;},
  });
  const operation={
    type:WORKSHOP_EDIT_OPERATION_TYPES.RESIZE,
    entries:[{
      object,
      before:coordinates(0,1,0),after:coordinates(0,1.5,0),
      beforeRotationY:0,afterRotationY:0,
      beforeDimensions:{width:2,height:2,depth:2},
      afterDimensions:{width:3,height:3,depth:3},
    }],
    pivot:{x:0,y:0,z:0},
    selection:[object],
  };
  const prepared=history.prepare(operation);
  assert.equal(prepared.ok,true);
  assert.equal(history.getSnapshot().undoCount,0);
  state="after";
  const committed=history.commitPrepared(prepared.token);
  assert.equal(committed.ok,true);
  assert.equal(committed.transaction.type,"RESIZE");
  assert.equal(committed.transaction.id,1);
  assert.equal(Object.isFrozen(committed.transaction.entries[0].beforeDimensions),true);
  assert.equal(Object.isFrozen(committed.transaction.entries[0].afterDimensions),true);
  assert.deepEqual(committed.transaction.entries[0].afterDimensions,
    {width:3,height:3,depth:3});
});

test("Resize accepts atomic multi-entry positive dimension snapshots", () => {
  const {present,history}=harness();
  const first={},second={};
  present.add(first);
  present.add(second);
  const entry=(object)=>({
    object,before:coordinates(0),after:coordinates(0,0.5,0),
    beforeRotationY:0,afterRotationY:0,
    beforeDimensions:{width:2,height:2,depth:2},
    afterDimensions:{width:3,height:3,depth:3},
  });
  const pivot={x:0,y:0,z:0};
  assert.equal(history.prepare({type:"RESIZE",entries:[entry(first)],pivot}).ok,true);
  history.reset();
  const prepared=history.prepare({
    type:"RESIZE",entries:[entry(first),entry(second)],pivot,selection:[first,second],
  });
  assert.equal(prepared.ok,true);
  assert.equal(prepared.transaction.entries.length,2);
  assert.equal(Object.isFrozen(prepared.transaction.pivot),true);
  assert.deepEqual(prepared.transaction.pivot,pivot);
  history.reset();
  assert.equal(history.prepare({
    type:"RESIZE",pivot,
    entries:[{...entry(first),afterDimensions:{width:0,height:1,depth:1}}],
  }).code,"INVALID_TRANSACTION");
  assert.equal(history.prepare({
    type:"RESIZE",entries:[entry(first)],pivot:{x:0,z:0},
  }).code,"INVALID_TRANSACTION");
});
