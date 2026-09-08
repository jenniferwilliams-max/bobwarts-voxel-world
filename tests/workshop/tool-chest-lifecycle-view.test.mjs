import test from "node:test";
import assert from "node:assert/strict";
import {
  TOOL_CHEST_LIFECYCLE,
  createToolChestLifecycleView,
} from "../../js/workshop/toolchest/tool-chest-lifecycle-view.mjs";

function harness({ reduced = false } = {}) {
  const listeners = new Map();
  const tasks = [];
  const root = {
    dataset: { cabinetState: "retracted" },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const cabinet = {};
  let renderedState = "retracted";
  const view = createToolChestLifecycleView({
    root,
    cabinet,
    setCabinetState(state) { root.dataset.cabinetState = state; },
    isAtEndpoint(state) { return renderedState === state; },
    reducedMotion: () => reduced,
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false };
      tasks.push(task);
      return task;
    },
    cancelSchedule(task) { task.cancelled = true; },
  });
  const finish = (state) => {
    renderedState = state;
    listeners.get("transitionend")?.({ target: cabinet, propertyName: "transform" });
  };
  const runFallbacks = () => tasks.forEach((task) => { if (!task.cancelled) task.callback(); });
  return { view, root, cabinet, tasks, finish, runFallbacks, setRendered: (state) => { renderedState = state; } };
}

test("declares the tracked Tool Chest endpoint and timing contract", () => {
  assert.deepEqual(TOOL_CHEST_LIFECYCLE, {
    property: "transform",
    deployedState: "expanded",
    parkedState: "retracted",
    normalDuration: 280,
    reducedDuration: 1,
  });
});

test("deployment and parking complete only at their rendered endpoints", () => {
  const h = harness();
  const completed = [];
  assert.equal(h.view.deploy({ transitionId: "up", complete: () => completed.push("up") }).code, "ACCEPTED");
  assert.equal(h.root.dataset.cabinetState, "expanded");
  h.runFallbacks();
  assert.deepEqual(completed, []);
  h.finish("expanded");
  assert.deepEqual(completed, ["up"]);
  assert.equal(h.view.park({ transitionId: "down", complete: () => completed.push("down") }).code, "ACCEPTED");
  h.finish("retracted");
  assert.deepEqual(completed, ["up", "down"]);
});

test("reversal rejects stale completion and settles the current visual target once", () => {
  const h = harness();
  const completed = [];
  h.view.deploy({ transitionId: "up", complete: () => completed.push("up") });
  assert.equal(h.view.park({ transitionId: "down", complete: () => completed.push("down") }).code, "REVERSING");
  h.finish("expanded");
  assert.deepEqual(completed, []);
  h.finish("retracted");
  h.finish("retracted");
  assert.deepEqual(completed, ["down"]);
});

test("repeated commands are idempotent and do not duplicate completion", () => {
  const h = harness();
  let count = 0;
  h.view.deploy({ transitionId: "up", complete: () => { count += 1; } });
  assert.equal(h.view.deploy({ transitionId: "up", complete: () => { count += 10; } }).code, "IDEMPOTENT");
  h.finish("expanded");
  assert.equal(count, 1);
});

test("late transition completion holds safely and reduced motion preserves callback", () => {
  const h = harness({ reduced: true });
  let completed = false;
  const result = h.view.deploy({ transitionId: "reduced", complete: () => { completed = true; } });
  assert.equal(result.duration, 1);
  h.runFallbacks();
  assert.equal(completed, false);
  h.finish("expanded");
  assert.equal(completed, true);
});

test("cancel and dispose reject stale transition events", () => {
  const h = harness();
  let count = 0;
  h.view.deploy({ transitionId: "up", complete: () => { count += 1; } });
  h.view.cancel();
  h.finish("expanded");
  assert.equal(count, 0);
  h.view.dispose();
  assert.equal(h.view.deploy({ transitionId: "later", complete: () => { count += 1; } }).code, "DISPOSED");
});
