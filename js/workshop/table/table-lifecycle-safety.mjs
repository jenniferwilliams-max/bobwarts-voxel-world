const once = (callback = () => true) => {
  let claimed = false;
  return (...args) => {
    if (claimed) return false;
    claimed = true;
    return callback(...args);
  };
};

export function createTableLifecycleSafety({ activeView, fieldView, powerView } = {}) {
  if (!activeView || typeof activeView.stopProjectionGrid !== "function") {
    throw new TypeError("activeView must provide stopProjectionGrid().");
  }
  if (!fieldView || typeof fieldView.stopToPoweredOn !== "function") {
    throw new TypeError("fieldView must provide stopToPoweredOn().");
  }
  if (!powerView || typeof powerView.powerOff !== "function") {
    throw new TypeError("powerView must provide powerOff().");
  }

  let token = 0;
  let activeShutdown = null;

  const current = (value) => value === token;
  const cancelViews = () => {
    activeView.cancel?.();
    fieldView.cancel?.();
    powerView.cancel?.();
  };

  const shutdown = ({ transitionId, projectionStopped, poweredOff, complete } = {}) => {
    if (activeShutdown) {
      return Object.freeze({ ok: true, code: "IDEMPOTENT", transitionId: activeShutdown.transitionId });
    }
    const currentToken = ++token;
    const claimProjectionStopped = once(projectionStopped);
    const claimPoweredOff = once(poweredOff);
    const claimComplete = once(complete);
    const record = { transitionId, token: currentToken, gridStopped: false, fieldStopped: false };
    activeShutdown = record;

    const finishProjection = () => {
      if (!current(currentToken) || activeShutdown !== record ||
          !record.gridStopped || !record.fieldStopped) return false;
      if (claimProjectionStopped() === false) return false;
      powerView.powerOff({
        transitionId,
        complete: () => {
          if (!current(currentToken) || activeShutdown !== record) return false;
          claimPoweredOff();
          activeShutdown = null;
          return claimComplete();
        },
      });
      return true;
    };

    const fieldResult = fieldView.stopToPoweredOn({
      transitionId,
      complete: () => {
        if (!current(currentToken) || activeShutdown !== record) return false;
        record.fieldStopped = true;
        return finishProjection();
      },
    });
    const fieldDuration = Number.isFinite(fieldResult?.duration)
      ? Math.max(0, fieldResult.duration)
      : null;
    // A full normal shutdown finishes the grid 100 ms before the field.
    // Short/reduced transitions finish together so the lead can never exceed
    // the Animation Bible limit during partial or reversed shutdown.
    const gridDuration = fieldDuration === null
      ? undefined
      : fieldDuration > 150 ? fieldDuration - 100 : fieldDuration;
    activeView.stopProjectionGrid({
      transitionId,
      durationOverride: gridDuration,
      complete: () => {
        if (!current(currentToken) || activeShutdown !== record) return false;
        record.gridStopped = true;
        return finishProjection();
      },
    });
    return Object.freeze({ ok: true, code: "ACCEPTED", transitionId });
  };

  const cancel = () => {
    token += 1;
    activeShutdown = null;
    cancelViews();
    return Object.freeze({ ok: true, code: "CANCELLED" });
  };

  return Object.freeze({
    shutdown,
    cancel,
    get active() { return activeShutdown !== null; },
  });
}
