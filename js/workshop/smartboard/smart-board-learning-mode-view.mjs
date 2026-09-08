const freezeResult = (value) => Object.freeze(value);

export function createSmartBoardLearningModeView({
  root,
  screen,
  measurementDisplay,
  learningDisplay,
  learnControl,
  backControl,
  status,
  source,
  target,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
  activeElement = () => globalThis.document?.activeElement || null,
} = {}) {
  if (!root?.dataset || !screen?.dataset || !measurementDisplay || !learningDisplay?.dataset) {
    throw new TypeError("Smart Board Learning Mode roots are required.");
  }
  if (!learnControl || !backControl || !status) {
    throw new TypeError("Smart Board Learning Mode controls are required.");
  }
  const sourceKeys = ["assistant", "selection", "unit", "width", "length", "height"];
  const targetKeys = ["selection", "unit", "width", "length", "height", "groupNote"];
  if (sourceKeys.some((key) => !source?.[key]) || targetKeys.some((key) => !target?.[key])) {
    throw new TypeError("Complete Learning Mode source and target fields are required.");
  }

  let serial = 0;
  let active = null;
  let disposed = false;
  let selected = false;

  const setControlState = (mode) => {
    const learning = mode === "learning";
    learnControl.hidden = learning || !selected;
    learnControl.disabled = learning || !selected;
    backControl.hidden = !learning;
    backControl.disabled = !learning;
  };

  const showMeasurements = ({ announce = false } = {}) => {
    screen.dataset.learningMode = "measurements";
    learningDisplay.dataset.learningState = "inactive";
    measurementDisplay.hidden = false;
    learningDisplay.hidden = true;
    setControlState("measurements");
    if (announce) status.textContent = selected ? "Measurements ready." : "Select an object to begin.";
    return freezeResult({ ok: true, code: "MEASUREMENTS_VISIBLE" });
  };

  const cancelActive = ({ restore = true } = {}) => {
    if (active) {
      active.cancelled = true;
      active.frames.forEach(cancelFrame);
      active.frames.length = 0;
      active = null;
    }
    if (restore) showMeasurements();
  };

  const copyAuthoritativeContent = () => {
    target.selection.textContent = source.selection.textContent;
    target.unit.textContent = source.unit.textContent;
    target.width.textContent = source.width.textContent;
    target.length.textContent = source.length.textContent;
    target.height.textContent = source.height.textContent;
    const selectionCount = Number(source.assistant.dataset.selectionCount);
    target.groupNote.textContent = selectionCount > 1
      ? "These measurements describe the full selected group."
      : "These measurements describe the selected object.";
  };

  const settleAfterTwoFrames = (entry) => {
    const first = requestFrame(() => {
      if (disposed || active !== entry || entry.cancelled) return;
      const second = requestFrame(() => {
        if (disposed || active !== entry || entry.cancelled) return;
        entry.completed = true;
        entry.frames.length = 0;
        active = null;
        entry.complete();
      });
      entry.frames.push(second);
    });
    entry.frames.push(first);
  };

  const enter = ({ transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (!selected || source.assistant.dataset.measurementState !== "measured") {
      return freezeResult({ ok: false, code: "SELECTION_REQUIRED" });
    }
    if (active?.transitionId === transitionId && active.mode === "learning") {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    const moveFocus = activeElement() === learnControl;
    cancelActive({ restore: false });
    const entry = {
      token: ++serial,
      transitionId,
      mode: "learning",
      complete: () => {
        const result = complete();
        if (moveFocus && !backControl.hidden && !backControl.disabled && backControl.isConnected !== false) {
          backControl.focus?.({ preventScroll: true });
        }
        return result;
      },
      cancelled: false,
      completed: false,
      frames: [],
    };
    active = entry;
    copyAuthoritativeContent();
    screen.dataset.learningMode = "learning";
    learningDisplay.dataset.learningState = "active";
    measurementDisplay.hidden = true;
    learningDisplay.hidden = false;
    setControlState("learning");
    status.textContent = "Learning Mode ready.";
    settleAfterTwoFrames(entry);
    return freezeResult({ ok: true, code: "ACCEPTED", transitionId, token: entry.token });
  };

  const exit = ({ transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (active?.transitionId === transitionId && active.mode === "measurements") {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    const restoreFocus = activeElement() === backControl;
    cancelActive({ restore: false });
    const entry = {
      token: ++serial,
      transitionId,
      mode: "measurements",
      complete: () => {
        const result = complete();
        if (restoreFocus && !learnControl.hidden && !learnControl.disabled && learnControl.isConnected !== false) {
          learnControl.focus?.({ preventScroll: true });
        }
        return result;
      },
      cancelled: false,
      completed: false,
      frames: [],
    };
    active = entry;
    showMeasurements({ announce: true });
    settleAfterTwoFrames(entry);
    return freezeResult({ ok: true, code: "ACCEPTED", transitionId, token: entry.token });
  };

  const syncSelection = ({ hasSelection } = {}) => {
    selected = hasSelection === true;
    if (!selected && screen.dataset.learningMode === "learning") cancelActive({ restore: true });
    else {
      if (selected && screen.dataset.learningMode === "learning") copyAuthoritativeContent();
      setControlState(screen.dataset.learningMode === "learning" ? "learning" : "measurements");
    }
    return freezeResult({ ok: true, code: "SYNCED", hasSelection: selected });
  };

  screen.dataset.learningMode = "measurements";
  learningDisplay.hidden = true;
  setControlState("measurements");

  return Object.freeze({
    enter,
    exit,
    showMeasurements,
    syncSelection,
    cancel() {
      const cancelled = active !== null;
      cancelActive({ restore: true });
      return freezeResult({ ok: true, code: cancelled ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        mode: screen.dataset.learningMode,
        selected,
        transitionId: active?.transitionId || null,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive({ restore: false });
    },
  });
}
