export const POWERED_OFF_PROJECTOR_ASSET =
  "assets/images/workshop/runtime/derivatives/projector/projector-powered-off-sample-587x587.png";

export const POWERED_OFF_PROJECTOR_STATE = Object.freeze({
  name: "POWERED_OFF",
  opacity: 1,
  scale: 1,
});

const requireDomMethod = (value, method, label) => {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(`${label} must provide ${method}().`);
  }
};

export function mountPoweredOffProjector({
  document,
  mount,
  assetPath = POWERED_OFF_PROJECTOR_ASSET,
} = {}) {
  requireDomMethod(document, "createElement", "document");
  requireDomMethod(mount, "replaceChildren", "mount");
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    throw new TypeError("assetPath must be a non-empty string.");
  }

  const image = document.createElement("img");
  image.className = "workshop-projector-powered-off";
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.setAttribute("data-projector-state", POWERED_OFF_PROJECTOR_STATE.name);
  image.decoding = "async";
  image.draggable = false;

  const ready = new Promise((resolve, reject) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => {
      reject(new Error(`Powered-off Projector failed to load: ${assetPath}`));
    }, { once: true });
  });

  image.src = assetPath;
  mount.replaceChildren(image);

  return Object.freeze({
    element: image,
    ready,
    state: POWERED_OFF_PROJECTOR_STATE,
    assetPath,
  });
}
