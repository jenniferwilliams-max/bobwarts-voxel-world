import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES,
  WORKSHOP_UI_DRAWER_MAP,
  createWorkshopRuntimeController,
} from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness() {
  const events = [];
  const stateChanges = [];
  const pending = {};
  const controller = createWorkshopRuntimeController({
    emit: (name, detail) => events.push({ name, detail }),
    stateChanged: (snapshot) => stateChanges.push(snapshot),
    drivers: {
      powerOnProjector: ({ begin, complete }) => {
        pending.projectorBegin = begin;
        pending.projectorComplete = complete;
      },
      powerOnTable: ({ begin, complete }) => {
        pending.tableBegin = begin;
        pending.tablePower = complete;
      },
      startTableProjection: ({ complete }) => {
        pending.tableProjection = complete;
      },
      settleTableProjection: ({ complete }) => { pending.tableActive = complete; },
      startProjectorProjection: ({ complete }) => { pending.projectionStart = complete; },
      settleProjectorProjection: ({ complete }) => { pending.projectorActive = complete; },
      activateSmartBoard: ({ complete }) => { pending.smartBoard = complete; },
      deployToolChest: ({ complete }) => { pending.toolChest = complete; },
      settleWorkshopReady: ({ complete }) => { pending.ready = complete; },
      secureDrawers: ({ complete }) => { pending.drawersSecured = complete; },
      parkToolChest: ({ complete }) => { pending.toolChestParked = complete; },
      retractSmartBoard: ({ complete }) => { pending.smartBoardRetracted = complete; },
      restoreProjectorShutdown: ({ complete }) => { pending.restoreShutdown = complete; },
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        pending.tableStandby = tableStandby;
        pending.tablePoweredOff = tablePoweredOff;
        pending.standby = standby;
        pending.poweredOff = poweredOff;
        pending.exit = complete;
      },
      secureTableFault: ({ complete }) => { pending.tableFault = complete; },
      openDrawer: ({ complete }) => { pending.drawer = complete; },
      closeDrawer: ({ complete }) => { pending.drawer = complete; },
    },
  });
  return { controller, events, pending, stateChanges };
}

function completeStartup(pending) {
  assert.equal(pending.projectorBegin(), true);
  assert.equal(pending.projectorComplete(), true);
  assert.equal(pending.tableBegin(), true);
  assert.equal(pending.tablePower(), true);
  assert.equal(pending.projectionStart(), true);
  assert.equal(pending.tableProjection(), true);
  assert.equal(pending.tableActive(), true);
  assert.equal(pending.projectorActive(), true);
  assert.equal(pending.smartBoard(), true);
  assert.equal(pending.toolChest(), true);
  assert.equal(pending.ready(), true);
}

function beginProjectionShutdown(pending) {
  assert.equal(pending.drawersSecured(), true);
  assert.equal(pending.toolChestParked(), true);
  assert.equal(pending.smartBoardRetracted(), true);
}

test("starts from deterministic protected states", () => {
  assert.deepEqual(harness().controller.getSnapshot(), {
    workshop: "OFF", projector: "POWERED_OFF", table: "POWERED_OFF",
    boardMechanical: "RETRACTED", boardPower: "POWERED_OFF", boardApplication: "NONE",
    chest: "PARKED", measurement: "IDLE",
    drawers: {
      D1_MEASURE: "CLOSED", D2_BUILD: "CLOSED", D3_MATERIALS: "CLOSED",
      D4_COMPONENTS: "CLOSED", D5_NOTEBOOK: "CLOSED", D6_UTILITY: "CLOSED",
    },
    activeDrawer: null, busy: false,
    disabled: { powerOn: false, powerOff: true, drawers: true, measurement: true },
    activeTransitionId: null,
    timingCompliance: "ws016-top-level-controller",
  });
});

test("identifies the read-only Smart Board applications as production", () => {
  assert.deepEqual(Object.keys(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES), ["smartboard"]);
  assert.match(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard, /production Measurement Assistant application/i);
  assert.match(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard, /read-only Learning Mode/i);
  assert.match(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard, /read-only Engineering Notebook lifecycle/i);
  assert.match(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard, /general application-switching menu remains deferred/i);
  assert.doesNotMatch(WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard, /Learning Mode[^;]*remain deferred/i);
});

