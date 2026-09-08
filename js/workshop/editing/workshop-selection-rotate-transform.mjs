export const WORKSHOP_ROTATE_RIGHT_ANGLE = Math.PI / 2;

const TWO_PI = Math.PI * 2;
const validNumber = (value) => Number.isFinite(value);
const cleanNumber = (value) => {
  const cleaned = Number(value.toFixed(12));
  return Object.is(cleaned, -0) ? 0 : cleaned;
};

export function normalizeWorkshopRotationY(value) {
  if (!validNumber(value)) return null;
  const normalized = ((value % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.abs(normalized) < 1e-12 || Math.abs(normalized - TWO_PI) < 1e-12
    ? 0
    : normalized;
}

export function createWorkshopSelectionRotateCandidate({ objects, bounds } = {}) {
  if (!Array.isArray(objects) || objects.length === 0 || !bounds ||
      !bounds.min || !bounds.max ||
      !validNumber(bounds.min.x) || !validNumber(bounds.min.z) ||
      !validNumber(bounds.max.x) || !validNumber(bounds.max.z) ||
      bounds.min.x > bounds.max.x || bounds.min.z > bounds.max.z) return null;

  const pivot = Object.freeze({
    x: cleanNumber((bounds.min.x + bounds.max.x) / 2),
    z: cleanNumber((bounds.min.z + bounds.max.z) / 2),
  });
  const entries = [];

  for (const item of objects) {
    if (!item || !item.object || !item.position ||
        !validNumber(item.position.x) || !validNumber(item.position.y) ||
        !validNumber(item.position.z) || !validNumber(item.rotationY)) return null;
    const before = Object.freeze({
      x:item.position.x, y:item.position.y, z:item.position.z,
    });
    const relativeX = before.x - pivot.x;
    const relativeZ = before.z - pivot.z;
    const after = Object.freeze({
      x:cleanNumber(pivot.x - relativeZ),
      y:before.y,
      z:cleanNumber(pivot.z + relativeX),
    });
    const beforeRotationY = item.rotationY;
    const afterRotationY = normalizeWorkshopRotationY(
      normalizeWorkshopRotationY(beforeRotationY) + WORKSHOP_ROTATE_RIGHT_ANGLE
    );
    entries.push(Object.freeze({
      object:item.object,
      before,
      after,
      beforeRotationY,
      afterRotationY,
    }));
  }

  const noOp = entries.every((entry) =>
    entry.before.x === entry.after.x && entry.before.y === entry.after.y &&
    entry.before.z === entry.after.z &&
    entry.beforeRotationY === entry.afterRotationY
  );
  return Object.freeze({
    angle:WORKSHOP_ROTATE_RIGHT_ANGLE,
    pivot,
    entries:Object.freeze(entries),
    noOp,
  });
}
