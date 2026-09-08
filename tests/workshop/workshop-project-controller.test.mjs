import test from "node:test";
import assert from "node:assert/strict";
import {createWorkshopProjectController} from "../../js/workshop/persistence/workshop-project-controller.mjs";

function harness(overrides={}){
  let objects=[{id:"old"}]; let dirty=true; let checkpoint=0; let resets=0;
  const projects=new Map();
  const project={id:"saved",name:"Saved",createdAt:1,updatedAt:2,objects:Object.freeze([{id:"one"}])};
  projects.set("saved",project);
  const controller=createWorkshopProjectController({
    serializer:{serialize:args=>({ok:true,project:{...project,...args}}),validate:value=>value},
    storage:{list:()=>({ok:true,projects:[project]}),get:id=>projects.has(id)?{ok:true,project:projects.get(id)}:{ok:false,code:"NOT_FOUND"},save:value=>({ok:true,project:value})},
    draft:{getSnapshot:()=>({dirty}),markCheckpoint(){checkpoint++;dirty=false;},replaceActive(){dirty=false;}},
    history:{reset(){resets++;}},getObjects:()=>objects,
    createCandidate:record=>({record}),validateCandidates:()=>true,
    replaceObjects(next){objects=next;return true;},now:()=>5,createId:()=>"new",
    ...overrides,
  });
  return {controller,get objects(){return objects;},get checkpoint(){return checkpoint;},get resets(){return resets;}};
}

test("Save checkpoints only after confirmed storage success",()=>{
  const good=harness();
  assert.equal(good.controller.save("Project").ok,true);
  assert.equal(good.checkpoint,1);
  const failed=harness({storage:{save:()=>({ok:false,code:"WRITE_FAILED"}),list:()=>({ok:true,projects:[]}),get:()=>({ok:false})}});
  assert.equal(failed.controller.save("Project").ok,false);
  assert.equal(failed.checkpoint,0);
});

test("Open constructs candidates before atomic replacement and resets history",()=>{
  const h=harness();
  assert.equal(h.controller.open("saved").ok,true);
  assert.equal(h.objects.length,1);
  assert.equal(h.objects[0].record.id,"one");
  assert.equal(h.resets,1);
});

test("failed Open preserves current objects and history",()=>{
  const h=harness({validateCandidates:()=>false});
  assert.equal(h.controller.open("saved").ok,false);
  assert.deepEqual(h.objects,[{id:"old"}]);
  assert.equal(h.resets,0);
});

test("New atomically installs a clean blank project",()=>{
  const h=harness();
  assert.equal(h.controller.newProject().ok,true);
  assert.deepEqual(h.objects,[]);
  assert.equal(h.resets,1);
  assert.equal(h.controller.getSnapshot().currentProjectId,null);
});

test("portable export checkpoints only after explicit confirmation",()=>{
  const h=harness();
  const prepared=h.controller.prepareExport("Portable");
  assert.equal(prepared.ok,true);
  assert.equal(h.checkpoint,0);
  assert.equal(h.controller.confirmExport(prepared.project).ok,true);
  assert.equal(h.checkpoint,1);
});

test("portable import validates and replaces atomically",()=>{
  const h=harness();
  const imported=h.controller.importProject({
    id:"file",name:"File",createdAt:1,updatedAt:2,objects:[{id:"from-file"}],
  });
  assert.equal(imported.ok,true);
  assert.equal(h.objects[0].record.id,"from-file");
  assert.equal(h.resets,1);

  const failed=harness({validateCandidates:()=>false});
  assert.equal(failed.controller.importProject({
    id:"file",name:"File",createdAt:1,updatedAt:2,objects:[{id:"bad"}],
  }).ok,false);
  assert.deepEqual(failed.objects,[{id:"old"}]);
  assert.equal(failed.resets,0);
});

test("an installed project exposes and can restore its previous identity",()=>{
  const h=harness();
  assert.equal(h.controller.open("saved").ok,true);
  const imported=h.controller.importProject({
    id:"file",name:"File",createdAt:1,updatedAt:3,objects:[{id:"from-file"}],
  });
  assert.equal(imported.previousProject.id,"saved");
  h.controller.restoreProjectIdentity(imported.previousProject);
  assert.equal(h.controller.getSnapshot().currentProjectId,"saved");
});

test("successful updates preserve creation time and advance only saved update time",()=>{
  const h=harness();
  assert.equal(h.controller.open("saved").ok,true);
  const saved=h.controller.save("Saved");
  assert.equal(saved.ok,true);
  assert.equal(saved.project.createdAt,1);
  assert.equal(saved.project.updatedAt,5);
});

test("default project IDs prefer random UUID and have a deterministic fallback",()=>{
  const originalCrypto=globalThis.crypto;
  try{
    Object.defineProperty(globalThis,"crypto",{configurable:true,value:{
      randomUUID:()=>"12345678-1234-1234-1234-123456789abc",
    }});
    const uuidHarness=harness({createId:undefined});
    assert.equal(uuidHarness.controller.save("UUID").project.id,
      "workshop-12345678-1234-1234-1234-123456789abc");

    Object.defineProperty(globalThis,"crypto",{configurable:true,value:{}});
    const fallbackHarness=harness({createId:undefined});
    assert.equal(fallbackHarness.controller.save("Fallback").project.id,"workshop-5-1");
  }finally{
    Object.defineProperty(globalThis,"crypto",{
      configurable:true,value:originalCrypto,
    });
  }
});
