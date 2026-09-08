import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("wires one Parts & Objects adapter and view without changing lifecycle ownership", () => {
  assert.equal((source.match(/tool-chest-parts-objects-adapter\.mjs/g) || []).length, 1);
  assert.equal((source.match(/tool-chest-parts-objects-view\.mjs/g) || []).length, 1);
  assert.match(source, /partsObjectsAdapterModule\.createToolChestPartsObjectsAdapter/);
  assert.match(source, /partsObjectsViewModule\.createToolChestPartsObjectsView/);
  assert.match(source, /drawerName==="parts-objects" && isExpanded[\s\S]*?\.refresh\(\)/);
  assert.match(source, /function resetEngineeringToolChest\(\)[\s\S]*?workshopToolChestPartsObjectsView\.reset\(\)/);
});

test("authoritative Library keys are unique and placement functions remain singular", () => {
  const keys = [...source.matchAll(/data-object-library-key="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(keys.length, 41);
  assert.equal(new Set(keys).size, keys.length);
  for (const name of ["addBuilding", "addTree", "addBridgeBeam", "buildPlantCell"]) {
    assert.equal((source.match(new RegExp(`function ${name}\\(`, "g")) || []).length, 1);
  }
});

test("uses explicit trusted actions and never reads Favorites or dynamic action strings", () => {
  const wiring = source.match(/createToolChestPartsObjectsAdapter\(\{[\s\S]*?\n\s*\}\);/)?.[0] || "";
  assert.match(wiring, /actions:Object\.freeze\(\{/);
  assert.doesNotMatch(wiring, /favoriteData|toggleFavorite|\.getAttribute\(["']onclick|\beval\s*\(|\bFunction\s*\(/);
  assert.doesNotMatch(wiring, /plantCell:|animalCell:|cellWall:|nucleus:/);
  const adapterSource = readFileSync(new URL(
    "../../js/workshop/toolchest/tool-chest-parts-objects-adapter.mjs",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(adapterSource, /APPROVED_PARTS_OBJECT_KEYS|DEFERRED_PARTS_OBJECT_KEYS/);
  assert.match(adapterSource, /querySelectorAll\("button\[data-object-library-key\]"\)/);
});

test("provides one contained Chromebook-friendly native scroll owner", () => {
  assert.match(source, /id="engineeringDrawerPartsObjectsContent"[^>]*role="region"[^>]*tabindex="0"/);
  assert.match(source, /\.engineering-parts-objects-drawer\{[\s\S]*?overflow-y:auto;[\s\S]*?overscroll-behavior:contain;[\s\S]*?touch-action:pan-y;/);
  assert.match(source, /scrollbar-color:#65ff68 #102631/);
  assert.match(source, /engineering-parts-objects-drawer::-webkit-scrollbar-thumb/);
  assert.match(source, /\.engineering-parts-object-tile\{[\s\S]*?min-height:84px[\s\S]*?grid-template-rows:42px auto auto/);
  assert.match(source, /\.engineering-parts-object-thumbnail\{[\s\S]*?font-size:32px/);
  assert.match(source, /\.engineering-parts-object-tile \.engineering-object-tile-name\{[\s\S]*?color:#f4feff/);
  assert.match(source, /event\.target\.closest\("#engineeringDrawerPartsObjectsContent"\)/);
});

test("keeps Favorites and canonical Workshop ownership unchanged", () => {
  assert.match(source, /id="engineeringDrawerFavoritesContent"[\s\S]*?Coming in a future Workshop update/);
  assert.doesNotMatch(source, /engineeringDrawerFavoritesContent[\s\S]{0,500}partsObjects/);
});
