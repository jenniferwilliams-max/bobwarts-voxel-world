import {
  SMART_BOARD_LAUNCHER_APPLICATIONS,
} from "./smart-board-application-launcher-view.mjs";

const freezeResult = (value) => Object.freeze(value);
const SELECTION_STATES = new Set([
  "SELECTED_OBJECT", "LEARNING_MODE", "ENGINEERING_NOTEBOOK",
]);

export function createSmartBoardApplicationLauncherBridge({
  view,
  getRuntimeSnapshot,
  getSelectionAvailable,
} = {}) {
  if (!view || typeof view.syncState !== "function" ||
      typeof view.reset !== "function" ||
      typeof view.getSnapshot !== "function" ||
      typeof getRuntimeSnapshot !== "function" ||
      typeof getSelectionAvailable !== "function") {
    throw new TypeError("Launcher view and canonical state providers are required.");
  }

  function read(provider, fallback) {
    try {
      const value = provider();
      return value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function sync({ announce = false, switching = false } = {}) {
    const runtime = read(getRuntimeSnapshot, null);
    if (!runtime || typeof runtime !== "object") {
      view.reset();
      return freezeResult({ ok: false, code: "RUNTIME_UNAVAILABLE" });
    }
    const ready = runtime.workshop === "READY" &&
      runtime.boardPower === "READY" && runtime.boardApplication !== "NONE";
    const selectionAvailable = ready &&
      SELECTION_STATES.has(runtime.measurement) &&
      read(getSelectionAvailable, false) === true;
    const applicationSwitching = ready &&
      (switching === true || runtime.boardApplication === "APPLICATION_SWITCHING");
    const currentApplication = view.getSnapshot().application;
    const application = runtime.boardApplication === "ENGINEERING_NOTEBOOK"
      ? SMART_BOARD_LAUNCHER_APPLICATIONS.NOTEBOOK
      : runtime.boardApplication === "MEASUREMENT_ASSISTANT"
        ? SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS
        : applicationSwitching
          ? currentApplication
          : SMART_BOARD_LAUNCHER_APPLICATIONS.MEASUREMENTS;
    return view.syncState({
      boardReady: ready,
      selectionAvailable,
      application,
      applicationSwitching,
      announce,
    });
  }

  return Object.freeze({
    sync,
    beginSwitch() {
      return sync({ switching: true });
    },
    reset() {
      return view.reset();
    },
    getSnapshot() {
      return view.getSnapshot();
    },
  });
}
