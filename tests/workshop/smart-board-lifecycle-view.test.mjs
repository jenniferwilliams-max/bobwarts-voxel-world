import test from "node:test";
import assert from "node:assert/strict";
import {
  SMART_BOARD_LIFECYCLE,
  createSmartBoardLifecycleView,
} from "../../js/workshop/smartboard/smart-board-lifecycle-view.mjs";

function harness({ reduced = false } = {}) {
  const listeners = new Map();
  const tasks = [];
  const frames = [];
  let mechanicalEndpoint = "retracted";
  let powerEndpoint = "powered-off";
  const root = {
    dataset: { boardMechanical: "retracted", boardPower: "powered-off" },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const cabinet = {};
  const screen = {};
  const view = createSmartBoardLifecycleView({
    root,
    cabinet,
    screen,
    setMechanicalState(state) { root.dataset.boardMechanical = state; },
    setPowerState(state) { root.dataset.boardPower = state; },
    reducedMotion: () => reduced,
    isAtMechanicalEndpoint: (target) => mechanicalEndpoint === target,
    isAtPowerEndpoint: (target) => powerEndpoint === target,
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false };
      tasks.push(task);
      return task;
    },
    cancelSchedule(task) { task.cancelled = true; },
    requestFrame(callback) {
      const frame = { callback, cancelled: false };
      frames.push(frame);
      return frame;
    },
    cancelFrame(frame) { frame.cancelled = true; },
  });
  const transition = (target, propertyName) => listeners.get("transitionend")?.({ target, propertyName });
  const runFrame = () => {
    const frame = frames.shift();
    if (frame && !frame.cancelled) frame.callback();
  };
  return {
    root, cabinet, screen, view, tasks, frames, transition, runFrame,
    setMechanicalEndpoint(value) { mechanicalEndpoint = value; },
    setPowerEndpoint(value) { powerEndpoint = value; },
  };
}

test("activates only through rendered extension, screen power, and two stable frames", () => {
  const h = harness();
  const events = [];
  assert.equal(h.view.activate({
    transitionId: "start-1",
    extended: () => { events.push("extended"); return true; },
    poweredOn: () => { events.push("powered-on"); return true; },
    complete: () => { events.push("ready"); return true; },
  }).code, "ACCEPTED");
  assert.equal(h.root.dataset.boardMechanical, "extending");
  h.transition(h.cabinet, "transform");
  assert.deepEqual(events, []);
  h.setMechanicalEndpoint("extended");
  h.transition(h.cabinet, "transform");
  assert.deepEqual(events, ["extended"]);
  assert.equal(h.root.dataset.boardPower, "powering-on");
  h.setPowerEndpoint("ready");
  h.transition(h.screen, "opacity");
  assert.deepEqual(events, ["extended", "powered-on"]);
  assert.equal(h.root.dataset.boardPower, "ready");
  h.runFrame();
  assert.deepEqual(events, ["extended", "powered-on"]);
  h.runFrame();
  assert.deepEqual(events, ["extended", "powered-on", "ready"]);
  assert.equal(h.view.getSnapshot().activeMode, null);
});

test("powers the empty screen off before beginning rendered retraction", () => {
  const h = harness();
  h.root.dataset.boardMechanical = "extended";
  h.root.dataset.boardPower = "ready";
  h.setMechanicalEndpoint("extended");
  h.setPowerEndpoint("ready");
  const events = [];
  h.view.retract({
    transitionId: "stop-1",
    poweredOff: () => { events.push("powered-off"); return true; },
    complete: () => { events.push("retracted"); return true; },
  });
  assert.equal(h.root.dataset.boardPower, "powering-off");
  assert.equal(h.root.dataset.boardMechanical, "extended");
  h.transition(h.cabinet, "transform");
  assert.deepEqual(events, []);
  h.setPowerEndpoint("powered-off");
  h.transition(h.screen, "opacity");
  assert.deepEqual(events, ["powered-off"]);
  assert.equal(h.root.dataset.boardMechanical, "retracting");
  h.setMechanicalEndpoint("retracted");
  h.transition(h.cabinet, "transform");
  assert.deepEqual(events, ["powered-off", "retracted"]);
  assert.equal(h.root.dataset.boardMechanical, "retracted");
});

test("reversal rejects stale work and repeated commands are idempotent", () => {
  const h = harness();
  let stale = 0;
  h.view.activate({ transitionId: "start-old", complete: () => { stale += 1; } });
  assert.equal(h.view.activate({ transitionId: "start-old" }).code, "IDEMPOTENT");
  assert.equal(h.view.retract({ transitionId: "stop-new" }).code, "REVERSING");
  h.setMechanicalEndpoint("extended");
  h.transition(h.cabinet, "transform");
  h.tasks.forEach((task) => { if (!task.cancelled) task.callback(); });
  assert.equal(stale, 0);
  assert.equal(h.view.getSnapshot().transitionId, "stop-new");
  h.view.cancel();
  assert.equal(h.view.getSnapshot().activeMode, null);
});

test("rendered target endpoints settle idempotently without restarting motion", () => {
  const ready = harness();
  ready.root.dataset.boardMechanical = "extended";
  ready.root.dataset.boardPower = "ready";
  ready.setMechanicalEndpoint("extended");
  ready.setPowerEndpoint("ready");
  const activated = [];
  assert.equal(ready.view.activate({
    transitionId: "already-ready",
    extended: () => activated.push("extended"),
    poweredOn: () => activated.push("powered-on"),
    complete: () => activated.push("ready"),
  }).code, "IDEMPOTENT");
  assert.deepEqual(activated, ["extended", "powered-on", "ready"]);
  assert.equal(ready.tasks.length, 0);

  const off = harness();
  const retracted = [];
  assert.equal(off.view.retract({
    transitionId: "already-off",
    poweredOff: () => retracted.push("powered-off"),
    complete: () => retracted.push("retracted"),
  }).code, "IDEMPOTENT");
  assert.deepEqual(retracted, ["powered-off", "retracted"]);
  assert.equal(off.tasks.length, 0);
});

test("reduced motion keeps endpoint verification and lifecycle callbacks", () => {
  const h = harness({ reduced: true });
  const events = [];
  h.view.activate({
    transitionId: "reduced-start",
    extended: () => { events.push("extended"); return true; },
    poweredOn: () => { events.push("powered-on"); return true; },
    complete: () => { events.push("ready"); return true; },
  });
  assert.equal(h.tasks[0].delay, SMART_BOARD_LIFECYCLE.reducedDuration + 50);
  h.setMechanicalEndpoint("extended");
  h.tasks[0].callback();
  h.setPowerEndpoint("ready");
  h.tasks[1].callback();
  h.runFrame(); h.runFrame();
  assert.deepEqual(events, ["extended", "powered-on", "ready"]);
});

test("dispose removes the listener and permanently rejects commands", () => {
  const h = harness();
  h.view.dispose();
  assert.equal(h.view.activate({ transitionId: "late" }).code, "DISPOSED");
  assert.equal(h.view.retract({ transitionId: "late" }).code, "DISPOSED");
});
