export const TABLE_POWER_TIMING = Object.freeze({
  duration: 400,
  shutdownDuration: 350,
  reducedDuration: 150,
  endpointOpacity: 0.75,
  easing: Object.freeze([0.16, 1, 0.30, 1]),
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

export function tablePowerUpEasing(progress) {
  const x = clamp01(progress);
  let t = x;
  for (let index = 0; index < 8; index += 1) {
    const error = cubicBezierCoordinate(t, 0.16, 0.30) - x;
    const slope = cubicBezierSlope(t, 0.16, 0.30);
    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) break;
    t = clamp01(t - error / slope);
  }
  return cubicBezierCoordinate(t, 1, 1);
}

export function calculateTableEmitterPresentation(
  elapsed,
  { initialOpacity = 0, targetOpacity = TABLE_POWER_TIMING.endpointOpacity, duration = TABLE_POWER_TIMING.duration } = {},
) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  if (![initialOpacity, targetOpacity, duration].every(Number.isFinite) || duration < 0) {
    throw new TypeError("initialOpacity, targetOpacity, and duration must be finite.");
  }
  const progress = duration === 0 ? 1 : clamp01(elapsed / duration);
  const eased = tablePowerUpEasing(progress);
  return Object.freeze({
    opacity: initialOpacity + (targetOpacity - initialOpacity) * eased,
    progress,
    complete: elapsed >= duration,
  });
}

const once = (callback = () => true) => {
  let claimed = false;
  return (...args) => {
    if (claimed) return false;
    claimed = true;
    return callback(...args);
  };
};

export function createTablePowerOnView({
  materials,
  document,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  audio,
} = {}) {
  if (!materials?.rear || !materials?.front) {
    throw new TypeError("rear and front emitter materials are required.");
  }
  if (!document || typeof document.addEventListener !== "function" ||
      typeof document.removeEventListener !== "function") {
    throw new TypeError("document visibility events are required.");
  }
  if (typeof requestAnimationFrame !== "function" || typeof now !== "function") {
    throw new TypeError("animation timing functions are required.");
  }

  let activeToken = 0;
  let frameId = null;
  let animation = null;
  let opacity = 0;
  let state = "POWERED_OFF";
  let disposed = false;

  const apply = (value) => {
    opacity = Math.max(0, Math.min(1, value));
    materials.rear.opacity = opacity;
    materials.front.opacity = opacity;
    materials.rear.visible = opacity > 0;
    materials.front.visible = opacity > 0;
    return opacity;
  };
  apply(0);

  const cancelFrame = () => {
    if (frameId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
    frameId = null;
  };

  const schedule = ({ target, baseDuration, endpointState, complete }) => {
    cancelFrame();
    const token = ++activeToken;
    const claimComplete = once(complete);
    const initial = opacity;
    const distance = Math.abs(target - initial) / TABLE_POWER_TIMING.endpointOpacity;
    const maximumDuration = reducedMotion() ? TABLE_POWER_TIMING.reducedDuration : baseDuration;
    const duration = maximumDuration * distance;
    animation = {
      token,
      initial,
      target,
      duration,
      startedAt: null,
      pausedAt: null,
      endpointState,
      complete: claimComplete,
    };

    const finish = () => {
      if (!animation || animation.token !== token || token !== activeToken) return false;
      apply(target);
      state = endpointState;
      animation = null;
      frameId = null;
      return claimComplete();
    };

    const frame = (timestamp) => {
      frameId = null;
      if (!animation || animation.token !== token || token !== activeToken || disposed) return;
      if (document.hidden || animation.pausedAt !== null) return;
      const currentTime = Number.isFinite(timestamp) ? timestamp : now();
      if (animation.startedAt === null) animation.startedAt = currentTime;
      const elapsed = Math.max(0, currentTime - animation.startedAt);
      const presentation = calculateTableEmitterPresentation(elapsed, {
        initialOpacity: initial,
        targetOpacity: target,
        duration,
      });
      apply(presentation.opacity);
      if (presentation.complete) finish();
      else frameId = requestAnimationFrame(frame);
    };
    animation.frame = frame;

    if (duration === 0) finish();
    else frameId = requestAnimationFrame(frame);
    return Object.freeze({ token, duration });
  };

  const powerOn = ({ begin = () => true, complete = () => {} } = {}) => {
    if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
    const claimBegin = once(begin);
    if (claimBegin() === false) return Object.freeze({ ok: false, code: "BEGIN_REJECTED" });
    state = "POWERING_ON";
    try { audio?.trigger?.("relay-on"); } catch {}
    const scheduled = schedule({
      target: TABLE_POWER_TIMING.endpointOpacity,
      baseDuration: TABLE_POWER_TIMING.duration,
      endpointState: "POWERED_ON",
      complete,
    });
    return Object.freeze({ ok: true, code: opacity > 0 ? "REVERSING" : "ACCEPTED", ...scheduled });
  };

  const powerOff = ({ complete = () => {} } = {}) => {
    if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
    state = "POWERING_OFF";
    const scheduled = schedule({
      target: 0,
      baseDuration: TABLE_POWER_TIMING.shutdownDuration,
      endpointState: "POWERED_OFF",
      complete,
    });
    return Object.freeze({ ok: true, code: opacity < TABLE_POWER_TIMING.endpointOpacity ? "REVERSING" : "ACCEPTED", ...scheduled });
  };

  const enterFaultSafe = ({ complete = () => {} } = {}) => {
    cancelFrame();
    ++activeToken;
    animation = null;
    apply(0);
    state = "FAULT_SAFE";
    once(complete)();
    return Object.freeze({ ok: true, code: "FAULT_SAFE" });
  };

  const handleVisibilityChange = () => {
    if (!animation) return;
    if (document.hidden) {
      if (animation.pausedAt === null) animation.pausedAt = now();
      cancelFrame();
      return;
    }
    if (animation.pausedAt !== null) {
      const pausedDuration = Math.max(0, now() - animation.pausedAt);
      if (animation.startedAt !== null) animation.startedAt += pausedDuration;
      animation.pausedAt = null;
      frameId = requestAnimationFrame(animation.frame);
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return Object.freeze({
    ready: Promise.resolve(),
    powerOn,
    powerOff,
    enterFaultSafe,
    adoptProjectionOpacity(value) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if (!Number.isFinite(value) || value < TABLE_POWER_TIMING.endpointOpacity || value > 1) {
        throw new RangeError("Projection emitter opacity must be between 0.75 and 1.");
      }
      cancelFrame();
      activeToken += 1;
      animation = null;
      state = value > TABLE_POWER_TIMING.endpointOpacity ? "PROJECTION_STARTING" : "POWERED_ON";
      apply(value);
      return Object.freeze({ ok: true, code: "ADOPTED", opacity });
    },
    cancel() {
      cancelFrame();
      activeToken += 1;
      animation = null;
    },
    reset() {
      cancelFrame();
      activeToken += 1;
      animation = null;
      state = "POWERED_OFF";
      return apply(0);
    },
    get state() { return state; },
    get opacity() { return opacity; },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      activeToken += 1;
      animation = null;
      apply(0);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  });
}