test("power-on changes visuals only through the accepted driver and settles once", () => {
  const { controller, events, pending } = harness();
  const result = controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(result.ok, true);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(controller.getSnapshot().projector, "POWERED_OFF");
  assert.deepEqual(events.map((event) => event.name), ["workshop:startup-begun"]);
  assert.equal(pending.projectorBegin(), true);
  assert.equal(controller.getSnapshot().projector, "POWERING_ON");
  assert.equal(pending.projectorComplete(), true);
  assert.equal(controller.getSnapshot().projector, "POWERED_ON");
  assert.deepEqual(events.map((event) => event.name), ["workshop:startup-begun", "projector:powered-on"]);
  assert.equal(pending.projectorComplete(), false);
  assert.equal(pending.tableBegin(), true);
  assert.equal(controller.getSnapshot().table, "POWERING_ON");
  assert.equal(pending.tablePower(), true);
  assert.equal(controller.getSnapshot().table, "PROJECTION_STARTING");
  assert.equal(controller.getSnapshot().projector, "PROJECTION_STARTING");
  assert.equal(pending.tableProjection(), true);
  assert.equal(pending.tableProjection(), false);
  assert.equal(controller.getSnapshot().table, "PROJECTION_STARTING");
  assert.equal(pending.projectionStart(), true);
  assert.equal(pending.projectionStart(), false);
  assert.equal(controller.getSnapshot().table, "PROJECTION_STARTING");
  assert.equal(pending.tableActive(), true);
  assert.equal(controller.getSnapshot().table, "FULLY_ACTIVE");
  assert.equal(pending.tableActive(), false);
  assert.equal(pending.projectorActive(), true);
  assert.equal(pending.projectorActive(), false);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(controller.getSnapshot().disabled.drawers, true);
  assert.equal(pending.smartBoard(), true);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(pending.smartBoard(), false);
  assert.equal(pending.toolChest(), true);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(pending.toolChest(), false);
  assert.equal(pending.ready(), true);
  assert.equal(pending.ready(), false);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.deepEqual(events.map((event) => event.name), [
    "workshop:startup-begun",
    "projector:powered-on",
    "table:powered-on",
    "table:projection-started",
    "projector:projection-started",
    "workspace:projection-stable",
    "projector:active",
    "smartboard:extended",
    "smartboard:powered-on",
    "smartboard:app-changed",
    "smartboard:ready",
    "toolchest:deployed",
    "workshop:ready",
  ]);
});

test("power-on rejects missing asset readiness without invoking a driver", () => {
  const { controller, pending } = harness();
  const result = controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: false } });
  assert.equal(result.ok, false);
  assert.equal(result.code, "STARTUP_GUARD_FAILED");
  assert.equal(pending.projectorBegin, undefined);
});

test("shutdown cancels an unsettled startup transition", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  const staleBegin = pending.projectorBegin;
  const staleCompletion = pending.projectorComplete;
  const result = controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(result.ok, true);
  assert.equal(staleBegin(), false);
  assert.equal(staleCompletion(), false);
  beginProjectionShutdown(pending);
  assert.equal(pending.exit(), true);
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.deepEqual(events.map((event) => event.name), [
    "workshop:startup-begun", "workshop:shutdown-begun",
    "toolchest:drawers-secured", "toolchest:parked", "smartboard:retracted", "workshop:off",
  ]);
});

