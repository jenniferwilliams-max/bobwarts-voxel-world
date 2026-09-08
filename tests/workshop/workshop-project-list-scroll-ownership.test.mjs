import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("project list owns wheel trackpad and touch scrolling",()=>{
  assert.match(source,/event\.target\.closest\("#workshopProjectList"\)/);
  assert.match(source,/projectList\.addEventListener\("wheel"[\s\S]*?event\.deltaMode===1[\s\S]*?event\.deltaMode===2[\s\S]*?projectList\.scrollTop\+=delta[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?passive:false/);
  assert.match(source,/projectList\.addEventListener\("touchmove"[\s\S]*?event\.stopPropagation\(\)[\s\S]*?passive:true/);
  assert.equal((source.match(/document\.addEventListener\('wheel'/g)||[]).length,1);
});

test("project list claims navigation keys before Builder camera ownership",()=>{
  const start=source.indexOf("function handleWorkshopProjectDialogKeydown(event)");
  const end=source.indexOf("function setWorkshopMeasurementUnit",start);
  const handler=source.slice(start,end);
  for(const key of ["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"]){
    assert.match(handler,new RegExp(`"${key}"`));
  }
  assert.match(handler,/list\.contains\(event\.target\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)/);
  assert.match(handler,/PageUp[\s\S]*?PageDown[\s\S]*?list\.scrollTop\+=direction\*Math\.max\(44,list\.clientHeight-44\)/);
  assert.match(handler,/targetProject\.focus\(\{preventScroll:true\}\)[\s\S]*?targetProject\.scrollIntoView\(\{block:"nearest"\}\)/);
});

test("native project activation and dialog focus contracts remain singular",()=>{
  assert.doesNotMatch(source,/projectList\.addEventListener\("keydown"/);
  assert.match(source,/projectList\.addEventListener\("click"[\s\S]*?openStoredWorkshopProject/);
  assert.match(source,/event\.key==="Escape"[\s\S]*?closeWorkshopProjectDialog/);
  assert.match(source,/event\.key!=="Tab"[\s\S]*?event\.shiftKey/);
});

test("persistent affordance mirrors native list geometry without owning input",()=>{
  const start=source.indexOf("function updateWorkshopProjectScrollAffordance()");
  const end=source.indexOf("function configureWorkshopProjectDialog",start);
  const owner=source.slice(start,end);
  assert.match(owner,/list\.clientHeight/);
  assert.match(owner,/list\.scrollHeight/);
  assert.match(owner,/list\.scrollTop/);
  assert.match(owner,/overflow<=1[\s\S]*?indicator\.hidden=true/);
  assert.match(owner,/Math\.max\(44,Math\.round\(trackHeight\*clientHeight\/scrollHeight\)\)/);
  assert.match(owner,/thumb\.style\.height=thumbHeight\+"px"/);
  assert.match(owner,/thumb\.style\.transform="translateY\("\+thumbOffset\+"px\)"/);
  assert.match(owner,/Scroll to reach more saved projects/);
  assert.match(source,/projectList\.addEventListener\("scroll",updateWorkshopProjectScrollAffordance,\{passive:true\}\)/);
  assert.match(source,/window\.requestAnimationFrame\(function\(\)\{[\s\S]*?updateWorkshopProjectScrollAffordance\(\)[\s\S]*?first\.focus\(\)/);
  assert.match(source,/#workshopProjectScrollThumb\{[\s\S]*?min-height:44px/);
  assert.doesNotMatch(source,/workshopProjectScrollIndicator[^>]*role="scrollbar"/);
});
