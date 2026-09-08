import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("loads one active boundary owner and exposes read-only integration", () => {
  assert.equal((source.match(/import\("\.\/js\/workshop\/runtime\/workshop-active-workspace-boundary\.mjs"\)/g) || []).length, 1);
  assert.match(source, /createWorkshopActiveWorkspaceBoundary\(\)/);
  assert.match(source, /window\.getWorkshopActiveWorkspaceBoundary=function\(\)/);
});

test("Home and manual zoom commit Grid, ruler, frame, and placement range together", () => {
  assert.match(source, /applyWorkshopCadGridPresentation\(workshopHomeGridWorkspace,false\)[\s\S]*?setWorkshopVisibleRulerRange\(workshopHomeGridWorkspace\)[\s\S]*?commitWorkshopActiveWorkspaceBoundary\(workshopHomeGridWorkspace,"HOME"\)/);
  assert.match(source, /applyWorkshopCadGridPresentation\(range,false\)[\s\S]*?setWorkshopVisibleRulerRange\(range\)[\s\S]*?commitWorkshopActiveWorkspaceBoundary\(range,"MANUAL_ZOOM"\)/);
  const start = source.indexOf("function commitWorkshopActiveWorkspaceBoundary");
  const end = source.indexOf("function getWorkshopRulerAxisRange", start);
  const commit = source.slice(start, end);
  assert.match(commit, /workshopActiveWorkspaceBoundary\.update\(normalized,source\)/);
  assert.match(commit, /updateWorkshopActiveWorkspaceFrame\(snapshot\)/);
});

test("active frame is noninteractive and the legacy stage frame is not scaled", () => {
  assert.match(source, /workshopActiveWorkspaceFrame\.raycast=function\(\)\{\}/);
  assert.doesNotMatch(source, /workshopStageFrame\.scale\./);
});

test("inspection presentation cannot expand active placement permission", () => {
  const start = source.indexOf("function restoreWorkshopFullCadGrid");
  const end = source.indexOf("function calculateWorkshopManualVisibleRulerRange", start);
  const restore = source.slice(start, end);
  assert.match(restore, /workshopActiveWorkspaceBoundary\.read\(\)/);
  assert.match(restore, /applyWorkshopCadGridPresentation\(active,false\)/);
});

test("Mission, shutdown, and fault clear Workshop-only bounds", () => {
  assert.match(source, /snapshot\.workshop==="SHUTTING_DOWN" \|\|[\s\S]*?resetWorkshopActiveWorkspaceBoundary\(\)/);
  assert.match(source, /if\(requestedMode!=="workshop"\)\{[\s\S]*?resetWorkshopActiveWorkspaceBoundary\(\);[\s\S]*?restoreWorkshopFullCadGrid\(\)/);
});
