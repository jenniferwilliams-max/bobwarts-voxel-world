import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("rulers expose X and Z identity without duplicate controls", () => {
  assert.equal((source.match(/class="workshop-ruler-axis-label"/g) || []).length, 4);
  assert.match(source, /workshopRulerTop[^>]+data-workshop-axis="x"[^>]+X-axis ruler/);
  assert.match(source, /workshopRulerBottom[^>]+data-workshop-axis="x"[^>]+X-axis ruler/);
  assert.match(source, /workshopRulerLeft[^>]+data-workshop-axis="z"[^>]+Z-axis ruler/);
  assert.match(source, /workshopRulerRight[^>]+data-workshop-axis="z"[^>]+Z-axis ruler/);
  assert.doesNotMatch(source.slice(source.indexOf("<section id=\"workshopRoot\""),
    source.indexOf("</section>", source.indexOf("workshopRulerBottom"))), /model Y-axis ruler/);
});

test("real-coordinate landmark rendering and centimeter-only presentation are preserved", () => {
  assert.match(source, /var isLandmark=isMajor && Math\.abs\(value%5\)<1e-8/);
  assert.match(source, /if\(isMajor && \(!centimeterOnly \|\| isLandmark\)\)/);
  assert.match(source, /label\.textContent=normalizedValue>0/);
  assert.match(source, /workshop-ruler-label:is\(\.is-origin,\.is-range-start,\.is-range-end\)/);
  assert.match(source, /var subdivisions=centimeterOnly\s*\? 1/);
});

test("origin ring is decorative and excluded from engineering interaction", () => {
  assert.match(source, /new THREE\.RingGeometry/);
  assert.match(source, /workshopCadOriginMarker\.position\.set\(0,markerSettings\.elevation,0\)/);
  assert.match(source, /workshopCadOriginMarker\.raycast=function\(\)\{\}/);
  assert.match(source, /workshopCadOriginMarker\.userData\.workshopDecoration=true/);
  assert.match(source, /workshopCadOriginMarker\.userData\.workshopNonInteractive=true/);
  assert.doesNotMatch(source, /blocks\.push\(workshopCadOriginMarker\)/);
});

test("selection reuses emissive ownership and restores the exact original color", () => {
  const start = source.indexOf("function setWorkshopBlockSelectionHighlight");
  const end = source.indexOf("function syncWorkshopSelectionMeasurements", start);
  const selection = source.slice(start, end);
  assert.match(selection, /emissive\.setHex\(0x00b7e8\)/);
  assert.match(selection, /workshopSelectionEmissive = block\.material\.emissive\.getHex\(\)/);
  assert.match(selection, /block\.userData\.workshopSelectionEmissive/);
  assert.doesNotMatch(selection, /OutlinePass|new THREE\.(Line|Mesh|Group)/);
});

test("each selected item receives one brass non-interactive presentation frame", () => {
  const start=source.indexOf("function disposeWorkshopSelectionFrame");
  const end=source.indexOf("function syncWorkshopSelectionMeasurements",start);
  const presentation=source.slice(start,end);
  assert.match(presentation,/new THREE\.Box3Helper\(bounds\.clone\(\),0xe3b83f\)/);
  assert.match(presentation,/frame\.raycast=function\(\)\{\}/);
  assert.match(presentation,/frame\.userData\.workshopDecoration=true/);
  assert.match(presentation,/frame\.userData\.workshopNonInteractive=true/);
  assert.match(presentation,/workshopSelectionFrames\.set\(object,frame\)/);
  assert.match(presentation,/frame\.geometry\.dispose\(\)/);
  assert.match(presentation,/frame\.material\.dispose\(\)/);
  assert.doesNotMatch(presentation,/blocks\.push|raycaster\.intersect/);
});

test("compact status and separate polite announcement reuse canonical owners", () => {
  assert.equal((source.match(/id="workshopEngineeringFeedbackStatus"/g) || []).length, 1);
  assert.equal((source.match(/id="workshopEngineeringFeedbackAnnouncement"/g) || []).length, 1);
  assert.match(source, /workshopEngineeringFeedbackAnnouncement[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(source, /boundary=workshopActiveWorkspaceBoundary &&[\s\S]*?workshopActiveWorkspaceBoundary\.read\(\)/);
  assert.match(source, /unit:workshopMeasurementUnit/);
  assert.match(source, /announce:source==="HOME"/);
  assert.match(source, /workshopDashboardPrecision" role="status" aria-live="polite"/);
  assert.match(source, /syncWorkshopCadEngineeringFeedback\(\{announce:false\}\)/);
});

test("axis badges and compact status fit existing Chromebook ruler geometry", () => {
  assert.match(source, /\.workshop-ruler-axis-label\{[\s\S]*?min-width:14px;[\s\S]*?height:14px;/);
  assert.match(source, /@media\(max-width:650px\)[\s\S]*?grid-template-columns:32px minmax\(0,1fr\) 32px;[\s\S]*?grid-template-rows:28px minmax\(0,1fr\) 28px;/);
  assert.match(source, /#workshopEngineeringFeedbackStatus\{[\s\S]*?font:700 10px\/1\.3/);
  assert.doesNotMatch(source.slice(
    source.indexOf("#workshopEngineeringFeedbackStatus{"),
    source.indexOf("#workshopEngineeringFeedbackStatus:empty"),
  ), /position:absolute|white-space:nowrap/);
});
