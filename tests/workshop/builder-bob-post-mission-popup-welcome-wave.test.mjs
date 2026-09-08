import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const rigStart = source.indexOf('<script id="thinkerBobRigIntegrationScript">');
const rigEnd = source.indexOf("</script>", rigStart);
const rig = source.slice(rigStart, rigEnd);

test("mission popup dismissal is the sole welcome-wave lifecycle gate", () => {
  assert.match(rig, /originalShowMissionPopup=window\.showMissionPopup/);
  assert.match(rig, /cancelMissionPopupWelcome\(\);[\s\S]*?originalShowMissionPopup\.apply/);
  assert.match(rig, /missionPopupWelcomePending=missionPopupIsVisiblyOpen\(\)/);
  assert.match(rig, /wasMissionPopupOpen=missionPopupIsVisiblyOpen\(\)/);
  assert.match(rig, /wasMissionPopupOpen && !missionPopupIsVisiblyOpen\(\)\) queueMissionPopupWelcome\(\)/);
  assert.doesNotMatch(rig, /wrappedHideStart|wrappedToggle|workshopGreetingPlayed/);
});

test("BOB waits 320ms after the popup closes and waves exactly twice", () => {
  assert.match(rig, /MISSION_POPUP_WELCOME_DELAY_MS=320/);
  assert.match(rig, /MISSION_POPUP_WAVE_CYCLES=2/);
  assert.match(rig, /queueWave\(260,/);
  assert.match(rig, /queueWave\(520,/);
  assert.match(rig, /queueWave\(780,/);
  assert.match(rig, /queueWave\(1040,/);
  assert.match(rig, /queueWave\(1300,[\s\S]*?welcomeWaveState="idle"/);
});

test("duplicate closes, mission replacement, and stale callbacks fail closed", () => {
  assert.match(rig, /missionPopupWelcomePending=false/);
  assert.match(rig, /missionPopupWelcomeOwner\+=1/);
  assert.match(rig, /window\.clearTimeout\(missionPopupWelcomeTimer\)/);
  assert.match(rig, /owner!==missionPopupWelcomeOwner \|\| missionPopupIsVisiblyOpen\(\)/);
  assert.match(rig, /document\.body\.classList\.contains\("workshopMode"\)/);
});

test("reduced motion returns BOB to neutral instead of creating a new policy", () => {
  assert.match(rig, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(rig, /if\(reducedMotionRequested\(\)\)\{[\s\S]*?setThinkerBobNeutral\(\)/);
});

test("the popup-triggered event keeps the existing floating BOB visible through both waves", () => {
  assert.match(source, /addEventListener\("builderBobMissionWelcome",function\(\)\{[\s\S]*?Date\.now\(\)\+2400[\s\S]*?updateFloatingBob\(\)/);
  assert.match(source, /Click a word to read from there\./);
  assert.match(source, /A<\/strong><span>Ask it!<\/span>/);
  assert.match(source, /G<\/strong><span>Grow what you know!<\/span>/);
});
