import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILDER_MISSION_BUILD_NAMES,
  createThinkamigbobBuildFilename,
  getBuilderMissionBuildName,
  getWorkshopBuildName,
  normalizeThinkamigbobBuildName,
} from "../../js/persistence/thinkamigbob-build-naming.mjs";

test("provides deterministic names for every Builder mission",()=>{
  assert.equal(getBuilderMissionBuildName("buildCastle"),"Castle Builder");
  assert.equal(getBuilderMissionBuildName("buildMarsColony"),"Mars Colony");
  assert.equal(getBuilderMissionBuildName("missing"),"My Builder Project");
  assert.equal(Object.isFrozen(BUILDER_MISSION_BUILD_NAMES),true);
});

test("provides the neutral Workshop suggestion",()=>{
  assert.equal(getWorkshopBuildName(),"My Workshop Build");
});

test("normalizes names and creates one shared portable filename style",()=>{
  assert.equal(normalizeThinkamigbobBuildName("  My   Mars Base  "),"My Mars Base");
  assert.equal(createThinkamigbobBuildFilename("My Mars Base"),
    "My-Mars-Base.thinkamigbob.json");
});
