import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSHOP_WORKSTATION_REGISTRATION,
  WORKSHOP_WORKSTATION_WORLD_CORNERS,
  createProjectedTabletopRegistration,
  createWorkshopWorkstationRegistration,
} from "../../js/workshop/runtime/workshop-workstation-registration.mjs";

const bounds = (left, top, width, height) => ({ left, top, width, height });
const projectedTabletop = () => createProjectedTabletopRegistration([
  { x: 100, y: 100, depth: 0 },
  { x: 120, y: 500, depth: 0 },
  { x: 900, y: 120, depth: 0 },
  { x: 880, y: 480, depth: 0 },
]);
const tableRegistration = () => ({
  width: 960,
  height: 640,
  imageLeft: 20,
  imageTop: 30,
  anchorScreenX: 500,
  anchorScreenY: 680,
  preferredWidth: 960,
  reducedForClearance: false,
  hidden: false,
  visible: bounds(42, 229, 912, 530),
  transform: { x: 0, y: 0, z: -800, width: 12, height: 8 },
});

test("defines the approved canonical 50 by 50 workstation contract", () => {
  assert.deepEqual(WORKSHOP_WORKSTATION_REGISTRATION.worldBounds, {
    xMin: -25, xMax: 25, zMin: -25, zMax: 25, width: 50, depth: 50,
  });
  assert.deepEqual(WORKSHOP_WORKSTATION_REGISTRATION.elevations, {
    platformSurface: -0.5,
    grid: -0.498,
    rulerProjection: -0.485,
  });
  assert.deepEqual(WORKSHOP_WORKSTATION_REGISTRATION.table, {
    anchor: "VISUAL_BASE_CENTER",
    preferredWidthRatio: 0.96,
    minimumWidth: 320,
    maximumWidth: 1150,
    essentialControlClearance: 12,
  });
  assert.equal(Object.isFrozen(WORKSHOP_WORKSTATION_REGISTRATION), true);
  assert.equal(Object.isFrozen(WORKSHOP_WORKSTATION_REGISTRATION.worldBounds), true);
});

test("provides one frozen canonical set of four ruler-projection corners", () => {
  assert.deepEqual(WORKSHOP_WORKSTATION_WORLD_CORNERS, [
    { x: -25, y: -0.485, z: -25 },
    { x: -25, y: -0.485, z: 25 },
    { x: 25, y: -0.485, z: -25 },
    { x: 25, y: -0.485, z: 25 },
  ]);
  assert.equal(Object.isFrozen(WORKSHOP_WORKSTATION_WORLD_CORNERS), true);
  WORKSHOP_WORKSTATION_WORLD_CORNERS.forEach((corner) => {
    assert.equal(Object.isFrozen(corner), true);
  });
});

test("publishes a complete frozen registration snapshot", () => {
  const registration = createWorkshopWorkstationRegistration({
    getStableHomeScreenBounds: () => bounds(100, 80, 800, 500),
    getLiveProjectedScreenBounds: () => bounds(120, 90, 760, 470),
    getLiveProjectedTabletop: projectedTabletop,
    getProtectedBuildZone: () => ({ ...bounds(140, 110, 720, 430), inset: 12 }),
    getTableRegistration: tableRegistration,
  });
  const snapshot = registration.update();
  assert.equal(snapshot.blocked, false);
  assert.equal(snapshot.worldBounds, WORKSHOP_WORKSTATION_REGISTRATION.worldBounds);
  assert.equal(snapshot.worldCorners, WORKSHOP_WORKSTATION_WORLD_CORNERS);
  assert.deepEqual(snapshot.stableHomeScreenBounds, {
    left: 100, top: 80, right: 900, bottom: 580, width: 800, height: 500,
  });
  assert.deepEqual(snapshot.liveProjectedScreenBounds, {
    left: 120, top: 90, right: 880, bottom: 560, width: 760, height: 470,
  });
  assert.equal(snapshot.liveProjectedCorners.length, 4);
  assert.deepEqual(snapshot.orderedTabletopEdges.map((edge) => edge.id),
    ["top", "right", "bottom", "left"]);
  assert.equal(snapshot.edgePresentationUsable, true);
  assert.equal(snapshot.protectedBuildZone.inset, 12);
  assert.equal(snapshot.tableRegistration.anchorScreenX, 500);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.tableRegistration), true);
});

test("returns the same snapshot for repeated unchanged registration updates", () => {
  let live = bounds(120, 90, 760, 470);
  const registration = createWorkshopWorkstationRegistration({
    getStableHomeScreenBounds: () => bounds(100, 80, 800, 500),
    getLiveProjectedScreenBounds: () => live,
    getLiveProjectedTabletop: projectedTabletop,
    getProtectedBuildZone: () => ({ ...bounds(140, 110, 720, 430), inset: 12 }),
    getTableRegistration: tableRegistration,
  });
  const first = registration.update();
  assert.equal(registration.update(), first);
  live = bounds(121, 90, 760, 470);
  assert.notEqual(registration.update(), first);
});

test("fails closed for invalid, blocked, or hidden registration geometry", () => {
  const scenarios = [
    { stable: null },
    { stable: bounds(0, 0, 0, 100) },
    { live: { left: 0, top: 0, width: -1, height: 20 } },
    { protectedZone: { ...bounds(0, 0, 0, 0), inset: 12, blocked: true } },
    { table: { ...tableRegistration(), hidden: true } },
  ];
  scenarios.forEach((scenario) => {
    const registration = createWorkshopWorkstationRegistration({
      getStableHomeScreenBounds: () => scenario.stable === undefined
        ? bounds(0, 0, 100, 100) : scenario.stable,
      getLiveProjectedScreenBounds: () => scenario.live || bounds(0, 0, 100, 100),
      getLiveProjectedTabletop: projectedTabletop,
      getProtectedBuildZone: () => scenario.protectedZone || {
        ...bounds(0, 0, 100, 100), inset: 12,
      },
      getTableRegistration: () => scenario.table || tableRegistration(),
    });
    assert.equal(registration.update().blocked, true);
  });
});

test("orders projected tabletop edges and detects edge-on fallback", () => {
  const projected = projectedTabletop();
  assert.deepEqual(projected.edges.map((edge) => edge.id),
    ["top", "right", "bottom", "left"]);
  assert.equal(projected.usable, true);
  assert.equal(projected.edges.every((edge) => edge.usable), true);
  assert.equal(Object.isFrozen(projected.corners), true);
  const edgeOn = createProjectedTabletopRegistration([
    { x: 100, y: 100, depth: 0 },
    { x: 100, y: 100, depth: 0 },
    { x: 900, y: 100, depth: 0 },
    { x: 900, y: 100, depth: 0 },
  ]);
  assert.equal(edgeOn.usable, false);
});

test("requires all registration geometry providers", () => {
  assert.throws(
    () => createWorkshopWorkstationRegistration({}),
    /providers are required/,
  );
});
