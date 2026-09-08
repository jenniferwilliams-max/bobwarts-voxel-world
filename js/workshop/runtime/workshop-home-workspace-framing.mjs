export const WORKSHOP_HOME_WORKSPACE_SIZE = 20;
export const WORKSHOP_HOME_WORKSPACE_HALF_SIZE = 10;
export const WORKSHOP_HOME_FOV = 50;
export const WORKSHOP_HOME_PITCH_DEGREES = 90;
export const WORKSHOP_HOME_SAFETY_INSET = 12;
export const WORKSHOP_HOME_MINIMUM_FILL = 0.82;
export const WORKSHOP_HOME_BUILD_MARGIN = 1;

const finite = (value) => Number.isFinite(value);

function normalizeBounds(value) {
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

function deepFreezeFrame(value) {
  return Object.freeze({
    ...value,
    target: Object.freeze({ ...value.target }),
    workspace: Object.freeze({ ...value.workspace }),
    safeFrame: Object.freeze({ ...value.safeFrame }),
    workspaceBounds: Object.freeze({ ...value.workspaceBounds }),
    fullSurfaceBounds: Object.freeze({ ...value.fullSurfaceBounds }),
  });
}

function boundsFromPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function normalizeBuildBounds(value) {
  if (!value) return null;
  const min = value.min;
  const max = value.max;
  if (!min || !max || ![min.x, min.y, min.z, max.x, max.y, max.z].every(finite) ||
      max.x < min.x || max.y < min.y || max.z < min.z) return null;
  return { min: { ...min }, max: { ...max } };
}

export function calculateWorkshopHomeWorkspaceFrame({
  canvasBounds,
  protectedBuildZone,
  workspaceSize = WORKSHOP_HOME_WORKSPACE_SIZE,
  fov = WORKSHOP_HOME_FOV,
  pitchDegrees = WORKSHOP_HOME_PITCH_DEGREES,
  inset = WORKSHOP_HOME_SAFETY_INSET,
  minimumFill = WORKSHOP_HOME_MINIMUM_FILL,
  buildBounds,
  buildMargin = WORKSHOP_HOME_BUILD_MARGIN,
} = {}) {
  const canvas = normalizeBounds(canvasBounds);
  const protectedZone = normalizeBounds(protectedBuildZone);
  if (!canvas || !protectedZone || protectedBuildZone?.blocked === true ||
      ![workspaceSize, fov, pitchDegrees, inset, minimumFill].every(finite) ||
      workspaceSize <= 0 || fov <= 0 || fov >= 180 ||
      pitchDegrees !== WORKSHOP_HOME_PITCH_DEGREES || inset < 0 ||
      minimumFill <= 0 || minimumFill > 1 || !finite(buildMargin) ||
      buildMargin < 0) return null;

  const left = Math.max(canvas.left, protectedZone.left) + inset;
  const top = Math.max(canvas.top, protectedZone.top) + inset;
  const right = Math.min(canvas.right, protectedZone.right) - inset;
  const bottom = Math.min(canvas.bottom, protectedZone.bottom) - inset;
  if (right - left <= 44 || bottom - top <= 44) return null;

  const verticalTangent = Math.tan(fov * Math.PI / 360);
  const horizontalTangent = verticalTangent * canvas.width / canvas.height;
  const half = workspaceSize / 2;
  const surfaceY = -0.5;
  const build = normalizeBuildBounds(buildBounds);
  const subject = {
    min: {
      x: build ? Math.min(-half, build.min.x - buildMargin) : -half,
      y: build ? Math.min(surfaceY, build.min.y - buildMargin) : surfaceY,
      z: build ? Math.min(-half, build.min.z - buildMargin) : -half,
    },
    max: {
      x: build ? Math.max(half, build.max.x + buildMargin) : half,
      y: build ? Math.max(surfaceY, build.max.y + buildMargin) : surfaceY,
      z: build ? Math.max(half, build.max.z + buildMargin) : half,
    },
  };
  const subjectCenter = {
    x: (subject.min.x + subject.max.x) / 2,
    y: (subject.min.y + subject.max.y) / 2,
    z: (subject.min.z + subject.max.z) / 2,
  };
  const safeCenterX = (left + right) / 2;
  const safeCenterY = (top + bottom) / 2;
  const desiredNdcX = (safeCenterX - (canvas.left + canvas.width / 2)) /
    (canvas.width / 2);
  const desiredNdcY = ((canvas.top + canvas.height / 2) - safeCenterY) /
    (canvas.height / 2);

  function cameraFor(distance) {
    if (!finite(distance) || distance <= 0.1) {
      return null;
    }
    const targetX = subjectCenter.x - desiredNdcX * distance * horizontalTangent;
    const targetY = surfaceY;
    const targetZ = subjectCenter.z + desiredNdcY * distance * verticalTangent;
    if (![targetX, targetY, targetZ].every(finite)) return null;

    function project(x, y, z) {
      const depth = targetY + distance - y;
      if (!finite(depth) || depth <= 0.1) return null;
      const projectedX = (x - targetX) / (depth * horizontalTangent);
      const projectedY = (targetZ - z) / (depth * verticalTangent);
      return {
        x: canvas.left + (projectedX + 1) * canvas.width / 2,
        y: canvas.top + (1 - projectedY) * canvas.height / 2,
      };
    }

    function projectBox(box) {
      const points = [box.min.x, box.max.x].flatMap((x) =>
        [box.min.y, box.max.y].flatMap((y) =>
          [box.min.z, box.max.z].map((z) => project(x, y, z))));
      return points.every(Boolean) ? boundsFromPoints(points) : null;
    }

    return {
      targetX,
      targetY,
      targetZ,
      workspaceBounds: projectBox(subject),
      fullSurfaceBounds: projectBox({
        min: { x: -25, y: surfaceY, z: -25 },
        max: { x: 25, y: surfaceY, z: 25 },
      }),
    };
  }

  function fits(distance) {
    const candidate = cameraFor(distance);
    const bounds = candidate?.workspaceBounds;
    return !!bounds && bounds.left >= left && bounds.right <= right &&
      bounds.top >= top && bounds.bottom <= bottom;
  }

  let lower = 3;
  let upper = 160;
  if (!fits(upper)) return null;
  for (let index = 0; index < 64; index += 1) {
    const midpoint = (lower + upper) / 2;
    if (fits(midpoint)) upper = midpoint;
    else lower = midpoint;
  }
  const totalDistance = upper * 1.015;
  const camera = cameraFor(totalDistance);
  if (!camera?.workspaceBounds || !camera.fullSurfaceBounds) return null;
  // Home retains the existing cameraDistance owner, but in perpendicular CAD
  // presentation that value is the vertical distance above the X/Z surface.
  // The existing wheel path can therefore zoom without changing projection.
  const horizontalDistance = totalDistance;
  const height = camera.targetY + totalDistance;
  if (![totalDistance, horizontalDistance, height].every(finite) ||
      horizontalDistance < 6 || horizontalDistance > 80) return null;

  const safeWidth = right - left;
  const safeHeight = bottom - top;
  const fillRatio = Math.max(
    camera.workspaceBounds.width / safeWidth,
    camera.workspaceBounds.height / safeHeight,
  );
  const fullSurfaceFullyVisible =
    camera.fullSurfaceBounds.left >= canvas.left &&
    camera.fullSurfaceBounds.right <= canvas.right &&
    camera.fullSurfaceBounds.top >= canvas.top &&
    camera.fullSurfaceBounds.bottom <= canvas.bottom;
  const buildRequiresFullSurface = subject.min.x <= -25 || subject.max.x >= 25 ||
    subject.min.z <= -25 || subject.max.z >= 25;
  if (fillRatio < minimumFill ||
    (fullSurfaceFullyVisible && !buildRequiresFullSurface)) return null;

  return deepFreezeFrame({
    target: { x: camera.targetX, y: camera.targetY, z: camera.targetZ },
    workspace: {
      size: workspaceSize,
      xMin: subject.min.x,
      xMax: subject.max.x,
      yMin: subject.min.y,
      yMax: subject.max.y,
      zMin: subject.min.z,
      zMax: subject.max.z,
    },
    safeFrame: { left, top, right, bottom, width: right - left, height: bottom - top },
    fov,
    pitchDegrees,
    perpendicular: true,
    totalDistance,
    horizontalDistance,
    height,
    fillRatio,
    fullSurfaceFullyVisible,
    workspaceBounds: camera.workspaceBounds,
    fullSurfaceBounds: camera.fullSurfaceBounds,
  });
}

export function calculateDeterministicWorkshopHomeFallback({
  canvasBounds,
  protectedBuildZone,
  buildBounds,
} = {}) {
  const canvas = normalizeBounds(canvasBounds);
  if (!canvas) return null;
  const protectedZone = normalizeBounds(protectedBuildZone);
  const safeZone = protectedZone && protectedBuildZone?.blocked !== true
    ? protectedZone
    : canvas;
  return calculateWorkshopHomeWorkspaceFrame({
    canvasBounds: canvas,
    protectedBuildZone: { ...safeZone, blocked: false },
    buildBounds,
    minimumFill: 0.01,
  });
}

export function createWorkshopHomeWorkspaceFraming() {
  let signature = "";
  let frame = null;
  return Object.freeze({
    update(input = {}) {
      const nextSignature = JSON.stringify(input);
      if (nextSignature === signature) return frame;
      const next = calculateWorkshopHomeWorkspaceFrame(input);
      if (!next) return null;
      signature = nextSignature;
      frame = next;
      return frame;
    },
    fallback(input = {}) {
      return calculateDeterministicWorkshopHomeFallback(input);
    },
    reset() {
      signature = "";
      frame = null;
    },
  });
}
