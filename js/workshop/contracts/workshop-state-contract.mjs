/**
 * THINKamigBOB Workshop state contract (Animation Bible v1.0 / WS-016).
 * Pure data and validation only: no DOM, rendering, timing, or asset loading.
 */

const freeze = (value) => Object.freeze(value);

export const CONTRACT_VERSION = "WS-016/1.0";
export const BIBLE_VERSION = "1.0";

export const TOP_LEVEL_STATES = freeze([
  "OFF", "STARTING", "READY", "SHUTTING_DOWN", "FAULT_SAFE",
]);

// Loading and asset-failure labels belong to the browser host. They are not
// legal Workshop lifecycle states and must never enter the runtime controller.
export const HOST_PRESENTATION_STATES = freeze([
  "OFF", "LOADING", "READY", "STARTING", "ACTIVE", "STOPPING", "FAILED",
]);

export const SUBSYSTEM_STATES = freeze({
  projector: freeze(["POWERED_OFF", "POWERING_ON", "POWERED_ON", "PROJECTION_STARTING", "FULLY_ACTIVE", "FAULT_SAFE"]),
  table: freeze(["POWERED_OFF", "POWERING_ON", "POWERED_ON", "PROJECTION_STARTING", "FULLY_ACTIVE", "FAULT_SAFE"]),
  boardMechanical: freeze(["RETRACTED", "EXTENDING", "EXTENDED", "RETRACTING", "BLOCKED"]),
  boardPower: freeze(["POWERED_OFF", "POWERING_ON", "READY", "POWERING_OFF", "FAULT_SAFE"]),
  boardApplication: freeze(["NONE", "MEASUREMENT_ASSISTANT", "APPLICATION_SWITCHING", "ENGINEERING_NOTEBOOK"]),
  chest: freeze(["PARKED", "UNDOCKING", "DEPLOYED", "DOCKING", "BLOCKED"]),
  drawer: freeze(["CLOSED", "OPENING", "OPEN", "CLOSING", "BLOCKED"]),
  measurement: freeze(["IDLE", "SELECTED_OBJECT", "LEARNING_MODE", "ENGINEERING_NOTEBOOK"]),
});

export const DRAWER_IDS = freeze([
  "D1_MEASURE", "D2_BUILD", "D3_MATERIALS", "D4_COMPONENTS", "D5_NOTEBOOK", "D6_UTILITY",
]);

export const SEMANTIC_ACTIONS = freeze([
  "REQUEST_POWER_ON", "REQUEST_POWER_OFF", "CANCEL_TRANSITION", "RESET_FAULT",
  "SELECT_APPLICATION", "OPEN_DRAWER", "CLOSE_DRAWER", "RESOLVE_BLOCK",
  "SELECT_MEASURABLE_OBJECT", "CLEAR_SELECTION", "ENTER_LEARNING_MODE", "EXIT_LEARNING_MODE", "OPEN_NOTEBOOK",
]);

export const INPUT_SOURCES = freeze(["pointer", "touch", "keyboard", "voice", "host"]);

export const OWNERSHIP = freeze({
  workshop: "top-level orchestration, dependency order, cancellation, and fault containment",
  projector: "projector power/emission states; never owns the table field",
  table: "table emitters, projection field, grid registration, and projection stability",
  smartboard: "board travel, board power, active application, and application focus handoff",
  toolchest: "chest travel and the aggregate drawers-secured interlock",
  drawer: "one drawer rail state, contents availability, obstruction, and close-before-switch",
  measurement: "selection, learning, notebook measurement context, units, and precision",
});

export const CANONICAL_EVENTS = freeze({
  workshop: freeze(["workshop:startup-begun", "workshop:ready", "workshop:shutdown-begun", "workshop:off"]),
  projector: freeze(["projector:powered-on", "projector:projection-started", "projector:active", "projector:powered-off", "projector:fault"]),
  table: freeze(["table:powered-on", "table:projection-started", "workspace:projection-stable", "table:projection-stopped", "table:powered-off"]),
  smartboard: freeze(["smartboard:extended", "smartboard:powered-on", "smartboard:ready", "smartboard:app-changed", "smartboard:retracted"]),
  toolchest: freeze(["toolchest:undocked", "toolchest:deployed", "toolchest:drawers-secured", "toolchest:parked"]),
  drawer: freeze(["drawer:opened", "drawer:closed", "drawer:blocked"]),
  measurement: freeze(["measurement:idle", "measurement:object-selected", "measurement:selection-cleared", "measurement:selection-invalidated", "measurement:learning-mode-entered", "measurement:notebook-opened"]),
});

export const EVENT_OWNER = freeze(Object.fromEntries(
  Object.entries(CANONICAL_EVENTS).flatMap(([owner, events]) => events.map((event) => [event, owner])),
));

const transition = (to, guard = () => true, failure = "DEPENDENCY_NOT_READY") => freeze({ to, guard, failure });
const always = () => true;

