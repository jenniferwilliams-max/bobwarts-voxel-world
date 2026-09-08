import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../../",import.meta.url);
const source=await readFile(new URL("js/guidance/bob-first-mission-builder-challenge-guidance.mjs",root),"utf8");
const controller=await readFile(new URL("js/guidance/bob-guidance-controller.mjs",root),"utf8");
const html=await readFile(new URL("index.html",root),"utf8");

test("only direct Start a Mission activation arms first-mission guidance",()=>{
  assert.match(source,/doc\.addEventListener\("click",event=>\{/);
  assert.match(source,/event\.target\?\.closest\?\.\("#startBuildingButton"\)/);
  assert.doesNotMatch(source,/resume|openFile|loadFile|localStorage|sessionStorage/i);
  assert.match(source,/guidedMissions\.has\(id\)/);
  assert.match(source,/builderBobMissionWelcomeComplete/);
});

test("guidance waits for the canonical two-wave welcome to settle",()=>{
  assert.match(html,/builderBobMissionWelcomeComplete/);
  assert.match(html,/waves:MISSION_POPUP_WAVE_CYCLES/);
  assert.match(source,/SETTLE_DELAY_MS=220/);
  assert.match(source,/pending\.welcomeOwner!=null && pending\.welcomeOwner!==event\.detail\?\.owner/);
  assert.match(source,/welcomeWaveCycles!=="2"/);
  assert.match(source,/welcomeWaveState!=="idle"/);
  assert.match(source,/removeAttribute\("data-welcome-wave-cycles"\)/);
  assert.match(source,/getComputedStyle\(popup\)\.display!=="none"/);
});

test("four student-facing steps target the real Builder Challenge",()=>{
  for(const text of [
    "Your Builder Challenge is your Mission roadmap.",
    "Use it as a starting point, then make the design your own.",
    "build, change, solve, and improve",
    "GOT IT — LET'S BUILD",
  ]) assert.ok(source.includes(text),`missing guidance copy: ${text}`);
  assert.ok(source.includes("#challengeChecklist"));
  assert.match(source,/id:"starting-template",target:info/);
  assert.match(source,/target:info/g);
});

test("temporary template reveal is contained and restored",()=>{
  assert.match(source,/bobGuidanceChallengeTemplateReveal/);
  assert.match(source,/classList\.remove\("bobGuidanceChallengeReveal","bobGuidanceChallengeTemplateReveal"\)/);
  assert.match(html,/\.bobGuidanceChallengeTemplateReveal #templateIncludesPanel\[hidden\]\{display:block!important\}/);
  assert.match(html,/\.bobGuidanceChallengeTemplateReveal #challengeChecklist\{display:none!important\}/);
});

test("view changes and stale owners cancel without persistence",()=>{
  assert.match(source,/clearPending\("view-change"\)/);
  assert.match(source,/classList\.contains\("workshopMode"\)/);
  assert.match(source,/clearPending\("pagehide"\)/);
  assert.match(source,/clearPending\("stale-mission"\)/);
  assert.doesNotMatch(source,/setItem|getItem|indexedDB/);
});

test("shared controller supports a final action label and retains accessibility",()=>{
  assert.match(controller,/nextLabel:step\.nextLabel/);
  assert.match(controller,/next\.textContent=step\.nextLabel/);
  assert.match(controller,/event\.key==="Escape"/);
  assert.match(controller,/event\.key==="Tab"/);
  assert.match(source,/firstFocusableChallenge\(doc\)\?\.focus/);
});
