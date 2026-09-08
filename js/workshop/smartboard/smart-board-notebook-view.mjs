const freezeResult = (value) => Object.freeze(value);

export function createSmartBoardNotebookView({
  screen,
  measurementDisplay,
  learningDisplay,
  notebookDisplay,
  openControl,
  backControl,
  source,
  target,
  controlsConnected = false,
  controlsManagedExternally = false,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
  activeElement = () => globalThis.document?.activeElement || null,
} = {}) {
  if (!screen?.dataset || !measurementDisplay || !learningDisplay || !notebookDisplay?.dataset) {
    throw new TypeError("Smart Board Notebook display roots are required.");
  }
  if (!openControl || !backControl) {
    throw new TypeError("Smart Board Notebook controls are required.");
  }
  const sourceKeys = ["assistant", "selection", "unit", "width", "length", "height"];
  const targetKeys = ["selection", "unit", "width", "length", "height", "groupNote"];
  if (sourceKeys.some((key) => !source?.[key]) || targetKeys.some((key) => !target?.[key])) {
    throw new TypeError("Complete Notebook source and target fields are required.");
  }

  let selected = false;
  let mode = "measurements";
  let serial = 0;
  let active = null;
  let disposed = false;

  const setControls = () => {
    if (controlsManagedExternally) return;
    if (!controlsConnected) {
      openControl.hidden = true;
      openControl.disabled = true;
      backControl.hidden = true;
      backControl.disabled = true;
      return;
    }
    const notebookVisible = mode === "notebook";
    openControl.hidden = notebookVisible || !selected;
    openControl.disabled = notebookVisible || !selected;
    backControl.hidden = !notebookVisible;
    backControl.disabled = !notebookVisible;
  };

  const copyAuthoritativeContent = () => {
    if (!selected || source.assistant.dataset.measurementState !== "measured") {
      return freezeResult({ ok: false, code: "SELECTION_REQUIRED" });
    }
    target.selection.textContent = source.selection.textContent;
    target.unit.textContent = source.unit.textContent;
    target.width.textContent = source.width.textContent;
    target.length.textContent = source.length.textContent;
    target.height.textContent = source.height.textContent;
    const selectionCount = Number(source.assistant.dataset.selectionCount);
    target.groupNote.textContent = selectionCount > 1
      ? "This design record describes the full selected group."
      : "This design record describes the selected object.";
    return freezeResult({ ok: true, code: "CONTENT_COPIED" });
  };

  const showMeasurements = ({ syncApplication = true } = {}) => {
    const idempotent = mode === "measurements" && notebookDisplay.hidden === true;
    mode = "measurements";
    if (syncApplication) screen.dataset.boardApplication = "measurement-assistant";
    screen.dataset.notebookMode = "measurements";
    notebookDisplay.dataset.notebookState = "inactive";
    notebookDisplay.hidden = true;
    learningDisplay.hidden = true;
    measurementDisplay.hidden = false;
    setControls();
    return freezeResult({ ok: true, code: idempotent ? "IDEMPOTENT" : "MEASUREMENTS_VISIBLE" });
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

  const showNotebook = () => {
    const copied = copyAuthoritativeContent();
    if (!copied.ok) return copied;
    const idempotent = mode === "notebook" && notebookDisplay.hidden === false;
    mode = "notebook";
    screen.dataset.boardApplication = "engineering-notebook";
    screen.dataset.notebookMode = "notebook";
    notebookDisplay.dataset.notebookState = "active";
    measurementDisplay.hidden = true;
    learningDisplay.hidden = true;
    notebookDisplay.hidden = false;
    setControls();
    return freezeResult({ ok: true, code: idempotent ? "IDEMPOTENT" : "NOTEBOOK_VISIBLE" });
  };

  const reset = ({ syncApplication = true } = {}) => {
    cancelActive({ restore: false });
    selected = false;
    showMeasurements({ syncApplication });
    return freezeResult({ ok: true, code: "RESET" });
  };

  const syncSelection = ({ hasSelection } = {}) => {
    selected = hasSelection === true;
    if (!selected) return reset();
    if (mode === "notebook") copyAuthoritativeContent();
    setControls();
    return freezeResult({ ok: true, code: "SYNCED", hasSelection: true });
  };

  const enter = ({ transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (!selected || source.assistant.dataset.measurementState !== "measured") {
      return freezeResult({ ok: false, code: "SELECTION_REQUIRED" });
    }
    if (active?.transitionId === transitionId && active.mode === "notebook") {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    const moveFocus = activeElement() === openControl;
    cancelActive({ restore: false });
    const entry = {
      token: ++serial,
      transitionId,
      mode: "notebook",
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
    const shown = showNotebook();
    if (!shown.ok) {
      active = null;
      return shown;
    }
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
        if (restoreFocus && !openControl.hidden && !openControl.disabled && openControl.isConnected !== false) {
          openControl.focus?.({ preventScroll: true });
        }
        return result;
      },
      cancelled: false,
      completed: false,
      frames: [],
    };
    active = entry;
    showMeasurements();
    settleAfterTwoFrames(entry);
    return freezeResult({ ok: true, code: "ACCEPTED", transitionId, token: entry.token });
  };

  notebookDisplay.hidden = true;
  notebookDisplay.dataset.notebookState = "inactive";
  screen.dataset.notebookMode = "measurements";
  setControls();

  return Object.freeze({
    enter,
    exit,
    showMeasurements,
    showNotebook,
    reset,
    syncSelection,
    copyAuthoritativeContent,
    cancel({ restore = true, syncApplication = true } = {}) {
      const cancelled = active !== null;
      cancelActive({ restore: false });
      if (restore) showMeasurements({ syncApplication });
      return freezeResult({ ok: true, code: cancelled ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        mode,
        selected,
        controlsConnected,
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
