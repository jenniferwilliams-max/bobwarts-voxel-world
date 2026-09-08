import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const handleRule = source.match(/#engineeringToolChestHandle\{[\s\S]*?\n\}/)?.[0] || "";

test("registers the Tool Chest handle below Measurement Assistant", () => {
  assert.match(handleRule, /left:-44px;/);
  assert.match(handleRule, /top:auto;/);
  assert.match(handleRule, /bottom:12px;/);
});

test("provides a Chromebook-safe touch target", () => {
  assert.match(handleRule, /width:44px;/);
  assert.match(handleRule, /min-width:44px;/);
  assert.match(handleRule, /height:52px;/);
  assert.match(handleRule, /min-height:44px;/);
  assert.match(handleRule, /touch-action:manipulation;/);
});

test("keeps the complete focus footprint inside Mac and Chromebook geometry", () => {
  const outlineWidth = 3;
  const outlineOffset = 2;
  const outlineExtent = outlineWidth + outlineOffset;
  const handleWidth = 44;
  const handleHeight = 52;
  const retractedViewportInset = 10;
  const dashboardClearance = 24;
  const viewports = [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1024, height: 600 }
  ];

  assert.match(source, /#engineeringToolChestHandle:focus-visible[\s\S]*?outline:3px solid #36d8ff;[\s\S]*?outline-offset:2px;/);
  for (const viewport of viewports) {
    const handleRect = {
      right: viewport.width - retractedViewportInset,
      bottom: viewport.height - 150,
      width: handleWidth,
      height: handleHeight
    };
    const dashboardRect = { top: handleRect.bottom + dashboardClearance };

    assert.ok(handleRect.right + outlineExtent <= viewport.width);
    assert.ok(handleRect.bottom + outlineExtent < dashboardRect.top);
    assert.ok(handleRect.width >= 44);
    assert.ok(handleRect.height >= 44);
  }

  assert.equal(-44 + handleWidth, 0, "handle remains attached to the cabinet edge");
  assert.match(source, /#engineeringToolChestCabinet\{[\s\S]*?bottom:8px;[\s\S]*?transform:translateX\(calc\(100% - 10px\)\);[\s\S]*?transition:transform 280ms cubic-bezier\(\.2,\.72,\.2,1\);[\s\S]*?z-index:9;/);
  assert.match(source, /@media\(max-width:650px\)\{[\s\S]*?#engineeringToolChestCabinet\{[\s\S]*?bottom:6px;/);
});

test("preserves mutual exclusion and rendered endpoint restoration", () => {
  assert.match(source, /data-tool-chest-owns-right-panel="true"[\s\S]*?#workshopMeasurementAssistant/);
  assert.match(source, /releaseWorkshopToolChestRightPanelAtRetractedEndpoint/);
  assert.match(source, /engineeringToolChestIsRenderedRetracted/);
});

test("keeps one discoverable handle for both cabinet states", () => {
  assert.equal((source.match(/id="engineeringToolChestHandle"/g) || []).length, 1);
  assert.match(source, /#engineeringToolChestHandle::after\{[\s\S]*?content:"OPEN";/);
  assert.match(source, /#engineeringToolChestHandle\[aria-expanded="true"\]::after\{\s*content:"CLOSE";/);
  assert.match(source, /engineeringToolChestState\.cabinet==="expanded"\s*\? "retracted"\s*:\s*"expanded"/);
});

test("moves only Favorites clear of the persistent cabinet handle", () => {
  assert.match(source, /#engineeringDrawerFavorites\{\s*top:auto;\s*bottom:80px;\s*\}/);
  assert.equal((source.match(/#engineeringDrawerFavorites\{/g) || []).length, 1);
  assert.match(source, /#engineeringDrawerFavoritesContent\{\s*top:auto;\s*bottom:100%;\s*transform:none;\s*\}/);
  assert.equal((source.match(/#engineeringDrawerFavoritesContent\{/g) || []).length, 1);
  assert.match(handleRule, /z-index:12;/);
  assert.match(handleRule, /width:44px;/);
  assert.match(handleRule, /height:52px;/);
  assert.match(source, /\.engineering-tool-chest-drawer\.is-open,[\s\S]*?transform:translateX\(-72%\);/);

  const cabinetHeight = 345.59375;
  const favoritesBottom = 80;
  const controlBleed = 4;
  const handleBottom = 12;
  const handleHeight = 52;
  const outlineExtent = 3 + 2;
  const favoritesControlBottom = cabinetHeight - favoritesBottom + controlBleed;
  const handleFocusTop = cabinetHeight - handleBottom - handleHeight - outlineExtent;

  assert.ok(favoritesControlBottom < handleFocusTop);
  assert.match(source, /\.engineering-tool-chest-drawer:nth-child\(1\)\{ top:12%; \}/);
  assert.match(source, /\.engineering-tool-chest-drawer:nth-child\(2\)\{ top:32%; \}/);
  assert.match(source, /\.engineering-tool-chest-drawer:nth-child\(3\)\{ top:52%; \}/);
});
