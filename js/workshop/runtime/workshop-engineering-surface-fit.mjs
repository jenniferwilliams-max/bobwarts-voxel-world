export const WORKSHOP_FIT_SAFE_INSET = 28;
export const WORKSHOP_FIT_TARGET_FILL = 0.68;
export const WORKSHOP_FIT_MINIMUM_DISTANCE = 3.2;

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

export function calculateWorkshopFitSafeFrame({
  canvasBounds,
  protectedBuildZone,
  inset = WORKSHOP_FIT_SAFE_INSET,
} = {}) {
  const canvas = normalizeBounds(canvasBounds);
  const protectedZone = normalizeBounds(protectedBuildZone);
  if (!canvas || !protectedZone || !finite(inset) || inset < 0 ||
      protectedBuildZone?.blocked === true) return null;
  const left = Math.max(canvas.left, protectedZone.left) + inset;
  const top = Math.max(canvas.top, protectedZone.top) + inset;
  const right = Math.min(canvas.right, protectedZone.right) - inset;
  const bottom = Math.min(canvas.bottom, protectedZone.bottom) - inset;
  if (right <= left || bottom <= top) return null;
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  });
}

export function calculateWorkshopFitDistance({
  halfWidth,
  halfHeight,
  verticalFovDegrees,
  canvasBounds,
  safeFrame,
  targetFill = WORKSHOP_FIT_TARGET_FILL,
  minimumDistance = WORKSHOP_FIT_MINIMUM_DISTANCE,
} = {}) {
  const canvas = normalizeBounds(canvasBounds);
  const frame = normalizeBounds(safeFrame);
  if (![halfWidth, halfHeight, verticalFovDegrees, targetFill, minimumDistance]
    .every(finite) || halfWidth < 0 || halfHeight < 0 ||
      verticalFovDegrees <= 0 || verticalFovDegrees >= 180 ||
      targetFill <= 0 || targetFill > 1 || minimumDistance <= 0 ||
      !canvas || !frame) return null;
  const verticalFov = verticalFovDegrees * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * (canvas.width / canvas.height),
  );
  const heightDistance = halfHeight === 0 ? 0 :
    halfHeight / Math.tan(verticalFov / 2) *
      (canvas.height / frame.height) / targetFill;
  const widthDistance = halfWidth === 0 ? 0 :
    halfWidth / Math.tan(horizontalFov / 2) *
      (canvas.width / frame.width) / targetFill;
  return Math.max(minimumDistance, heightDistance, widthDistance) * 1.04;
}

export function calculateWorkshopFitScreenTranslation({ subjectBounds, safeFrame } = {}) {
  const subject = normalizeBounds(subjectBounds);
  const frame = normalizeBounds(safeFrame);
  if (!subject || !frame) return null;
  return Object.freeze({
    x: (frame.left + frame.right - subject.left - subject.right) / 2,
    y: (frame.top + frame.bottom - subject.top - subject.bottom) / 2,
  });
}
