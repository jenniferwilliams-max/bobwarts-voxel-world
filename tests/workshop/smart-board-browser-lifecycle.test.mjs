import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("wires the production Smart Board lifecycle instead of timer test doubles", () => {
  assert.match(source, /import\("\.\/js\/workshop\/smartboard\/smart-board-lifecycle-view\.mjs"\)/);
  assert.match(source, /createSmartBoardLifecycleView\(\{[\s\S]*?root:document\.getElementById\("engineeringSmartBoard"\)[\s\S]*?cabinet:document\.getElementById\("engineeringSmartBoardCabinet"\)[\s\S]*?screen:document\.getElementById\("engineeringSmartBoardScreen"\)/);
  assert.match(source, /activateSmartBoard:function\(transition\)\{[\s\S]*?workshopSmartBoardLifecycleView\.activate\(transition\)/);
  assert.match(source, /retractSmartBoard:function\(transition\)\{[\s\S]*?workshopSmartBoardLifecycleView\.retract\(transition\)/);
  assert.doesNotMatch(source, /workshopStartupTestDouble\.activateSmartBoard/);
  assert.doesNotMatch(source, /workshopShutdownTestDouble\.retractSmartBoard/);
});

test("declares accessible, noninteractive mechanical and power visual states", () => {
  assert.match(source, /data-board-mechanical="retracted" data-board-power="powered-off" aria-hidden="true"/);
  assert.match(source, /data-board-mechanical="extending"[^}]*#engineeringSmartBoardCabinet[\s\S]*?translateX\(var\(--smart-board-extended-x\)\)/);
  assert.match(source, /data-board-power="powering-on"[^}]*#engineeringSmartBoardScreen[\s\S]*?opacity:1/);
  assert.match(source, /#engineeringSmartBoard\{[\s\S]*?pointer-events:none;[\s\S]*?user-select:none;/);
  assert.match(source, /@media \(prefers-reduced-motion:reduce\)[\s\S]*?#engineeringSmartBoardCabinet[\s\S]*?transition-duration:1ms/);
});

test("keeps the application surface HTML-only and the approved asset singular", () => {
  const approved = "assets/images/workshop/production/engineering-smart-board/engineering-smart-board-production-v2-extended.png";
  assert.equal(source.split(approved).length - 1, 1);
  assert.match(source, /<div id="engineeringSmartBoardScreen" data-board-application="none" aria-hidden="true">[\s\S]*?engineeringSmartBoardMeasurementDisplay/);
  assert.doesNotMatch(source, /engineering-smart-board-production-v4-measurement-assistant\.png/);
});
