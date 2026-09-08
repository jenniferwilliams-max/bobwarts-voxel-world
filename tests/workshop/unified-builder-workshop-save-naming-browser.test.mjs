import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("starter page no longer collects student or project names",()=>{
  assert.doesNotMatch(source,/id="startStudentName"/);
  assert.doesNotMatch(source,/id="startProjectName"/);
  assert.doesNotMatch(source,/id="studentName"/);
  assert.doesNotMatch(source,/id="projectName"/);
  assert.match(source,/id="startBuildingButton"/);
});

test("Builder and Workshop share Name Your Build presentation",()=>{
  assert.match(source,/mode==="NAME" \|\| mode==="BUILDER_NAME"/);
  assert.match(source,/title\.textContent="NAME YOUR BUILD"/);
  assert.match(source,/getBuilderMissionBuildName\(window\.selectedStartWorld\)/);
  assert.match(source,/getWorkshopBuildName\(\)/);
  assert.match(source,/window\.requestBuilderProjectName\(document\.activeElement\)/);
  assert.match(source,/window\.requestBuilderProjectName=requestBuilderProjectName/);
});

test("new Builder exports omit student identity and use portable names",()=>{
  const start=source.indexOf("function exportBuilderWorld(name)");
  const end=source.indexOf("function validateBuilderProjectFile",start);
  const block=source.slice(start,end);
  assert.match(block,/app: "THINKamigBOB Builder"/);
  assert.match(block,/version: 3/);
  assert.match(block,/projectName: acceptedName/);
  assert.doesNotMatch(block,/studentName/);
  assert.match(block,/createThinkamigbobBuildFilename\(acceptedName\)/);
  assert.match(block,/window\.showThinkamigbobBuildToast\("BUILD SAVED!"\)/);
  assert.match(source,/window\.showThinkamigbobBuildToast=showWorkshopProjectToast/);
});

test("Builder validates before resetting or replacing the current build",()=>{
  const start=source.indexOf("reader.onload = function(e)");
  const end=source.indexOf("reader.readAsText(file)",start);
  const block=source.slice(start,end);
  assert.ok(block.indexOf("validateBuilderProjectFile(loadedData)") < block.indexOf("resetWorld()"));
  assert.match(block,/Your build is unchanged/);
});

test("legacy Builder names remain readable without requiring student identity",()=>{
  assert.match(source,/builderProjectName=validated\.projectName/);
  assert.match(source,/projectName:legacy \? "" : String\(value\.projectName \|\| ""\)/);
  assert.doesNotMatch(source,/studentName:\(document\.getElementById/);
});