test("maps every current Tool Chest drawer to its approved logical drawer", () => {
  assert.deepEqual(WORKSHOP_UI_DRAWER_MAP, {
    shapes: "D2_BUILD",
    "colors-materials": "D3_MATERIALS",
    "parts-objects": "D4_COMPONENTS",
    favorites: "D6_UTILITY",
  });
  const { controller, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  const open = controller.request({ action: "OPEN_DRAWER", input: "pointer", payload: { uiDrawer: "shapes" } });
  assert.equal(open.ok, true);
  pending.drawer();
  assert.equal(controller.getSnapshot().drawers.D2_BUILD, "OPEN");
});

test("requires close completion before opening a different drawer", () => {
  const { controller, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  controller.request({ action: "OPEN_DRAWER", input: "pointer", payload: { uiDrawer: "colors-materials" } });
  pending.drawer();
  assert.equal(controller.request({ action: "OPEN_DRAWER", input: "pointer", payload: { uiDrawer: "parts-objects" } }).code, "DRAWER_CLOSE_REQUIRED");
  controller.request({ action: "CLOSE_DRAWER", input: "pointer", payload: { uiDrawer: "colors-materials" } });
  pending.drawer();
  assert.equal(controller.request({ action: "OPEN_DRAWER", input: "pointer", payload: { uiDrawer: "parts-objects" } }).ok, true);
});

test("routes measurement selection through READY guards without changing geometry", () => {
  const { controller, pending } = harness();
  const object = Object.freeze({ id: "beam-1", width: 2 });
  assert.equal(controller.request({ action: "SELECT_MEASURABLE_OBJECT", input: "pointer", payload: { objectId: object.id, objectMeasurable: true } }).ok, false);
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  assert.equal(controller.request({ action: "SELECT_MEASURABLE_OBJECT", input: "pointer", payload: { objectId: object.id, objectMeasurable: true } }).ok, true);
  assert.deepEqual(object, { id: "beam-1", width: 2 });
  assert.equal(controller.request({ action: "CLEAR_SELECTION", input: "keyboard", payload: {} }).ok, true);
});

test("reports invalid and unwired actions without throwing", () => {
  const { controller } = harness();
  assert.equal(controller.request({ action: "CLICK", input: "pointer" }).code, "INVALID_ACTION");
  assert.equal(controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" }).code, "MEASUREMENT_SELECTION_REQUIRED");
});

test("requires both readiness branches and emits real Table stability once", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  pending.projectorBegin(); pending.projectorComplete(); pending.tableBegin(); pending.tablePower();
  assert.equal(pending.tableProjection(), true);
  assert.equal(pending.tableProjection(), false);
  assert.equal(events.filter((event) => event.name === "table:projection-started").length, 1);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(events.some((event) => event.name === "workspace:projection-stable"), false);
  assert.equal(pending.tableActive(), true);
  assert.equal(controller.getSnapshot().table, "FULLY_ACTIVE");
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  pending.projectionStart(); pending.projectorActive();
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  pending.smartBoard(); pending.toolChest(); pending.ready();
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.equal(events.filter((event) => event.name === "workspace:projection-stable").length, 1);
});

test("labels genuine WS-014 stability at the Fully Active rendered endpoint", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  pending.projectorBegin(); pending.projectorComplete(); pending.tableBegin(); pending.tablePower();
  pending.tableProjection();
  assert.equal(events.some((event) => event.name === "workspace:projection-stable"), false);
  pending.tableActive(); pending.projectionStart(); pending.projectorActive();
  pending.smartBoard(); pending.toolChest(); pending.ready();
  assert.equal(controller.getSnapshot().table, "FULLY_ACTIVE");
  const stable = events.find((event) => event.name === "workspace:projection-stable");
  assert.deepEqual(
    { timingCompliance: stable.detail.timingCompliance, visualState: stable.detail.visualState, temporaryCompatibility: stable.detail.temporaryCompatibility },
    { timingCompliance: "ws014-table-fully-active", visualState: "FULLY_ACTIVE", temporaryCompatibility: false },
  );
});

test("rejects stale Table, Projector, and active-settle callbacks after cancellation", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  pending.projectorBegin(); pending.projectorComplete(); pending.tableBegin(); pending.tablePower();
  const staleTable = pending.tableProjection;
  const staleProjector = pending.projectionStart;
  staleTable();
  const staleActive = pending.tableActive;
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  beginProjectionShutdown(pending);
  assert.equal(staleTable(), false);
  assert.equal(staleProjector(), false);
  assert.equal(staleActive(), false);
  assert.equal(events.some((event) => event.name === "workspace:projection-stable"), false);
});

test("shutdown publishes Table projection stop before Table and Projector power-off", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(
    controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } }).code,
    "IDEMPOTENT",
  );
  beginProjectionShutdown(pending);
  assert.equal(pending.tableStandby(), true);
  assert.equal(pending.tablePoweredOff(), true);
  assert.equal(pending.standby(), true);
  assert.equal(pending.poweredOff(), true);
  assert.equal(pending.exit(), true);
  const shutdownEvents = events.map((event) => event.name).slice(-9);
  assert.deepEqual(shutdownEvents, [
    "workshop:shutdown-begun",
    "toolchest:drawers-secured",
    "toolchest:parked",
    "smartboard:app-changed",
    "smartboard:retracted",
    "table:projection-stopped",
    "table:powered-off",
    "projector:powered-off",
    "workshop:off",
  ]);
});

