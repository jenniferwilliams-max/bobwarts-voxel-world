import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BIBLE_VERSION, CANCELLATION_CONTRACT, CANONICAL_EVENTS, CONTRACT_TRANSITIONS,
  DEPENDENCY_ORDER, DRAWER_IDS, EVENT_OWNER, HOST_PRESENTATION_STATES, INPUT_SOURCES, OWNERSHIP,
  SEMANTIC_ACTIONS, SUBSYSTEM_STATES, TOP_LEVEL_STATES,
  createOneShotEventLedger, normalizeSemanticAction, validateTransition,
} from "../../js/workshop/contracts/workshop-state-contract.mjs";

const validStartup = { assetsLoaded: true, allDrawersClosed: true, chestParked: true, shutdownInProgress: false };

test("targets Animation Bible version 1.0", () => assert.equal(BIBLE_VERSION, "1.0"));
test("defines all authoritative top-level states", () => assert.deepEqual(TOP_LEVEL_STATES, ["OFF", "STARTING", "READY", "SHUTTING_DOWN", "FAULT_SAFE"]));
test("keeps host loading labels outside canonical Workshop state", () => {
  assert.deepEqual(HOST_PRESENTATION_STATES, ["OFF", "LOADING", "READY", "STARTING", "ACTIVE", "STOPPING", "FAILED"]);
  assert.equal(TOP_LEVEL_STATES.includes("LOADING"), false);
  assert.equal(TOP_LEVEL_STATES.includes("FAILED"), false);
  assert.equal(TOP_LEVEL_STATES.includes("ACTIVE"), false);
});
test("defines all six logical drawers", () => assert.deepEqual(DRAWER_IDS, ["D1_MEASURE", "D2_BUILD", "D3_MATERIALS", "D4_COMPONENTS", "D5_NOTEBOOK", "D6_UTILITY"]));
test("each required subsystem has explicit ownership", () => assert.deepEqual(Object.keys(OWNERSHIP), ["workshop", "projector", "table", "smartboard", "toolchest", "drawer", "measurement"]));
test("state records and transition records are frozen", () => {
  assert.ok(Object.isFrozen(SUBSYSTEM_STATES));
  assert.ok(Object.isFrozen(CONTRACT_TRANSITIONS));
});

test("OFF starts only when every startup guard passes", () => {
  assert.equal(validateTransition("workshop", "OFF", "STARTING", validStartup).ok, true);
  for (const failed of ["assetsLoaded", "allDrawersClosed", "chestParked"]) {
    assert.equal(validateTransition("workshop", "OFF", "STARTING", { ...validStartup, [failed]: false }).code, "STARTUP_GUARD_FAILED");
  }
});
test("same-state requests are idempotent", () => assert.equal(validateTransition("workshop", "READY", "READY").code, "IDEMPOTENT"));
test("READY cannot jump directly to OFF", () => assert.equal(validateTransition("workshop", "READY", "OFF").code, "ILLEGAL_TRANSITION"));
test("startup can cancel into dependency-safe shutdown", () => assert.equal(validateTransition("workshop", "STARTING", "SHUTTING_DOWN").ok, true));
test("shutdown restart waits for closed drawers", () => {
  assert.equal(validateTransition("workshop", "SHUTTING_DOWN", "STARTING", { allDrawersClosed: false }).code, "DRAWERS_NOT_CLOSED");
  assert.equal(validateTransition("workshop", "SHUTTING_DOWN", "STARTING", { allDrawersClosed: true }).ok, true);
});
test("FAULT_SAFE can only settle to secured OFF", () => {
  assert.equal(validateTransition("workshop", "FAULT_SAFE", "STARTING", validStartup).code, "ILLEGAL_TRANSITION");
  assert.equal(validateTransition("workshop", "FAULT_SAFE", "OFF", { faultAcknowledged: true, emissiveLayersOff: true }).ok, true);
});

