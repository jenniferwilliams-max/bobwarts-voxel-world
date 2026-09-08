import test from "node:test";
import assert from "node:assert/strict";
import {
  createSmartBoardApplicationLauncherView,
  SMART_BOARD_LAUNCHER_APPLICATIONS,
  SMART_BOARD_LAUNCHER_STATES,
} from "../../js/workshop/smartboard/smart-board-application-launcher-view.mjs";
import {
  createSmartBoardApplicationLauncherBridge,
} from "../../js/workshop/smartboard/smart-board-application-launcher-bridge.mjs";

const element = () => ({
  dataset: {}, hidden: false, disabled: false, textContent: "",
  attributes: new Map(),
  setAttribute(name, value) { this.attributes.set(name, value); },
  getAttribute(name) { return this.attributes.get(name); },
});

const setup = () => {
  let runtime = {
    workshop: "OFF",
    boardPower: "RETRACTED",
    boardApplication: "NONE",
    measurement: "IDLE",
  };
  let selectionAvailable = false;
  const elements = {
    root: element(), label: element(), measurementsControl: element(),
    notebookControl: element(), status: element(),
  };
  const view = createSmartBoardApplicationLauncherView(elements);
  const bridge = createSmartBoardApplicationLauncherBridge({
    view,
    getRuntimeSnapshot: () => runtime,
    getSelectionAvailable: () => selectionAvailable,
  });
  return {
    bridge, elements,
    setRuntime(next) { runtime = { ...runtime, ...next }; },
    setSelection(value) { selectionAvailable = value; },
  };
};

test("fails closed until canonical Workshop and Smart Board readiness", () => {
  const { bridge, elements, setRuntime } = setup();
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOT_READY);
  assert.equal(elements.root.hidden, true);
  setRuntime({ workshop: "READY", boardPower: "READY", boardApplication: "MEASUREMENT_ASSISTANT" });
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_UNAVAILABLE);
  assert.equal(elements.root.hidden, false);
});

test("derives Notebook availability and active application from canonical state", () => {
  const { bridge, elements, setRuntime, setSelection } = setup();
  setRuntime({
    workshop: "READY", boardPower: "READY",
    boardApplication: "MEASUREMENT_ASSISTANT", measurement: "SELECTED_OBJECT",
  });
  setSelection(true);
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.MEASUREMENTS_ACTIVE);
  assert.equal(elements.notebookControl.disabled, false);

  setRuntime({ boardApplication: "ENGINEERING_NOTEBOOK", measurement: "ENGINEERING_NOTEBOOK" });
  bridge.sync({ announce: true });
  assert.equal(bridge.getSnapshot().application, SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK);
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_ACTIVE);
  assert.equal(elements.status.textContent, "Engineering Notebook ready.");
});

test("disables both controls during canonical or host-requested application switching", () => {
  const { bridge, elements, setRuntime, setSelection } = setup();
  setRuntime({
    workshop: "READY", boardPower: "READY",
    boardApplication: "MEASUREMENT_ASSISTANT", measurement: "SELECTED_OBJECT",
  });
  setSelection(true);
  bridge.sync();
  bridge.beginSwitch();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.APPLICATION_SWITCHING);
  assert.equal(elements.measurementsControl.disabled, true);
  assert.equal(elements.notebookControl.disabled, true);

  setRuntime({ boardApplication: "APPLICATION_SWITCHING" });
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.APPLICATION_SWITCHING);
});

test("selection change or clear leaves Notebook and presents canonical Measurements state", () => {
  const { bridge, setRuntime, setSelection } = setup();
  setSelection(true);
  setRuntime({
    workshop: "READY", boardPower: "READY",
    boardApplication: "ENGINEERING_NOTEBOOK", measurement: "ENGINEERING_NOTEBOOK",
  });
  bridge.sync();
  setRuntime({ boardApplication: "MEASUREMENT_ASSISTANT", measurement: "SELECTED_OBJECT" });
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.MEASUREMENTS_ACTIVE);

  setSelection(false);
  setRuntime({ measurement: "IDLE" });
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_UNAVAILABLE);
});

test("shutdown, fault, stale provider failure, and repeated reads reset safely and idempotently", () => {
  const { bridge, setRuntime, setSelection } = setup();
  setSelection(true);
  setRuntime({
    workshop: "READY", boardPower: "READY",
    boardApplication: "MEASUREMENT_ASSISTANT", measurement: "SELECTED_OBJECT",
  });
  bridge.sync();
  assert.equal(bridge.sync().code, "IDEMPOTENT");
  setRuntime({ workshop: "SHUTTING_DOWN", boardApplication: "NONE" });
  bridge.sync();
  assert.equal(bridge.getSnapshot().state, SMART_BOARD_LAUNCHER_STATES.NOT_READY);
  setRuntime({ workshop: "FAULT_SAFE" });
  assert.equal(bridge.sync().code, "IDEMPOTENT");
});
