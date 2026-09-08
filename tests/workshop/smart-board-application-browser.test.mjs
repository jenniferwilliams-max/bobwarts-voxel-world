import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("Smart Board screen is connected to the application render bridge", () => {
  assert.match(source, /<div id="engineeringSmartBoardScreen" data-board-application="none" aria-hidden="true">/);
  assert.match(source, /import\("\.\/js\/workshop\/smartboard\/smart-board-application-view\.mjs"\)/);
  assert.match(source, /createSmartBoardApplicationView\(\{[\s\S]*?screen:document\.getElementById\("engineeringSmartBoardScreen"\)/);
  assert.match(source, /activateSmartBoardApplication:function\(transition\)\{[\s\S]*?workshopSmartBoardApplicationView\.activate\(transition\)/);
  assert.match(source, /clearSmartBoardApplication:function\(transition\)\{[\s\S]*?workshopSmartBoardApplicationView\.clear\(transition\)/);
});

test("authoritative Measurement Assistant remains separate from the read-only application layer", () => {
  assert.equal((source.match(/id="workshopMeasurementAssistant"/g) || []).length, 1);
  assert.match(source, /<aside id="workshopRightPanelShell"[\s\S]*?<section id="workshopMeasurementAssistant"/);
  assert.match(source, /<div id="engineeringSmartBoardScreen"[^>]*>[\s\S]*?<section id="engineeringSmartBoardMeasurementDisplay"/);
});