test("projector cannot project before table emitters are ready", () => {
  assert.equal(validateTransition("projector", "POWERED_ON", "PROJECTION_STARTING", { tableEmittersReady: false }).ok, false);
  assert.equal(validateTransition("projector", "POWERED_ON", "PROJECTION_STARTING", { tableEmittersReady: true }).ok, true);
});
test("projector cannot power off while projection is visible", () => assert.equal(validateTransition("projector", "POWERED_ON", "POWERED_OFF", { tableProjectionVisible: true }).ok, false));
test("table cannot power on before projector", () => assert.equal(validateTransition("table", "POWERED_OFF", "POWERING_ON", { projectorPoweredOn: false }).ok, false));
test("board cannot extend before stable projection", () => assert.equal(validateTransition("boardMechanical", "RETRACTED", "EXTENDING", { projectionStable: false }).ok, false));
test("board cannot retract with power or unsaved work", () => {
  assert.equal(validateTransition("boardMechanical", "EXTENDED", "RETRACTING", { boardPoweredOff: false }).code, "BOARD_RETRACTION_BLOCKED");
  assert.equal(validateTransition("boardMechanical", "EXTENDED", "RETRACTING", { boardPoweredOff: true, unsavedNotebookEdit: true }).ok, false);
});
test("chest deploy waits for board and closed drawers", () => assert.equal(validateTransition("chest", "PARKED", "UNDOCKING", { boardReady: true, allDrawersClosed: false }).ok, false));
test("chest docking rejects obstruction and open drawers", () => assert.equal(validateTransition("chest", "DEPLOYED", "DOCKING", { allDrawersClosed: true, obstructionClear: false }).code, "CHEST_DOCKING_BLOCKED"));
test("drawer opening requires deployed chest and exclusivity", () => {
  assert.equal(validateTransition("drawer", "CLOSED", "OPENING", { chestDeployed: false, otherDrawerActive: false }).ok, false);
  assert.equal(validateTransition("drawer", "CLOSED", "OPENING", { chestDeployed: true, otherDrawerActive: true }).ok, false);
  assert.equal(validateTransition("drawer", "CLOSED", "OPENING", { chestDeployed: true, otherDrawerActive: false }).ok, true);
});
test("blocked drawers never force close", () => assert.equal(validateTransition("drawer", "BLOCKED", "CLOSING", { blockResolved: false, uncommittedOperationResolved: true }).ok, false));
test("measurement selection requires ready app and measurable object", () => {
  const context = { workshopReady: true, measurementAppActive: true, objectMeasurable: true };
  assert.equal(validateTransition("measurement", "IDLE", "SELECTED_OBJECT", context).ok, true);
  assert.equal(validateTransition("measurement", "IDLE", "SELECTED_OBJECT", { ...context, objectMeasurable: false }).ok, false);
});

test("every canonical event has exactly one owner", () => {
  const events = Object.values(CANONICAL_EVENTS).flat();
  assert.equal(new Set(events).size, events.length);
  for (const event of events) assert.ok(EVENT_OWNER[event]);
});
test("one-shot ledger emits once per event and transition", () => {
  const ledger = createOneShotEventLedger();
  assert.equal(ledger.claim("startup-1", "workshop:ready"), true);
  assert.equal(ledger.claim("startup-1", "workshop:ready"), false);
  assert.equal(ledger.claim("startup-2", "workshop:ready"), true);
});
test("one-shot ledger rejects unknown events", () => assert.throws(() => createOneShotEventLedger().claim("t1", "made-up:event"), /Unknown completion event/));

test("all input methods produce the same semantic action and payload", () => {
  for (const input of INPUT_SOURCES) {
    const command = normalizeSemanticAction({ action: "OPEN_DRAWER", payload: { id: "D2_BUILD" }, input });
    assert.equal(command.action, "OPEN_DRAWER");
    assert.deepEqual(command.payload, { id: "D2_BUILD" });
  }
});
test("unknown action and input sources are rejected", () => {
  assert.throws(() => normalizeSemanticAction({ action: "CLICK", input: "pointer" }), /Unknown semantic action/);
  assert.throws(() => normalizeSemanticAction({ action: SEMANTIC_ACTIONS[0], input: "hover" }), /Unknown input source/);
});
test("dependency sequences preserve eight-step Bible order", () => {
  assert.equal(DEPENDENCY_ORDER.startup.length, 8);
  assert.equal(DEPENDENCY_ORDER.shutdown.length, 8);
  assert.deepEqual(DEPENDENCY_ORDER.shutdown.slice(1, 7), ["drawers", "toolchest", "smartboard", "projection", "table", "projector"]);
});
test("cancellation contract forbids snaps, forced close, and duplicate events", () => {
  assert.match(CANCELLATION_CONTRACT.startup, /no endpoint snap/i);
  assert.match(CANCELLATION_CONTRACT.drawer, /never force-closes/i);
  assert.match(CANCELLATION_CONTRACT.oneShot, /once per transition ID/i);
});
test("contract module remains isolated from rendering and browser globals", async () => {
  const source = await readFile(new URL("../../js/workshop/contracts/workshop-state-contract.mjs", import.meta.url), "utf8");
  for (const forbidden of ["document.", "window.", "THREE", "requestAnimationFrame", "assets/images/"]) assert.equal(source.includes(forbidden), false, forbidden);
});
