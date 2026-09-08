export const PROJECTOR_SHUTDOWN_TIMING = Object.freeze({
  duration: 300,
  reducedDuration: 150,
  easing: Object.freeze([0.70, 0, 0.84, 0]),
  maximumAudioVisualSkew: 80,
});

export const PROJECTOR_AUDIO_TOKENS = Object.freeze({
  relayOn: "relay-on",
  projectorRise: "projector-rise",
  projectionLock: "projection-lock",
  projectorFall: "projector-fall",
  relayOff: "relay-off",
});

const AUDIO_TOKEN_SET = new Set(Object.values(PROJECTOR_AUDIO_TOKENS));
const clamp01 = (value) => Math.max(0, Math.min(1, value));

function cubicBezierCoordinate(t, a, b) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
}

function cubicBezierSlope(t, a, b) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * a + 6 * inverse * t * (b - a) + 3 * t * t * (1 - b);
}

export function powerDownEasing(progress) {
  const x = clamp01(progress);
  let t = x;
  for (let index = 0; index < 8; index += 1) {
    const error = cubicBezierCoordinate(t, 0.70, 0.84) - x;
    const slope = cubicBezierSlope(t, 0.70, 0.84);
    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) break;
    t = clamp01(t - error / slope);
  }
  return cubicBezierCoordinate(t, 0, 0);
}

export function calculateProjectorPowerDownPresentation(
  elapsed,
  initialValues,
  { reducedMotion = false } = {},
) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("elapsed must be a finite nonnegative number.");
  }
  if (!initialValues || typeof initialValues !== "object") {
    throw new TypeError("initialValues must be an object.");
  }
  const duration = reducedMotion
    ? PROJECTOR_SHUTDOWN_TIMING.reducedDuration
    : PROJECTOR_SHUTDOWN_TIMING.duration;
  const progress = clamp01(elapsed / duration);
  const remaining = 1 - powerDownEasing(progress);
  const values = Object.fromEntries(Object.entries(initialValues).map(([name, value]) => [
    name,
    Math.max(0, Number(value) || 0) * remaining,
  ]));
  return Object.freeze({ ...values, progress, complete: elapsed >= duration });
}

export function createProjectorAudioHooks({
  play,
  isMuted = () => false,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  if (typeof isMuted !== "function") throw new TypeError("isMuted must be a function.");
  if (typeof now !== "function") throw new TypeError("now must be a function.");

  const trigger = (token, { visualTimestamp = now() } = {}) => {
    if (!AUDIO_TOKEN_SET.has(token)) {
      return Object.freeze({ ok: false, code: "UNKNOWN_AUDIO_TOKEN", token });
    }
    if (isMuted()) return Object.freeze({ ok: true, code: "MUTED", token });
    if (typeof play !== "function") return Object.freeze({ ok: true, code: "UNAVAILABLE", token });
    try {
      const audioTimestamp = now();
      const result = play(token);
      return Object.freeze({
        ok: true,
        code: "TRIGGERED",
        token,
        skew: Math.abs(audioTimestamp - visualTimestamp),
        result,
      });
    } catch (error) {
      return Object.freeze({ ok: true, code: "UNAVAILABLE", token, reason: error.message });
    }
  };
  return Object.freeze({ trigger });
}

const once = (callback = () => true) => {
  let claimed = false;
  return (...args) => {
    if (claimed) return false;
    claimed = true;
    return callback(...args);
  };
};

export function createProjectorLifecycleSafety({
  powerView,
  opticalView,
  stopTableField,
  audio = createProjectorAudioHooks(),
  reportStatus = () => {},
} = {}) {
  if (!powerView || typeof powerView.powerDown !== "function") {
    throw new TypeError("powerView must provide powerDown().");
  }
  if (!opticalView || typeof opticalView.cancelToStandby !== "function") {
    throw new TypeError("opticalView must provide cancelToStandby().");
  }
  if (typeof stopTableField !== "function") {
    throw new TypeError("stopTableField must be a function.");
  }

  let activeToken = 0;
  const current = (token) => token === activeToken;

  const shutdown = ({ transitionId, standby, poweredOff, complete } = {}) => {
    const token = ++activeToken;
    const claimStandby = once(standby);
    const claimPoweredOff = once(poweredOff);
    const claimComplete = once(complete);
    audio.trigger(PROJECTOR_AUDIO_TOKENS.projectorFall);
    opticalView.cancelToStandby({
      transitionId,
      complete: () => {
        if (!current(token)) return;
        stopTableField({
          transitionId,
          complete: () => {
            if (!current(token) || claimStandby() === false) return;
            audio.trigger(PROJECTOR_AUDIO_TOKENS.relayOff);
            powerView.powerDown({
              transitionId,
              tableProjectionVisible: false,
              complete: () => {
                if (!current(token) || claimPoweredOff() === false) return;
                claimComplete();
              },
            });
          },
        });
      },
    });
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const restore = ({ transitionId, complete } = {}) => {
    const token = ++activeToken;
    const claimComplete = once(complete);
    opticalView.cancelToStandby({
      transitionId,
      complete: () => {
        if (!current(token)) return;
        powerView.restorePoweredOn({
          transitionId,
          complete: () => current(token) && claimComplete(),
        });
      },
    });
    return Object.freeze({ ok: true, code: "REVERSING", transitionId });
  };

  const lowerToStandby = ({ transitionId, complete } = {}) => {
    const token = ++activeToken;
    const claimComplete = once(complete);
    opticalView.cancelToStandby({
      transitionId,
      complete: () => current(token) && claimComplete(),
    });
    return Object.freeze({ ok: true, code: "STANDBY", transitionId });
  };

  const fault = ({ transitionId, code = "PROJECTOR_ASSET_UNAVAILABLE", message, complete } = {}) => {
    const token = ++activeToken;
    const claimComplete = once(complete);
    const settleFault = once(() => {
      if (!current(token)) return false;
      reportStatus({ code, message: message || "Projector unavailable. Workshop entered safe mode." });
      return claimComplete();
    });
    opticalView.cancelToStandby({
      transitionId,
      complete: () => {
        if (!current(token)) return;
        stopTableField({
          transitionId,
          complete: () => {
            if (!current(token)) return;
            powerView.enterFaultSafe({
              transitionId,
              complete: settleFault,
            });
          },
        });
      },
    });
    return Object.freeze({ ok: true, code: "FAULT_SAFE", transitionId });
  };

  return Object.freeze({
    shutdown,
    restore,
    lowerToStandby,
    fault,
    playAudio: (token, options) => audio.trigger(token, options),
    cancel: () => { activeToken += 1; },
  });
}
