import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECTOR_AUDIO_TOKENS,
  PROJECTOR_SHUTDOWN_TIMING,
  calculateProjectorPowerDownPresentation,
  createProjectorAudioHooks,
  createProjectorLifecycleSafety,
  powerDownEasing,
} from "../../js/workshop/projector/projector-lifecycle-safety.mjs";
import { mountProjectorPowerOnView } from "../../js/workshop/projector/projector-power-on-view.mjs";
import { createWorkshopRuntimeController } from "../../js/workshop/runtime/workshop-runtime-controller.mjs";

function fakeImage() {
  const listeners = new Map();
  return {
    attributes: new Map(),
    style: {},
    addEventListener(name, listener) { listeners.set(name, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
  };
}

function powerHarness({ reduced = false } = {}) {
  const queue = [];
  const mount = { dataset: {}, children: [], appendChild(child) { this.children.push(child); } };
  const view = mountProjectorPowerOnView({
    document: { createElement: () => fakeImage() },
    mount,
    requestAnimationFrame(callback) { queue.push(callback); },
    reducedMotion: () => reduced,
  });
  const tick = (timestamp) => queue.splice(0).forEach((callback) => callback(timestamp));
  const settleOn = () => {
    view.start({ transitionId: "power-on", begin: () => true });
    tick(0);
    tick(200);
    tick(500);
  };
  return { view, mount, tick, settleOn };
}

function lifecycleHarness() {
  const calls = [];
  const pending = {};
  const lifecycle = createProjectorLifecycleSafety({
    opticalView: {
      cancelToStandby({ complete }) { calls.push("optical-standby"); pending.optical = complete; },
    },
    stopTableField({ complete }) { calls.push("table-field-stop"); pending.field = complete; },
    powerView: {
      powerDown({ tableProjectionVisible, complete }) {
        calls.push(`power-down:${tableProjectionVisible}`);
        pending.power = complete;
      },
      restorePoweredOn({ complete }) { calls.push("power-restore"); pending.restore = complete; },
      enterFaultSafe({ complete }) { calls.push("fault-safe"); pending.fault = complete; },
    },
    audio: { trigger(token) { calls.push(`audio:${token}`); return { ok: true }; } },
    reportStatus(fault) { calls.push(`status:${fault.code}`); },
  });
  return { lifecycle, calls, pending };
}

function controllerHarness() {
  const pending = {};
  const events = [];
  const controller = createWorkshopRuntimeController({
    emit(name, detail) { events.push({ name, detail }); },
    drivers: {
      powerOnProjector({ begin, complete }) { pending.powerBegin = begin; pending.powerOn = complete; },
      powerOnTable({ begin, complete }) { pending.tableBegin = begin; pending.tablePower = complete; },
      startLegacyTableProjection({ stable }) { pending.tableStable = stable; },
      startProjectorProjection({ complete }) { pending.projection = complete; },
      settleProjectorProjection({ complete }) { pending.active = complete; },
      activateSmartBoard({ complete }) { pending.smartBoard = complete; },
      deployToolChest({ complete }) { pending.toolChest = complete; },
      settleWorkshopReady({ complete }) { pending.ready = complete; },
      secureDrawers({ complete }) { pending.drawersSecured = complete; },
      parkToolChest({ complete }) { pending.toolChestParked = complete; },
      retractSmartBoard({ complete }) { pending.smartBoardRetracted = complete; },
      exitWorkshop(callbacks) { Object.assign(pending, callbacks); },
      restoreProjectorShutdown({ complete }) { pending.restore = complete; },
      lowerProjectorToStandby({ complete }) { pending.lower = complete; },
      secureProjectorFault({ complete }) { pending.fault = complete; },
    },
  });
  const start = () => {
    controller.request({ action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true } });
    pending.powerBegin(); pending.powerOn(); pending.tableBegin(); pending.tablePower(); pending.projection(); pending.tableStable(); pending.active();
    pending.smartBoard(); pending.toolChest(); pending.ready();
  };
  return { controller, pending, events, start };
}

test("declares the bounded shutdown and audio token contract", () => {
  assert.deepEqual(PROJECTOR_SHUTDOWN_TIMING, {
    duration: 300,
    reducedDuration: 150,
    easing: [0.70, 0, 0.84, 0],
    maximumAudioVisualSkew: 80,
  });
  assert.deepEqual(Object.values(PROJECTOR_AUDIO_TOKENS), [
    "relay-on", "projector-rise", "projection-lock", "projector-fall", "relay-off",
  ]);
});

test("power-down easing and presentation preserve endpoints", () => {
  assert.equal(powerDownEasing(0), 0);
  assert.equal(powerDownEasing(1), 1);
  const initial = { lens: 0.85, led: 1 };
  assert.deepEqual(calculateProjectorPowerDownPresentation(0, initial), {
    lens: 0.85, led: 1, progress: 0, complete: false,
  });
  const settled = calculateProjectorPowerDownPresentation(300, initial);
  assert.equal(settled.lens, 0);
  assert.equal(settled.led, 0);
  assert.equal(settled.complete, true);
  assert.equal(calculateProjectorPowerDownPresentation(150, initial, { reducedMotion: true }).complete, true);
});

test("audio hooks are optional, muted, non-gating, and exception-safe", () => {
  assert.equal(createProjectorAudioHooks().trigger("relay-off").code, "UNAVAILABLE");
  assert.equal(createProjectorAudioHooks({ isMuted: () => true }).trigger("relay-off").code, "MUTED");
  assert.equal(createProjectorAudioHooks({ play: () => { throw new Error("missing"); } }).trigger("relay-off").code, "UNAVAILABLE");
  assert.equal(createProjectorAudioHooks().trigger("invented").code, "UNKNOWN_AUDIO_TOKEN");
});

test("audio trigger records bounded visual skew without controlling completion", () => {
  let time = 100;
  const played = [];
  const hooks = createProjectorAudioHooks({ play: (token) => played.push(token), now: () => time });
  const result = hooks.trigger("projector-fall", { visualTimestamp: 40 });
  assert.equal(result.skew, 60);
  assert.deepEqual(played, ["projector-fall"]);
});

test("normal shutdown stops optics and Table field before power-down and claims callbacks once", () => {
  const { lifecycle, calls, pending } = lifecycleHarness();
  let standby = 0;
  let poweredOff = 0;
  let complete = 0;
  lifecycle.shutdown({
    transitionId: "shutdown-1",
    standby: () => { standby += 1; return true; },
    poweredOff: () => { poweredOff += 1; return true; },
    complete: () => { complete += 1; },
  });
  assert.deepEqual(calls, ["audio:projector-fall", "optical-standby"]);
  pending.optical();
  assert.deepEqual(calls.slice(-1), ["table-field-stop"]);
  pending.field();
  assert.deepEqual(calls.slice(-2), ["audio:relay-off", "power-down:false"]);
  pending.power(); pending.power(); pending.field();
  assert.deepEqual({ standby, poweredOff, complete }, { standby: 1, poweredOff: 1, complete: 1 });
});

test("shutdown reversal invalidates stale completions and restores current power values", () => {
  const { lifecycle, calls, pending } = lifecycleHarness();
  let stale = 0;
  let restored = 0;
  lifecycle.shutdown({ transitionId: "shutdown-2", complete: () => { stale += 1; } });
  lifecycle.restore({ transitionId: "restart-2", complete: () => { restored += 1; } });
  pending.optical();
  assert.equal(calls.includes("table-field-stop"), false);
  assert.equal(calls.filter((call) => call === "optical-standby").length, 2);
  pending.restore(); pending.restore();
  assert.equal(stale, 0);
  assert.equal(restored, 1);
});

test("missing renderer degrades only the optical trace to powered standby", () => {
  const { lifecycle, calls, pending } = lifecycleHarness();
  let completed = 0;
  lifecycle.lowerToStandby({ transitionId: "standby-1", complete: () => { completed += 1; } });
  pending.optical(); pending.optical();
  assert.equal(completed, 1);
  assert.deepEqual(calls, ["optical-standby"]);
});

test("missing required layer settles optics and field before visible FAULT_SAFE status", () => {
  const { lifecycle, calls, pending } = lifecycleHarness();
  let complete = 0;
  lifecycle.fault({ transitionId: "fault-1", code: "MISSING_LAYER", complete: () => { complete += 1; } });
  pending.optical(); pending.field(); pending.fault(); pending.fault();
  assert.deepEqual(calls, [
    "optical-standby", "table-field-stop", "fault-safe", "status:MISSING_LAYER",
  ]);
  assert.equal(complete, 1);
});

test("power view refuses visible-field shutdown and reverses from current values", () => {
  const { view, mount, tick, settleOn } = powerHarness();
  settleOn();
  assert.equal(view.powerDown({ transitionId: "blocked" }).code, "TABLE_FIELD_VISIBLE");
  let off = 0;
  view.powerDown({ transitionId: "down", tableProjectionVisible: false, complete: () => { off += 1; } });
  tick(500);
  tick(650);
  const partial = view.getSnapshot().values.lens;
  assert.ok(partial > 0 && partial < 0.85);
  let restored = 0;
  view.restorePoweredOn({ transitionId: "up", complete: () => { restored += 1; } });
  tick(650);
  tick(950);
  assert.equal(off, 0);
  assert.equal(restored, 1);
  assert.equal(view.getSnapshot().values.lens, 0.85);
  assert.equal(mount.dataset.projectorPowerState, "POWERED_ON");
});

test("reduced-motion power-down settles within 150 ms", () => {
  const { view, tick, settleOn } = powerHarness({ reduced: true });
  settleOn();
  let complete = 0;
  view.powerDown({ transitionId: "reduced-down", tableProjectionVisible: false, complete: () => { complete += 1; } });
  tick(500);
  tick(650);
  assert.equal(complete, 1);
  assert.equal(view.getSnapshot().state, "POWERED_OFF");
});

test("controller owns once-only powered-off, reversal, standby, and fault events", () => {
  const { controller, pending, events, start } = controllerHarness();
  start();
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  pending.drawersSecured(); pending.toolChestParked(); pending.smartBoardRetracted();
  assert.equal(pending.tableStandby(), true);
  assert.equal(pending.tablePoweredOff(), true);
  assert.equal(pending.standby(), true);
  assert.equal(pending.poweredOff(), true);
  assert.equal(pending.poweredOff(), false);
  assert.equal(pending.complete(), true);
  assert.equal(controller.getSnapshot().workshop, "OFF");
  assert.equal(events.filter((event) => event.name === "projector:powered-off").length, 1);

  start();
  controller.reportProjectorRendererUnavailable();
  pending.lower();
  assert.equal(controller.getSnapshot().projector, "POWERED_ON");
  const fault = controller.reportProjectorFault({ code: "MISSING_LAYER", message: "Projector layer unavailable." });
  assert.equal(fault.code, "FAULT_SAFE");
  assert.equal(events.filter((event) => event.name === "projector:fault").length, 1);
  pending.fault();
  assert.equal(controller.getSnapshot().busy, false);
  controller.request({ action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true } });
  pending.fault();
  assert.equal(controller.getSnapshot().workshop, "OFF");
});

