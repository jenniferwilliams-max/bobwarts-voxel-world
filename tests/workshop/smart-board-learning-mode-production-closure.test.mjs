import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES,
  createWorkshopRuntimeController,
} from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness({ deferDrawerSecurity = false } = {}) {
  const events = [];
  const renders = [];
  let learningEntry;
  let learningExit;
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
      activateSmartBoard: ({ extended, poweredOn, complete }) => { extended(); poweredOn(); complete(); },
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
      renderMeasurement: (entry) => renders.push(entry),
      renderLearningMode: (entry) => { learningEntry = entry; },
      clearLearningMode: (entry) => { learningExit = entry; },
      cancelLearningMode: () => {},
    },
  });
  const start = () => controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  });
  const select = (objectId = "beam-1", objects = [{}]) => controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "pointer",
    payload: { objectId, objectMeasurable: true, objects },
  });
  return {
    controller, events, renders, start, select,
    get learningEntry() { return learningEntry; },
    get learningExit() { return learningExit; },
    get drawerSecurity() { return drawerSecurity; },
  };
}

test("keeps Learning Mode production while the read-only Notebook lifecycle is connected", () => {
  const declaration = WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES.smartboard;
  assert.match(declaration, /production Measurement Assistant application, read-only display, read-only Learning Mode/i);
  assert.match(declaration, /read-only Engineering Notebook lifecycle/i);
  assert.match(declaration, /general application-switching menu remains deferred/i);
  assert.doesNotMatch(declaration, /Learning Mode[^;]*remain deferred/i);
  const h = harness();
  h.start();
  assert.equal(h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" }).code,
    "MEASUREMENT_SELECTION_REQUIRED");
});

test("production entry and Back remain selection-bound and render-settled", () => {
  const h = harness();
  h.start();
  assert.equal(h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" }).code, "MEASUREMENT_SELECTION_REQUIRED");
  h.select("group-1", [{}, {}]);
  const selectedEvents = h.events.filter(({ name }) => name === "measurement:object-selected").length;
  assert.equal(h.controller.request({ action: "ENTER_LEARNING_MODE", input: "touch" }).ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.learningEntry.complete(), true);
  assert.equal(h.learningEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().measurement, "LEARNING_MODE");
  assert.equal(h.events.filter(({ name }) => name === "measurement:learning-mode-entered").length, 1);
  assert.equal(h.controller.request({ action: "EXIT_LEARNING_MODE", input: "keyboard" }).ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "LEARNING_MODE");
  assert.equal(h.learningExit.complete(), true);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:object-selected").length, selectedEvents);
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-cleared").length, 0);
});

test("changed and cleared selections leave Learning Mode without stale re-entry", () => {
  const h = harness();
  h.start();
  h.select();
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  const staleEntry = h.learningEntry;
  h.select("beam-2");
  assert.equal(staleEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.renders.at(-1).payload.objectId, "beam-2");
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  h.learningEntry.complete();
  assert.equal(h.controller.request({ action: "CLEAR_SELECTION", input: "keyboard" }).ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.renders.at(-1).state, "IDLE");
});

test("shutdown reversal restores measurements and faults reject stale Learning Mode callbacks", () => {
  const reversing = harness({ deferDrawerSecurity: true });
  reversing.start();
  reversing.select();
  reversing.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  reversing.learningEntry.complete();
  reversing.controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  const staleDrawerSecurity = reversing.drawerSecurity;
  assert.equal(reversing.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(reversing.start().code, "REVERSING");
  assert.equal(staleDrawerSecurity(), false);
  assert.equal(reversing.controller.getSnapshot().measurement, "SELECTED_OBJECT");

  const faulted = harness();
  faulted.start();
  faulted.select();
  faulted.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  const staleLearningEntry = faulted.learningEntry;
  assert.equal(faulted.controller.reportProjectorFault({ message: "test fault" }).ok, true);
  assert.equal(staleLearningEntry.complete(), false);
  assert.equal(faulted.controller.getSnapshot().measurement, "IDLE");
  assert.equal(faulted.events.filter(({ name }) => name === "measurement:selection-invalidated").length, 1);
});
