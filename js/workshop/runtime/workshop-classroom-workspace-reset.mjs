export const WORKSHOP_CLASSROOM_RESET_CLASS = "workshopClassroomWorkspaceReset";
export const WORKSHOP_PROTECTED_BUILD_ZONE_INSET = 12;

const freezeResult = (value) => Object.freeze(value);
const finite = (value) => Number.isFinite(value);

function normalizedBounds(bounds) {
  if (!bounds || !finite(bounds.left) || !finite(bounds.top)) return null;
  const width = finite(bounds.width)
    ? bounds.width
    : finite(bounds.right) ? bounds.right - bounds.left : NaN;
  const height = finite(bounds.height)
    ? bounds.height
    : finite(bounds.bottom) ? bounds.bottom - bounds.top : NaN;
  if (!finite(width) || !finite(height) || width < 0 || height < 0) return null;
  return freezeResult({
    left: bounds.left,
    top: bounds.top,
    right: bounds.left + width,
    bottom: bounds.top + height,
    width,
    height,
  });
}

const area = (bounds) => Math.max(0, bounds.right - bounds.left) *
  Math.max(0, bounds.bottom - bounds.top);

const intersects = (first, second) => first.right > second.left &&
  first.left < second.right && first.bottom > second.top && first.top < second.bottom;

function largestClearRectangle(zone, obstacle, inset) {
  const expanded = {
    left: obstacle.left - inset,
    top: obstacle.top - inset,
    right: obstacle.right + inset,
    bottom: obstacle.bottom + inset,
  };
  if (!intersects(zone, expanded)) return zone;
  const candidates = [
    { ...zone, right: Math.min(zone.right, expanded.left) },
    { ...zone, left: Math.max(zone.left, expanded.right) },
    { ...zone, bottom: Math.min(zone.bottom, expanded.top) },
    { ...zone, top: Math.max(zone.top, expanded.bottom) },
  ].filter((candidate) => candidate.right > candidate.left && candidate.bottom > candidate.top);
  return candidates.sort((first, second) => area(second) - area(first))[0] || {
    left: zone.left,
    top: zone.top,
    right: zone.left,
    bottom: zone.top,
  };
}

export function calculateWorkshopProtectedBuildZone({
  stageBounds,
  protectedBounds = [],
  inset = WORKSHOP_PROTECTED_BUILD_ZONE_INSET,
} = {}) {
  const stage = normalizedBounds(stageBounds);
  if (!stage || !finite(inset) || inset < 0) {
    throw new TypeError("Valid stage bounds and a nonnegative inset are required.");
  }
  let zone = {
    left: stage.left + inset,
    top: stage.top + inset,
    right: stage.right - inset,
    bottom: stage.bottom - inset,
  };
  if (zone.right <= zone.left || zone.bottom <= zone.top) {
    zone.right = zone.left;
    zone.bottom = zone.top;
  }
  protectedBounds.map(normalizedBounds).filter(Boolean).forEach((bounds) => {
    zone = largestClearRectangle(zone, bounds, inset);
  });
  const width = Math.max(0, zone.right - zone.left);
  const height = Math.max(0, zone.bottom - zone.top);
  return freezeResult({
    left: zone.left,
    top: zone.top,
    right: zone.left + width,
    bottom: zone.top + height,
    width,
    height,
    inset,
    blocked: width === 0 || height === 0,
  });
}

export function createWorkshopClassroomWorkspaceReset({
  body,
  stage,
  protectedElements = [],
  neutralBackground,
} = {}) {
  if (!body?.classList || !stage || typeof stage.getBoundingClientRect !== "function" ||
      !neutralBackground) {
    throw new TypeError("Body, measurable stage, and neutral background are required.");
  }
  let active = false;

  const measureProtectedBuildZone = () => calculateWorkshopProtectedBuildZone({
    stageBounds: stage.getBoundingClientRect(),
    protectedBounds: protectedElements.filter((element) => element &&
      typeof element.getBoundingClientRect === "function")
      .map((element) => element.getBoundingClientRect())
      .filter((bounds) => bounds.width > 0 && bounds.height > 0),
  });

  return Object.freeze({
    activate() {
      if (active) return freezeResult({ ok: true, code: "IDEMPOTENT" });
      active = true;
      body.classList.add(WORKSHOP_CLASSROOM_RESET_CLASS);
      return freezeResult({ ok: true, code: "ACTIVATED" });
    },
    deactivate() {
      if (!active) {
        body.classList.remove(WORKSHOP_CLASSROOM_RESET_CLASS);
        return freezeResult({ ok: true, code: "IDEMPOTENT" });
      }
      active = false;
      body.classList.remove(WORKSHOP_CLASSROOM_RESET_CLASS);
      return freezeResult({ ok: true, code: "DEACTIVATED" });
    },
    selectBackground(environmentBackground) {
      return active ? neutralBackground : environmentBackground;
    },
    measureProtectedBuildZone,
    getSnapshot() {
      return freezeResult({ active, protectedBuildZone: measureProtectedBuildZone() });
    },
  });
}
