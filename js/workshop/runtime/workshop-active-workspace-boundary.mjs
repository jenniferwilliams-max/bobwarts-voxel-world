const DEFAULT_WORLD_MIN = -25;
const DEFAULT_WORLD_MAX = 25;
const VALID_SOURCES = new Set(["HOME", "MANUAL_ZOOM"]);

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function freezeSnapshot(range, source) {
  return Object.freeze({
    xMin: range.xMin,
    xMax: range.xMax,
    zMin: range.zMin,
    zMax: range.zMax,
    columns: range.xMax - range.xMin,
    rows: range.zMax - range.zMin,
    source,
    valid: true
  });
}

export function normalizeWorkshopActiveWorkspaceRange(
  range,
  source,
  options = {}
) {
  const worldMin = finiteNumber(options.worldMin)
    ? options.worldMin
    : DEFAULT_WORLD_MIN;
  const worldMax = finiteNumber(options.worldMax)
    ? options.worldMax
    : DEFAULT_WORLD_MAX;
  if (!range || !VALID_SOURCES.has(source) || !(worldMax > worldMin)) {
    return null;
  }
  const values = [range.xMin, range.xMax, range.zMin, range.zMax];
  if (!values.every(finiteNumber)) return null;

  const normalized = {
    xMin: Math.max(worldMin, Math.ceil(range.xMin)),
    xMax: Math.min(worldMax, Math.floor(range.xMax)),
    zMin: Math.max(worldMin, Math.ceil(range.zMin)),
    zMax: Math.min(worldMax, Math.floor(range.zMax))
  };
  if (!(normalized.xMax > normalized.xMin) ||
    !(normalized.zMax > normalized.zMin)) {
    return null;
  }
  return freezeSnapshot(normalized, source);
}

export function workshopBoundsFitActiveWorkspace(
  bounds,
  workspace,
  epsilon = 1e-5
) {
  if (!workspace || workspace.valid !== true || !bounds ||
    !bounds.min || !bounds.max) return false;
  const values = [
    bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z,
    workspace.xMin, workspace.xMax, workspace.zMin, workspace.zMax,
    epsilon
  ];
  if (!values.every(finiteNumber) || epsilon < 0) return false;
  return bounds.min.x >= workspace.xMin - epsilon &&
    bounds.max.x <= workspace.xMax + epsilon &&
    bounds.min.z >= workspace.zMin - epsilon &&
    bounds.max.z <= workspace.zMax + epsilon;
}

export function createWorkshopActiveWorkspaceBoundary(options = {}) {
  let snapshot = null;

  return Object.freeze({
    update(range, source) {
      const next = normalizeWorkshopActiveWorkspaceRange(range, source, options);
      if (!next) return null;
      if (snapshot && snapshot.xMin === next.xMin &&
        snapshot.xMax === next.xMax && snapshot.zMin === next.zMin &&
        snapshot.zMax === next.zMax && snapshot.source === next.source) {
        return snapshot;
      }
      snapshot = next;
      return snapshot;
    },
    contains(bounds, epsilon) {
      return workshopBoundsFitActiveWorkspace(bounds, snapshot, epsilon);
    },
    read() {
      return snapshot;
    },
    reset() {
      const changed = snapshot !== null;
      snapshot = null;
      return changed;
    }
  });
}
