import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_SELECTION_MOVE_STATES,
  createWorkshopSelectionMoveController,
} from "../../js/workshop/editing/workshop-selection-move-controller.mjs";

test("Move controller follows the locked nonvisual state order", () => {
  const controller = createWorkshopSelectionMoveController();
  const object = {};
  assert.equal(controller.getSnapshot().state, WORKSHOP_SELECTION_MOVE_STATES.INACTIVE);
  const armed = controller.arm([object]);
  assert.equal(armed.snapshot.state, WORKSHOP_SELECTION_MOVE_STATES.ARMED);
  assert.equal(Object.isFrozen(armed.snapshot.selection), true);
  assert.equal(controller.preview({ x:1, z:2 }, false).snapshot.state, "PREVIEW_INVALID");
  const preview = controller.preview({ x:2, z:3 }, true);
  assert.equal(preview.snapshot.state, "PREVIEW_VALID");
  assert.equal(controller.beginCommit(preview.snapshot.token).snapshot.state, "COMMITTING");
  assert.equal(controller.complete(preview.snapshot.token).snapshot.state, "COMPLETED");
});

test("invalid selection, invalid preview, and stale ownership fail atomically", () => {
  const controller = createWorkshopSelectionMoveController();
  assert.equal(controller.arm([]).code, "SELECTION_REQUIRED");
  assert.equal(controller.arm([{}], { x:NaN, z:0 }).code, "INVALID_ANCHOR");
  const armed = controller.arm([{}]);
  assert.equal(controller.beginCommit(armed.snapshot.token).code, "VALID_PREVIEW_REQUIRED");
  const preview = controller.preview({ x:1, z:1 }, true);
  controller.cancel();
  const before = controller.getSnapshot();
  assert.equal(controller.beginCommit(preview.snapshot.token).code, "STALE");
  assert.strictEqual(controller.getSnapshot().selection, before.selection);
  assert.equal(controller.getSnapshot().state, "CANCELLED");
});

test("Move controller freezes and preserves the grabbed anchor offset", () => {
  const controller = createWorkshopSelectionMoveController();
  const armed = controller.arm([{}], { x:0.25, z:-0.4 });
  assert.deepEqual(armed.snapshot.anchorOffset, { x:0.25, z:-0.4 });
  assert.equal(Object.isFrozen(armed.snapshot.anchorOffset), true);
  assert.equal(controller.arm(armed.snapshot.selection, { x:0.25, z:-0.4 }).code, "IDEMPOTENT");
  controller.reset();
  assert.deepEqual(controller.getSnapshot().anchorOffset, { x:0, z:0 });
});

test("repeated commands are idempotent and cleanup invalidates tokens", () => {
  const controller = createWorkshopSelectionMoveController();
  const selection = [{}];
  const first = controller.arm(selection);
  assert.equal(controller.arm(selection).code, "IDEMPOTENT");
  controller.preview({ x:1, z:1 }, true);
  controller.beginCommit(first.snapshot.token);
  assert.equal(controller.complete(first.snapshot.token).code, "COMPLETED");
  assert.equal(controller.complete(first.snapshot.token).code, "IDEMPOTENT");
  const oldToken = controller.getSnapshot().token;
  controller.reset();
  assert.notEqual(controller.getSnapshot().token, oldToken);
  assert.equal(controller.getSnapshot().state, "INACTIVE");
  assert.deepEqual(controller.getSnapshot().selection, []);
});
