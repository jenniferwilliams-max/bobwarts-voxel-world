import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";
import { createWorkshopReadyRenderSettlement } from "../../js/workshop/runtime/workshop-ready-render-settlement.mjs";

test("render settlement is the final gate to READY and workshop:ready", () => {
  const frames = [];
  let renderedReady = true;
  let controller;
  const events = [];
  const settlement = createWorkshopReadyRenderSettlement({
    requestFrame(callback) { frames.push(callback); return callback; },
    cancelFrame() {},
    isRenderedReady: () => renderedReady,
    isTransitionCurrent: (id) => controller.getSnapshot().activeTransitionId === id,
  });
  controller = createWorkshopRuntimeController({
    emit: (name) => events.push(name),
    drivers: {
      powerOnProjector: ({ begin, complete }) => { begin(); complete(); },
      powerOnTable: ({ begin, complete }) => { begin(); complete(); },
      startTableProjection: ({ complete }) => complete(),
      settleTableProjection: ({ complete }) => complete(),
      startProjectorProjection: ({ complete }) => complete(),
      settleProjectorProjection: ({ complete }) => complete(),
      activateSmartBoard: ({ complete }) => complete(),
      deployToolChest: ({ complete }) => complete(),
      settleWorkshopReady: (options) => settlement.settle(options),
    },
  });

  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  assert.equal(controller.getSnapshot().disabled.drawers, true);
  assert.equal(events.filter((name) => name === "workshop:ready").length, 0);
  assert.ok(events.indexOf("toolchest:deployed") >= 0);
  frames.shift()();
  assert.equal(controller.getSnapshot().workshop, "STARTING");
  frames.shift()();
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.equal(events.filter((name) => name === "workshop:ready").length, 1);
  assert.ok(events.indexOf("toolchest:deployed") < events.indexOf("workshop:ready"));

  renderedReady = false;
  assert.equal(frames.length, 0);
});
