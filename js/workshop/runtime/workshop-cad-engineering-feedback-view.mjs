const finite = (value) => Number.isFinite(value);

export const WORKSHOP_CAD_ORIGIN_MARKER = Object.freeze({
  innerRadius: 0.18,
  outerRadius: 0.27,
  segments: 32,
  elevation: -0.4765,
  color: 0xbff8ff,
  opacity: 0.78,
});

export function normalizeWorkshopEngineeringFeedback(input = {}) {
  const boundary = input.boundary;
  if (input.active !== true || !boundary ||
      ![boundary.xMin, boundary.xMax, boundary.zMin, boundary.zMax].every(finite) ||
      boundary.xMax <= boundary.xMin || boundary.zMax <= boundary.zMin) return null;
  const unit = input.unit === "mm" ? "mm" : "cm";
  const width = boundary.xMax - boundary.xMin;
  const depth = boundary.zMax - boundary.zMin;
  const workspace = `Workspace: ${width} × ${depth} cm`;
  const precision = unit === "mm"
    ? "Precision: 1 mm • Standard blocks: 1 cm"
    : "Precision: 1 cm • Snap: 1 cm";
  return Object.freeze({
    active: true,
    unit,
    width,
    depth,
    text: `${workspace} • ${precision}`,
  });
}

export function createWorkshopCadEngineeringFeedbackView({
  statusElement,
  announcementElement,
  originMarker,
} = {}) {
  let signature = "";
  let snapshot = null;
  let announcementSignature = "";

  function clear() {
    signature = "";
    snapshot = null;
    announcementSignature = "";
    if (statusElement) statusElement.textContent = "";
    if (announcementElement) announcementElement.textContent = "";
    if (originMarker) originMarker.visible = false;
  }

  return Object.freeze({
    update(input = {}) {
      const next = normalizeWorkshopEngineeringFeedback(input);
      if (!next) {
        clear();
        return null;
      }
      const nextSignature = [next.unit, next.width, next.depth].join(":");
      if (nextSignature !== signature) {
        signature = nextSignature;
        snapshot = next;
        if (statusElement) statusElement.textContent = next.text;
      }
      if (originMarker) originMarker.visible = input.gridVisible !== false;
      if (input.announce === true && nextSignature !== announcementSignature) {
        announcementSignature = nextSignature;
        if (announcementElement) announcementElement.textContent = next.text;
      }
      return snapshot;
    },
    reset() {
      clear();
    },
    read() {
      return snapshot;
    },
  });
}
