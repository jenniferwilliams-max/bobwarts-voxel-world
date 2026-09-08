import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} has no balanced closing brace`);
}

function createIntentHarness() {
  const rendererCanvas = {};
  const otherTarget = {};
  const classes = new Set();
  const dashboard = {
    getBoundingClientRect() {
      return { top: 572 };
    },
  };
  const context = {
    document: {
      body: { classList: { contains: (name) => classes.has(name) } },
      getElementById: (id) => id === "workshopDashboard" ? dashboard : null,
    },
    renderer: { domElement: rendererCanvas },
  };
  vm.createContext(context);
  vm.runInContext(`
    let workshopBuildViewportWheelIntentArmed = false;
    ${functionSource("workshopWheelEventTargetsBuildViewport")}
    ${functionSource("resetWorkshopBuildViewportWheelIntent")}
    ${functionSource("armWorkshopBuildViewportWheelIntent")}
    ${functionSource("workshopBuildViewportOwnsWheel")}
  `, context);
  return { context, classes, rendererCanvas, otherTarget };
}

test("Mission keeps its existing wheel ownership", () => {
  const { context, rendererCanvas } = createIntentHarness();
  assert.equal(context.workshopBuildViewportOwnsWheel({
    target: rendererCanvas,
    clientY: 200,
  }), true);
});

test("Workshop rejects residual wheel until fresh canvas pointer intent", () => {
  const { context, classes, rendererCanvas, otherTarget } = createIntentHarness();
  classes.add("workshopMode");
  const canvasEvent = { target: rendererCanvas, clientY: 200 };
  assert.equal(context.workshopBuildViewportOwnsWheel(canvasEvent), false);
  assert.equal(context.armWorkshopBuildViewportWheelIntent({
    target: otherTarget,
    clientY: 200,
  }), false);
  assert.equal(context.workshopBuildViewportOwnsWheel(canvasEvent), false);
  assert.equal(context.armWorkshopBuildViewportWheelIntent(canvasEvent), true);
  assert.equal(context.workshopBuildViewportOwnsWheel(canvasEvent), true);
  assert.equal(context.workshopBuildViewportOwnsWheel({
    target: otherTarget,
    clientY: 200,
  }), false);
});

test("Home and lifecycle reset revoke prior wheel intent", () => {
  const { context, classes, rendererCanvas } = createIntentHarness();
  classes.add("workshopMode");
  const canvasEvent = { target: rendererCanvas, clientY: 200 };
  context.armWorkshopBuildViewportWheelIntent(canvasEvent);
  assert.equal(context.workshopBuildViewportOwnsWheel(canvasEvent), true);
  context.resetWorkshopBuildViewportWheelIntent();
  assert.equal(context.workshopBuildViewportOwnsWheel(canvasEvent), false);
});

test("dashboard and non-canvas pointer movement cannot arm camera zoom", () => {
  const { context, classes, rendererCanvas, otherTarget } = createIntentHarness();
  classes.add("workshopMode");
  assert.equal(context.armWorkshopBuildViewportWheelIntent({
    target: rendererCanvas,
    clientY: 600,
  }), false);
  assert.equal(context.armWorkshopBuildViewportWheelIntent({
    target: otherTarget,
    clientY: 200,
  }), false);
});

test("the guard is event-owned and introduces no timer suppression", () => {
  const guardStart = source.indexOf("let workshopBuildViewportWheelIntentArmed");
  const guardEnd = source.indexOf("const viewCubeCanvas", guardStart);
  const guard = source.slice(guardStart, guardEnd);
  assert.doesNotMatch(guard, /setTimeout|setInterval/);
  assert.match(functionSource("syncWorkshopControllerPresentation"),
    /SHUTTING_DOWN[\s\S]*?FAULT_SAFE[\s\S]*?OFF[\s\S]*?resetWorkshopBuildViewportWheelIntent\(\)/);
  assert.match(functionSource("beginWorkshopViewDiceDrag"),
    /resetWorkshopBuildViewportWheelIntent\(\)/);
  assert.match(functionSource("clearWorkshopEngineeringView"),
    /resetWorkshopBuildViewportWheelIntent\(\)/);
});
