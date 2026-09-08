import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH,
  WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH,
  WORKSHOP_RULER_MAXIMUM_READABLE_TILT_DEGREES,
  calculateWorkshopReadableFallbackFrame,
  createWorkshopUnifiedWorkstationView,
} from
  "../../js/workshop/runtime/workshop-unified-workstation-view.mjs";

function element() {
  const values = {};
  return {
    dataset: {},
    style: new Proxy({
      removeProperty(property) { delete values[property]; },
    }, {
      set(target, property, value) {
        if (property === "removeProperty") return false;
        values[property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)] = value;
        return true;
      },
      get(target, property) {
        if (property === "removeProperty") return target.removeProperty;
        return values[property] || values[property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)];
      },
    }),
    values,
  };
}

const edge = (id, start, end, angleDegrees) => ({
  id,
  axis: id === "top" || id === "bottom" ? "x" : "z",
  start,
  end,
  length: Math.hypot(end.x - start.x, end.y - start.y),
  angleDegrees,
  usable: true,
});

function snapshot() {
  return {
    blocked: false,
    stableHomeScreenBounds: {
      left: 100, top: 80, right: 900, bottom: 520, width: 800, height: 440,
    },
    protectedBuildZone: {
      left: 80, top: 60, right: 920, bottom: 540,
      width: 840, height: 480, inset: 12, blocked: false,
    },
    edgePresentationUsable: true,
    orderedTabletopEdges: [
      edge("top", { x: 100, y: 100 }, { x: 900, y: 120 }, 1.432),
      edge("right", { x: 880, y: 480 }, { x: 900, y: 120 }, -86.820),
      edge("bottom", { x: 120, y: 500 }, { x: 880, y: 480 }, -1.507),
      edge("left", { x: 120, y: 500 }, { x: 100, y: 100 }, -92.862),
    ],
  };
}

function harness(valid = true) {
  const rulers = {
    top: element(), right: element(), bottom: element(), left: element(),
  };
  return {
    rulers,
    view: createWorkshopUnifiedWorkstationView({
      rulers,
      isWorldRegistrationValid: () => valid,
    }),
  };
}

test("registers existing rulers to the four usable projected edges", () => {
  const { rulers, view } = harness();
  assert.deepEqual(view.update(snapshot()), { mode: "edges", changed: true });
  assert.equal(rulers.top.dataset.workstationEdgeRegistered, "top");
  assert.equal(rulers.top.style.left, "100px");
  assert.equal(rulers.top.style.top, "90px");
  assert.equal(rulers.top.style.transformOrigin, "0 10px");
  assert.equal(rulers.right.dataset.workstationEdgeRegistered, "right");
  assert.equal(rulers.right.style.left, "888px");
  assert.equal(rulers.right.style.top, "120px");
  assert.ok(Math.abs(Number.parseFloat(rulers.right.style.transform.slice(7)) -
    3.179830119864235) < 0.000001);
  assert.equal(rulers.right.style.transformOrigin, "12px 0");
  assert.equal(rulers.left.style.top, "100px");
  assert.ok(Math.abs(
    Math.abs(Number.parseFloat(rulers.left.style.transform.slice(7))) -
      2.8624052261117754
  ) < 0.000001);
});

test("uses the readable rectangular fallback when projected ruler tilt is excessive", () => {
  const { rulers, view } = harness();
  const steep = snapshot();
  steep.orderedTabletopEdges = steep.orderedTabletopEdges.map((item) =>
    item.id === "top"
      ? edge("top", { x: 100, y: 100 }, { x: 900, y: 500 }, 26.565)
      : item);
  assert.equal(WORKSHOP_RULER_MAXIMUM_READABLE_TILT_DEGREES, 18);
  assert.deepEqual(view.update(steep), { mode: "fallback", changed: true });
  Object.entries(rulers).forEach(([id, ruler]) => {
    assert.equal(ruler.dataset.workstationEdgeRegistered, undefined);
    assert.equal(ruler.dataset.workstationReadableFallback, id);
    assert.equal(ruler.style.transform, "none");
  });
  assert.equal(rulers.top.style.width, "840px");
  assert.equal(rulers.left.style.height, "440px");
});

