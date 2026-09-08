import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("loads one isolated in-memory draft owner", () => {
  assert.match(source, /import\("\.\/js\/workshop\/persistence\/workshop-draft-controller\.mjs"\)/);
  assert.match(source, /createWorkshopDraftController\(\{\s*history:workshopEditHistory/);
  assert.doesNotMatch(source, /workshopDraftController[\s\S]{0,120}(localStorage|sessionStorage)/);
});

test("Mission restoration parks exact Workshop objects before restoring Builder", () => {
  const restore = source.slice(
    source.indexOf("function restoreBuilderSession()"),
    source.indexOf("function setWorkshopMeasurementUnit")
  );
  assert.match(restore, /workshopDraftController\.capture\(blocks,captureClaim\)/);
  assert.match(restore, /blocks\.forEach\(function\(block\)\{ scene\.remove\(block\); \}\)/);
  assert.match(restore, /builderSessionSnapshot\.blocks\.forEach/);
  assert.doesNotMatch(restore, /clearActiveWorkshopObjects\(\)/);
});

test("re-entry remounts exact draft references without clearing committed history", () => {
  const begin = source.slice(
    source.indexOf("function beginBlankWorkshopSession()"),
    source.indexOf("function restoreBuilderSession()")
  );
  assert.match(begin, /workshopDraftController\.restore\(restoreClaim\)/);
  assert.match(begin, /scene\.add\(block\);\s*blocks\.push\(block\)/);
  assert.match(begin, /resetWorkshopEditFoundation\(\{preserveHistory:true\}\)/);
});

test("canonical shutdown and Mission mode ownership remain unchanged", () => {
  assert.match(source, /REQUEST_POWER_OFF/);
  assert.match(source, /applyWorkspaceModeVisuals\("mission",transition\.complete\)/);
  assert.match(source, /else if\(currentWorkspaceMode==="workshop"\)[\s\S]*?restoreBuilderSession\(\)/);
});
