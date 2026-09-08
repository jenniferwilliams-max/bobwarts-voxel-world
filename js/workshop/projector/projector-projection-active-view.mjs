export const PROJECTOR_PROJECTION_TRACE_ASSET =
  "assets/images/workshop/runtime/derivatives/projector/projector-projection-trace-v3-587x587.png";

export const PROJECTOR_PROJECTION_TIMING = Object.freeze({
  startingDuration: 500,
  activeSettleDuration: 300,
  reducedStartingDuration: 150,
  reducedActiveSettleDuration: 120,
  activeBaseOpacity: 0.40,
  activeVariation: 0.02,
  activePeriod: 6000,
  poweredStandbyLensOpacity: 0.85,
  startingTraceOpacity: 0.45,
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function cubicBezierCoordinate(t, a, b) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
}

function cubicBezierSlope(t, a, b) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * a + 6 * inverse * t * (b - a) + 3 * t * t * (1 - b);
}

function cubicBezierY(progress, x1, y1, x2, y2) {
  const x = clamp01(progress);
  let t = x;
  for (let index = 0; index < 8; index += 1) {
    const error = cubicBezierCoordinate(t, x1, x2) - x;
    const slope = cubicBezierSlope(t, x1, x2);
    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) break;
    t = clamp01(t - error / slope);
  }
  return clamp01(cubicBezierCoordinate(t, y1, y2));
}

export function projectionSettleEasing(progress) {
  return cubicBezierY(progress, 0.34, 1.56, 0.64, 1);
}

export function powerUpEasing(progress) {
  return cubicBezierY(progress, 0.16, 1, 0.30, 1);
}

export function calculateProjectionStartingPresentation(elapsed, { reducedMotion = false } = {}) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  const duration = reducedMotion
    ? PROJECTOR_PROJECTION_TIMING.reducedStartingDuration
    : PROJECTOR_PROJECTION_TIMING.startingDuration;
  const progress = clamp01(elapsed / duration);
  const eased = reducedMotion ? progress : projectionSettleEasing(progress);
  return Object.freeze({
    lens: PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity +
      (1 - PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity) * eased,
    trace: PROJECTOR_PROJECTION_TIMING.startingTraceOpacity * eased,
    progress,
    complete: elapsed >= duration,
  });
}

export function calculateProjectionActivePresentation(elapsed, { reducedMotion = false } = {}) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  const duration = reducedMotion
    ? PROJECTOR_PROJECTION_TIMING.reducedActiveSettleDuration
    : PROJECTOR_PROJECTION_TIMING.activeSettleDuration;
  const progress = clamp01(elapsed / duration);
  const eased = powerUpEasing(progress);
  const start = PROJECTOR_PROJECTION_TIMING.startingTraceOpacity;
  const end = PROJECTOR_PROJECTION_TIMING.activeBaseOpacity;
  return Object.freeze({
    lens: 1,
    trace: start + (end - start) * eased,
    progress,
    complete: elapsed >= duration,
  });
}

export function calculateActiveTraceOpacity(elapsed) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  const timing = PROJECTOR_PROJECTION_TIMING;
  return timing.activeBaseOpacity * (
    1 + timing.activeVariation * Math.sin(2 * Math.PI * elapsed / timing.activePeriod)
  );
}

const requireMethod = (value, method, label) => {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(`${label} must provide ${method}().`);
  }
};

