export const WORKSHOP_UPGRADE_REGISTRY = Object.freeze([
  Object.freeze({ id: "workshop-upgrade-1", threshold: 50 }),
  Object.freeze({ id: "workshop-upgrade-2", threshold: 100 }),
  Object.freeze({ id: "workshop-upgrade-3", threshold: 150 }),
  Object.freeze({ id: "workshop-upgrade-4", threshold: 200 })
]);

export const WORKSHOP_UPGRADE_THRESHOLDS = Object.freeze(
  WORKSHOP_UPGRADE_REGISTRY.map(entry => entry.threshold)
);

