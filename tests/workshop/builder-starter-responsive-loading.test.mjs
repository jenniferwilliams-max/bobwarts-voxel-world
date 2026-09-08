import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("starter page owns one viewport without page or card scrolling",()=>{
  assert.match(source,/body\.starterScreenActive,\s*#startScreen\{[\s\S]*height:100dvh;[\s\S]*overflow:hidden !important;/);
  assert.match(source,/#startCard\{[\s\S]*height:min\(100%,900px\) !important;[\s\S]*max-height:100% !important;[\s\S]*overflow:hidden !important;[\s\S]*grid-template-rows:/);
  assert.match(source,/#startScreen\{[\s\S]*padding:clamp\(6px,1\.4vh,16px\)/);
});

test("starter missions retain two responsive rows instead of a tall narrow list",()=>{
  assert.match(source,/\.startMissionGrid\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\) !important;[\s\S]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\) !important;/);
  assert.match(source,/\.startMissionGrid \.missionTile\{[\s\S]*min-height:44px !important;/);
  assert.match(source,/@media\(max-height:560px\)\{[\s\S]*\.startHelpPanel\{display:none !important\}/);
});

test("Chromebook starter layout restores branding and keeps every required region compact",()=>{
  const compact=source.match(/<style id="builderStartMissionCompactLayoutPolish">([\s\S]*?)<\/style>/)?.[1] || "";
  assert.match(compact,/@media \(min-width:701px\) and \(max-height:760px\)/);
  assert.match(compact,/\.starterTitleBanner\{[\s\S]*width:min\(1210px,86vw\) !important;[\s\S]*height:auto !important;/);
  assert.match(compact,/\.starterBannerImage\{[\s\S]*height:auto !important;[\s\S]*max-height:none !important;[\s\S]*object-fit:contain !important;/);
  assert.match(compact,/\.startMissionGrid\{[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\) !important;[\s\S]*grid-template-rows:repeat\(2,70px\) !important;[\s\S]*gap:5px 10px !important;/);
  assert.match(compact,/\.startMissionGrid \.missionTile\{[\s\S]*min-height:44px !important;[\s\S]*height:70px !important;/);
  assert.match(compact,/#startBuildingButton\{[\s\S]*width:min\(220px,100%\) !important;[\s\S]*max-width:220px !important;[\s\S]*min-height:44px !important;/);
  assert.match(compact,/\.startHowToWide\{[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\) !important;/);
  assert.match(compact,/\.startHowToWide \.startTip\{[\s\S]*min-height:44px !important;/);
  assert.match(compact,/\.startTipText span\{[\s\S]*display:block !important;/);
});

test("starter loading cover stays opaque until starter assets are ready, then hands off atomically",()=>{
  const firstPaintScript=source.indexOf('id="starterFirstPaintClassScript"');
  const firstAssetPreload=source.indexOf('<link rel="preload"');
  const starterMarkup=source.indexOf('id="startScreen"');
  assert.ok(firstPaintScript > 0 && firstPaintScript < firstAssetPreload && firstPaintScript < starterMarkup);
  assert.match(source,/document\.documentElement\.classList\.add\('starterAssetsLoading'\)/);
  assert.match(source,/html\.starterAssetsLoading body\{[\s\S]*visibility:visible !important;/);
  assert.match(source,/html\.starterAssetsLoading body > :not\(#startScreen\),[\s\S]*visibility:hidden !important;/);
  assert.match(source,/html\.starterAssetsLoading::before,[\s\S]*html\.starterAssetsLoading::after\{[\s\S]*position:fixed;[\s\S]*z-index:1;/);
  assert.match(source,/html\.starterAssetsLoading::before\{[\s\S]*background-color:#01040a;/);
  assert.match(source,/id="starterLoadingCover" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source,/BOB is getting your mission ready\.\.\./);
  assert.match(source,/<div class="starterLoadingBob" aria-hidden="true"><\/div>/);
  assert.match(source,/\.starterLoadingBob\{[\s\S]*thinker-bob-rig-svg\/assets\/Bob_0000_antenna\.png[\s\S]*thinker-bob-rig-svg\/assets\/Bob_0008_upper-right-leg\.png[\s\S]*background-size:contain;/);
  assert.match(source,/#starterLoadingCover\{[\s\S]*position:fixed;[\s\S]*inset:0;[\s\S]*z-index:2200;/);
  assert.match(source,/#starterLoadingCover\{[\s\S]*background-color:#01040a;/);
  assert.match(source,/html\.starterAssetsReady #starterLoadingCover\{[\s\S]*opacity:0;[\s\S]*visibility:hidden;[\s\S]*pointer-events:none;/);
  assert.match(source,/window\.addEventListener\('load', revealStarterPage, \{once:true\}\)/);
  assert.match(source,/banner\.decode\(\)\.catch\(function\(\)\{\}\)/);
  assert.match(source,/document\.fonts\.ready\.catch\(function\(\)\{\}\)/);
  assert.match(source,/function waitForStableStarterLayout\(\)\{[\s\S]*tiles\.length===10 && tips\.length===4[\s\S]*stableFrames>=4 && Date\.now\(\)-started>=650/);
  assert.match(source,/waitForStarterAssets\(\)\.then\(waitForStableStarterLayout\)\.then\(function\(\)/);
  assert.match(source,/window\.requestAnimationFrame\(function\(\)\{[\s\S]*window\.requestAnimationFrame\(function\(\)\{/);
  assert.match(source,/html\.starterAssetsReady #starterLoadingCover\{[\s\S]*transition:none;/);
  assert.match(source,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*\.starterLoadingMark\{animation:none !important\}/);
});
