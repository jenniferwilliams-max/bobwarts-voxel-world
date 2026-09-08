import test from "node:test";
import assert from "node:assert/strict";
import {
  TOOL_CHEST_DRAWER_SECURITY,
  createToolChestDrawerSecurityView,
} from "../../js/workshop/toolchest/tool-chest-drawer-security-view.mjs";

function harness(initial = {}, { reduced = false } = {}) {
  const listeners = new Map();
  const states = { a: "closed", b: "closed", c: "closed", ...initial };
  const rendered = { a: states.a === "closed", b: states.b === "closed", c: states.c === "closed" };
  const drawers = Object.keys(states).map((name) => ({ dataset: { toolChestDrawer: name } }));
  const root = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const closed = [];
  const view = createToolChestDrawerSecurityView({
    root,
    drawers,
    getDrawerState: (name) => states[name],
    closeDrawer(name) { states[name] = "closing"; rendered[name] = false; closed.push(name); },
    isAtClosedEndpoint: (drawer) => rendered[drawer.dataset.toolChestDrawer],
    reducedMotion: () => reduced,
  });
  const finish = (name) => {
    states[name] = "closed";
    rendered[name] = true;
    const drawer = drawers.find((candidate) => candidate.dataset.toolChestDrawer === name);
    listeners.get("transitionend")?.({ target: drawer, propertyName: "transform" });
  };
  return { view, states, rendered, closed, finish };
}

test("declares the existing drawer endpoint timing contract", () => {
  assert.deepEqual(TOOL_CHEST_DRAWER_SECURITY, {
    property: "transform",
    normalDuration: 280,
    reducedDuration: 1,
  });
});

test("already-secured drawers complete without animation or delay", () => {
  const h = harness();
  let completions = 0;
  const result = h.view.secure({ transitionId: "closed", complete: () => { completions += 1; } });
  assert.equal(result.code, "ALREADY_SECURE");
  assert.equal(completions, 1);
  assert.deepEqual(h.closed, []);
});

test("closes only open or opening drawers and waits for every endpoint", () => {
  const h = harness({ a: "open", b: "opening", c: "closed" });
  let completions = 0;
  h.view.secure({ transitionId: "multiple", complete: () => { completions += 1; } });
  assert.deepEqual(h.closed, ["a", "b"]);
  h.finish("a");
  assert.equal(completions, 0);
  h.finish("b");
  assert.equal(completions, 1);
});

test("an already-closing drawer is observed without restarting it", () => {
  const h = harness({ a: "closing", b: "open" });
  h.rendered.a = false;
  let completed = false;
  h.view.secure({ transitionId: "closing", complete: () => { completed = true; } });
  assert.deepEqual(h.closed, ["b"]);
  h.finish("b");
  assert.equal(completed, false);
  h.finish("a");
  assert.equal(completed, true);
});

test("repeated requests are idempotent and completion is claimed once", () => {
  const h = harness({ a: "open" });
  let completions = 0;
  h.view.secure({ transitionId: "same", complete: () => { completions += 1; } });
  assert.equal(h.view.secure({ transitionId: "same", complete: () => { completions += 10; } }).code, "IDEMPOTENT");
  h.finish("a"); h.finish("a");
  assert.equal(completions, 1);
});

test("new transitions and cancellation reject stale completion", () => {
  const h = harness({ a: "open" });
  const completed = [];
  h.view.secure({ transitionId: "old", complete: () => completed.push("old") });
  h.view.cancel();
  h.view.secure({ transitionId: "new", complete: () => completed.push("new") });
  h.finish("a");
  assert.deepEqual(completed, ["new"]);
});

test("reduced motion preserves the endpoint callback", () => {
  const h = harness({ a: "open" }, { reduced: true });
  let completed = false;
  const result = h.view.secure({ transitionId: "reduced", complete: () => { completed = true; } });
  assert.equal(result.duration, 1);
  assert.equal(completed, false);
  h.finish("a");
  assert.equal(completed, true);
});
