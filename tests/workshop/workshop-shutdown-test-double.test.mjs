import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_SHUTDOWN_PLACEHOLDER_TIMING,
  createWorkshopShutdownTestDouble,
} from "../../js/workshop/runtime/workshop-shutdown-test-double.mjs";

function harness({ reduced = false } = {}) {
  const tasks = [];
  const driver = createWorkshopShutdownTestDouble({
    reducedMotion: () => reduced,
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false };
      tasks.push(task);
      return task;
    },
    cancelSchedule(task) { task.cancelled = true; },
  });
  return { driver, tasks };
}

test("contains no remaining shutdown placeholder stages", () => {
  assert.deepEqual(WORKSHOP_SHUTDOWN_PLACEHOLDER_TIMING, {});
  const { driver, tasks } = harness();
  assert.deepEqual(driver.getSnapshot(), { active: null, transitionId: null, duration: 0 });
  assert.equal(driver.cancel().code, "IDEMPOTENT");
  assert.equal(tasks.length, 0);
  assert.equal("retractSmartBoard" in driver, false);
});
