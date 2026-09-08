import test from "node:test";
import assert from "node:assert/strict";
import {
  RESPONSIVE_SMART_BOARD_REGISTRATION,
  calculateResponsiveSmartBoardRegistration,
  registerResponsiveSmartBoard,
  smartBoardIntersectsProtectedZone,
} from "../../js/workshop/smartboard/responsive-smart-board-registration.mjs";

test("records the deterministic Smart Board registration contract", () => {
  assert.deepEqual(RESPONSIVE_SMART_BOARD_REGISTRATION, {
    anchor: "VISUAL_TOP_RIGHT",
    registrationRectangle: "WORKSHOP_VIEWPORT_STAGE",
    anchorX: 0.98,
    anchorY: 0.06,
    sizeRatio: 0.55,
    minimumSize: 220,
    maximumSize: 400,
    minimumStageWidth: 300,
    minimumStageHeight: 180,
    essentialControlClearance: 12,
    retractedReveal: 28,
    sourceCanvas: { width: 1761, height: 1174 },
    visibleBounds: { left: 171, top: 189, right: 1662, bottom: 848 },
  });
  assert.equal(Object.isFrozen(RESPONSIVE_SMART_BOARD_REGISTRATION), true);
  assert.equal(Object.isFrozen(RESPONSIVE_SMART_BOARD_REGISTRATION.sourceCanvas), true);
  assert.equal(Object.isFrozen(RESPONSIVE_SMART_BOARD_REGISTRATION.visibleBounds), true);
});

test("calculates deterministic extended and retracted endpoints", () => {
  const result = calculateResponsiveSmartBoardRegistration(622, 319);
  assert.equal(result.hidden, false);
  assert.equal(result.width, 342.1);
  assert.equal(result.extendedTranslateX, 0);
  assert.ok(result.retractedTranslateX > 250 && result.retractedTranslateX < 270);
  assert.equal(result.visualBounds.right, 622 * 0.98);
  assert.equal(result.visualBounds.top, 319 * 0.06);
});

test("clamps sizing and hides instead of covering unsupported viewports", () => {
  assert.equal(calculateResponsiveSmartBoardRegistration(1000, 500).width, 400);
  assert.equal(calculateResponsiveSmartBoardRegistration(400, 300).width, 220.00000000000003);
  assert.equal(calculateResponsiveSmartBoardRegistration(299, 319).hidden, true);
  assert.equal(calculateResponsiveSmartBoardRegistration(622, 179).hidden, true);
  assert.equal(calculateResponsiveSmartBoardRegistration(0, 0).hidden, true);
});

test("detects protected-control collisions using the extended visible bounds", () => {
  const stage = { left: 100, top: 80 };
  const registration = calculateResponsiveSmartBoardRegistration(622, 319);
  const visible = registration.visualBounds;
  assert.equal(smartBoardIntersectsProtectedZone(registration, stage, [{
    left: stage.left + visible.left,
    right: stage.left + visible.right,
    top: stage.top + visible.top,
    bottom: stage.top + visible.bottom,
  }]), true);
  assert.equal(smartBoardIntersectsProtectedZone(registration, stage, [{
    left: 0, right: 50, top: 0, bottom: 50,
  }]), false);
});

test("registers responsively without events, focus, or interaction", () => {
  let bounds = { width: 622, height: 319, left: 100, top: 80 };
  let observerCallback;
  const observed = [];
  let disconnected = false;
  class FakeResizeObserver {
    constructor(callback) { observerCallback = callback; }
    observe(element) { observed.push(element); }
    disconnect() { disconnected = true; }
  }
  const stage = { getBoundingClientRect: () => bounds };
  const properties = new Map();
  const mount = {
    style: { setProperty(name, value) { properties.set(name, value); } },
    dataset: {},
  };
  const dashboard = {
    getBoundingClientRect: () => ({ width: 1000, height: 100, left: 0, right: 1000, top: 500, bottom: 600 }),
  };
  const registration = registerResponsiveSmartBoard({
    stage,
    mount,
    protectedElements: [dashboard],
    ResizeObserver: FakeResizeObserver,
  });
  assert.deepEqual(observed, [stage, dashboard]);
  assert.equal(mount.style.visibility, "visible");
  assert.equal(mount.dataset.smartBoardRegistration, "VISUAL_TOP_RIGHT");
  assert.equal(properties.get("--smart-board-extended-x"), "0px");
  assert.match(properties.get("--smart-board-retracted-x"), /px$/);

  bounds = { width: 299, height: 319, left: 100, top: 80 };
  observerCallback();
  assert.equal(mount.style.visibility, "hidden");
  registration.disconnect();
  assert.equal(disconnected, true);
});

test("rejects invalid geometry and incomplete hosts", () => {
  assert.throws(() => calculateResponsiveSmartBoardRegistration(-1, 1), /finite nonnegative/);
  assert.throws(() => calculateResponsiveSmartBoardRegistration(1, NaN), /finite nonnegative/);
  assert.throws(() => registerResponsiveSmartBoard(), /stage must provide/);
  assert.throws(
    () => registerResponsiveSmartBoard({ stage: { getBoundingClientRect() {} } }),
    /mount must provide/,
  );
});
