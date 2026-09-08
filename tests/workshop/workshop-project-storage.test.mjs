import test from "node:test";
import assert from "node:assert/strict";
import {createWorkshopProjectStorage,WORKSHOP_PROJECT_STORAGE_KEY}
  from "../../js/workshop/persistence/workshop-project-storage.mjs";
import {validateWorkshopProject} from "../../js/workshop/persistence/workshop-project-serializer.mjs";

const project=(id,name,time=1)=>validateWorkshopProject({
  app:"THINKamigBOB Workshop",schema:"workshop-project",version:1,
  id,name,createdAt:1,updatedAt:time,objects:[],
});
const memory=()=>{const values=new Map();return {
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,value),values,
};};

test("uses only the dedicated Workshop key and returns sorted projects",()=>{
  const host=memory();
  const storage=createWorkshopProjectStorage({storage:host,validateProject:validateWorkshopProject});
  assert.equal(storage.save(project("a","Alpha",1)).ok,true);
  assert.equal(storage.save(project("b","Beta",3)).ok,true);
  assert.deepEqual(storage.list().projects.map(item=>item.id),["b","a"]);
  assert.deepEqual([...host.values.keys()],[WORKSHOP_PROJECT_STORAGE_KEY]);
});

test("duplicate names require explicit replacement",()=>{
  const storage=createWorkshopProjectStorage({storage:memory(),validateProject:validateWorkshopProject});
  storage.save(project("a","Tower"));
  assert.equal(storage.save(project("b","tower")).code,"DUPLICATE_NAME");
  assert.equal(storage.save(project("b","tower"),{replaceDuplicate:true}).ok,true);
  assert.deepEqual(storage.list().projects.map(item=>item.id),["b"]);
});

test("malformed and failed storage remain closed",()=>{
  const malformed={getItem:()=>"{",setItem(){}};
  assert.equal(createWorkshopProjectStorage({storage:malformed,
    validateProject:validateWorkshopProject}).list().code,"MALFORMED_STORAGE");
  const failing={getItem:()=>null,setItem(){throw new Error("quota");}};
  assert.equal(createWorkshopProjectStorage({storage:failing,
    validateProject:validateWorkshopProject}).save(project("a","A")).code,"WRITE_FAILED");
});

test("isolates invalid project entries while retaining valid builds",()=>{
  const valid=project("valid","Valid",4);
  const host=memory();
  host.setItem(WORKSHOP_PROJECT_STORAGE_KEY,JSON.stringify({
    app:"THINKamigBOB Workshop",schema:"workshop-project-collection",version:1,
    projects:[valid,{...valid,id:"broken",version:99}],
  }));
  const storage=createWorkshopProjectStorage({storage:host,
    validateProject:validateWorkshopProject});
  const result=storage.list();
  assert.equal(result.ok,true);
  assert.equal(result.invalidCount,1);
  assert.deepEqual(result.projects.map(item=>item.id),["valid"]);
});

test("rejects duplicate valid identities and malformed collection envelopes",()=>{
  const valid=project("same","Same",2);
  const duplicateHost=memory();
  duplicateHost.setItem(WORKSHOP_PROJECT_STORAGE_KEY,JSON.stringify({
    app:"THINKamigBOB Workshop",schema:"workshop-project-collection",version:1,
    projects:[valid,{...valid,name:"Other"}],
  }));
  const duplicateStorage=createWorkshopProjectStorage({storage:duplicateHost,
    validateProject:validateWorkshopProject});
  assert.equal(duplicateStorage.list().code,"INVALID_STORAGE");

  const envelopeHost=memory();
  envelopeHost.setItem(WORKSHOP_PROJECT_STORAGE_KEY,JSON.stringify({
    app:"THINKamigBOB Workshop",schema:"workshop-project-collection",version:2,
    projects:[valid],
  }));
  const envelopeStorage=createWorkshopProjectStorage({storage:envelopeHost,
    validateProject:validateWorkshopProject});
  assert.equal(envelopeStorage.list().code,"INVALID_STORAGE");
});
