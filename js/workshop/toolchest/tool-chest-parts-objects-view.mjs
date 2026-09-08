const freezeResult = (value) => Object.freeze(value);

function makeGroup(documentRef, label, items, activate) {
  const section = documentRef.createElement("section");
  const heading = documentRef.createElement("h3");
  heading.textContent = label;
  section.appendChild(heading);
  const categories = new Map();
  items.forEach((item) => {
    if (!categories.has(item.category)) categories.set(item.category, []);
    categories.get(item.category).push(item);
  });
  categories.forEach((categoryItems, category) => {
    const categoryGroup = documentRef.createElement("div");
    const categoryHeading = documentRef.createElement("h4");
    const collection = documentRef.createElement("div");
    categoryGroup.className = "engineering-parts-objects-category";
    categoryHeading.textContent = category;
    collection.className = "engineering-parts-objects-group";
    collection.setAttribute("role", "group");
    collection.setAttribute("aria-label", `${label}: ${category}`);
    categoryItems.forEach((item) => {
      const button = documentRef.createElement("button");
      const thumbnail = documentRef.createElement("span");
      const name = documentRef.createElement("span");
      const detail = documentRef.createElement("small");
      button.type = "button";
      button.className = "engineering-object-tile engineering-parts-object-tile";
      button.dataset.partsObjectKey = item.key;
      button.setAttribute("aria-label", item.supported
        ? `Place ${item.name}`
        : `${item.name}. Unavailable in Workshop.`);
      thumbnail.className = "engineering-parts-object-thumbnail";
      thumbnail.setAttribute("aria-hidden", "true");
      thumbnail.textContent = item.symbol;
      name.className = "engineering-object-tile-name";
      name.textContent = item.name;
      detail.className = "engineering-parts-object-detail";
      detail.textContent = item.supported ? "Ready to place" : item.disabledReason;
      button.append(thumbnail, name, detail);
      if (!item.supported) {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      } else {
        button.addEventListener("click", activate);
      }
      collection.appendChild(button);
    });
    categoryGroup.append(categoryHeading, collection);
    section.appendChild(categoryGroup);
  });
  return section;
}

export function createToolChestPartsObjectsView({
  root,
  scrollOwner = root,
  status,
  adapter,
  documentRef = globalThis.document,
} = {}) {
  if (!root || !scrollOwner || !status || !adapter || typeof adapter.list !== "function" ||
      typeof adapter.place !== "function" || !documentRef?.createElement) {
    throw new TypeError("Parts & Objects elements and adapter are required.");
  }

  let disposed = false;
  let signature = "";
  let activationLocked = false;

  const activate = (event) => {
    if (disposed || activationLocked || event.currentTarget.disabled) return;
    activationLocked = true;
    const button = event.currentTarget;
    const key = button.dataset.partsObjectKey;
    const result = adapter.place(key);
    status.textContent = result.ok
      ? `${button.querySelector(".engineering-object-tile-name")?.textContent || "Object"} placed. Activate again to add another.`
      : "That object is not available right now.";
    activationLocked = false;
  };

  const refresh = () => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    const items = adapter.list();
    const nextSignature = items.map((item) => (
      `${item.key}:${item.missionRelevant}:${item.supported}:${item.category}`
    )).join("|");
    if (signature === nextSignature && root.childElementCount > 0) {
      return freezeResult({ ok: true, code: "IDEMPOTENT", count: items.length });
    }
    signature = nextSignature;
    const mission = items.filter((item) => item.missionRelevant);
    const remaining = items.filter((item) => !item.missionRelevant && item.supported);
    const unavailable = items.filter((item) => !item.missionRelevant && !item.supported);
    const fragment = documentRef.createDocumentFragment();
    if (mission.length) fragment.appendChild(makeGroup(documentRef, "Mission Objects", mission, activate));
    if (remaining.length) fragment.appendChild(makeGroup(documentRef, "More Objects", remaining, activate));
    if (unavailable.length) fragment.appendChild(makeGroup(documentRef, "Not Available Yet", unavailable, activate));
    root.replaceChildren(fragment);
    return freezeResult({ ok: true, code: "RENDERED", count: items.length });
  };

  const reset = () => {
    if (disposed) return freezeResult({ ok: false, code: "DISPOSED" });
    adapter.reset?.();
    activationLocked = false;
    signature = "";
    status.textContent = "";
    scrollOwner.scrollTop = 0;
    root.replaceChildren();
    return freezeResult({ ok: true, code: "RESET" });
  };

  return freezeResult({
    refresh,
    reset,
    getSnapshot() {
      return freezeResult({
        rendered: root.childElementCount > 0,
        count: root.querySelectorAll("button[data-parts-object-key]").length,
        scrollTop: scrollOwner.scrollTop,
      });
    },
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      adapter.dispose?.();
    },
  });
}
