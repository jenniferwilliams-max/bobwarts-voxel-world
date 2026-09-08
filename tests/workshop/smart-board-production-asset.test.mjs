import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const assetUrl = new URL(
  "../../assets/images/workshop/production/engineering-smart-board/engineering-smart-board-production-v2-extended.png",
  import.meta.url,
);

test("locks the approved Smart Board production asset byte-for-byte", () => {
  const data = readFileSync(assetUrl);
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    "f252e86b43318b1e32ff139ddfcb8660c6c2f281eed5ef78bb5905169d1c7470",
  );
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(data.readUInt32BE(16), 1761);
  assert.equal(data.readUInt32BE(20), 1174);
  assert.equal(data[25], 6, "approved PNG must remain RGBA with alpha");
});
