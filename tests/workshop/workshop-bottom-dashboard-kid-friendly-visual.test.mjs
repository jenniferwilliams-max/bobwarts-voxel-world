import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const designPanel=source.slice(
  source.indexOf('<section id="workshopPanelBuild"'),
  source.indexOf('<section id="workshopPanelEdit"')
);
const moreToolsPanel=source.slice(
  source.indexOf('<section id="workshopPanelEdit"'),
  source.indexOf('<section id="workshopPanelPrecision"')
);
const themeStart=source.indexOf("/* Workshop unified Design dashboard:");
const themeEnd=source.indexOf("</style>",themeStart);
const theme=source.slice(themeStart,themeEnd);

const routes=[
  ["workshopTabBuild","workshopPanelBuild","build","Design","🛠"],
  ["workshopTabEdit","workshopPanelEdit","edit","More Tools","🧰"],
  ["workshopTabPrecision","workshopPanelPrecision","precision","Measure","📏"],
  ["workshopTabPlanTrace","workshopPanelPlanTrace","plan-trace","Plan","📐"],
  ["workshopTabArrange","workshopPanelArrange","arrange","Arrange","🧩"],
  ["workshopTabProject","workshopPanelProject","project","Project","📁"],
  ["workshopTabThinkerBob","workshopPanelThinkerBob","thinker-bob","THINKer BOB","🤖"]
];

