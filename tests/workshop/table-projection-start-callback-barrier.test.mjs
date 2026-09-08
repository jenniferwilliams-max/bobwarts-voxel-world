import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const indexSource = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function extractTableProjectionDriver() {
  const start = indexSource.indexOf("startTableProjection:function(transition){");
  const end = indexSource.indexOf("settleTableProjection:function(transition){", start);
  assert.ok(start >= 0 && end > start, "Table projection driver must be present");
  const method = indexSource.slice(start, end).replace(/,\s*$/, "");
  const context = {
    startWorkshopProjectionVisuals() {},
    workshopTableProjectionStartView: null,
    workshopTableProjectionActiveView: null,
  };
  vm.runInNewContext(`this.driver=({${method}}).startTableProjection`, context);
  return { context, driver: context.driver };
}

function viewResult(code, pending) {
  return ({ complete }) => {
    if (pending) pending.push(complete);
    return Object.freeze({ ok: true, code, duration: code === "IDEMPOTENT" ? 0 : 500 });
  };
}

test("idempotent starting field and grid claim the host barrier exactly once", () => {
  const { context, driver } = extractTableProjectionDriver();
  let completed = 0;
  context.workshopTableProjectionStartView = { start: viewResult("IDEMPOTENT") };
  context.workshopTableProjectionActiveView = { startProjectionGrid: viewResult("IDEMPOTENT") };

  driver({ transitionId: "restart-1", complete: () => { completed += 1; return true; } });
  assert.equal(completed, 1);
});

test("mixed reversal waits for the animated branch and rejects duplicate claims", () => {
  const { context, driver } = extractTableProjectionDriver();
  const pending = [];
  let completed = 0;
  context.workshopTableProjectionStartView = { start: viewResult("IDEMPOTENT") };
  context.workshopTableProjectionActiveView = { startProjectionGrid: viewResult("REVERSING", pending) };

  driver({ transitionId: "restart-2", complete: () => { completed += 1; return true; } });
  assert.equal(completed, 0);
  assert.equal(pending[0](), true);
  assert.equal(completed, 1);
  assert.equal(pending[0](), false);
  assert.equal(completed, 1);
});

test("stale animated callbacks cannot complete a newer idempotent restart twice", () => {
  const { context, driver } = extractTableProjectionDriver();
  const stale = [];
  let staleClaims = 0;
  context.workshopTableProjectionStartView = { start: viewResult("REVERSING", stale) };
  context.workshopTableProjectionActiveView = { startProjectionGrid: viewResult("REVERSING", stale) };
  driver({ transitionId: "shutdown-1", complete: () => { staleClaims += 1; return false; } });

  let readyClaims = 0;
  context.workshopTableProjectionStartView = { start: viewResult("IDEMPOTENT") };
  context.workshopTableProjectionActiveView = { startProjectionGrid: viewResult("IDEMPOTENT") };
  driver({ transitionId: "restart-3", complete: () => { readyClaims += 1; return true; } });

  assert.equal(readyClaims, 1);
  assert.equal(stale[0](), false);
  assert.equal(stale[1](), false);
  assert.equal(staleClaims, 1);
  assert.equal(readyClaims, 1);
});
