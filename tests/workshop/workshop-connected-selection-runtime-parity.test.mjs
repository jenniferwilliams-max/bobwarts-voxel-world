import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {getWorkshopConnectedSelection} from "../../js/workshop/editing/workshop-selection-foundation.mjs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} exists`);
  const brace=source.indexOf("{",start);
  let depth=0;
  for(let index=brace;index<source.length;index+=1){
    if(source[index]==="{") depth+=1;
    if(source[index]==="}") depth-=1;
    if(depth===0) return source.slice(start,index+1);
  }
  throw new Error(`${name} is incomplete`);
}

const adapterSource=functionSource("getWorkshopCanonicalFaceConnectedSelection");
const clickSource=functionSource("selectConnectedBlocks");

const bounds=(min,max) => ({min:{...min},max:{...max}});
const object=(id,box) => ({id,parent:{},box});

function createRuntime(objects){
  const context={
    Object,
    workshopSelectionFoundationModule:{getWorkshopConnectedSelection},
    activeWorkshopBlocks:(items) => items.filter((item,index,list) =>
      item && item.parent && objects.includes(item) && list.indexOf(item)===index),
    blocks:objects,
    THREE:{Box3:class { setFromObject(item){ return item.box; } }},
    WORKSHOP_CONTACT_TOLERANCE:0.0001,
    workshopContactGraph:new Map(),
  };
  return vm.runInNewContext(
    `${adapterSource}; getWorkshopCanonicalFaceConnectedSelection`,context
  );
}

const ids=(items) => Array.from(items,item=>item.id);

test("Select Multiple first seed keeps the canonical face-connected adapter",() => {
  assert.match(clickSource,
    /firstSeedPending[\s\S]*?getWorkshopCanonicalFaceConnectedSelection\(startBlock\)/);
  assert.equal((clickSource.match(/getWorkshopConnectedSelection/g)||[]).length,0);
  assert.doesNotMatch(adapterSource,/workshopContactGraph|getWorkshopConnectedComponent/);
});

test("canonical runtime adapter traverses every face direction and a turning chain",() => {
  const first=object("first",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const side=object("side",bounds({x:1,y:0,z:0},{x:2,y:1,z:1}));
  const front=object("front",bounds({x:1,y:0,z:1},{x:2,y:1,z:2}));
  const vertical=object("vertical",bounds({x:1,y:1,z:1},{x:2,y:2,z:2}));
  const objects=[first,side,front,vertical];
  assert.deepEqual(ids(createRuntime(objects)(first)),objects.map(item=>item.id));
});

test("canonical runtime adapter excludes gaps, edge contact, and corner contact",() => {
  const seed=object("seed",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const gap=object("gap",bounds({x:1.01,y:0,z:0},{x:2.01,y:1,z:1}));
  const edge=object("edge",bounds({x:1,y:1,z:0},{x:2,y:2,z:1}));
  const corner=object("corner",bounds({x:1,y:1,z:1},{x:2,y:2,z:2}));
  assert.deepEqual(ids(createRuntime([seed,gap,edge,corner])(seed)),["seed"]);
});

test("integer, half-integer, rotated, and resized world bounds use the same path",() => {
  const integer=object("integer",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const half=object("half",bounds({x:1,y:-0.5,z:-0.5},{x:2,y:0.5,z:0.5}));
  const rotated=object("rotated",bounds({x:1,y:0.5,z:-0.5},{x:2.5,y:1.5,z:0.5}));
  const resized=object("resized",bounds({x:2.5,y:0.5,z:-1},{x:4.5,y:2,z:1}));
  assert.deepEqual(ids(createRuntime([integer,half,rotated,resized])(integer)),
    ["integer","half","rotated","resized"]);
});

test("construction order and legacy graph do not change identities",() => {
  const first=object("first",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const second=object("second",bounds({x:1,y:0,z:0},{x:2,y:1,z:1}));
  const third=object("third",bounds({x:2,y:0,z:0},{x:3,y:1,z:1}));
  const forward=ids(createRuntime([first,second,third])(first)).sort();
  const reverse=ids(createRuntime([third,second,first])(first)).sort();
  assert.deepEqual(forward,reverse);
  second.box=bounds({x:4,y:0,z:0},{x:5,y:1,z:1});
  assert.deepEqual(ids(createRuntime([first,second,third])(first)),["first"]);
  second.box=bounds({x:1,y:0,z:0},{x:2,y:1,z:1});
  assert.deepEqual(ids(createRuntime([first,second,third])(first)),
    ["first","second","third"]);
});
