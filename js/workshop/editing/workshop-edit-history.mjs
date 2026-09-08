export const WORKSHOP_EDIT_OPERATION_TYPES = Object.freeze({
  PLACEMENT: "PLACEMENT",
  DELETION: "DELETION",
  MOVE: "MOVE",
  ROTATE: "ROTATE",
  RESIZE: "RESIZE",
});

const validNumber = (value) => Number.isFinite(value);
const freezeCoordinates = (position) => {
  if (!position || !validNumber(position.x) || !validNumber(position.y) ||
      !validNumber(position.z)) return null;
  return Object.freeze({ x: position.x, y: position.y, z: position.z });
};
const freezeDimensions = (dimensions) => {
  if (!dimensions || !validNumber(dimensions.width) ||
      !validNumber(dimensions.height) || !validNumber(dimensions.depth) ||
      dimensions.width <= 0 || dimensions.height <= 0 || dimensions.depth <= 0) return null;
  return Object.freeze({
    width:dimensions.width, height:dimensions.height, depth:dimensions.depth,
  });
};

function createEntry(entry) {
  if (!entry || !entry.object) return null;
  const before = entry.before == null ? null : freezeCoordinates(entry.before);
  const after = entry.after == null ? null : freezeCoordinates(entry.after);
  if ((entry.before != null && !before) || (entry.after != null && !after)) return null;
  const beforeRotationY = entry.beforeRotationY == null ? null : entry.beforeRotationY;
  const afterRotationY = entry.afterRotationY == null ? null : entry.afterRotationY;
  if ((beforeRotationY !== null && !validNumber(beforeRotationY)) ||
      (afterRotationY !== null && !validNumber(afterRotationY))) return null;
  const beforeDimensions = entry.beforeDimensions == null
    ? null : freezeDimensions(entry.beforeDimensions);
  const afterDimensions = entry.afterDimensions == null
    ? null : freezeDimensions(entry.afterDimensions);
  if ((entry.beforeDimensions != null && !beforeDimensions) ||
      (entry.afterDimensions != null && !afterDimensions)) return null;
  return Object.freeze({
    object:entry.object, before, after, beforeRotationY, afterRotationY,
    beforeDimensions, afterDimensions,
  });
}

function validOperationShape(type, entries) {
  if (new Set(entries.map((entry) => entry.object)).size !== entries.length) return false;
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.PLACEMENT) {
    return entries.every((entry) => entry.before === null && entry.after !== null);
  }
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.DELETION) {
    return entries.every((entry) => entry.before !== null && entry.after === null);
  }
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.ROTATE) {
    return entries.every((entry) => entry.before !== null && entry.after !== null &&
      entry.beforeRotationY !== null && entry.afterRotationY !== null);
  }
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.RESIZE) {
    return entries.every((entry) =>
      entry.before !== null && entry.after !== null &&
      entry.beforeRotationY !== null && entry.afterRotationY !== null &&
      entry.beforeDimensions !== null && entry.afterDimensions !== null);
  }
  return entries.every((entry) => entry.before !== null && entry.after !== null);
}

function sameCoordinates(left, right) {
  if (left === null || right === null) return left === right;
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function sameDimensions(left, right) {
  if (left === null || right === null) return left === right;
  return left.width === right.width && left.height === right.height &&
    left.depth === right.depth;
}

function sameOperation(left, right) {
  return !!left && left.type === right.type && left.entries.length === right.entries.length &&
    left.angle === right.angle && sameCoordinates(left.pivot, right.pivot) &&
    left.entries.every((entry, index) => {
      const candidate = right.entries[index];
      return entry.object === candidate.object &&
        sameCoordinates(entry.before, candidate.before) &&
        sameCoordinates(entry.after, candidate.after) &&
        entry.beforeRotationY === candidate.beforeRotationY &&
        entry.afterRotationY === candidate.afterRotationY &&
        sameDimensions(entry.beforeDimensions, candidate.beforeDimensions) &&
        sameDimensions(entry.afterDimensions, candidate.afterDimensions);
    });
}

export function createWorkshopEditTransaction({
  id,
  type,
  entries,
  translation = null,
  selection = [],
  pivot = null,
  angle = null,
} = {}) {
  if (!Number.isInteger(id) || id < 1 ||
      !Object.values(WORKSHOP_EDIT_OPERATION_TYPES).includes(type) ||
      !Array.isArray(entries) || entries.length === 0) return null;
  const frozenEntries = entries.map(createEntry);
  if (frozenEntries.some((entry) => !entry)) return null;
  if (!validOperationShape(type, frozenEntries)) return null;
  const frozenTranslation = translation == null ? null : (() => {
    if (!validNumber(translation.x) || !validNumber(translation.z)) return null;
    return Object.freeze({ x: translation.x, z: translation.z });
  })();
  if (translation != null && !frozenTranslation) return null;
  const frozenPivot = pivot == null ? null : (() => {
    if (!validNumber(pivot.x) || !validNumber(pivot.z)) return null;
    if (pivot.y != null && !validNumber(pivot.y)) return null;
    return Object.freeze(pivot.y == null
      ? { x:pivot.x, z:pivot.z }
      : { x:pivot.x, y:pivot.y, z:pivot.z });
  })();
  if (pivot != null && !frozenPivot) return null;
  const frozenAngle = angle == null ? null : angle;
  if (frozenAngle !== null && !validNumber(frozenAngle)) return null;
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.ROTATE &&
      (!frozenPivot || frozenAngle === null)) return null;
  if (type === WORKSHOP_EDIT_OPERATION_TYPES.RESIZE &&
      (!frozenPivot || !validNumber(frozenPivot.y))) return null;
  const frozenSelection = Object.freeze(Array.isArray(selection) ? [...selection] : []);
  return Object.freeze({
    id,
    type,
    entries: Object.freeze(frozenEntries),
    translation: frozenTranslation,
    selection: frozenSelection,
    pivot:frozenPivot,
    angle:frozenAngle,
  });
}

