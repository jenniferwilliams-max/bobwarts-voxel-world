import test from "node:test";
import assert from "node:assert/strict";
import { createSmartBoardLearningModeView } from "../../js/workshop/smartboard/smart-board-learning-mode-view.mjs";

const element = (text = "") => ({
  textContent: text,
  dataset: {},
  hidden: false,
  disabled: false,
  isConnected: true,
  focusCalls: 0,
  focus() { this.focusCalls += 1; },
});

function harness({ selectionCount = 1 } = {}) {
  const frames = [];
  const root = { dataset: { boardPower: "ready" } };
  const screen = { dataset: { boardApplication: "measurement-assistant" } };
  const measurementDisplay = element();
  const learningDisplay = element();
  const learnControl = element();
  const backControl = element();
  const status = element();
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
  let focused = learnControl;
  const view = createSmartBoardLearningModeView({
    root, screen, measurementDisplay, learningDisplay, learnControl, backControl, status, source, target,
    requestFrame(callback) { frames.push(callback); return callback; },
    cancelFrame(handle) {
      const index = frames.indexOf(handle);
      if (index >= 0) frames.splice(index, 1);
    },
    activeElement: () => focused,
  });
  const runFrame = () => frames.shift()?.();
  return {
    view, frames, root, screen, measurementDisplay, learningDisplay, learnControl, backControl, status, source, target,
    runFrame,
    setFocused(value) { focused = value; },
  };
}

test("copies authoritative single-selection values and settles after two frames", () => {
  const h = harness();
  h.view.syncSelection({ hasSelection: true });
  let completions = 0;
  const result = h.view.enter({ transitionId: "learn-1", complete: () => { completions += 1; return true; } });
  assert.equal(result.code, "ACCEPTED");
  assert.deepEqual(
    [h.target.selection.textContent, h.target.unit.textContent, h.target.width.textContent,
      h.target.length.textContent, h.target.height.textContent],
    ["1 object selected", "CM", "12 cm", "8 cm", "5 cm"],
  );
  assert.equal(h.target.groupNote.textContent, "These measurements describe the selected object.");
  assert.equal(h.measurementDisplay.hidden, true);
  assert.equal(h.learningDisplay.hidden, false);
  h.runFrame();
  assert.equal(completions, 0);
  h.runFrame();
  assert.equal(completions, 1);
  assert.equal(h.backControl.focusCalls, 1);
});

test("identifies combined selections without calculating dimensions", () => {
  const h = harness({ selectionCount: 3 });
  h.view.syncSelection({ hasSelection: true });
  h.view.enter({ transitionId: "learn-many" });
  assert.equal(h.target.selection.textContent, "3 objects together");
  assert.equal(h.target.width.textContent, "12 cm");
  assert.equal(h.target.groupNote.textContent, "These measurements describe the full selected group.");
});

test("Back restores measurements, preserves availability, and restores visible focus", () => {
  const h = harness();
  h.view.syncSelection({ hasSelection: true });
  h.view.enter({ transitionId: "learn-1" });
  h.runFrame(); h.runFrame();
  h.setFocused(h.backControl);
  let completions = 0;
  h.view.exit({ transitionId: "back-1", complete: () => { completions += 1; return true; } });
  assert.equal(h.measurementDisplay.hidden, false);
  assert.equal(h.learningDisplay.hidden, true);
  h.runFrame(); h.runFrame();
  assert.equal(completions, 1);
  assert.equal(h.learnControl.hidden, false);
  assert.equal(h.learnControl.focusCalls, 1);
});

test("selection clearing and cancellation suppress stale render completion", () => {
  const h = harness();
  h.view.syncSelection({ hasSelection: true });
  let completions = 0;
  h.view.enter({ transitionId: "stale", complete: () => { completions += 1; } });
  const stale = h.frames[0];
  h.view.syncSelection({ hasSelection: false });
  stale();
  assert.equal(completions, 0);
  assert.equal(h.view.getSnapshot().mode, "measurements");
  assert.equal(h.learnControl.hidden, true);
});

test("requires an authoritative measured selection and disposal is final", () => {
  const h = harness();
  assert.equal(h.view.enter({ transitionId: "missing" }).code, "SELECTION_REQUIRED");
  h.view.dispose();
  assert.equal(h.view.enter({ transitionId: "disposed" }).code, "DISPOSED");
  assert.throws(() => createSmartBoardLearningModeView(), /roots are required/);
});
