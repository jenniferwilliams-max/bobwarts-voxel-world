import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const css=source.match(/<style id="builderGearWorkshopUpgradeProgressCSS">([\s\S]*?)<\/style>/)?.[1]??"";
const script=source.match(/<script type="module" id="builderGearWorkshopUpgradeProgressScript">([\s\S]*?)<\/script>/)?.[1]??"";

test("renders cumulative Gears and Workshop Upgrade progress around the centered mission",()=>{
  assert.match(script,/builderGearTotal/);
  assert.match(script,/builderNextWorkshopUpgrade/);
  assert.match(script,/TO NEXT[\s\S]*WORKSHOP UPGRADE/);
  assert.doesNotMatch(script,/WORKSHOP FEATURE/i);
  assert.match(script,/builderGearProgressCopy[\s\S]*GEARS[\s\S]*TOTAL COLLECTED/);
  assert.match(script,/builderGearProgressCopy[\s\S]*TO NEXT[\s\S]*WORKSHOP UPGRADE/);
  assert.doesNotMatch(script,/>128<|>22</);
  assert.match(css,/#builderGuidedCadMission\{[\s\S]*grid-column:3[\s\S]*transform:none/);
});

test("keeps the original compact header while polishing its progress presentation",()=>{
  assert.match(css,/#builderGuidedCadHeader\{[\s\S]*min-height:52px[\s\S]*height:52px/);
  assert.match(css,/#builderMissionLogo\{[\s\S]*width:auto[\s\S]*max-width:245px[\s\S]*height:46px[\s\S]*max-height:46px[\s\S]*transform:scale\(1\.25\)[\s\S]*transform-origin:left center/);
  assert.match(source,/#builderGuidedCadBrand #builderMissionLogo\{[\s\S]*object-fit:contain/);
  assert.match(css,/@media\(max-width:1280px\), \(max-height:720px\)[\s\S]*--builder-guided-header-height:52px[\s\S]*max-width:225px[\s\S]*height:44px/);
  assert.match(css,/\.builderGearProgressLabel\{[\s\S]*font-family:Lexend[\s\S]*font-size:24px[\s\S]*font-weight:800/);
  assert.match(css,/#builderGuidedCadHeader\{[\s\S]*right:calc\(var\(--builder-guided-edge\) \+ var\(--builder-swap-right-width\) \+ var\(--builder-guided-gap\)\)/);
  assert.match(css,/#builderGearTotal\{[\s\S]*grid-column:2[\s\S]*width:100%/);
  assert.match(css,/#builderNextWorkshopUpgrade\{[\s\S]*grid-column:4[\s\S]*width:100%/);
  assert.doesNotMatch(css,/left:calc\(50% [+-] (?:340|152)px\)/);
  assert.match(css,/overflow:hidden/);
});

test("keeps progress values dynamic and exposes complete accessible meanings",()=>{
  assert.match(script,/textContent=gears/);
  assert.match(script,/textContent=snapshot\.gearsToNextUpgrade/);
  assert.match(script,/total Gear[\s\S]*collected/);
  assert.match(script,/Gears to the next Workshop Upgrade/);
});

test("uses crisp static mission-title aqua only on dynamic progress numbers",()=>{
  assert.match(css,/\.builderGearProgressLabel\{[\s\S]*color:transparent[\s\S]*-webkit-text-fill-color:transparent[\s\S]*radial-gradient\(circle at center[\s\S]*background-clip:text[\s\S]*font-family:Lexend,Arial,Helvetica,sans-serif/);
  assert.match(css,/\.builderGearProgressLabel\{[\s\S]*drop-shadow\(0 0 1px rgba\(92,235,255,\.95\)\)[\s\S]*animation:none !important;[\s\S]*opacity:1/);
  assert.match(css,/\.builderGearProgressCopy\{[\s\S]*color:#dff8ff/);
  assert.match(script,/total\.querySelector\("\.builderGearProgressLabel"\)\.textContent=gears/);
  assert.match(script,/label\.textContent=snapshot\.gearsToNextUpgrade/);
  assert.match(script,/WORKSHOP UPGRADE/);
  assert.doesNotMatch(script,/WORKSHOP FEATURE/i);
  assert.match(source,/@keyframes builderMissionTitleWhiteLed207D/);
  assert.match(source,/#builderMissionTitleOverlay\{[\s\S]*animation:builderMissionTitleWhiteLed207D 3\.5s ease-in-out infinite/);
});

test("wide Builder headers center the fixed-spacing status group over the visible workspace",()=>{
  assert.match(css,/@media\(min-width:1400px\)[\s\S]*--builder-wide-workspace-center-shift:-24px[\s\S]*--builder-wide-workspace-center:calc\(50vw - var\(--builder-guided-edge\) \+ var\(--builder-wide-workspace-center-shift\)\)/);
  assert.match(css,/@media\(min-width:1400px\)[\s\S]*#builderGuidedCadMission\{[\s\S]*left:var\(--builder-wide-workspace-center\) !important[\s\S]*width:320px[\s\S]*translate\(-50%,-50%\)/);
  assert.match(css,/@media\(min-width:1400px\)[\s\S]*#builderGearTotal\{[\s\S]*left:calc\(var\(--builder-wide-workspace-center\) - 345px\)[\s\S]*right:auto[\s\S]*width:175px/);
  assert.match(css,/@media\(min-width:1400px\)[\s\S]*#builderNextWorkshopUpgrade\{[\s\S]*left:calc\(var\(--builder-wide-workspace-center\) \+ 170px\)[\s\S]*width:225px/);

  const viewportWidth=2048;
  const edge=18;
  const gap=12;
  const leftRail=218;
  const rightRail=264;
  const workspaceLeft=edge+leftRail+gap;
  const workspaceRight=viewportWidth-(edge+rightRail+gap);
  const workspaceCenter=(workspaceLeft+workspaceRight)/2;
  const headerBorder=1;
  const cssAnchorInsideHeader=viewportWidth/2-edge-24;
  const cssCenter=edge+headerBorder+cssAnchorInsideHeader;
  const titleHalfWidth=160;
  const totalRight=cssCenter-345+175;
  const nextLeft=cssCenter+170;
  assert.equal(cssCenter,workspaceCenter);
  assert.equal((cssCenter-titleHalfWidth)-totalRight,10);
  assert.equal(nextLeft-(cssCenter+titleHalfWidth),10);
  assert.ok(cssCenter-345>=workspaceLeft);
  assert.ok(cssCenter+170+225<=workspaceRight);
});

test("announces unlocks once and respects reduced motion",()=>{
  assert.match(script,/WORKSHOP UPGRADE UNLOCKED!/);
  assert.match(script,/aria-live","polite/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(script,/synchronizeThinkamigbobGearTotal/);
  assert.match(script,/createThinkamigbobGearProgress\(\{[\s\S]*storage:window\.localStorage[\s\S]*thresholds:WORKSHOP_UPGRADE_THRESHOLDS/);
  assert.doesNotMatch(script,/thinkamigbobReadToBobRewardProgress01/);
  assert.doesNotMatch(script,/window\.updateReadToBobStats/);
});
