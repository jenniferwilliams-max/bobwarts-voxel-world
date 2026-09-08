import {
  PROJECTOR_SHUTDOWN_TIMING,
  calculateProjectorPowerDownPresentation,
} from "./projector-lifecycle-safety.mjs";

export const PROJECTOR_POWER_ON_ASSETS = Object.freeze({
  lens: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-lens-587x587.png",
  lowerBars: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-lower-bars-587x587.png",
  lowerStatusDots: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-lower-status-dots-587x587.png",
  upperOuterBars: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-upper-outer-bars-587x587.png",
  upperInnerBars: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-upper-inner-bars-587x587.png",
  topRingPair: "assets/images/workshop/runtime/derivatives/projector/projector-powering-on-top-ring-pair-587x587.png",
});

export const PROJECTOR_POWER_ON_TIMING = Object.freeze({
  hold: 200,
  duration: 300,
  reducedDuration: 120,
  easing: Object.freeze([0.16, 1, 0.30, 1]),
  layers: Object.freeze({
    lens: Object.freeze({ start: 0, end: 300, opacity: 0.85 }),
    lowerBars: Object.freeze({ start: 0, end: 120, opacity: 1 }),
    lowerStatusDots: Object.freeze({ start: 40, end: 160, opacity: 1 }),
    upperOuterBars: Object.freeze({ start: 80, end: 200, opacity: 1 }),
    upperInnerBars: Object.freeze({ start: 120, end: 240, opacity: 1 }),
    topRingPair: Object.freeze({ start: 160, end: 280, opacity: 1 }),
  }),
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

export function powerUpEasing(progress) {
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

export function calculateProjectorPowerPresentation(elapsed, { reducedMotion = false } = {}) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  const duration = reducedMotion
    ? PROJECTOR_POWER_ON_TIMING.reducedDuration
    : PROJECTOR_POWER_ON_TIMING.duration;
  const values = {};
  Object.entries(PROJECTOR_POWER_ON_TIMING.layers).forEach(([name, layer]) => {
    const start = reducedMotion ? 0 : layer.start;
    const end = reducedMotion ? duration : layer.end;
    const localProgress = end === start ? 1 : clamp01((elapsed - start) / (end - start));
    values[name] = powerUpEasing(localProgress) * layer.opacity;
  });
  return Object.freeze({
    ...values,
    progress: clamp01(elapsed / duration),
    complete: elapsed >= duration,
  });
}

const requireMethod = (value, method, label) => {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(`${label} must provide ${method}().`);
  }
};

export function mountProjectorPowerOnView({
  document,
  mount,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
} = {}) {
  requireMethod(document, "createElement", "document");
  requireMethod(mount, "appendChild", "mount");
  if (typeof requestAnimationFrame !== "function") {
    throw new TypeError("requestAnimationFrame must be available.");
  }
  if (typeof reducedMotion !== "function") {
    throw new TypeError("reducedMotion must be a function.");
  }

  const elements = {};
  const readiness = [];
  Object.entries(PROJECTOR_POWER_ON_ASSETS).forEach(([name, assetPath]) => {
    const image = document.createElement("img");
    image.className = `workshop-projector-power-layer workshop-projector-power-${name}`;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("data-projector-power-layer", name);
    image.decoding = "async";
    image.draggable = false;
    image.style.opacity = "0";
    readiness.push(new Promise((resolve, reject) => {
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => {
        reject(new Error(`Projector power layer failed to load: ${assetPath}`));
      }, { once: true });
    }));
    image.src = assetPath;
    mount.appendChild(image);
    elements[name] = image;
  });

  let state = "POWERED_OFF";
  let values = calculateProjectorPowerPresentation(0);
  let activeToken = 0;
  let transitionActive = false;

  const apply = (presentation) => {
    values = presentation;
    Object.keys(elements).forEach((name) => {
      elements[name].style.opacity = String(presentation[name]);
    });
    mount.dataset.projectorPowerState = state;
  };

  const clear = () => {
    const zero = Object.fromEntries(Object.keys(elements).map((name) => [name, 0]));
    values = Object.freeze({ ...zero, progress: 0, complete: true });
    Object.keys(elements).forEach((name) => { elements[name].style.opacity = "0"; });
    state = "POWERED_OFF";
    transitionActive = false;
    mount.dataset.projectorPowerState = state;
  };
  clear();

  const start = ({ transitionId, begin = () => true, complete = () => true } = {}) => {
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      throw new TypeError("transitionId must be a non-empty string.");
    }
    if (state !== "POWERED_OFF" || transitionActive) {
      return Object.freeze({ ok: true, code: "IDEMPOTENT" });
    }
    transitionActive = true;
    const token = ++activeToken;
    const isReduced = reducedMotion();
    const duration = isReduced
      ? PROJECTOR_POWER_ON_TIMING.reducedDuration
      : PROJECTOR_POWER_ON_TIMING.duration;
    let firstTimestamp = null;
    let begun = false;
    let completionClaimed = false;

    const frame = (timestamp) => {
      if (token !== activeToken) return;
      if (firstTimestamp === null) firstTimestamp = timestamp;
      const elapsed = timestamp - firstTimestamp;
      if (elapsed < PROJECTOR_POWER_ON_TIMING.hold) {
        requestAnimationFrame(frame);
        return;
      }
      if (!begun) {
        begun = true;
        if (begin() === false || token !== activeToken) return;
        state = "POWERING_ON";
      }
      const presentation = calculateProjectorPowerPresentation(
        Math.min(duration, elapsed - PROJECTOR_POWER_ON_TIMING.hold),
        { reducedMotion: isReduced },
      );
      apply(presentation);
      if (!presentation.complete) {
        requestAnimationFrame(frame);
        return;
      }
      if (completionClaimed || token !== activeToken) return;
      completionClaimed = true;
      state = "POWERED_ON";
      transitionActive = false;
      mount.dataset.projectorPowerState = state;
      complete();
    };
    requestAnimationFrame(frame);
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const cancel = ({ complete = () => {} } = {}) => {
    const token = ++activeToken;
    const initial = Object.fromEntries(Object.keys(elements).map((name) => [name, values[name] || 0]));
    const maximum = Math.max(0, ...Object.values(initial));
    if (maximum === 0) {
      clear();
      complete();
      return Object.freeze({ ok: true, code: "ALREADY_OFF" });
    }
    const isReduced = reducedMotion();
    const duration = (isReduced ? PROJECTOR_POWER_ON_TIMING.reducedDuration : PROJECTOR_POWER_ON_TIMING.duration) * maximum;
    let firstTimestamp = null;
    const frame = (timestamp) => {
      if (token !== activeToken) return;
      if (firstTimestamp === null) firstTimestamp = timestamp;
      const progress = duration === 0 ? 1 : clamp01((timestamp - firstTimestamp) / duration);
      const remaining = 1 - powerUpEasing(progress);
      const presentation = Object.fromEntries(
        Object.keys(elements).map((name) => [name, initial[name] * remaining]),
      );
      apply(Object.freeze({ ...presentation, progress: maximum * remaining, complete: progress >= 1 }));
      if (progress < 1) requestAnimationFrame(frame);
      else {
        clear();
        complete();
      }
    };
    requestAnimationFrame(frame);
    return Object.freeze({ ok: true, code: "REVERSING" });
  };

  const powerDown = ({ transitionId, tableProjectionVisible = true, complete = () => true } = {}) => {
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      throw new TypeError("transitionId must be a non-empty string.");
    }
    if (tableProjectionVisible !== false) {
      return Object.freeze({ ok: false, code: "TABLE_FIELD_VISIBLE" });
    }
    const token = ++activeToken;
    transitionActive = true;
    const initial = Object.fromEntries(Object.keys(elements).map((name) => [name, values[name] || 0]));
    const maximumRatio = Math.max(0, ...Object.entries(initial).map(([name, value]) => (
      value / PROJECTOR_POWER_ON_TIMING.layers[name].opacity
    )));
    if (maximumRatio === 0) {
      clear();
      complete();
      return Object.freeze({ ok: true, code: "ALREADY_OFF", transitionId });
    }
    const isReduced = reducedMotion();
    const fullDuration = isReduced
      ? PROJECTOR_SHUTDOWN_TIMING.reducedDuration
      : PROJECTOR_SHUTDOWN_TIMING.duration;
    const duration = fullDuration * Math.min(1, maximumRatio);
    let firstTimestamp = null;
    let completionClaimed = false;
    state = "POWERED_ON";
    mount.dataset.projectorPowerTransition = "POWERING_OFF";

    const frame = (timestamp) => {
      if (token !== activeToken) return;
      if (firstTimestamp === null) firstTimestamp = timestamp;
      const scaledElapsed = duration === 0
        ? fullDuration
        : Math.min(fullDuration, ((timestamp - firstTimestamp) / duration) * fullDuration);
      const presentation = calculateProjectorPowerDownPresentation(
        scaledElapsed,
        initial,
        { reducedMotion: isReduced },
      );
      apply(presentation);
      if (!presentation.complete) {
        requestAnimationFrame(frame);
        return;
      }
      if (completionClaimed || token !== activeToken) return;
      completionClaimed = true;
      delete mount.dataset.projectorPowerTransition;
      clear();
      complete();
    };
    requestAnimationFrame(frame);
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const restorePoweredOn = ({ transitionId, complete = () => true } = {}) => {
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      throw new TypeError("transitionId must be a non-empty string.");
    }
    const token = ++activeToken;
    transitionActive = true;
    const initial = Object.fromEntries(Object.keys(elements).map((name) => [name, values[name] || 0]));
    const targets = Object.fromEntries(Object.entries(PROJECTOR_POWER_ON_TIMING.layers).map(
      ([name, layer]) => [name, layer.opacity],
    ));
    const maximumDistance = Math.max(0, ...Object.keys(elements).map((name) => (
      Math.abs(targets[name] - initial[name]) / targets[name]
    )));
    if (maximumDistance === 0) {
      state = "POWERED_ON";
      transitionActive = false;
      delete mount.dataset.projectorPowerTransition;
      mount.dataset.projectorPowerState = state;
      complete();
      return Object.freeze({ ok: true, code: "ALREADY_ON", transitionId });
    }
    const isReduced = reducedMotion();
    const duration = (isReduced
      ? PROJECTOR_POWER_ON_TIMING.reducedDuration
      : PROJECTOR_POWER_ON_TIMING.duration) * maximumDistance;
    let firstTimestamp = null;
    let completionClaimed = false;
    state = "POWERING_ON";
    mount.dataset.projectorPowerTransition = "POWERING_ON";
    const frame = (timestamp) => {
      if (token !== activeToken) return;
      if (firstTimestamp === null) firstTimestamp = timestamp;
      const progress = duration === 0 ? 1 : clamp01((timestamp - firstTimestamp) / duration);
      const eased = powerUpEasing(progress);
      const presentation = Object.fromEntries(Object.keys(elements).map((name) => [
        name,
        initial[name] + ((targets[name] - initial[name]) * eased),
      ]));
      apply(Object.freeze({ ...presentation, progress, complete: progress >= 1 }));
      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }
      if (completionClaimed || token !== activeToken) return;
      completionClaimed = true;
      state = "POWERED_ON";
      transitionActive = false;
      delete mount.dataset.projectorPowerTransition;
      mount.dataset.projectorPowerState = state;
      complete();
    };
    requestAnimationFrame(frame);
    return Object.freeze({ ok: true, code: "REVERSING", transitionId });
  };

  const enterFaultSafe = ({ transitionId, complete = () => true } = {}) => {
    activeToken += 1;
    const zero = Object.fromEntries(Object.keys(elements).map((name) => [name, 0]));
    values = Object.freeze({ ...zero, progress: 0, complete: true });
    Object.keys(elements).forEach((name) => { elements[name].style.opacity = "0"; });
    state = "FAULT_SAFE";
    transitionActive = false;
    delete mount.dataset.projectorPowerTransition;
    mount.dataset.projectorPowerState = state;
    complete();
    return Object.freeze({ ok: true, code: "FAULT_SAFE", transitionId });
  };

  return Object.freeze({
    elements: Object.freeze({ ...elements }),
    ready: Promise.all(readiness),
    start,
    cancel,
    powerDown,
    restorePoweredOn,
    enterFaultSafe,
    reset: clear,
    getSnapshot: () => Object.freeze({ state, values }),
  });
}
