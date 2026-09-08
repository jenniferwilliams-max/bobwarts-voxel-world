import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("browser replaces the final-ready timer double with rendered settlement", () => {
  assert.match(source, /import\("\.\/js\/workshop\/runtime\/workshop-ready-render-settlement\.mjs"\)/);
  assert.match(source, /createWorkshopReadyRenderSettlement\(\{[\s\S]*?isRenderedReady:function\(\)[\s\S]*?cabinetState!=="expanded"/);
  assert.match(source, /settleWorkshopReady:function\(transition\)\{\s*return workshopReadyRenderSettlement\.settle\(transition\);\s*\}/);
  assert.doesNotMatch(source, /workshopStartupTestDouble\.settleWorkshopReady/);
});

test("Smart Board lifecycle is independent of final-ready render settlement", () => {
  assert.match(source, /return workshopSmartBoardLifecycleView\.activate\(transition\)/);
  assert.match(source, /return workshopSmartBoardLifecycleView\.retract\(transition\)/);
  assert.doesNotMatch(source, /workshopStartupTestDouble\.activateSmartBoard/);
  assert.doesNotMatch(source, /workshopShutdownTestDouble\.retractSmartBoard/);
});
