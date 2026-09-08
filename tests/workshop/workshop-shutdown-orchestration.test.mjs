import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function timedHarness({ toolChestDelay = 400 } = {}) {
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
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: ({ complete }) => complete(),
      deployToolChest: ({ complete }) => complete(),
      settleWorkshopReady: ({ complete }) => complete(),
      secureDrawers: ({ complete }) => schedule(200, complete),
      parkToolChest: ({ complete }) => schedule(toolChestDelay, complete),
      retractSmartBoard: ({ complete }) => schedule(400, complete),
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        tableStandby(); tablePoweredOff(); standby(); poweredOff(); complete();
      },
    },
  });
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  return { controller, events, runTo };
}

const eventTime = (events, name) => events.find((event) => event.name === name)?.at;

test("orchestrates the locked eight-stage nominal shutdown timeline", () => {
  const { controller, events, runTo } = timedHarness();
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(controller.getSnapshot().workshop, "SHUTTING_DOWN");
  assert.equal(controller.getSnapshot().disabled.drawers, true);
  runTo(999);
  assert.equal(controller.getSnapshot().workshop, "SHUTTING_DOWN");
  runTo(1000);
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.deepEqual({
    shutdown: eventTime(events, "workshop:shutdown-begun"),
    drawers: eventTime(events, "toolchest:drawers-secured"),
    toolchest: eventTime(events, "toolchest:parked"),
    smartboard: eventTime(events, "smartboard:retracted"),
    projection: eventTime(events, "table:projection-stopped"),
    table: eventTime(events, "table:powered-off"),
    projector: eventTime(events, "projector:powered-off"),
    off: eventTime(events, "workshop:off"),
  }, {
    shutdown: 0,
    drawers: 200,
    toolchest: 600,
    smartboard: 1000,
    projection: 1000,
    table: 1000,
    projector: 1000,
    off: 1000,
  });
});

test("late children hold all dependent shutdown stages without catch-up", () => {
  const { controller, events, runTo } = timedHarness({ toolChestDelay: 650 });
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  runTo(1249);
  assert.equal(controller.getSnapshot().workshop, "SHUTTING_DOWN");
  runTo(1250);
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.deepEqual([
    eventTime(events, "toolchest:drawers-secured"),
    eventTime(events, "toolchest:parked"),
    eventTime(events, "smartboard:retracted"),
    eventTime(events, "table:projection-stopped"),
  ], [200, 850, 1250, 1250]);
});
