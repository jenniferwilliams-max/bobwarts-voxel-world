import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH,
  WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH,
  calculateWorkshopReadableFallbackFrame,
  createWorkshopUnifiedWorkstationView,
} from "../../js/workshop/runtime/workshop-unified-workstation-view.mjs";

const VIEWPORTS = Object.freeze([
  Object.freeze({
    id: "mac-1440x900",
    stable: { left: 372, top: 251, width: 707, height: 463 },
    protectedZone: { left: 384, top: 263, width: 683, height: 439 },
  }),
  Object.freeze({
    id: "chromebook-1366x768",
    stable: { left: 354, top: 247, width: 664, height: 340 },
    protectedZone: { left: 366, top: 259, width: 640, height: 316 },
  }),
  Object.freeze({
    id: "narrow-chromebook-1024x600",
    stable: { left: 220, top: 130, width: 580, height: 350 },
    protectedZone: { left: 232, top: 142, width: 556, height: 326 },
  }),
]);

function element() {
  const values = {};
  return {
    dataset: {},
    style: new Proxy({
      removeProperty(property) { delete values[property]; },
    }, {
      set(target, property, value) {
        if (property === "removeProperty") return false;
        values[property.replace(/[A-Z]/g,
          (match) => `-${match.toLowerCase()}`)] = value;
        return true;
      },
      get(target, property) {
        if (property === "removeProperty") return target.removeProperty;
        return values[property] || values[property.replace(/[A-Z]/g,
          (match) => `-${match.toLowerCase()}`)];
      },
    }),
  };
}

function number(value) {
  return Number.parseFloat(value);
}

test("edge-on fallback remains readable and protected at classroom viewports", () => {
  VIEWPORTS.forEach(({ id, stable, protectedZone }) => {
    const snapshot = {
      blocked: false,
      stableHomeScreenBounds: stable,
      protectedBuildZone: { ...protectedZone, inset: 12, blocked: false },
      edgePresentationUsable: false,
      orderedTabletopEdges: [],
    };
    const frame = calculateWorkshopReadableFallbackFrame(snapshot);
    assert.ok(frame, id);
    assert.ok(frame.horizontalLength >=
      WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH, id);
    assert.ok(frame.verticalLength >=
      WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH, id);

    const rulers = {
      top: element(), right: element(), bottom: element(), left: element(),
    };
    const view = createWorkshopUnifiedWorkstationView({
      rulers,
      isWorldRegistrationValid: () => true,
    });
    assert.equal(view.update(snapshot).mode, "fallback", id);
    assert.equal(number(rulers.top.style.width), frame.horizontalLength, id);
    assert.equal(number(rulers.bottom.style.width), frame.horizontalLength, id);
    assert.equal(number(rulers.left.style.height), frame.verticalLength, id);
    assert.equal(number(rulers.right.style.height), frame.verticalLength, id);
    assert.ok(number(rulers.top.style.left) >= protectedZone.left, id);
    assert.ok(number(rulers.top.style.top) >= protectedZone.top, id);
    assert.ok(number(rulers.top.style.left) + number(rulers.top.style.width) <=
      protectedZone.left + protectedZone.width, id);
    assert.ok(number(rulers.bottom.style.top) + number(rulers.bottom.style.height) <=
      protectedZone.top + protectedZone.height, id);
    assert.ok(number(rulers.right.style.left) + number(rulers.right.style.width) <=
      protectedZone.left + protectedZone.width, id);
    assert.ok(number(rulers.left.style.top) + number(rulers.left.style.height) <=
      protectedZone.top + protectedZone.height, id);
    Object.values(rulers).forEach((ruler) => {
      assert.equal(ruler.style.transform, "none", id);
    });
  });
});

test("readable fallback does not replace the projected-edge presentation", () => {
  const rulers = {
    top: element(), right: element(), bottom: element(), left: element(),
  };
  const view = createWorkshopUnifiedWorkstationView({
    rulers,
    isWorldRegistrationValid: () => true,
  });
  const edge = (id, start, end) => ({
    id,
    start,
    end,
    length: Math.hypot(end.x - start.x, end.y - start.y),
    angleDegrees: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI,
    usable: true,
  });
  const snapshot = {
    blocked: false,
    stableHomeScreenBounds: { left: 100, top: 80, width: 800, height: 440 },
    protectedBuildZone: {
      left: 80, top: 60, width: 840, height: 480, inset: 12, blocked: false,
    },
    edgePresentationUsable: true,
    orderedTabletopEdges: [
      edge("top", { x: 100, y: 100 }, { x: 900, y: 100 }),
      edge("right", { x: 900, y: 100 }, { x: 900, y: 500 }),
      edge("bottom", { x: 100, y: 500 }, { x: 900, y: 500 }),
      edge("left", { x: 100, y: 100 }, { x: 100, y: 500 }),
    ],
  };
  assert.equal(view.update(snapshot).mode, "edges");
  Object.entries(rulers).forEach(([id, ruler]) => {
    assert.equal(ruler.dataset.workstationEdgeRegistered, id);
    assert.equal(ruler.dataset.workstationReadableFallback, undefined);
  });
});
