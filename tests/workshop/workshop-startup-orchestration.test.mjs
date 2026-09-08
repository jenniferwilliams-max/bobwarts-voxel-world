import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function timedHarness({ projectorDelay = 500 } = {}) {
  let now = 0;
  let serial = 0;
  const tasks = [];
  const events = [];
  const schedule = (delay, callback) => tasks.push({ at: now + delay, serial: ++serial, callback });
  const runTo = (target) => {
    while (true) {
      tasks.sort((a, b) => a.at - b.at || a.serial - b.serial);
      const task = tasks[0];
      if (!task || task.at > target) break;
      tasks.shift();
      now = task.at;
      task.callback();
    }
    now = target;
  };
  const controller = createWorkshopRuntimeController({
    emit: (name) => events.push({ name, at: now }),
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); schedule(projectorDelay, complete); },
      powerOnTable: ({ begin, complete }) => { begin(); schedule(400, complete); },
      startTableProjection: ({ complete }) => schedule(500, complete),
      settleTableProjection: ({ complete }) => schedule(300, complete),
      startProjectorProjection: ({ complete }) => schedule(500, complete),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: ({ complete }) => schedule(400, complete),
      deployToolChest: ({ complete }) => schedule(400, complete),
      settleWorkshopReady: ({ complete }) => schedule(200, complete),
    },
  });
  return { controller, events, runTo };
}

const eventTime = (events, name) => events.find((event) => event.name === name)?.at;

test("orchestrates the locked eight-stage nominal startup timeline", () => {
  const { controller, events, runTo } = timedHarness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  runTo(2699);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(controller.getSnapshot().disabled.drawers, true);
  runTo(2700);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.deepEqual({
    startup: eventTime(events, "workshop:startup-begun"),
    projector: eventTime(events, "projector:powered-on"),
    table: eventTime(events, "table:powered-on"),
    projection: eventTime(events, "table:projection-started"),
    stable: eventTime(events, "workspace:projection-stable"),
    smartboard: eventTime(events, "smartboard:ready"),
    toolchest: eventTime(events, "toolchest:deployed"),
    ready: eventTime(events, "workshop:ready"),
  }, {
    startup: 0,
    projector: 500,
    table: 900,
    projection: 1400,
    stable: 1700,
    smartboard: 2100,
    toolchest: 2500,
    ready: 2700,
  });
});

test("late children hold every dependent stage without catch-up or reordering", () => {
  const { controller, events, runTo } = timedHarness({ projectorDelay: 700 });
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  runTo(2899);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  runTo(2900);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.deepEqual([
    eventTime(events, "projector:powered-on"),
    eventTime(events, "table:powered-on"),
    eventTime(events, "table:projection-started"),
    eventTime(events, "workspace:projection-stable"),
    eventTime(events, "smartboard:ready"),
    eventTime(events, "toolchest:deployed"),
    eventTime(events, "workshop:ready"),
  ], [700, 1100, 1600, 1900, 2300, 2700, 2900]);
});
