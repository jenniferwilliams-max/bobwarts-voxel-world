import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../../",import.meta.url);
const source=await readFile(new URL("js/guidance/bob-guidance-controller.mjs",root),"utf8");
const html=await readFile(new URL("index.html",root),"utf8");

test("one shared BOB Guidance owner is bootstrapped for Builder and Workshop",()=>{
  assert.match(html,/id="bobGuidanceFoundationBootstrap"/);
  assert.match(html,/createBobGuidanceController/);
  assert.match(html,/Object\.defineProperty\(window,"bobGuidance"/);
  assert.equal((html.match(/id="bobGuidanceRoot"/g)||[]).length,1);
});

test("step contract supports target resolution, AMIG, display and interactive guidance",()=>{
  for(const token of ["id:String(step.id)","target:step.target","message:String(step.message)","amigCategory","guidanceType","display","interactive","placement","target-activation"]){
    assert.ok(source.includes(token),`missing ${token}`);
  }
  assert.match(source,/typeof value === "function"/);
  assert.match(source,/doc\.querySelector\(value\)/);
});

test("guidance fails closed for missing, stale, or invalid targets",()=>{
  assert.match(source,/cancel\("missing-target"\)/);
  assert.match(source,/cancel\("stale-target"\)/);
  assert.match(source,/cancel\("invalid-target-geometry"\)/);
  assert.match(source,/MutationObserver/);
});

test("spotlight blocks background input while allowing intentional target interaction",()=>{
  assert.match(html,/\.bobGuidanceCurtain,.bobGuidanceGuard\{[^}]*pointer-events:auto/);
  assert.match(html,/#bobGuidanceRoot\{[^}]*pointer-events:none/);
  assert.match(source,/guard\.hidden=current\(\)\.guidanceType === "interactive"/);
  assert.match(source,/target\.addEventListener\("click",targetListener,true\)/);
});

test("Show me never invokes the target and navigation changes one step",()=>{
  const showBlock=source.slice(source.indexOf('showMe.addEventListener'),source.indexOf('doc.addEventListener("keydown"'));
  assert.doesNotMatch(showBlock,/target\.click\(/);
  assert.match(showBlock,/target\.focus/);
  assert.match(source,/index\+=1; return present\(\)/);
  assert.match(source,/index-=1;present\(\)/);
});

test("only one sequence runs and duplicate starts are suppressed",()=>{
  assert.match(source,/if\(sequence\) cancel\("superseded"/);
  assert.match(source,/code:"DUPLICATE"/);
  assert.match(source,/duplicateWindowMs = 500/);
});

test("Escape, view changes, and page exit perform canonical cleanup",()=>{
  assert.match(source,/event\.key==="Escape"/);
  assert.match(source,/handleViewChange:\(\)=>cancel\("view-change"\)/);
  assert.match(html,/controller\.cancel\("pagehide"\)/);
  assert.match(source,/classList\?\.remove\("bobGuidanceTarget"\)/);
  assert.match(source,/restoreFocus\?\.isConnected/);
  assert.match(source,/event\.key==="Tab"/);
  assert.match(source,/callout\.contains\(doc\.activeElement\)/);
});

test("callout is viewport-safe and Chromebook controls remain accessible",()=>{
  assert.match(source,/Math\.min\(maxX,Math\.max\(8,x\)\)/);
  assert.match(source,/Math\.min\(maxY,Math\.max\(8,y\)\)/);
  assert.match(html,/width:min\(330px,calc\(100vw - 16px\)\)/);
  assert.match(html,/max-height:min\(360px,calc\(100vh - 16px\)\)/);
  assert.match(html,/min-width:44px;min-height:44px/);
  assert.match(html,/role="dialog" aria-modal="false"/);
  assert.match(html,/aria-labelledby="bobGuidanceTitle" aria-describedby="bobGuidanceMessage"/);
});

test("reduced motion and temporary reveal cleanup are supported",()=>{
  assert.match(source,/prefers-reduced-motion: reduce/);
  assert.match(source,/behavior:reduced\(\)\?"auto":"smooth"/);
  assert.match(source,/if \(revealCleanup\)/);
  assert.match(html,/@media \(prefers-reduced-motion:reduce\)/);
});

test("foundation adds no tour, tip persistence, or authored guidance sequence",()=>{
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(html,/bobGuidance\.start\(/);
  assert.doesNotMatch(source,/workshopContactGraph|raycaster|setWorkspaceMode/);
});
