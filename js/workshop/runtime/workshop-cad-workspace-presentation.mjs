export const WORKSHOP_CAD_SAFE_INSET = 12;
export const WORKSHOP_CAD_GRID_MIN = -25;
export const WORKSHOP_CAD_GRID_MAX = 25;

const finite = (value) => Number.isFinite(value);

function normalizeRect(value) {
  if (!value || !finite(value.left) || !finite(value.top)) return null;
  const width = finite(value.width)
    ? value.width
    : finite(value.right) ? value.right - value.left : NaN;
  const height = finite(value.height)
    ? value.height
    : finite(value.bottom) ? value.bottom - value.top : NaN;
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) return null;
  return {
    left: value.left,
    top: value.top,
    right: value.left + width,
    bottom: value.top + height,
    width,
    height,
  };
}

function intersects(first, second) {
  return first.right > second.left && first.left < second.right &&
    first.bottom > second.top && first.top < second.bottom;
}

export function calculateWorkshopCadSafeFrame({
  canvasBounds,
  protectedBounds = [],
  inset = WORKSHOP_CAD_SAFE_INSET,
} = {}) {
  const canvas = normalizeRect(canvasBounds);
  if (!canvas || !finite(inset) || inset < 0) return null;
  const frame = {
    left: canvas.left + inset,
    top: canvas.top + inset,
    right: canvas.right - inset,
    bottom: canvas.bottom - inset,
  };
  const canvasCenterX = canvas.left + canvas.width / 2;
  const canvasCenterY = canvas.top + canvas.height / 2;
  protectedBounds.map(normalizeRect).filter(Boolean).forEach((bounds) => {
    if (!intersects(canvas, bounds)) return;
    if (bounds.right <= canvasCenterX) {
      frame.left = Math.max(frame.left, bounds.right + inset);
    } else if (bounds.left >= canvasCenterX) {
      frame.right = Math.min(frame.right, bounds.left - inset);
    } else if (bounds.top >= canvasCenterY) {
      frame.bottom = Math.min(frame.bottom, bounds.top - inset);
    } else if (bounds.bottom <= canvasCenterY) {
      frame.top = Math.max(frame.top, bounds.bottom + inset);
    } else {
      return;
    }
  });
  const width = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  if (width <= 88 || height <= 88) return null;
  return Object.freeze({ ...frame, width, height, inset, blocked: false });
}

function clampBoundary(value) {
  return Math.max(WORKSHOP_CAD_GRID_MIN, Math.min(WORKSHOP_CAD_GRID_MAX, value));
}

export function calculateWorkshopCadGridPresentation({
  workspace,
  fullGrid = false,
} = {}) {
  const source = fullGrid ? {
    xMin: WORKSHOP_CAD_GRID_MIN,
    xMax: WORKSHOP_CAD_GRID_MAX,
    zMin: WORKSHOP_CAD_GRID_MIN,
    zMax: WORKSHOP_CAD_GRID_MAX,
  } : workspace;
  if (!source || ![source.xMin, source.xMax, source.zMin, source.zMax].every(finite) ||
      source.xMax < source.xMin || source.zMax < source.zMin) return null;
  const bounds = {
    xMin: clampBoundary(Math.floor(source.xMin)),
    xMax: clampBoundary(Math.ceil(source.xMax)),
    zMin: clampBoundary(Math.floor(source.zMin)),
    zMax: clampBoundary(Math.ceil(source.zMax)),
  };
  if (bounds.xMax <= bounds.xMin || bounds.zMax <= bounds.zMin) return null;
  const minor = [];
  const major = [];
  const origin = [];
  for (let x = bounds.xMin; x <= bounds.xMax; x += 1) {
    const target = x === 0 ? origin : x % 5 === 0 ? major : minor;
    target.push(x, 0, bounds.zMin, x, 0, bounds.zMax);
  }
  for (let z = bounds.zMin; z <= bounds.zMax; z += 1) {
    const target = z === 0 ? origin : z % 5 === 0 ? major : minor;
    target.push(bounds.xMin, 0, z, bounds.xMax, 0, z);
  }
  return Object.freeze({
    bounds: Object.freeze(bounds),
    cells: Object.freeze({
      columns: bounds.xMax - bounds.xMin,
      rows: bounds.zMax - bounds.zMin,
    }),
    boundaries: Object.freeze({
      vertical: bounds.xMax - bounds.xMin + 1,
      horizontal: bounds.zMax - bounds.zMin + 1,
    }),
    unit: "CENTIMETER",
    visibleMillimeterSubdivisions: false,
    positions: Object.freeze({
      minor: Object.freeze(minor),
      major: Object.freeze(major),
      origin: Object.freeze(origin),
    }),
    fullGrid: bounds.xMin === WORKSHOP_CAD_GRID_MIN &&
      bounds.xMax === WORKSHOP_CAD_GRID_MAX &&
      bounds.zMin === WORKSHOP_CAD_GRID_MIN &&
      bounds.zMax === WORKSHOP_CAD_GRID_MAX,
  });
}

export function createWorkshopCadWorkspacePresentation() {
  let signature = "";
  let snapshot = null;
  return Object.freeze({
    update(input = {}) {
      const nextSignature = JSON.stringify(input);
      if (nextSignature === signature) return snapshot;
      const safeFrame = calculateWorkshopCadSafeFrame(input);
      if (!safeFrame) return null;
      signature = nextSignature;
      snapshot = Object.freeze({ safeFrame });
      return snapshot;
    },
    reset() {
      signature = "";
      snapshot = null;
    },
  });
}
