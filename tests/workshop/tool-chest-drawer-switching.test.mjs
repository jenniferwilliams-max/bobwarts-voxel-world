import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("queues a different drawer behind canonical close completion", () => {
  const toggle = source.match(/function toggleEngineeringToolChestDrawer\(drawerName\)\{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(toggle, /engineeringToolChestPendingDrawer/);
  assert.match(toggle, /action:"CLOSE_DRAWER"/);
  assert.match(source, /var completionAccepted=complete\(\);[\s\S]*?state==="closing"[\s\S]*?requestQueuedEngineeringToolChestDrawer\(\)/);
});

test("rapid selection is latest-request-wins and stale work is token guarded", () => {
  assert.match(source, /engineeringToolChestPendingDrawer=\{\s*drawerName:drawerName,\s*token:engineeringToolChestDrawerSwitchToken\s*\}/);
  assert.match(source, /pending\.token!==engineeringToolChestDrawerSwitchToken/);
  assert.match(source, /function clearEngineeringToolChestDrawerSwitch\(\)\{[\s\S]*?engineeringToolChestDrawerSwitchToken\+=1;[\s\S]*?engineeringToolChestPendingDrawer=null;/);
});

test("reset, retraction, and non-ready lifecycle states clear queued switching", () => {
  assert.match(source, /snapshot\.workshop!=="READY"\)\{\s*clearEngineeringToolChestDrawerSwitch\(\);/);
  assert.match(source, /requestedState==="retracted"\)\{\s*clearEngineeringToolChestDrawerSwitch\(\);/);
  assert.match(source, /function resetEngineeringToolChest\(\)\{\s*clearEngineeringToolChestDrawerSwitch\(\);/);
});

test("all four physical drawers retain unique controls and content", () => {
  for (const drawer of ["ColorsMaterials", "Shapes", "PartsObjects", "Favorites"]) {
    assert.equal((source.match(new RegExp(`id="engineeringDrawer${drawer}Control"`, "g")) || []).length, 1);
    assert.equal((source.match(new RegExp(`id="engineeringDrawer${drawer}Content"`, "g")) || []).length, 1);
  }
});
