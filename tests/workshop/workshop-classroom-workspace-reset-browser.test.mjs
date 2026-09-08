import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("suppresses only Smart Board and Projector presentation under the Workshop reset owner", () => {
  assert.match(source, /body\.workshopMode\.workshopClassroomWorkspaceReset[^}]*#workshopProjectorMount,[\s\S]*?body\.workshopMode\.workshopClassroomWorkspaceReset[^}]*#engineeringSmartBoard\{[\s\S]*?visibility:hidden !important;/);
  assert.doesNotMatch(source, /workshopClassroomWorkspaceReset[^}]*#(?:viewCubeBox|workshopEngineeringViewControls|workshopMeasurementAssistant|engineeringToolChest|workshopDashboard)/);
});

test("keeps background and machinery dependencies while selecting a stable neutral presentation", () => {
  assert.match(source, /workshopRoomBackgroundTexture &&[\s\S]*?workshopPoweredOffProjectorReady &&[\s\S]*?workshopPoweredOffTableReady/);
  assert.match(source, /workshopClassroomNeutralBackground=new THREE\.Color\(0x07131c\)/);
  assert.equal((source.match(/workshopClassroomWorkspaceReset\.selectBackground\(/g) || []).length, 3);
  assert.match(source, /workshopClassroomWorkspaceReset\.activate\(\)[\s\S]*?classList\.toggle\("workshopMode"/);
  assert.match(source, /classList\.toggle\("missionMode"[\s\S]*?workshopClassroomWorkspaceReset\.deactivate\(\)/);
  assert.match(source, /if\(currentWorkspaceMode==="workshop"\)\{[\s\S]*?workshopClassroomWorkspaceReset\.activate\(\);[\s\S]*?scene\.background=workshopClassroomWorkspaceReset\.selectBackground/);
});

test("registers and exposes the shared protected build zone from approved controls", () => {
  assert.match(source, /createWorkshopClassroomWorkspaceReset\(\{[\s\S]*?stage:document\.getElementById\("workshopViewportStage"\)/);
  for (const id of [
    "viewCubeBox",
    "workshopEngineeringViewControls",
    "workshopMeasurementAssistant",
    "engineeringToolChest",
    "workshopDashboard",
  ]) assert.match(source, new RegExp(`document\\.getElementById\\("${id}"\\)`));
  assert.match(source, /window\.getWorkshopProtectedBuildZone=function\(\)/);
});

test("adds View controls and Tool Chest to the existing Table protection list", () => {
  const tableMount = source.match(/createPoweredOffTableCompositor\(\{[\s\S]*?\n\s*\}\);/)?.[0] || "";
  assert.match(tableMount, /document\.getElementById\("viewCubeBox"\)/);
  assert.match(tableMount, /document\.getElementById\("workshopEngineeringViewControls"\)/);
  assert.match(tableMount, /document\.getElementById\("engineeringToolChest"\)/);
  assert.match(tableMount, /getStudentObjects:function\(\)\{ return blocks; \}/);
  assert.match(tableMount, /getCadDimensionGroup:function\(\)\{ return workshopCadDimensionGroup; \}/);
});
