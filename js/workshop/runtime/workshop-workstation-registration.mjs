export const WORKSHOP_WORKSTATION_REGISTRATION = Object.freeze({
  worldBounds: Object.freeze({
    xMin: -25,
    xMax: 25,
    zMin: -25,
    zMax: 25,
    width: 50,
    depth: 50,
  }),
  elevations: Object.freeze({
    platformSurface: -0.5,
    grid: -0.498,
    rulerProjection: -0.485,
  }),
  table: Object.freeze({
    anchor: "VISUAL_BASE_CENTER",
    preferredWidthRatio: 0.96,
    minimumWidth: 320,
    maximumWidth: 1150,
    essentialControlClearance: 12,
  }),
});

const CORNER_COORDINATES = Object.freeze([
  Object.freeze({ x: -25, z: -25 }),
  Object.freeze({ x: -25, z: 25 }),
  Object.freeze({ x: 25, z: -25 }),
  Object.freeze({ x: 25, z: 25 }),
]);

export const WORKSHOP_WORKSTATION_WORLD_CORNERS = Object.freeze(
  CORNER_COORDINATES.map(({ x, z }) => Object.freeze({
    x,
    y: WORKSHOP_WORKSTATION_REGISTRATION.elevations.rulerProjection,
    z,
  })),
);

export const WORKSHOP_WORKSTATION_EDGE_MINIMUM_SCREEN_LENGTH = 72;

const EDGE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "top", axis: "x", start: 0, end: 2 }),
  Object.freeze({ id: "right", axis: "z", start: 3, end: 2 }),
  Object.freeze({ id: "bottom", axis: "x", start: 1, end: 3 }),
  Object.freeze({ id: "left", axis: "z", start: 1, end: 0 }),
]);

const finite = (value) => Number.isFinite(value);

function frozenBounds(value) {
  if (!value || !finite(value.left) || !finite(value.top)) return null;
  const width = finite(value.width)
    ? value.width
    : finite(value.right) ? value.right - value.left : NaN;
  const height = finite(value.height)
    ? value.height
    : finite(value.bottom) ? value.bottom - value.top : NaN;
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) return null;
  return Object.freeze({
    left: value.left,
    top: value.top,
    right: value.left + width,
    bottom: value.top + height,
    width,
    height,
  });
}

function frozenProtectedZone(value) {
  const bounds = frozenBounds(value);
  if (!bounds || !finite(value?.inset) || value.inset < 0) return null;
  return Object.freeze({
    ...bounds,
    inset: value.inset,
    blocked: value.blocked === true || bounds.width === 0 || bounds.height === 0,
  });
}

function frozenTableRegistration(value) {
  if (!value || !finite(value.width) || !finite(value.height) ||
      !finite(value.imageLeft) || !finite(value.imageTop) ||
      !finite(value.anchorScreenX) || !finite(value.anchorScreenY)) return null;
  const visible = frozenBounds(value.visible);
  if (!visible) return null;
  const transform = value.transform && ["x", "y", "z", "width", "height"]
    .every((key) => finite(value.transform[key]))
    ? Object.freeze({
      x: value.transform.x,
      y: value.transform.y,
      z: value.transform.z,
      width: value.transform.width,
      height: value.transform.height,
    })
    : null;
  return Object.freeze({
    width: value.width,
    height: value.height,
    imageLeft: value.imageLeft,
    imageTop: value.imageTop,
    anchorScreenX: value.anchorScreenX,
    anchorScreenY: value.anchorScreenY,
    preferredWidth: finite(value.preferredWidth) ? value.preferredWidth : value.width,
    reducedForClearance: value.reducedForClearance === true,
    hidden: value.hidden === true,
    visible,
    transform,
  });
}

function signatureFor(value) {
  return JSON.stringify(value);
}

