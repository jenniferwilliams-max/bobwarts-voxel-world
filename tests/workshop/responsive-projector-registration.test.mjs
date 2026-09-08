import assert from "node:assert/strict";
import test from "node:test";

import {
  RESPONSIVE_PROJECTOR_REGISTRATION,
  calculateResponsiveProjectorRegistration,
  projectorIntersectsProtectedZone,
  registerResponsivePoweredOffProjector,
} from "../../js/workshop/projector/responsive-projector-registration.mjs";

test("records the approved WS-007 registration contract", () => {
  assert.deepEqual(RESPONSIVE_PROJECTOR_REGISTRATION, {
    anchor: "VISUAL_BASE_CENTER",
    registrationRectangle: "WORKSHOP_VIEWPORT_STAGE",
    anchorX: 0.5,
    anchorY: 1,
    sizeRatio: 0.68,
    minimumSize: 148,
    maximumSize: 224,
    essentialControlClearance: 12,
    sourceCanvasSize: 587,
    visibleBounds: { left: 32, top: 48, right: 552, bottom: 541 },
  });
  assert.equal(Object.isFrozen(RESPONSIVE_PROJECTOR_REGISTRATION), true);
  assert.equal(Object.isFrozen(RESPONSIVE_PROJECTOR_REGISTRATION.visibleBounds), true);
});

test("sizes the Projector from stage height at the Mac reference viewport", () => {
  const result = calculateResponsiveProjectorRegistration(622, 319);
  assert.equal(result.hidden, false);
  assert.equal(result.size, 216.92000000000002);
  assert.equal(result.visualAnchorX, 311);
  assert.equal(result.visualAnchorY, 319);
});

test("clamps responsive sizing at the approved endpoints", () => {
  assert.equal(calculateResponsiveProjectorRegistration(1000, 100).size, 148);
  assert.equal(calculateResponsiveProjectorRegistration(1000, 1000).size, 224);
});

test("aligns the visible alpha base rather than the transparent canvas edge", () => {
  const result = calculateResponsiveProjectorRegistration(622, 319);
  const visibleBase = 319 - result.bottom - result.size + result.size * (541 / 587);
  assert.ok(Math.abs(visibleBase - 319) < 1e-9);
  assert.ok(result.bottom < 0);
  assert.notEqual(result.translateXPercent, -50);
});

test("hides instead of covering protected space at extreme reflow", () => {
  assert.equal(calculateResponsiveProjectorRegistration(120, 319).hidden, true);
  assert.equal(calculateResponsiveProjectorRegistration(622, 100).hidden, true);
  assert.equal(calculateResponsiveProjectorRegistration(0, 0).hidden, true);
});

test("detects the approved essential-control clearance", () => {
  const registration = calculateResponsiveProjectorRegistration(311, 160);
  const stage = { left: 166, top: 116 };
  assert.equal(projectorIntersectsProtectedZone(
    registration,
    stage,
    [{ left: 0, right: 640, top: 234, bottom: 360 }],
  ), true);
  assert.equal(projectorIntersectsProtectedZone(
    registration,
    stage,
    [{ left: 0, right: 640, top: 300, bottom: 360 }],
  ), false);
});

test("applies the approved visibility contract across zoom-equivalent reflow", () => {
  const cases = [
    {
      label: "100%",
      stage: { width: 622, height: 319, left: 331, top: 231 },
      dashboard: { left: 0, right: 1280, top: 594, bottom: 720 },
      hidden: false,
    },
    {
      label: "125%",
      stage: { width: 498, height: 255, left: 265, top: 185 },
      dashboard: { left: 0, right: 1024, top: 450, bottom: 576 },
      hidden: true,
    },
    {
      label: "150%",
      stage: { width: 415, height: 213, left: 221, top: 154 },
      dashboard: { left: 0, right: 853, top: 354, bottom: 480 },
      hidden: true,
    },
    {
      label: "200%",
      stage: { width: 311, height: 160, left: 166, top: 116 },
      dashboard: { left: 0, right: 640, top: 234, bottom: 360 },
      hidden: true,
    },
  ];

  cases.forEach(({ label, stage, dashboard, hidden }) => {
    const registration = calculateResponsiveProjectorRegistration(stage.width, stage.height);
    const collision = projectorIntersectsProtectedZone(
      registration,
      stage,
      [dashboard],
    );
    assert.equal(registration.hidden || collision, hidden, label);
  });
});

test("settles immediately on ResizeObserver updates without events or animation", () => {
  let bounds = { width: 622, height: 319 };
  let observerCallback;
  const observed = [];
  let disconnected = false;
  class FakeResizeObserver {
    constructor(callback) { observerCallback = callback; }
    observe(value) { observed.push(value); }
    disconnect() { disconnected = true; }
  }
  const stage = { getBoundingClientRect: () => bounds };
  const mount = { style: {}, dataset: {} };
  const dashboard = {
    getBoundingClientRect: () => ({ width: 622, height: 126, left: 0, right: 622, top: 600, bottom: 726 }),
  };
  const registration = registerResponsivePoweredOffProjector({
    stage,
    mount,
    protectedElements: [dashboard],
    ResizeObserver: FakeResizeObserver,
  });

  assert.deepEqual(observed, [stage, dashboard]);
  assert.equal(mount.style.visibility, "visible");
  assert.equal(mount.style.width, "216.92000000000002px");
  assert.equal(mount.dataset.projectorRegistration, "VISUAL_BASE_CENTER");

  bounds = { width: 120, height: 319 };
  observerCallback();
  assert.equal(mount.style.visibility, "hidden");
  registration.disconnect();
  assert.equal(disconnected, true);
});

test("rejects invalid geometry and incomplete hosts", () => {
  assert.throws(() => calculateResponsiveProjectorRegistration(-1, 1), /finite nonnegative/);
  assert.throws(() => calculateResponsiveProjectorRegistration(1, NaN), /finite nonnegative/);
  assert.throws(() => registerResponsivePoweredOffProjector(), /stage must provide/);
  assert.throws(
    () => registerResponsivePoweredOffProjector({ stage: { getBoundingClientRect() {} } }),
    /mount must provide/,
  );
});