export function mountProjectorProjectionActiveView({
  document,
  mount,
  lensElement,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  now = () => globalThis.performance?.now() ?? Date.now(),
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
} = {}) {
  requireMethod(document, "createElement", "document");
  requireMethod(document, "addEventListener", "document");
  requireMethod(document, "removeEventListener", "document");
  requireMethod(mount, "appendChild", "mount");
  if (!lensElement || !lensElement.style) {
    throw new TypeError("lensElement with a style object is required.");
  }
  if (typeof requestAnimationFrame !== "function") {
    throw new TypeError("requestAnimationFrame must be available.");
  }
  if (typeof now !== "function" || typeof reducedMotion !== "function") {
    throw new TypeError("now and reducedMotion must be functions.");
  }

  const trace = document.createElement("img");
  trace.className = "workshop-projector-power-layer workshop-projector-projection-trace";
  trace.alt = "";
  trace.setAttribute("aria-hidden", "true");
  trace.setAttribute("data-projector-projection-layer", "directional-trace");
  trace.decoding = "async";
  trace.draggable = false;
  trace.style.opacity = "0";
  trace.src = PROJECTOR_PROJECTION_TRACE_ASSET;
  mount.appendChild(trace);

  const ready = new Promise((resolve, reject) => {
    trace.addEventListener("load", () => resolve(trace), { once: true });
    trace.addEventListener("error", () => {
      reject(new Error(`Projector projection trace failed to load: ${PROJECTOR_PROJECTION_TRACE_ASSET}`));
    }, { once: true });
  });

  let state = "POWERED_ON";
  let values = Object.freeze({
    lens: PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity,
    trace: 0,
    progress: 0,
    complete: true,
  });
  let activeToken = 0;
  let transitionActive = false;
  let animation = null;
  let modulationStartedAt = null;

  const apply = (presentation) => {
    values = presentation;
    lensElement.style.opacity = String(presentation.lens);
    trace.style.opacity = String(presentation.trace);
    mount.dataset.projectorProjectionState = state;
  };

  const setStandby = () => {
    state = "POWERED_ON";
    transitionActive = false;
    animation = null;
    modulationStartedAt = null;
    apply(Object.freeze({
      lens: PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity,
      trace: 0,
      progress: 0,
      complete: true,
    }));
  };
  setStandby();

  const scheduleAnimation = ({ duration, presentation, finish }) => {
    const token = ++activeToken;
    transitionActive = true;
    animation = {
      token,
      duration,
      presentation,
      finish,
      startedAt: null,
      pausedAt: null,
    };
    const frame = (timestamp) => {
      if (!animation || animation.token !== token || token !== activeToken) return;
      if (document.hidden) {
        if (animation.pausedAt === null) animation.pausedAt = now();
        return;
      }
      if (animation.startedAt === null) animation.startedAt = timestamp;
      const elapsed = Math.max(0, timestamp - animation.startedAt);
      const next = presentation(Math.min(duration, elapsed));
      apply(next);
      if (!next.complete) requestAnimationFrame(frame);
      else {
        animation = null;
        transitionActive = false;
        finish();
      }
    };
    animation.frame = frame;
    requestAnimationFrame(frame);
  };

  const startModulation = () => {
    if (state !== "FULLY_ACTIVE" || reducedMotion() || document.hidden) {
      modulationStartedAt = null;
      return;
    }
    const token = activeToken;
    modulationStartedAt = null;
    const frame = (timestamp) => {
      if (token !== activeToken || state !== "FULLY_ACTIVE" || reducedMotion() || document.hidden) return;
      if (modulationStartedAt === null) modulationStartedAt = timestamp;
      apply(Object.freeze({
        lens: 1,
        trace: calculateActiveTraceOpacity(timestamp - modulationStartedAt),
        progress: 1,
        complete: true,
      }));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  const start = ({ transitionId, begin = () => true, complete = () => true } = {}) => {
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      throw new TypeError("transitionId must be a non-empty string.");
    }
    if (state !== "POWERED_ON" || transitionActive) {
      return Object.freeze({ ok: true, code: "IDEMPOTENT" });
    }
    if (begin() === false) return Object.freeze({ ok: false, code: "BEGIN_REJECTED" });
    state = "PROJECTION_STARTING";
    mount.dataset.projectorProjectionState = state;
    const isReduced = reducedMotion();
    scheduleAnimation({
      duration: isReduced
        ? PROJECTOR_PROJECTION_TIMING.reducedStartingDuration
        : PROJECTOR_PROJECTION_TIMING.startingDuration,
      presentation: (elapsed) => calculateProjectionStartingPresentation(elapsed, { reducedMotion: isReduced }),
      finish: complete,
    });
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const settleActive = ({ transitionId, complete = () => true } = {}) => {
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      throw new TypeError("transitionId must be a non-empty string.");
    }
    if (state === "FULLY_ACTIVE" && !transitionActive) {
      return Object.freeze({ ok: true, code: "IDEMPOTENT" });
    }
    if (state !== "PROJECTION_STARTING" || transitionActive) {
      return Object.freeze({ ok: false, code: "PROJECTION_START_NOT_SETTLED" });
    }
    const isReduced = reducedMotion();
    scheduleAnimation({
      duration: isReduced
        ? PROJECTOR_PROJECTION_TIMING.reducedActiveSettleDuration
        : PROJECTOR_PROJECTION_TIMING.activeSettleDuration,
      presentation: (elapsed) => calculateProjectionActivePresentation(elapsed, { reducedMotion: isReduced }),
      finish: () => {
        state = "FULLY_ACTIVE";
        mount.dataset.projectorProjectionState = state;
        complete();
        startModulation();
      },
    });
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const cancelToStandby = ({ complete = () => {} } = {}) => {
    ++activeToken;
    animation = null;
    modulationStartedAt = null;
    const initial = { lens: values.lens, trace: values.trace };
    const traceDistance = initial.trace / PROJECTOR_PROJECTION_TIMING.startingTraceOpacity;
    const lensDistance = Math.abs(initial.lens - PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity) / 0.15;
    const distance = clamp01(Math.max(traceDistance, lensDistance));
    if (distance === 0) {
      setStandby();
      complete();
      return Object.freeze({ ok: true, code: "ALREADY_STANDBY" });
    }
    const duration = (reducedMotion()
      ? PROJECTOR_PROJECTION_TIMING.reducedActiveSettleDuration
      : PROJECTOR_PROJECTION_TIMING.activeSettleDuration) * distance;
    state = "PROJECTION_STARTING";
    scheduleAnimation({
      duration,
      presentation: (elapsed) => {
        const progress = duration === 0 ? 1 : clamp01(elapsed / duration);
        const eased = powerUpEasing(progress);
        return Object.freeze({
          lens: initial.lens +
            (PROJECTOR_PROJECTION_TIMING.poweredStandbyLensOpacity - initial.lens) * eased,
          trace: initial.trace * (1 - eased),
          progress: 1 - progress,
          complete: elapsed >= duration,
        });
      },
      finish: () => {
        setStandby();
        complete();
      },
    });
    return Object.freeze({ ok: true, code: "REVERSING" });
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (animation && animation.pausedAt === null) animation.pausedAt = now();
      if (state === "FULLY_ACTIVE") {
        ++activeToken;
        modulationStartedAt = null;
        apply(Object.freeze({ lens: 1, trace: PROJECTOR_PROJECTION_TIMING.activeBaseOpacity, progress: 1, complete: true }));
      }
      return;
    }
    if (animation && animation.pausedAt !== null) {
      const pausedDuration = Math.max(0, now() - animation.pausedAt);
      if (animation.startedAt !== null) animation.startedAt += pausedDuration;
      animation.pausedAt = null;
      requestAnimationFrame(animation.frame);
    } else if (state === "FULLY_ACTIVE") {
      apply(Object.freeze({ lens: 1, trace: PROJECTOR_PROJECTION_TIMING.activeBaseOpacity, progress: 1, complete: true }));
      startModulation();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return Object.freeze({
    trace,
    ready,
    start,
    settleActive,
    cancelToStandby,
    reset() {
      ++activeToken;
      setStandby();
    },
    destroy() {
      ++activeToken;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setStandby();
    },
    getSnapshot: () => Object.freeze({ state, values, transitionActive }),
  });
}
