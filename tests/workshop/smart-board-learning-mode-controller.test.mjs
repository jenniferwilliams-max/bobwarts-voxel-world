import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness({ deferDrawerSecurity = false } = {}) {
  const events = [];
  const renders = [];
  let learningEntry;
  let learningExit;
  let drawerSecurity;
  let learningCancels = 0;
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
      cancelLearningMode: () => { learningCancels += 1; },
    },
  });
  const start = () => controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  });
  const select = (object, objectId = "beam-1") => controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "pointer",
    payload: { objectId, objectMeasurable: true, objects: [object] },
  });
  return {
    controller, events, renders, start, select,
    get learningEntry() { return learningEntry; },
    get learningExit() { return learningExit; },
    get drawerSecurity() { return drawerSecurity; },
    get learningCancels() { return learningCancels; },
  };
}

test("requires selection and settles Learning Mode only through the render callback", () => {
  const h = harness();
  h.start();
  assert.equal(h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" }).code, "MEASUREMENT_SELECTION_REQUIRED");
  h.select({});
  const entered = h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  assert.equal(entered.ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.controller.request({ action: "ENTER_LEARNING_MODE", input: "touch" }).code, "IDEMPOTENT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:learning-mode-entered").length, 0);
  assert.equal(h.learningEntry.complete(), true);
  assert.equal(h.learningEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().measurement, "LEARNING_MODE");
  assert.equal(h.events.filter(({ name }) => name === "measurement:learning-mode-entered").length, 1);
});

test("Back settles to the selected object without clearing or reselecting it", () => {
  const h = harness();
  h.start();
  h.select({});
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "keyboard" });
  h.learningEntry.complete();
  const selectedEvents = h.events.filter(({ name }) => name === "measurement:object-selected").length;
  assert.equal(h.controller.request({ action: "EXIT_LEARNING_MODE", input: "keyboard" }).ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "LEARNING_MODE");
  assert.equal(h.learningExit.complete(), true);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:object-selected").length, selectedEvents);
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-cleared").length, 0);
});

test("a different selection or clearing exits Learning Mode and rejects stale completion", () => {
  const h = harness();
  h.start();
  const first = {};
  h.select(first, "beam-1");
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  const staleEntry = h.learningEntry;
  h.select({}, "beam-2");
  assert.equal(staleEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.learningCancels, 1);
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  h.learningEntry.complete();
  assert.equal(h.controller.request({ action: "CLEAR_SELECTION", input: "keyboard" }).ok, true);
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.renders.at(-1).state, "IDLE");
});

test("shutdown clears Learning Mode and reversal restores normal measurements", () => {
  const h = harness({ deferDrawerSecurity: true });
  h.start();
  h.select({});
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  h.learningEntry.complete();
  h.controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  const staleDrawer = h.drawerSecurity;
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.learningCancels, 1);
  const restart = h.start();
  assert.equal(restart.code, "REVERSING");
  assert.equal(staleDrawer(), false);
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:learning-mode-entered").length, 1);
});

test("fault invalidates selection and stale Learning Mode callbacks cannot reopen it", () => {
  const h = harness();
  h.start();
  h.select({});
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  const staleEntry = h.learningEntry;
  h.controller.reportProjectorFault({ message: "test fault" });
  assert.equal(staleEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-invalidated").length, 1);
});
