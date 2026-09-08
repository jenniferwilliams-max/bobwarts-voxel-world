import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("places one labeled Smart Board Apps launcher in the authoritative Measurement Assistant", () => {
  const assistant = source.match(/<section id="workshopMeasurementAssistant"[\s\S]*?<\/section>/)?.[0] || "";
  assert.equal((source.match(/id="workshopSmartBoardAppsLabel"/g) || []).length, 1);
  assert.equal((source.match(/id="workshopSmartBoardAppsStatus"/g) || []).length, 1);
  assert.match(assistant, /id="workshopMeasurementNotebookControls" role="group" aria-labelledby="workshopSmartBoardAppsLabel"/);
  assert.match(assistant, /id="workshopSmartBoardAppsLabel">SMART BOARD APPS</);
  assert.match(assistant, /id="workshopSmartBoardAppsStatus" role="status" aria-live="polite" aria-atomic="true"/);
});

test("reuses exactly one native Measurements and Notebook button in approved order", () => {
  const controls = source.match(/<div id="workshopMeasurementNotebookControls"[\s\S]*?<\/div>/)?.[0] || "";
  const measurementsId = "workshopBackToMeasurementsFromNotebook";
  const notebookId = "workshopOpenEngineeringNotebook";
  assert.equal((source.match(new RegExp(`id="${measurementsId}"`, "g")) || []).length, 1);
  assert.equal((source.match(new RegExp(`id="${notebookId}"`, "g")) || []).length, 1);
  assert.ok(controls.indexOf(measurementsId) < controls.indexOf(notebookId));
  assert.match(controls, /<button id="workshopBackToMeasurementsFromNotebook" type="button" aria-pressed="false" hidden disabled[^>]*>📐 MEASUREMENTS<\/button>/);
  assert.match(controls, /<button id="workshopOpenEngineeringNotebook" type="button" aria-pressed="false" hidden disabled[^>]*>📓 ENGINEERING NOTEBOOK<\/button>/);
});

test("provides 44px responsive two-column touch presentation without switching animation", () => {
  const css = source.match(/#workshopMeasurementNotebookControls\{[\s\S]*?#workshopOpenEngineeringNotebook\[hidden\],[\s\S]*?\}/)?.[0] || "";
  assert.match(css, /grid-template-columns:repeat\(auto-fit,minmax\(min\(132px,100%\),1fr\)\)/);
  assert.match(css, /#workshopOpenEngineeringNotebook,[\s\S]*?#workshopBackToMeasurementsFromNotebook\{[\s\S]*?min-height:44px/);
  assert.doesNotMatch(css, /animation:|transition:/);
});

test("connects one launcher view and bridge while leaving dashboard placeholders untouched", () => {
  assert.equal((source.match(/import\("\.\/js\/workshop\/smartboard\/smart-board-application-launcher-view\.mjs"\)/g) || []).length, 1);
  assert.equal((source.match(/import\("\.\/js\/workshop\/smartboard\/smart-board-application-launcher-bridge\.mjs"\)/g) || []).length, 1);
  assert.equal((source.match(/createSmartBoardApplicationLauncherView\(\{/g) || []).length, 1);
  assert.equal((source.match(/createSmartBoardApplicationLauncherBridge\(\{/g) || []).length, 1);
  assert.match(source, /controlsManagedExternally:true/);
  assert.match(source, /<button type="button" disabled>Engineering Notebook<\/button>/);
  assert.doesNotMatch(source, /application-launcher-menu|launcher-close/i);
});
