export const TABLE_PROJECTION_START_TIMING = Object.freeze({
  duration: 500,
  reducedDuration: 150,
  startingHeightRatio: 0.08,
  endingHeightRatio: 1,
  normalizedHeightFromTableImage: 0.08,
  endingFieldOpacity: 0.62,
  startingEmitterOpacity: 0.75,
  endingEmitterOpacity: 1,
  maximumHeightOvershoot: 0.02,
  easing: Object.freeze([0.34, 1.56, 0.64, 1]),
});

export const TABLE_PROJECTION_FIELD_CONFIGURATION = Object.freeze({
  emitterPlane: Object.freeze([
    Object.freeze([0.104486, 0.239353]),
    Object.freeze([0.754685, 0.188245]),
    Object.freeze([0.917093, 0.390971]),
    Object.freeze([0.180579, 0.437819]),
  ]),
  colors: Object.freeze({
    base: 0x55ddf5,
    perimeter: 0x8ff3ff,
    center: 0x35c9e8,
    trace: 0xb9f8ff,
  }),
  alpha: Object.freeze({
    topPerimeter: 0.36,
    topCenter: 0.10,
    rear: 0.18,
    side: 0.30,
    front: 0.26,
    trace: 0.22,
  }),
  edgeFeatherCssPixels: 2,
  renderOrder: 0,
  maximumMeshes: 2,
  maximumAdditionalRenderCalls: 0,
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function bezierCoordinate(t, first, second) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function bezierSlope(t, first, second) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * first + 6 * inverse * t * (second - first) + 3 * t * t * (1 - second);
}

export function projectionSettleEasing(progress) {
  const x = clamp(Number(progress) || 0, 0, 1);
  let t = x;
  for (let index = 0; index < 8; index += 1) {
    const error = bezierCoordinate(t, 0.34, 0.64) - x;
    const slope = bezierSlope(t, 0.34, 0.64);
    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) break;
    t = clamp(t - error / slope, 0, 1);
  }
  return clamp(bezierCoordinate(t, 1.56, 1), 0, 1.02);
}

export function calculateTableProjectionPresentation(elapsed, {
  duration = TABLE_PROJECTION_START_TIMING.duration,
  reducedMotion = false,
  initial = Object.freeze({ heightRatio: 0.08, fieldOpacity: 0, emitterOpacity: 0.75 }),
  target = Object.freeze({ heightRatio: 1, fieldOpacity: 0.62, emitterOpacity: 1 }),
} = {}) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(duration) || duration < 0) {
    throw new TypeError("elapsed and duration must be finite nonnegative numbers.");
  }
  const progress = duration === 0 ? 1 : clamp(elapsed / duration, 0, 1);
  const eased = reducedMotion ? progress : projectionSettleEasing(progress);
  const bounded = progress;
  return Object.freeze({
    progress,
    heightRatio: initial.heightRatio + (target.heightRatio - initial.heightRatio) * eased,
    fieldOpacity: initial.fieldOpacity + (target.fieldOpacity - initial.fieldOpacity) * bounded,
    emitterOpacity: initial.emitterOpacity + (target.emitterOpacity - initial.emitterOpacity) * bounded,
    complete: progress >= 1,
  });
}

export function calculateRegisteredFieldPoints(registration, heightRatio) {
  const transform = registration?.transform;
  if (!transform || ![transform.x, transform.y, transform.z, transform.width, transform.height, heightRatio].every(Number.isFinite)) {
    throw new TypeError("A finite registered Table transform and heightRatio are required.");
  }
  const base = TABLE_PROJECTION_FIELD_CONFIGURATION.emitterPlane.map(([x, y]) => Object.freeze({
    x: transform.x - transform.width / 2 + x * transform.width,
    y: transform.y + transform.height / 2 - y * transform.height,
    z: transform.z + 0.5,
  }));
  const height = transform.height * TABLE_PROJECTION_START_TIMING.normalizedHeightFromTableImage * heightRatio;
  const top = base.map((point) => Object.freeze({ ...point, y: point.y + height }));
  return Object.freeze({ base: Object.freeze(base), top: Object.freeze(top), height });
}

