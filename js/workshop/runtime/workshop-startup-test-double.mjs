export const WORKSHOP_STARTUP_PLACEHOLDER_TIMING = Object.freeze({});

const freezeResult = (value) => Object.freeze(value);

export function createWorkshopStartupTestDouble({
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
