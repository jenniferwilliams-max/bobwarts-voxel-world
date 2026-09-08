const EDGE_IDS = Object.freeze(["top", "right", "bottom", "left"]);
const INLINE_PROPERTIES = Object.freeze([
  "position", "left", "top", "right", "bottom", "width", "height",
  "transform", "transform-origin", "margin", "grid-area",
]);

export const WORKSHOP_RULER_MAXIMUM_READABLE_TILT_DEGREES = 18;
export const WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH = 320;
export const WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH = 240;

const HORIZONTAL_RULER_THICKNESS = 20;
const VERTICAL_RULER_THICKNESS = 24;

const finite = (value) => Number.isFinite(value);

function bounds(value) {
  if (!value || !finite(value.left) || !finite(value.top)) return null;
  const width = finite(value.width)
    ? value.width
    : finite(value.right) ? value.right - value.left : NaN;
  const height = finite(value.height)
    ? value.height
    : finite(value.bottom) ? value.bottom - value.top : NaN;
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) return null;
  return Object.freeze({
    left: value.left,
    top: value.top,
    right: value.left + width,
    bottom: value.top + height,
    width,
    height,
  });
}

export function calculateWorkshopReadableFallbackFrame(snapshot) {
  const stable = bounds(snapshot?.stableHomeScreenBounds);
  const protectedZone = bounds(snapshot?.protectedBuildZone);
  if (!stable || !protectedZone || snapshot?.protectedBuildZone?.blocked === true) {
    return null;
  }
  const left = Math.max(stable.left - VERTICAL_RULER_THICKNESS,
    protectedZone.left);
  const top = Math.max(stable.top - HORIZONTAL_RULER_THICKNESS,
    protectedZone.top);
  const right = Math.min(stable.right + VERTICAL_RULER_THICKNESS,
    protectedZone.right);
  const bottom = Math.min(stable.bottom + HORIZONTAL_RULER_THICKNESS,
    protectedZone.bottom);
  const horizontalLength = right - left;
  const verticalLength = bottom - top - HORIZONTAL_RULER_THICKNESS * 2;
  if (horizontalLength < WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH ||
      verticalLength < WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH) {
    return null;
  }
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    width: horizontalLength,
    height: bottom - top,
    horizontalLength,
    verticalLength,
  });
}

