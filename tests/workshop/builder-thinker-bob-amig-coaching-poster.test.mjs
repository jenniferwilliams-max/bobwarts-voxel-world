import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const posterStart = source.indexOf('<section id="builderAmigPoster"');
const posterEnd = source.indexOf("</section>", posterStart);
const poster = source.slice(posterStart, posterEnd + "</section>".length);

test("Builder floating BOB contains one accessible real-text AMIG coaching poster", () => {
  assert.ok(posterStart > -1);
  assert.match(poster, /aria-labelledby="builderAmigPosterTitle"/);
  assert.match(poster, /AMIG learning guide/);
  for (const phrase of ["Ask it!", "Make it happen!", "Improve it!", "Grow what you know!"]) {
    assert.equal((source.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
  }
  assert.doesNotMatch(poster, /<img\b|background-image|data:image/i);
});

test("AMIG letters retain their approved semantic order and colors", () => {
  assert.match(poster, /builderAmigA">A<\/strong><span>Ask it!<\/span>/);
  assert.match(poster, /builderAmigM">M<\/strong><span>Make it happen!<\/span>/);
  assert.match(poster, /builderAmigI">I<\/strong><span>Improve it!<\/span>/);
  assert.match(poster, /builderAmigG">G<\/strong><span>Grow what you know!<\/span>/);
  assert.match(source, /\.builderAmigA\{color:#1267b2;\}/);
  assert.match(source, /\.builderAmigM\{color:#3d8d29;\}/);
  assert.match(source, /\.builderAmigI\{color:#e56d08;\}/);
  assert.match(source, /\.builderAmigG\{color:#71368d;\}/);
});

test("poster shares the established floating card without changing its dimensions", () => {
  assert.match(source, /#thinkerBobWorkshop\{[\s\S]*?width:190px !important;[\s\S]*?height:180px !important;/);
  assert.match(source, /@media\(max-width:1280px\)\{[\s\S]*?#thinkerBobWorkshop\{[\s\S]*?width:164px !important;[\s\S]*?height:158px !important;/);
  assert.match(source, /#builderAmigPoster\{[\s\S]*?position:absolute;[\s\S]*?width:51%;/);
  assert.match(source, /#thinkerBobWorkshop #thinkerBobRigMount\{[\s\S]*?left:49% !important;[\s\S]*?width:51% !important;/);
  assert.match(source, /#builderFloatingBobMessage\{[\s\S]*?z-index:6;/);
});

test("approved articulated BOB asset and established reading prompt remain intact", () => {
  assert.match(source, /assets\/images\/characters\/thinker-bob-rig-svg\/thinker-bob-rig\.svg/);
  assert.match(source, /Click a word to read from there\./);
  assert.match(source, /id="thinkerBobRigMount" aria-hidden="true"/);
  assert.match(source, /id="thinkerBobWorkshop" role="group" aria-label="THINKer BOB AMIG coaching poster"/);
});
