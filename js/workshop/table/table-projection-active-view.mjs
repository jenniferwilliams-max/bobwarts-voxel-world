export const TABLE_PROJECTION_ACTIVE_TIMING = Object.freeze({
  startingDuration: 500,
  duration: 300,
  reducedDuration: 150,
  startingFieldOpacity: 0.62,
  activeFieldOpacity: 0.72,
  startingGridScalar: 0.55,
  activeGridScalar: 0.78,
  heightRatio: 1,
  emitterOpacity: 1,
  shutdownDuration: 400,
  shutdownReducedDuration: 150,
  easing: Object.freeze([0.16, 1, 0.30, 1]),
});

export const TABLE_PROJECTION_ACTIVE_GRID = Object.freeze({
  minorBaseOpacity: 0.18,
  majorBaseOpacity: 0.34,
  minorStartingOpacity: 0.099,
  majorStartingOpacity: 0.187,
  minorActiveOpacity: 0.1404,
  majorActiveOpacity: 0.2652,
  maximumNewMeshes: 0,
  maximumAdditionalRenderCalls: 0,
  continuousAnimationsAfterSettlement: 0,
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);

function bezierCoordinate(t, first, second) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function bezierSlope(t, first, second) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * first + 6 * inverse * t * (second - first) + 3 * t * t * (1 - second);
}

export function tableProjectionPowerUpEasing(progress) {
  const x = clamp01(progress);
  let t = x;
  for (let index = 0; index < 8; index += 1) {
    const error = bezierCoordinate(t, 0.16, 0.30) - x;
    const slope = bezierSlope(t, 0.16, 0.30);
    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) break;
    t = clamp(t - error / slope, 0, 1);
  }
  return clamp01(bezierCoordinate(t, 1, 1));
}

export function calculateTableProjectionActivePresentation(elapsed, {
  duration = TABLE_PROJECTION_ACTIVE_TIMING.duration,
  reducedMotion = false,
  initial = Object.freeze({ fieldOpacity: 0.62, gridScalar: 0.55 }),
  target = Object.freeze({ fieldOpacity: 0.72, gridScalar: 0.78 }),
} = {}) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(duration) || duration < 0) {
    throw new TypeError("elapsed and duration must be finite nonnegative numbers.");
  }
  const progress = duration === 0 ? 1 : clamp01(elapsed / duration);
  const eased = reducedMotion ? progress : tableProjectionPowerUpEasing(progress);
  return Object.freeze({
    fieldOpacity: initial.fieldOpacity + (target.fieldOpacity - initial.fieldOpacity) * eased,
    gridScalar: initial.gridScalar + (target.gridScalar - initial.gridScalar) * eased,
    heightRatio: TABLE_PROJECTION_ACTIVE_TIMING.heightRatio,
    emitterOpacity: TABLE_PROJECTION_ACTIVE_TIMING.emitterOpacity,
    progress,
    complete: progress >= 1,
  });
}

const claimOnce = (callback = () => true) => {
  let claimed = false;
  return () => {
    if (claimed) return false;
    claimed = true;
    return callback();
  };
};

