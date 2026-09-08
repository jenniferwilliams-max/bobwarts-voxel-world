import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("Save Build downloads a validated portable Workshop JSON file",()=>{
  assert.match(source,/workshop-project-file-service\.mjs/);
  assert.match(source,/workshopProjectController\.prepareExport\(name\)/);
  assert.match(source,/workshopProjectFileService\.exportProject\(prepared\.project\)/);
  assert.match(source,/new Blob\(\[result\.json\],\{type:"application\/json;charset=utf-8"\}\)/);
  assert.match(source,/download\.download=result\.filename/);
  assert.match(source,/workshopProjectController\.confirmExport\(result\.project\)/);
  assert.match(source,/showWorkshopProjectToast\("Build saved!"\)/);
  assert.match(source,/function saveWorld\(\)[\s\S]*?classList\.contains\("workshopMode"\)[\s\S]*?requestWorkshopProjectSave\(/);
});

test("Open Build uses a Chromebook file picker and validates before mutation",()=>{
  assert.match(source,/id="workshopProjectFileInput" type="file"[^>]*accept="\.json,\.thinkamigbob\.json,application\/json"/);
  assert.match(source,/fileInput\.value="";\s*fileInput\.click\(\)/);
  assert.match(source,/workshopProjectFileService\.importText\(text\)/);
  assert.match(source,/if\(!imported\.ok\)[\s\S]*?Your current work is unchanged/);
  assert.match(source,/workshopProjectController\.importProject\(imported\.project\)/);
  assert.match(source,/showWorkshopProjectToast\("Build opened!"\)/);
});

test("dirty Draft protection remains ahead of file replacement",()=>{
  assert.match(source,/workshopProjectController\.getSnapshot\(\)\.dirty[\s\S]*?configureWorkshopProjectDialog\("DIRTY"\)/);
  assert.match(source,/id="workshopProjectSaveGuard"[^>]*>SAVE<\/button>/);
  assert.match(source,/id="workshopProjectDiscard"[^>]*>DISCARD<\/button>/);
  assert.match(source,/id="workshopProjectCancel"[^>]*>CANCEL<\/button>/);
  assert.match(source,/projectSaveGuard\.addEventListener\("click"[\s\S]*?requestWorkshopProjectSave\(null,true\)/);
});

test("file workflow is isolated from cloud and Builder persistence",()=>{
  assert.doesNotMatch(source,/workshopProjectFileService[\s\S]{0,500}(Cloudflare|cloud storage|fetch\()/i);
  assert.match(source,/var AUTOSAVE_KEY="thinkamigbob-student-autosave-v1"/);
  assert.match(source,/app: "THINKamigBOB Builder",\s*version: 3/);
});
