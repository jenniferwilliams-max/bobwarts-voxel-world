import test from "node:test";
import assert from "node:assert/strict";
import { createTableLifecycleSafety } from "../../js/workshop/table/table-lifecycle-safety.mjs";

function harness() {
  const calls = [];
  const pending = {};
  const lifecycle = createTableLifecycleSafety({
    activeView: {
      stopProjectionGrid({ complete, durationOverride }) {
        calls.push(`grid-stop:${durationOverride}`);
        pending.grid = complete;
        return { duration: durationOverride };
      },
      cancel() { calls.push("grid-cancel"); },
    },
    fieldView: {
      stopToPoweredOn({ complete }) {
        calls.push("field-stop");
        pending.field = complete;
        return { duration: 500 };
      },
      cancel() { calls.push("field-cancel"); },
    },
    powerView: {
      powerOff({ complete }) { calls.push("table-power-off"); pending.power = complete; },
      cancel() { calls.push("power-cancel"); },
    },
  });
  return { lifecycle, calls, pending };
}

test("stops grid and field before powering off the Table", () => {
  const { lifecycle, calls, pending } = harness();
  const events = [];
  lifecycle.shutdown({
    transitionId: "down-1",
    projectionStopped: () => { events.push("table:projection-stopped"); return true; },
    poweredOff: () => { events.push("table:powered-off"); return true; },
    complete: () => events.push("complete"),
  });
  assert.deepEqual(calls, ["field-stop", "grid-stop:400"]);
  pending.grid();
  assert.equal(calls.includes("table-power-off"), false);
  pending.field();
  assert.deepEqual(calls, ["field-stop", "grid-stop:400", "table-power-off"]);
  assert.deepEqual(events, ["table:projection-stopped"]);
  pending.power();
  assert.deepEqual(events, ["table:projection-stopped", "table:powered-off", "complete"]);
});

test("repeated shutdown is idempotent and callbacks claim once", () => {
  const { lifecycle, pending } = harness();
  let stopped = 0;
  let off = 0;
  assert.equal(lifecycle.shutdown({ transitionId: "down-2", projectionStopped: () => { stopped += 1; }, poweredOff: () => { off += 1; } }).code, "ACCEPTED");
  assert.equal(lifecycle.shutdown({ transitionId: "down-2" }).code, "IDEMPOTENT");
  pending.field(); pending.grid(); pending.field(); pending.grid(); pending.power(); pending.power();
  assert.deepEqual({ stopped, off }, { stopped: 1, off: 1 });
});

test("cancellation rejects stale shutdown callbacks and preserves rendered values", () => {
  const { lifecycle, calls, pending } = harness();
  let completed = 0;
  lifecycle.shutdown({ transitionId: "down-3", complete: () => { completed += 1; } });
  lifecycle.cancel();
  pending.grid(); pending.field();
  assert.equal(completed, 0);
  assert.deepEqual(calls.slice(-3), ["grid-cancel", "field-cancel", "power-cancel"]);
  assert.equal(lifecycle.active, false);
});

test("partial and reduced shutdown never let the grid lead the field by more than 100ms", () => {
  for (const fieldDuration of [500, 240, 150, 40, 0]) {
    let gridDuration = null;
    const lifecycle = createTableLifecycleSafety({
      fieldView: {
        stopToPoweredOn() { return { duration: fieldDuration }; },
        cancel() {},
      },
      activeView: {
        stopProjectionGrid(options) { gridDuration = options.durationOverride; },
        cancel() {},
      },
      powerView: { powerOff() {}, cancel() {} },
    });
    lifecycle.shutdown({ transitionId: `duration-${fieldDuration}` });
    assert.ok(gridDuration <= fieldDuration);
    assert.ok(fieldDuration - gridDuration <= 100);
  }
});