test("seven routes keep their IDs and behavior with student-facing labels", () => {
  assert.equal((source.match(/id="workshopTab[^" ]+"[^>]*role="tab"/g)||[]).length,7);
  assert.equal((source.match(/data-workshop-console-panel="[^"]+"/g)||[]).length,7);
  for(const [tabId,panelId,route,label,icon] of routes){
    assert.match(
      source,
      new RegExp(`id="${tabId}"[^>]*aria-controls="${panelId}"[^>]*onclick="setWorkshopConsoleTab\\('${route}'\\)"[^>]*><span class="workshop-tab-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`)
    );
    assert.match(source,new RegExp(`id="${panelId}"[\\s\\S]*?data-workshop-console-panel="${route}"`));
  }
  assert.match(source,/id="workshopTabBuild"[^>]*aria-selected="true"/);
  assert.match(source,/setWorkshopConsoleTab\("build"\)/);
  assert.doesNotMatch(source,/setWorkshopConsoleTab\(['"]design['"]\)/);
});

test("Design combines Make Change and Fix without duplicating core controls", () => {
  assert.match(designPanel,/id="workshopBuildShapesLabel">Design tools</);
  assert.match(designPanel,/id="workshopDesignMakeLabel"[^>]*>Make</);
  assert.match(designPanel,/id="workshopDesignChangeLabel"[^>]*>Change</);
  assert.match(designPanel,/id="workshopDesignFixLabel"[^>]*>Fix</);

  const controls={
    workshopShapeCube:"chooseWorkshopBuildShape\\('cube'\\)",
    workshopShapeSphere:"chooseWorkshopBuildShape\\('sphere'\\)",
    workshopShapeWedge:"chooseWorkshopBuildShape\\('trianglePrism'\\)",
    workshopSelectButton:"startSelectMode\\(\\)",
    workshopMoveButton:"startMoveSelected\\(\\)",
    workshopCancelMoveButton:"cancelWorkshopMove",
    workshopRotateRightButton:"rotateWorkshopSelectionRight\\(\\)",
    workshopGrowButton:"resizeWorkshopSelection\\(1\\)",
    workshopShrinkButton:"resizeWorkshopSelection\\(-1\\)",
    workshopUndoButton:"undoLast\\(\\)",
    workshopRedoButton:"redoLast\\(\\)",
    workshopDeleteButton:"deleteWorkshopSelectedStructure\\(\\)"
  };
  for(const [id,handler] of Object.entries(controls)){
    assert.equal((source.match(new RegExp(`id="${id}"`,"g"))||[]).length,1,id);
    assert.match(designPanel,new RegExp(`id="${id}"[^>]*onclick="[^"]*${handler}`));
  }
  assert.match(designPanel,/id="workshopCancelMoveButton"[^>]*hidden disabled/);
  assert.match(designPanel,/id="workshopSelectButton"[^>]*aria-pressed="false"[^>]*onclick="startSelectMode\(\)"[\s\S]*?<span>Select One<\/span>/);
  assert.match(designPanel,/id="workshopSelectMultipleButton"[^>]*aria-pressed="false"[^>]*onclick="startWorkshopSelectMultiple\(\)"[^>]*><span class="workshop-selection-label"><span>SELECT<\/span><span>MULTIPLE<\/span><\/span><span class="workshop-control-icon" aria-hidden="true">⊞<\/span>/);
  assert.match(designPanel,/id="workshopSelectConnectedButton"[^>]*aria-label="Select Stack"[^>]*aria-pressed="false"[^>]*onclick="startWorkshopSelectStack\(\)"[^>]*><span class="workshop-selection-label"><span>SELECT<\/span><span>STACK<\/span><\/span><span class="workshop-control-icon" aria-hidden="true">▤<\/span>/);
  assert.match(designPanel,/id="workshopClearSelectionButton"[^>]*onclick="clearWorkshopSelectionCommand\(\)"[^>]*disabled/);
  assert.match(designPanel,/id="workshopDoneSelectionButton"[^>]*onclick="finishWorkshopSelectMultiple\(\)"[^>]*hidden disabled/);
  assert.match(designPanel,/id="workshopCancelSelectionButton"[^>]*onclick="cancelWorkshopSelectMultiple\(\)"[^>]*hidden disabled/);
});

test("Parts and Objects delegates to the Tool Chest owner", () => {
  assert.equal((source.match(/id="workshopPartsObjectsButton"/g)||[]).length,1);
  assert.match(
    designPanel,
    /id="workshopPartsObjectsButton"[^>]*onclick="toggleEngineeringToolChestDrawer\('parts-objects'\)"/
  );
  assert.match(designPanel,/id="workshopPartsObjectsButton"[\s\S]*?class="workshop-control-icon workshop-parts-symbols"[^>]*>[\s\S]*?<span>🏢<\/span><span>🚀<\/span>/);
  assert.match(source,/window\.toggleEngineeringToolChestDrawer=toggleEngineeringToolChestDrawer/);
});

test("future controls live only in the retained More Tools route", () => {
  assert.match(moreToolsPanel,/id="workshopEditToolsLabel">More tools</);
  for(const label of ["Cylinder","Cone","Pyramid","Custom Shape","Duplicate"]){
    assert.doesNotMatch(designPanel,new RegExp(`>${label}</button>`));
    assert.match(moreToolsPanel,new RegExp(`<button type="button" disabled>${label}</button>`));
  }
});

test("Quick Access and accessible dashboard language remain authoritative", () => {
  assert.match(source,/id="workshopDashboard"[^>]*aria-label="Workshop design tools, Advanced mode"/);
  assert.match(source,/id="workshopConsoleTabs"[^>]*aria-label="Workshop tool areas"/);
  assert.equal((source.match(/id="workshopQuick(?:Select|Undo|Delete|Screenshot|Help)"/g)||[]).length,5);
  assert.doesNotMatch(source,/id="workshopQuickCube"/);
  assert.match(source,/quickToolbar\.insertBefore\(modeSwitch,quickToolbar\.firstElementChild\)/);
  assert.match(source,/"Workshop design tools, "[\s\S]*?"Advanced mode"/);
});

test("Builder-style theme preserves state and Chromebook geometry contracts", () => {
  assert.notEqual(themeStart,-1);
  assert.match(theme,/--workshop-dash-navy:#09263a/);
  assert.match(theme,/--workshop-dash-brass:#e3b83f/);
  assert.match(theme,/--workshop-dash-cyan:#7fefff/);
  assert.match(theme,/--workshop-dash-lime:#b9f548/);
  assert.match(theme,/--workshop-dash-coral:#ff806d/);
  assert.equal((theme.match(/url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\)/g)||[]).length,2);
  assert.match(theme,/#workshopQuickAccessToolbar button,[\s\S]*?background-image:var\(--workshop-builder-face\)[\s\S]*?background-size:100% 100%/);
  assert.match(theme,/#workshopConsoleTabs button\{[\s\S]*?border:2px solid var\(--workshop-dash-brass\)[\s\S]*?background:linear-gradient\(180deg,#123e59,#071f31\)/);
  assert.match(theme,/#workshopConsoleTabs \.workshop-tab-icon\{[\s\S]*?font-size:16px/);
  assert.match(theme,/\.workshop-design-groups\{[\s\S]*?grid-template-columns:minmax\(285px,4fr\) minmax\(420px,6fr\) minmax\(220px,3fr\)/);
  assert.match(theme,/\.workshop-design-group\.is-change \.workshop-design-group-controls\{[\s\S]*?grid-template-columns:repeat\(8,minmax\(44px,1fr\)\);[\s\S]*?gap:2px/);
  assert.doesNotMatch(theme,/\.workshop-design-group\.is-change \.workshop-design-group-controls\{[\s\S]*?1\.7fr/);
  assert.match(theme,/\.workshop-design-group-controls button\[hidden\]\{[\s\S]*?display:none !important/);
  assert.match(theme,/#workshopSelectMultipleButton,[\s\S]*?#workshopSelectConnectedButton\{[\s\S]*?flex-flow:column nowrap;[\s\S]*?gap:0/);
  assert.match(theme,/#workshopSelectMultipleButton \.workshop-selection-label,[\s\S]*?#workshopSelectConnectedButton \.workshop-selection-label\{[\s\S]*?display:grid;[\s\S]*?grid-template-rows:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?place-items:center;[\s\S]*?font-size:8px;[\s\S]*?white-space:nowrap/);
  assert.match(theme,/#workshopSelectMultipleButton \.workshop-selection-label > span,[\s\S]*?#workshopSelectConnectedButton \.workshop-selection-label > span\{[\s\S]*?display:block;[\s\S]*?white-space:nowrap/);
  assert.match(theme,/#workshopSelectMultipleButton \.workshop-control-icon,[\s\S]*?#workshopSelectConnectedButton \.workshop-control-icon\{[\s\S]*?font-size:15px/);
  assert.match(theme,/#workshopSelectConnectedButton \.workshop-selection-label\{[\s\S]*?place-items:center/);
  assert.match(theme,/\.workshop-design-group-controls button\{[\s\S]*?min-height:44px/);
  assert.match(theme,/button\[aria-selected="true"\]/);
  assert.match(theme,/button\[aria-pressed="true"\]/);
  assert.match(theme,/#workshopSelectButton\[aria-pressed="true"\]::after/);
  assert.match(theme,/#workshopEngineeringViewControls button\[aria-pressed="true"\]::after/);
  assert.match(theme,/button:disabled/);
  assert.match(theme,/#workshopDeleteButton[\s\S]*?#workshopQuickDelete/);
  assert.match(theme,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme,/transition:none/);
  assert.doesNotMatch(theme,/#buildBar|dashboard-ticker|dashboard-hood|button-face-master|return-to-missions\.png/);

  assert.match(theme,/#workshopEngineeringViewControls button\[data-workshop-view\]\{[\s\S]*?--workshop-view-highlight:#236b9b;[\s\S]*?--workshop-view-base:#082d50;[\s\S]*?--workshop-view-shadow:#031323/);
  assert.doesNotMatch(theme,/#workshopView(?:Top|Front|Back|Left|Right|Bottom)\{/);
  assert.match(theme,/#workshopViewHome\{[\s\S]*?--workshop-view-highlight:#24708d;[\s\S]*?--workshop-view-base:#0b3a55;[\s\S]*?--workshop-view-shadow:#041d2c;[\s\S]*?display:flex;[\s\S]*?flex-flow:row nowrap;[\s\S]*?align-items:center;[\s\S]*?white-space:nowrap/);
  assert.match(theme,/#workshopEngineeringViewControls button\[data-workshop-view\]\{[\s\S]*?border-image-source:var\(--workshop-builder-face\)[\s\S]*?border-image-slice:30/);
  assert.match(theme,/#workshopQuickAccessToolbar\{[\s\S]*?grid-template-columns:minmax\(104px,1\.85fr\) repeat\(5,minmax\(44px,1fr\)\);[\s\S]*?gap:2px/);
  assert.match(theme,/#workshopQuickAccessToolbar #workspaceModeSwitch\{[\s\S]*?width:100%;[\s\S]*?height:44px;[\s\S]*?background-image:url\("assets\/images\/dashboard\/button-faces\/builder-shortcut-grid-frame-glow\.png"\);[\s\S]*?font:900 10px\/1\.05 "Lexend"/);
  assert.match(theme,/#workshopQuickAccessToolbar #workspaceModeSwitch \.workspaceModeIcon\{[\s\S]*?display:none/);
  assert.match(source,/label\.innerHTML='<span class="workspaceModeReturnLine"><span class="majorNavigationArrow is-back workspaceModeReturnIcon" aria-hidden="true"><\/span><span class="workspaceModeReturnWords">RETURN TO<\/span><\/span><span class="workspaceModeBuilderLine">BUILDER<\/span>'/);
  assert.match(theme,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeLabel\{[\s\S]*?color:#dffaff;[\s\S]*?text-transform:uppercase;[\s\S]*?white-space:normal;[\s\S]*?text-shadow:none/);
  assert.match(theme,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeReturnIcon\{[\s\S]*?color:#7fefff;[\s\S]*?text-shadow:none/);
  assert.match(theme,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeReturnWords\{[\s\S]*?color:#bff7ff;[\s\S]*?text-shadow:none/);
  assert.match(theme,/#workshopQuickAccessToolbar #workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeLabel\{[\s\S]*?flex-direction:column;[\s\S]*?white-space:normal/);
  assert.match(theme,/#workspaceModeSwitch\[aria-pressed="true"\] \.workspaceModeReturnLine\{[\s\S]*?justify-content:center;[\s\S]*?font:900 10px/);
  assert.doesNotMatch(theme,/workspaceModeMissionLine/);
  assert.match(theme,/#workshopViewHome \.workshop-control-icon\{[\s\S]*?font-size:18px/);
  assert.match(theme,/#workshopViewHome > span,[\s\S]*?color:#83ff72/);
  assert.match(theme,/#workshopViewHome small\{[\s\S]*?display:none/);
  assert.match(theme,/\.workshop-design-group-controls button\{[\s\S]*?font-size:11px/);
  assert.match(theme,/#workshopQuickAccessToolbar button\{[\s\S]*?font-size:10px/);
  assert.match(theme,/\.workshop-parts-symbols\{[\s\S]*?grid-template-columns:repeat\(2,16px\)/);
  assert.match(theme,/#workshopSelectButton\[aria-pressed="true"\],[\s\S]*?#workshopSelectMultipleButton\[aria-pressed="true"\],[\s\S]*?#workshopSelectConnectedButton\[aria-pressed="true"\]\{[\s\S]*?inset 0 0 0 3px #bdf9ff/);
  assert.match(theme,/filter:brightness\(1\.28\) saturate\(1\.18\)/);

  assert.match(source,/body\.workshopMode:not\(\.starterScreenActive\) #workshopDashboard\{\s*height:148px/);
  assert.match(source,/@media\(min-width:901px\) and \(max-width:1280px\)\{\s*body\.workshopMode:not\(\.starterScreenActive\) #workshopEngineeringDashboard\{\s*grid-template-columns:minmax\(360px,390px\) minmax\(0,1fr\)/);
  assert.match(source,/#workshopQuickAccessToolbar\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(source,/#workshopConsoleTabs\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(source,/body\.workshopMode:not\(\.starterScreenActive\) #workshopEngineeringDashboard\{[\s\S]*?grid-template-rows:52px minmax\(0,1fr\)/);
  assert.match(source,/#workshopQuickAccessToolbar,[\s\S]*?#workshopConsoleTabs\{[\s\S]*?height:52px;[\s\S]*?box-sizing:border-box;[\s\S]*?align-items:center/);
  assert.match(source,/#workshopQuickAccessToolbar button,[\s\S]*?#workshopConsoleTabs button\{[\s\S]*?height:44px;[\s\S]*?min-height:44px/);
  assert.match(theme,/\.workshop-design-groups\{[\s\S]*?overflow:hidden/);
});