export function createTableProjectionActiveView({
  document,
  getTableVisible,
  applyFieldOpacity,
  applyGridScalar,
  applyGridVisibility,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
} = {}) {
  if (!document || typeof document.addEventListener !== "function" || typeof document.removeEventListener !== "function") {
    throw new TypeError("Document visibility events are required.");
  }
  if ([getTableVisible, applyFieldOpacity, applyGridScalar, applyGridVisibility].some((value) => typeof value !== "function")) {
    throw new TypeError("Table visibility, field, and grid host functions are required.");
  }
  if (typeof requestAnimationFrame !== "function" || typeof cancelAnimationFrame !== "function" || typeof now !== "function") {
    throw new TypeError("Animation timing functions are required.");
  }

  let state = "POWERED_ON";
  let active = false;
  let disposed = false;
  let token = 0;
  let frameId = null;
  let animation = null;
  let presentation = {
    fieldOpacity: TABLE_PROJECTION_ACTIVE_TIMING.startingFieldOpacity,
    gridScalar: 0,
    heightRatio: 1,
    emitterOpacity: 1,
  };

  const syncVisibility = () => {
    const visible = active && !disposed && getTableVisible() === true && presentation.gridScalar > 0;
    applyGridVisibility(visible);
    return visible;
  };

  const apply = (next, { field = true } = {}) => {
    presentation = {
      fieldOpacity: clamp(next.fieldOpacity, 0.62, 0.72),
      gridScalar: clamp(next.gridScalar, 0, 0.78),
      heightRatio: 1,
      emitterOpacity: 1,
    };
    if (field) applyFieldOpacity(presentation.fieldOpacity);
    applyGridScalar(presentation.gridScalar);
    syncVisibility();
    return presentation;
  };

  const cancelFrame = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };

  const schedule = ({ target, duration, endpointState, complete, applyField = true, reduced = reducedMotion() }) => {
    cancelFrame();
    const currentToken = ++token;
    const claim = claimOnce(complete);
    const initial = { ...presentation };
    animation = {
      token: currentToken,
      initial,
      target,
      duration,
      endpointState,
      applyField,
      reduced,
      startedAt: null,
      pausedAt: null,
      claim,
    };
    const finish = () => {
      if (!animation || animation.token !== currentToken || token !== currentToken || disposed) return false;
      apply(target, { field: applyField });
      state = endpointState;
      animation = null;
      frameId = null;
      return claim();
    };
    const frame = (timestamp) => {
      frameId = null;
      if (!animation || animation.token !== currentToken || token !== currentToken || disposed || document.hidden) return;
      const current = Number.isFinite(timestamp) ? timestamp : now();
      if (animation.startedAt === null) animation.startedAt = current;
      const next = calculateTableProjectionActivePresentation(
        Math.max(0, current - animation.startedAt),
        { duration, reducedMotion: reduced, initial, target },
      );
      apply(next, { field: applyField });
      if (next.complete) finish();
      else frameId = requestAnimationFrame(frame);
    };
    animation.frame = frame;
    if (duration === 0) finish();
    else frameId = requestAnimationFrame(frame);
    return Object.freeze({ token: currentToken, duration });
  };

  const handleVisibility = () => {
    syncVisibility();
    if (!animation) return;
    if (document.hidden) {
      if (animation.pausedAt === null) animation.pausedAt = now();
      cancelFrame();
    } else if (animation.pausedAt !== null) {
      if (animation.startedAt !== null) animation.startedAt += Math.max(0, now() - animation.pausedAt);
      animation.pausedAt = null;
      frameId = requestAnimationFrame(animation.frame);
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  return Object.freeze({
    ready: Promise.resolve(),
    startProjectionGrid({ complete = () => true } = {}) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if ((state === "PROJECTION_STARTED" || state === "FULLY_ACTIVE") && !animation &&
          Math.abs(presentation.gridScalar - 0.55) < 1e-9) {
        return Object.freeze({ ok: true, code: "IDEMPOTENT", duration: 0 });
      }
      state = "PROJECTION_STARTING";
      const reduced = reducedMotion();
      const distance = Math.abs(0.55 - presentation.gridScalar) / 0.55;
      const duration = (reduced ? 150 : 500) * clamp01(distance);
      return Object.freeze({ ok: true, code: presentation.gridScalar > 0 ? "REVERSING" : "ACCEPTED", ...schedule({
        target: { ...presentation, fieldOpacity: 0.62, gridScalar: 0.55 },
        duration,
        endpointState: "PROJECTION_STARTED",
        complete,
        applyField: false,
        reduced,
      }) });
    },
    settleActive({ complete = () => true } = {}) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if (state === "FULLY_ACTIVE" && !animation) return Object.freeze({ ok: true, code: "IDEMPOTENT", duration: 0 });
      if (state !== "PROJECTION_STARTED" || animation) {
        return Object.freeze({ ok: false, code: "PROJECTION_START_NOT_SETTLED" });
      }
      state = "SETTLING_ACTIVE";
      const reduced = reducedMotion();
      return Object.freeze({ ok: true, code: "ACCEPTED", ...schedule({
        target: { fieldOpacity: 0.72, gridScalar: 0.78 },
        duration: reduced ? 150 : 300,
        endpointState: "FULLY_ACTIVE",
        complete,
        reduced,
      }) });
    },
    cancelToProjectionStarting({ complete = () => true } = {}) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      const initial = { ...presentation };
      const distance = Math.max(
        Math.abs(initial.fieldOpacity - 0.62) / 0.10,
        Math.abs(initial.gridScalar - 0.55) / 0.23,
      );
      state = "REVERSING";
      const reduced = reducedMotion();
      return Object.freeze({ ok: true, code: distance === 0 ? "ALREADY_STARTING" : "REVERSING", ...schedule({
        target: { fieldOpacity: 0.62, gridScalar: 0.55 },
        duration: (reduced ? 150 : 300) * clamp01(distance),
        endpointState: "PROJECTION_STARTED",
        complete,
        reduced,
      }) });
    },
    stopProjectionGrid({ complete = () => true, durationOverride } = {}) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if (presentation.gridScalar === 0 && !animation) {
        state = "POWERED_ON";
        claimOnce(complete)();
        return Object.freeze({ ok: true, code: "IDEMPOTENT", duration: 0 });
      }
      state = "STOPPING_PROJECTION";
      const reduced = reducedMotion();
      const distance = presentation.gridScalar / TABLE_PROJECTION_ACTIVE_TIMING.activeGridScalar;
      const calculatedDuration = (reduced
        ? TABLE_PROJECTION_ACTIVE_TIMING.shutdownReducedDuration
        : TABLE_PROJECTION_ACTIVE_TIMING.shutdownDuration) * clamp01(distance);
      const duration = Number.isFinite(durationOverride) && durationOverride >= 0
        ? durationOverride
        : calculatedDuration;
      return Object.freeze({ ok: true, code: "ACCEPTED", ...schedule({
        target: { ...presentation, gridScalar: 0 },
        duration,
        endpointState: "POWERED_ON",
        complete,
        applyField: false,
        reduced: true,
      }) });
    },
    enterFaultSafe({ complete = () => true } = {}) {
      cancelFrame();
      ++token;
      animation = null;
      try { applyFieldOpacity(0.62); } catch {}
      applyGridScalar(0);
      presentation = { fieldOpacity: 0.62, gridScalar: 0, heightRatio: 1, emitterOpacity: 1 };
      state = "FAULT_SAFE";
      applyGridVisibility(false);
      claimOnce(complete)();
      return Object.freeze({ ok: true, code: "FAULT_SAFE" });
    },
    setWorkshopActive(value) {
      active = value === true;
      if (!active) {
        cancelFrame();
        ++token;
        animation = null;
        state = "POWERED_ON";
        presentation = { fieldOpacity: 0.62, gridScalar: 0, heightRatio: 1, emitterOpacity: 1 };
        applyGridScalar(0);
      }
      return syncVisibility();
    },
    syncVisibility,
    cancel() { cancelFrame(); ++token; animation = null; },
    get state() { return state; },
    get presentation() { return Object.freeze({ ...presentation }); },
    getSnapshot() {
      return Object.freeze({ state, presentation: Object.freeze({ ...presentation }), transitionActive: animation !== null, visible: syncVisibility() });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      ++token;
      animation = null;
      applyGridVisibility(false);
      document.removeEventListener("visibilitychange", handleVisibility);
      state = "DISPOSED";
    },
  });
}
