import test from "node:test";
import assert from "node:assert/strict";
import {
  createSmartBoardMeasurementDisplay,
  SMART_BOARD_MEASUREMENT_DEFAULTS,
} from "../../js/workshop/smartboard/smart-board-measurement-display.mjs";

const element = (text = "") => ({ textContent: text, dataset: {} });

function harness() {
  const root = { dataset: { boardPower: "ready" } };
  const screen = { dataset: { boardApplication: "measurement-assistant" } };
  const display = { dataset: { measurementState: "empty" } };
  const source = {
    assistant: { dataset: { measurementState: "measured" } },
    selection: element("2 objects together"),
    unit: element("MM"),
    width: element("120 mm"),
    length: element("80 mm"),
    height: element("45 mm"),
    hint: element("The frame highlights and cyan guide measure the whole selection."),
  };
  const target = {
    selection: element(), unit: element(), width: element(), length: element(), height: element(), hint: element(),
  };
  const view = createSmartBoardMeasurementDisplay({ root, screen, display, source, target });
  return { root, screen, display, source, target, view };
}

test("mirrors authoritative measured values without recalculating them", () => {
  const { view } = harness();
  assert.equal(view.sync().code, "SYNCED");
  assert.deepEqual(view.getSnapshot(), {
    state: "measured",
    selection: "2 objects together",
    unit: "MM",
    width: "120 mm",
    length: "80 mm",
    height: "45 mm",
    hint: "The frame highlights and cyan guide measure the whole selection.",
  });
});

test("selection clearing mirrors the authoritative idle presentation", () => {
  const { source, view } = harness();
  source.assistant.dataset.measurementState = "empty";
  source.selection.textContent = "Ready to measure";
  source.unit.textContent = "CM";
  source.width.textContent = "—";
  source.length.textContent = "—";
  source.height.textContent = "—";
  source.hint.textContent = "Select one or more objects to see their size.";
  view.sync();
  assert.deepEqual(view.getSnapshot(), SMART_BOARD_MEASUREMENT_DEFAULTS);
});

test("inactive, cleared, and faulted application states cannot repopulate stale values", () => {
  const { root, screen, view } = harness();
  view.sync();
  screen.dataset.boardApplication = "none";
  assert.equal(view.sync().code, "RESET");
  assert.deepEqual(view.getSnapshot(), SMART_BOARD_MEASUREMENT_DEFAULTS);
  screen.dataset.boardApplication = "measurement-assistant";
  root.dataset.boardPower = "powered-off";
  assert.equal(view.sync().code, "RESET");
  assert.deepEqual(view.getSnapshot(), SMART_BOARD_MEASUREMENT_DEFAULTS);
});

test("rejects incomplete hosts and ignores work after disposal", () => {
  assert.throws(() => createSmartBoardMeasurementDisplay({}), /roots are required/);
  const { view } = harness();
  view.dispose();
  assert.equal(view.sync().code, "DISPOSED");
  assert.equal(view.reset().code, "DISPOSED");
});