const TRANSITIONS = freeze({
  workshop: freeze({
    OFF: freeze([transition("STARTING", (c) => c.assetsLoaded === true && c.allDrawersClosed === true && c.chestParked === true && c.shutdownInProgress !== true, "STARTUP_GUARD_FAILED"), transition("FAULT_SAFE")]),
    STARTING: freeze([transition("READY", (c) => c.startupSequenceComplete === true), transition("SHUTTING_DOWN"), transition("FAULT_SAFE")]),
    READY: freeze([transition("SHUTTING_DOWN", (c) => c.applicationStateSecured === true, "APPLICATION_STATE_UNSECURED"), transition("FAULT_SAFE")]),
    SHUTTING_DOWN: freeze([transition("OFF", (c) => c.shutdownSequenceComplete === true), transition("STARTING", (c) => c.allDrawersClosed === true, "DRAWERS_NOT_CLOSED"), transition("FAULT_SAFE")]),
    FAULT_SAFE: freeze([transition("OFF", (c) => c.faultAcknowledged === true && c.emissiveLayersOff === true, "FAULT_NOT_SECURED")]),
  }),
  projector: freeze({
    POWERED_OFF: freeze([transition("POWERING_ON", (c) => c.workshopState === "STARTING" && c.assetReady === true && c.shutdownLock !== true), transition("FAULT_SAFE")]),
    POWERING_ON: freeze([transition("POWERED_ON"), transition("POWERED_OFF"), transition("FAULT_SAFE")]),
    POWERED_ON: freeze([transition("PROJECTION_STARTING", (c) => c.tableEmittersReady === true), transition("POWERED_OFF", (c) => c.tableProjectionVisible === false), transition("FAULT_SAFE")]),
    PROJECTION_STARTING: freeze([transition("FULLY_ACTIVE", (c) => c.tableProjectionStable === true), transition("POWERED_ON"), transition("FAULT_SAFE")]),
    FULLY_ACTIVE: freeze([transition("PROJECTION_STARTING"), transition("POWERED_ON", (c) => c.tableRendererAvailable === false), transition("FAULT_SAFE")]),
    FAULT_SAFE: freeze([transition("POWERED_OFF", (c) => c.emissiveLayersOff === true)]),
  }),
  table: freeze({
    POWERED_OFF: freeze([transition("POWERING_ON", (c) => c.projectorPoweredOn === true), transition("FAULT_SAFE")]),
    POWERING_ON: freeze([transition("POWERED_ON"), transition("POWERED_OFF"), transition("FAULT_SAFE")]),
    POWERED_ON: freeze([transition("PROJECTION_STARTING", (c) => c.projectorReady === true), transition("POWERED_OFF", (c) => c.projectionVisible === false), transition("FAULT_SAFE")]),
    PROJECTION_STARTING: freeze([transition("FULLY_ACTIVE"), transition("POWERED_ON"), transition("FAULT_SAFE")]),
    FULLY_ACTIVE: freeze([transition("PROJECTION_STARTING"), transition("FAULT_SAFE")]),
    FAULT_SAFE: freeze([transition("POWERED_OFF", (c) => c.projectionVisible === false)]),
  }),
  boardMechanical: freeze({
    RETRACTED: freeze([transition("EXTENDING", (c) => c.projectionStable === true)]),
    EXTENDING: freeze([transition("EXTENDED"), transition("RETRACTING")]),
    EXTENDED: freeze([transition("RETRACTING", (c) => c.boardPoweredOff === true && c.blockingModal !== true && c.unsavedNotebookEdit !== true, "BOARD_RETRACTION_BLOCKED")]),
    RETRACTING: freeze([transition("RETRACTED"), transition("EXTENDING", (c) => c.projectionStable === true)]),
    BLOCKED: freeze([transition("EXTENDED", (c) => c.blockResolved === true)]),
  }),
  boardPower: freeze({
    POWERED_OFF: freeze([transition("POWERING_ON", (c) => c.boardExtended === true && c.projectionStable === true), transition("FAULT_SAFE")]),
    POWERING_ON: freeze([transition("READY"), transition("POWERING_OFF"), transition("FAULT_SAFE")]),
    READY: freeze([transition("POWERING_OFF", (c) => c.applicationStateSecured === true), transition("FAULT_SAFE")]),
    POWERING_OFF: freeze([transition("POWERED_OFF"), transition("POWERING_ON", (c) => c.boardExtended === true && c.projectionStable === true), transition("FAULT_SAFE")]),
    FAULT_SAFE: freeze([transition("POWERED_OFF", (c) => c.displayContentVisible === false)]),
  }),
  boardApplication: freeze({
    NONE: freeze([transition("MEASUREMENT_ASSISTANT", (c) => c.boardReady === true)]),
    MEASUREMENT_ASSISTANT: freeze([transition("APPLICATION_SWITCHING", (c) => c.blockingModal !== true)]),
    APPLICATION_SWITCHING: freeze([transition("MEASUREMENT_ASSISTANT"), transition("ENGINEERING_NOTEBOOK")]),
    ENGINEERING_NOTEBOOK: freeze([transition("APPLICATION_SWITCHING", (c) => c.blockingModal !== true && c.autosaveComplete === true)]),
  }),
  chest: freeze({
    PARKED: freeze([transition("UNDOCKING", (c) => c.boardReady === true && c.allDrawersClosed === true)]),
    UNDOCKING: freeze([transition("DEPLOYED"), transition("DOCKING", (c) => c.allDrawersClosed === true)]),
    DEPLOYED: freeze([transition("DOCKING", (c) => c.allDrawersClosed === true && c.obstructionClear === true, "CHEST_DOCKING_BLOCKED"), transition("BLOCKED")]),
    DOCKING: freeze([transition("PARKED"), transition("UNDOCKING")]),
    BLOCKED: freeze([transition("DEPLOYED", (c) => c.blockResolved === true)]),
  }),
  drawer: freeze({
    CLOSED: freeze([transition("OPENING", (c) => c.chestDeployed === true && c.otherDrawerActive !== true)]),
    OPENING: freeze([transition("OPEN"), transition("CLOSING"), transition("BLOCKED")]),
    OPEN: freeze([transition("CLOSING", (c) => c.uncommittedOperationResolved === true), transition("BLOCKED")]),
    CLOSING: freeze([transition("CLOSED"), transition("OPENING", (c) => c.chestDeployed === true && c.otherDrawerActive !== true), transition("BLOCKED")]),
    BLOCKED: freeze([transition("OPEN", (c) => c.blockResolved === true), transition("CLOSING", (c) => c.blockResolved === true && c.uncommittedOperationResolved === true)]),
  }),
  measurement: freeze({
    IDLE: freeze([transition("SELECTED_OBJECT", (c) => c.workshopReady === true && c.measurementAppActive === true && c.objectMeasurable === true)]),
    SELECTED_OBJECT: freeze([transition("IDLE"), transition("LEARNING_MODE"), transition("ENGINEERING_NOTEBOOK")]),
    LEARNING_MODE: freeze([transition("SELECTED_OBJECT"), transition("IDLE"), transition("ENGINEERING_NOTEBOOK")]),
    ENGINEERING_NOTEBOOK: freeze([transition("SELECTED_OBJECT", (c) => c.selectionStillValid === true), transition("IDLE")]),
  }),
});

