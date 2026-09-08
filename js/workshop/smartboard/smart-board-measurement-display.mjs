export const SMART_BOARD_MEASUREMENT_DEFAULTS = Object.freeze({
  state: "empty",
  selection: "Ready to measure",
  unit: "CM",
  width: "—",
  length: "—",
  height: "—",
  hint: "Select one or more objects to see their size.",
});

const freezeResult = (value) => Object.freeze(value);

export function createSmartBoardMeasurementDisplay({
  root,
  screen,
  display,
  source,
  target,
} = {}) {
  if (!root?.dataset || !screen?.dataset || !display?.dataset) {
    throw new TypeError("Smart Board measurement display roots are required.");
  }
  const requiredSource = ["assistant", "selection", "unit", "width", "length", "height", "hint"];
  const requiredTarget = ["selection", "unit", "width", "length", "height", "hint"];
  if (requiredSource.some((key) => !source?.[key]) || requiredTarget.some((key) => !target?.[key])) {
    throw new TypeError("Complete authoritative and Smart Board measurement elements are required.");
  }

  let disposed = false;

  const setValues = ({ state, selection, unit, width, length, height, hint }) => {
    display.dataset.measurementState = state;
    target.selection.textContent = selection;
    target.unit.textContent = unit;
    target.width.textContent = width;
    target.length.textContent = length;
    target.height.textContent = height;
    target.hint.textContent = hint;
  };

  const reset = () => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    setValues(SMART_BOARD_MEASUREMENT_DEFAULTS);
    return freezeResult({ ok: true, code: "RESET" });
  };

  const sync = () => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    const active = root.dataset.boardPower === "ready" &&
      screen.dataset.boardApplication === "measurement-assistant";
    if (!active) return reset();
    setValues({
      state: source.assistant.dataset.measurementState === "measured" ? "measured" : "empty",
      selection: source.selection.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.selection,
      unit: source.unit.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.unit,
      width: source.width.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.width,
      length: source.length.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.length,
      height: source.height.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.height,
      hint: source.hint.textContent || SMART_BOARD_MEASUREMENT_DEFAULTS.hint,
    });
    return freezeResult({ ok: true, code: "SYNCED" });
  };

  reset();

  return Object.freeze({
    sync,
    reset,
    getSnapshot() {
      return freezeResult({
        state: display.dataset.measurementState,
        selection: target.selection.textContent,
        unit: target.unit.textContent,
        width: target.width.textContent,
        length: target.length.textContent,
        height: target.height.textContent,
        hint: target.hint.textContent,
      });
    },
    dispose() {
      disposed = true;
    },
  });
}
