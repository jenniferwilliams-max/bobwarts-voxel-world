import test from "node:test";
import assert from "node:assert/strict";
import { createSmartBoardNotebookView } from "../../js/workshop/smartboard/smart-board-notebook-view.mjs";

const element = (text = "") => ({
  textContent: text,
  dataset: {},
  hidden: false,
  disabled: false,
});

function harness({
  selectionCount = 1,
  controlsConnected = false,
  requestFrame,
  cancelFrame,
  activeElement,
} = {}) {
  const screen = { dataset: { boardApplication: "measurement-assistant" } };
  const measurementDisplay = element();
  const learningDisplay = element();
  const notebookDisplay = element();
  const openControl = element();
  const backControl = element();
  const source = {
    assistant: { dataset: { measurementState: "measured", selectionCount: String(selectionCount) } },
    selection: element(selectionCount > 1 ? `${selectionCount} objects together` : "1 object selected"),
    unit: element("CM"),
    width: element("12 cm"),
    length: element("8 cm"),
    height: element("5 cm"),
  };
  const target = {
    selection: element(), unit: element(), width: element(), length: element(), height: element(), groupNote: element(),
  };
  const view = createSmartBoardNotebookView({
    screen, measurementDisplay, learningDisplay, notebookDisplay,
    openControl, backControl, source, target, controlsConnected,
    ...(requestFrame ? { requestFrame } : {}),
    ...(cancelFrame ? { cancelFrame } : {}),
    ...(activeElement ? { activeElement } : {}),
  });
  return {
    view, screen, measurementDisplay, learningDisplay, notebookDisplay,
    openControl, backControl, source, target,
  };
}

test("copies authoritative single-selection values without calculation", () => {
  const h = harness();
  h.view.syncSelection({ hasSelection: true });
  assert.equal(h.view.showNotebook().code, "NOTEBOOK_VISIBLE");
  assert.deepEqual(
    [h.target.selection.textContent, h.target.unit.textContent, h.target.width.textContent,
      h.target.length.textContent, h.target.height.textContent],
    ["1 object selected", "CM", "12 cm", "8 cm", "5 cm"],
  );
  assert.equal(h.target.groupNote.textContent, "This design record describes the selected object.");
});

test("identifies a combined selection while preserving authoritative group dimensions", () => {
  const h = harness({ selectionCount: 3 });
  h.view.syncSelection({ hasSelection: true });
  h.view.showNotebook();
  assert.equal(h.target.selection.textContent, "3 objects together");
  assert.equal(h.target.width.textContent, "12 cm");
  assert.equal(h.target.length.textContent, "8 cm");
  assert.equal(h.target.height.textContent, "5 cm");
  assert.equal(h.target.groupNote.textContent, "This design record describes the full selected group.");
});

test("provides deterministic Notebook and Measurements endpoints", () => {
  const h = harness({ controlsConnected: true });
  h.view.syncSelection({ hasSelection: true });
  assert.equal(h.openControl.hidden, false);
  assert.equal(h.view.showNotebook().code, "NOTEBOOK_VISIBLE");
  assert.equal(h.view.showNotebook().code, "IDEMPOTENT");
  assert.equal(h.measurementDisplay.hidden, true);
  assert.equal(h.learningDisplay.hidden, true);
  assert.equal(h.notebookDisplay.hidden, false);
  assert.equal(h.screen.dataset.boardApplication, "engineering-notebook");
  assert.equal(h.backControl.hidden, false);
  assert.equal(h.view.showMeasurements().code, "MEASUREMENTS_VISIBLE");
  assert.equal(h.view.showMeasurements().code, "IDEMPOTENT");
  assert.equal(h.measurementDisplay.hidden, false);
  assert.equal(h.notebookDisplay.hidden, true);
  assert.equal(h.openControl.hidden, false);
});

test("keeps controls locked while the foundation is not lifecycle-connected", () => {
  const h = harness();
  h.view.syncSelection({ hasSelection: true });
  h.view.showNotebook();
  assert.equal(h.openControl.hidden, true);
  assert.equal(h.openControl.disabled, true);
  assert.equal(h.backControl.hidden, true);
  assert.equal(h.backControl.disabled, true);
  assert.equal(h.view.getSnapshot().controlsConnected, false);
});

test("selection clearing resets the read-only view and incomplete data is rejected", () => {
  const h = harness();
  assert.equal(h.view.showNotebook().code, "SELECTION_REQUIRED");
  h.view.syncSelection({ hasSelection: true });
  h.view.showNotebook();
  assert.equal(h.view.syncSelection({ hasSelection: false }).code, "RESET");
  assert.deepEqual(h.view.getSnapshot(), {
    mode: "measurements", selected: false, controlsConnected: false, transitionId: null,
  });
  assert.equal(h.measurementDisplay.hidden, false);
  assert.equal(h.notebookDisplay.hidden, true);
  assert.throws(() => createSmartBoardNotebookView(), /display roots are required/);
});

test("lifecycle entry and Back settle after two frames and reject stale callbacks", () => {
  const frames = new Map();
  let frameId = 0;
  const h = harness();
  const view = createSmartBoardNotebookView({
    screen: h.screen,
    measurementDisplay: h.measurementDisplay,
    learningDisplay: h.learningDisplay,
    notebookDisplay: h.notebookDisplay,
    openControl: h.openControl,
    backControl: h.backControl,
    source: h.source,
    target: h.target,
    controlsConnected: true,
    requestFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
  });
  const flush = () => {
    const [id, callback] = frames.entries().next().value || [];
    if (!callback) return false;
    frames.delete(id);
    callback();
    return true;
  };
  view.syncSelection({ hasSelection: true });
  let entries = 0;
  view.enter({ transitionId: "notebook-1", complete: () => { entries += 1; return true; } });
  assert.equal(h.notebookDisplay.hidden, false);
  assert.equal(entries, 0);
  flush();
  assert.equal(entries, 0);
  flush();
  assert.equal(entries, 1);
  let exits = 0;
  view.exit({ transitionId: "measurements-1", complete: () => { exits += 1; return true; } });
  flush();
  view.cancel();
  flush();
  assert.equal(exits, 0);
  assert.equal(h.measurementDisplay.hidden, false);
  assert.equal(h.notebookDisplay.hidden, true);
  assert.equal(h.screen.dataset.boardApplication, "measurement-assistant");
});

test("focus moves only between visible connected Notebook controls", () => {
  const frames = [];
  let focused = null;
  const h = harness({
    controlsConnected: true,
    requestFrame(callback) { frames.push(callback); return callback; },
    cancelFrame(handle) {
      const index = frames.indexOf(handle);
      if (index >= 0) frames.splice(index, 1);
    },
    activeElement: () => focused,
  });
  h.openControl.isConnected = true;
  h.backControl.isConnected = true;
  h.openControl.focus = () => { focused = h.openControl; };
  h.backControl.focus = () => { focused = h.backControl; };
  const flushTwo = () => { frames.shift()?.(); frames.shift()?.(); };
  h.view.syncSelection({ hasSelection: true });
  focused = h.openControl;
  h.view.enter({ transitionId: "open", complete: () => true });
  flushTwo();
  assert.equal(focused, h.backControl);
  h.view.exit({ transitionId: "back", complete: () => true });
  flushTwo();
  assert.equal(focused, h.openControl);
});
