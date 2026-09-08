export const WORKSHOP_CLASSROOM_CAMERA_VIEWS = Object.freeze([
  "HOME", "TOP", "FRONT", "BACK", "LEFT", "RIGHT", "BOTTOM",
  "FIT_SELECTION",
]);

export const WORKSHOP_CLASSROOM_RULER_MODES = Object.freeze([
  "EDGES", "READABLE_FALLBACK", "BLOCKED",
]);

const CAMERA_VIEW_SET = new Set(WORKSHOP_CLASSROOM_CAMERA_VIEWS);

function deepFrozenCopy(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFrozenCopy(item)));
  }
  const copy = {};
  Object.keys(value).forEach((key) => {
    copy[key] = deepFrozenCopy(value[key]);
  });
  return Object.freeze(copy);
}

function safeRead(provider, fallback) {
  try {
    const value = provider();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function signatureFor(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "INVALID";
  }
}

export function createWorkshopClassroomWorkspacePresentation({
  getActive,
  getCameraView,
  getFitSelection,
  getGeometryValid,
  getResetSnapshot,
  getWorkstationSnapshot,
  getRulerSnapshot,
} = {}) {
  const providers = [
    getActive, getCameraView, getFitSelection, getGeometryValid,
    getResetSnapshot, getWorkstationSnapshot, getRulerSnapshot,
  ];
  if (providers.some((provider) => typeof provider !== "function")) {
    throw new TypeError("All classroom workspace presentation providers are required.");
  }

  let lastSignature = "";
  let lastSnapshot = null;

  function settle(next) {
    const signature = signatureFor(next);
    if (lastSnapshot && signature === lastSignature) return lastSnapshot;
    lastSignature = signature;
    lastSnapshot = deepFrozenCopy(next);
    return lastSnapshot;
  }

  function inactiveSnapshot() {
    return {
      active: false,
      cameraView: "HOME",
      fitSelection: false,
      geometryValid: false,
      rulerMode: "BLOCKED",
      protectedBuildZone: null,
      tableRegistration: null,
      workstationRegistration: null,
    };
  }

  function update() {
    if (safeRead(getActive, false) !== true) {
      return settle(inactiveSnapshot());
    }

    const fitSelection = safeRead(getFitSelection, false) === true;
    const rawCameraView = fitSelection
      ? "FIT_SELECTION"
      : String(safeRead(getCameraView, "")).toUpperCase();
    const namedCameraView = CAMERA_VIEW_SET.has(rawCameraView)
      ? rawCameraView
      : null;
    const resetSnapshot = safeRead(getResetSnapshot, null);
    const workstationSnapshot = safeRead(getWorkstationSnapshot, null);
    const rulerSnapshot = safeRead(getRulerSnapshot, null);
    const protectedBuildZone = workstationSnapshot?.protectedBuildZone ||
      resetSnapshot?.protectedBuildZone || null;
    const tableRegistration = workstationSnapshot?.tableRegistration || null;
    const geometryValid = namedCameraView !== null &&
      safeRead(getGeometryValid, false) === true &&
      resetSnapshot?.active === true &&
      workstationSnapshot?.blocked === false &&
      protectedBuildZone?.blocked === false &&
      tableRegistration?.hidden === false;
    const rulerMode = geometryValid
      ? rulerSnapshot?.mode === "edges"
        ? "EDGES"
        : rulerSnapshot?.mode === "fallback"
          ? "READABLE_FALLBACK"
          : "BLOCKED"
      : "BLOCKED";

    return settle({
      active: true,
      cameraView: namedCameraView || "HOME",
      fitSelection,
      geometryValid,
      rulerMode,
      protectedBuildZone,
      tableRegistration,
      workstationRegistration: workstationSnapshot,
    });
  }

  return Object.freeze({
    update,
    reset() {
      return settle(inactiveSnapshot());
    },
    getSnapshot() {
      return update();
    },
  });
}
