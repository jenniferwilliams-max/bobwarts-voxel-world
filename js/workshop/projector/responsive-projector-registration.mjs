export const RESPONSIVE_PROJECTOR_REGISTRATION = Object.freeze({
  anchor: "VISUAL_BASE_CENTER",
  registrationRectangle: "WORKSHOP_VIEWPORT_STAGE",
  anchorX: 0.5,
  anchorY: 1,
  sizeRatio: 0.68,
  minimumSize: 148,
  maximumSize: 224,
  essentialControlClearance: 12,
  sourceCanvasSize: 587,
  visibleBounds: Object.freeze({ left: 32, top: 48, right: 552, bottom: 541 }),
});

const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;

export function calculateResponsiveProjectorRegistration(
  stageWidth,
  stageHeight,
  configuration = RESPONSIVE_PROJECTOR_REGISTRATION,
) {
  if (!finiteNonnegative(stageWidth) || !finiteNonnegative(stageHeight)) {
    throw new TypeError("stageWidth and stageHeight must be finite nonnegative numbers.");
  }

  const {
    sizeRatio,
    minimumSize,
    maximumSize,
    essentialControlClearance,
    sourceCanvasSize,
    visibleBounds,
  } = configuration;
  const size = Math.min(maximumSize, Math.max(minimumSize, stageHeight * sizeRatio));
  const visualCenterX = (visibleBounds.left + visibleBounds.right) / 2 / sourceCanvasSize;
  const visualBaseY = visibleBounds.bottom / sourceCanvasSize;
  const visibleTop = stageHeight - visualBaseY * size;
  const visibleWidth = (visibleBounds.right - visibleBounds.left) / sourceCanvasSize * size;
  const availableWidth = Math.max(0, stageWidth - essentialControlClearance * 2);
  const hidden = stageWidth === 0 || stageHeight === 0 ||
    visibleWidth > availableWidth || visibleTop < essentialControlClearance;

  return Object.freeze({
    hidden,
    size,
    left: stageWidth * configuration.anchorX,
    bottom: -(1 - visualBaseY) * size,
    translateXPercent: -visualCenterX * 100,
    visualAnchorX: stageWidth * configuration.anchorX,
    visualAnchorY: stageHeight * configuration.anchorY,
  });
}

export function projectorIntersectsProtectedZone(
  registration,
  stageBounds,
  protectedBounds,
  configuration = RESPONSIVE_PROJECTOR_REGISTRATION,
) {
  const visibleWidth =
    (configuration.visibleBounds.right - configuration.visibleBounds.left) /
    configuration.sourceCanvasSize * registration.size;
  const visibleHeight =
    (configuration.visibleBounds.bottom - configuration.visibleBounds.top) /
    configuration.sourceCanvasSize * registration.size;
  const visibleRight = stageBounds.left + registration.visualAnchorX + visibleWidth / 2;
  const visibleLeft = visibleRight - visibleWidth;
  const visibleBottom = stageBounds.top + registration.visualAnchorY;
  const visibleTop = visibleBottom - visibleHeight;
  const clearance = configuration.essentialControlClearance;

  return protectedBounds.some((bounds) =>
    visibleRight > bounds.left - clearance &&
    visibleLeft < bounds.right + clearance &&
    visibleBottom > bounds.top - clearance &&
    visibleTop < bounds.bottom + clearance
  );
}

export function registerResponsivePoweredOffProjector({
  stage,
  mount,
  protectedElements = [],
  ResizeObserver: ResizeObserverConstructor = globalThis.ResizeObserver,
} = {}) {
  if (!stage || typeof stage.getBoundingClientRect !== "function") {
    throw new TypeError("stage must provide getBoundingClientRect().");
  }
  if (!mount || !mount.style) {
    throw new TypeError("mount must provide a style object.");
  }
  if (typeof ResizeObserverConstructor !== "function") {
    throw new TypeError("ResizeObserver must be available.");
  }

  const update = () => {
    const bounds = stage.getBoundingClientRect();
    const calculated = calculateResponsiveProjectorRegistration(bounds.width, bounds.height);
    const protectedBounds = protectedElements
      .filter((element) => element && typeof element.getBoundingClientRect === "function")
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const protectedZoneCollision = projectorIntersectsProtectedZone(
      calculated,
      bounds,
      protectedBounds,
    );
    const registration = Object.freeze({
      ...calculated,
      hidden: calculated.hidden || protectedZoneCollision,
      protectedZoneCollision,
    });
    mount.style.width = `${registration.size}px`;
    mount.style.left = `${registration.left}px`;
    mount.style.bottom = `${registration.bottom}px`;
    mount.style.transform = `translateX(${registration.translateXPercent}%)`;
    mount.style.visibility = registration.hidden ? "hidden" : "visible";
    mount.dataset.projectorRegistration = RESPONSIVE_PROJECTOR_REGISTRATION.anchor;
    return registration;
  };

  const observer = new ResizeObserverConstructor(update);
  observer.observe(stage);
  protectedElements.forEach((element) => {
    if (element) observer.observe(element);
  });
  const initial = update();

  return Object.freeze({
    configuration: RESPONSIVE_PROJECTOR_REGISTRATION,
    initial,
    update,
    disconnect: () => observer.disconnect(),
  });
}