function normalizeRotation(degrees) {
  let normalized = degrees % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

function readableEdge(edge, vertical) {
  let start = edge.start;
  let end = edge.end;
  if ((vertical && end.y < start.y) || (!vertical && end.x < start.x)) {
    start = edge.end;
    end = edge.start;
  }
  const angleDegrees = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  const rotationDegrees = normalizeRotation(angleDegrees - (vertical ? 90 : 0));
  return Object.freeze({
    start,
    end,
    angleDegrees,
    rotationDegrees,
    readable: Math.abs(rotationDegrees) <= WORKSHOP_RULER_MAXIMUM_READABLE_TILT_DEGREES,
  });
}

export function createWorkshopUnifiedWorkstationView({
  rulers,
  isWorldRegistrationValid,
} = {}) {
  if (!rulers || typeof rulers !== "object" ||
      EDGE_IDS.some((id) => !rulers[id]?.style) ||
      typeof isWorldRegistrationValid !== "function") {
    throw new TypeError("Four ruler elements and a world-registration validator are required.");
  }
  let mode = "fallback";
  let signature = "";

  function clearRuler(ruler) {
    INLINE_PROPERTIES.forEach((property) => ruler.style.removeProperty(property));
    delete ruler.dataset.workstationEdgeRegistered;
    delete ruler.dataset.workstationReadableFallback;
  }

  function fallback(snapshot) {
    const frame = calculateWorkshopReadableFallbackFrame(snapshot);
    const nextSignature = frame
      ? ["fallback", frame.left, frame.top, frame.width, frame.height]
        .join(":")
      : "fallback:blocked";
    if (mode === "fallback" && signature === nextSignature) return false;
    EDGE_IDS.forEach((id) => clearRuler(rulers[id]));
    if (frame) {
      EDGE_IDS.forEach((id) => {
        const ruler = rulers[id];
        const vertical = id === "left" || id === "right";
        ruler.style.position = "fixed";
        ruler.style.right = "auto";
        ruler.style.bottom = "auto";
        ruler.style.margin = "0";
        ruler.style.gridArea = "auto";
        ruler.style.transform = "none";
        if (vertical) {
          ruler.style.left = `${id === "left"
            ? frame.left
            : frame.right - VERTICAL_RULER_THICKNESS}px`;
          ruler.style.top = `${frame.top + HORIZONTAL_RULER_THICKNESS}px`;
          ruler.style.width = `${VERTICAL_RULER_THICKNESS}px`;
          ruler.style.height = `${frame.verticalLength}px`;
          ruler.style.transformOrigin = "center";
        } else {
          ruler.style.left = `${frame.left}px`;
          ruler.style.top = `${id === "top"
            ? frame.top
            : frame.bottom - HORIZONTAL_RULER_THICKNESS}px`;
          ruler.style.width = `${frame.horizontalLength}px`;
          ruler.style.height = `${HORIZONTAL_RULER_THICKNESS}px`;
          ruler.style.transformOrigin = "center";
        }
        ruler.dataset.workstationReadableFallback = id;
      });
    }
    mode = "fallback";
    signature = nextSignature;
    return true;
  }

  function update(snapshot) {
    if (!isWorldRegistrationValid() || !snapshot || snapshot.blocked) {
      const changed = fallback();
      return Object.freeze({ mode, changed });
    }
    if (snapshot.edgePresentationUsable !== true ||
        !Array.isArray(snapshot.orderedTabletopEdges)) {
      const changed = fallback(snapshot);
      return Object.freeze({ mode, changed });
    }
    const edgeMap = new Map(
      snapshot.orderedTabletopEdges.map((edge) => [edge.id, edge]),
    );
    const presentationEdges = new Map();
    if (EDGE_IDS.some((id) => {
      const edge = edgeMap.get(id);
      const vertical = id === "left" || id === "right";
      if (!edge || !edge.usable || !finite(edge.start?.x) ||
        !finite(edge.start?.y) || !finite(edge.length) ||
        !finite(edge.angleDegrees)) return true;
      const presentation = readableEdge(edge, vertical);
      presentationEdges.set(id, presentation);
      return !presentation.readable;
    })) {
      const changed = fallback(snapshot);
      return Object.freeze({ mode, changed });
    }
    const nextSignature = EDGE_IDS.map((id) => {
      const edge = edgeMap.get(id);
      const presentation = presentationEdges.get(id);
      return [id, presentation.start.x, presentation.start.y,
        edge.length, presentation.rotationDegrees]
        .map((value) => typeof value === "number" ? value.toFixed(3) : value)
        .join(":");
    }).join("|");
    if (mode === "edges" && signature === nextSignature) {
      return Object.freeze({ mode, changed: false });
    }
    EDGE_IDS.forEach((id) => {
      const ruler = rulers[id];
      const edge = edgeMap.get(id);
      const presentation = presentationEdges.get(id);
      const vertical = id === "left" || id === "right";
      ruler.style.position = "fixed";
      ruler.style.right = "auto";
      ruler.style.bottom = "auto";
      ruler.style.margin = "0";
      ruler.style.gridArea = "auto";
      if (vertical) {
        ruler.style.left = `${presentation.start.x - 12}px`;
        ruler.style.top = `${presentation.start.y}px`;
        ruler.style.width = "24px";
        ruler.style.height = `${edge.length}px`;
        ruler.style.transformOrigin = "12px 0";
        ruler.style.transform = `rotate(${presentation.rotationDegrees}deg)`;
      } else {
        ruler.style.left = `${presentation.start.x}px`;
        ruler.style.top = `${presentation.start.y - 10}px`;
        ruler.style.width = `${edge.length}px`;
        ruler.style.height = "20px";
        ruler.style.transformOrigin = "0 10px";
        ruler.style.transform = `rotate(${presentation.rotationDegrees}deg)`;
      }
      ruler.dataset.workstationEdgeRegistered = id;
    });
    mode = "edges";
    signature = nextSignature;
    return Object.freeze({ mode, changed: true });
  }

  return Object.freeze({
    update,
    reset() {
      const changed = fallback();
      return Object.freeze({ mode, changed });
    },
    getSnapshot() {
      return Object.freeze({ mode, signature });
    },
  });
}
