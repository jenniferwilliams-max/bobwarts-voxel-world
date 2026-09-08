import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../../index.html",import.meta.url),"utf8");

test("eligible plain Builder missions use their approved quiet texture families",()=>{
  const expected={
    castle:"fine-stone",
    playground:"rubber-safety-grain",
    dragon:"dark-rock",
    futureCity:"architectural-concrete",
    moon:"lunar-dust",
    mars:"rust-mineral",
    engineering:"technical-composite"
  };
  for(const [mission,family] of Object.entries(expected)){
    assert.match(source,new RegExp(`${mission}:Object\\.freeze\\(\\{family:"${family}"`));
  }
  assert.match(source,/setGroundColor\(0x999999,"castle"\)/);
  assert.match(source,/setGroundColor\(0xDEB887,"playground"\)/);
  assert.match(source,/setGroundColor\(0x333333,"dragon"\)/);
  assert.match(source,/setGroundColor\(0x777777,"futureCity"\)/);
  assert.match(source,/isMars \? "mars" : "moon"/);
  assert.match(source,/setGroundColor\(0x777777,"engineering"\)/);
});

test("eligible platform texture contrast uses the visible ten-to-fourteen-percent band",()=>{
  const expected={
    castle:0.12,
    playground:0.11,
    dragon:0.14,
    futureCity:0.10,
    moon:0.13,
    mars:0.14,
    engineering:0.11
  };
  for(const [mission,contrast] of Object.entries(expected)){
    assert.match(source,new RegExp(`${mission}:Object\\.freeze\\(\\{family:"[^"]+",seed:\\d+,contrast:${contrast.toFixed(2)}`));
    assert.ok(contrast>=0.10 && contrast<=0.14);
  }
});

test("approved green platforms retain the existing grass owner",()=>{
  assert.match(source,/const greenGroundColors = \[0x55aa55, 0x228B22, 0x3f8f36, 0x5fb14a\];[\s\S]*?if\(greenGroundColors\.includes\(color\)\)\{[\s\S]*?setGrassGround\(\);[\s\S]*?return;/);
  assert.match(source,/setGroundColor\(0x55aa55,"habitat"\)/);
  assert.match(source,/setGroundColor\(0x55aa55,"weather"\)/);
  assert.match(source,/setGroundColor\(0x55aa55,"energy"\)/);
  assert.match(source,/function setGrassGround\(\)\{[\s\S]*?ground\.material\.map = grassTexture;/);
});

test("Cell Builder remains on the original untextured platform path",()=>{
  const cell=source.match(/function buildCellWorld\(\)\{([\s\S]*?)showMissionPopup\(\);/);
  assert.ok(cell);
  assert.match(cell[1],/setGroundColor\(0xeeeeee\);/);
  assert.doesNotMatch(cell[1],/setGroundColor\(0xeeeeee,/);
});

test("mission textures are deterministic cached presentation resources",()=>{
  assert.match(source,/const builderMissionPlatformTextureCache=new Map\(\);/);
  assert.match(source,/if\(!builderMissionPlatformTextureCache\.has\(missionKey\)\)\{[\s\S]*?createBuilderMissionPlatformTexture\(spec\)/);
  assert.match(source,/return builderMissionPlatformTextureCache\.get\(missionKey\);/);
  assert.match(source,/canvas\.width=128;[\s\S]*?canvas\.height=128;/);
  assert.match(source,/texture\.wrapS=THREE\.RepeatWrapping;[\s\S]*?texture\.wrapT=THREE\.RepeatWrapping;/);
  const animate=source.match(/function animate\(\)\{([\s\S]*?)requestAnimationFrame\(animate\)/);
  assert.ok(animate);
  assert.doesNotMatch(animate[1],/createBuilderMissionPlatformTexture|getBuilderMissionPlatformTexture/);
});

test("platform geometry and engineering coordinates remain unchanged",()=>{
  assert.match(source,/const groundGeometry = new THREE\.BoxGeometry\(50, 1, 50\);/);
  assert.match(source,/ground\.position\.y = -1;/);
  const setter=source.match(/function setGroundColor\(color,missionKey\)\{([\s\S]*?)function setSkyColor/);
  assert.ok(setter);
  assert.doesNotMatch(setter[1],/ground\.geometry|ground\.position|ground\.scale|ground\.rotation/);
});

test("Builder serialization remains independent of platform presentation textures",()=>{
  const exporter=source.match(/function exportBuilderWorld\(name\)\{([\s\S]*?)function validateBuilderProjectFile/);
  assert.ok(exporter);
  assert.doesNotMatch(exporter[1],/builderPlatformTexture|ground\.material\.map|textureFamily/);
  assert.match(exporter[1],/blocks\.forEach\(block =>/);
});
