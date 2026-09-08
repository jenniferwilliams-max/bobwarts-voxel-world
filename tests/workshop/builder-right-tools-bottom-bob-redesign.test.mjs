import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const css = source.match(/<style id="builderRightToolsBottomBobCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";
const script = source.match(/<script id="builderRightToolsBottomBobScript">([\s\S]*?)<\/script>/)?.[1] ?? "";

test("moves existing Builder tool zones into one accessible right panel", () => {
  assert.match(script, /tools\.id="builderRightToolsPanel"/);
  assert.match(script, /setAttribute\("aria-label","Builder tools"\)/);
  assert.match(script, /dashboard139MissionZone/);
  assert.match(script, /dashboard139ShapeZone/);
  assert.match(script, /dashboard139BuildZone/);
  assert.match(script, /dashboard139UtilityZone/);
  assert.match(script, /dashboard139VoiceZone/);
  assert.match(script, /tools\.appendChild\(zone\)/);
  assert.doesNotMatch(script, /cloneNode|innerHTML/);
});

test("moves THINKer BOB into the bottom dock and Voice controls into the right panel", () => {
  assert.match(script, /var coach=document\.getElementById\("stemCoach"\)/);
  assert.match(script, /dashboardGrid\.prepend\(coach\)/);
  assert.match(script, /\[mission,shapes,build,utilities,voice\]/);
  assert.match(css, /#buildBar \.dashboard139MessageStrip[\s\S]*grid-column:1[\s\S]*grid-row:2/);
});

test("right tools remain Chromebook accessible and contained", () => {
  assert.match(css, /#builderRightToolsPanel\{[\s\S]*min-height:0[\s\S]*display:flex[\s\S]*flex-direction:column[\s\S]*overflow-x:hidden[\s\S]*overflow-y:auto[\s\S]*overscroll-behavior:contain/);
  assert.match(css, /scrollbar-gutter:stable/);
  assert.match(css, /#builderRightToolsPanel button,[\s\S]*min-height:44px/);
  assert.match(css, /@media\(max-width:1280px\)/);
  assert.match(css, /@media\(max-height:720px\)/);
});

test("right-panel groups use full-width allocation with two equal tool columns", () => {
  assert.match(css, /#builderRightToolsPanel \.dashboard139Zone\{[\s\S]*grid-column:1 \/ -1 !important/);
  assert.match(css, /\.dashboard139BuildZone #bottomBuildTools,[\s\S]*\.dashboard139UtilityZone \.dashboardUtilityButtons\{[\s\S]*grid-template-columns:repeat\(2,minmax\(44px,1fr\)\) !important/);
  assert.match(css, /\.dashboardUtilityButtons button\{[\s\S]*grid-column:auto !important;[\s\S]*grid-row:auto !important/);
});

test("only the color strip owns horizontal scrolling", () => {
  assert.match(css, /#builderRightToolsPanel \.colorScrollWrap\{[\s\S]*overflow:hidden !important/);
  assert.match(css, /#builderRightToolsPanel #colorSwatchBar\{[\s\S]*overflow-x:scroll !important[\s\S]*overflow-y:hidden !important/);
  assert.match(css, /#builderRightToolsPanel #colorSwatchBar button\{[\s\S]*min-width:44px !important[\s\S]*min-height:44px !important/);
});

test("reparented zones neutralize legacy dashboard transforms and spacing", () => {
  assert.match(css, /#builderRightToolsPanel \.dashboard139Zone\{[\s\S]*?padding-bottom:9px !important;[\s\S]*?transform:none !important;[\s\S]*?overflow:visible !important/);
  assert.match(css, /#builderRightToolsPanel \.dashboard139ZoneLabel\{[\s\S]*?left:6px !important;[\s\S]*?right:6px !important;[\s\S]*?transform:none !important/);
  assert.match(css, /#builderRightToolsPanel \.dashboard139ShapeZone\{[\s\S]*?transform:none !important/);
  assert.match(css, /#builderRightToolsPanel \.dashboard139BuildZone,[\s\S]*?#builderRightToolsPanel \.dashboard139UtilityZone\{[\s\S]*?transform:none !important/);
});

test("right panel contains Voice controls while the bottom dock remains BOB-focused", () => {
  const shellCss = source.match(/<style id="builderGuidedCadLayoutCSS">([\s\S]*?)<\/style>/)?.[1] ?? "";
  assert.match(shellCss, /#builderRightToolsPanel \.dashboard139VoiceZone\{[\s\S]*grid-column:1 \/ -1 !important[\s\S]*min-height:188px !important/);
  assert.match(shellCss, /#builderRightToolsPanel \.dashboard139PlaybackButtons\{[\s\S]*grid-template-columns:repeat\(3,minmax\(44px,1fr\)\) !important/);
  assert.match(shellCss, /#buildBar \.dashboard139MainGrid\{[\s\S]*grid-template-columns:minmax\(0,1fr\) !important/);
  assert.match(shellCss, /#buildBar #stemCoach\{[\s\S]*height:110px !important/);
});

test("redesign preserves existing control identities and event owners", () => {
  for (const id of [
    "returnMissionsButton",
    "bottomBuildTools",
    "undoButton",
    "redoButton",
    "engineeringGridToggle",
    "readerPlayButton",
    "readerPauseButton",
    "readerStopButton",
    "stemCoachToggle"
  ]) assert.equal((source.match(new RegExp(`id="${id}"`, "g")) ?? []).length, 1, `${id} remains unique`);

  assert.doesNotMatch(script, /addEventListener\(["'](?:click|keydown|wheel|pointerdown)/);
});

test("phase-one shell retains the existing right tools and bottom BOB owners", () => {
  const shellScript = source.match(/<script id="builderGuidedCadLayoutScript">([\s\S]*?)<\/script>/)?.[1] ?? "";
  assert.doesNotMatch(shellScript, /builderRightToolsPanel|stemCoach|dashboard139VoiceZone|dashboard139MessageStrip/);
  assert.equal((script.match(/tools\.id="builderRightToolsPanel"/g) ?? []).length, 1, "right tools remain runtime-created once");
  assert.equal((source.match(/id="stemCoach"/g) ?? []).length, 1);
  assert.equal((source.match(/id="toolMessage"/g) ?? []).length, 1);
});

test("final guided layout reuses the same control nodes in swapped regions", () => {
  const swapScript = source.match(/<script id="builderGuidedCadRegionSwapScript">([\s\S]*?)<\/script>/)?.[1] ?? "";
  assert.match(swapScript, /document\.body\.appendChild\(tools\)/);
  assert.match(swapScript, /bob\.appendChild\(coach\)/);
  assert.match(swapScript, /bob\.appendChild\(voice\)/);
  assert.equal((source.match(/id="stemCoach"/g) ?? []).length, 1);
  assert.equal((source.match(/id="voiceControls"/g) ?? []).length, 1);
  assert.equal((source.match(/id="toolMessage"/g) ?? []).length, 1);
});