test("shutdown reversal rejects stale pre-projection child callbacks", () => {
  const { controller, events, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  const shutdown = controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  const staleDrawers = pending.drawersSecured;
  const restart = controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  });
  assert.equal(restart.code, "REVERSING");
  assert.notEqual(restart.transitionId, shutdown.transitionId);
  assert.equal(staleDrawers(), false);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(controller.getSnapshot().disabled.drawers, true);
  assert.equal(events.filter((event) => event.name === "toolchest:drawers-secured").length, 0);
  assert.equal(pending.restoreShutdown(), true);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
});

test("publishes canonical top-level state and busy snapshots without host-only states", () => {
  const { controller, pending, stateChanges } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.deepEqual(
    { workshop: stateChanges.at(-1).workshop, busy: stateChanges.at(-1).busy },
    { workshop: "STARTING", busy: true },
  );
  completeStartup(pending);
  assert.deepEqual(
    { workshop: stateChanges.at(-1).workshop, busy: stateChanges.at(-1).busy },
    { workshop: "READY", busy: false },
  );
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.deepEqual(
    { workshop: stateChanges.at(-1).workshop, busy: stateChanges.at(-1).busy },
    { workshop: "SHUTTING_DOWN", busy: true },
  );
  beginProjectionShutdown(pending);
  pending.tableStandby(); pending.tablePoweredOff(); pending.standby(); pending.poweredOff(); pending.exit();
  assert.deepEqual(
    { workshop: stateChanges.at(-1).workshop, busy: stateChanges.at(-1).busy },
    { workshop: "OFF", busy: false },
  );
  assert.equal(stateChanges.some(({ workshop }) => ["LOADING", "ACTIVE", "FAILED", "STOPPING"].includes(workshop)), false);
});

test("missing required lifecycle drivers fail closed without changing canonical state", () => {
  const startup = createWorkshopRuntimeController({ drivers: {} });
  const start = startup.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(start.code, "REQUIRED_DRIVER_UNAVAILABLE");
  assert.equal(startup.getSnapshot().workshop, "OFF");
  assert.equal(startup.getSnapshot().busy, false);

  const { controller, pending } = harness();
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  completeStartup(pending);
  const noExit = createWorkshopRuntimeController({
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
      secureDrawers: ({ complete }) => complete(),
      parkToolChest: ({ complete }) => complete(),
      retractSmartBoard: ({ complete }) => complete(),
    },
  });
  noExit.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(noExit.getSnapshot().workshop, "READY");
  const stop = noExit.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(stop.code, "REQUIRED_DRIVER_UNAVAILABLE");
  assert.equal(noExit.getSnapshot().workshop, "READY");
  assert.equal(noExit.getSnapshot().busy, false);
});

test("RESET_FAULT is explicit and cannot bypass dependency-safe power-off", () => {
  const { controller, pending } = harness();
  controller.reportProjectorFault({ message: "test fault" });
  const before = controller.getSnapshot();
  const reset = controller.request({ action: "RESET_FAULT", input: "host" });
  assert.equal(reset.code, "RESET_FAULT_REQUIRES_POWER_OFF");
  assert.equal(controller.getSnapshot().workshop, "FAULT_SAFE");
  assert.equal(controller.getSnapshot().activeTransitionId, before.activeTransitionId);
  assert.equal(pending.projectorBegin, undefined);
});

test("presentation observer failures never gate canonical transitions", () => {
  const events = [];
  const controller = createWorkshopRuntimeController({
    stateChanged: () => { throw new Error("presentation unavailable"); },
    emit: (name) => events.push(name),
    drivers: {
      powerOnProjector: ({ begin }) => begin(),
      powerOnTable() {},
      startTableProjection() {},
      settleTableProjection() {},
      startProjectorProjection() {},
      settleProjectorProjection() {},
      activateSmartBoard() {},
      deployToolChest() {},
      settleWorkshopReady() {},
    },
  });
  const result = controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(result.ok, true);
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.deepEqual(events, ["workshop:startup-begun"]);
});