const once = (callback = () => true) => {
  let claimed = false;
  return (...args) => {
    if (claimed) return false;
    claimed = true;
    return callback(...args);
  };
};

export function createTableProjectionStartView({
  THREE,
  camera,
  getRegistration,
  getTableVisible,
  adoptEmitterOpacity,
  document,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  audio,
} = {}) {
  const required = ["BufferGeometry", "Float32BufferAttribute", "ShaderMaterial", "Mesh", "LineBasicMaterial", "LineSegments"];
  if (!THREE || required.some((name) => typeof THREE[name] !== "function")) throw new TypeError("Required THREE field constructors are unavailable.");
  if (!camera || typeof camera.add !== "function" || typeof camera.remove !== "function") throw new TypeError("A camera host is required.");
  if (typeof getRegistration !== "function" || typeof getTableVisible !== "function" || typeof adoptEmitterOpacity !== "function") {
    throw new TypeError("Registration, visibility, and emitter handoff functions are required.");
  }
  if (!document || typeof document.addEventListener !== "function" || typeof document.removeEventListener !== "function") {
    throw new TypeError("Document visibility events are required.");
  }
  if (typeof requestAnimationFrame !== "function" || typeof now !== "function") throw new TypeError("Animation timing functions are required.");

  const fieldGeometry = new THREE.BufferGeometry();
  const traceGeometry = new THREE.BufferGeometry();
  const fieldMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: "attribute float aAlpha; varying float vAlpha; varying vec3 vColor; void main(){vAlpha=aAlpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform float uOpacity; varying float vAlpha; varying vec3 vColor; void main(){float alpha=uOpacity*vAlpha;if(alpha<=0.001)discard;gl_FragColor=vec4(vColor,alpha);}",
    vertexColors: true,
  });
  const traceMaterial = new THREE.LineBasicMaterial({
    color: TABLE_PROJECTION_FIELD_CONFIGURATION.colors.trace,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
  const fieldMesh = new THREE.Mesh(fieldGeometry, fieldMaterial);
  const traceMesh = new THREE.LineSegments(traceGeometry, traceMaterial);
  fieldMesh.name = "workshopTableProjectionStartingField";
  traceMesh.name = "workshopTableProjectionStartingTraces";
  fieldMesh.renderOrder = traceMesh.renderOrder = TABLE_PROJECTION_FIELD_CONFIGURATION.renderOrder;
  fieldMesh.raycast = traceMesh.raycast = () => {};
  camera.add(fieldMesh);
  camera.add(traceMesh);

  let presentation = { heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 };
  let state = "POWERED_ON";
  let active = false;
  let disposed = false;
  let emitterHandoffActive = false;
  let token = 0;
  let frameId = null;
  let animation = null;

  const colorComponents = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  const appendVertex = (positions, colors, alphas, point, color, alpha) => {
    positions.push(point.x, point.y, point.z);
    colors.push(...colorComponents(color));
    alphas.push(alpha);
  };
  const rebuildGeometry = () => {
    const registration = getRegistration();
    if (!registration?.transform) return false;
    const points = calculateRegisteredFieldPoints(registration, presentation.heightRatio);
    const positions = [], colors = [], alphas = [];
    const alpha = TABLE_PROJECTION_FIELD_CONFIGURATION.alpha;
    const sideAlphas = [alpha.rear, alpha.side, alpha.front, alpha.side];
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      [[points.base[index], points.base[next], points.top[next]], [points.base[index], points.top[next], points.top[index]]]
        .flat().forEach((point) => appendVertex(positions, colors, alphas, point, TABLE_PROJECTION_FIELD_CONFIGURATION.colors.base, sideAlphas[index]));
    }
    const center = Object.freeze({
      x: points.top.reduce((sum, point) => sum + point.x, 0) / 4,
      y: points.top.reduce((sum, point) => sum + point.y, 0) / 4,
      z: points.top[0].z,
    });
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      appendVertex(positions, colors, alphas, points.top[index], TABLE_PROJECTION_FIELD_CONFIGURATION.colors.perimeter, alpha.topPerimeter);
      appendVertex(positions, colors, alphas, points.top[next], TABLE_PROJECTION_FIELD_CONFIGURATION.colors.perimeter, alpha.topPerimeter);
      appendVertex(positions, colors, alphas, center, TABLE_PROJECTION_FIELD_CONFIGURATION.colors.center, alpha.topCenter);
    }
    fieldGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    fieldGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    fieldGeometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
    const tracePositions = [];
    for (let index = 0; index < 4; index += 1) tracePositions.push(points.base[index].x, points.base[index].y, points.base[index].z, points.top[index].x, points.top[index].y, points.top[index].z);
    traceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tracePositions, 3));
    fieldGeometry.computeBoundingSphere?.();
    traceGeometry.computeBoundingSphere?.();
    return true;
  };
  const apply = (next) => {
    presentation = {
      heightRatio: Math.max(0, next.heightRatio),
      // WS-014 may adopt the approved Fully Active opacity while this view
      // continues to own the registered field geometry and reversal path.
      fieldOpacity: clamp(next.fieldOpacity, 0, 0.72),
      emitterOpacity: clamp(next.emitterOpacity, TABLE_PROJECTION_START_TIMING.startingEmitterOpacity, TABLE_PROJECTION_START_TIMING.endingEmitterOpacity),
    };
    if (emitterHandoffActive) adoptEmitterOpacity(presentation.emitterOpacity);
    fieldMaterial.uniforms.uOpacity.value = presentation.fieldOpacity;
    traceMaterial.opacity = presentation.fieldOpacity * TABLE_PROJECTION_FIELD_CONFIGURATION.alpha.trace;
    rebuildGeometry();
    const visible = active && getTableVisible() && presentation.fieldOpacity > 0;
    fieldMesh.visible = traceMesh.visible = visible;
    return presentation;
  };
  apply(presentation);

  const cancelFrame = () => {
    if (frameId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
    frameId = null;
  };
  const schedule = ({ target, baseDuration, endpointState, complete }) => {
    cancelFrame();
    const currentToken = ++token;
    const claim = once(complete);
    const initial = { ...presentation };
    const distance = Math.max(
      Math.abs(target.heightRatio - initial.heightRatio),
      Math.abs(target.fieldOpacity - initial.fieldOpacity) / TABLE_PROJECTION_START_TIMING.endingFieldOpacity,
      Math.abs(target.emitterOpacity - initial.emitterOpacity) / 0.25,
    );
    const reduced = reducedMotion();
    const duration = (reduced ? TABLE_PROJECTION_START_TIMING.reducedDuration : baseDuration) * Math.min(1, distance);
    animation = { token: currentToken, initial, target, duration, startedAt: null, pausedAt: null, endpointState, complete: claim, reduced };
    const finish = () => {
      if (!animation || animation.token !== currentToken || token !== currentToken) return false;
      apply(target);
      state = endpointState;
      if (endpointState === "POWERED_ON") emitterHandoffActive = false;
      animation = null;
      frameId = null;
      return claim();
    };
    const frame = (timestamp) => {
      frameId = null;
      if (!animation || animation.token !== currentToken || token !== currentToken || disposed || document.hidden) return;
      const currentTime = Number.isFinite(timestamp) ? timestamp : now();
      if (animation.startedAt === null) animation.startedAt = currentTime;
      const result = calculateTableProjectionPresentation(Math.max(0, currentTime - animation.startedAt), { duration, reducedMotion: reduced, initial, target });
      apply(result);
      if (result.complete) finish();
      else frameId = requestAnimationFrame(frame);
    };
    animation.frame = frame;
    if (duration === 0) finish();
    else frameId = requestAnimationFrame(frame);
    return Object.freeze({ token: currentToken, duration });
  };

  const handleVisibility = () => {
    if (!animation) return;
    if (document.hidden) {
      if (animation.pausedAt === null) animation.pausedAt = now();
      cancelFrame();
    } else if (animation.pausedAt !== null) {
      if (animation.startedAt !== null) animation.startedAt += Math.max(0, now() - animation.pausedAt);
      animation.pausedAt = null;
      frameId = requestAnimationFrame(animation.frame);
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  return Object.freeze({
    ready: Promise.resolve(),
    meshes: Object.freeze({ field: fieldMesh, traces: traceMesh }),
    materials: Object.freeze({ field: fieldMaterial, traces: traceMaterial }),
    start({ complete = () => {} } = {}) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if (state === "PROJECTION_STARTED" && !animation) return Object.freeze({ ok: true, code: "IDEMPOTENT", duration: 0 });
      emitterHandoffActive = true;
      if (presentation.fieldOpacity === 0 && presentation.heightRatio === 0) {
        apply({ ...presentation, heightRatio: TABLE_PROJECTION_START_TIMING.startingHeightRatio });
      }
      state = "PROJECTION_STARTING";
      try { audio?.trigger?.("projector-rise"); } catch {}
      return Object.freeze({ ok: true, code: presentation.fieldOpacity > 0 ? "REVERSING" : "ACCEPTED", ...schedule({
        target: { heightRatio: 1, fieldOpacity: 0.62, emitterOpacity: 1 },
        baseDuration: 500,
        endpointState: "PROJECTION_STARTED",
        complete,
      }) });
    },
    stopToPoweredOn({ complete = () => {} } = {}) {
      emitterHandoffActive = true;
      state = "REVERSING";
      return Object.freeze({ ok: true, code: "REVERSING", ...schedule({
        target: { heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 },
        baseDuration: 500,
        endpointState: "POWERED_ON",
        complete,
      }) });
    },
    enterFaultSafe({ complete = () => {} } = {}) {
      cancelFrame();
      ++token;
      animation = null;
      apply({ heightRatio: 0, fieldOpacity: 0, emitterOpacity: 0.75 });
      emitterHandoffActive = false;
      state = "FAULT_SAFE";
      once(complete)();
      return Object.freeze({ ok: true, code: "FAULT_SAFE" });
    },
    setWorkshopActive(value) { active = value === true; apply(presentation); return active; },
    syncRegistration() { apply(presentation); return getRegistration(); },
    adoptActiveFieldOpacity(value) {
      if (disposed) return Object.freeze({ ok: false, code: "DISPOSED" });
      if (state !== "PROJECTION_STARTED" || animation) {
        return Object.freeze({ ok: false, code: "PROJECTION_START_NOT_SETTLED" });
      }
      if (!Number.isFinite(value) || value < 0.62 || value > 0.72) {
        throw new RangeError("Fully Active field opacity must be between 0.62 and 0.72.");
      }
      apply({ ...presentation, heightRatio: 1, fieldOpacity: value, emitterOpacity: 1 });
      return Object.freeze({ ok: true, code: "ADOPTED", fieldOpacity: presentation.fieldOpacity });
    },
    cancel() { cancelFrame(); ++token; animation = null; },
    get state() { return state; },
    get presentation() { return Object.freeze({ ...presentation }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      ++token;
      animation = null;
      document.removeEventListener("visibilitychange", handleVisibility);
      camera.remove(fieldMesh);
      camera.remove(traceMesh);
      fieldGeometry.dispose();
      traceGeometry.dispose();
      fieldMaterial.dispose();
      traceMaterial.dispose();
    },
  });
}
