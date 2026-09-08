import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSHOP_READY_RENDER_SETTLEMENT,
  createWorkshopReadyRenderSettlement,
} from "../../js/workshop/runtime/workshop-ready-render-settlement.mjs";

function harness({ ready = true, current = true, reduced = false } = {}) {
  const frames = [];
  const cancelled = new Set();
  const state = { ready, current };
  const view = createWorkshopReadyRenderSettlement({
    requestFrame(callback) {
      const frame = { callback };
      frames.push(frame);
      return frame;
    },
    cancelFrame(frame) { cancelled.add(frame); },
    isRenderedReady: () => state.ready,
    isTransitionCurrent: () => state.current,
    reducedMotion: () => reduced,
  });
  const runFrame = () => {
    const frame = frames.shift();
    assert.ok(frame, "expected a queued render frame");
    frame.callback();
    return frame;
  };
  return { view, frames, cancelled, state, runFrame };
}

test("declares a two-frame rendered-stability boundary", () => {
  assert.deepEqual(WORKSHOP_READY_RENDER_SETTLEMENT, { requiredStableFrames: 2 });
});

test("settles only after two consecutive rendered-ready frames", () => {
  const h = harness();
  let completions = 0;
  h.view.settle({ transitionId: "ready-1", complete: () => { completions += 1; } });
  h.runFrame();
  assert.equal(completions, 0);
  h.runFrame();
  assert.equal(completions, 1);
  assert.equal(h.frames.length, 0);
});

test("holds safely until the rendered endpoint is stable", () => {
  const h = harness({ ready: false });
  let completed = false;
  h.view.settle({ transitionId: "late", complete: () => { completed = true; } });
  h.runFrame();
  h.state.ready = true;
  h.runFrame();
  assert.equal(completed, false);
  h.state.ready = false;
  h.runFrame();
  h.state.ready = true;
  h.runFrame();
  h.runFrame();
  assert.equal(completed, true);
});

test("repeated active and completed commands are idempotent", () => {
  const h = harness();
  let completions = 0;
  h.view.settle({ transitionId: "same", complete: () => { completions += 1; } });
  assert.equal(h.view.settle({ transitionId: "same", complete: () => { completions += 10; } }).code, "IDEMPOTENT");
  h.runFrame(); h.runFrame();
  assert.equal(completions, 1);
  assert.equal(h.view.settle({ transitionId: "same", complete: () => { completions += 10; } }).code, "ALREADY_SETTLED");
  assert.equal(h.frames.length, 0);
});

test("cancellation and newer transitions reject stale frame callbacks", () => {
  const h = harness();
  const completions = [];
  h.view.settle({ transitionId: "old", complete: () => completions.push("old") });
  const stale = h.frames.shift();
  assert.equal(h.view.cancel().code, "CANCELLED");
  stale.callback();
  h.view.settle({ transitionId: "new", complete: () => completions.push("new") });
  h.runFrame(); h.runFrame();
  assert.deepEqual(completions, ["new"]);
});

test("invalidated transitions stop without settling or rescheduling", () => {
  const h = harness({ current: false });
  let completed = false;
  h.view.settle({ transitionId: "stale", complete: () => { completed = true; } });
  h.runFrame();
  assert.equal(completed, false);
  assert.equal(h.frames.length, 0);
  assert.equal(h.view.getSnapshot().transitionId, null);
});

for (const reason of ["shutdown", "reversal", "restart", "fault"]) {
  test(`${reason} invalidation rejects the stale render settlement`, () => {
    const h = harness();
    const completions = [];
    h.view.settle({ transitionId: `old-${reason}`, complete: () => completions.push("old") });
    h.state.current = false;
    h.runFrame();
    assert.deepEqual(completions, []);
    assert.equal(h.frames.length, 0);
    h.state.current = true;
    h.view.settle({ transitionId: `new-${reason}`, complete: () => completions.push("new") });
    h.runFrame(); h.runFrame();
    assert.deepEqual(completions, ["new"]);
  });
}

test("reduced motion preserves the same dependency and render callbacks", () => {
  const h = harness({ reduced: true });
  let completed = false;
  const result = h.view.settle({ transitionId: "reduced", complete: () => { completed = true; } });
  assert.equal(result.reducedMotion, true);
  h.runFrame();
  assert.equal(completed, false);
  h.runFrame();
  assert.equal(completed, true);
});
