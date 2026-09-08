import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const css = source.match(/<style id="builderGuidedCadLayoutCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";
const script = source.match(/<script id="builderGuidedCadLayoutScript">([\s\S]*?)<\/script>/)?.[1] ?? "";
const swapCss = source.match(/<style id="builderGuidedCadRegionSwapCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";
const swapScript = source.match(/<script id="builderGuidedCadRegionSwapScript">([\s\S]*?)<\/script>/)?.[1] ?? "";

test("defines one Builder-only project header with existing presentation owners", () => {
  assert.equal((source.match(/id="builderGuidedCadHeader"/g) ?? []).length, 1);
  assert.match(source, /id="builderGuidedCadHeader" aria-label="Builder project header"/);
  assert.match(css, /body\.starterScreenActive #builderGuidedCadHeader,[\s\S]*body\.workshopMode #builderGuidedCadHeader\{[\s\S]*display:none !important/);
  assert.match(script, /brand\.appendChild\(logo\)/);
  assert.match(script, /mission\.appendChild\(title\)/);
  assert.doesNotMatch(script, /cloneNode|innerHTML/);
});

test("reparents the existing Save and Open controls without replacing handlers", () => {
  assert.equal((source.match(/id="builderSaveButton"/g) ?? []).length, 1);
  assert.equal((source.match(/id="builderOpenButton"/g) ?? []).length, 1);
  assert.match(source, /id="builderSaveButton" onclick="saveWorld\(\)"/);
  assert.match(source, /id="builderOpenButton" onclick="document\.getElementById\('loadFile'\)\.click\(\)"/);
  assert.match(script, /actions\.appendChild\(save\)/);
  assert.match(script, /actions\.appendChild\(open\)/);
  assert.doesNotMatch(script, /addEventListener\(["'](?:click|keydown|change)/);
});

test("declares stable responsive protected-region variables", () => {
  for (const variable of [
    "--builder-guided-header-height",
    "--builder-guided-left-width",
    "--builder-guided-right-width",
    "--builder-guided-bottom-height",
    "--builder-guided-region-top",
    "--builder-guided-region-bottom",
    "--builder-guided-center-left",
    "--builder-guided-center-right"
  ]) assert.match(css, new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /@media\(max-width:1280px\)/);
  assert.match(css, /@media\(max-height:720px\)/);
});

test("keeps Mission, right tools, and BOB dock in separate contained regions", () => {
  assert.match(css, /#info\{[\s\S]*top:var\(--builder-guided-region-top\) !important;[\s\S]*bottom:var\(--builder-guided-region-bottom\) !important;[\s\S]*translate:none !important;[\s\S]*overflow-y:auto !important/);
  assert.match(css, /#rightHudColumn\{[\s\S]*top:var\(--builder-guided-region-top\) !important;[\s\S]*bottom:var\(--builder-guided-region-bottom\) !important;[\s\S]*width:var\(--builder-guided-right-width\) !important/);
  assert.match(css, /#buildBar:hover\{[\s\S]*right:var\(--builder-guided-center-right\) !important;[\s\S]*height:var\(--builder-guided-bottom-height\) !important;[\s\S]*translate:none !important/);
  assert.match(css, /#builderRightToolsPanel\{[\s\S]*width:100% !important;[\s\S]*min-height:0 !important/);
  assert.match(css, /#viewCubeBox\{[\s\S]*top:var\(--builder-guided-region-top\) !important;[\s\S]*translate:none !important/);
});

test("uses a narrower translucent tools rail and a larger BOB-only dock", () => {
  assert.match(css, /--builder-guided-right-width:272px/);
  assert.match(css, /--builder-guided-bottom-height:170px/);
  assert.match(css, /#builderRightToolsPanel\{[\s\S]*rgba\(17,58,77,\.68\)[\s\S]*backdrop-filter:blur\(3px\)/);
  assert.match(css, /#buildBar #stemCoach\{[\s\S]*height:110px !important/);
  assert.match(css, /@media\(max-width:1280px\)[\s\S]*--builder-guided-right-width:258px/);
});

test("preserves the full-window renderer and protects header input from Builder placement", () => {
  assert.match(source, /renderer\.setSize\(window\.innerWidth, window\.innerHeight\)/);
  assert.match(source, /event\.target\.closest\("#builderGuidedCadHeader"\)/);
  assert.match(source, /"builderGuidedCadHeader",/);
  assert.match(css, /body:not\(\.starterScreenActive\):not\(\.workshopMode\)\{[\s\S]*overflow-x:hidden !important/);
  assert.match(css, /#builderGuidedCadProjectActions button\{[\s\S]*min-height:44px !important/);
});

test("does not alter camera or renderer architecture in the phase-one owner", () => {
  assert.doesNotMatch(script, /THREE\.|camera\.|renderer\.|setSize|raycaster|pointer|mouse\./);
  assert.doesNotMatch(css, /canvas\s*\{/);
});

test("approved region swap moves existing tools left and BOB right", () => {
  assert.match(swapScript, /document\.body\.appendChild\(tools\)/);
  assert.match(swapScript, /bob\.appendChild\(coach\)/);
  assert.match(swapScript, /bob\.appendChild\(voice\)/);
  assert.match(swapScript, /bob\.appendChild\(message\)/);
  assert.match(swapScript, /mission\.appendChild\(actions\)/);
  assert.match(swapScript, /mission\.appendChild\(modeSwitch\)/);
  assert.match(swapScript, /utilityButtons\.appendChild\(helpButton\)/);
  assert.match(swapScript, /rightColumn\.appendChild\(bob\)/);
  assert.doesNotMatch(swapScript, /cloneNode|innerHTML/);
});

test("side panels stay highly transparent while controls remain readable", () => {
  assert.match(swapCss, /#builderRightToolsPanel\{[\s\S]*left:var\(--builder-guided-edge\) !important;[\s\S]*rgba\(7,43,61,\.27\)/);
  assert.match(swapCss, /#builderBobRightPanel\{[\s\S]*rgba\(7,43,61,\.20\)/);
  assert.match(swapCss, /#rightHudColumn\{[\s\S]*bottom:0 !important;[\s\S]*overflow:hidden !important/);
  assert.match(swapCss, /#builderBobRightPanel\{[\s\S]*position:fixed !important;[\s\S]*top:var\(--builder-guided-region-top\) !important;[\s\S]*bottom:0 !important;[\s\S]*width:var\(--builder-swap-right-width\) !important;[\s\S]*overflow-y:auto/);
  assert.match(swapCss, /#builderBobRightPanel\{[\s\S]*display:flex;[\s\S]*flex-direction:column/);
  assert.match(swapCss, /#builderBobRightPanel #stemCoach\{[\s\S]*height:auto !important;[\s\S]*max-height:none !important;[\s\S]*flex:1 1 auto !important/);
  assert.match(swapCss, /#builderBobRightPanel #stemCoachContent\{[\s\S]*flex:1 1 auto !important;[\s\S]*max-height:none !important/);
  assert.match(swapCss, /#builderRightToolsPanel button,[\s\S]*opacity:1 !important/);
  assert.doesNotMatch(swapCss, /backdrop-filter:blur/);
});

test("Builder Challenge becomes the contained bottom strip", () => {
  assert.match(swapCss, /#info\{[\s\S]*right:var\(--builder-swap-center-right\) !important;[\s\S]*bottom:var\(--builder-guided-edge\) !important;[\s\S]*left:var\(--builder-swap-center-left\) !important;[\s\S]*height:var\(--builder-swap-bottom-height\) !important/);
  assert.match(swapCss, /#challengeChecklist\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\) !important;[\s\S]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\) !important/);
  assert.match(swapCss, /#challengeChecklist label\{[\s\S]*min-height:0 !important;[\s\S]*white-space:normal !important/);
  assert.match(swapCss, /#templateIncludesPanel\{[\s\S]*display:none !important/);
  assert.match(swapCss, /--builder-swap-bottom-height:112px/);
});

test("side rails extend to the bottom and Mission shortcuts share the left rail", () => {
  assert.match(swapCss, /--builder-swap-region-bottom:var\(--builder-guided-edge\)/);
  assert.match(swapCss, /\.dashboard139MissionZone\{[\s\S]*min-height:168px !important/);
  assert.match(swapCss, /\.dashboard139MissionZone #builderMissionActions,[\s\S]*\.dashboard139MissionZone #workspaceUtilityRail\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\) !important/);
});

test("compact left tools keep Grid reachable without shrinking touch targets", () => {
  assert.match(swapCss, /--builder-swap-left-width:218px/);
  assert.match(swapCss, /@media\(max-width:1280px\)[\s\S]*--builder-swap-left-width:204px/);
  assert.match(swapCss, /#builderRightToolsPanel\{[\s\S]*gap:7px !important/);
  assert.match(swapCss, /#builderRightToolsPanel #bottomBuildTools button,[\s\S]*\.dashboardUtilityButtons button\{[\s\S]*height:44px !important;[\s\S]*min-height:44px !important/);
  assert.match(swapCss, /\.dashboard139UtilityZone\{[\s\S]*height:167px !important;[\s\S]*min-height:167px !important/);
});

test("Mission shortcuts avoid duplicate Library wording and use compact hierarchy", () => {
  assert.match(source, /aria-label="Mission and shortcut controls"/);
  assert.match(source, /Mission &amp; Shortcuts/);
  assert.match(swapCss, /#returnMissionsButton\{[\s\S]*width:100% !important;[\s\S]*height:44px !important;[\s\S]*background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\) !important;[\s\S]*background-size:100% 100% !important;[\s\S]*-webkit-text-fill-color:#8ff6ff !important/);
  assert.match(swapCss, /#workspaceUtilityRail\{[\s\S]*grid-template-columns:minmax\(58px,\.72fr\) minmax\(0,1\.28fr\) !important/);
  assert.match(swapCss, /\.dashboard139UtilityZone #helpButton\{[\s\S]*position:static !important;[\s\S]*inset:auto !important;[\s\S]*translate:none !important;[\s\S]*width:100% !important;[\s\S]*max-width:none !important/);
  assert.match(swapCss, /#workspaceModeSwitch\{[\s\S]*background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\) !important;[\s\S]*-webkit-text-fill-color:#fff !important;[\s\S]*text-shadow:[\s\S]*rgba\(143,246,255,\.92\)/);
  assert.match(source, /compactMissionZone\.appendChild\(modeSwitch\);[\s\S]*compactUtilityButtons\.appendChild\(helpButton\);/);
});

test("final polish contains colors and keeps project actions in the header", () => {
  assert.match(swapCss, /#builderRightToolsPanel \.colorScrollWrap\{[\s\S]*overflow-x:hidden !important;[\s\S]*overscroll-behavior-x:contain !important/);
  assert.match(swapCss, /#builderRightToolsPanel #colorSwatchBar\{[\s\S]*width:100% !important;[\s\S]*overflow-x:scroll !important/);
  assert.match(swapCss, /#builderRightToolsPanel #colorSwatchBar button,[\s\S]*flex:0 0 40px !important;[\s\S]*width:40px !important/);
  assert.match(swapCss, /\.colorScrollWrap > \.colorScrollArrow\{[\s\S]*display:none !important/);
  assert.match(swapCss, /#builderRightToolsPanel #builderSaveButton,[\s\S]*#builderRightToolsPanel #builderOpenButton\{display:none !important/);
  assert.match(swapCss, /#builderColorScrollAffordance\{[\s\S]*pointer-events:auto;[\s\S]*touch-action:none/);
  assert.match(swapScript, /scrollTrack\.setAttribute\("aria-hidden","true"\)/);
  assert.match(swapScript, /colorBar\.addEventListener\("scroll",syncColorScrollAffordance,\{passive:true\}\)/);
  assert.match(swapScript, /scrollTrack\.addEventListener\("pointerdown"/);
  assert.match(swapScript, /scrollTrack\.addEventListener\("pointermove"/);
  assert.match(swapScript, /scrollTrack\.setPointerCapture\(event\.pointerId\)/);
  assert.match(swapScript, /colorBar\.addEventListener\("wheel"[\s\S]*event\.deltaX[\s\S]*event\.deltaY[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)/);
  assert.match(swapCss, /utility-undo\.png/);
  assert.match(swapCss, /utility-redo\.png/);
  assert.match(swapCss, /utility-reset\.png/);
  assert.match(swapCss, /utility-screenshot\.png/);
  assert.match(swapCss, /utility-grid-on\.png/);
  assert.match(swapCss, /utility-grid-off\.png/);
  assert.match(swapCss, /utility-help\.png/);
});

test("region swap preserves renderer and event ownership", () => {
  assert.doesNotMatch(swapScript, /addEventListener\(["'](?:click|keydown)/);
  assert.doesNotMatch(swapScript, /camera|renderer|raycaster|saveWorld|setWorkspaceMode/);
  assert.match(swapCss, /#buildBar\{display:none !important/);
  assert.match(swapCss, /#builderBobRightPanel \.dashboard139PlaybackButtons button,[\s\S]*height:44px !important;[\s\S]*min-height:44px !important/);
});
