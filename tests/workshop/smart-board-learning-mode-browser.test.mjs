import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const learningModeSource = readFileSync(
  new URL("../../js/workshop/smartboard/smart-board-learning-mode-view.mjs", import.meta.url),
  "utf8",
);

test("mounts unique right-panel Learning Mode controls with native button behavior", () => {
  ["workshopEnterLearningMode", "workshopExitLearningMode", "workshopMeasurementLearningStatus"]
    .forEach((id) => assert.equal((source.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1));
  assert.match(source, /id="workshopEnterLearningMode"[^>]*type="button"[^>]*>LEARN ABOUT THESE MEASUREMENTS<\/button>/);
  assert.match(source, /id="workshopExitLearningMode"[^>]*type="button"[^>]*>BACK TO MEASUREMENTS<\/button>/);
  assert.match(source, /id="workshopMeasurementLearningStatus"[^>]*aria-live="polite"/);
  assert.match(source, /#workshopEnterLearningMode,[\s\S]*?#workshopExitLearningMode\{[\s\S]*?min-height:44px;/);
});

test("keeps the Smart Board Learning Mode display read-only and outside focus", () => {
  const markup = source.match(/<section id="engineeringSmartBoardLearningDisplay"[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /<(?:button|input|select|textarea|a)\b|tabindex=/);
  assert.match(source, /#engineeringSmartBoardLearningDisplay\{[\s\S]*?pointer-events:none;[\s\S]*?user-select:none;/);
});

test("renders approved dimensional coaching from authoritative fields", () => {
  assert.match(source, /WIDTH — SIDE TO SIDE/);
  assert.match(source, /LENGTH — FRONT TO BACK/);
  assert.match(source, /HEIGHT — BOTTOM TO TOP/);
  assert.match(learningModeSource, /These measurements describe the full selected group\./);
  assert.match(source, /createSmartBoardLearningModeView\(\{[\s\S]*?assistant:document\.getElementById\("workshopMeasurementAssistant"\)[\s\S]*?width:document\.getElementById\("workshopMeasurementAssistantWidth"\)/);
});

test("wires controller entry, exit, cancellation, and rendered completion drivers", () => {
  assert.match(source, /import\("\.\/js\/workshop\/smartboard\/smart-board-learning-mode-view\.mjs"\)/);
  assert.match(source, /action:"ENTER_LEARNING_MODE"/);
  assert.match(source, /action:"EXIT_LEARNING_MODE"/);
  assert.match(source, /renderLearningMode:function\(transition\)\{[\s\S]*?workshopSmartBoardLearningModeView\.enter\(transition\)/);
  assert.match(source, /clearLearningMode:function\(transition\)\{[\s\S]*?workshopSmartBoardLearningModeView\.exit\(transition\)/);
  assert.match(source, /cancelLearningMode:function\(\)\{[\s\S]*?workshopSmartBoardLearningModeView\.cancel\(\)/);
});

test("adds no audio, scoring, rewards, questions, persistence, or assets", () => {
  assert.doesNotMatch(learningModeSource, /speechSynthesis|Audio\(|localStorage|score|credit|reward|question/i);
  assert.doesNotMatch(learningModeSource, /assets\//);
});
