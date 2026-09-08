import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("disables only active Table presentation while retaining lifecycle modules", () => {
  assert.match(html, /workshopClassroomTablePresentationEnabled=false/);
  assert.match(html, /presentationEnabled:workshopClassroomTablePresentationEnabled/);
  assert.match(html, /getTableVisible:function\(\)\{\s*return workshopClassroomTablePresentationEnabled/);
  assert.match(html, /createTablePowerOnView/);
  assert.match(html, /createTableProjectionStartView/);
  assert.match(html, /createTableProjectionActiveView/);
  assert.match(html, /createTableLifecycleSafety/);
  assert.match(html, /getTableVisible:getWorkshopGridPresentationHostVisible/);
});

test("connects one isolated 20 by 20 Home owner without a full-world fallback", () => {
  assert.equal((html.match(/workshop-home-workspace-framing\.mjs/g) || []).length, 1);
  assert.equal((html.match(/createWorkshopHomeWorkspaceFraming\(\)/g) || []).length, 1);
  assert.match(html, /function getWorkshopHomeCameraConfig\(\)[\s\S]*?var baseline=/);
  assert.match(html, /frame\.target\.x/);
  assert.match(html, /frame\.target\.y/);
  assert.match(html, /frame\.horizontalDistance/);
  assert.match(html, /if\(!frame\)\{[\s\S]*?workshopLastValidHomeCameraConfig/);
  assert.match(html, /frame=workshopHomeWorkspaceFraming\.fallback\(frameInput\)/);
  assert.doesNotMatch(html,
    /if\(!frame\)\{\s*workshopHomeGridWorkspace=null;\s*return baseline;/);
  assert.match(html, /gridWorkspace:\{[\s\S]*?xMin:-10,xMax:10[\s\S]*?zMin:-10,zMax:10/);
});

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, name);
  const brace = html.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("settles Home after layout and rejects stale rendered-frame callbacks", () => {
  const entry = html.slice(
    html.indexOf("function applyWorkspaceModeVisuals"),
    html.indexOf("function startWorkshopProjectionVisuals"),
  );
  assert.ok(entry.indexOf("placeUtilityRail(requestedMode)") <
    entry.indexOf("prepareWorkshopHomeFrameSettlement()"));
  assert.ok(entry.indexOf("updateModeControls()") <
    entry.indexOf("prepareWorkshopHomeFrameSettlement()"));

  const frames = [];
  const context = {
    workshopCadWorkspacePresentation: null,
    workshopHomeFrameSettlementToken: 0,
    currentWorkspaceMode: "workshop",
    activeWorkshopEngineeringView: "home",
    activeWorkshopFitSelection: false,
    workshopHomeWorkspaceFraming: {},
    applied: 0,
    applyResponsiveWorkshopHomeView() { context.applied += 1; },
    document: { body: { classList: { contains: () => true } } },
    window: { requestAnimationFrame(callback) { frames.push(callback); } },
    getWorkshopHomeFrameGeometrySignature() { return "stable"; },
  };
  vm.runInNewContext(
    `${extractFunction("scheduleWorkshopHomeFrameSettlement")};` +
      "this.schedule=scheduleWorkshopHomeFrameSettlement",
    context,
  );

  context.schedule();
  assert.equal(context.applied, 0);
  frames.shift()();
  assert.equal(context.applied, 0);
  frames.shift()();
  assert.equal(context.applied, 1);

  context.schedule();
  context.activeWorkshopEngineeringView = "front";
  frames.shift()();
  assert.equal(context.applied, 1);

  context.activeWorkshopEngineeringView = "home";
  context.schedule();
  context.currentWorkspaceMode = "mission";
  frames.shift()();
  assert.equal(context.applied, 1);

  context.currentWorkspaceMode = "workshop";
  context.schedule();
  context.activeWorkshopFitSelection = true;
  frames.shift()();
  assert.equal(context.applied, 1);

  context.activeWorkshopFitSelection = false;
  context.schedule();
  const staleResizeFrame = frames.shift();
  context.schedule();
  staleResizeFrame();
  assert.equal(context.applied, 1);
  frames.shift()();
  frames.shift()();
  assert.equal(context.applied, 2);
});

test("uses stable visible protected geometry when the projected stage is off-canvas", () => {
  const canvas = { left: 0, top: 0, right: 1280, bottom: 720 };
  const visibleWorkspace = {
    left: 307, top: 211, right: 977, bottom: 570, width: 670, height: 359,
  };
  const context = {
    window: {
      getWorkshopProtectedBuildZone() {
        return {
          left: -83301, top: 732, right: 84582, bottom: 19065,
          width: 167883, height: 18333, blocked: false,
        };
      },
    },
    workshopCadWorkspacePresentation: null,
    document: {
      getElementById(id) {
        return id === "workshopViewportContainer"
          ? { getBoundingClientRect: () => visibleWorkspace }
          : null;
      },
    },
  };
  vm.runInNewContext(
    `${extractFunction("getWorkshopStableHomeProtectedGeometry")};` +
      "this.measure=getWorkshopStableHomeProtectedGeometry",
    context,
  );
  assert.deepEqual(
    { ...context.measure(canvas) },
    visibleWorkspace,
  );

  context.window.getWorkshopProtectedBuildZone = () => ({
    left: 343, top: 243, right: 941, bottom: 538,
    width: 598, height: 295, blocked: false,
  });
  assert.deepEqual(
    { ...context.measure(canvas) },
    { left: 343, top: 243, right: 941, bottom: 538, width: 598, height: 295 },
  );
});

test("retries Home settlement when asynchronous framing becomes ready", () => {
  const initializationStart = html.indexOf("workshopHomeWorkspaceFraming=modules[21]");
  const initialization = html.slice(
    initializationStart,
    html.indexOf("workshopToolChestPartsObjectsAdapter=", initializationStart),
  );
  assert.match(initialization, /activeWorkshopEngineeringView==="home"/);
  assert.match(initialization, /prepareWorkshopHomeFrameSettlement\(\)/);
  assert.match(html, /if\(requestedMode!=="workshop"\)\{[\s\S]*?cancelWorkshopHomeFrameSettlement\(\)/);
  assert.match(html, /geometrySignature===previousGeometrySignature/);
  assert.match(html, /attempts<8/);
});

test("preserves the 50 by 50 truth surface and existing zoom capacity", () => {
  assert.match(html, /new THREE\.BoxGeometry\(50, 1, 50\)/);
  assert.match(html, /const gridHalfSize = 25/);
  assert.match(html, /workshopMode"\) \? 80 : 50/);
  assert.match(html, /if\(hit === ground\)/);
  assert.match(html, /groundBounds\.max\.y \+ halfSize\.y/);
});

test("does not alter inspection, Fit, platform color, or Mission restoration owners", () => {
  assert.match(html, /front:\{position:\[0,0,1\],up:\[0,1,0\]\}/);
  assert.match(html, /function fitWorkshopSelection\(requestedView\)/);
  assert.match(html, /function chooseWorkshopPlatformTint\(colorValue\)/);
  assert.match(html, /ground\.material\.map=workshopBuildAreaSnapshot\.groundMap/);
});

test("placement and selection clicks do not surrender bounded Home to orbit", () => {
  const mousedownStart = html.indexOf("document.addEventListener('mousedown', (event)=>{");
  const mouseupStart = html.indexOf("document.addEventListener('mouseup', ()=>{", mousedownStart);
  const mousedown = html.slice(mousedownStart, mouseupStart);
  assert.doesNotMatch(mousedown, /clearWorkshopEngineeringView/);
  assert.match(mousedown, /event\.target !== renderer\.domElement/);
  assert.match(html, /const WORKSHOP_CANVAS_ORBIT_DRAG_THRESHOLD = 4;/);
  assert.match(html,
    /if\(orbitDistance < WORKSHOP_CANVAS_ORBIT_DRAG_THRESHOLD\)\{\s*return;[\s\S]*?workshopCanvasOrbitPrepared = true;[\s\S]*?clearWorkshopEngineeringView/);
});
