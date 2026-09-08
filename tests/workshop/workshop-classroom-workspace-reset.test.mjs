import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWorkshopProtectedBuildZone,
  createWorkshopClassroomWorkspaceReset,
  WORKSHOP_CLASSROOM_RESET_CLASS,
} from "../../js/workshop/runtime/workshop-classroom-workspace-reset.mjs";
import { WORKSHOP_WORKSTATION_REGISTRATION } from
  "../../js/workshop/runtime/workshop-workstation-registration.mjs";

function classList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
  };
}

test("calculates an inset protected build zone and excludes overlapping controls", () => {
  const zone = calculateWorkshopProtectedBuildZone({
    stageBounds: { left: 200, top: 42, width: 800, height: 646 },
    protectedBounds: [
      { left: 190, top: 100, width: 80, height: 300 },
      { left: 940, top: 80, width: 100, height: 400 },
      { left: 0, top: 680, width: 1200, height: 112 },
    ],
  });
  assert.equal(zone.inset, 12);
  assert.equal(zone.inset,
    WORKSHOP_WORKSTATION_REGISTRATION.table.essentialControlClearance);
  assert.equal(zone.left >= 282, true);
  assert.equal(zone.right <= 928, true);
  assert.equal(zone.bottom <= 668, true);
  assert.equal(zone.blocked, false);
  assert.equal(Object.isFrozen(zone), true);
});

test("fails closed when the inset leaves no usable build zone", () => {
  const zone = calculateWorkshopProtectedBuildZone({
    stageBounds: { left: 0, top: 0, width: 20, height: 20 },
  });
  assert.equal(zone.width, 0);
  assert.equal(zone.height, 0);
  assert.equal(zone.blocked, true);
});

test("owns one reversible Workshop class and neutral background selection", () => {
  const body = { classList: classList() };
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  const neutral = { name: "neutral" };
  const environment = { name: "environment" };
  const reset = createWorkshopClassroomWorkspaceReset({ body, stage, neutralBackground: neutral });
  assert.equal(reset.selectBackground(environment), environment);
  assert.equal(reset.activate().code, "ACTIVATED");
  assert.equal(reset.activate().code, "IDEMPOTENT");
  assert.equal(body.classList.contains(WORKSHOP_CLASSROOM_RESET_CLASS), true);
  assert.equal(reset.selectBackground(environment), neutral);
  assert.equal(reset.deactivate().code, "DEACTIVATED");
  assert.equal(reset.deactivate().code, "IDEMPOTENT");
  assert.equal(body.classList.contains(WORKSHOP_CLASSROOM_RESET_CLASS), false);
  assert.equal(reset.selectBackground(environment), environment);
});
