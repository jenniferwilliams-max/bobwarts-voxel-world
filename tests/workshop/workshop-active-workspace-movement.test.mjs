import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("movement validates one translated aggregate before mutating objects", () => {
  const clickStart = source.indexOf("if(moveSelectedMode && hit === ground)");
  const clickEnd = source.indexOf("const newBlock = createStudentShape", clickStart);
  const movement = source.slice(clickStart, clickEnd);
  const validation = movement.indexOf("createWorkshopTranslatedSelectionBounds");
  const mutation = movement.indexOf("selectedBlocks.forEach(block =>");
  assert.ok(validation >= 0);
  assert.ok(mutation > validation);
  assert.match(movement, /const insideWorkspace=workshopBoundsFitActiveWorkspace\(translatedSelectionBounds\)/);
  assert.match(movement, /if\(!insideWorkspace \|\| colliding\)\{[\s\S]*?return;/);
});

test("movement keeps the shared lattice-preserving translation", () => {
  assert.match(source, /calculateWorkshopMoveTranslation\(\s*selectedBlocks,\s*intersects\[0\]\.point,\s*workshopMoveSnapshot \? workshopMoveSnapshot\.anchorOffset : undefined\s*\)/);
  assert.match(source, /block\.position\.x = Number\(\(block\.position\.x \+ changeX\)\.toFixed\(4\)\)/);
  assert.match(source, /block\.position\.z = Number\(\(block\.position\.z \+ changeZ\)\.toFixed\(4\)\)/);
});
