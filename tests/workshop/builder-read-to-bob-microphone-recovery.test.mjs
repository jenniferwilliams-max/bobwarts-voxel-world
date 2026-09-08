import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const activeScripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match=>!match[0].includes("application/x-thinkamigbob-retired-student-oral-reading"))
  .map(match=>match[1]).join("\n");

test("student oral-reading controls and active microphone ownership are retired",()=>{
  assert.equal((source.match(/id="readToBobPracticeButton"/g)||[]).length,0);
  assert.equal((source.match(/id="readToBobPractice"/g)||[]).length,0);
  assert.match(source,/id="readToBobStepOneScript" type="application\/x-thinkamigbob-retired-student-oral-reading"/);
  assert.doesNotMatch(activeScripts,/SpeechRecognition|webkitSpeechRecognition|getUserMedia|startReadToBobListening/);
});

test("Library narration remains the sole reading action",()=>{
  assert.equal((source.match(/id="reopenLibraryFromCoach"/g)||[]).length,1);
  assert.match(source,/id="stemCoachActionGroup"[\s\S]*id="reopenLibraryFromCoach"/);
  assert.match(source,/#stemCoachActionGroup\{[\s\S]*grid-template-columns:minmax\(0,1fr\) !important/);
  assert.match(source,/id="readerPlayButton" onclick="playThinkerBob\(\)"/);
  assert.match(source,/id="readerPauseButton" onclick="pauseThinkerBob\(\)"/);
  assert.match(source,/id="readerStopButton" onclick="stopThinkerBob\(\)"/);
});

test("mission popup retains narration and self-reading without oral practice",()=>{
  const start=source.indexOf("function chooseMissionPopupReading(mode)");
  const end=source.indexOf("function showMissionPopup",start+40);
  const handler=source.slice(start,end);
  assert.match(handler,/mode === "bob"/);
  assert.match(handler,/stopThinkerBob\(\)/);
  assert.doesNotMatch(handler,/mode === "student"|startReadToBobListening|toggleReadToBobPractice/);
});
