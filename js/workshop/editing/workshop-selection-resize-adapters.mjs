export const WORKSHOP_SELECTION_RESIZE_FAMILIES = Object.freeze({
  BRIDGE_BEAM:"BRIDGE_BEAM",
  SUPPORT_COLUMN:"SUPPORT_COLUMN",
});

const STANDARD_MINIMUM_DIMENSIONS = Object.freeze({
  width:1,
  height:1,
  depth:1,
});
const BRIDGE_BEAM_MINIMUM_DIMENSIONS = Object.freeze({
  width:1,
  height:0.5,
  depth:1,
});
const trustedFamilies = new WeakMap();

const frozenAdapter = (family, minimumDimensions) => Object.freeze({
  family,
  minimumDimensions,
});

const STANDARD_BLOCK_ADAPTER = frozenAdapter(
  "STANDARD_BLOCK",
  STANDARD_MINIMUM_DIMENSIONS
);
const SUPPORT_COLUMN_ADAPTER = frozenAdapter(
  WORKSHOP_SELECTION_RESIZE_FAMILIES.SUPPORT_COLUMN,
  STANDARD_MINIMUM_DIMENSIONS
);
const BRIDGE_BEAM_ADAPTER = frozenAdapter(
  WORKSHOP_SELECTION_RESIZE_FAMILIES.BRIDGE_BEAM,
  BRIDGE_BEAM_MINIMUM_DIMENSIONS
);

export function registerWorkshopSelectionResizeFamily(object, family) {
  if (!object || (typeof object !== "object" && typeof object !== "function") ||
      !Object.values(WORKSHOP_SELECTION_RESIZE_FAMILIES).includes(family)) {
    return false;
  }
  trustedFamilies.set(object, family);
  return true;
}

export function getWorkshopSelectionResizeAdapter(object, {
  standardBlock = false,
} = {}) {
  if (!object || (typeof object !== "object" && typeof object !== "function")) {
    return null;
  }
  if (standardBlock) return STANDARD_BLOCK_ADAPTER;
  const family = trustedFamilies.get(object);
  if (family === WORKSHOP_SELECTION_RESIZE_FAMILIES.SUPPORT_COLUMN) {
    return SUPPORT_COLUMN_ADAPTER;
  }
  if (family === WORKSHOP_SELECTION_RESIZE_FAMILIES.BRIDGE_BEAM) {
    return BRIDGE_BEAM_ADAPTER;
  }
  return null;
}
