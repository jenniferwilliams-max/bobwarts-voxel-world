export const WORKSHOP_SELECTION_MOVE_STATES = Object.freeze({
  INACTIVE: "INACTIVE",
  ARMED: "ARMED",
  PREVIEW_VALID: "PREVIEW_VALID",
  PREVIEW_INVALID: "PREVIEW_INVALID",
  COMMITTING: "COMMITTING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

const result = (ok, code, snapshot) => Object.freeze({ ok, code, snapshot });

export function createWorkshopSelectionMoveController() {
  let state = WORKSHOP_SELECTION_MOVE_STATES.INACTIVE;
  let token = 0;
  let selection = Object.freeze([]);
  let candidate = null;
  let anchorOffset = Object.freeze({ x: 0, z: 0 });

  const getSnapshot = () => Object.freeze({
    state, token, selection, candidate, anchorOffset,
  });
  const invalidate = () => { token += 1; return token; };

  return Object.freeze({
    arm(objects, requestedAnchorOffset = { x: 0, z: 0 }) {
      if (!Array.isArray(objects) || objects.length === 0 || objects.some((object) => !object)) {
        return result(false, "SELECTION_REQUIRED", getSnapshot());
      }
      if (!requestedAnchorOffset || !Number.isFinite(requestedAnchorOffset.x) ||
          !Number.isFinite(requestedAnchorOffset.z)) {
        return result(false, "INVALID_ANCHOR", getSnapshot());
      }
      if (state === WORKSHOP_SELECTION_MOVE_STATES.ARMED &&
          selection.length === objects.length &&
          selection.every((object, index) => object === objects[index]) &&
          anchorOffset.x === requestedAnchorOffset.x &&
          anchorOffset.z === requestedAnchorOffset.z) {
        return result(true, "IDEMPOTENT", getSnapshot());
      }
      invalidate();
      selection = Object.freeze([...objects]);
      anchorOffset = Object.freeze({
        x: requestedAnchorOffset.x,
        z: requestedAnchorOffset.z,
      });
      candidate = null;
      state = WORKSHOP_SELECTION_MOVE_STATES.ARMED;
      return result(true, "ARMED", getSnapshot());
    },
    preview(nextCandidate, valid) {
      if (![WORKSHOP_SELECTION_MOVE_STATES.ARMED,
        WORKSHOP_SELECTION_MOVE_STATES.PREVIEW_VALID,
        WORKSHOP_SELECTION_MOVE_STATES.PREVIEW_INVALID].includes(state)) {
        return result(false, "NOT_ARMED", getSnapshot());
      }
      candidate = nextCandidate == null ? null : Object.freeze({ ...nextCandidate });
      state = valid
        ? WORKSHOP_SELECTION_MOVE_STATES.PREVIEW_VALID
        : WORKSHOP_SELECTION_MOVE_STATES.PREVIEW_INVALID;
      return result(true, state, getSnapshot());
    },
    beginCommit(expectedToken) {
      if (expectedToken !== token) return result(false, "STALE", getSnapshot());
      if (state !== WORKSHOP_SELECTION_MOVE_STATES.PREVIEW_VALID) {
        return result(false, "VALID_PREVIEW_REQUIRED", getSnapshot());
      }
      state = WORKSHOP_SELECTION_MOVE_STATES.COMMITTING;
      return result(true, "COMMITTING", getSnapshot());
    },
    complete(expectedToken) {
      if (expectedToken !== token) return result(false, "STALE", getSnapshot());
      if (state === WORKSHOP_SELECTION_MOVE_STATES.COMPLETED) {
        return result(true, "IDEMPOTENT", getSnapshot());
      }
      if (state !== WORKSHOP_SELECTION_MOVE_STATES.COMMITTING) {
        return result(false, "NOT_COMMITTING", getSnapshot());
      }
      state = WORKSHOP_SELECTION_MOVE_STATES.COMPLETED;
      return result(true, "COMPLETED", getSnapshot());
    },
    cancel() {
      if (state === WORKSHOP_SELECTION_MOVE_STATES.CANCELLED ||
          state === WORKSHOP_SELECTION_MOVE_STATES.INACTIVE) {
        return result(true, "IDEMPOTENT", getSnapshot());
      }
      invalidate();
      candidate = null;
      state = WORKSHOP_SELECTION_MOVE_STATES.CANCELLED;
      return result(true, "CANCELLED", getSnapshot());
    },
    reset() {
      invalidate();
      state = WORKSHOP_SELECTION_MOVE_STATES.INACTIVE;
      selection = Object.freeze([]);
      candidate = null;
      anchorOffset = Object.freeze({ x: 0, z: 0 });
      return result(true, "RESET", getSnapshot());
    },
    getSnapshot,
  });
}
