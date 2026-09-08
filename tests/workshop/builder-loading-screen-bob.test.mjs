import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const loadingMarkup=source.match(/<div id="starterLoadingCover"[\s\S]*?<\/div>\s*<div id="startCard">/)?.[0] || "";
const loadingStyles=source.match(/<style id="starterFirstPaintCSS">[\s\S]*?<\/style>/)?.[0] || "";
const rigStart=source.indexOf('<script id="thinkerBobRigIntegrationScript">');
const rigEnd=source.indexOf("</script>",rigStart);
const rig=source.slice(rigStart,rigEnd);

test("loading reuses the existing approved THINKer BOB rig layers",()=>{
  const approvedAssetBase="assets/images/characters/thinker-bob-rig-svg/";
  assert.equal((loadingMarkup.match(/class="starterLoadingBob"/g)||[]).length,1);
  assert.match(source,new RegExp(`${approvedAssetBase.replaceAll("/","\\/")}assets\\/Bob_0000_antenna\\.png`));
  assert.match(source,new RegExp(`${approvedAssetBase.replaceAll("/","\\/")}assets\\/Bob_0008_upper-right-leg\\.png`));
  assert.match(rig,new RegExp(`RIG_ASSET_BASE="${approvedAssetBase.replaceAll("/","\\/")}"`));
});

test("loading BOB is decorative, idle, and paired with one accessible status",()=>{
  assert.match(loadingMarkup,/role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(loadingMarkup,/class="starterLoadingBob" aria-hidden="true"/);
  assert.match(loadingMarkup,/BOB is getting your mission ready\.\.\./);
  assert.doesNotMatch(loadingMarkup,/playTwoWaves|queueMissionPopupWelcome|builderBobMissionWelcome/);
  assert.doesNotMatch(source,/\.starterLoadingBob\{[^}]*animation:/);
});

test("loading presentation does not add a new delay or welcome-wave owner",()=>{
  const loadingScript=source.match(/<script id="starterResponsiveLoadingScript">[\s\S]*?<\/script>/)?.[0] || "";
  assert.doesNotMatch(loadingScript,/starterLoadingBob|\.decode\(\).*starterLoadingBob|queueMissionPopupWelcome|playTwoWaves/);
  assert.match(rig,/MISSION_POPUP_WAVE_CYCLES=2/);
  assert.match(rig,/wasMissionPopupOpen && !missionPopupIsVisiblyOpen\(\)\) queueMissionPopupWelcome\(\)/);
});