export function createWorkshopEditHistory({ validate, apply } = {}) {
  if (typeof validate !== "function" || typeof apply !== "function") {
    throw new TypeError("Edit history validate and apply adapters are required.");
  }
  const undoStack = [];
  const redoStack = [];
  let nextId = 1;
  let applying = false;
  let reservation = null;
  let reservationToken = 0;
  let revision = 0;
  const observers = new Set();

  const cursorSnapshot = () => Object.freeze({
    revision,
    cursor: Object.freeze(undoStack.map((transaction) => transaction.id)),
  });

  const snapshot = () => Object.freeze({
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    latestUndo: undoStack.at(-1) || null,
    latestRedo: redoStack.at(-1) || null,
  });

  const notify = () => {
    revision += 1;
    const current = cursorSnapshot();
    observers.forEach((observer) => {
      try { observer(current); } catch (_) {}
    });
  };

  const commit = (operation) => {
    if (applying || reservation) return Object.freeze({ ok: false, code: "BUSY" });
    const transaction = createWorkshopEditTransaction({ ...operation, id: nextId });
    if (!transaction) return Object.freeze({ ok: false, code: "INVALID_TRANSACTION" });
    if (sameOperation(undoStack.at(-1), transaction)) {
      return Object.freeze({ ok: false, code: "REPEATED" });
    }
    let valid = false;
    try { valid = validate(transaction, "COMMIT") === true; } catch (_) { valid = false; }
    if (!valid) return Object.freeze({ ok: false, code: "INVALID_OBJECTS" });
    undoStack.push(transaction);
    redoStack.length = 0;
    nextId += 1;
    notify();
    return Object.freeze({ ok: true, code: "COMMITTED", transaction });
  };

  const transfer = (direction) => {
    if (applying || reservation) return Object.freeze({ ok: false, code: "BUSY" });
    const source = direction === "UNDO" ? undoStack : redoStack;
    const destination = direction === "UNDO" ? redoStack : undoStack;
    const transaction = source.at(-1);
    if (!transaction) return Object.freeze({ ok: false, code: "EMPTY" });
    let valid = false;
    try { valid = validate(transaction, direction) === true; } catch (_) { valid = false; }
    if (!valid) return Object.freeze({ ok: false, code: "INVALID_OBJECTS" });
    applying = true;
    let applied = false;
    try { applied = apply(transaction, direction) === true; } catch (_) { applied = false; }
    applying = false;
    if (!applied) return Object.freeze({ ok: false, code: "APPLY_FAILED" });
    source.pop();
    destination.push(transaction);
    notify();
    return Object.freeze({ ok: true, code: direction === "UNDO" ? "UNDONE" : "REDONE", transaction });
  };

  const prepare = (operation) => {
    if (applying || reservation) return Object.freeze({ ok:false, code:"BUSY" });
    const transaction = createWorkshopEditTransaction({ ...operation, id:nextId });
    if (!transaction) return Object.freeze({ ok:false, code:"INVALID_TRANSACTION" });
    if (sameOperation(undoStack.at(-1), transaction)) {
      return Object.freeze({ ok:false, code:"REPEATED" });
    }
    let valid = false;
    try { valid = validate(transaction, "PREPARE") === true; } catch (_) { valid = false; }
    if (!valid) return Object.freeze({ ok:false, code:"INVALID_OBJECTS" });
    reservationToken += 1;
    reservation = Object.freeze({ token:reservationToken, transaction });
    return Object.freeze({
      ok:true, code:"PREPARED", token:reservation.token, transaction,
    });
  };

  const commitPrepared = (token) => {
    if (applying) return Object.freeze({ ok:false, code:"BUSY" });
    if (!reservation || token !== reservation.token) {
      return Object.freeze({ ok:false, code:"STALE" });
    }
    let valid = false;
    try { valid = validate(reservation.transaction, "COMMIT") === true; }
    catch (_) { valid = false; }
    if (!valid) return Object.freeze({ ok:false, code:"INVALID_OBJECTS" });
    const transaction = reservation.transaction;
    undoStack.push(transaction);
    redoStack.length = 0;
    nextId += 1;
    reservation = null;
    notify();
    return Object.freeze({ ok:true, code:"COMMITTED", transaction });
  };

  const cancelPrepared = (token) => {
    if (applying) return Object.freeze({ ok:false, code:"BUSY" });
    if (!reservation || token !== reservation.token) {
      return Object.freeze({ ok:false, code:"STALE" });
    }
    reservation = null;
    return Object.freeze({ ok:true, code:"CANCELLED" });
  };

  return Object.freeze({
    commit,
    prepare,
    commitPrepared,
    cancelPrepared,
    undo: () => transfer("UNDO"),
    redo: () => transfer("REDO"),
    reset() {
      reservationToken += 1;
      reservation = null;
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
      return Object.freeze({ ok: true, code: "RESET" });
    },
    observe(observer) {
      if (typeof observer !== "function") return () => {};
      observers.add(observer);
      return () => observers.delete(observer);
    },
    getCursorSnapshot: cursorSnapshot,
    getSnapshot: snapshot,
  });
}
