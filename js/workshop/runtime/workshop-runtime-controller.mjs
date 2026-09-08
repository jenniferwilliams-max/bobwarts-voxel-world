import {
  CANONICAL_EVENTS,
  createOneShotEventLedger,
  normalizeSemanticAction,
  validateTransition,
} from "../contracts/workshop-state-contract.mjs";

export const WORKSHOP_UI_DRAWER_MAP = Object.freeze({
  shapes: "D2_BUILD",
  "colors-materials": "D3_MATERIALS",
  "parts-objects": "D4_COMPONENTS",
  favorites: "D6_UTILITY",
});

export const WORKSHOP_FUTURE_SUBSYSTEM_TEST_DOUBLES = Object.freeze({
  smartboard: "WS-026C production Measurement Assistant application, read-only display, read-only Learning Mode, read-only Engineering Notebook lifecycle, and approved two-application launcher; an additional general application-switching menu remains deferred.",
});

const INITIAL_STATE = Object.freeze({
  workshop: "OFF",
  projector: "POWERED_OFF",
  table: "POWERED_OFF",
  boardMechanical: "RETRACTED",
  boardPower: "POWERED_OFF",
  boardApplication: "NONE",
  chest: "PARKED",
  measurement: "IDLE",
});

const freezeResult = (value) => Object.freeze(value);

