export const SMART_BOARD_LIFECYCLE = Object.freeze({
  mechanicalProperty: "transform",
  screenProperty: "opacity",
  mechanicalDuration: 320,
  screenDuration: 80,
  reducedDuration: 1,
  retractedState: "retracted",
  extendingState: "extending",
  extendedState: "extended",
  retractingState: "retracting",
  poweredOffState: "powered-off",
  poweringOnState: "powering-on",
  readyState: "ready",
  poweringOffState: "powering-off",
});

const freezeResult = (value) => Object.freeze(value);

export function createSmartBoardLifecycleView({
  root,
  cabinet,
  screen,
  setMechanicalState,
  setPowerState,
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  isAtMechanicalEndpoint = (targetState) => {
    const style = globalThis.getComputedStyle?.(cabinet);
    const transform = style?.transform || "none";
    const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+)/);
    const translateX = transform === "none" ? 0 : Number(match?.[1]);
    if (!Number.isFinite(translateX)) return false;
    if (targetState === SMART_BOARD_LIFECYCLE.extendedState) return Math.abs(translateX) <= 1;
    const expected = Number.parseFloat(
      globalThis.getComputedStyle?.(root).getPropertyValue("--smart-board-retracted-x"),
    );
    return Number.isFinite(expected) && Math.abs(translateX - expected) <= 1.5;
  },
  isAtPowerEndpoint = (targetState) => {
    const opacity = Number.parseFloat(globalThis.getComputedStyle?.(screen).opacity);
    if (!Number.isFinite(opacity)) return false;
    return targetState === SMART_BOARD_LIFECYCLE.readyState
      ? opacity >= 0.99
      : opacity <= 0.01;
  },
  schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
  cancelSchedule = (handle) => globalThis.clearTimeout(handle),
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
} = {}) {
  if (!root?.dataset || typeof root.addEventListener !== "function" ||
      typeof root.removeEventListener !== "function") {
    throw new TypeError("Smart Board root with event support is required.");
  }
  if (!cabinet || !screen) throw new TypeError("Smart Board cabinet and screen are required.");
  if (typeof setMechanicalState !== "function" || typeof setPowerState !== "function") {
    throw new TypeError("Smart Board state setters are required.");
  }

  let serial = 0;
  let active = null;
  let disposed = false;

  const clearPending = (entry) => {
    if (!entry) return;
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = null;
    entry.frames.forEach(cancelFrame);
    entry.frames.length = 0;
  };

  const cancelActive = () => {
    if (!active) return false;
    active.cancelled = true;
    clearPending(active);
    active = null;
    return true;
  };

  const currentDuration = (normalDuration) => reducedMotion()
    ? SMART_BOARD_LIFECYCLE.reducedDuration
    : normalDuration;

  const scheduleVerifiedFallback = (entry, duration, settle) => {
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = schedule(() => {
      entry.fallback = null;
      settle(entry);
    }, duration + 50);
  };

  const settleReady = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.completed ||
        entry.mode !== "activate" || entry.phase !== "ready") return false;
    if (root.dataset.boardMechanical !== SMART_BOARD_LIFECYCLE.extendedState ||
        root.dataset.boardPower !== SMART_BOARD_LIFECYCLE.readyState ||
        !isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.extendedState) ||
        !isAtPowerEndpoint(SMART_BOARD_LIFECYCLE.readyState)) return false;
    entry.completed = true;
    clearPending(entry);
    active = null;
    return entry.complete();
  };

  const beginReadySettlement = (entry) => {
    if (active !== entry || entry.cancelled) return false;
    setPowerState(SMART_BOARD_LIFECYCLE.readyState);
    entry.phase = "ready";
    const first = requestFrame(() => {
      if (active !== entry || entry.cancelled) return;
      const second = requestFrame(() => settleReady(entry));
      entry.frames.push(second);
    });
    entry.frames.push(first);
    return true;
  };

  const settlePowerOn = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.mode !== "activate" ||
        entry.phase !== "powering-on" || !isAtPowerEndpoint(SMART_BOARD_LIFECYCLE.readyState)) return false;
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = null;
    if (!entry.poweredOnClaimed) {
      entry.poweredOnClaimed = true;
      if (entry.poweredOn() === false) return false;
    }
    return beginReadySettlement(entry);
  };

  const beginPowerOn = (entry) => {
    if (active !== entry || entry.cancelled) return false;
    entry.phase = "powering-on";
    setPowerState(SMART_BOARD_LIFECYCLE.poweringOnState);
    const duration = currentDuration(SMART_BOARD_LIFECYCLE.screenDuration);
    scheduleVerifiedFallback(entry, duration, settlePowerOn);
    return true;
  };

  const settleExtended = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.mode !== "activate" ||
        entry.phase !== "extending" || !isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.extendedState)) return false;
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = null;
    setMechanicalState(SMART_BOARD_LIFECYCLE.extendedState);
    if (!entry.extendedClaimed) {
      entry.extendedClaimed = true;
      if (entry.extended() === false) return false;
    }
    return beginPowerOn(entry);
  };

  const settleRetracted = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.mode !== "retract" ||
        entry.phase !== "retracting" || !isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.retractedState)) return false;
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = null;
    setMechanicalState(SMART_BOARD_LIFECYCLE.retractedState);
    entry.completed = true;
    active = null;
    return entry.complete();
  };

  const beginRetraction = (entry) => {
    if (active !== entry || entry.cancelled) return false;
    entry.phase = "retracting";
    setMechanicalState(SMART_BOARD_LIFECYCLE.retractingState);
    const duration = currentDuration(SMART_BOARD_LIFECYCLE.mechanicalDuration);
    scheduleVerifiedFallback(entry, duration, settleRetracted);
    return true;
  };

  const settlePowerOff = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.mode !== "retract" ||
        entry.phase !== "powering-off" || !isAtPowerEndpoint(SMART_BOARD_LIFECYCLE.poweredOffState)) return false;
    if (entry.fallback !== null) cancelSchedule(entry.fallback);
    entry.fallback = null;
    setPowerState(SMART_BOARD_LIFECYCLE.poweredOffState);
    if (!entry.poweredOffClaimed) {
      entry.poweredOffClaimed = true;
      if (entry.poweredOff() === false) return false;
    }
    return beginRetraction(entry);
  };

  const onTransitionEnd = (event) => {
    if (!active) return;
    if (event.target === cabinet && event.propertyName === SMART_BOARD_LIFECYCLE.mechanicalProperty) {
      if (active.mode === "activate") settleExtended(active);
      else settleRetracted(active);
      return;
    }
    if (event.target === screen && event.propertyName === SMART_BOARD_LIFECYCLE.screenProperty) {
      if (active.mode === "activate") settlePowerOn(active);
      else settlePowerOff(active);
    }
  };
  root.addEventListener("transitionend", onTransitionEnd);

  const createEntry = (mode, transitionId, callbacks) => ({
    token: ++serial,
    mode,
    transitionId,
    phase: null,
    cancelled: false,
    completed: false,
    extendedClaimed: false,
    poweredOnClaimed: false,
    poweredOffClaimed: false,
    fallback: null,
    frames: [],
    ...callbacks,
  });

  const activate = ({ transitionId, extended = () => true, poweredOn = () => true, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (active?.transitionId === transitionId && active.mode === "activate") {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (!active && root.dataset.boardMechanical === SMART_BOARD_LIFECYCLE.extendedState &&
        root.dataset.boardPower === SMART_BOARD_LIFECYCLE.readyState &&
        isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.extendedState) &&
        isAtPowerEndpoint(SMART_BOARD_LIFECYCLE.readyState)) {
      if (extended() !== false && poweredOn() !== false) complete();
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    const reversing = active !== null;
    cancelActive();
    const entry = createEntry("activate", transitionId, { extended, poweredOn, complete });
    active = entry;

    if (root.dataset.boardMechanical === SMART_BOARD_LIFECYCLE.extendedState &&
        isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.extendedState)) {
      entry.phase = "extending";
      settleExtended(entry);
    } else {
      entry.phase = "extending";
      setMechanicalState(SMART_BOARD_LIFECYCLE.extendingState);
      const duration = currentDuration(SMART_BOARD_LIFECYCLE.mechanicalDuration);
      scheduleVerifiedFallback(entry, duration, settleExtended);
    }
    return freezeResult({
      ok: true,
      code: reversing ? "REVERSING" : "ACCEPTED",
      transitionId,
      token: entry.token,
    });
  };

  const retract = ({ transitionId, poweredOff = () => true, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (active?.transitionId === transitionId && active.mode === "retract") {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (!active && root.dataset.boardMechanical === SMART_BOARD_LIFECYCLE.retractedState &&
        root.dataset.boardPower === SMART_BOARD_LIFECYCLE.poweredOffState &&
        isAtMechanicalEndpoint(SMART_BOARD_LIFECYCLE.retractedState) &&
        isAtPowerEndpoint(SMART_BOARD_LIFECYCLE.poweredOffState)) {
      if (poweredOff() !== false) complete();
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    const reversing = active !== null;
    cancelActive();
    const entry = createEntry("retract", transitionId, { poweredOff, complete });
    active = entry;
    entry.phase = "powering-off";
    setPowerState(SMART_BOARD_LIFECYCLE.poweringOffState);
    const duration = currentDuration(SMART_BOARD_LIFECYCLE.screenDuration);
    scheduleVerifiedFallback(entry, duration, settlePowerOff);
    return freezeResult({
      ok: true,
      code: reversing ? "REVERSING" : "ACCEPTED",
      transitionId,
      token: entry.token,
    });
  };

  return Object.freeze({
    activate,
    retract,
    cancel() {
      return freezeResult({ ok: true, code: cancelActive() ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        mechanical: root.dataset.boardMechanical,
        power: root.dataset.boardPower,
        activeMode: active?.mode || null,
        activePhase: active?.phase || null,
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
