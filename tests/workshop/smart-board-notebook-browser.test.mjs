import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const notebookSource = readFileSync(
  new URL("../../js/workshop/smartboard/smart-board-notebook-view.mjs", import.meta.url),
  "utf8",
);

test("mounts one separate read-only Engineering Notebook application section", () => {
  const id = "engineeringSmartBoardNotebookDisplay";
  assert.equal((source.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1);
  const screen = source.match(/<div id="engineeringSmartBoardScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || "";
  assert.match(screen, new RegExp(`id="${id}"`));
  const markup = source.match(/<section id="engineeringSmartBoardNotebookDisplay"[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(markup, /hidden aria-hidden="true"/);
  assert.doesNotMatch(markup, /<(?:button|input|select|textarea|a)\b|tabindex=/);
  assert.match(source, /#engineeringSmartBoardNotebookDisplay\{[\s\S]*?pointer-events:none;[\s\S]*?user-select:none;/);
});

test("adds unique native right-panel controls and connects the approved lifecycle", () => {
  for (const [id, label] of [
    ["workshopOpenEngineeringNotebook", "📓 ENGINEERING NOTEBOOK"],
    ["workshopBackToMeasurementsFromNotebook", "📐 MEASUREMENTS"],
  ]) {
    assert.equal((source.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1);
    const button = source.match(new RegExp(`<button id="${id}"[^>]*>${label}<\\/button>`))?.[0] || "";
    assert.match(button, /type="button"/);
    assert.match(button, /hidden/);
    assert.match(button, /disabled/);
    assert.match(button, /aria-pressed="false"/);
    assert.match(button, /onclick=/);
  }
});

test("defines authoritative Notebook source and target fields without dimension calculations", () => {
  assert.match(notebookSource, /target\.selection\.textContent = source\.selection\.textContent/);
  assert.match(notebookSource, /target\.unit\.textContent = source\.unit\.textContent/);
  assert.match(notebookSource, /target\.width\.textContent = source\.width\.textContent/);
  assert.match(notebookSource, /target\.length\.textContent = source\.length\.textContent/);
  assert.match(notebookSource, /target\.height\.textContent = source\.height\.textContent/);
  assert.match(notebookSource, /This design record describes the full selected group\./);
  assert.doesNotMatch(notebookSource, /Box3|Vector3|boundingBox|getBoundingClientRect|parseFloat/);
});

test("connects only the approved Notebook application lifecycle", () => {
  assert.match(source, /import\("\.\/js\/workshop\/smartboard\/smart-board-notebook-view\.mjs"\)/);
  assert.match(source, /action:"OPEN_NOTEBOOK"/);
  assert.match(source, /action:"SELECT_APPLICATION"/);
  assert.match(source, /payload:\{application:"MEASUREMENT_ASSISTANT"\}/);
  assert.doesNotMatch(notebookSource, /measurement:notebook-opened|smartboard:app-changed|dispatchEvent|CustomEvent/);
  assert.doesNotMatch(notebookSource, /ENGINEERING_NOTEBOOK|APPLICATION_SWITCHING/);
  assert.doesNotMatch(source, /application-switching-menu|SELECT ENGINEERING NOTEBOOK/i);
});

test("adds no editing, prompts, persistence, audio, scoring, rewards, or assets", () => {
  assert.doesNotMatch(notebookSource, /speechSynthesis|Audio\(|localStorage|sessionStorage|indexedDB|score|credit|reward|question|prompt|assets\//i);
  const markup = source.match(/<section id="engineeringSmartBoardNotebookDisplay"[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(markup, /contenteditable|<textarea|<input|<form/);
});
