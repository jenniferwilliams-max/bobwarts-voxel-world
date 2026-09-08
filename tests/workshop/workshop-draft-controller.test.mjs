import test from "node:test";
import assert from "node:assert/strict";

import { createWorkshopEditHistory } from "../../js/workshop/editing/workshop-edit-history.mjs";
import { createWorkshopDraftController } from "../../js/workshop/persistence/workshop-draft-controller.mjs";

function foundation() {
  const present = new Set();
  const history = createWorkshopEditHistory({
    validate: () => true,
    apply: () => true,
  });
  const draft = createWorkshopDraftController({ history });
  draft.createBlank();
  return { history, draft, present };
}

const placement = (object, x = 0) => ({
  type: "PLACEMENT",
  entries: [{ object, before: null, after: { x, y: 0.5, z: 0 } }],
});

test("parks and restores the exact mesh references without cloning", () => {
  const { draft } = foundation();
  const geometry = {};
  const material = {};
  const first = { geometry, material };
  const second = { compoundMember: true };
  const capture = draft.begin("CAPTURE");
  draft.capture([first, second], capture);
  const restore = draft.begin("RESTORE");
  const objects = draft.restore(restore);
  assert.deepEqual(objects, [first, second]);
  assert.equal(objects[0], first);
  assert.equal(objects[0].geometry, geometry);
  assert.equal(objects[0].material, material);
});

test("dirty state follows successful history cursor and checkpoint", () => {
  const { history, draft } = foundation();
  const object = {};
  assert.equal(draft.getSnapshot().dirty, false);
  assert.equal(history.commit(placement(object)).ok, true);
  assert.equal(draft.getSnapshot().dirty, true);
  draft.markCheckpoint();
  assert.equal(draft.getSnapshot().dirty, false);
  assert.equal(history.undo().ok, true);
  assert.equal(draft.getSnapshot().dirty, true);
  assert.equal(history.redo().ok, true);
  assert.equal(draft.getSnapshot().dirty, false);
});

test("rejected and repeated edits do not change draft dirtiness", () => {
  const { history, draft } = foundation();
  const object = {};
  const operation = placement(object);
  assert.equal(history.commit(operation).ok, true);
  draft.markCheckpoint();
  const before = draft.getSnapshot();
  assert.equal(history.commit(operation).code, "REPEATED");
  const after = draft.getSnapshot();
  assert.equal(after.dirty, false);
  assert.deepEqual(after.historyCursor, before.historyCursor);
});

test("snapshot and nested cursor data are deeply frozen", () => {
  const { draft } = foundation();
  const snapshot = draft.getSnapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.checkpoint), true);
  assert.equal(Object.isFrozen(snapshot.historyCursor), true);
});

test("stale capture and restore claims fail closed", () => {
  const { draft } = foundation();
  const object = {};
  const staleCapture = draft.begin("CAPTURE");
  draft.cancelPending();
  draft.capture([object], staleCapture);
  assert.equal(draft.getSnapshot().objectCount, 0);
  const staleRestore = draft.begin("RESTORE");
  draft.begin("CAPTURE");
  assert.deepEqual(draft.restore(staleRestore), []);
});

test("repeated equivalent capture is idempotent", () => {
  const { draft } = foundation();
  const object = {};
  draft.capture([object], draft.begin("CAPTURE"));
  const first = draft.getSnapshot();
  draft.capture([object], draft.begin("CAPTURE"));
  const second = draft.getSnapshot();
  assert.equal(second.generation, first.generation);
  assert.equal(second.objectCount, 1);
  assert.equal(second, first);
});
