import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("placement validates complete candidate bounds without shrinking ground raycasting", () => {
  assert.match(source, /const clickableObjects = \[ground, \.\.\.blocks\]/);
  assert.match(source, /const candidateBounds = createWorkshopCandidateBounds\(newBlock, position\);\s*const insideActiveWorkspace=workshopBoundsFitActiveWorkspace\(candidateBounds\)/);
  assert.match(source, /isValid:!collidingBlock && insideActiveWorkspace/);
  assert.match(source, /groundGeometry = new THREE\.BoxGeometry\(50, 1, 50\)/);
});

test("Workshop fails closed while Mission placement remains unchanged", () => {
  assert.match(source, /function workshopBoundsFitActiveWorkspace\(bounds\)\{\s*if\(!document\.body\.classList\.contains\("workshopMode"\)\) return true;/);
  assert.match(source, /typeof window\.workshopBoundsFitActiveWorkspace==="function" &&\s*window\.workshopBoundsFitActiveWorkspace\(bounds\)/);
});

test("face stacking and ground placement share the same candidate validator", () => {
  const candidateStart = source.indexOf("function calculateWorkshopPlacementCandidate");
  const candidateEnd = source.indexOf("function clickedUI", candidateStart);
  const candidate = source.slice(candidateStart, candidateEnd);
  assert.match(candidate, /if\(hit === ground\)/);
  assert.match(candidate, /else\{[\s\S]*?contactAxis/);
  assert.equal((candidate.match(/createWorkshopCandidateBounds\(newBlock, position\)/g) || []).length, 1);
});
