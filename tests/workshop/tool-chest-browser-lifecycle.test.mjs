import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("browser wires one real Tool Chest lifecycle view to both controller directions", () => {
  assert.match(source, /import\("\.\/js\/workshop\/toolchest\/tool-chest-lifecycle-view\.mjs"\)/);
  assert.match(source, /createToolChestLifecycleView\(\{[\s\S]*?root:document\.getElementById\("engineeringToolChest"\)[\s\S]*?cabinet:document\.getElementById\("engineeringToolChestCabinet"\)/);
  assert.match(source, /deployToolChest:function\(transition\)\{\s*return workshopToolChestLifecycleView\.deploy\(transition\);\s*\}/);
  assert.match(source, /parkToolChest:function\(transition\)\{\s*return workshopToolChestLifecycleView\.park\(transition\);\s*\}/);
  assert.doesNotMatch(source, /workshopStartupTestDouble\.deployToolChest/);
  assert.doesNotMatch(source, /workshopShutdownTestDouble\.parkToolChest/);
});

test("tracked Tool Chest endpoints and accessibility presentation remain intact", () => {
  assert.match(source, /#engineeringToolChestCabinet\{[\s\S]*?transform:translateX\(calc\(100% - 10px\)\);[\s\S]*?transition:transform 280ms cubic-bezier\(\.2,\.72,\.2,1\);/);
  assert.match(source, /#engineeringToolChest\[data-cabinet-state="expanded"\] #engineeringToolChestCabinet\{\s*transform:translateX\(0\);/);
  assert.match(source, /handle\.setAttribute\("aria-expanded",isExpanded \? "true" : "false"\)/);
  assert.match(source, /control\.tabIndex=requestedState==="expanded" \? 0 : -1/);
});