export function createWorkshopRuntimeController({
  drivers = {},
  emit = () => {},
  stateChanged = () => {},
} = {}) {
  const state = { ...INITIAL_STATE };
  const drawerStates = Object.fromEntries(
    ["D1_MEASURE", "D2_BUILD", "D3_MATERIALS", "D4_COMPONENTS", "D5_NOTEBOOK", "D6_UTILITY"]
      .map((id) => [id, "CLOSED"]),
  );
  const ledger = createOneShotEventLedger();
  let transitionSerial = 0;
  let activeTransition = null;
  let activeDrawer = null;
  let activeMeasurementSelection = null;
  let activeMeasurementTransition = null;
  let busy = false;

  const nextTransition = (domain, from, to) => ({
    id: `ws016-${++transitionSerial}`,
    domain,
    from,
    to,
    cancelled: false,
  });

  const publish = (transition, eventName, detail = {}) => {
    if (transition.cancelled || !CANONICAL_EVENTS) return false;
    if (!ledger.claim(transition.id, eventName)) return false;
    emit(eventName, Object.freeze({ transitionId: transition.id, ...detail }));
    return true;
  };

  const reject = (code, reason) => freezeResult({ ok: false, code, reason });
  const accept = (transition, code = "ACCEPTED") => freezeResult({
    ok: true,
    code,
    transitionId: transition.id,
  });

  const disabledState = () => freezeResult({
    powerOn: state.workshop !== "OFF",
    powerOff: state.workshop === "OFF",
    drawers: state.workshop !== "READY" || state.chest !== "DEPLOYED" || busy,
    measurement: state.workshop !== "READY" || state.boardApplication !== "MEASUREMENT_ASSISTANT",
  });

  const topLevelSnapshot = () => freezeResult({
    workshop: state.workshop,
    busy,
    disabled: disabledState(),
    activeTransitionId: activeTransition?.id || null,
  });

  const announceTopLevelState = () => {
    try {
      stateChanged(topLevelSnapshot());
    } catch {
      // Presentation observers never own or gate the canonical lifecycle.
    }
  };

  const cancelMeasurementLearningMode = () => {
    const cancelled = activeMeasurementTransition !== null;
    if (activeMeasurementTransition) activeMeasurementTransition.cancelled = true;
    activeMeasurementTransition = null;
    drivers.cancelLearningMode?.();
    if (state.measurement === "LEARNING_MODE") {
      state.measurement = activeMeasurementSelection ? "SELECTED_OBJECT" : "IDLE";
    }
    return cancelled;
  };

  const cancelNotebookTransition = ({ restore = true } = {}) => {
    const notebookTransition = activeMeasurementTransition?.domain === "boardApplication";
    if (notebookTransition) activeMeasurementTransition.cancelled = true;
    if (notebookTransition) activeMeasurementTransition = null;
    drivers.cancelNotebook?.({ restore: true, syncApplication: restore });
    if (restore && state.boardApplication === "APPLICATION_SWITCHING") {
      state.boardApplication = "MEASUREMENT_ASSISTANT";
    }
    if (restore && state.measurement === "ENGINEERING_NOTEBOOK") {
      state.measurement = activeMeasurementSelection ? "SELECTED_OBJECT" : "IDLE";
    }
    return notebookTransition;
  };

  const restoreMeasurementsFromNotebook = () => {
    const notebookActive = state.boardApplication === "ENGINEERING_NOTEBOOK" ||
      state.boardApplication === "APPLICATION_SWITCHING" ||
      state.measurement === "ENGINEERING_NOTEBOOK" ||
      activeMeasurementTransition?.domain === "boardApplication";
    if (!notebookActive) return false;
    cancelNotebookTransition({ restore: false });
    state.boardApplication = "MEASUREMENT_ASSISTANT";
    state.measurement = activeMeasurementSelection ? "SELECTED_OBJECT" : "IDLE";
    drivers.showNotebookMeasurements?.();
    return true;
  };

  const missingDriver = (names) => names.find((name) => typeof drivers[name] !== "function");

  const validateStartupDrivers = (reversing) => {
    const required = reversing
      ? ["restoreProjectorShutdown", "powerOnTable", "startProjectorProjection", "settleProjectorProjection"]
      : ["powerOnProjector", "powerOnTable", "startProjectorProjection", "settleProjectorProjection"];
    if (typeof drivers.startTableProjection === "function") required.push("settleTableProjection");
    else required.push("startLegacyTableProjection");
    required.push("activateSmartBoard", "deployToolChest", "settleWorkshopReady");
    const missing = missingDriver(required);
    return missing
      ? reject("REQUIRED_DRIVER_UNAVAILABLE", `Required Workshop startup driver unavailable: ${missing}.`)
      : null;
  };

  const validateShutdownDrivers = () => {
    const required = ["secureDrawers", "parkToolChest", "retractSmartBoard", "exitWorkshop"];
    const missing = missingDriver(required);
    return missing
      ? reject("REQUIRED_DRIVER_UNAVAILABLE", `Required Workshop shutdown driver unavailable: ${missing}.`)
      : null;
  };

  const finishPowerOn = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "FULLY_ACTIVE" || state.table !== "FULLY_ACTIVE" ||
        transition.tableProjectionStable !== true ||
        transition.smartBoardReady !== true ||
        transition.toolChestDeployed !== true ||
        transition.readySettled !== true) return false;
    const result = validateTransition("workshop", state.workshop, "READY", {
      startupSequenceComplete: true,
    });
    if (!result.ok) return false;
    state.workshop = "READY";
    busy = false;
    activeTransition = null;
    publish(transition, "workshop:ready", { timingCompliance: "ws021-render-settlement" });
    announceTopLevelState();
    return true;
  };

  const finishWorkshopReadySettle = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.readySettled === true) return false;
    if (state.chest !== "DEPLOYED" || transition.toolChestDeployed !== true) return false;
    transition.readySettled = true;
    return finishPowerOn(transition);
  };

  const beginWorkshopReadySettle = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.readySettleRequested === true) return false;
    if (state.chest !== "DEPLOYED" || transition.toolChestDeployed !== true) return false;
    transition.readySettleRequested = true;
    drivers.settleWorkshopReady({
      transitionId: transition.id,
      complete: () => finishWorkshopReadySettle(transition),
    });
    return true;
  };

  const finishToolChestDeploy = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.toolChestDeployed === true) return false;
    if (state.boardPower !== "READY") return false;
    if (state.chest === "UNDOCKING") {
      const result = validateTransition("chest", state.chest, "DEPLOYED");
      if (!result.ok) return false;
      state.chest = "DEPLOYED";
    }
    if (state.chest !== "DEPLOYED") return false;
    transition.toolChestDeployed = true;
    publish(transition, "toolchest:deployed", {
      timingCompliance: "ws019-rendered-deployment",
      temporaryCompatibility: false,
    });
    return beginWorkshopReadySettle(transition);
  };

  const beginToolChestDeploy = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.toolChestDeployRequested === true) return false;
    if (state.boardPower !== "READY" || transition.smartBoardReady !== true) return false;
    if (state.chest !== "DEPLOYED") {
      const result = validateTransition("chest", state.chest, "UNDOCKING", {
        boardReady: true,
        allDrawersClosed: Object.values(drawerStates).every((value) => value === "CLOSED"),
      });
      if (!result.ok) return false;
      state.chest = "UNDOCKING";
    }
    transition.toolChestDeployRequested = true;
    drivers.deployToolChest({
      transitionId: transition.id,
      complete: () => finishToolChestDeploy(transition),
    });
    return true;
  };

  const finishSmartBoardExtended = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardExtended === true) return false;
    if (state.projector !== "FULLY_ACTIVE" || state.table !== "FULLY_ACTIVE") return false;
    if (state.boardMechanical === "EXTENDING") {
      const extended = validateTransition("boardMechanical", state.boardMechanical, "EXTENDED");
      if (!extended.ok) return false;
      state.boardMechanical = "EXTENDED";
    }
    if (state.boardMechanical !== "EXTENDED") return false;
    transition.smartBoardExtended = true;
    publish(transition, "smartboard:extended", {
      timingCompliance: "ws022b-rendered-extension",
      temporaryCompatibility: false,
    });
    if (state.boardPower === "POWERED_OFF" || state.boardPower === "POWERING_OFF") {
      const powering = validateTransition("boardPower", state.boardPower, "POWERING_ON", {
        boardExtended: true,
        projectionStable: true,
      });
      if (!powering.ok) return false;
      state.boardPower = "POWERING_ON";
    }
    return state.boardPower === "POWERING_ON" || state.boardPower === "READY";
  };

  const finishSmartBoardPoweredOn = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardPoweredOn === true) return false;
    if (transition.smartBoardExtended !== true || state.boardMechanical !== "EXTENDED") return false;
    if (state.boardPower === "POWERING_ON") {
      const powered = validateTransition("boardPower", state.boardPower, "READY");
      if (!powered.ok) return false;
      state.boardPower = "READY";
    }
    if (state.boardPower !== "READY") return false;
    transition.smartBoardPoweredOn = true;
    publish(transition, "smartboard:powered-on", {
      timingCompliance: "ws022b-rendered-screen-power",
      temporaryCompatibility: false,
    });
    return true;
  };

  const finishSmartBoardApplicationActivation = (transition) => {
    if (activeTransition !== transition || transition.cancelled ||
        transition.smartBoardApplicationReady === true) return false;
    if (transition.smartBoardPoweredOn !== true || state.boardPower !== "READY") return false;
    if (state.boardApplication === "NONE") {
      const application = validateTransition("boardApplication", state.boardApplication, "MEASUREMENT_ASSISTANT", {
        boardReady: true,
      });
      if (!application.ok) return false;
      state.boardApplication = "MEASUREMENT_ASSISTANT";
      state.measurement = "IDLE";
      activeMeasurementSelection = null;
    }
    if (state.boardApplication !== "MEASUREMENT_ASSISTANT") return false;
    transition.smartBoardApplicationReady = true;
    publish(transition, "smartboard:app-changed", {
      application: "MEASUREMENT_ASSISTANT",
      timingCompliance: "ws023a-render-settlement",
      temporaryCompatibility: false,
    });
    return finishSmartBoardActivation(transition);
  };

  const beginSmartBoardApplicationActivation = (transition) => {
    if (activeTransition !== transition || transition.cancelled ||
        transition.smartBoardApplicationRequested === true) return false;
    if (transition.smartBoardPoweredOn !== true || state.boardPower !== "READY") return false;
    transition.smartBoardApplicationRequested = true;
    if (typeof drivers.activateSmartBoardApplication === "function") {
      drivers.activateSmartBoardApplication({
        transitionId: transition.id,
        application: "MEASUREMENT_ASSISTANT",
        complete: () => finishSmartBoardApplicationActivation(transition),
      });
      return true;
    }
    return finishSmartBoardApplicationActivation(transition);
  };

  const finishSmartBoardActivation = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardReady === true) return false;
    if (transition.smartBoardExtended !== true || transition.smartBoardPoweredOn !== true ||
        transition.smartBoardApplicationReady !== true) return false;
    if (state.boardMechanical !== "EXTENDED" || state.boardPower !== "READY" ||
        state.boardApplication !== "MEASUREMENT_ASSISTANT") return false;
    transition.smartBoardReady = true;
    publish(transition, "smartboard:ready", {
      timingCompliance: "ws022b-rendered-ready",
      temporaryCompatibility: false,
    });
    return beginToolChestDeploy(transition);
  };

  const beginSmartBoardActivation = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardActivationRequested === true) return false;
    if (state.projector !== "FULLY_ACTIVE" || state.table !== "FULLY_ACTIVE" ||
        transition.tableProjectionStable !== true) return false;
    if (state.boardMechanical === "EXTENDED" && state.boardPower === "POWERING_OFF") {
      const reversingPower = validateTransition("boardPower", state.boardPower, "POWERING_ON", {
        boardExtended: true,
        projectionStable: true,
      });
      if (!reversingPower.ok) return false;
      state.boardPower = "POWERING_ON";
    } else if (state.boardMechanical !== "EXTENDED" || state.boardPower !== "READY" ||
        state.boardApplication !== "MEASUREMENT_ASSISTANT") {
      const result = validateTransition("boardMechanical", state.boardMechanical, "EXTENDING", {
        projectionStable: true,
      });
      if (!result.ok) return false;
      state.boardMechanical = "EXTENDING";
    }
    transition.smartBoardActivationRequested = true;
    drivers.activateSmartBoard({
      transitionId: transition.id,
      extended: () => finishSmartBoardExtended(transition),
      poweredOn: () => finishSmartBoardPoweredOn(transition),
      complete: () => {
        finishSmartBoardExtended(transition);
        finishSmartBoardPoweredOn(transition);
        return beginSmartBoardApplicationActivation(transition);
      },
    });
    return true;
  };

  const finishProjectorActive = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "PROJECTION_STARTING" || transition.tableProjectionStable !== true) return false;
    const result = validateTransition("projector", state.projector, "FULLY_ACTIVE", {
      tableProjectionStable: true,
    });
    if (!result.ok) return false;
    state.projector = "FULLY_ACTIVE";
    publish(transition, "projector:active");
    return beginSmartBoardActivation(transition);
  };

  const beginProjectorActiveSettle = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (transition.projectorProjectionStarted !== true || transition.tableProjectionStable !== true) return false;
    if (transition.projectorActiveSettleRequested === true) return false;
    transition.projectorActiveSettleRequested = true;
    drivers.settleProjectorProjection?.({
      transitionId: transition.id,
      complete: () => finishProjectorActive(transition),
    });
    return true;
  };

  const finishProjectorProjectionStart = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "PROJECTION_STARTING" || transition.projectorProjectionStarted === true) return false;
    transition.projectorProjectionStarted = true;
    publish(transition, "projector:projection-started");
    beginProjectorActiveSettle(transition);
    return true;
  };

  const finishTableProjectionActiveSettle = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (transition.tableProjectionStarted !== true || state.table !== "PROJECTION_STARTING") return false;
    if (transition.tableProjectionStable === true) return false;
    const result = validateTransition("table", state.table, "FULLY_ACTIVE");
    if (!result.ok) return false;
    state.table = "FULLY_ACTIVE";
    transition.tableProjectionStable = true;
    publish(transition, "workspace:projection-stable", {
      timingCompliance: "ws014-table-fully-active",
      visualState: "FULLY_ACTIVE",
      temporaryCompatibility: false,
    });
    beginProjectorActiveSettle(transition);
    return true;
  };

  const beginTableProjectionActiveSettle = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (transition.tableProjectionStarted !== true || transition.tableActiveSettleRequested === true) return false;
    transition.tableActiveSettleRequested = true;
    drivers.settleTableProjection?.({
      transitionId: transition.id,
      complete: () => finishTableProjectionActiveSettle(transition),
    });
    return true;
  };

  const finishTableProjectionStart = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.table !== "PROJECTION_STARTING" || transition.tableProjectionStarted === true) return false;
    transition.tableProjectionStarted = true;
    publish(transition, "table:projection-started");
    return beginTableProjectionActiveSettle(transition);
  };

  const beginProjectorProjection = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_ON" || state.table !== "POWERED_ON") return false;
    const projectorResult = validateTransition("projector", state.projector, "PROJECTION_STARTING", {
      tableEmittersReady: true,
    });
    const tableResult = validateTransition("table", state.table, "PROJECTION_STARTING", {
      projectorReady: true,
    });
    if (!projectorResult.ok || !tableResult.ok) return false;
    state.projector = "PROJECTION_STARTING";
    state.table = "PROJECTION_STARTING";
    drivers.startProjectorProjection?.({
      transitionId: transition.id,
      complete: () => finishProjectorProjectionStart(transition),
    });
    if (typeof drivers.startTableProjection === "function") {
      drivers.startTableProjection({
        transitionId: transition.id,
        complete: () => finishTableProjectionStart(transition),
      });
    } else {
      // Legacy hosts report a rendered stable endpoint in one callback. The
      // production WS-014 integration always supplies both modern drivers.
      drivers.startLegacyTableProjection?.({
        transitionId: transition.id,
        stable: () => {
          const started = finishTableProjectionStart(transition);
          const settled = finishTableProjectionActiveSettle(transition);
          return started || settled;
        },
      });
    }
    return true;
  };

  const finishTablePowerOn = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_ON") return false;
    if (state.table === "POWERING_ON") {
      const result = validateTransition("table", state.table, "POWERED_ON");
      if (!result.ok) return false;
      state.table = "POWERED_ON";
    }
    if (state.table !== "POWERED_ON") return false;
    if (!publish(transition, "table:powered-on")) return false;
    return beginProjectorProjection(transition);
  };

  const normalizeTableToPoweredOn = () => {
    if (state.table === "FULLY_ACTIVE") {
      const lowering = validateTransition("table", state.table, "PROJECTION_STARTING");
      if (!lowering.ok) return false;
      state.table = "PROJECTION_STARTING";
    }
    if (state.table === "PROJECTION_STARTING") {
      const standby = validateTransition("table", state.table, "POWERED_ON");
      if (!standby.ok) return false;
      state.table = "POWERED_ON";
    }
    return state.table === "POWERED_ON";
  };

  const beginTablePowerOn = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_ON") return false;
    if (state.table === "POWERED_OFF") {
      const result = validateTransition("table", state.table, "POWERING_ON", {
        projectorPoweredOn: true,
      });
      if (!result.ok) return false;
      state.table = "POWERING_ON";
    } else if (state.table !== "POWERING_ON" && !normalizeTableToPoweredOn()) {
      return false;
    }
    drivers.powerOnTable?.({
      transitionId: transition.id,
      begin: () => activeTransition === transition && !transition.cancelled,
      complete: () => finishTablePowerOn(transition),
    });
    return true;
  };

  const finishProjectorPowerOn = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERING_ON") return false;
    const result = validateTransition("projector", state.projector, "POWERED_ON");
    if (!result.ok) return false;
    state.projector = "POWERED_ON";
    publish(transition, "projector:powered-on");
    return beginTablePowerOn(transition);
  };

  const continueFromPoweredProjector = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_ON") return false;
    return beginTablePowerOn(transition);
  };

  const finishShutdownReversal = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector === "POWERING_ON") state.projector = "POWERED_ON";
    if (state.projector !== "POWERED_ON") return false;
    return continueFromPoweredProjector(transition);
  };

  const beginProjectorPowerOn = (transition, context) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_OFF") return false;
    const result = validateTransition("projector", state.projector, "POWERING_ON", {
      workshopState: state.workshop,
      assetReady: context.assetsLoaded === true,
      shutdownLock: state.workshop === "SHUTTING_DOWN",
    });
    if (!result.ok) return false;
    state.projector = "POWERING_ON";
    return true;
  };

  const markProjectorStandby = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector === "FULLY_ACTIVE") {
      const result = validateTransition("projector", state.projector, "POWERED_ON", {
        tableRendererAvailable: false,
      });
      if (!result.ok) return false;
      state.projector = "POWERED_ON";
    } else if (state.projector === "PROJECTION_STARTING") {
      const result = validateTransition("projector", state.projector, "POWERED_ON");
      if (!result.ok) return false;
      state.projector = "POWERED_ON";
    }
    return state.projector === "POWERED_ON" || state.projector === "POWERING_ON" || state.projector === "POWERED_OFF";
  };

  const markProjectorPoweredOff = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_OFF") {
      const result = validateTransition("projector", state.projector, "POWERED_OFF", {
        tableProjectionVisible: false,
      });
      if (!result.ok) return false;
      state.projector = "POWERED_OFF";
    }
    return publish(transition, "projector:powered-off");
  };

  const markTableStandby = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    let projectionWasVisible = false;
    if (state.table === "FULLY_ACTIVE") {
      projectionWasVisible = true;
      const lowering = validateTransition("table", state.table, "PROJECTION_STARTING");
      if (!lowering.ok) return false;
      state.table = "PROJECTION_STARTING";
    }
    if (state.table === "PROJECTION_STARTING") {
      projectionWasVisible = true;
      const standby = validateTransition("table", state.table, "POWERED_ON");
      if (!standby.ok) return false;
      state.table = "POWERED_ON";
    }
    if (projectionWasVisible) publish(transition, "table:projection-stopped");
    return state.table === "POWERED_ON" || state.table === "POWERING_ON" || state.table === "POWERED_OFF";
  };

  const markTablePoweredOff = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (!markTableStandby(transition)) return false;
    if (state.table !== "POWERED_OFF") {
      const result = validateTransition("table", state.table, "POWERED_OFF", {
        projectionVisible: false,
      });
      if (!result.ok) return false;
      state.table = "POWERED_OFF";
    }
    return publish(transition, "table:powered-off");
  };

  const beginProjectionShutdown = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.projectionShutdownRequested === true) return false;
    if (state.chest !== "PARKED" || state.boardMechanical !== "RETRACTED" ||
        state.boardPower !== "POWERED_OFF") return false;
    transition.projectionShutdownRequested = true;
    drivers.exitWorkshop({
      transitionId: transition.id,
      tableStandby: () => markTableStandby(transition),
      tablePoweredOff: () => markTablePoweredOff(transition),
      standby: () => markProjectorStandby(transition),
      poweredOff: () => markProjectorPoweredOff(transition),
      complete: () => finishPowerOff(transition),
    });
    return true;
  };

  const finishSmartBoardPoweredOff = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardPoweredOff === true) return false;
    if (state.chest !== "PARKED") return false;
    if (state.boardPower === "POWERING_OFF") {
      const poweredOff = validateTransition("boardPower", state.boardPower, "POWERED_OFF");
      if (!poweredOff.ok) return false;
      state.boardPower = "POWERED_OFF";
    }
    if (state.boardPower !== "POWERED_OFF") return false;
    transition.smartBoardPoweredOff = true;
    return true;
  };

  const finishSmartBoardRetraction = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.smartBoardRetracted === true) return false;
    if (state.chest !== "PARKED" || transition.smartBoardPoweredOff !== true ||
        state.boardPower !== "POWERED_OFF") return false;
    if (state.boardMechanical === "EXTENDED") {
      const retracting = validateTransition("boardMechanical", state.boardMechanical, "RETRACTING", {
        boardPoweredOff: true,
        blockingModal: false,
        unsavedNotebookEdit: false,
      });
      if (!retracting.ok) return false;
      state.boardMechanical = "RETRACTING";
    }
    if (state.boardMechanical === "EXTENDING") {
      const reversing = validateTransition("boardMechanical", state.boardMechanical, "RETRACTING");
      if (!reversing.ok) return false;
      state.boardMechanical = "RETRACTING";
    }
    if (state.boardMechanical === "RETRACTING") {
      const retracted = validateTransition("boardMechanical", state.boardMechanical, "RETRACTED");
      if (!retracted.ok) return false;
      state.boardMechanical = "RETRACTED";
    }
    if (state.boardMechanical !== "RETRACTED") return false;
    transition.smartBoardRetracted = true;
    publish(transition, "smartboard:retracted", {
      timingCompliance: "ws022b-rendered-retraction",
      temporaryCompatibility: false,
    });
    return beginProjectionShutdown(transition);
  };

  const beginSmartBoardPhysicalRetraction = (transition) => {
    if (activeTransition !== transition || transition.cancelled ||
        transition.smartBoardRetractionRequested === true) return false;
    if (state.chest !== "PARKED" || transition.toolChestParked !== true ||
        transition.smartBoardApplicationCleared !== true || state.boardApplication !== "NONE") return false;
    if (state.boardPower === "READY" || state.boardPower === "POWERING_ON") {
      const poweringOff = validateTransition("boardPower", state.boardPower, "POWERING_OFF", {
        applicationStateSecured: true,
      });
      if (!poweringOff.ok) return false;
      state.boardPower = "POWERING_OFF";
    }
    transition.smartBoardRetractionRequested = true;
    drivers.retractSmartBoard({
      transitionId: transition.id,
      poweredOff: () => finishSmartBoardPoweredOff(transition),
      complete: () => {
        finishSmartBoardPoweredOff(transition);
        return finishSmartBoardRetraction(transition);
      },
    });
    return true;
  };

  const finishSmartBoardApplicationClear = (transition) => {
    if (activeTransition !== transition || transition.cancelled ||
        transition.smartBoardApplicationCleared === true) return false;
    if (state.chest !== "PARKED" || transition.toolChestParked !== true) return false;
    cancelMeasurementLearningMode();
    cancelNotebookTransition({ restore: false });
    const previousApplication = state.boardApplication;
    state.boardApplication = "NONE";
    const hadMeasurementSelection = state.measurement !== "IDLE";
    state.measurement = "IDLE";
    activeMeasurementSelection = null;
    transition.smartBoardApplicationCleared = true;
    if (previousApplication !== "NONE") {
      publish(transition, "smartboard:app-changed", {
        application: "NONE",
        timingCompliance: "ws023a-render-settlement",
        temporaryCompatibility: false,
      });
    }
    if (hadMeasurementSelection) {
      drivers.renderMeasurement?.({ state: "IDLE", payload: {} });
      publish(transition, "measurement:selection-cleared", {
        reason: "SMART_BOARD_APPLICATION_CLEARED",
      });
    }
    return beginSmartBoardPhysicalRetraction(transition);
  };

  const beginSmartBoardRetraction = (transition) => {
    if (activeTransition !== transition || transition.cancelled ||
        transition.smartBoardApplicationClearRequested === true) return false;
    if (state.chest !== "PARKED" || transition.toolChestParked !== true) return false;
    transition.smartBoardApplicationClearRequested = true;
    if (typeof drivers.clearSmartBoardApplication === "function") {
      drivers.clearSmartBoardApplication({
        transitionId: transition.id,
        application: "NONE",
        complete: () => finishSmartBoardApplicationClear(transition),
      });
      return true;
    }
    return finishSmartBoardApplicationClear(transition);
  };

  const finishToolChestParking = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.toolChestParked === true) return false;
    if (transition.drawersSecured !== true) return false;
    if (state.chest === "DOCKING") {
      const parked = validateTransition("chest", state.chest, "PARKED");
      if (!parked.ok) return false;
      state.chest = "PARKED";
    }
    if (state.chest !== "PARKED") return false;
    transition.toolChestParked = true;
    publish(transition, "toolchest:parked", {
      timingCompliance: "ws019-rendered-parking",
      temporaryCompatibility: false,
    });
    return beginSmartBoardRetraction(transition);
  };

  const beginToolChestParking = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.toolChestParkingRequested === true) return false;
    if (transition.drawersSecured !== true ||
        !Object.values(drawerStates).every((value) => value === "CLOSED")) return false;
    if (state.chest === "DEPLOYED") {
      const docking = validateTransition("chest", state.chest, "DOCKING", {
        allDrawersClosed: true,
        obstructionClear: true,
      });
      if (!docking.ok) return false;
      state.chest = "DOCKING";
    } else if (state.chest === "UNDOCKING") {
      const reversing = validateTransition("chest", state.chest, "DOCKING", {
        allDrawersClosed: true,
      });
      if (!reversing.ok) return false;
      state.chest = "DOCKING";
    }
    transition.toolChestParkingRequested = true;
    drivers.parkToolChest({
      transitionId: transition.id,
      complete: () => finishToolChestParking(transition),
    });
    return true;
  };

  const finishDrawerSecurity = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.drawersSecured === true) return false;
    Object.keys(drawerStates).forEach((id) => { drawerStates[id] = "CLOSED"; });
    activeDrawer = null;
    transition.drawersSecured = true;
    publish(transition, "toolchest:drawers-secured", {
      timingCompliance: "ws020-rendered-drawer-security",
      temporaryCompatibility: false,
    });
    return beginToolChestParking(transition);
  };

  const beginDrawerSecurity = (transition) => {
    if (activeTransition !== transition || transition.cancelled || transition.drawerSecurityRequested === true) return false;
    transition.drawerSecurityRequested = true;
    drivers.secureDrawers({
      transitionId: transition.id,
      complete: () => finishDrawerSecurity(transition),
    });
    return true;
  };

  const finishPowerOff = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    if (state.projector !== "POWERED_OFF" || state.table !== "POWERED_OFF" ||
        state.chest !== "PARKED" || state.boardPower !== "POWERED_OFF" ||
        state.boardMechanical !== "RETRACTED" || transition.drawersSecured !== true ||
        transition.toolChestParked !== true || transition.smartBoardRetracted !== true) return false;
    const result = validateTransition("workshop", state.workshop, "OFF", {
      shutdownSequenceComplete: true,
    });
    if (!result.ok) return false;
    state.workshop = "OFF";
    busy = false;
    activeTransition = null;
    publish(transition, "workshop:off", { timingCompliance: "ws010-safe-projector-shutdown" });
    announceTopLevelState();
    return true;
  };

  const finishFaultSafePowerOff = (transition) => {
    if (activeTransition !== transition || transition.cancelled) return false;
    const projectorContext = state.projector === "FAULT_SAFE"
      ? { emissiveLayersOff: true }
      : { tableProjectionVisible: false };
    const projectorResult = validateTransition(
      "projector", state.projector, "POWERED_OFF", projectorContext,
    );
    const tableResult = validateTransition("table", state.table, "POWERED_OFF", {
      projectionVisible: false,
    });
    const workshopResult = validateTransition("workshop", state.workshop, "OFF", {
      faultAcknowledged: true,
      emissiveLayersOff: true,
    });
    if (!projectorResult.ok || !tableResult.ok || !workshopResult.ok) return false;
    state.projector = "POWERED_OFF";
    state.workshop = "OFF";
    state.table = "POWERED_OFF";
    state.boardMechanical = "RETRACTED";
    state.boardPower = "POWERED_OFF";
    state.boardApplication = "NONE";
    state.chest = "PARKED";
    state.measurement = "IDLE";
    activeMeasurementSelection = null;
    Object.keys(drawerStates).forEach((id) => { drawerStates[id] = "CLOSED"; });
    activeDrawer = null;
    busy = false;
    activeTransition = null;
    publish(transition, "workshop:off", { timingCompliance: "ws010-fault-safe-settlement" });
    announceTopLevelState();
    return true;
  };

  const requestPowerOn = (context) => {
    const result = validateTransition("workshop", state.workshop, "STARTING", {
      assetsLoaded: context.assetsLoaded === true,
      allDrawersClosed: Object.values(drawerStates).every((value) => value === "CLOSED"),
      chestParked: state.chest === "PARKED",
      shutdownInProgress: state.workshop === "SHUTTING_DOWN",
    });
    if (!result.ok) return reject(result.code, result.reason);
    if (result.code === "IDEMPOTENT") return freezeResult({ ok: true, code: result.code });
    const driverFailure = validateStartupDrivers(state.workshop === "SHUTTING_DOWN");
    if (driverFailure) return driverFailure;
    const transition = nextTransition("workshop", state.workshop, "STARTING");
    if (state.workshop === "SHUTTING_DOWN") restoreMeasurementsFromNotebook();
    activeTransition = transition;
    state.workshop = "STARTING";
    busy = true;
    publish(transition, "workshop:startup-begun");
    announceTopLevelState();
    if (transition.from === "SHUTTING_DOWN" && state.projector !== "POWERED_OFF") {
      if (state.projector !== "POWERED_ON") state.projector = "POWERING_ON";
      drivers.restoreProjectorShutdown?.({
        transitionId: transition.id,
        complete: () => finishShutdownReversal(transition),
      });
      return accept(transition, "REVERSING");
    }
    drivers.powerOnProjector?.({
      transitionId: transition.id,
      begin: () => beginProjectorPowerOn(transition, context),
      complete: () => finishProjectorPowerOn(transition),
    });
    return accept(transition);
  };

  const requestPowerOff = (context) => {
    if (state.workshop === "OFF") return freezeResult({ ok: true, code: "IDEMPOTENT" });
    if (state.workshop === "FAULT_SAFE") {
      const transition = nextTransition("workshop", state.workshop, "OFF");
      activeTransition = transition;
      busy = true;
      announceTopLevelState();
      const secureFault = state.table === "FAULT_SAFE"
        ? drivers.secureTableFault
        : drivers.secureProjectorFault;
      if (typeof secureFault === "function") {
        secureFault({
          transitionId: transition.id,
          code: "FAULT_ACKNOWLEDGED",
          message: "Projector fault secured.",
          complete: () => finishFaultSafePowerOff(transition),
        });
      } else finishFaultSafePowerOff(transition);
      return accept(transition, "FAULT_ACKNOWLEDGED");
    }
    const result = validateTransition("workshop", state.workshop, "SHUTTING_DOWN", {
      applicationStateSecured: context.applicationStateSecured !== false,
    });
    if (!result.ok) return reject(result.code, result.reason);
    const driverFailure = validateShutdownDrivers();
    if (driverFailure) return driverFailure;
    if (state.workshop === "SHUTTING_DOWN") return freezeResult({ ok: true, code: "IDEMPOTENT" });
    if (activeTransition) activeTransition.cancelled = true;
    const transition = nextTransition("workshop", state.workshop, "SHUTTING_DOWN");
    activeTransition = transition;
    state.workshop = "SHUTTING_DOWN";
    busy = true;
    cancelMeasurementLearningMode();
    cancelNotebookTransition({ restore: false });
    publish(transition, "workshop:shutdown-begun");
    announceTopLevelState();
    beginDrawerSecurity(transition);
    return accept(transition);
  };

  const reportProjectorRendererUnavailable = () => {
    if (state.projector !== "FULLY_ACTIVE") {
      return freezeResult({ ok: true, code: state.projector === "POWERED_ON" ? "IDEMPOTENT" : "NOT_ACTIVE" });
    }
    const transition = nextTransition("projector", state.projector, "POWERED_ON");
    drivers.lowerProjectorToStandby?.({
      transitionId: transition.id,
      complete: () => {
        if (transition.cancelled || state.projector !== "FULLY_ACTIVE") return false;
        const result = validateTransition("projector", state.projector, "POWERED_ON", {
          tableRendererAvailable: false,
        });
        if (!result.ok) return false;
        state.projector = "POWERED_ON";
        return true;
      },
    });
    return accept(transition, "STANDBY_REQUESTED");
  };

  const reportProjectorFault = ({ code = "PROJECTOR_ASSET_UNAVAILABLE", message } = {}) => {
    if (state.projector === "FAULT_SAFE") return freezeResult({ ok: true, code: "IDEMPOTENT" });
    if (activeTransition) activeTransition.cancelled = true;
    const transition = nextTransition("projector", state.projector, "FAULT_SAFE");
    const projectorResult = validateTransition("projector", state.projector, "FAULT_SAFE");
    const tableResult = validateTransition("table", state.table, "FAULT_SAFE");
    const workshopResult = validateTransition("workshop", state.workshop, "FAULT_SAFE");
    if (!projectorResult.ok || !tableResult.ok || !workshopResult.ok) {
      return reject(
        "FAULT_TRANSITION_REJECTED",
        projectorResult.reason || tableResult.reason || workshopResult.reason,
      );
    }
    activeTransition = transition;
    cancelMeasurementLearningMode();
    cancelNotebookTransition({ restore: false });
    state.projector = "FAULT_SAFE";
    state.table = "FAULT_SAFE";
    state.workshop = "FAULT_SAFE";
    const previousApplication = state.boardApplication;
    state.boardApplication = "NONE";
    const hadMeasurementSelection = state.measurement !== "IDLE";
    state.measurement = "IDLE";
    activeMeasurementSelection = null;
    busy = true;
    publish(transition, "projector:fault", { code, message });
    if (previousApplication !== "NONE") {
      publish(transition, "smartboard:app-changed", {
        application: "NONE",
        timingCompliance: "ws023a-fault-safe-clear",
        temporaryCompatibility: false,
      });
    }
    if (hadMeasurementSelection) {
      drivers.renderMeasurement?.({ state: "IDLE", payload: {} });
      publish(transition, "measurement:selection-invalidated", {
        reason: "PROJECTOR_FAULT",
      });
    }
    announceTopLevelState();
    const settle = () => {
      if (activeTransition !== transition || transition.cancelled) return false;
      busy = false;
      activeTransition = null;
      announceTopLevelState();
      return true;
    };
    if (typeof drivers.secureProjectorFault === "function") {
      drivers.secureProjectorFault({ transitionId: transition.id, code, message, complete: settle });
    } else settle();
    return accept(transition, "FAULT_SAFE");
  };

  const reportTableFault = ({ code = "TABLE_EMITTER_ASSET_UNAVAILABLE", message } = {}) => {
    if (state.table === "FAULT_SAFE") return freezeResult({ ok: true, code: "IDEMPOTENT" });
    if (state.projector !== "POWERED_ON" || state.workshop !== "STARTING") {
      return reject("TABLE_FAULT_NOT_ACTIVE", "Table faults require an active powered-Projector startup.");
    }
    if (activeTransition) activeTransition.cancelled = true;
    const transition = nextTransition("table", state.table, "FAULT_SAFE");
    const tableResult = validateTransition("table", state.table, "FAULT_SAFE");
    const workshopResult = validateTransition("workshop", state.workshop, "FAULT_SAFE");
    if (!tableResult.ok || !workshopResult.ok) {
      return reject("FAULT_TRANSITION_REJECTED", tableResult.reason || workshopResult.reason);
    }
    activeTransition = transition;
    cancelMeasurementLearningMode();
    cancelNotebookTransition({ restore: false });
    state.table = "FAULT_SAFE";
    state.workshop = "FAULT_SAFE";
    const previousApplication = state.boardApplication;
    state.boardApplication = "NONE";
    const hadMeasurementSelection = state.measurement !== "IDLE";
    state.measurement = "IDLE";
    activeMeasurementSelection = null;
    busy = true;
    if (previousApplication !== "NONE") {
      publish(transition, "smartboard:app-changed", {
        application: "NONE",
        timingCompliance: "ws023a-fault-safe-clear",
        temporaryCompatibility: false,
      });
    }
    if (hadMeasurementSelection) {
      drivers.renderMeasurement?.({ state: "IDLE", payload: {} });
      publish(transition, "measurement:selection-invalidated", {
        reason: "TABLE_FAULT",
      });
    }
    announceTopLevelState();
    const settle = () => {
      if (activeTransition !== transition || transition.cancelled) return false;
      busy = false;
      activeTransition = null;
      announceTopLevelState();
      return true;
    };
    if (typeof drivers.secureTableFault === "function") {
      drivers.secureTableFault({ transitionId: transition.id, code, message, complete: settle });
    } else settle();
    return accept(transition, "FAULT_SAFE");
  };

  const finishDrawer = (transition, logicalId, targetState, eventName) => {
    if (transition.cancelled) return false;
    const result = validateTransition("drawer", drawerStates[logicalId], targetState, {
      chestDeployed: state.chest === "DEPLOYED",
      otherDrawerActive: activeDrawer !== null && activeDrawer !== logicalId,
    });
    if (!result.ok) return false;
    drawerStates[logicalId] = targetState;
    if (targetState === "CLOSED") activeDrawer = null;
    busy = false;
    publish(transition, eventName, { drawerId: logicalId });
    return true;
  };

  const requestDrawer = (action, payload) => {
    if (state.workshop !== "READY") return reject("WORKSHOP_NOT_READY", "Drawers require Workshop READY.");
    const logicalId = payload.drawerId || WORKSHOP_UI_DRAWER_MAP[payload.uiDrawer];
    if (!logicalId) return reject("UNMAPPED_DRAWER", `No approved WS-002 mapping for ${payload.uiDrawer || "drawer"}.`);
    if (!Object.hasOwn(drawerStates, logicalId)) return reject("UNKNOWN_DRAWER", `Unknown drawer: ${logicalId}`);
    const opening = action === "OPEN_DRAWER";
    if (opening && activeDrawer && activeDrawer !== logicalId) {
      return reject("DRAWER_CLOSE_REQUIRED", `Close ${activeDrawer} before opening ${logicalId}.`);
    }
    const target = opening ? "OPENING" : "CLOSING";
    const result = validateTransition("drawer", drawerStates[logicalId], target, {
      chestDeployed: state.chest === "DEPLOYED",
      otherDrawerActive: opening && activeDrawer !== null && activeDrawer !== logicalId,
      uncommittedOperationResolved: payload.uncommittedOperationResolved !== false,
    });
    if (!result.ok) return reject(result.code, result.reason);
    if (result.code === "IDEMPOTENT") return freezeResult({ ok: true, code: result.code });

    const transition = nextTransition("drawer", drawerStates[logicalId], target);
    drawerStates[logicalId] = target;
    busy = true;
    if (opening) activeDrawer = logicalId;
    const driver = opening ? drivers.openDrawer : drivers.closeDrawer;
    driver?.({
      transitionId: transition.id,
      logicalId,
      uiDrawer: payload.uiDrawer,
      complete: () => finishDrawer(
        transition,
        logicalId,
        opening ? "OPEN" : "CLOSED",
        opening ? "drawer:opened" : "drawer:closed",
      ),
    });
    return accept(transition);
  };

  const finishLearningModeEntry = (transition) => {
    if (activeMeasurementTransition !== transition || transition.cancelled ||
        state.workshop !== "READY" || state.boardApplication !== "MEASUREMENT_ASSISTANT" ||
        state.measurement !== "SELECTED_OBJECT" || !activeMeasurementSelection) return false;
    const result = validateTransition("measurement", state.measurement, "LEARNING_MODE");
    if (!result.ok) return false;
    state.measurement = "LEARNING_MODE";
    activeMeasurementTransition = null;
    publish(transition, "measurement:learning-mode-entered", {
      objectId: activeMeasurementSelection.objectId,
      selectionCount: activeMeasurementSelection.objects.length,
    });
    return true;
  };

  const requestLearningMode = () => {
    if (state.measurement === "LEARNING_MODE" ||
        (activeMeasurementTransition && activeMeasurementTransition.to === "LEARNING_MODE")) {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.workshop !== "READY" || state.boardApplication !== "MEASUREMENT_ASSISTANT" ||
        state.measurement !== "SELECTED_OBJECT" || !activeMeasurementSelection) {
      return reject("MEASUREMENT_SELECTION_REQUIRED", "Learning Mode requires an active measurable selection.");
    }
    if (typeof drivers.renderLearningMode !== "function") {
      return reject("REQUIRED_DRIVER_UNAVAILABLE", "Learning Mode render driver unavailable.");
    }
    const result = validateTransition("measurement", state.measurement, "LEARNING_MODE");
    if (!result.ok) return reject(result.code, result.reason);
    const transition = nextTransition("measurement", state.measurement, "LEARNING_MODE");
    activeMeasurementTransition = transition;
    drivers.renderLearningMode({
      transitionId: transition.id,
      complete: () => finishLearningModeEntry(transition),
    });
    return accept(transition);
  };

  const finishLearningModeExit = (transition) => {
    if (activeMeasurementTransition !== transition || transition.cancelled ||
        state.measurement !== "LEARNING_MODE" || !activeMeasurementSelection) return false;
    const result = validateTransition("measurement", state.measurement, "SELECTED_OBJECT");
    if (!result.ok) return false;
    state.measurement = "SELECTED_OBJECT";
    activeMeasurementTransition = null;
    return true;
  };

  const requestLearningModeExit = () => {
    if (activeMeasurementTransition?.to === "LEARNING_MODE") {
      cancelMeasurementLearningMode();
      return freezeResult({ ok: true, code: "CANCELLED_TO_MEASUREMENTS" });
    }
    if (state.measurement === "SELECTED_OBJECT") {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.measurement !== "LEARNING_MODE" || !activeMeasurementSelection) {
      return reject("LEARNING_MODE_NOT_ACTIVE", "Learning Mode is not active.");
    }
    if (typeof drivers.clearLearningMode !== "function") {
      return reject("REQUIRED_DRIVER_UNAVAILABLE", "Learning Mode clear driver unavailable.");
    }
    const result = validateTransition("measurement", state.measurement, "SELECTED_OBJECT");
    if (!result.ok) return reject(result.code, result.reason);
    const transition = nextTransition("measurement", state.measurement, "SELECTED_OBJECT");
    activeMeasurementTransition = transition;
    drivers.clearLearningMode({
      transitionId: transition.id,
      complete: () => finishLearningModeExit(transition),
    });
    return accept(transition);
  };

  const finishNotebookEntry = (transition) => {
    if (activeMeasurementTransition !== transition || transition.cancelled ||
        state.workshop !== "READY" || state.boardApplication !== "APPLICATION_SWITCHING" ||
        state.measurement !== "SELECTED_OBJECT" || !activeMeasurementSelection) return false;
    const application = validateTransition(
      "boardApplication", state.boardApplication, "ENGINEERING_NOTEBOOK",
    );
    const measurement = validateTransition(
      "measurement", state.measurement, "ENGINEERING_NOTEBOOK",
    );
    if (!application.ok || !measurement.ok) return false;
    state.boardApplication = "ENGINEERING_NOTEBOOK";
    state.measurement = "ENGINEERING_NOTEBOOK";
    activeMeasurementTransition = null;
    publish(transition, "smartboard:app-changed", {
      application: "ENGINEERING_NOTEBOOK",
      timingCompliance: "ws025c-two-frame-render-settlement",
      temporaryCompatibility: false,
    });
    publish(transition, "measurement:notebook-opened", {
      objectId: activeMeasurementSelection.objectId,
      selectionCount: activeMeasurementSelection.objects.length,
    });
    return true;
  };

  const requestNotebook = () => {
    if (state.boardApplication === "ENGINEERING_NOTEBOOK" ||
        (activeMeasurementTransition?.domain === "boardApplication" &&
         activeMeasurementTransition.to === "ENGINEERING_NOTEBOOK")) {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.workshop !== "READY" || !activeMeasurementSelection ||
        !["SELECTED_OBJECT", "LEARNING_MODE"].includes(state.measurement) ||
        state.boardApplication !== "MEASUREMENT_ASSISTANT") {
      return reject("MEASUREMENT_SELECTION_REQUIRED", "Engineering Notebook requires an active measurable selection.");
    }
    if (typeof drivers.renderNotebook !== "function") {
      return reject("REQUIRED_DRIVER_UNAVAILABLE", "Engineering Notebook render driver unavailable.");
    }
    if (activeMeasurementTransition || state.measurement === "LEARNING_MODE") {
      cancelMeasurementLearningMode();
    }
    const application = validateTransition(
      "boardApplication", state.boardApplication, "APPLICATION_SWITCHING", { blockingModal: false },
    );
    const measurement = validateTransition(
      "measurement", state.measurement, "ENGINEERING_NOTEBOOK",
    );
    if (!application.ok || !measurement.ok) {
      return reject(application.ok ? measurement.code : application.code,
        application.ok ? measurement.reason : application.reason);
    }
    const transition = nextTransition("boardApplication", state.boardApplication, "ENGINEERING_NOTEBOOK");
    state.boardApplication = "APPLICATION_SWITCHING";
    activeMeasurementTransition = transition;
    drivers.renderNotebook({
      transitionId: transition.id,
      complete: () => finishNotebookEntry(transition),
    });
    return accept(transition);
  };

  const finishNotebookExit = (transition) => {
    if (activeMeasurementTransition !== transition || transition.cancelled ||
        state.workshop !== "READY" || state.boardApplication !== "APPLICATION_SWITCHING" ||
        state.measurement !== "ENGINEERING_NOTEBOOK" || !activeMeasurementSelection) return false;
    const application = validateTransition(
      "boardApplication", state.boardApplication, "MEASUREMENT_ASSISTANT",
    );
    const measurement = validateTransition(
      "measurement", state.measurement, "SELECTED_OBJECT", { selectionStillValid: true },
    );
    if (!application.ok || !measurement.ok) return false;
    state.boardApplication = "MEASUREMENT_ASSISTANT";
    state.measurement = "SELECTED_OBJECT";
    activeMeasurementTransition = null;
    publish(transition, "smartboard:app-changed", {
      application: "MEASUREMENT_ASSISTANT",
      timingCompliance: "ws025c-two-frame-render-settlement",
      temporaryCompatibility: false,
    });
    return true;
  };

  const requestNotebookExit = (payload) => {
    const requestedApplication = payload.application || payload.target;
    if (requestedApplication !== "MEASUREMENT_ASSISTANT") {
      return reject("APPLICATION_NOT_APPROVED", "Only the approved return to Measurements is available.");
    }
    if (activeMeasurementTransition?.domain === "boardApplication" &&
        activeMeasurementTransition.to === "MEASUREMENT_ASSISTANT") {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.boardApplication === "MEASUREMENT_ASSISTANT" && state.measurement !== "ENGINEERING_NOTEBOOK") {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.workshop !== "READY" || state.boardApplication !== "ENGINEERING_NOTEBOOK" ||
        state.measurement !== "ENGINEERING_NOTEBOOK" || !activeMeasurementSelection) {
      return reject("ENGINEERING_NOTEBOOK_NOT_ACTIVE", "Engineering Notebook is not active.");
    }
    if (typeof drivers.clearNotebook !== "function") {
      return reject("REQUIRED_DRIVER_UNAVAILABLE", "Engineering Notebook clear driver unavailable.");
    }
    const switching = validateTransition(
      "boardApplication", state.boardApplication, "APPLICATION_SWITCHING",
      { blockingModal: false, autosaveComplete: true },
    );
    if (!switching.ok) return reject(switching.code, switching.reason);
    const transition = nextTransition("boardApplication", state.boardApplication, "MEASUREMENT_ASSISTANT");
    state.boardApplication = "APPLICATION_SWITCHING";
    activeMeasurementTransition = transition;
    drivers.clearNotebook({
      transitionId: transition.id,
      complete: () => finishNotebookExit(transition),
    });
    return accept(transition);
  };

  const requestMeasurement = (action, payload) => {
    const target = action === "SELECT_MEASURABLE_OBJECT" ? "SELECTED_OBJECT" : "IDLE";
    const selectedObjects = Array.isArray(payload.objects) ? payload.objects : [];
    const measurementContext = {
      workshopReady: state.workshop === "READY",
      measurementAppActive: ["MEASUREMENT_ASSISTANT", "ENGINEERING_NOTEBOOK", "APPLICATION_SWITCHING"]
        .includes(state.boardApplication),
      objectMeasurable: payload.objectMeasurable === true,
    };
    if (target === "SELECTED_OBJECT" &&
        (!measurementContext.workshopReady || !measurementContext.measurementAppActive ||
         !measurementContext.objectMeasurable)) {
      const guarded = validateTransition("measurement", "IDLE", target, measurementContext);
      return reject(guarded.code, guarded.reason);
    }
    const sameSelection = target === "SELECTED_OBJECT" &&
      (state.measurement === "SELECTED_OBJECT" || state.measurement === "LEARNING_MODE" ||
       state.measurement === "ENGINEERING_NOTEBOOK") &&
      activeMeasurementSelection?.objectId === payload.objectId &&
      activeMeasurementSelection.objects.length === selectedObjects.length &&
      activeMeasurementSelection.objects.every((object, index) => object === selectedObjects[index]);
    if (sameSelection || (target === "IDLE" && state.measurement === "IDLE" && !activeMeasurementTransition)) {
      return freezeResult({ ok: true, code: "IDEMPOTENT" });
    }
    if (state.boardApplication === "ENGINEERING_NOTEBOOK" ||
        state.boardApplication === "APPLICATION_SWITCHING" ||
        state.measurement === "ENGINEERING_NOTEBOOK" ||
        activeMeasurementTransition?.domain === "boardApplication") {
      restoreMeasurementsFromNotebook();
    }
    if (activeMeasurementTransition || state.measurement === "LEARNING_MODE") {
      cancelMeasurementLearningMode();
    }
    const result = validateTransition("measurement", state.measurement, target, measurementContext);
    if (!result.ok) return reject(result.code, result.reason);
    const transition = nextTransition("measurement", state.measurement, target);
    state.measurement = target;
    activeMeasurementSelection = target === "SELECTED_OBJECT"
      ? { objectId: payload.objectId, objects: [...selectedObjects] }
      : null;
    drivers.renderMeasurement?.({ state: target, payload });
    publish(
      transition,
      target === "SELECTED_OBJECT" ? "measurement:object-selected" : "measurement:selection-cleared",
      { objectId: payload.objectId },
    );
    return accept(transition);
  };

  return Object.freeze({
    request(command) {
      let normalized;
      try {
        normalized = normalizeSemanticAction(command);
      } catch (error) {
        return reject("INVALID_ACTION", error.message);
      }
      const context = command.context || {};
      if (normalized.action === "REQUEST_POWER_ON") return requestPowerOn(context);
      if (normalized.action === "REQUEST_POWER_OFF" || normalized.action === "CANCEL_TRANSITION") return requestPowerOff(context);
      if (normalized.action === "RESET_FAULT") {
        return reject("RESET_FAULT_REQUIRES_POWER_OFF", "Secure FAULT_SAFE with REQUEST_POWER_OFF before restarting Workshop.");
      }
      if (normalized.action === "OPEN_DRAWER" || normalized.action === "CLOSE_DRAWER") return requestDrawer(normalized.action, normalized.payload);
      if (normalized.action === "SELECT_MEASURABLE_OBJECT" || normalized.action === "CLEAR_SELECTION") return requestMeasurement(normalized.action, normalized.payload);
      if (normalized.action === "ENTER_LEARNING_MODE") return requestLearningMode();
      if (normalized.action === "EXIT_LEARNING_MODE") return requestLearningModeExit();
      if (normalized.action === "OPEN_NOTEBOOK") return requestNotebook();
      if (normalized.action === "SELECT_APPLICATION") return requestNotebookExit(normalized.payload);
      return reject("UNIMPLEMENTED_ACTION", `${normalized.action} is not wired in WS-016.`);
    },
    reportProjectorRendererUnavailable,
    reportProjectorFault,
    reportTableFault,
    getSnapshot() {
      return freezeResult({
        ...state,
        drawers: freezeResult({ ...drawerStates }),
        activeDrawer,
        busy,
        disabled: disabledState(),
        activeTransitionId: activeTransition?.id || null,
        timingCompliance: "ws016-top-level-controller",
      });
    },
  });
}
