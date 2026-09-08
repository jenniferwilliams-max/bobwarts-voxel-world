import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness() {
  const events = [];
  const pending = {};
  const controller = createWorkshopRuntimeController({
    emit: (name) => events.push(name),
    drivers: {
      powerOnProjector: ({ begin, complete }) => Object.assign(pending, { projectorBegin: begin, projectorPower: complete }),
      powerOnTable: ({ begin, complete }) => Object.assign(pending, { tableBegin: begin, tablePower: complete }),
      startProjectorProjection: ({ complete }) => { pending.projectionStart = complete; },
      startLegacyTableProjection: ({ stable }) => { pending.tableStable = stable; },
      settleProjectorProjection: ({ complete }) => { pending.projectorActive = complete; },
      activateSmartBoard: ({ complete }) => { pending.smartBoard = complete; },
      deployToolChest: ({ complete }) => { pending.toolChest = complete; },
      settleWorkshopReady: ({ complete }) => { pending.ready = complete; },
      secureDrawers: ({ complete }) => { pending.drawersSecured = complete; },
      parkToolChest: ({ complete }) => { pending.toolChestParked = complete; },
      retractSmartBoard: ({ complete }) => { pending.smartBoardRetracted = complete; },
      exitWorkshop: (callbacks) => Object.assign(pending, callbacks),
      restoreProjectorShutdown: ({ complete }) => { pending.restoreProjector = complete; },
      secureTableFault: ({ complete }) => { pending.tableFault = complete; },
    },
  });
  const begin = () => {
    controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
    pending.projectorBegin();
    pending.projectorPower();
  };
  const complete = () => {
    pending.tableBegin();
    pending.tablePower();
    pending.tableStable();
    pending.projectionStart();
    pending.projectorActive();
    pending.smartBoard();
    pending.toolChest();
    pending.ready();
  };
  return { controller, events, pending, begin, complete };
}

test("Table power completion is the sole gate before Projector projection", () => {
  const h = harness();
  h.begin();
  assert.equal(h.controller.getSnapshot().table, "POWERING_ON");
  assert.equal(h.pending.projectionStart, undefined);
  assert.equal(h.pending.tablePower(), true);
  assert.equal(h.controller.getSnapshot().table, "PROJECTION_STARTING");
  assert.equal(typeof h.pending.projectionStart, "function");
  assert.deepEqual(h.events.slice(0, 3), [
    "workshop:startup-begun", "projector:powered-on", "table:powered-on",
  ]);
  assert.equal(h.pending.tablePower(), false);
});

test("settled shutdown secures Table emitters before Projector completion", () => {
  const h = harness();
  h.begin();
  h.complete();
  h.controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  h.pending.drawersSecured(); h.pending.toolChestParked(); h.pending.smartBoardRetracted();
  assert.equal(h.pending.tableStandby(), true);
  assert.equal(h.controller.getSnapshot().table, "POWERED_ON");
  assert.equal(h.pending.tablePoweredOff(), true);
  assert.equal(h.controller.getSnapshot().table, "POWERED_OFF");
  assert.equal(h.pending.standby(), true);
  assert.equal(h.pending.poweredOff(), true);
  assert.equal(h.pending.complete(), true);
  assert.equal(h.controller.getSnapshot().workshop, "OFF");
  assert.deepEqual(h.events.slice(-9), [
    "workshop:shutdown-begun", "toolchest:drawers-secured", "toolchest:parked", "smartboard:app-changed", "smartboard:retracted",
    "table:projection-stopped", "table:powered-off", "projector:powered-off", "workshop:off",
  ]);
});

test("Table emitter failure enters FAULT_SAFE while Projector holds powered standby", () => {
  const h = harness();
  h.begin();
  const result = h.controller.reportTableFault({ message: "emitters unavailable" });
  assert.equal(result.code, "FAULT_SAFE");
  assert.equal(h.controller.getSnapshot().workshop, "FAULT_SAFE");
  assert.equal(h.controller.getSnapshot().table, "FAULT_SAFE");
  assert.equal(h.controller.getSnapshot().projector, "POWERED_ON");
  assert.equal(h.pending.tableFault(), true);
  h.controller.request({ action: "REQUEST_POWER_OFF", input: "host" });
  assert.equal(h.pending.tableFault(), true);
  assert.equal(h.controller.getSnapshot().workshop, "OFF");
  assert.equal(h.controller.getSnapshot().table, "POWERED_OFF");
  assert.equal(h.controller.getSnapshot().projector, "POWERED_OFF");
});
