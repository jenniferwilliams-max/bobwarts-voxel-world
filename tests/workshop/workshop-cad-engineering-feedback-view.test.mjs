import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_CAD_ORIGIN_MARKER,
  createWorkshopCadEngineeringFeedbackView,
  normalizeWorkshopEngineeringFeedback,
} from "../../js/workshop/runtime/workshop-cad-engineering-feedback-view.mjs";

const boundary = Object.freeze({ xMin: -10, xMax: 10, zMin: -10, zMax: 10 });

function element() {
  return { textContent: "" };
}

test("engineering feedback derives workspace and precision from authoritative input", () => {
  const cm = normalizeWorkshopEngineeringFeedback({ active: true, boundary, unit: "cm" });
  const mm = normalizeWorkshopEngineeringFeedback({ active: true, boundary, unit: "mm" });
  assert.equal(cm.text, "Workspace: 20 × 20 cm • Precision: 1 cm • Snap: 1 cm");
  assert.equal(mm.text, "Workspace: 20 × 20 cm • Precision: 1 mm • Standard blocks: 1 cm");
  assert.equal(Object.isFrozen(cm), true);
  assert.equal(normalizeWorkshopEngineeringFeedback({ active: false, boundary }), null);
  assert.equal(normalizeWorkshopEngineeringFeedback({
    active: true,
    boundary: { xMin: 0, xMax: 0, zMin: -10, zMax: 10 },
  }), null);
});

test("build-aware dimensions use the supplied boundary without modifying it", () => {
  const expanded = Object.freeze({ xMin: -12, xMax: 14, zMin: -11, zMax: 13 });
  const before = JSON.stringify(expanded);
  const snapshot = normalizeWorkshopEngineeringFeedback({
    active: true,
    boundary: expanded,
    unit: "cm",
  });
  assert.equal(snapshot.width, 26);
  assert.equal(snapshot.depth, 24);
  assert.match(snapshot.text, /Workspace: 26 × 24 cm/);
  assert.equal(JSON.stringify(expanded), before);
});

test("view is idempotent and separates visible updates from announcements", () => {
  const statusElement = element();
  const announcementElement = element();
  const originMarker = { visible: false };
  const view = createWorkshopCadEngineeringFeedbackView({
    statusElement,
    announcementElement,
    originMarker,
  });
  const first = view.update({
    active: true,
    boundary,
    unit: "cm",
    gridVisible: true,
    announce: true,
  });
  const repeated = view.update({
    active: true,
    boundary,
    unit: "cm",
    gridVisible: true,
    announce: true,
  });
  assert.strictEqual(first, repeated);
  assert.equal(statusElement.textContent, first.text);
  assert.equal(announcementElement.textContent, first.text);
  assert.equal(originMarker.visible, true);

  view.update({
    active: true,
    boundary: { xMin: -11, xMax: 11, zMin: -11, zMax: 11 },
    unit: "cm",
    gridVisible: true,
    announce: false,
  });
  assert.match(statusElement.textContent, /22 × 22 cm/);
  assert.equal(announcementElement.textContent, first.text);

  view.reset();
  assert.equal(view.read(), null);
  assert.equal(statusElement.textContent, "");
  assert.equal(announcementElement.textContent, "");
  assert.equal(originMarker.visible, false);
});

test("origin marker contract stays subtle and centered on the true origin plane", () => {
  assert.equal(Object.isFrozen(WORKSHOP_CAD_ORIGIN_MARKER), true);
  assert.ok(WORKSHOP_CAD_ORIGIN_MARKER.innerRadius > 0);
  assert.ok(WORKSHOP_CAD_ORIGIN_MARKER.outerRadius < 0.5);
  assert.ok(WORKSHOP_CAD_ORIGIN_MARKER.innerRadius < WORKSHOP_CAD_ORIGIN_MARKER.outerRadius);
  assert.equal(WORKSHOP_CAD_ORIGIN_MARKER.elevation, -0.4765);
});
