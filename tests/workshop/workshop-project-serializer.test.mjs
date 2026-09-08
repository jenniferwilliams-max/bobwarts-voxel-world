import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkshopProjectSerializer,
  validateWorkshopProject,
} from "../../js/workshop/persistence/workshop-project-serializer.mjs";

const vector = (x=0,y=0,z=0) => ({x,y,z});
const descriptor = (object) => object.record || null;
const baseRecord = {
  kind:"STANDARD_SHAPE",shape:"cube",position:vector(0,0.5,0),
  rotation:vector(),scale:vector(1,1,1),color:0x123456,
  dimensions:{width:1,height:1,depth:1},
};

test("serializes and deeply freezes supported Workshop objects", () => {
  const serializer=createWorkshopProjectSerializer({describeObject:descriptor});
  const result=serializer.serialize({
    id:"p1",name:"Bridge Lab",createdAt:1,updatedAt:2,
    objects:[{record:baseRecord},{record:{...baseRecord,kind:"TRUSTED_PART",
      shape:undefined,family:"BRIDGE_BEAM",dimensions:{width:6,height:0.5,depth:1}}}],
  });
  assert.equal(result.ok,true);
  assert.equal(Object.isFrozen(result.project),true);
  assert.equal(Object.isFrozen(result.project.objects),true);
  assert.equal(Object.isFrozen(result.project.objects[0].position),true);
  assert.equal(result.project.objects[1].family,"BRIDGE_BEAM");
});

test("unsupported objects fail the complete serialization atomically", () => {
  const serializer=createWorkshopProjectSerializer({describeObject:descriptor});
  const result=serializer.serialize({id:"p",name:"Test",createdAt:1,updatedAt:1,
    objects:[{record:baseRecord},{}]});
  assert.deepEqual(result,{ok:false,code:"UNSUPPORTED_OBJECT",index:1});
});

test("rejects unknown versions, duplicate identities, and invalid geometry", () => {
  const valid={app:"THINKamigBOB Workshop",schema:"workshop-project",version:1,
    id:"p",name:"Test",createdAt:1,updatedAt:1,
    objects:[{...baseRecord,id:"object-1"}]};
  assert.ok(validateWorkshopProject(valid));
  assert.equal(validateWorkshopProject({...valid,version:2}),null);
  assert.equal(validateWorkshopProject({...valid,objects:[valid.objects[0],valid.objects[0]]}),null);
  assert.equal(validateWorkshopProject({...valid,objects:[{...valid.objects[0],position:vector(26,1,0)}]}),null);
});

test("Bridge Beam preserves its authored half-centimeter thickness", () => {
  const record={...baseRecord,id:"beam",kind:"TRUSTED_PART",shape:undefined,
    family:"BRIDGE_BEAM",dimensions:{width:6,height:0.5,depth:1}};
  const project=validateWorkshopProject({app:"THINKamigBOB Workshop",
    schema:"workshop-project",version:1,id:"p",name:"Beam",createdAt:1,
    updatedAt:1,objects:[record]});
  assert.equal(project.objects[0].dimensions.height,0.5);
  assert.equal(validateWorkshopProject({...project,objects:[{...record,
    dimensions:{width:6,height:0.4,depth:1}}]}),null);
});

test("preserves Y rotation and rejects unsupported X or Z rotation", () => {
  const valid={app:"THINKamigBOB Workshop",schema:"workshop-project",version:1,
    id:"rotation",name:"Rotation",createdAt:1,updatedAt:1,
    objects:[{...baseRecord,id:"object-1",rotation:vector(0,Math.PI/2,0)}]};
  assert.equal(validateWorkshopProject(valid).objects[0].rotation.y,Math.PI/2);
  assert.equal(validateWorkshopProject({...valid,objects:[{
    ...valid.objects[0],rotation:vector(0.01,0,0),
  }]}),null);
  assert.equal(validateWorkshopProject({...valid,objects:[{
    ...valid.objects[0],rotation:vector(0,0,0.01),
  }]}),null);
});
