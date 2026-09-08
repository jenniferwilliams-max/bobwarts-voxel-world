const VERSION = 1;
const DEFAULT_THRESHOLDS = Object.freeze([50, 100, 150, 200]);

function safeWholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function normalizeAwardIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === "string" && id.trim()).map(id => id.trim()))];
}

export function createThinkamigbobGearProgress(options = {}) {
  const storage = options.storage;
  const storageKey = options.storageKey || "thinkamigbob-student-progression-v1";
  const legacyKey = options.legacyKey || "thinkamigbobReadToBobRewardProgress01";
  const thresholds = Object.freeze(
    (options.thresholds || DEFAULT_THRESHOLDS)
      .map(safeWholeNumber)
      .filter((value, index, values) => value > 0 && values.indexOf(value) === index)
      .sort((a, b) => a - b)
  );
  const listeners = new Set();

  function readJson(key) {
    try {
      const value = JSON.parse(storage?.getItem(key) || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  function initialState() {
    const stored = readJson(storageKey);
    const legacy = readJson(legacyKey);
    if (stored?.version === VERSION) {
      return {
        version: VERSION,
        cumulativeGears: Math.max(
          safeWholeNumber(stored.cumulativeGears),
          safeWholeNumber(legacy?.gears)
        ),
        processedAwardIds: normalizeAwardIds(stored.processedAwardIds),
        legacyMigrated: stored.legacyMigrated === true
      };
    }
    return {
      version: VERSION,
      cumulativeGears: safeWholeNumber(legacy?.gears),
      processedAwardIds: [],
      legacyMigrated: true
    };
  }

  let state = initialState();

  function derivedSnapshot(previousTotal = state.cumulativeGears) {
    const total = state.cumulativeGears;
    const unlockedThresholds = thresholds.filter(value => value <= total);
    const nextThreshold = thresholds.find(value => value > total) ?? null;
    const newlyUnlocked = thresholds.filter(value => value > previousTotal && value <= total);
    return Object.freeze({
      version: VERSION,
      cumulativeGears: total,
      unlockedThresholds: Object.freeze(unlockedThresholds),
      newlyUnlocked: Object.freeze(newlyUnlocked),
      nextThreshold,
      gearsToNextUpgrade: nextThreshold === null ? null : nextThreshold - total,
      allCurrentUpgradesUnlocked: nextThreshold === null
    });
  }

  function persist() {
    try {
      storage?.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function publish(snapshot) {
    listeners.forEach(listener => listener(snapshot));
    return snapshot;
  }

  persist();

  return Object.freeze({
    getSnapshot() {
      return derivedSnapshot();
    },
    synchronizeTotal(total) {
      const candidate = safeWholeNumber(total);
      if (candidate <= state.cumulativeGears) return derivedSnapshot();
      const previous = state.cumulativeGears;
      const next = { ...state, cumulativeGears: candidate };
      state = next;
      if (!persist()) {
        state = { ...next, cumulativeGears: previous };
        return derivedSnapshot();
      }
      return publish(derivedSnapshot(previous));
    },
    award({ id, gears }) {
      const awardId = typeof id === "string" ? id.trim() : "";
      const amount = safeWholeNumber(gears);
      if (!awardId || amount <= 0 || state.processedAwardIds.includes(awardId)) {
        return Object.freeze({ ok: false, snapshot: derivedSnapshot() });
      }
      const previous = state.cumulativeGears;
      const next = {
        ...state,
        cumulativeGears: previous + amount,
        processedAwardIds: [...state.processedAwardIds, awardId]
      };
      state = next;
      if (!persist()) {
        state = { ...next, cumulativeGears: previous, processedAwardIds: state.processedAwardIds.slice(0, -1) };
        return Object.freeze({ ok: false, snapshot: derivedSnapshot() });
      }
      return Object.freeze({ ok: true, snapshot: publish(derivedSnapshot(previous)) });
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(derivedSnapshot());
      return () => listeners.delete(listener);
    }
  });
}
