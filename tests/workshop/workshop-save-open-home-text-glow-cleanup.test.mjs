import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../../index.html"),"utf8");

test("Workshop Save and Open labels are crisp without changing their color or geometry",()=>{
  assert.match(source,/#viewCubeBox \.workshopUtilityProjectButton\{[\s\S]*height:48px;[\s\S]*min-height:48px;[\s\S]*color:#ff4fa3;[\s\S]*-webkit-text-fill-color:#ff4fa3;[\s\S]*text-shadow:0 1px 2px rgba\(0,0,0,\.98\),0 0 3px #ff267f,0 0 6px rgba\(255,79,163,\.9\)/);
  assert.match(source,/#viewCubeBox #workshopUtilitySave,[\s\S]*?#viewCubeBox #workshopUtilityOpen\{[\s\S]*?text-shadow:none;/);
});

test("Workshop Save and Open icons retain their existing presentation",()=>{
  assert.match(source,/#workshopUtilitySave::before\{[\s\S]*?content:"💾"/);
  assert.match(source,/#workshopUtilityOpen::before\{[\s\S]*?content:"📁"/);
  assert.match(source,/#workshopUtilitySave::before,[\s\S]*?#workshopUtilityOpen::before\{[\s\S]*?text-shadow:0 1px 2px rgba\(0,0,0,\.98\),0 0 3px #ff267f,0 0 6px rgba\(255,79,163,\.9\)/);
});

test("Workshop Home label is crisp while its green icon treatment remains",()=>{
  assert.match(source,/#workshopViewHome > span,[\s\S]*?#workshopViewHome \.workshop-control-icon\{[\s\S]*?color:#83ff72;[\s\S]*?text-shadow:0 0 7px rgba\(87,255,104,\.95\),0 1px 2px rgba\(0,0,0,\.9\)/);
  assert.match(source,/#workshopViewHome > span:not\(\.workshop-control-icon\)\{[\s\S]*?text-shadow:none;/);
});

test("neighboring View Remote labels keep the shared readable shadow",()=>{
  assert.match(source,/#workshopEngineeringViewControls button\[data-workshop-view\]\{[\s\S]*?text-shadow:0 1px 2px rgba\(0,0,0,\.9\)/);
});
