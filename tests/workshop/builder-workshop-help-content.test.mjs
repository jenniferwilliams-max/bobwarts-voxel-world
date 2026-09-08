import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const helpStart=source.indexOf('<div id="helpModal"');
const helpEnd=source.indexOf('<!-- =====================================================\nCSS SECTION — MISSION PASSPORT SHELL',helpStart);
const help=source.slice(helpStart,helpEnd);

test("one existing Help owner serves Builder and Workshop contexts",()=>{
  assert.equal((source.match(/id="helpButton"/g)||[]).length,1);
  assert.equal((source.match(/id="workshopQuickHelp"/g)||[]).length,1);
  assert.equal((source.match(/id="helpModal"/g)||[]).length,1);
  assert.equal((source.match(/id="closeHelp"/g)||[]).length,1);
  assert.match(source,/id="workshopQuickHelp"[\s\S]*document\.getElementById\('helpButton'\)\.click\(\)/);
  assert.match(help,/button\.onclick=openHelp/);
  assert.match(help,/document\.body\.classList\.contains\("workshopMode"\)/);
  assert.match(help,/builderContent\.hidden=workshop/);
  assert.match(help,/workshopContent\.hidden=!workshop/);
});

test("Builder Help covers the complete current student workflow",()=>{
  const builder=help.slice(help.indexOf('id="builderHelpContent"'),help.indexOf('id="workshopHelpContent"'));
  for(const phrase of [
    "Builder Quick Start","Shapes &amp; Colors","CAD crosshair","Select","Move","Delete",
    "Foundation","Undo / Redo","Reset","Grid On / Off","Screenshot","Save","Open",
    "Return to Missions","Badges and Passport","Open Workshop","View Cube","Builder Challenge",
    "Open Library","Voice Reader","Calm Mode","Gear total",
    "Next Workshop Upgrade","Precision Driver cursor"
  ]) assert.ok(builder.includes(phrase),`Builder Help is missing ${phrase}`);
});

test("Workshop Help covers views, editing, persistence, and engineering tools",()=>{
  const workshop=help.slice(help.indexOf('id="workshopHelpContent"'),help.indexOf('<style id="builderWorkshopExpandedHelpCSS"'));
  for(const phrase of [
    "Workshop Quick Start","Enter Workshop","Return to Mission","Workshop Home","Fit Selection",
    "View Cube and View Remote","Grid and rulers","Select One","Select Multiple","Select Stack",
    "Move","Rotate","Delete","Parts &amp; Objects","Tool Chest","Engineering Table","Projector",
    "Smart Board","Measurement Assistant","Save","Open","Unsaved changes","Undo / Redo",
    "CAD crosshair","Precision Driver cursor","Workshop Upgrades","Builder project stays in Builder"
  ]) assert.ok(workshop.includes(phrase),`Workshop Help is missing ${phrase}`);
});

test("both contexts provide the approved sections and troubleshooting topics",()=>{
  for(const context of ["builderHelpContent","workshopHelpContent"]){
    const start=help.indexOf(`id="${context}"`);
    const end=context==="builderHelpContent" ? help.indexOf('id="workshopHelpContent"') : help.indexOf('<style id="builderWorkshopExpandedHelpCSS"');
    const content=help.slice(start,end);
    for(const section of [
      "getting-started","building-editing","moving-camera","saving-work","bob-reading",
      "gears-upgrades","engineering-tools","cursor-guide","troubleshooting"
    ]) assert.match(content,new RegExp(`data-help-section="${section}"`));
    for(const phrase of [
      "A block will not place","Move or Delete does nothing","The camera moved unexpectedly",
      "A saved project is missing","BOB does not start reading",
      "A Workshop tool is locked","Controls do not fit on a Chromebook"
    ]) assert.ok(content.includes(phrase),`${context} is missing ${phrase}`);
  }
  const studentHelp=help.slice(help.indexOf('id="builderHelpContent"'),help.indexOf('<style id="builderWorkshopExpandedHelpCSS"'));
  assert.doesNotMatch(studentHelp,/microphone|Start Reading button|oral-reading/i);
});

test("Help remains internally scrollable with reachable native controls",()=>{
  assert.match(help,/role="dialog" aria-modal="true" aria-labelledby="helpDialogTitle"/);
  assert.match(help,/id="helpContentViewport" tabindex="0"/);
  assert.match(help,/#helpBox\{[\s\S]*height:min\(720px,calc\(100vh - 24px\)\)[\s\S]*overflow:hidden/);
  assert.match(help,/#helpContentViewport\{[\s\S]*overflow-y:scroll[\s\S]*overscroll-behavior:contain[\s\S]*scrollbar-gutter:stable/);
  assert.match(help,/#closeHelp\{[\s\S]*min-height:44px/);
  assert.match(help,/#helpSectionSelect\{[\s\S]*min-height:44px/);
  assert.match(help,/modal\.addEventListener\("keydown"/);
  assert.match(help,/event\.key==="Escape"/);
  assert.match(help,/previousFocus\.focus\(\)/);
});
