import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {
  WORKSHOP_SELECTION_STATES,
  createWorkshopSelectionFoundationController,
  getWorkshopVerticalStackSelection,
  workshopBoundsShareVerticalStackFace,
} from "../../js/workshop/editing/workshop-selection-foundation.mjs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const bounds=(min,max) => ({min:{...min},max:{...max}});
const block=(id,box,standard=true) => ({id,box,standard});
const select=(seed,objects) => getWorkshopVerticalStackSelection({
  seed,objects,getBounds:(object) => object.box,
  isEligible:(object) => object.standard===true,tolerance:0.0001,
});
const ids=(objects) => Array.from(objects,(object) => object.id);

test("Select Stack has its own intentional selection state",() => {
  const controller=createWorkshopSelectionFoundationController();
  const entry=block("entry",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const started=controller.beginSelectStack([entry]);
  assert.equal(started.ok,true);
  assert.equal(started.snapshot.state,WORKSHOP_SELECTION_STATES.SELECT_STACK);
  assert.equal(started.snapshot.firstSeedPending,false);
  assert.deepEqual(started.snapshot.entrySelection,[entry]);
});

test("middle seed traverses one uninterrupted column upward and downward",() => {
  const bottom=block("bottom",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const middle=block("middle",bounds({x:0,y:1,z:0},{x:1,y:2,z:1}));
  const top=block("top",bounds({x:0,y:2,z:0},{x:1,y:3,z:1}));
  assert.deepEqual(ids(select(middle,[top,bottom,middle])),
    ["bottom","middle","top"]);
  assert.deepEqual(ids(select(bottom,[top,bottom,middle])),
    ["bottom","middle","top"]);
  assert.deepEqual(ids(select(top,[top,bottom,middle])),
    ["bottom","middle","top"]);
});

test("side, front, edge, corner, and neighboring-column contacts are excluded",() => {
  const seed=block("seed",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const above=block("above",bounds({x:0,y:1,z:0},{x:1,y:2,z:1}));
  const side=block("side",bounds({x:1,y:0,z:0},{x:2,y:1,z:1}));
  const front=block("front",bounds({x:0,y:0,z:1},{x:1,y:1,z:2}));
  const edge=block("edge",bounds({x:1,y:1,z:0},{x:2,y:2,z:1}));
  const corner=block("corner",bounds({x:1,y:1,z:1},{x:2,y:2,z:2}));
  assert.deepEqual(ids(select(seed,[seed,above,side,front,edge,corner])),
    ["seed","above"]);
  assert.equal(workshopBoundsShareVerticalStackFace(seed.box,side.box),false);
  assert.equal(workshopBoundsShareVerticalStackFace(seed.box,front.box),false);
  assert.equal(workshopBoundsShareVerticalStackFace(seed.box,edge.box),false);
  assert.equal(workshopBoundsShareVerticalStackFace(seed.box,corner.box),false);
});

test("a vertical gap terminates traversal",() => {
  const bottom=block("bottom",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const seed=block("seed",bounds({x:0,y:2,z:0},{x:1,y:3,z:1}));
  const top=block("top",bounds({x:0,y:3,z:0},{x:1,y:4,z:1}));
  assert.deepEqual(ids(select(seed,[bottom,seed,top])),["seed","top"]);
});

test("integer and half-integer columns are compatible and deterministic",() => {
  const integerLow=block("integer-low",
    bounds({x:-0.5,y:0,z:-0.5},{x:0.5,y:1,z:0.5}));
  const integerHigh=block("integer-high",
    bounds({x:-0.5,y:1,z:-0.5},{x:0.5,y:2,z:0.5}));
  const halfLow=block("half-low",bounds({x:0,y:0,z:0},{x:1,y:1,z:1}));
  const halfHigh=block("half-high",bounds({x:0,y:1,z:0},{x:1,y:2,z:1}));
  assert.deepEqual(ids(select(integerHigh,[halfHigh,integerHigh,halfLow,integerLow])),
    ["integer-low","integer-high"]);
  assert.deepEqual(ids(select(halfLow,[integerHigh,halfHigh,integerLow,halfLow])),
    ["half-low","half-high"]);
});

test("unsupported Parts and Objects seeds fail closed",() => {
  const unsupported=block("part",
    bounds({x:0,y:0,z:0},{x:1,y:1,z:1}),false);
  assert.deepEqual(ids(select(unsupported,[unsupported])),[]);
});

test("runtime uses one stack adapter and preserves face-connected Multiple",() => {
  assert.match(source,/function getWorkshopCanonicalVerticalStackSelection\(seed\)/);
  assert.match(source,/getWorkshopVerticalStackSelection\(\{/);
  assert.match(source,/isEligible:isStandardWorkshopBlock/);
  assert.doesNotMatch(source.slice(
    source.indexOf("function getWorkshopCanonicalVerticalStackSelection"),
    source.indexOf("function startWorkshopSelectStack")),/workshopContactGraph/);
  assert.match(source,/function startWorkshopSelectStack\(\)[\s\S]*?beginSelectStack\(selectedBlocks\)/);
  assert.match(source,/state==="SELECT_STACK"[\s\S]*?getWorkshopCanonicalVerticalStackSelection\(startBlock\)/);
  assert.match(source,/firstSeedPending[\s\S]*?getWorkshopCanonicalFaceConnectedSelection\(startBlock\)/);
});

test("button is accessible, equal-width, and uses the approved three rows",() => {
  assert.match(source,/id="workshopSelectConnectedButton"[^>]*aria-label="Select Stack"[^>]*aria-pressed="false"[^>]*onclick="startWorkshopSelectStack\(\)"[^>]*><span class="workshop-selection-label"><span>SELECT<\/span><span>STACK<\/span><\/span><span class="workshop-control-icon" aria-hidden="true">▤<\/span>/);
  assert.match(source,/\.workshop-design-group\.is-change \.workshop-design-group-controls\{[\s\S]*?grid-template-columns:repeat\(8,minmax\(44px,1fr\)\)/);
  assert.match(source,/#workshopSelectConnectedButton \.workshop-selection-label\{[\s\S]*?place-items:center/);
  assert.match(source,/\.workshop-design-group-controls button\{[\s\S]*?min-height:44px/);
});

