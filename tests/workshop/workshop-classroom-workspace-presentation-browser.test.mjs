import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const presentationSource = await readFile(new URL(
  "../../js/workshop/runtime/workshop-classroom-workspace-presentation.mjs",
  import.meta.url,
), "utf8");

test("installs one read-only classroom presentation bridge", () => {
  assert.equal((source.match(/workshop-classroom-workspace-presentation\.mjs/g) || []).length, 1);
  assert.match(source, /createWorkshopClassroomWorkspacePresentation\(\{/);
  assert.match(source, /window\.getWorkshopClassroomWorkspacePresentation=function\(\)/);
  assert.match(source, /return workshopClassroomWorkspacePresentation\.getSnapshot\(\)/);
});

test("observes the existing canonical camera, fit, reset, registration, and ruler owners", () => {
  assert.match(source, /return activeWorkshopEngineeringView/);
  assert.match(source, /return activeWorkshopFitSelection/);
  assert.match(source, /workshopClassroomWorkspaceReset\.getSnapshot\(\)/);
  assert.match(source, /workshopWorkstationRegistration\.getSnapshot\(\)/);
  assert.match(source, /workshopUnifiedWorkstationView\.getSnapshot\(\)/);
});

test("Mission restoration clears only presentation snapshot state", () => {
  assert.match(source,
    /requestedMode!=="workshop" && workshopClassroomWorkspacePresentation[\s\S]*?\.reset\(\)/);
});

test("the production closure adds no visible or imperative behavior", () => {
  assert.doesNotMatch(presentationSource,
    /document\.|window\.|requestAnimationFrame|setTimeout|dispatchEvent|classList|\.style|camera\.|renderer\.|THREE/);
  assert.doesNotMatch(presentationSource,
    /onclick|addEventListener|asset|platform|projector|smartboard/i);
});
