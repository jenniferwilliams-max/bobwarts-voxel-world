export const TOOL_CHEST_DRAWER_SECURITY = Object.freeze({
  property: "transform",
  normalDuration: 280,
  reducedDuration: 1,
});

const freezeResult = (value) => Object.freeze(value);

export function createToolChestDrawerSecurityView({
  root,
  drawers,
  getDrawerState,
  closeDrawer,
  isAtClosedEndpoint = (drawer) => {
    const style = globalThis.getComputedStyle?.(drawer);
    const transform = style?.transform || "none";
    if (transform === "none") return true;
    const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+)/);
    const translateX = Number(match?.[1]);
    return Number.isFinite(translateX) && Math.abs(translateX) <= 1;
  },
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
} = {}) {
  if (!root || typeof root.addEventListener !== "function" ||
      typeof root.removeEventListener !== "function") {
    throw new TypeError("Tool Chest root with event support is required.");
  }
  if (!Array.isArray(drawers) || drawers.some((drawer) => (
    !drawer?.dataset?.toolChestDrawer
  ))) {
    throw new TypeError("Named Tool Chest drawer elements are required.");
  }
  if (typeof getDrawerState !== "function" || typeof closeDrawer !== "function") {
    throw new TypeError("getDrawerState and closeDrawer must be functions.");
  }

  let serial = 0;
  let active = null;
  let disposed = false;
  const drawerByName = new Map(drawers.map((drawer) => [drawer.dataset.toolChestDrawer, drawer]));

  const cancelActive = () => {
    if (!active) return false;
    active.cancelled = true;
    active = null;
    return true;
  };

  const drawerIsSecure = (name) => {
    const drawer = drawerByName.get(name);
    return !!drawer && getDrawerState(name) === "closed" && isAtClosedEndpoint(drawer);
  };

  const settle = (entry) => {
    if (disposed || active !== entry || entry.cancelled || entry.completed) return false;
    for (const name of entry.pending) {
      if (drawerIsSecure(name)) entry.pending.delete(name);
    }
    if (entry.pending.size !== 0) return false;
    entry.completed = true;
    active = null;
    return entry.complete();
  };

  const onTransitionEnd = (event) => {
    if (!active || event.propertyName !== TOOL_CHEST_DRAWER_SECURITY.property) return;
    const name = event.target?.dataset?.toolChestDrawer;
    if (!name || !active.pending.has(name)) return;
    settle(active);
  };
  root.addEventListener("transitionend", onTransitionEnd);

  const secure = ({ transitionId, complete = () => true } = {}) => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    if (typeof transitionId !== "string" || transitionId.length === 0) {
      return freezeResult({ ok: false, code: "INVALID_TRANSITION_ID" });
    }
    if (active?.transitionId === transitionId) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", transitionId });
    }

    cancelActive();
    const pending = new Set();
    const toClose = [];
    for (const [name, drawer] of drawerByName) {
      const state = getDrawerState(name);
      if (state === "closed" && isAtClosedEndpoint(drawer)) continue;
      pending.add(name);
      if (state === "open" || state === "opening") toClose.push(name);
    }

    if (pending.size === 0) {
      complete();
      return freezeResult({ ok: true, code: "ALREADY_SECURE", transitionId, affected: 0 });
    }

    const entry = {
      token: ++serial,
      transitionId,
      pending,
      complete,
      completed: false,
      cancelled: false,
    };
    active = entry;
    toClose.forEach((name) => closeDrawer(name, false));
    // A host may synchronously settle a reduced-motion or test drawer.
    settle(entry);
    return freezeResult({
      ok: true,
      code: "ACCEPTED",
      transitionId,
      token: entry.token,
      affected: pending.size,
      duration: reducedMotion()
        ? TOOL_CHEST_DRAWER_SECURITY.reducedDuration
        : TOOL_CHEST_DRAWER_SECURITY.normalDuration,
    });
  };

  return Object.freeze({
    secure,
    cancel() {
      return freezeResult({ ok: true, code: cancelActive() ? "CANCELLED" : "IDEMPOTENT" });
    },
    getSnapshot() {
      return freezeResult({
        transitionId: active?.transitionId || null,
        pending: freezeResult(active ? [...active.pending] : []),
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive();
      root.removeEventListener("transitionend", onTransitionEnd);
    },
  });
}
