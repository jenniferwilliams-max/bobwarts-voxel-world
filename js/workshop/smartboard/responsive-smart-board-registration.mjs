export const RESPONSIVE_SMART_BOARD_REGISTRATION = Object.freeze({
  anchor: "VISUAL_TOP_RIGHT",
  registrationRectangle: "WORKSHOP_VIEWPORT_STAGE",
  anchorX: 0.98,
  anchorY: 0.06,
  sizeRatio: 0.55,
  minimumSize: 220,
  maximumSize: 400,
  minimumStageWidth: 300,
  minimumStageHeight: 180,
  essentialControlClearance: 12,
  retractedReveal: 28,
  sourceCanvas: Object.freeze({ width: 1761, height: 1174 }),
  visibleBounds: Object.freeze({ left: 171, top: 189, right: 1662, bottom: 848 }),
});

const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;

export function calculateResponsiveSmartBoardRegistration(
  stageWidth,
  stageHeight,
  configuration = RESPONSIVE_SMART_BOARD_REGISTRATION,
) {
  if (!finiteNonnegative(stageWidth) || !finiteNonnegative(stageHeight)) {
    throw new TypeError("stageWidth and stageHeight must be finite nonnegative numbers.");
  }
  const { sourceCanvas, visibleBounds } = configuration;
  const width = Math.min(
    configuration.maximumSize,
    Math.max(configuration.minimumSize, stageWidth * configuration.sizeRatio),
  );
  const scale = width / sourceCanvas.width;
  const height = sourceCanvas.height * scale;
  const visualWidth = (visibleBounds.right - visibleBounds.left) * scale;
  const visualHeight = (visibleBounds.bottom - visibleBounds.top) * scale;
  const visualRight = stageWidth * configuration.anchorX;
  const visualTop = stageHeight * configuration.anchorY;
  const left = visualRight - visibleBounds.right * scale;
  const top = visualTop - visibleBounds.top * scale;
  const retractedTranslateX = Math.max(0, visualWidth - configuration.retractedReveal);
  const hidden = stageWidth < configuration.minimumStageWidth ||
    stageHeight < configuration.minimumStageHeight ||
    visualWidth > Math.max(0, stageWidth - configuration.essentialControlClearance * 2) ||
    visualTop + visualHeight > stageHeight - configuration.essentialControlClearance;

  return Object.freeze({
    hidden,
    width,
    height,
    left,
    top,
    extendedTranslateX: 0,
    retractedTranslateX,
    visualBounds: Object.freeze({
      left: visualRight - visualWidth,
      top: visualTop,
      right: visualRight,
      bottom: visualTop + visualHeight,
      width: visualWidth,
      height: visualHeight,
    }),
  });
}

export function smartBoardIntersectsProtectedZone(
  registration,
  stageBounds,
  protectedBounds,
  configuration = RESPONSIVE_SMART_BOARD_REGISTRATION,
) {
  const clearance = configuration.essentialControlClearance;
  const visible = registration.visualBounds;
  const absolute = {
    left: stageBounds.left + visible.left,
    right: stageBounds.left + visible.right,
    top: stageBounds.top + visible.top,
    bottom: stageBounds.top + visible.bottom,
  };
  return protectedBounds.some((bounds) =>
    absolute.right > bounds.left - clearance &&
    absolute.left < bounds.right + clearance &&
    absolute.bottom > bounds.top - clearance &&
    absolute.top < bounds.bottom + clearance
  );
}

export function registerResponsiveSmartBoard({
  stage,
  mount,
  protectedElements = [],
  ResizeObserver: ResizeObserverConstructor = globalThis.ResizeObserver,
} = {}) {
  if (!stage || typeof stage.getBoundingClientRect !== "function") {
    throw new TypeError("stage must provide getBoundingClientRect().");
  }
  if (!mount || !mount.style || !mount.dataset) {
    throw new TypeError("mount must provide style and dataset objects.");
  }
  if (typeof ResizeObserverConstructor !== "function") {
    throw new TypeError("ResizeObserver must be available.");
  }

  const update = () => {
    const bounds = stage.getBoundingClientRect();
    const calculated = calculateResponsiveSmartBoardRegistration(bounds.width, bounds.height);
    const protectedBounds = protectedElements
      .filter((element) => element && typeof element.getBoundingClientRect === "function")
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const protectedZoneCollision = smartBoardIntersectsProtectedZone(
      calculated,
      bounds,
      protectedBounds,
    );
    const registration = Object.freeze({
      ...calculated,
      hidden: calculated.hidden || protectedZoneCollision,
      protectedZoneCollision,
    });
    mount.style.width = `${registration.width}px`;
    mount.style.height = `${registration.height}px`;
    mount.style.left = `${registration.left}px`;
    mount.style.top = `${registration.top}px`;
    mount.style.visibility = registration.hidden ? "hidden" : "visible";
    mount.style.setProperty("--smart-board-extended-x", `${registration.extendedTranslateX}px`);
    mount.style.setProperty("--smart-board-retracted-x", `${registration.retractedTranslateX}px`);
    mount.dataset.smartBoardRegistration = RESPONSIVE_SMART_BOARD_REGISTRATION.anchor;
    return registration;
  };

  const observer = new ResizeObserverConstructor(update);
  observer.observe(stage);
  protectedElements.forEach((element) => {
    if (element) observer.observe(element);
  });
  const initial = update();

  return Object.freeze({
    configuration: RESPONSIVE_SMART_BOARD_REGISTRATION,
    initial,
    update,
    disconnect: () => observer.disconnect(),
  });
}
