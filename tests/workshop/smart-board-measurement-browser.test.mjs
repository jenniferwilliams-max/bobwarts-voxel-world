import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("mounts one compact noninteractive Measurement Assistant display with unique IDs", () => {
  const ids = [
    "engineeringSmartBoardMeasurementDisplay",
    "engineeringSmartBoardMeasurementUnit",
    "engineeringSmartBoardMeasurementSelection",
    "engineeringSmartBoardMeasurementWidth",
    "engineeringSmartBoardMeasurementLength",
    "engineeringSmartBoardMeasurementHeight",
    "engineeringSmartBoardMeasurementHint",
  ];
  ids.forEach((id) => assert.equal((source.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1));
  assert.match(source, /id="engineeringSmartBoardMeasurementDisplay"[^>]*aria-hidden="true"/);
  assert.match(source, /#engineeringSmartBoardMeasurementDisplay\{[\s\S]*?pointer-events:none;[\s\S]*?user-select:none;/);
  const displayMarkup = source.match(/<section id="engineeringSmartBoardMeasurementDisplay"[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(displayMarkup, /<(?:button|input|select|textarea|a)\b|tabindex=/);
});

test("shows only for powered-on Measurement Assistant and preserves authoritative controls", () => {
  assert.match(source, /#engineeringSmartBoard\[data-board-power="ready"\][\s\S]*?#engineeringSmartBoardScreen\[data-board-application="measurement-assistant"\][\s\S]*?#engineeringSmartBoardMeasurementDisplay\{[\s\S]*?display:grid;/);
  assert.equal((source.match(/id="workshopMeasurementAssistant"/g) || []).length, 1);
  assert.match(source, /id="workshopRestoreSelection"[^>]*onclick="restorePreviousWorkshopSelection\(\)"/);
});

test("wires exact source and target fields without introducing measurement calculations", () => {
  assert.match(source, /import\("\.\/js\/workshop\/smartboard\/smart-board-measurement-display\.mjs"\)/);
  assert.match(source, /createSmartBoardMeasurementDisplay\(\{[\s\S]*?assistant:document\.getElementById\("workshopMeasurementAssistant"\)[\s\S]*?selection:document\.getElementById\("engineeringSmartBoardMeasurementSelection"\)/);
  assert.match(source, /updateWorkshopMeasurementAssistant\(\)[\s\S]*?workshopSmartBoardMeasurementDisplay\.sync\(\)/);
  assert.match(source, /addEventListener\("smartboard:app-changed"[\s\S]*?workshopSmartBoardMeasurementDisplay\.reset\(\)/);
});

test("uses no deferred Smart Board or Measurement Assistant image", () => {
  assert.doesNotMatch(source, /engineering-smart-board-production-v4-measurement-assistant\.png/);
  assert.doesNotMatch(source, /assets\/images\/workshop\/production\/measurement-assistant\//);
});
