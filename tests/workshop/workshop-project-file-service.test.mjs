import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkshopProjectFileService,
  createWorkshopProjectFilename,
} from "../../js/workshop/persistence/workshop-project-file-service.mjs";
import {validateWorkshopProject} from "../../js/workshop/persistence/workshop-project-serializer.mjs";

const project = {
  app:"THINKamigBOB Workshop",schema:"workshop-project",version:1,
  id:"portable-1",name:"My Mars Base",createdAt:10,updatedAt:20,objects:[],
};

test("creates portable safe Workshop filenames",()=>{
  assert.equal(createWorkshopProjectFilename("My Mars Base"),"My-Mars-Base.thinkamigbob.json");
  assert.equal(createWorkshopProjectFilename("  Café / Lab?!  "),"Cafe-Lab.thinkamigbob.json");
  assert.equal(createWorkshopProjectFilename("***"),"Workshop-Build.thinkamigbob.json");
});

test("exports only a schema-validated Workshop project",()=>{
  const service=createWorkshopProjectFileService({validateProject:validateWorkshopProject});
  const result=service.exportProject(project);
  assert.equal(result.ok,true);
  assert.equal(result.filename,"My-Mars-Base.thinkamigbob.json");
  assert.deepEqual(JSON.parse(result.json),project);
  assert.equal(service.exportProject({...project,version:2}).ok,false);
});

test("imports valid JSON and fails closed for corrupt or wrong-format files",()=>{
  const service=createWorkshopProjectFileService({validateProject:validateWorkshopProject});
  assert.equal(service.importText(JSON.stringify(project)).ok,true);
  assert.equal(service.importText("not json").code,"MALFORMED_FILE");
  assert.equal(service.importText("").code,"EMPTY_FILE");
  assert.equal(service.importText(JSON.stringify({...project,schema:"builder-project"})).code,
    "INVALID_PROJECT");
});
