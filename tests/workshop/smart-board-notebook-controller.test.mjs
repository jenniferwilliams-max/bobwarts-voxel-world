import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness({ deferDrawerSecurity = false } = {}) {
  const events = [];
  const renders = [];
  let notebookEntry;
  let notebookExit;
  let learningEntry;
  let drawerSecurity;
  let notebookCancels = 0;
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
      secureDrawers: ({ complete }) => { if (deferDrawerSecurity) drawerSecurity = complete; else complete(); },
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
      clearLearningMode: ({ complete }) => complete(),
      cancelLearningMode: () => {},
      renderNotebook: (entry) => { notebookEntry = entry; },
      clearNotebook: (entry) => { notebookExit = entry; },
      cancelNotebook: () => { notebookCancels += 1; },
      showNotebookMeasurements: () => {},
    },
  });
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  const select = (objectId = "beam-1", objects = [{}]) => controller.request({
    action: "SELECT_MEASURABLE_OBJECT", input: "host",
    payload: { objectId, objectMeasurable: true, objects },
  });
  return {
    controller, events, renders, select,
    get notebookEntry() { return notebookEntry; },
    get notebookExit() { return notebookExit; },
    get learningEntry() { return learningEntry; },
    get drawerSecurity() { return drawerSecurity; },
    get notebookCancels() { return notebookCancels; },
  };
}

test("Notebook entry settles canonical states and events only after the render callback", () => {
  const h = harness();
  assert.equal(h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" }).code,
    "MEASUREMENT_SELECTION_REQUIRED");
  h.select("group", [{}, {}]);
  const opened = h.controller.request({ action: "OPEN_NOTEBOOK", input: "touch" });
  assert.equal(opened.ok, true);
  assert.equal(h.controller.getSnapshot().boardApplication, "APPLICATION_SWITCHING");
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.controller.request({ action: "OPEN_NOTEBOOK", input: "keyboard" }).code, "IDEMPOTENT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:notebook-opened").length, 0);
  assert.equal(h.notebookEntry.complete(), true);
  assert.equal(h.notebookEntry.complete(), false);
  assert.equal(h.controller.getSnapshot().boardApplication, "ENGINEERING_NOTEBOOK");
  assert.equal(h.controller.getSnapshot().measurement, "ENGINEERING_NOTEBOOK");
  const lifecycleEvents = h.events.filter(({ name }) =>
    name === "smartboard:app-changed" || name === "measurement:notebook-opened");
  assert.deepEqual(lifecycleEvents.slice(-2).map(({ name }) => name), [
    "smartboard:app-changed", "measurement:notebook-opened",
  ]);
  assert.equal(lifecycleEvents.at(-1).detail.selectionCount, 2);
});

test("Learning Mode hands off to Notebook and Back preserves selection", () => {
  const h = harness();
  h.select();
  h.controller.request({ action: "ENTER_LEARNING_MODE", input: "pointer" });
  h.learningEntry.complete();
  h.controller.request({ action: "OPEN_NOTEBOOK", input: "keyboard" });
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  h.notebookEntry.complete();
  const back = h.controller.request({
    action: "SELECT_APPLICATION", input: "keyboard", payload: { application: "MEASUREMENT_ASSISTANT" },
  });
  assert.equal(back.ok, true);
  assert.equal(h.controller.getSnapshot().boardApplication, "APPLICATION_SWITCHING");
  assert.equal(h.notebookExit.complete(), true);
  assert.equal(h.controller.getSnapshot().boardApplication, "MEASUREMENT_ASSISTANT");
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  assert.equal(h.events.filter(({ name }) => name === "measurement:selection-cleared").length, 0);
});

test("changed and cleared selections exit Notebook and reject stale callbacks", () => {
  const h = harness();
  h.select();
  h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" });
  const stale = h.notebookEntry;
  h.select("beam-2", [{}]);
  assert.equal(stale.complete(), false);
  assert.equal(h.controller.getSnapshot().boardApplication, "MEASUREMENT_ASSISTANT");
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
  h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" });
  h.notebookEntry.complete();
  assert.equal(h.controller.request({ action: "CLEAR_SELECTION", input: "keyboard" }).ok, true);
  assert.equal(h.controller.getSnapshot().boardApplication, "MEASUREMENT_ASSISTANT");
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.renders.at(-1).state, "IDLE");
});

test("shutdown and reversal cancel Notebook and restore ordinary Measurements", () => {
  const h = harness({ deferDrawerSecurity: true });
  h.select();
  h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" });
  h.notebookEntry.complete();
  h.controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  const staleDrawer = h.drawerSecurity;
  assert.equal(h.controller.getSnapshot().workshop, "SHUTTING_DOWN");
  assert.ok(h.notebookCancels > 0);
  assert.equal(h.controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  }).code, "REVERSING");
  assert.equal(staleDrawer(), false);
  assert.equal(h.controller.getSnapshot().boardApplication, "MEASUREMENT_ASSISTANT");
  assert.equal(h.controller.getSnapshot().measurement, "SELECTED_OBJECT");
});

test("faults reject stale Notebook settlement and arbitrary application targets", () => {
  const h = harness();
  h.select();
  assert.equal(h.controller.request({
    action: "SELECT_APPLICATION", input: "pointer", payload: { application: "ENGINEERING_NOTEBOOK" },
  }).code, "APPLICATION_NOT_APPROVED");
  h.controller.request({ action: "OPEN_NOTEBOOK", input: "pointer" });
  const stale = h.notebookEntry;
  h.controller.reportProjectorFault({ message: "test fault" });
  assert.equal(stale.complete(), false);
  assert.equal(h.controller.getSnapshot().boardApplication, "NONE");
  assert.equal(h.controller.getSnapshot().measurement, "IDLE");
  assert.equal(h.events.filter(({ name }) => name === "measurement:notebook-opened").length, 0);
});
