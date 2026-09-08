export const WORKSHOP_READY_RENDER_SETTLEMENT = Object.freeze({
  requiredStableFrames: 2,
});

const freezeResult = (value) => Object.freeze(value);

export function createWorkshopReadyRenderSettlement({
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
  isRenderedReady,
  isTransitionCurrent = () => true,
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
} = {}) {
  if (typeof requestFrame !== "function" || typeof cancelFrame !== "function") {
    throw new TypeError("Workshop render-frame scheduling is required.");
  }
  if (typeof isRenderedReady !== "function") {
    throw new TypeError("isRenderedReady must be a function.");
  }
  if (typeof isTransitionCurrent !== "function") {
    throw new TypeError("isTransitionCurrent must be a function.");
  }

  let serial = 0;
  let active = null;
  let disposed = false;
  const settledTransitions = new Set();

  const cancelActive = () => {
    if (!active) return false;
    active.cancelled = true;
    if (active.frame !== null) cancelFrame(active.frame);
    active.frame = null;
    active = null;
    return true;
  };

  const scheduleFrame = (entry) => {
    entry.frame = requestFrame(() => {
      entry.frame = null;
      if (disposed || active !== entry || entry.cancelled || entry.completed) return false;
      if (!isTransitionCurrent(entry.transitionId)) {
        entry.cancelled = true;
        active = null;
        return false;
      }
      if (!isRenderedReady()) {
        entry.stableFrames = 0;
        scheduleFrame(entry);
        return false;
      }
      entry.stableFrames += 1;
      if (entry.stableFrames < WORKSHOP_READY_RENDER_SETTLEMENT.requiredStableFrames) {
        scheduleFrame(entry);
        return false;
      }
      entry.completed = true;
      settledTransitions.add(entry.transitionId);
      active = null;
      return entry.complete();
    });
  };

  const settle = ({ transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (active?.transitionId === transitionId) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (settledTransitions.has(transitionId)) {
      return freezeResult({ ok: true, code: "ALREADY_SETTLED", transitionId });
    }

    cancelActive();
    const entry = {
      token: ++serial,
      transitionId,
      complete,
      stableFrames: 0,
      frame: null,
      cancelled: false,
      completed: false,
      reducedMotion: reducedMotion() === true,
    };
    active = entry;
    scheduleFrame(entry);
    return freezeResult({
      ok: true,
      code: "ACCEPTED",
      transitionId,
      token: entry.token,
      requiredStableFrames: WORKSHOP_READY_RENDER_SETTLEMENT.requiredStableFrames,
      reducedMotion: entry.reducedMotion,
    });
  };

  return Object.freeze({
    settle,
    cancel() {
      return freezeResult({ ok: true, code: cancelActive() ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        transitionId: active?.transitionId || null,
        stableFrames: active?.stableFrames || 0,
        reducedMotion: active?.reducedMotion || false,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive();
    },
  });
}
