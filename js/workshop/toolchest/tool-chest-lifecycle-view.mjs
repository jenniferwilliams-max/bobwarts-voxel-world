export const TOOL_CHEST_LIFECYCLE = Object.freeze({
  property: "transform",
  deployedState: "expanded",
  parkedState: "retracted",
  normalDuration: 280,
  reducedDuration: 1,
});

const freezeResult = (value) => Object.freeze(value);

export function createToolChestLifecycleView({
  root,
  cabinet,
  setCabinetState,
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  isAtEndpoint = (targetState) => {
    const style = globalThis.getComputedStyle?.(cabinet);
    const transform = style?.transform || "none";
    const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+)/);
    const translateX = transform === "none" ? 0 : Number(match?.[1]);
    if (!Number.isFinite(translateX)) return false;
    if (targetState === TOOL_CHEST_LIFECYCLE.deployedState) return Math.abs(translateX) <= 1;
    const width = cabinet.getBoundingClientRect?.().width;
    return Number.isFinite(width) && Math.abs(translateX - Math.max(0, width - 10)) <= 1.5;
  },
  schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
  cancelSchedule = (handle) => globalThis.clearTimeout(handle),
} = {}) {
  if (!root?.dataset || typeof root.addEventListener !== "function" ||
      typeof root.removeEventListener !== "function") {
    throw new TypeError("Tool Chest root with event support is required.");
  }
  if (!cabinet) throw new TypeError("Tool Chest cabinet is required.");
  if (typeof setCabinetState !== "function") {
    throw new TypeError("setCabinetState must be a function.");
  }

  let serial = 0;
  let active = null;
  let disposed = false;

  const clearFallback = (entry) => {
    if (entry?.fallback !== null) cancelSchedule(entry.fallback);
    if (entry) entry.fallback = null;
  };

  const cancelActive = () => {
    if (!active) return false;
    active.cancelled = true;
    clearFallback(active);
    active = null;
    return true;
  };

  const settle = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.completed) return false;
    if (root.dataset.cabinetState !== entry.targetState || !isAtEndpoint(entry.targetState)) return false;
    entry.completed = true;
    clearFallback(entry);
    active = null;
    return entry.complete();
  };

  const onTransitionEnd = (event) => {
    if (!active || event.target !== cabinet || event.propertyName !== TOOL_CHEST_LIFECYCLE.property) return;
    settle(active);
  };
  root.addEventListener("transitionend", onTransitionEnd);

  const move = (targetState, { transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (active?.transitionId === transitionId && active.targetState === targetState) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (!active && root.dataset.cabinetState === targetState && isAtEndpoint(targetState)) {
      complete();
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }

    const reversing = active !== null;
    cancelActive();
    const entry = {
      token: ++serial,
      transitionId,
      targetState,
      complete,
      completed: false,
      cancelled: false,
      fallback: null,
    };
    active = entry;
    setCabinetState(targetState);

    // transitionend owns normal settlement. The bounded fallback exists only
    // for reduced-motion/zero-distance browsers that omit transition events,
    // and still verifies the rendered state before completing.
    const duration = reducedMotion()
      ? TOOL_CHEST_LIFECYCLE.reducedDuration
      : TOOL_CHEST_LIFECYCLE.normalDuration;
    entry.fallback = schedule(() => settle(entry), duration + 50);
    return freezeResult({
      ok: true,
      code: reversing ? "REVERSING" : "ACCEPTED",
      transitionId,
      token: entry.token,
      duration,
    });
  };

  return Object.freeze({
    deploy(options) { return move(TOOL_CHEST_LIFECYCLE.deployedState, options); },
    park(options) { return move(TOOL_CHEST_LIFECYCLE.parkedState, options); },
    cancel() {
      return freezeResult({ ok: true, code: cancelActive() ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        state: root.dataset.cabinetState || TOOL_CHEST_LIFECYCLE.parkedState,
        activeTarget: active?.targetState || null,
        transitionId: active?.transitionId || null,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive();
      root.removeEventListener("transitionend", onTransitionEnd);
    },
  });
}
