export const WORKSHOP_SHUTDOWN_PLACEHOLDER_TIMING = Object.freeze({});

const freezeResult = (value) => Object.freeze(value);

export function createWorkshopShutdownTestDouble({
} = {}) {
  return Object.freeze({
    cancel() { return freezeResult({ ok: true, code: "IDEMPOTENT" }); },
    getSnapshot() {
      return freezeResult({
        active: null,
        transitionId: null,
        duration: 0,
      });
    },
  });
}
