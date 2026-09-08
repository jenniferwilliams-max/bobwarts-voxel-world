import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES,
  createWorkshopRuntimeController,
} from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness({ deferDrawerSecurity = false } = {}) {
  const events = [];
  const renders = [];
  let drawerSecurity;
  const controller = createWorkshopRuntimeController({
    emit: (name, detail) => events.push({ name, detail }),
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: ({ extended, poweredOn, complete }) => {
        extended(); poweredOn(); complete();
      },
      activateSmartBoardApplication: ({ complete }) => complete(),
      deployToolChest: ({ complete }) => complete(),
      settleWorkshopReady: ({ complete }) => complete(),
      secureDrawers: ({ complete }) => {
        if (deferDrawerSecurity) drawerSecurity = complete;
        else complete();
      },
      parkToolChest: ({ complete }) => complete(),
      clearSmartBoardApplication: ({ complete }) => complete(),
      retractSmartBoard: ({ poweredOff, complete }) => { poweredOff(); complete(); },
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        tableStandby(); tablePoweredOff(); standby(); poweredOff(); complete();
      },
      restoreProjectorShutdown: ({ complete }) => complete(),
      secureProjectorFault: ({ complete }) => complete(),
      secureTableFault: ({ complete }) => complete(),
      renderMeasurement: (entry) => renders.push(entry),
    },
  });
  const start = () => controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  });
  return {
    controller, events, renders, start,
    get drawerSecurity() { return drawerSecurity; },
  };
}

test("declares Measurement Assistant, Learning Mode, and read-only Notebook production", () => {
  const declaration = WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard;
  assert.match(declaration, /production Measurement Assistant application, read-only display/i);
  assert.match(declaration, /read-only Learning Mode/i);
  assert.match(declaration, /read-only Engineering Notebook lifecycle/i);
  assert.match(declaration, /general application-switching menu remains deferred/i);
  assert.doesNotMatch(declaration, /Learning Mode[^;]*remain deferred/i);
  assert.doesNotMatch(declaration, /application content remains deferred/i);
});

test("synchronizes changed selections while keeping exact repeats idempotent", () => {
  const h = harness();
  h.start();
  const firstObject = { uuid: "beam-1" };
  const secondObject = { uuid: "beam-2" };
  const first = h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "host",
    payload: { objectId: firstObject.uuid, objectMeasurable: true, objects: [firstObject] },
  });
  const repeat = h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "host",
    payload: { objectId: firstObject.uuid, objectMeasurable: true, objects: [firstObject] },
  });
  const changed = h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "host",
    payload: { objectId: secondObject.uuid, objectMeasurable: true, objects: [secondObject] },
  });
  assert.equal(first.ok, true);
  assert.equal(repeat.code, "IDEMPOTENT");
  assert.equal(changed.ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.deepEqual(h.renders.map(({ payload }) => payload.objectId), ["beam-1", "beam-2"]);
  assert.equal(h.events.filter(({ name }) => name === "measurement:object-selected").length, 2);
});

test("clears once and safely resets selection during completed shutdown", () => {
  const h = harness();
  h.start();
  h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "pointer",
    payload: { objectId: "beam-1", objectMeasurable: true, objects: [{}] },
  });
  const stop = h.controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  assert.equal(stop.ok, true);
  assert.equal(h.controller.getSnapshot().workshop, "OFF");
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.renders.at(-1).state, "IDLE");
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-cleared").length, 1);
});

test("shutdown cancellation and reversal preserve a still-active application selection", () => {
  const h = harness({ deferDrawerSecurity: true });
  h.start();
  const object = {};
  h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "pointer",
    payload: { objectId: "beam-1", objectMeasurable: true, objects: [object] },
  });
  const stop = h.controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  const staleDrawerSecurity = h.drawerSecurity;
  const staleSelection = h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "pointer",
    payload: { objectId: "beam-1", objectMeasurable: true, objects: [object] },
  });
  const restart = h.start();
  assert.equal(stop.ok, true);
  assert.equal(staleSelection.ok, false);
  assert.equal(restart.code, "REVERSING");
  assert.equal(staleDrawerSecurity(), false);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-cleared").length, 0);
});

test("fault invalidates a live selection exactly once and repeated fault is idempotent", () => {
  const h = harness();
  h.start();
  h.controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "keyboard",
    payload: { objectId: "beam-1", objectMeasurable: true, objects: [{}] },
  });
  assert.equal(h.controller.reportProjectorFault({ message: "test fault" }).ok, true);
  assert.equal(h.controller.reportProjectorFault({ message: "repeat" }).code, "IDEMPOTENT");
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.renders.at(-1).state, "IDLE");
  const invalidations = h.events.filter(({ name }) => name === "measurement:selection-invalidated");
  assert.equal(invalidations.length, 1);
  assert.equal(invalidations[0].detail.reason, "PROJECTOR_FAULT");
});

test("Notebook is selection-bound and arbitrary application switching stays unavailable", () => {
  const h = harness();
  h.start();
  assert.equal(h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" }).code,
    "MEASUREMENT_SELECTION_REQUIRED");
  assert.equal(h.controller.request({
    action: "SELECT_APPLICATION", input: "pointer", payload: { application: "ENGINEERING_NOTEBOOK" },
  }).code, "APPLICATION_NOT_APPROVED");
});
