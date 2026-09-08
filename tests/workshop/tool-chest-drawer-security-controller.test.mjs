import test from "node:test";
import assert from "node:assert/strict";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";
import { createToolChestDrawerSecurityView } from "../../js/workshop/toolchest/tool-chest-drawer-security-view.mjs";

test("rendered drawer security is the sole gate to Tool Chest parking", () => {
  let transitionEnd;
  const drawer = { dataset: { toolChestDrawer: "colors-materials" } };
  const physical = { state: "closed", renderedClosed: true };
  const root = {
    addEventListener(name, callback) { if (name === "transitionend") transitionEnd = callback; },
    removeEventListener() {},
  };
  const security = createToolChestDrawerSecurityView({
    root,
    drawers: [drawer],
    getDrawerState: () => physical.state,
    closeDrawer() { physical.state = "closing"; physical.renderedClosed = false; },
    isAtClosedEndpoint: () => physical.renderedClosed,
  });
  const events = [];
  let parkRequests = 0;
  const controller = createWorkshopRuntimeController({
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
      settleWorkshopReady: ({ complete }) => complete(),
      openDrawer: ({ complete }) => {
        physical.state = "open";
        physical.renderedClosed = false;
        complete();
      },
      secureDrawers: (transition) => security.secure(transition),
      parkToolChest: () => { parkRequests += 1; },
      retractSmartBoard: () => {},
      exitWorkshop: () => {},
    },
  });

  controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
  controller.request({
    action: "OPEN_DRAWER",
    input: "pointer",
    payload: { uiDrawer: "colors-materials", uncommittedOperationResolved: true },
  });
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  assert.equal(parkRequests, 0);
  assert.equal(events.filter((name) => name === "toolchest:drawers-secured").length, 0);

  physical.state = "closed";
  physical.renderedClosed = true;
  transitionEnd({ target: drawer, propertyName: "transform" });
  transitionEnd({ target: drawer, propertyName: "transform" });
  assert.equal(parkRequests, 1);
  assert.equal(events.filter((name) => name === "toolchest:drawers-secured").length, 1);
  assert.equal(controller.getSnapshot().workshop, "SHUTTING_DOWN");
});
