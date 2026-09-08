export const WORKSHOP_DIRECTIONAL_MARGIN = 1;
export const WORKSHOP_DIRECTIONAL_FOV = 50;
export const WORKSHOP_DIRECTIONAL_SAFETY_SCALE = 1.06;

const DIRECTIONS = Object.freeze({
  front: Object.freeze({ position: [0, 0, 1], up: [0, 1, 0] }),
  back: Object.freeze({ position: [0, 0, -1], up: [0, 1, 0] }),
  left: Object.freeze({ position: [-1, 0, 0], up: [0, 1, 0] }),
  right: Object.freeze({ position: [1, 0, 0], up: [0, 1, 0] }),
  top: Object.freeze({ position: [0, 1, 0], up: [0, 0, -1] }),
  bottom: Object.freeze({ position: [0, -1, 0], up: [0, 0, 1] }),
});

const finite = (value) => Number.isFinite(value);
const dot = (first, second) => first[0] * second[0] +
  first[1] * second[1] + first[2] * second[2];
const cross = (first, second) => [
  first[1] * second[2] - first[2] * second[1],
  first[2] * second[0] - first[0] * second[2],
  first[0] * second[1] - first[1] * second[0],
];
const length = (value) => Math.hypot(value[0], value[1], value[2]);
const normalize = (value) => {
  const magnitude = length(value);
  return magnitude > 0 ? value.map((part) => part / magnitude) : null;
};

function normalizeBounds(value) {
  if (!value?.min || !value?.max ||
      ![value.min.x, value.min.y, value.min.z,
        value.max.x, value.max.y, value.max.z].every(finite) ||
      value.max.x < value.min.x || value.max.y < value.min.y ||
      value.max.z < value.min.z) return null;
  return {
    min: { ...value.min },
    max: { ...value.max },
  };
}

function normalizeScreenBounds(value) {
  if (!value || ![value.left, value.top, value.width, value.height].every(finite) ||
      value.width <= 0 || value.height <= 0) return null;
  return {
    left: value.left,
    top: value.top,
    right: value.left + value.width,
    bottom: value.top + value.height,
    width: value.width,
    height: value.height,
  };
}

export function calculateWorkshopDirectionalBuildFrame({
  view,
  buildBounds,
  canvasBounds,
  safeFrame,
  margin = WORKSHOP_DIRECTIONAL_MARGIN,
  fov = WORKSHOP_DIRECTIONAL_FOV,
  safetyScale = WORKSHOP_DIRECTIONAL_SAFETY_SCALE,
} = {}) {
  const definition = DIRECTIONS[view];
  const canvas = normalizeScreenBounds(canvasBounds);
  const frame = normalizeScreenBounds(safeFrame);
  if (!definition || !canvas || !frame || !finite(margin) || margin < 0 ||
      !finite(fov) || fov <= 0 || fov >= 180 ||
      !finite(safetyScale) || safetyScale < 1) return null;

  const source = normalizeBounds(buildBounds) || {
    min: { x: -6, y: -0.5, z: -6 },
    max: { x: 6, y: 3.5, z: 6 },
  };
  const bounds = {
    min: {
      x: source.min.x - margin,
      y: source.min.y - margin,
      z: source.min.z - margin,
    },
    max: {
      x: source.max.x + margin,
      y: source.max.y + margin,
      z: source.max.z + margin,
    },
  };
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const direction = normalize(definition.position);
  const up = normalize(definition.up);
  const forward = direction.map((value) => -value);
  const right = normalize(cross(forward, up));
  const viewUp = right && normalize(cross(right, forward));
  if (!direction || !up || !right || !viewUp) return null;

  let halfWidth = 0;
  let halfHeight = 0;
  [bounds.min.x, bounds.max.x].forEach((x) => {
    [bounds.min.y, bounds.max.y].forEach((y) => {
      [bounds.min.z, bounds.max.z].forEach((z) => {
        const offset = [x - center.x, y - center.y, z - center.z];
        halfWidth = Math.max(halfWidth, Math.abs(dot(offset, right)));
        halfHeight = Math.max(halfHeight, Math.abs(dot(offset, viewUp)));
      });
    });
  });

  const verticalFov = fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * canvas.width / canvas.height,
  );
  const distance = Math.max(
    6,
    halfHeight / Math.tan(verticalFov / 2) * canvas.height / frame.height,
    halfWidth / Math.tan(horizontalFov / 2) * canvas.width / frame.width,
  ) * safetyScale;
  if (!finite(distance)) return null;

  return Object.freeze({
    view,
    target: Object.freeze(center),
    direction: Object.freeze([...direction]),
    up: Object.freeze([...up]),
    distance,
    fov,
    margin,
    usedDefaultBounds: !normalizeBounds(buildBounds),
    bounds: Object.freeze({
      min: Object.freeze({ ...bounds.min }),
      max: Object.freeze({ ...bounds.max }),
    }),
  });
}

export function getWorkshopDirectionalDefinition(view) {
  return DIRECTIONS[view] || null;
}