export function validateTransition(domain, from, to, context = {}) {
  if (!Object.hasOwn(TRANSITIONS, domain)) return freeze({ ok: false, code: "UNKNOWN_DOMAIN", reason: `Unknown domain: ${domain}` });
  if (!Object.hasOwn(TRANSITIONS[domain], from)) return freeze({ ok: false, code: "UNKNOWN_STATE", reason: `Unknown ${domain} state: ${from}` });
  if (from === to) return freeze({ ok: true, code: "IDEMPOTENT", reason: "The state is already authoritative; no transition restarts." });
  const candidate = TRANSITIONS[domain][from].find((item) => item.to === to);
  if (!candidate) return freeze({ ok: false, code: "ILLEGAL_TRANSITION", reason: `${domain} cannot transition ${from} → ${to}.` });
  if (!candidate.guard(context)) return freeze({ ok: false, code: candidate.failure, reason: `${domain} dependency guard rejected ${from} → ${to}.` });
  return freeze({ ok: true, code: "LEGAL_TRANSITION", reason: `${domain} may transition ${from} → ${to}.` });
}

export function normalizeSemanticAction({ action, payload = {}, input }) {
  if (!SEMANTIC_ACTIONS.includes(action)) throw new TypeError(`Unknown semantic action: ${action}`);
  if (!INPUT_SOURCES.includes(input)) throw new TypeError(`Unknown input source: ${input}`);
  return freeze({ action, payload: freeze({ ...payload }), input });
}

export function createOneShotEventLedger() {
  const emitted = new Set();
  return freeze({
    claim(transitionId, eventName) {
      if (typeof transitionId !== "string" || transitionId.length === 0) throw new TypeError("transitionId must be a non-empty string");
      if (!Object.hasOwn(EVENT_OWNER, eventName)) throw new TypeError(`Unknown completion event: ${eventName}`);
      const key = `${transitionId}\u0000${eventName}`;
      if (emitted.has(key)) return false;
      emitted.add(key);
      return true;
    },
  });
}

export const CANCELLATION_CONTRACT = freeze({
  startup: "Power or Cancel enters SHUTTING_DOWN from current rendered values; no endpoint snap.",
  shutdownRestart: "A restart may reverse only after every drawer is CLOSED.",
  transitionIdentity: "A reversal receives a new transition ID; invalidated work cannot emit completion events.",
  drawer: "Mid-travel accepts Cancel/Close only; blocked motion freezes and never force-closes.",
  escape: "Escape closes the nearest drawer or panel before affecting a higher-level surface.",
  oneShot: "Each canonical completion event may be claimed once per transition ID after mandatory values settle.",
});

export const DEPENDENCY_ORDER = freeze({
  startup: freeze(["room", "projector", "table", "projection", "workspace", "smartboard", "toolchest", "ready"]),
  shutdown: freeze(["shutdown", "drawers", "toolchest", "smartboard", "projection", "table", "projector", "off"]),
});

export const CONTRACT_TRANSITIONS = TRANSITIONS;