test("controller reverses SHUTTING_DOWN with a new transition and rejects stale shutdown claims", () => {
  const { controller, pending, events, start } = controllerHarness();
  start();
  const shutdown = controller.request({
    action: "REQUEST_POWER_OFF", input: "host", context: { applicationStateSecured: true },
  });
  pending.drawersSecured(); pending.toolChestParked(); pending.smartBoardRetracted();
  const staleStandby = pending.standby;
  const stalePoweredOff = pending.poweredOff;
  const restart = controller.request({
    action: "REQUEST_POWER_ON", input: "host", context: { assetsLoaded: true },
  });
  assert.equal(restart.code, "REVERSING");
  assert.notEqual(restart.transitionId, shutdown.transitionId);
  assert.equal(staleStandby(), false);
  assert.equal(stalePoweredOff(), false);
  assert.equal(pending.restore(), true);
  assert.equal(controller.getSnapshot().projector, "POWERED_ON");
  assert.equal(pending.tableBegin(), true);
  assert.equal(pending.tablePower(), true);
  assert.equal(pending.projection(), true);
  assert.equal(pending.tableStable(), true);
  assert.equal(pending.active(), true);
  assert.equal(pending.smartBoard(), true);
  assert.equal(pending.toolChest(), true);
  assert.equal(pending.ready(), true);
  assert.equal(controller.getSnapshot().workshop, "READY");
  assert.equal(events.filter((event) => event.name === "projector:powered-off").length, 0);
});