export function createProjectedTabletopRegistration(
  projectedCorners,
  minimumEdgeLength = WORKSHOP_WORKSTATION_EDGE_MINIMUM_SCREEN_LENGTH,
) {
  if (!Array.isArray(projectedCorners) || projectedCorners.length !== 4 ||
      !finite(minimumEdgeLength) || minimumEdgeLength <= 0) return null;
  const corners = projectedCorners.map((corner, index) => {
    if (!corner || !finite(corner.x) || !finite(corner.y) ||
        !finite(corner.depth)) return null;
    return Object.freeze({
      id: `corner-${index}`,
      x: corner.x,
      y: corner.y,
      depth: corner.depth,
      clipped: corner.depth < -1 || corner.depth > 1,
    });
  });
  if (corners.some((corner) => !corner)) return null;
  const perimeter = [corners[0], corners[2], corners[3], corners[1]];
  const signedDoubleArea = perimeter.reduce((sum, point, index) => {
    const next = perimeter[(index + 1) % perimeter.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const area = Math.abs(signedDoubleArea) / 2;
  const edges = EDGE_DEFINITIONS.map((definition) => {
    const start = corners[definition.start];
    const end = corners[definition.end];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    return Object.freeze({
      id: definition.id,
      axis: definition.axis,
      start,
      end,
      length,
      angleDegrees: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
      usable: length >= minimumEdgeLength && !start.clipped && !end.clipped,
    });
  });
  const bounds = frozenBounds({
    left: Math.min(...corners.map((corner) => corner.x)),
    top: Math.min(...corners.map((corner) => corner.y)),
    right: Math.max(...corners.map((corner) => corner.x)),
    bottom: Math.max(...corners.map((corner) => corner.y)),
  });
  const usable = !!bounds && area >= minimumEdgeLength * minimumEdgeLength &&
    edges.every((edge) => edge.usable);
  return Object.freeze({
    corners: Object.freeze(corners),
    edges: Object.freeze(edges),
    bounds,
    area,
    minimumEdgeLength,
    usable,
  });
}

export function createWorkshopWorkstationRegistration({
  getStableHomeScreenBounds,
  getLiveProjectedScreenBounds,
  getLiveProjectedTabletop,
  getProtectedBuildZone,
  getTableRegistration,
} = {}) {
  if (typeof getStableHomeScreenBounds !== "function" ||
      typeof getLiveProjectedScreenBounds !== "function" ||
      typeof getLiveProjectedTabletop !== "function" ||
      typeof getProtectedBuildZone !== "function" ||
      typeof getTableRegistration !== "function") {
    throw new TypeError("All Workshop workstation registration providers are required.");
  }

  let lastSignature = "";
  let lastSnapshot = null;

  function update() {
    const stableHomeScreenBounds = frozenBounds(getStableHomeScreenBounds());
    const liveProjectedScreenBounds = frozenBounds(getLiveProjectedScreenBounds());
    const liveProjectedTabletop = getLiveProjectedTabletop();
    const protectedBuildZone = frozenProtectedZone(getProtectedBuildZone());
    const tableRegistration = frozenTableRegistration(getTableRegistration());
    const validLiveTabletop = liveProjectedTabletop &&
      Array.isArray(liveProjectedTabletop.corners) &&
      Array.isArray(liveProjectedTabletop.edges);
    const blocked = !stableHomeScreenBounds || !liveProjectedScreenBounds ||
      !validLiveTabletop ||
      !protectedBuildZone || protectedBuildZone.blocked || !tableRegistration ||
      tableRegistration.hidden;
    const next = {
      worldBounds: WORKSHOP_WORKSTATION_REGISTRATION.worldBounds,
      elevations: WORKSHOP_WORKSTATION_REGISTRATION.elevations,
      worldCorners: WORKSHOP_WORKSTATION_WORLD_CORNERS,
      stableHomeScreenBounds,
      liveProjectedScreenBounds,
      liveProjectedCorners: validLiveTabletop
        ? liveProjectedTabletop.corners
        : null,
      orderedTabletopEdges: validLiveTabletop
        ? liveProjectedTabletop.edges
        : null,
      edgePresentationUsable: validLiveTabletop
        ? liveProjectedTabletop.usable === true
        : false,
      protectedBuildZone,
      tableRegistration,
      blocked,
    };
    const signature = signatureFor(next);
    if (signature === lastSignature && lastSnapshot) return lastSnapshot;
    lastSignature = signature;
    lastSnapshot = Object.freeze(next);
    return lastSnapshot;
  }

  return Object.freeze({
    configuration: WORKSHOP_WORKSTATION_REGISTRATION,
    worldCorners: WORKSHOP_WORKSTATION_WORLD_CORNERS,
    update,
    getSnapshot() {
      return lastSnapshot || update();
    },
  });
}
