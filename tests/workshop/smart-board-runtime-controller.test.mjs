import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

test("Smart Board rendered phases exclusively gate Tool Chest deployment and projection shutdown", () => {
  const events = [];
  let activation;
  let retraction;
  let deployments = 0;
  let exits = 0;
  const controller = createWorkshopRuntimeController({
    emit: (name) => events.push(name),
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: (callbacks) => { activation = callbacks; },
      deployToolChest: ({ complete }) => { deployments += 1; complete(); },
      settleWorkshopReady: ({ complete }) => complete(),
      secureDrawers: ({ complete }) => complete(),
      parkToolChest: ({ complete }) => complete(),
      retractSmartBoard: (callbacks) => { retraction = callbacks; },
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        exits += 1;
        tableStandby(); tablePoweredOff(); standby(); poweredOff(); complete();
      },
    },
  });

  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(deployments, 0);
  assert.equal(activation.extended(), true);
  assert.equal(deployments, 0);
  assert.equal(activation.poweredOn(), true);
  assert.equal(deployments, 0);
  assert.equal(activation.complete(), true);
  assert.equal(deployments, 1);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.deepEqual(events.filter((name) => name.startsWith("smartboard:")), [
    "smartboard:extended", "smartboard:powered-on", "smartboard:app-changed", "smartboard:ready",
  ]);

  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(controller.getSnapshot().workshop, "SHUTTING_DOWN");
  assert.equal(exits, 0);
  assert.equal(retraction.poweredOff(), true);
  assert.equal(exits, 0);
  assert.equal(retraction.complete(), true);
  assert.equal(exits, 1);
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.equal(events.filter((name) => name === "smartboard:retracted").length, 1);
});

test("stale Smart Board phase callbacks cannot settle a newer shutdown", () => {
  let activation;
  let retraction;
  const controller = createWorkshopRuntimeController({
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: (callbacks) => { activation = callbacks; },
      deployToolChest: ({ complete }) => complete(),
      settleWorkshopReady: ({ complete }) => complete(),
      secureDrawers: ({ complete }) => complete(),
      parkToolChest: ({ complete }) => complete(),
      retractSmartBoard: (callbacks) => { retraction = callbacks; },
      exitWorkshop: ({ tableStandby, tablePoweredOff, standby, poweredOff, complete }) => {
        tableStandby(); tablePoweredOff(); standby(); poweredOff(); complete();
      },
    },
  });
  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  const stale = activation;
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(stale.extended(), false);
  assert.equal(stale.poweredOn(), false);
  assert.equal(stale.complete(), false);
  retraction.poweredOff(); retraction.complete();
  assert.equal(controller.getSnapshot().workshop, "OFF");
});
