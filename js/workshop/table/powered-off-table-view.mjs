import { WORKSHOP_WORKSTATION_REGISTRATION } from
  "../runtime/workshop-workstation-registration.mjs";

export const TABLETOP_REAR_ASSET =
  "assets/images/workshop/runtime/derivatives/table/table-powered-off-tabletop-rear-1761x1174.png";
export const FRONT_CHASSIS_ASSET =
  "assets/images/workshop/runtime/derivatives/table/table-powered-off-front-chassis-1761x1174.png";
export const POWERING_ON_REAR_EMITTER_ASSET =
  "assets/images/workshop/runtime/derivatives/table/table-powering-on-emitters-rear-1761x1174.png";
export const POWERING_ON_FRONT_EMITTER_ASSET =
  "assets/images/workshop/runtime/derivatives/table/table-powering-on-emitters-front-1761x1174.png";

export const WORKSHOP_STUDENT_COMPOSITE_LAYER = 30;

export const POWERED_OFF_TABLE_STATE = Object.freeze({
  name: "POWERED_OFF",
  opacity: 1,
  scale: 1,
});

export const POWERED_OFF_TABLE_REGISTRATION = Object.freeze({
  registrationRectangle: "WORKSHOP_VIEWPORT_STAGE",
  anchor: WORKSHOP_WORKSTATION_REGISTRATION.table.anchor,
  anchorX: 0.5,
  anchorY: 1,
  preferredWidthRatio: WORKSHOP_WORKSTATION_REGISTRATION.table.preferredWidthRatio,
  minimumWidth: WORKSHOP_WORKSTATION_REGISTRATION.table.minimumWidth,
  maximumWidth: WORKSHOP_WORKSTATION_REGISTRATION.table.maximumWidth,
  essentialControlClearance:
    WORKSHOP_WORKSTATION_REGISTRATION.table.essentialControlClearance,
  sourceWidth: 1761,
  sourceHeight: 1174,
  visibleBounds: Object.freeze({ left: 42, top: 229, right: 1714, bottom: 1084 }),
  visualBaseCenter: Object.freeze({ x: 0.49858, y: 0.923339 }),
  cameraDepth: 800,
});

export const POWERED_OFF_TABLE_EMITTER_PLANE = Object.freeze([
  Object.freeze({ id: "rear-left", source: Object.freeze([184, 281]), normalized: Object.freeze([0.104486, 0.239353]) }),
  Object.freeze({ id: "rear-right", source: Object.freeze([1329, 221]), normalized: Object.freeze([0.754685, 0.188245]) }),
  Object.freeze({ id: "front-right", source: Object.freeze([1615, 459]), normalized: Object.freeze([0.917093, 0.390971]) }),
  Object.freeze({ id: "front-left", source: Object.freeze([318, 514]), normalized: Object.freeze([0.180579, 0.437819]) }),
]);

const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;

const intersects = (first, second, clearance) =>
  first.right > second.left - clearance &&
  first.left < second.right + clearance &&
  first.bottom > second.top - clearance &&
  first.top < second.bottom + clearance;

function registrationAtWidth(stageBounds, width, configuration) {
  const height = width * configuration.sourceHeight / configuration.sourceWidth;
  const visualCenterX =
    (configuration.visibleBounds.left + configuration.visibleBounds.right) /
    2 / configuration.sourceWidth;
  const visibleBaseY = configuration.visibleBounds.bottom / configuration.sourceHeight;
  const anchorScreenX = stageBounds.left + stageBounds.width * configuration.anchorX;
  const anchorScreenY = stageBounds.top + stageBounds.height * configuration.anchorY;
  const imageLeft = anchorScreenX - visualCenterX * width;
  const imageTop = anchorScreenY - visibleBaseY * height;
  const visible = Object.freeze({
    left: imageLeft + configuration.visibleBounds.left / configuration.sourceWidth * width,
    top: imageTop + configuration.visibleBounds.top / configuration.sourceHeight * height,
    right: imageLeft + configuration.visibleBounds.right / configuration.sourceWidth * width,
    bottom: imageTop + configuration.visibleBounds.bottom / configuration.sourceHeight * height,
  });
  return Object.freeze({
    width,
    height,
    imageLeft,
    imageTop,
    anchorScreenX,
    anchorScreenY,
    visible,
  });
}

