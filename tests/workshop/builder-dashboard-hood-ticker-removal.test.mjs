import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("Builder removes the decorative dashboard hood and news ticker", () => {
  const dashboardMarkup = source.slice(
    source.indexOf('<div aria-label="Dashboard" id="buildBar">'),
    source.indexOf('<div data-placeholder="true" id="worldTitle"')
  );

  assert.doesNotMatch(dashboardMarkup, /dashboardTickerAssembly/);
  assert.doesNotMatch(dashboardMarkup, /dashboardTitleArtwork/);
  assert.doesNotMatch(dashboardMarkup, /dashboardTickerWindow/);
  assert.doesNotMatch(dashboardMarkup, /dashboardTickerText/);
  assert.doesNotMatch(source, /rel="preload"[^>]+dashboard-ticker-bezel/);
});

test("Builder keeps the transparent dashboard permanently visible", () => {
  const presentation = source.match(
    /<style id="builderDashboardWithoutHoodTickerCSS">([\s\S]*?)<\/style>/
  )?.[1] ?? "";

  assert.match(presentation, /permanent transparent control surface/);
  assert.match(presentation, /#buildBar:not\(\.dashboardOpen\):not\(:hover\),[\s\S]*#buildBar\.dashboardOpen:hover[\s\S]*transform:translateY\(0\)/);
  assert.doesNotMatch(presentation, /#buildBar[\s\S]{0,500}translateX\(-50%\) translateY/);
  assert.match(presentation, /left:var\(--dashboard139-left,16px\)/);
  assert.match(presentation, /right:var\(--dashboard139-coach-clearance,336px\)/);
  assert.match(presentation, /\.dashboard139MainGrid[\s\S]*visibility:visible/);
  assert.match(presentation, /\.dashboard139MessageStrip[\s\S]*opacity:1/);
  assert.match(presentation, /#dashboardTrimControl[\s\S]*display:none/);
  assert.doesNotMatch(presentation, /#dashboardTrimControl\[aria-expanded="true"\]/);
  assert.match(presentation, /#dashboardTrimControl[\s\S]*font-size:0/);
  assert.match(presentation, /#dashboardTrimControl[\s\S]*background:transparent[\s\S]*box-shadow:none/);
  assert.match(source, /id="dashboardHoverTab" role="button" tabindex="0" aria-label="Open build tools"/);
  assert.match(source, /id="dashboardTrimControl"[^>]+aria-label="Open dashboard"[^>]+aria-controls="buildBar"[^>]*><\/button>/);
  assert.match(source, /dashboard\.classList\.add\("dashboardOpen"\)/);
  assert.match(source, /control\.setAttribute\("aria-hidden","true"\)/);
  assert.doesNotMatch(source, /id="builderBuildToolsTab"/);
  assert.doesNotMatch(source, /dashboard\.addEventListener\("mouseenter", openDashboard\)/);
  assert.doesNotMatch(source, /tab\.addEventListener\("pointerenter"/);
  assert.doesNotMatch(source, /dashboard\.addEventListener\("mouseenter"/);
  assert.doesNotMatch(source, /dashboard\.addEventListener\("mouseleave"/);
});

test("permanent dashboard uses polished responsive group spacing", () => {
  const presentation = source.match(
    /<style id="builderDashboardWithoutHoodTickerCSS">([\s\S]*?)<\/style>/
  )?.[1] ?? "";

  assert.match(presentation, /grid-template-columns:92px minmax\(170px,1\.08fr\) minmax\(126px,\.84fr\) minmax\(238px,1\.42fr\) minmax\(175px,1fr\)/);
  assert.match(presentation, /grid-template-rows:minmax\(0,1fr\) 24px/);
  assert.match(presentation, /\.dashboard139MissionZone[\s\S]*grid-column:1[\s\S]*grid-row:1 \/ 3/);
  assert.match(presentation, /\.dashboard139ShapeZone[\s\S]*grid-column:2[\s\S]*grid-row:1 \/ 3/);
  assert.match(presentation, /\.dashboard139BuildZone[\s\S]*grid-column:3[\s\S]*grid-row:1/);
  assert.match(presentation, /\.dashboard139UtilityZone[\s\S]*grid-column:4[\s\S]*grid-row:1/);
  assert.match(presentation, /\.dashboard139VoiceZone[\s\S]*grid-column:5[\s\S]*grid-row:1 \/ 3/);
  assert.match(presentation, /\.dashboard139MainGrid[\s\S]*gap:8px/);
  assert.match(presentation, /\.dashboard139Zone[\s\S]*padding:27px 6px 24px[\s\S]*border-radius:7px/);
  assert.match(presentation, /\.dashboard139Zone \.dashboard139ZoneLabel[\s\S]*height:20px/);
});

test("Builder message bar is centered beneath Build Tools and Utilities", () => {
  const presentation = source.match(
    /<style id="builderDashboardWithoutHoodTickerCSS">([\s\S]*?)<\/style>/
  )?.[1] ?? "";

  assert.match(source, /dashboard139VoiceZone[\s\S]*dashboard139MessageStrip[\s\S]*<\/div>\s*<\/div>/);
  assert.match(presentation, /\.dashboard139MessageStrip[\s\S]*grid-column:3 \/ 5[\s\S]*grid-row:2[\s\S]*align-self:end[\s\S]*left:auto[\s\S]*right:auto[\s\S]*width:auto/);
  assert.match(presentation, /#toolMessage\.bottomToolMessage[\s\S]*color:#effcff[\s\S]*background:rgba\(3,19,29,\.74\)[\s\S]*font-size:11px/);
});

test("dashboard colors and button faces are compact and readable", () => {
  const presentation = source.match(
    /<style id="builderDashboardWithoutHoodTickerCSS">([\s\S]*?)<\/style>/
  )?.[1] ?? "";

  assert.match(presentation, /#returnMissionsButton[\s\S]*width:84px[\s\S]*height:74px/);
  assert.match(presentation, /colorScrollWrap[\s\S]*grid-template-columns:30px minmax\(0,1fr\) 30px/);
  assert.match(presentation, /#colorSwatchBar[\s\S]*overflow-x:scroll[\s\S]*scrollbar-gutter:stable/);
  assert.match(presentation, /#bottomBuildTools\.dashboardGreenTools button[\s\S]*height:33px/);
  assert.match(presentation, /\.dashboardUtilityButtons button[\s\S]*height:34px/);
});

test("Builder dashboard shell matches the transparent View placeholder", () => {
  const presentation = source.match(
    /<style id="builderDashboardWithoutHoodTickerCSS">([\s\S]*?)<\/style>/
  )?.[1] ?? "";

  assert.match(presentation, /#buildBar[\s\S]*border:1px solid rgba\(202,164,53,.58\)/);
  assert.match(presentation, /#buildBar[\s\S]*background:linear-gradient\(180deg,rgba\(20,34,48,.18\),rgba\(8,18,29,.12\)\)/);
  assert.match(presentation, /#buildBar::before,[\s\S]*#buildBar::after[\s\S]*content:none/);
  assert.match(presentation, /#buildBar\.dashboardOpen::before,[\s\S]*#buildBar:hover::after[\s\S]*content:none[\s\S]*display:none/);
  assert.doesNotMatch(presentation, /border-top-color:#d8aa35/);
  assert.doesNotMatch(presentation, /linear-gradient\(180deg,#173447 0%,#0a2231 55%,#071722 100%\)/);
});
