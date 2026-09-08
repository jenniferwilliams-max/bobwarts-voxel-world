export const WORKSHOP_VISIBLE_RULER_MIN = -25;
export const WORKSHOP_VISIBLE_RULER_MAX = 25;
export const WORKSHOP_VISIBLE_RULER_ELEVATION = -0.485;
export const WORKSHOP_VISIBLE_RULER_MAX_CAMERA_DISTANCE = 80;

const finite = (value) => Number.isFinite(value);

export function normalizeWorkshopVisibleRulerRange(value, {
  minimum = WORKSHOP_VISIBLE_RULER_MIN,
  maximum = WORKSHOP_VISIBLE_RULER_MAX,
} = {}) {
  if (!value || ![minimum, maximum, value.xMin, value.xMax,
    value.zMin, value.zMax].every(finite) || minimum >= maximum) return null;
  const range = {
    xMin: Math.max(minimum, Math.floor(value.xMin)),
    xMax: Math.min(maximum, Math.ceil(value.xMax)),
    zMin: Math.max(minimum, Math.floor(value.zMin)),
    zMax: Math.min(maximum, Math.ceil(value.zMax)),
  };
  if (range.xMin >= range.xMax || range.zMin >= range.zMax) return null;
  return Object.freeze({
    ...range,
    columns: range.xMax - range.xMin,
    rows: range.zMax - range.zMin,
  });
}

export function createWorkshopVisibleRulerCorners(
  range,
  elevation = WORKSHOP_VISIBLE_RULER_ELEVATION,
) {
  const normalized = normalizeWorkshopVisibleRulerRange(range);
  if (!normalized || !finite(elevation)) return null;
  return Object.freeze([
    Object.freeze({ x: normalized.xMin, y: elevation, z: normalized.zMin }),
    Object.freeze({ x: normalized.xMin, y: elevation, z: normalized.zMax }),
    Object.freeze({ x: normalized.xMax, y: elevation, z: normalized.zMin }),
    Object.freeze({ x: normalized.xMax, y: elevation, z: normalized.zMax }),
  ]);
}

export function createWorkshopVisibleRulerZoomBaseline(
  value,
  cameraDistance,
  maximumCameraDistance = WORKSHOP_VISIBLE_RULER_MAX_CAMERA_DISTANCE,
) {
  const range = normalizeWorkshopVisibleRulerRange(value);
  if (!range || !finite(cameraDistance) || cameraDistance <= 0 ||
    !finite(maximumCameraDistance) || maximumCameraDistance <= cameraDistance) return null;
  return Object.freeze({
    range,
    cameraDistance,
    maximumCameraDistance,
    centerX: (range.xMin + range.xMax) / 2,
    centerZ: (range.zMin + range.zMax) / 2,
    halfExtentX: (range.xMax - range.xMin) / 2,
    halfExtentZ: (range.zMax - range.zMin) / 2,
  });
}

export function calculateWorkshopVisibleRulerZoomRange({
  baseline,
  cameraDistance,
} = {}) {
  if (!baseline || !baseline.range || !finite(cameraDistance) ||
    cameraDistance <= 0 || !finite(baseline.cameraDistance) ||
    baseline.cameraDistance <= 0 || !finite(baseline.maximumCameraDistance) ||
    baseline.maximumCameraDistance <= baseline.cameraDistance ||
    ![baseline.centerX, baseline.centerZ, baseline.halfExtentX,
      baseline.halfExtentZ].every(finite)) return null;
  const progress = Math.max(0, Math.min(1,
    (cameraDistance - baseline.cameraDistance) /
      (baseline.maximumCameraDistance - baseline.cameraDistance),
  ));
  return normalizeWorkshopVisibleRulerRange({
    xMin: baseline.range.xMin +
      (WORKSHOP_VISIBLE_RULER_MIN - baseline.range.xMin) * progress,
    xMax: baseline.range.xMax +
      (WORKSHOP_VISIBLE_RULER_MAX - baseline.range.xMax) * progress,
    zMin: baseline.range.zMin +
      (WORKSHOP_VISIBLE_RULER_MIN - baseline.range.zMin) * progress,
    zMax: baseline.range.zMax +
      (WORKSHOP_VISIBLE_RULER_MAX - baseline.range.zMax) * progress,
  });
}

export function createWorkshopVisibleRulerPresentation() {
  let signature = "";
  let range = null;
  let zoomBaseline = null;
  return Object.freeze({
    update(value) {
      const next = normalizeWorkshopVisibleRulerRange(value);
      if (!next) return null;
      const nextSignature = [next.xMin, next.xMax, next.zMin, next.zMax].join(":");
      if (nextSignature === signature && range) return range;
      signature = nextSignature;
      range = next;
      return range;
    },
    captureZoomBaseline(value, cameraDistance, maximumCameraDistance) {
      const next = createWorkshopVisibleRulerZoomBaseline(
        value,
        cameraDistance,
        maximumCameraDistance,
      );
      if (!next) return null;
      zoomBaseline = next;
      return zoomBaseline;
    },
    calculateZoomRange(cameraDistance) {
      return calculateWorkshopVisibleRulerZoomRange({
        baseline: zoomBaseline,
        cameraDistance,
      });
    },
    reset() {
      signature = "";
      range = null;
      zoomBaseline = null;
    },
    getRange() {
      return range;
    },
    getZoomBaseline() {
      return zoomBaseline;
    },
  });
}