export function calculatePoweredOffTableRegistration({
  stageBounds,
  protectedBounds = [],
  configuration = POWERED_OFF_TABLE_REGISTRATION,
} = {}) {
  if (!stageBounds || !finiteNonnegative(stageBounds.width) ||
      !finiteNonnegative(stageBounds.height)) {
    throw new TypeError("stageBounds must provide finite nonnegative width and height.");
  }
  const preferredWidth = Math.min(
    configuration.maximumWidth,
    Math.max(configuration.minimumWidth, stageBounds.width * configuration.preferredWidthRatio),
  );
  const isSafe = (candidate) => {
    const { visible } = candidate;
    const inside = visible.left >= stageBounds.left &&
      visible.right <= stageBounds.left + stageBounds.width &&
      visible.top >= stageBounds.top &&
      visible.bottom <= stageBounds.top + stageBounds.height;
    const collision = protectedBounds.some((bounds) => bounds && bounds.width > 0 &&
      bounds.height > 0 && intersects(visible, bounds, configuration.essentialControlClearance));
    return inside && !collision;
  };

  let selected = registrationAtWidth(stageBounds, preferredWidth, configuration);
  if (!isSafe(selected) && preferredWidth > configuration.minimumWidth) {
    const minimum = registrationAtWidth(stageBounds, configuration.minimumWidth, configuration);
    if (isSafe(minimum)) {
      let low = configuration.minimumWidth;
      let high = preferredWidth;
      for (let index = 0; index < 24; index += 1) {
        const middle = (low + high) / 2;
        if (isSafe(registrationAtWidth(stageBounds, middle, configuration))) low = middle;
        else high = middle;
      }
      selected = registrationAtWidth(stageBounds, low, configuration);
    } else {
      selected = minimum;
    }
  }
  const hidden = stageBounds.width === 0 || stageBounds.height === 0 || !isSafe(selected);
  return Object.freeze({
    ...selected,
    preferredWidth,
    reducedForClearance: selected.width < preferredWidth - 0.001,
    hidden,
  });
}