test("calculates a bounded readable fallback frame and rejects undersized geometry", () => {
  assert.equal(WORKSHOP_RULER_FALLBACK_MINIMUM_HORIZONTAL_LENGTH, 320);
  assert.equal(WORKSHOP_RULER_FALLBACK_MINIMUM_VERTICAL_LENGTH, 240);
  assert.deepEqual(calculateWorkshopReadableFallbackFrame(snapshot()), {
    left: 80,
    top: 60,
    right: 920,
    bottom: 540,
    width: 840,
    height: 480,
    horizontalLength: 840,
    verticalLength: 440,
  });
  assert.equal(calculateWorkshopReadableFallbackFrame({
    ...snapshot(),
    protectedBuildZone: {
      left: 100, top: 100, width: 319, height: 280, inset: 12, blocked: false,
    },
  }), null);
  assert.equal(calculateWorkshopReadableFallbackFrame({
    ...snapshot(),
    protectedBuildZone: {
      left: 100, top: 100, width: 500, height: 279, inset: 12, blocked: false,
    },
  }), null);
});

test("normalizes reversed projected edges so labels remain upright", () => {
  const { rulers, view } = harness();
  assert.equal(view.update(snapshot()).mode, "edges");
  ["top", "right", "bottom", "left"].forEach((id) => {
    const rotation = Number.parseFloat(rulers[id].style.transform.slice(7));
    assert.ok(Math.abs(rotation) <= WORKSHOP_RULER_MAXIMUM_READABLE_TILT_DEGREES);
  });
});

test("repeated geometry is idempotent", () => {
  const { view } = harness();
  view.update(snapshot());
  assert.deepEqual(view.update(snapshot()), { mode: "edges", changed: false });
});

test("repeated fallback is idempotent and responsive geometry updates once", () => {
  const { rulers, view } = harness();
  const edgeOn = { ...snapshot(), edgePresentationUsable: false };
  assert.deepEqual(view.update(edgeOn), { mode: "fallback", changed: true });
  assert.deepEqual(view.update(edgeOn), { mode: "fallback", changed: false });
  const resized = {
    ...edgeOn,
    stableHomeScreenBounds: {
      left: 140, top: 100, width: 700, height: 400,
    },
    protectedBuildZone: {
      left: 120, top: 80, width: 740, height: 440,
      inset: 12, blocked: false,
    },
  };
  assert.deepEqual(view.update(resized), { mode: "fallback", changed: true });
  assert.equal(rulers.top.style.left, "120px");
  assert.equal(rulers.top.style.width, "740px");
  assert.deepEqual(view.update(resized), { mode: "fallback", changed: false });
});

test("edge-on, blocked, and invalid world registration restore fallback", () => {
  const first = harness();
  first.view.update(snapshot());
  assert.deepEqual(first.view.update({ ...snapshot(), edgePresentationUsable: false }),
    { mode: "fallback", changed: true });
  Object.values(first.rulers).forEach((ruler) => {
    assert.equal(ruler.dataset.workstationEdgeRegistered, undefined);
    assert.ok(ruler.dataset.workstationReadableFallback);
  });
  const invalid = harness(false);
  assert.equal(invalid.view.update(snapshot()).mode, "fallback");
  Object.values(invalid.rulers).forEach((ruler) => {
    assert.equal(ruler.dataset.workstationReadableFallback, undefined);
    assert.equal(ruler.style.position, undefined);
  });
});

test("reset is idempotent and restores all ruler-owned inline properties", () => {
  const { rulers, view } = harness();
  view.update(snapshot());
  assert.deepEqual(view.reset(), { mode: "fallback", changed: true });
  assert.deepEqual(view.reset(), { mode: "fallback", changed: false });
  Object.values(rulers).forEach((ruler) => {
    assert.equal(ruler.style.position, undefined);
    assert.equal(ruler.style.transform, undefined);
    assert.equal(ruler.dataset.workstationReadableFallback, undefined);
  });
});
