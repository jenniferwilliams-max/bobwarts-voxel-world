import assert from "node:assert/strict";
import test from "node:test";
import {createThinkamigbobGearProgress} from "../../js/progression/thinkamigbob-gear-progress.mjs";

function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}

test("migrates the legacy Read to BOB total and preserves cumulative Gears",()=>{
  const storage=memoryStorage({thinkamigbobReadToBobRewardProgress01:JSON.stringify({gears:128})});
  const progress=createThinkamigbobGearProgress({storage});
  assert.equal(progress.getSnapshot().cumulativeGears,128);
  assert.equal(progress.getSnapshot().gearsToNextUpgrade,22);
  assert.equal(progress.synchronizeTotal(12).cumulativeGears,128);
});

test("reconciles a newer legacy total after the cumulative store already exists",()=>{
  const storage=memoryStorage({
    thinkamigbobStudentProgressionV1:"unused",
    "thinkamigbob-student-progression-v1":JSON.stringify({
      version:1,cumulativeGears:12,processedAwardIds:[],legacyMigrated:true
    }),
    thinkamigbobReadToBobRewardProgress01:JSON.stringify({gears:67})
  });
  const progress=createThinkamigbobGearProgress({storage});
  assert.equal(progress.getSnapshot().cumulativeGears,67);
  assert.equal(progress.getSnapshot().gearsToNextUpgrade,33);
});

test("crossing a threshold unlocks without spending Gears",()=>{
  const progress=createThinkamigbobGearProgress({storage:memoryStorage()});
  progress.synchronizeTotal(49);
  const result=progress.award({id:"reading-one",gears:3});
  assert.equal(result.ok,true);
  assert.equal(result.snapshot.cumulativeGears,52);
  assert.deepEqual(result.snapshot.newlyUnlocked,[50]);
  assert.equal(result.snapshot.gearsToNextUpgrade,48);
});

test("duplicate, invalid, and repeated awards are atomic",()=>{
  const progress=createThinkamigbobGearProgress({storage:memoryStorage()});
  assert.equal(progress.award({id:"reward",gears:3}).ok,true);
  assert.equal(progress.award({id:"reward",gears:3}).ok,false);
  assert.equal(progress.award({id:"",gears:5}).ok,false);
  assert.equal(progress.getSnapshot().cumulativeGears,3);
});
