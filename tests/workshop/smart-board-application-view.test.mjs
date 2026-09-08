import test from "node:test";
import assert from "node:assert/strict";
import {
  createSmartBoardApplicationView,
  SMART_BOARD_APPLICATIONS,
} from "../../js/workshop/smartboard/smart-board-application-view.mjs";

function harness() {
  const frames = new Map();
  let frameId = 0;
  const current = new Set(["startup-1", "shutdown-1"]);
  const screen = { dataset: { boardApplication: "none" } };
  const view = createSmartBoardApplicationView({
    screen,
    isTransitionCurrent: (id) => current.has(id),
    requestFrame(callback) {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) { frames.delete(id); },
  });
  const flushFrame = () => {
    const [id, callback] = frames.entries().next().value || [];
    if (!callback) return false;
    frames.delete(id);
    callback();
    return true;
  };
  return { screen, view, current, flushFrame, frames };
}

test("application activation settles only after two rendered frames", () => {
  const { screen, view, flushFrame } = harness();
  let completed = 0;
  const result = view.activate({ transitionId: "startup-1", complete: () => { completed += 1; } });
  assert.equal(result.code, "ACCEPTED");
  assert.equal(screen.dataset.boardApplication, SMART_BOARD_APPLICATIONS.measurementAssistant);
  assert.equal(completed, 0);
  flushFrame();
  assert.equal(completed, 0);
  flushFrame();
  assert.equal(completed, 1);
});

test("clear replaces activation, rejects stale frames, and is idempotent", () => {
  const { screen, view, flushFrame } = harness();
  let activated = 0;
  let cleared = 0;
  view.activate({ transitionId: "startup-1", complete: () => { activated += 1; } });
  const clearing = view.clear({ transitionId: "shutdown-1", complete: () => { cleared += 1; } });
  assert.equal(clearing.code, "REPLACING");
  assert.equal(screen.dataset.boardApplication, SMART_BOARD_APPLICATIONS.none);
  flushFrame();
  flushFrame();
  assert.equal(activated, 0);
  assert.equal(cleared, 1);
  assert.equal(view.clear({ transitionId: "shutdown-1", complete: () => { cleared += 1; } }).code, "IDEMPOTENT");
  assert.equal(cleared, 1);
});

test("cancelled and noncurrent application requests cannot settle", () => {
  const { view, current, flushFrame, frames } = harness();
  let completed = 0;
  view.activate({ transitionId: "startup-1", complete: () => { completed += 1; } });
  current.delete("startup-1");
  flushFrame();
  flushFrame();
  assert.equal(completed, 0);
  assert.equal(view.cancel().code, "CANCELLED");
  assert.equal(frames.size, 0);
});
