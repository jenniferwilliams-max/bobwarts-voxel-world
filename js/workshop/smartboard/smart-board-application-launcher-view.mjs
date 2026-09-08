const freezeResult = (value) => Object.freeze(value);

export const SMART_BOARD_LAUNCHER_APPLICATIONS = Object.freeze({
  MEASUREMENTS: "MEASUREMENT_ASSISTANT",
  NOTEBOOK: "ENGINEERING_NOTEBOOK",
});

export const SMART_BOARD_LAUNCHER_STATES = Object.freeze({
  NOT_READY: "not-ready",
  MEASUREMENTS_ACTIVE: "measurements-active",
  NOTEBOOK_ACTIVE: "notebook-active",
  NOTEBOOK_UNAVAILABLE: "notebook-unavailable",
  APPLICATION_SWITCHING: "application-switching",
});

export function createSmartBoardApplicationLauncherView({
  root,
  label,
  measurementsControl,
  notebookControl,
  status,
} = {}) {
  if (!root?.dataset || !label || !measurementsControl || !notebookControl || !status) {
    throw new TypeError("Complete Smart Board application launcher elements are required.");
  }

  let ready = false;
  let hasSelection = false;
  let switching = false;
  let application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
  let lastSignature = "";

  const present = ({ announce = false } = {}) => {
    let state = SMART_BOARD_LAUNCHER_STATES.NOT_READY;
    if (ready && switching) {
      state = SMART_BOARD_LAUNCHER_STATES.APPLICATION_SWITCHING;
    } else if (ready && application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK) {
      state = SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_ACTIVE;
    } else if (ready && !hasSelection) {
      state = SMART_BOARD_LAUNCHER_STATES.NOTEBOOK_UNAVAILABLE;
    } else if (ready) {
      state = SMART_BOARD_LAUNCHER_STATES.MEASUREMENTS_ACTIVE;
    }

    const signature = `${state}|${ready}|${hasSelection}|${switching}|${application}`;
    const idempotent = signature === lastSignature;
    lastSignature = signature;
    root.dataset.launcherState = state;
    root.hidden = !ready;
    label.hidden = !ready;
    measurementsControl.hidden = !ready;
    notebookControl.hidden = !ready;
    measurementsControl.disabled = !ready || switching;
    notebookControl.disabled = !ready || switching || !hasSelection;
    measurementsControl.setAttribute(
      "aria-pressed",
      String(ready && !switching && application === SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS),
    );
    notebookControl.setAttribute(
      "aria-pressed",
      String(ready && !switching && application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK),
    );

    if (!ready) {
      status.textContent = "Smart Board applications are not ready yet.";
    } else if (switching) {
      status.textContent = "Switching Smart Board application.";
    } else if (!hasSelection) {
      status.textContent = "Select one or more measurable objects to open the Engineering Notebook.";
    } else if (announce && application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK) {
      status.textContent = "Engineering Notebook ready.";
    } else if (announce) {
      status.textContent = "Measurements ready.";
    } else {
      status.textContent = application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK
        ? "Engineering Notebook active."
        : "Engineering Notebook available.";
    }

    return freezeResult({
      ok: true,
      code: idempotent ? "IDEMPOTENT" : "PRESENTED",
      state,
      application,
      ready,
      hasSelection,
      switching,
    });
  };

  const reset = () => {
    ready = false;
    hasSelection = false;
    switching = false;
    application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
    return present();
  };

  reset();

  return Object.freeze({
    syncState({
      boardReady,
      selectionAvailable,
      application: nextApplication,
      applicationSwitching,
      announce = false,
    } = {}) {
      if (nextApplication !== undefined &&
          !Object.values(SMART_BOARD_LAUNCHER_APPLICATIONS).includes(nextApplication)) {
        return freezeResult({ ok: false, code: "UNKNOWN_APPLICATION" });
      }
      ready = boardReady === true;
      hasSelection = selectionAvailable === true;
      switching = ready && applicationSwitching === true;
      if (!ready) {
        switching = false;
        application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
      } else if (nextApplication !== undefined) {
        application = nextApplication;
      }
      if (!hasSelection && application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK) {
        application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
      }
      return present({ announce });
    },
    setReady(value) {
      ready = value === true;
      if (!ready) {
        switching = false;
        application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
      }
      return present();
    },
    setSelectionAvailable(value) {
      hasSelection = value === true;
      if (!hasSelection && application === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK) {
        application = SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
      }
      return present();
    },
    setSwitching(value) {
      switching = ready && value === true;
      return present();
    },
    setActiveApplication(value, { announce = true } = {}) {
      if (!Object.values(SMART_BOARD_LAUNCHER_APPLICATIONS).includes(value)) {
        return freezeResult({ ok: false, code: "UNKNOWN_APPLICATION" });
      }
      if (!ready) {
        return freezeResult({ ok: false, code: "NOT_READY" });
      }
      if (value === SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK && !hasSelection) {
        return freezeResult({ ok: false, code: "SELECTION_REQUIRED" });
      }
      application = value;
      switching = false;
      return present({ announce });
    },
    present,
    reset,
    getSnapshot() {
      return freezeResult({
        state: root.dataset.launcherState,
        application,
        ready,
        hasSelection,
        switching,
      });
    },
  });
}
