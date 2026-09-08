import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function harness() {
  const events = [];
  let applicationActivation;
  let applicationClear;
  let boardActivation;
  let boardRetraction;
  let deployments = 0;
  const controller = createWorkshopRuntimeController({
    emit: (name, detail) => events.push({ name, detail }),
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: (callbacks) => { boardActivation = callbacks; },
      activateSmartBoardApplication: (callbacks) => { applicationActivation = callbacks; },
      deployToolChest: ({ complete }) => { deployments += 1; complete(); },
      settleWorkshopReady: ({ complete }) => complete(),
      secureDrawers: ({ complete }) => complete(),
      parkToolChest: ({ complete }) => complete(),
      clearSmartBoardApplication: (callbacks) => { applicationClear = callbacks; },
      retractSmartBoard: (callbacks) => { boardRetraction = callbacks; },
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        tableStandby(); tablePoweredOff(); standby(); poweredOff(); complete();
      },
    },
  });
  return {
    controller, events,
    get applicationActivation() { return applicationActivation; },
    get applicationClear() { return applicationClear; },
    get boardActivation() { return boardActivation; },
    get boardRetraction() { return boardRetraction; },
    get deployments() { return deployments; },
  };
}

test("application render settlement gates Smart Board readiness and Tool Chest deployment", () => {
  const testHarness = harness();
  const { controller, events } = testHarness;
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  testHarness.boardActivation.extended();
  testHarness.boardActivation.poweredOn();
  testHarness.boardActivation.complete();
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(testHarness.deployments, 0);
  assert.equal(events.some(({ name }) => name === "smartboard:ready"), false);
  assert.equal(testHarness.applicationActivation.complete(), true);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.equal(testHarness.deployments, 1);
  assert.equal(events.filter(({ name }) => name === "smartboard:app-changed").length, 1);
  assert.equal(events.find(({ name }) => name === "smartboard:app-changed").detail.application, "MEASUREMENT_ASSISTANT");
});

test("application clear settles before Smart Board power-off and rejects stale startup callbacks", () => {
  const testHarness = harness();
  const { controller, events } = testHarness;
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  testHarness.boardActivation.extended();
  testHarness.boardActivation.poweredOn();
  testHarness.boardActivation.complete();
  const staleActivation = testHarness.applicationActivation;
  staleActivation.complete();
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(testHarness.boardRetraction, undefined);
  assert.equal(testHarness.applicationClear.complete(), true);
  assert.ok(testHarness.boardRetraction);
  testHarness.boardRetraction.poweredOff();
  testHarness.boardRetraction.complete();
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.equal(staleActivation.complete(), false);
  assert.deepEqual(
    events.filter(({ name }) => name === "smartboard:app-changed").map(({ detail }) => detail.application),
    ["MEASUREMENT_ASSISTANT", "NONE"],
  );
});

test("fault invalidation clears canonical application state and emits once", () => {
  const testHarness = harness();
  const { controller, events } = testHarness;
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  testHarness.boardActivation.extended();
  testHarness.boardActivation.poweredOn();
  testHarness.boardActivation.complete();
  testHarness.applicationActivation.complete();
  assert.equal(controller.getSnapshot().boardApplication, "MEASUREMENT_ASSISTANT");
  controller.reportProjectorFault({ message: "test fault" });
  assert.equal(controller.getSnapshot().boardApplication, "NONE");
  assert.equal(controller.getSnapshot().measurement, "IDLE");
  assert.deepEqual(
    events.filter(({ name }) => name === "smartboard:app-changed").map(({ detail }) => detail.application),
    ["MEASUREMENT_ASSISTANT", "NONE"],
  );
});
