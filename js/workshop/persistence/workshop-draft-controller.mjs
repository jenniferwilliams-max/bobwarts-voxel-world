const freezeCursor = (cursor) => Object.freeze(Array.isArray(cursor) ? [...cursor] : []);
const cursorKey = (cursor) => JSON.stringify(Array.isArray(cursor) ? cursor : []);

export function createWorkshopDraftController({ history } = {}) {
  if (!history || typeof history.getCursorSnapshot !== "function") {
    throw new TypeError("Workshop edit history is required.");
  }

  let objects = null;
  let parked = false;
  let generation = 0;
  let ownership = 0;
  let pending = null;
  let checkpoint = freezeCursor(history.getCursorSnapshot().cursor);
  let historyCursor = freezeCursor(history.getCursorSnapshot().cursor);
  let cachedSnapshot = null;
  let cachedSignature = "";

  const snapshot = () => {
    const dirty = cursorKey(historyCursor) !== cursorKey(checkpoint);
    const signature = JSON.stringify({
      exists:objects !== null,
      parked,
      objectCount:objects ? objects.length : 0,
      dirty,
      generation,
      pending:pending ? [pending.token, pending.kind] : null,
      checkpoint,
      historyCursor,
    });
    if (cachedSnapshot && signature === cachedSignature) return cachedSnapshot;
    cachedSignature = signature;
    cachedSnapshot = Object.freeze({
      exists: objects !== null,
      parked,
      objectCount: objects ? objects.length : 0,
      dirty,
      generation,
      pending,
      checkpoint: freezeCursor(checkpoint),
      historyCursor: freezeCursor(historyCursor),
    });
    return cachedSnapshot;
  };

  const stopObserving = typeof history.observe === "function"
    ? history.observe((next) => { historyCursor = freezeCursor(next.cursor); })
    : () => {};

  return Object.freeze({
    begin(kind) {
      if (kind !== "CAPTURE" && kind !== "RESTORE") return null;
      ownership += 1;
      pending = Object.freeze({ token: ownership, kind });
      return pending;
    },
    cancelPending() {
      ownership += 1;
      pending = null;
      return snapshot();
    },
    createBlank() {
      if (objects !== null) return snapshot();
      objects = [];
      parked = false;
      generation += 1;
      checkpoint = freezeCursor(history.getCursorSnapshot().cursor);
      historyCursor = freezeCursor(history.getCursorSnapshot().cursor);
      return snapshot();
    },
    capture(activeObjects, claim) {
      if (!claim || !pending || claim.token !== pending.token ||
          claim.kind !== "CAPTURE" || pending.kind !== "CAPTURE") return snapshot();
      if (!Array.isArray(activeObjects)) return snapshot();
      const next = activeObjects.filter((object, index, list) =>
        object && list.indexOf(object) === index
      );
      if (objects && parked && objects.length === next.length &&
          objects.every((object, index) => object === next[index])) {
        pending = null;
        return snapshot();
      }
      objects = next;
      parked = true;
      generation += 1;
      pending = null;
      return snapshot();
    },
    restore(claim) {
      if (!claim || !pending || claim.token !== pending.token ||
          claim.kind !== "RESTORE" || pending.kind !== "RESTORE") {
        return Object.freeze([]);
      }
      if (objects === null) this.createBlank();
      parked = false;
      pending = null;
      return Object.freeze([...objects]);
    },
    markCheckpoint() {
      checkpoint = freezeCursor(history.getCursorSnapshot().cursor);
      historyCursor = freezeCursor(history.getCursorSnapshot().cursor);
      return snapshot();
    },
    replaceActive(activeObjects) {
      if (!Array.isArray(activeObjects)) return snapshot();
      ownership += 1;
      pending = null;
      objects = activeObjects.filter((object,index,list) =>
        object && list.indexOf(object) === index
      );
      parked = false;
      generation += 1;
      checkpoint = freezeCursor(history.getCursorSnapshot().cursor);
      historyCursor = freezeCursor(history.getCursorSnapshot().cursor);
      return snapshot();
    },
    getSnapshot: snapshot,
    dispose() { stopObserving(); },
  });
}
