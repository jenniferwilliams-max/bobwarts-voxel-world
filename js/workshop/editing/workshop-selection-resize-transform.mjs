export const WORKSHOP_RESIZE_STEP_CM = 1;
export const WORKSHOP_RESIZE_MINIMUM_CM = 1;
export const WORKSHOP_RESIZE_ROTATION_TOLERANCE = 0.0001;

const validNumber = (value) => Number.isFinite(value);
const cleanNumber = (value) => {
  const cleaned = Number(value.toFixed(12));
  return Object.is(cleaned, -0) ? 0 : cleaned;
};

const freezePoint = (point) => {
  if (!point || !validNumber(point.x) || !validNumber(point.y) ||
      !validNumber(point.z)) return null;
  return Object.freeze({ x:point.x, y:point.y, z:point.z });
};

const freezeDimensions = (dimensions) => {
  if (!dimensions || !validNumber(dimensions.width) ||
      !validNumber(dimensions.height) || !validNumber(dimensions.depth) ||
      dimensions.width <= 0 || dimensions.height <= 0 || dimensions.depth <= 0) {
    return null;
  }
  return Object.freeze({
    width:dimensions.width,
    height:dimensions.height,
    depth:dimensions.depth,
  });
};

const itemMinimumDimensions = (item, fallback) => {
  const minimum = item && item.minimumDimensions
    ? freezeDimensions(item.minimumDimensions)
    : Object.freeze({ width:fallback, height:fallback, depth:fallback });
  return minimum;
};

const normalizeQuarterTurn = (rotationY, tolerance) => {
  if (!validNumber(rotationY)) return null;
  const quarter = Math.PI / 2;
  const turns = Math.round(rotationY / quarter);
  if (Math.abs(rotationY - turns * quarter) > tolerance) return null;
  return ((turns % 4) + 4) % 4;
};

const freezeBounds = (bounds) => {
  if (!bounds || !bounds.min || !bounds.max) return null;
  const min = freezePoint(bounds.min);
  const max = freezePoint(bounds.max);
  if (!min || !max || max.x <= min.x || max.y <= min.y || max.z <= min.z) return null;
  return Object.freeze({ min, max });
};

export function createWorkshopSelectionResizeCandidate({
  items,
  bounds,
  delta,
  minimumDimension = WORKSHOP_RESIZE_MINIMUM_CM,
  rotationTolerance = WORKSHOP_RESIZE_ROTATION_TOLERANCE,
} = {}) {
  const beforeBounds = freezeBounds(bounds);
  if (!Array.isArray(items) || items.length === 0 || !beforeBounds ||
      (delta !== WORKSHOP_RESIZE_STEP_CM && delta !== -WORKSHOP_RESIZE_STEP_CM) ||
      !validNumber(minimumDimension) || minimumDimension <= 0 ||
      !validNumber(rotationTolerance) || rotationTolerance < 0) return null;
  if (new Set(items.map((item) => item && item.object)).size !== items.length) return null;

  const beforeAggregateDimensions = freezeDimensions({
    width:cleanNumber(beforeBounds.max.x - beforeBounds.min.x),
    height:cleanNumber(beforeBounds.max.y - beforeBounds.min.y),
    depth:cleanNumber(beforeBounds.max.z - beforeBounds.min.z),
  });
  const afterAggregateDimensions = freezeDimensions({
    width:cleanNumber(beforeAggregateDimensions.width + delta),
    height:cleanNumber(beforeAggregateDimensions.height + delta),
    depth:cleanNumber(beforeAggregateDimensions.depth + delta),
  });
  if (!afterAggregateDimensions) return null;

  const factors = Object.freeze({
    x:afterAggregateDimensions.width / beforeAggregateDimensions.width,
    y:afterAggregateDimensions.height / beforeAggregateDimensions.height,
    z:afterAggregateDimensions.depth / beforeAggregateDimensions.depth,
  });
  const pivot = Object.freeze({
    x:cleanNumber((beforeBounds.min.x + beforeBounds.max.x) / 2),
    y:beforeBounds.min.y,
    z:cleanNumber((beforeBounds.min.z + beforeBounds.max.z) / 2),
  });

  const entries = [];
  for (const item of items) {
    if (!item || !item.object || item.geometryType !== "BoxGeometry") return null;
    const beforeDimensions = freezeDimensions(item.dimensions);
    const before = freezePoint(item.position);
    const scale = freezePoint(item.scale);
    if (!beforeDimensions || !before || !scale || scale.x <= 0 || scale.y <= 0 ||
        scale.z <= 0 || !item.rotation || !validNumber(item.rotation.x) ||
        !validNumber(item.rotation.y) || !validNumber(item.rotation.z) ||
        Math.abs(item.rotation.x) > rotationTolerance ||
        Math.abs(item.rotation.z) > rotationTolerance) return null;
    const quarterTurn = normalizeQuarterTurn(item.rotation.y, rotationTolerance);
    if (quarterTurn === null) return null;
    const minimumDimensions = itemMinimumDimensions(item, minimumDimension);
    if (!minimumDimensions) return null;
    const swapsHorizontalAxes = quarterTurn % 2 === 1;
    const afterDimensions = freezeDimensions({
      width:cleanNumber(beforeDimensions.width *
        (swapsHorizontalAxes ? factors.z : factors.x)),
      height:cleanNumber(beforeDimensions.height * factors.y),
      depth:cleanNumber(beforeDimensions.depth *
        (swapsHorizontalAxes ? factors.x : factors.z)),
    });
    if (!afterDimensions || afterDimensions.width < minimumDimensions.width ||
        afterDimensions.height < minimumDimensions.height ||
        afterDimensions.depth < minimumDimensions.depth) return null;
    const after = freezePoint({
      x:cleanNumber(pivot.x + (before.x - pivot.x) * factors.x),
      y:cleanNumber(pivot.y + (before.y - pivot.y) * factors.y),
      z:cleanNumber(pivot.z + (before.z - pivot.z) * factors.z),
    });
    entries.push(Object.freeze({
      object:item.object,
      before,
      after,
      beforeRotationY:item.rotation.y,
      afterRotationY:item.rotation.y,
      beforeDimensions,
      afterDimensions,
    }));
  }

  const afterBounds = Object.freeze({
    min:Object.freeze({ x:cleanNumber(pivot.x - afterAggregateDimensions.width / 2),
      y:pivot.y, z:cleanNumber(pivot.z - afterAggregateDimensions.depth / 2) }),
    max:Object.freeze({ x:cleanNumber(pivot.x + afterAggregateDimensions.width / 2),
      y:cleanNumber(pivot.y + afterAggregateDimensions.height),
      z:cleanNumber(pivot.z + afterAggregateDimensions.depth / 2) }),
  });
  return Object.freeze({
    delta,
    pivot,
    factors,
    beforeBounds,
    afterBounds,
    beforeAggregateDimensions,
    afterAggregateDimensions,
    entries:Object.freeze(entries),
    noOp:false,
  });
}
