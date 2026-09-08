export const SMART_BOARD_APPLICATIONS = Object.freeze({
  none: "none",
  measurementAssistant: "measurement-assistant",
});

const freezeResult = (value) => Object.freeze(value);

export function createSmartBoardApplicationView({
  screen,
  isTransitionCurrent = () => true,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
} = {}) {
  if (!screen?.dataset) throw new TypeError("Smart Board application screen is required.");

  let serial = 0;
  let active = null;
  let disposed = false;
  const completedRequests = new Set();
  const requestKey = (transitionId, application) => `${transitionId}:${application}`;

  const cancelActive = () => {
    if (!active) return false;
    active.cancelled = true;
    active.frames.forEach(cancelFrame);
    active.frames.length = 0;
    active = null;
    return true;
  };

  const settle = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.completed ||
        !isTransitionCurrent(entry.transitionId) ||
        screen.dataset.boardApplication !== entry.application) return false;
    entry.completed = true;
    completedRequests.add(requestKey(entry.transitionId, entry.application));
    entry.frames.forEach(cancelFrame);
    entry.frames.length = 0;
    active = null;
    return entry.complete();
  };

  const request = ({ transitionId, application, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (!Object.values(SMART_BOARD_APPLICATIONS).includes(application)) {
      return freezeResult({ ok: false, code: "INVALID_APPLICATION" });
    }
    if (active?.transitionId === transitionId && active.application === application) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (completedRequests.has(requestKey(transitionId, application))) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }
    if (!active && screen.dataset.boardApplication === application) {
      completedRequests.add(requestKey(transitionId, application));
      complete();
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }

    const replacing = active !== null;
    cancelActive();
    const entry = {
      token: ++serial,
      transitionId,
      application,
      complete,
      cancelled: false,
      completed: false,
      frames: [],
    };
    active = entry;
    screen.dataset.boardApplication = application;
    const first = requestFrame(() => {
      if (active !== entry || entry.cancelled) return;
      const second = requestFrame(() => settle(entry));
      entry.frames.push(second);
    });
    entry.frames.push(first);
    return freezeResult({
      ok: true,
      code: replacing ? "REPLACING" : "ACCEPTED",
      transitionId,
      token: entry.token,
    });
  };

  return Object.freeze({
    activate({ transitionId, complete } = {}) {
      return request({
        transitionId,
        application: SMART_BOARD_APPLICATIONS.measurementAssistant,
        complete,
      });
    },
    clear({ transitionId, complete } = {}) {
      return request({
        transitionId,
        application: SMART_BOARD_APPLICATIONS.none,
        complete,
      });
    },
    cancel() {
      return freezeResult({ ok: true, code: cancelActive() ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        application: screen.dataset.boardApplication,
        transitionId: active?.transitionId || null,
        pendingApplication: active?.application || null,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive();
    },
  });
}
