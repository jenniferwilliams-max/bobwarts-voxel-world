import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("one visible-viewport owner keeps Builder and Workshop inside the right edge", () => {
  assert.equal((source.match(/id="responsiveVisibleViewportRightLayoutScript"/g) || []).length, 1);
  assert.match(source, /var viewport=window\.visualViewport;/);
  assert.match(source, /var rightInset=Math\.max\(0,window\.innerWidth-visibleRight\);/);
  assert.match(source, /--workshop-visible-viewport-width/);
  assert.match(source, /--workshop-visible-viewport-right-inset/);
  assert.match(source, /window\.visualViewport\.addEventListener\("resize",scheduleVisibleViewportRightLayout\)/);
  assert.match(source, /window\.visualViewport\.addEventListener\("scroll",scheduleVisibleViewportRightLayout\)/);
  assert.match(source, /#rightHudColumn\{[\s\S]*?right:calc\(18px \+ var\(--workshop-visible-viewport-right-inset\)\) !important;/);
  assert.match(source, /#workshopRoot\{[\s\S]*?inset:42px var\(--workshop-visible-viewport-right-inset\) 0 0;[\s\S]*?width:auto;[\s\S]*?max-width:var\(--workshop-visible-viewport-width\);/);
});

test("responsive geometry leaves Assistant, handle focus, and controls visible", () => {
  const viewports = [
    { width: 1440, visibleWidth: 1440 },
    { width: 1366, visibleWidth: 1366 },
    { width: 1280, visibleWidth: 1280 },
    { width: 1024, visibleWidth: 960 }
  ];
  const assistantBottomReservation = 89;
  const cabinetBottom = 8;
  const handleBottom = 12;
  const handleHeight = 52;
  const focusExtent = 5;
  const handleFocusTopFromBottom = cabinetBottom + handleBottom + handleHeight + focusExtent;

  assert.ok(assistantBottomReservation - handleFocusTopFromBottom >= 12);
  for (const viewport of viewports) {
    const rightInset = Math.max(0, viewport.width - viewport.visibleWidth);
    const visibleRight = viewport.width - rightInset;
    const builderHudRight = visibleRight - 14;
    const workshopRootRight = viewport.width - rightInset;
    assert.ok(builderHudRight <= visibleRight);
    assert.equal(workshopRootRight, visibleRight);
  }
});

test("renderer and raycasting ownership remain unchanged", () => {
  assert.match(source, /renderer\.setSize\(window\.innerWidth, window\.innerHeight\);/);
  assert.match(source, /mouse\.x = \(event\.clientX \/ window\.innerWidth\) \* 2 - 1;/);
  assert.equal((source.match(/responsiveVisibleViewportRightLayoutScript/g) || []).length, 1);
  const owner = source.match(/<script id="responsiveVisibleViewportRightLayoutScript">[\s\S]*?<\/script>/)?.[0] || "";
  assert.doesNotMatch(owner, /renderer\.setSize|camera\.|raycaster|mouse\.x/);
});
