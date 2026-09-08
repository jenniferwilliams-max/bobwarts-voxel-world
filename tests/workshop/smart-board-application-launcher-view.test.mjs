import test from "node:test";
import assert from "node:assert/strict";
import {
  createSmartBoardApplicationLauncherView,
  SMART_BOARD_LAUNCHER_APPLICATIONS,
  SMART_BOARD_LAUNCHER_STATES,
} from "../../js/workshop/smartboard/smart-board-application-launcher-view.mjs";

const element = () => ({
  dataset: {},
  hidden: false,
  disabled: false,
  textContent: "",
  attributes: new Map(),
  setAttribute(name, value) { this.attributes.set(name, value); },
  getAttribute(name) { return this.attributes.get(name); },
});

const setup = () => {
  const elements = {
    root: element(),
    label: element(),
    measurementsControl: element(),
    notebookControl: element(),
    status: element(),
  };
  return { elements, view: createSmartBoardApplicationLauncherView(elements) };
};

test("presents not-ready, unavailable, Measurements, Notebook, switching, and reset endpoints", () => {
  const { elements, view } = setup();
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOT_READY);
  assert.equal(elements.root.hidden, true);

  view.setReady(true);
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_UNAVAILABLE);
  assert.equal(elements.notebookControl.disabled, true);
  assert.match(elements.status.textContent, /Select one or more measurable objects/);

  view.setSelectionAvailable(true);
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.MEASUREMENTS_ACTIVE);
  assert.equal(elements.measurementsControl.getAttribute("aria-pressed"), "true");
  assert.equal(elements.notebookControl.disabled, false);

  view.setSwitching(true);
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.APPLICATION_SWITCHING);
  assert.equal(elements.measurementsControl.disabled, true);
  assert.equal(elements.notebookControl.disabled, true);

  view.setActiveApplication(SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK);
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_ACTIVE);
  assert.equal(elements.notebookControl.getAttribute("aria-pressed"), "true");
  assert.equal(elements.status.textContent, "Engineering Notebook ready.");

  view.reset();
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOT_READY);
  assert.equal(elements.root.hidden, true);
});

test("rejects unavailable or unknown applications and keeps repeated presentation idempotent", () => {
  const { view } = setup();
  assert.equal(view.setActiveApplication(SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS).code, "NOT_READY");
  view.setReady(true);
  assert.equal(view.setActiveApplication(SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK).code, "SELECTION_REQUIRED");
  assert.equal(view.setActiveApplication("LEARNING_MODE").code, "UNKNOWN_APPLICATION");
  view.setSelectionAvailable(true);
  assert.equal(view.present().code, "IDEMPOTENT");
  assert.equal(view.setSelectionAvailable(true).code, "IDEMPOTENT");
});

test("selection loss returns Notebook presentation to Measurements and announces settled applications politely", () => {
  const { elements, view } = setup();
  view.setReady(true);
  view.setSelectionAvailable(true);
  view.setActiveApplication(SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK);
  view.setSelectionAvailable(false);
  assert.equal(view.getSnapshot().application, SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS);
  assert.equal(view.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_UNAVAILABLE);
  assert.equal(elements.notebookControl.getAttribute("aria-pressed"), "false");
  view.setSelectionAvailable(true);
  view.setActiveApplication(SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS);
  assert.equal(elements.status.textContent, "Measurements ready.");
});

test("atomically synchronizes canonical readiness, selection, application, and switching state", () => {
  const { elements, view } = setup();
  const ready = view.syncState({
    boardReady: true,
    selectionAvailable: true,
    application: SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS,
    applicationSwitching: false,
  });
  assert.equal(ready.state, SMART_BOARD_LAUNCHER_STATES.MEASUREMENTS_ACTIVE);
  assert.equal(elements.root.hidden, false);
  assert.equal(elements.notebookControl.disabled, false);

  const switching = view.syncState({
    boardReady: true,
    selectionAvailable: true,
    application: SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS,
    applicationSwitching: true,
  });
  assert.equal(switching.state, SMART_BOARD_LAUNCHER_STATES.APPLICATION_SWITCHING);
  assert.equal(elements.measurementsControl.disabled, true);
  assert.equal(elements.notebookControl.disabled, true);

  const notebook = view.syncState({
    boardReady: true,
    selectionAvailable: true,
    application: SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK,
    applicationSwitching: false,
    announce: true,
  });
  assert.equal(notebook.state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_ACTIVE);
  assert.equal(elements.status.textContent, "Engineering Notebook ready.");
  assert.equal(view.syncState({
    boardReady: true,
    selectionAvailable: true,
    application: SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK,
    applicationSwitching: false,
    announce: true,
  }).code, "IDEMPOTENT");
});
