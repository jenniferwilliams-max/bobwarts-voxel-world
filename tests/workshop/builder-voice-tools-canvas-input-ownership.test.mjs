import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function listener(eventName, after = 0) {
  const compactMarker = `document.addEventListener('${eventName}', (event)=>{`;
  const spacedMarker = `document.addEventListener('${eventName}', (event) => {`;
  let start = source.indexOf(compactMarker, after);
  if (start === -1) start = source.indexOf(spacedMarker, after);
  assert.notEqual(start, -1, `missing ${eventName} listener`);
  const end = source.indexOf("});", start);
  return source.slice(start, end + 3);
}

test("reparented Builder panels remain explicit UI owners", () => {
  const start = source.indexOf("function clickedUI(event)");
  const end = source.indexOf("function workshopEventOwnsRendererCanvas", start);
  const owner = source.slice(start, end);
  assert.match(owner, /closest\("#builderRightToolsPanel"\)/);
  assert.match(owner, /closest\("#builderBobRightPanel"\)/);
});

test("placement and deletion require genuine renderer-canvas origin", () => {
  const click = listener("click", source.indexOf("function workshopNativeControlOwnsKeyboardClick"));
  const contextmenu = listener("contextmenu", source.indexOf(click));
  assert.match(click, /if\(!workshopEventOwnsRendererCanvas\(event\)\) return;/);
  assert.match(contextmenu, /if\(!workshopEventOwnsRendererCanvas\(event\)\) return;/);
  assert.ok(
    click.indexOf("workshopEventOwnsRendererCanvas") < click.indexOf("raycaster.setFromCamera"),
    "click ownership must be rejected before raycasting"
  );
  assert.ok(
    contextmenu.indexOf("workshopEventOwnsRendererCanvas") < contextmenu.indexOf("raycaster.setFromCamera"),
    "context-menu ownership must be rejected before raycasting"
  );
});

test("orbit, zoom, and arrow-camera input reject Builder UI origins", () => {
  const mousedown = listener("mousedown");
  const wheel = listener("wheel");
  const arrowKeydownStart = source.indexOf("// Arrow key camera controls");
  const arrowKeydown = listener("keydown", arrowKeydownStart);
  assert.match(mousedown, /if\(!workshopEventOwnsRendererCanvas\(event\)\)/);
  assert.match(wheel, /if\(!workshopEventOwnsRendererCanvas\(event\)\) return;/);
  assert.match(arrowKeydown, /if\(clickedUI\(event\)\) return;/);
});

test("Voice and Tools retains one native control set", () => {
  assert.equal((source.match(/id="voiceControls"/g) ?? []).length, 1);
  for (const id of [
    "readerPlayButton",
    "readerPauseButton",
    "readerStopButton",
    "voiceSelect",
    "voiceSpeedSelect",
    "audioPowerToggle",
    "calmModeToggle"
  ]) {
    assert.equal((source.match(new RegExp(`id="${id}"`, "g")) ?? []).length, 1, id);
  }
});