export function calculateCameraPlaneTransform({ registration, canvasBounds, camera } = {}) {
  if (!registration || !canvasBounds || !finiteNonnegative(canvasBounds.width) ||
      !finiteNonnegative(canvasBounds.height) || !camera || !Number.isFinite(camera.fov) ||
      !Number.isFinite(camera.aspect) || !Number.isFinite(camera.far)) {
    throw new TypeError("registration, canvasBounds, and camera projection values are required.");
  }
  const depth = Math.min(POWERED_OFF_TABLE_REGISTRATION.cameraDepth, camera.far * 0.8);
  const viewHeight = 2 * depth * Math.tan(camera.fov * Math.PI / 360);
  const viewWidth = viewHeight * camera.aspect;
  const centerX = registration.imageLeft + registration.width / 2;
  const centerY = registration.imageTop + registration.height / 2;
  const ndcX = ((centerX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
  const ndcY = 1 - ((centerY - canvasBounds.top) / canvasBounds.height) * 2;
  return Object.freeze({
    x: ndcX * viewWidth / 2,
    y: ndcY * viewHeight / 2,
    z: -depth,
    width: registration.width / canvasBounds.width * viewWidth,
    height: registration.height / canvasBounds.height * viewHeight,
  });
}

function descendantsOf(objects) {
  const descendants = new Set();
  objects.filter(Boolean).forEach((root) => {
    if (typeof root.traverse === "function") root.traverse((object) => descendants.add(object));
    else descendants.add(root);
  });
  return descendants;
}

function matrixFingerprint(camera) {
  const values = [];
  [camera.matrixWorld, camera.matrixWorldInverse, camera.projectionMatrix].forEach((matrix) => {
    if (matrix && Array.isArray(matrix.elements)) values.push(...matrix.elements);
  });
  if (camera.position) values.push(camera.position.x, camera.position.y, camera.position.z);
  if (camera.quaternion) values.push(camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w);
  if (camera.up) values.push(camera.up.x, camera.up.y, camera.up.z);
  values.push(camera.fov);
  return values.join("|");
}

export function createPoweredOffTableCompositor({
  THREE,
  scene,
  camera,
  renderer,
  raycaster,
  stage,
  getRegistrationBounds,
  protectedElements = [],
  getStudentObjects = () => [],
  getCadDimensionGroup = () => null,
  lights = [],
  rearAssetPath = TABLETOP_REAR_ASSET,
  chassisAssetPath = FRONT_CHASSIS_ASSET,
  rearEmitterAssetPath = POWERING_ON_REAR_EMITTER_ASSET,
  frontEmitterAssetPath = POWERING_ON_FRONT_EMITTER_ASSET,
  presentationEnabled = true,
  ResizeObserver: ResizeObserverConstructor = globalThis.ResizeObserver,
} = {}) {
  if (!THREE || typeof THREE.TextureLoader !== "function" ||
      typeof THREE.PlaneGeometry !== "function" || typeof THREE.MeshBasicMaterial !== "function" ||
      typeof THREE.Mesh !== "function") throw new TypeError("THREE constructors are required.");
  if (!scene || typeof scene.add !== "function" || !camera || typeof camera.add !== "function") {
    throw new TypeError("scene and camera hosts are required.");
  }
  if (!renderer || typeof renderer.render !== "function" || typeof renderer.clearDepth !== "function" ||
      !renderer.domElement || typeof renderer.domElement.getBoundingClientRect !== "function") {
    throw new TypeError("renderer must support render(), clearDepth(), and measurable DOM output.");
  }
  if (!raycaster || !raycaster.layers || !stage || typeof stage.getBoundingClientRect !== "function") {
    throw new TypeError("raycaster layers and a measurable stage are required.");
  }
  if (typeof getRegistrationBounds !== "function") {
    throw new TypeError("a stable registration-bounds provider is required.");
  }
  if (typeof ResizeObserverConstructor !== "function") throw new TypeError("ResizeObserver is required.");

  const geometry = new THREE.PlaneGeometry(1, 1);
  const rearMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 1, alphaTest: 0.01, depthTest: true, depthWrite: true,
  });
  const chassisMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 1, alphaTest: 0.01, depthTest: false, depthWrite: false,
  });
  const rearEmitterMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, alphaTest: 0.01, depthTest: true, depthWrite: false,
  });
  const frontEmitterMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, alphaTest: 0.01, depthTest: false, depthWrite: false,
  });
  const rearMesh = new THREE.Mesh(geometry, rearMaterial);
  const chassisMesh = new THREE.Mesh(geometry, chassisMaterial);
  const rearEmitterMesh = new THREE.Mesh(geometry, rearEmitterMaterial);
  const frontEmitterMesh = new THREE.Mesh(geometry, frontEmitterMaterial);
  rearMesh.name = "workshopPoweredOffTabletopRear";
  chassisMesh.name = "workshopPoweredOffFrontChassis";
  rearEmitterMesh.name = "workshopTablePoweringOnRearEmitters";
  frontEmitterMesh.name = "workshopTablePoweringOnFrontEmitters";
  rearMesh.renderOrder = -30;
  rearEmitterMesh.renderOrder = -29;
  chassisMesh.renderOrder = 10;
  frontEmitterMesh.renderOrder = 11;
  [rearMesh, rearEmitterMesh, chassisMesh, frontEmitterMesh].forEach((mesh) => {
    mesh.visible = false;
    mesh.raycast = function() {};
    mesh.userData.workshopDecoration = true;
    mesh.userData.workshopTableState = POWERED_OFF_TABLE_STATE.name;
  });

  const cameraOriginalParent = camera.parent || null;
  if (camera.parent !== scene) scene.add(camera);
  camera.add(rearMesh);
  camera.add(rearEmitterMesh);
  camera.add(chassisMesh);
  camera.add(frontEmitterMesh);

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let loaded = 0;
  let disposed = false;
  let active = false;
  let tableVisible = false;
  const classroomPresentationEnabled = presentationEnabled !== false;
  let lastRegistration = null;
  const textureLoader = new THREE.TextureLoader();
  const onLoaded = () => { loaded += 1; if (loaded === 4) { updateRegistration(); resolveReady(); } };
  const onError = (path) => (error) => rejectReady(new Error(`Workshop Table layer failed to load: ${path}`, { cause: error }));
  const rearTexture = textureLoader.load(rearAssetPath, onLoaded, undefined, onError(rearAssetPath));
  const chassisTexture = textureLoader.load(chassisAssetPath, onLoaded, undefined, onError(chassisAssetPath));
  const rearEmitterTexture = textureLoader.load(
    rearEmitterAssetPath, onLoaded, undefined, onError(rearEmitterAssetPath),
  );
  const frontEmitterTexture = textureLoader.load(
    frontEmitterAssetPath, onLoaded, undefined, onError(frontEmitterAssetPath),
  );
  rearMaterial.map = rearTexture;
  chassisMaterial.map = chassisTexture;
  rearEmitterMaterial.map = rearEmitterTexture;
  frontEmitterMaterial.map = frontEmitterTexture;
  rearMaterial.needsUpdate = true;
  chassisMaterial.needsUpdate = true;
  rearEmitterMaterial.needsUpdate = true;
  frontEmitterMaterial.needsUpdate = true;

  const savedObjectMasks = new Map();
  const savedLightMasks = new Map();
  let savedRaycasterMask = null;

  function assignLayer(object) {
    if (!object || !object.layers) return;
    if (!savedObjectMasks.has(object)) savedObjectMasks.set(object, object.layers.mask);
    object.layers.set(WORKSHOP_STUDENT_COMPOSITE_LAYER);
  }

  function syncStudentLayerMembership() {
    if (!active || !tableVisible) return new Set();
    const cad = getCadDimensionGroup();
    const permitted = descendantsOf([
      ...getStudentObjects().filter((object) => object && object.parent && object.visible !== false),
      cad && cad.parent && cad.visible !== false ? cad : null,
    ]);
    permitted.forEach(assignLayer);
    lights.filter(Boolean).forEach((light) => {
      if (!light.layers) return;
      if (!savedLightMasks.has(light)) savedLightMasks.set(light, light.layers.mask);
      light.layers.enable(WORKSHOP_STUDENT_COMPOSITE_LAYER);
    });
    if (savedRaycasterMask === null) savedRaycasterMask = raycaster.layers.mask;
    raycaster.layers.enable(WORKSHOP_STUDENT_COMPOSITE_LAYER);
    return permitted;
  }

  function restoreLayerMembership() {
    savedObjectMasks.forEach((mask, object) => { if (object.layers) object.layers.mask = mask; });
    savedObjectMasks.clear();
    savedLightMasks.forEach((mask, light) => { if (light.layers) light.layers.mask = mask; });
    savedLightMasks.clear();
    if (savedRaycasterMask !== null) raycaster.layers.mask = savedRaycasterMask;
    savedRaycasterMask = null;
  }

  function updateRegistration() {
    if (disposed) return null;
    const canvasBounds = renderer.domElement.getBoundingClientRect();
    const providedStageBounds = getRegistrationBounds({ canvasBounds });
    const stageBoundsAreValid = providedStageBounds &&
      Number.isFinite(providedStageBounds.left) && Number.isFinite(providedStageBounds.top) &&
      finiteNonnegative(providedStageBounds.width) && finiteNonnegative(providedStageBounds.height) &&
      providedStageBounds.left >= canvasBounds.left && providedStageBounds.top >= canvasBounds.top &&
      providedStageBounds.left + providedStageBounds.width <= canvasBounds.left + canvasBounds.width &&
      providedStageBounds.top + providedStageBounds.height <= canvasBounds.top + canvasBounds.height;
    // Fail closed rather than accepting the live ruler rectangle. That DOM
    // rectangle is intentionally directional and object-dependent.
    const stageBounds = stageBoundsAreValid
      ? providedStageBounds
      : { left: canvasBounds.left, top: canvasBounds.top, width: 0, height: 0 };
    const protectedBounds = protectedElements.filter((element) => element &&
      typeof element.getBoundingClientRect === "function")
      .map((element) => element.getBoundingClientRect())
      .filter((bounds) => bounds.width > 0 && bounds.height > 0);
    const registration = calculatePoweredOffTableRegistration({ stageBounds, protectedBounds });
    if (!canvasBounds.width || !canvasBounds.height) {
      tableVisible = false;
      rearMesh.visible = rearEmitterMesh.visible = chassisMesh.visible = frontEmitterMesh.visible = false;
      lastRegistration = registration;
      return registration;
    }
    const transform = calculateCameraPlaneTransform({ registration, canvasBounds, camera });
    [rearMesh, rearEmitterMesh, chassisMesh, frontEmitterMesh].forEach((mesh) => {
      mesh.position.set(transform.x, transform.y, transform.z);
      mesh.scale.set(transform.width, transform.height, 1);
    });
    tableVisible = active && loaded === 4 && !registration.hidden;
    const presentationVisible = tableVisible && classroomPresentationEnabled;
    rearMesh.visible = chassisMesh.visible = presentationVisible;
    rearEmitterMesh.visible = presentationVisible && rearEmitterMaterial.opacity > 0;
    frontEmitterMesh.visible = presentationVisible && frontEmitterMaterial.opacity > 0;
    if (!tableVisible) restoreLayerMembership();
    lastRegistration = Object.freeze({ ...registration, transform });
    return lastRegistration;
  }

  function render() {
    if (!active || disposed) return false;
    updateRegistration();
    if (!tableVisible) return false;
    if (!classroomPresentationEnabled) {
      restoreLayerMembership();
      return false;
    }
    const permitted = syncStudentLayerMembership();
    const savedCameraMask = camera.layers.mask;
    const savedBackground = scene.background;
    const savedAutoClear = renderer.autoClear;
    try {
      camera.layers.mask = savedCameraMask & ~(1 << WORKSHOP_STUDENT_COMPOSITE_LAYER);
      renderer.render(scene, camera);
      const beforeFinalPass = matrixFingerprint(camera);
      renderer.clearDepth();
      renderer.autoClear = false;
      scene.background = null;
      camera.layers.set(WORKSHOP_STUDENT_COMPOSITE_LAYER);
      renderer.render(scene, camera);
      if (matrixFingerprint(camera) !== beforeFinalPass) {
        throw new Error("Camera changed during the bounded Table final student pass.");
      }
      return true;
    } finally {
      camera.layers.mask = savedCameraMask;
      scene.background = savedBackground;
      renderer.autoClear = savedAutoClear;
      rearMesh.userData.finalPassPermittedCount = permitted.size;
    }
  }

  function setWorkshopActive(value) {
    active = value === true;
    if (!active) {
      rearMesh.visible = rearEmitterMesh.visible = chassisMesh.visible = frontEmitterMesh.visible = false;
      tableVisible = false;
      restoreLayerMembership();
    }
    updateRegistration();
    return active;
  }

  const observer = new ResizeObserverConstructor(updateRegistration);
  observer.observe(stage);
  observer.observe(renderer.domElement);
  protectedElements.forEach((element) => { if (element) observer.observe(element); });

  return Object.freeze({
    ready,
    state: POWERED_OFF_TABLE_STATE,
    configuration: POWERED_OFF_TABLE_REGISTRATION,
    emitterPlane: POWERED_OFF_TABLE_EMITTER_PLANE,
    meshes: Object.freeze({
      rear: rearMesh,
      rearEmitter: rearEmitterMesh,
      chassis: chassisMesh,
      frontEmitter: frontEmitterMesh,
    }),
    materials: Object.freeze({
      rear: rearMaterial,
      rearEmitter: rearEmitterMaterial,
      chassis: chassisMaterial,
      frontEmitter: frontEmitterMaterial,
    }),
    textures: Object.freeze({
      rear: rearTexture,
      rearEmitter: rearEmitterTexture,
      chassis: chassisTexture,
      frontEmitter: frontEmitterTexture,
    }),
    get registration() { return lastRegistration; },
    get presentationEnabled() { return classroomPresentationEnabled; },
    get visible() { return tableVisible; },
    setWorkshopActive,
    syncStudentLayerMembership,
    updateRegistration,
    render,
    restore: restoreLayerMembership,
    dispose() {
      if (disposed) return;
      setWorkshopActive(false);
      disposed = true;
      observer.disconnect();
      camera.remove(rearMesh);
      camera.remove(rearEmitterMesh);
      camera.remove(chassisMesh);
      camera.remove(frontEmitterMesh);
      if (cameraOriginalParent) cameraOriginalParent.add(camera);
      else if (camera.parent === scene) scene.remove(camera);
      geometry.dispose();
      rearMaterial.dispose();
      rearEmitterMaterial.dispose();
      chassisMaterial.dispose();
      frontEmitterMaterial.dispose();
      rearTexture.dispose();
      rearEmitterTexture.dispose();
      chassisTexture.dispose();
      frontEmitterTexture.dispose();
    },
  });
}
