import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createToolChestPartsObjectsAdapter } from
  "../../js/workshop/toolchest/tool-chest-parts-objects-adapter.mjs";

const makeButton = (key, label, category) => ({
  dataset: { objectLibraryKey: key },
  textContent: label,
  closest: () => ({ previousElementSibling: { textContent: `${category} ▶` } }),
});

function harness({ mission = ["tree"] } = {}) {
  const buttons = [
    makeButton("building", "🏢 Add Building", "Magic"),
    makeButton("tree", "🌲 Add Tree", "Nature"),
    makeButton("plantCell", "🌱 Start Plant Cell", "Cells"),
  ];
  const calls = [];
  const actions = {
    building: () => calls.push("building"),
    tree: () => calls.push("tree"),
  };
  const adapter = createToolChestPartsObjectsAdapter({
    sourceRoot: { querySelectorAll: () => buttons },
    actions,
    getMissionKeys: () => mission,
  });
  return { adapter, calls };
}

test("uses the approved allowlist and keeps mission objects first deterministically", () => {
  const { adapter } = harness();
  const items = adapter.list();
  assert.deepEqual(items.map(({ key }) => key), ["tree", "building", "plantCell"]);
  assert.equal(items[0].missionRelevant, true);
  assert.deepEqual(items.map(({ symbol }) => symbol), ["🌲", "🏢", "🌱"]);
  assert.equal(items[2].supported, false);
  assert.match(items[2].disabledReason, /mission-specific setup/i);
  assert.ok(Object.isFrozen(items));
  assert.ok(Object.isFrozen(items[0]));
});

test("one activation calls one existing action and intentional repeats remain available", () => {
  const { adapter, calls } = harness();
  assert.equal(adapter.place("building").code, "PLACED");
  assert.equal(adapter.place("building").code, "PLACED");
  assert.deepEqual(calls, ["building", "building"]);
});

test("unsupported and unknown objects fail closed without executing anything", () => {
  const { adapter, calls } = harness({ mission: ["plantCell"] });
  assert.equal(adapter.place("plantCell").code, "OBJECT_UNAVAILABLE");
  assert.equal(adapter.place("not-a-tool").code, "OBJECT_UNAVAILABLE");
  assert.deepEqual(calls, []);
});

test("adapter contains no dynamic execution or placement implementation", () => {
  const source = readFileSync(new URL(
    "../../js/workshop/toolchest/tool-chest-parts-objects-adapter.mjs",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|new\s+Function/);
  assert.doesNotMatch(source, /new\s+THREE\.|addBlock\s*\(/);
});
