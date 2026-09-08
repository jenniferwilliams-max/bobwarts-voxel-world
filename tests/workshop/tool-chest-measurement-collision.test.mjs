import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("Tool Chest owns the right rail without unmounting Measurement Assistant", () => {
  assert.match(source, /#workshopRightPanelShell\[data-tool-chest-owns-right-panel="true"\][\s\S]*?#workshopMeasurementAssistant\{[\s\S]*?visibility:hidden !important;[\s\S]*?pointer-events:none !important;/);
  assert.doesNotMatch(source, /data-tool-chest-owns-right-panel="true"[\s\S]{0,220}display:none/);
  assert.match(source, /shell\.dataset\.toolChestOwnsRightPanel=shouldOwn \? "true" : "false"/);
});

test("Measurement Assistant stays above the dashboard and reserves the handle rail", () => {
  const rule=source.match(/body\.workshopMode:not\(\.starterScreenActive\) #workshopMeasurementAssistant\{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(rule,/top:4px;/);
  assert.match(rule,/bottom:89px;/);
  assert.match(rule,/max-height:calc\(100% - 93px\);/);
  assert.match(rule,/overflow-y:auto;/);
  assert.match(rule,/overscroll-behavior:contain;/);
});

test("transformed cabinet stacks above the restored Assistant", () => {
  const cabinetRule=source.match(/#engineeringToolChestCabinet\{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(cabinetRule,/transform:translateX\(calc\(100% - 10px\)\);/);
  assert.match(cabinetRule,/z-index:9;/);
  assert.match(source, /#workshopMeasurementAssistant\{[\s\S]*?z-index:8;/);
});

test("Measurement Assistant exposes an engineering-green cross-browser scrollbar", () => {
  assert.match(source, /#workshopMeasurementAssistant\{[\s\S]*?scrollbar-width:auto;[\s\S]*?scrollbar-color:#65ff68 #092331;/);
  assert.match(source, /#workshopMeasurementAssistant::\-webkit-scrollbar\{\s*width:14px;/);
  assert.match(source, /#workshopMeasurementAssistant::\-webkit-scrollbar-track\{[\s\S]*?background:#092331;/);
  assert.match(source, /#workshopMeasurementAssistant::\-webkit-scrollbar-thumb\{[\s\S]*?min-height:36px;[\s\S]*?background:#65ff68;/);
  assert.match(source, /#workshopMeasurementAssistant::\-webkit-scrollbar-thumb:hover\{[\s\S]*?background:#b9f548;/);
});

test("suppressed Measurement Assistant is inert and hidden from accessibility", () => {
  assert.match(source, /assistant\.toggleAttribute\("inert",shouldOwn\)/);
  assert.match(source, /if\(shouldOwn\) assistant\.setAttribute\("aria-hidden","true"\)/);
  assert.match(source, /else assistant\.removeAttribute\("aria-hidden"\)/);
  assert.match(source, /assistant\.contains\(document\.activeElement\) && handle[\s\S]*?handle\.focus\(\{preventScroll:true\}\)/);
});

test("expansion claims presentation before the existing cabinet state changes", () => {
  const setter = source.match(/function setEngineeringToolChestCabinetState\(state\)\{[\s\S]*?return requestedState;\s*\}/)?.[0] || "";
  assert.match(setter, /if\(requestedState==="expanded"\)\{\s*setWorkshopToolChestRightPanelOwnership\(true\);/);
  assert.ok(setter.indexOf("setWorkshopToolChestRightPanelOwnership(true)") < setter.indexOf("toolChest.dataset.cabinetState=requestedState"));
  assert.match(setter, /control\.tabIndex=requestedState==="expanded" \? 0 : -1/);
  assert.match(setter, /verifyWorkshopToolChestCollisionRelease\(collisionToken\)/);
});

test("retraction restores Measurement only at the rendered endpoint", () => {
  assert.match(source, /function engineeringToolChestIsRenderedRetracted\(\)[\s\S]*?Math\.abs\(translateX-Math\.max\(0,width-10\)\)<=1\.5/);
  assert.match(source, /toolChest\.dataset\.cabinetState!=="retracted"[\s\S]*?!engineeringToolChestIsRenderedRetracted\(\)/);
  assert.match(source, /cabinet\.addEventListener\("transitionend"[\s\S]*?event\.propertyName!=="transform"[\s\S]*?releaseWorkshopToolChestRightPanelAtRetractedEndpoint\(\)/);
  assert.match(source, /window\.requestAnimationFrame\(function\(\)\{\s*window\.requestAnimationFrame/);
});

test("reversal, reset, Mission restoration, and repeated use reject stale release", () => {
  assert.match(source, /var collisionToken=\+\+workshopToolChestCollisionReleaseToken/);
  assert.match(source, /if\(token!==workshopToolChestCollisionReleaseToken\) return/);
  assert.match(source, /function resetEngineeringToolChest\(\)[\s\S]*?setEngineeringToolChestCabinetState\("retracted"\);[\s\S]*?workshopToolChestCollisionReleaseToken\+=1;[\s\S]*?setWorkshopToolChestRightPanelOwnership\(false\)/);
  assert.match(source, /if\(requestedMode==="workshop"\)[\s\S]*?resetEngineeringToolChest\(\);[\s\S]*?else if\(currentWorkspaceMode==="workshop"\)[\s\S]*?resetEngineeringToolChest\(\)/);
});

test("canonical Tool Chest endpoints and timing remain unchanged", () => {
  assert.match(source, /#engineeringToolChestCabinet\{[\s\S]*?transform:translateX\(calc\(100% - 10px\)\);[\s\S]*?transition:transform 280ms cubic-bezier\(\.2,\.72,\.2,1\);/);
  assert.match(source, /#engineeringToolChest\[data-cabinet-state="expanded"\] #engineeringToolChestCabinet\{\s*transform:translateX\(0\);/);
});
