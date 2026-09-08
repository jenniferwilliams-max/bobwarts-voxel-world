const freezeResult = (value) => Object.freeze(value);

function categoryName(button) {
  const category = button.closest?.(".toolCategory");
  const heading = category?.previousElementSibling;
  return (heading?.textContent || "Parts & Objects")
    .replace(/[▶▼]/g, "")
    .trim() || "Parts & Objects";
}

function itemName(button) {
  return (button.textContent || "")
    .replace(/^\s*[^A-Za-z0-9]+\s*/, "")
    .replace(/^Add\s+/i, "")
    .replace(/^Start\s+/i, "")
    .trim() || "Object";
}

function itemSymbol(button) {
  const source = (button.textContent || "").trim();
  return source.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u)?.[1] || "";
}

export function createToolChestPartsObjectsAdapter({
  sourceRoot,
  actions,
  getMissionKeys = () => [],
} = {}) {
  if (!sourceRoot || typeof sourceRoot.querySelectorAll !== "function") {
    throw new TypeError("The authoritative Object Library root is required.");
  }
  if (!actions || typeof actions !== "object") {
    throw new TypeError("A trusted Parts & Objects action allowlist is required.");
  }
  const approved = new Set(Object.entries(actions)
    .filter(([, action]) => typeof action === "function")
    .map(([key]) => key));
  if (approved.size === 0) throw new TypeError("At least one trusted action is required.");

  let disposed = false;
  let placing = false;

  const readMissionKeys = () => {
    try {
      const keys = getMissionKeys();
      return new Set(Array.isArray(keys) ? keys.filter((key) => typeof key === "string") : []);
    } catch {
      return new Set();
    }
  };

  const list = () => {
    if (disposed) return freezeResult([]);
    const missionKeys = readMissionKeys();
    const seen = new Set();
    const records = [];
    sourceRoot.querySelectorAll("button[data-object-library-key]").forEach((button, sourceIndex) => {
      const key = button.dataset.objectLibraryKey;
      if (!key || seen.has(key)) return;
      seen.add(key);
      const supported = approved.has(key);
      records.push(freezeResult({
        key,
        name: itemName(button),
        symbol: itemSymbol(button),
        category: categoryName(button),
        missionRelevant: missionKeys.has(key),
        supported,
        disabledReason: supported
          ? ""
          : "This object needs mission-specific setup and is not available in Workshop yet.",
        sourceIndex,
      }));
    });
    records.sort((left, right) => (
      Number(right.missionRelevant) - Number(left.missionRelevant) ||
      left.sourceIndex - right.sourceIndex ||
      left.key.localeCompare(right.key)
    ));
    return freezeResult(records);
  };

  const place = (key) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (!approved.has(key) || typeof actions[key] !== "function") {
      return freezeResult({ ok: false, code: "OBJECT_UNAVAILABLE", key });
    }
    if (placing) return freezeResult({ ok: false, code: "PLACEMENT_IN_PROGRESS", key });
    placing = true;
    try {
      actions[key]();
      return freezeResult({ ok: true, code: "PLACED", key });
    } catch {
      return freezeResult({ ok: false, code: "PLACEMENT_FAILED", key });
    } finally {
      placing = false;
    }
  };

  return freezeResult({
    list,
    place,
    reset() {
      placing = false;
      return freezeResult({ ok: true, code: "RESET" });
    },
    dispose() {
      disposed = true;
      placing = false;
    },
  });
}
