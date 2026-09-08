import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("browser wires real drawer security without the shutdown timer double", () => {
  assert.match(source, /import\("\.\/js\/workshop\/toolchest\/tool-chest-drawer-security-view\.mjs"\)/);
  assert.match(source, /createToolChestDrawerSecurityView\(\{[\s\S]*?root:document\.getElementById\("engineeringToolChest"\)[\s\S]*?closeDrawer:closeEngineeringToolChestDrawer/);
  assert.match(source, /secureDrawers:function\(transition\)\{[\s\S]*?workshopSmartBoardLifecycleView\.cancel\(\);[\s\S]*?return workshopToolChestDrawerSecurityView\.secure\(transition\);\s*\}/);
  assert.doesNotMatch(source, /workshopShutdownTestDouble\.secureDrawers/);
  assert.doesNotMatch(source, /closeAllEngineeringToolChestDrawers\(true\);\s*return workshopShutdownTestDouble\.secureDrawers/);
});

test("existing manual drawer presentation and completion hooks remain", () => {
  assert.match(source, /function closeEngineeringToolChestDrawer\(drawerName,immediate\)/);
  assert.match(source, /drawer\.addEventListener\("transitionend",function\(event\)/);
  assert.match(source, /workshopDrawerTransitionCompletions\[transition\.uiDrawer\]=transition\.complete/);
  assert.match(source, /transition:transform 280ms cubic-bezier\(\.2,\.72,\.2,1\)/);
});
