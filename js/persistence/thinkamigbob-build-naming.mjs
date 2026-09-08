export const BUILDER_MISSION_BUILD_NAMES = Object.freeze({
  buildCastle:"Castle Builder",
  buildPlayground:"Playground Builder",
  buildHabitat:"Habitat Builder",
  buildDragonLair:"Dragon Lair",
  buildFutureCity:"Future City",
  buildWeatherWorld:"Weather Station",
  buildEnergyCity:"Energy City",
  buildSpaceColony:"Moon or Mars Colony",
  buildMoonColony:"Moon Colony",
  buildMarsColony:"Mars Colony",
  buildEngineeringWorld:"Engineering Challenge",
  buildCellWorld:"Cell Builder Lab",
});

export function normalizeThinkamigbobBuildName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g," ").trim().slice(0,60);
}

export function getBuilderMissionBuildName(missionKey) {
  return BUILDER_MISSION_BUILD_NAMES[missionKey] || "My Builder Project";
}

export function getWorkshopBuildName() {
  return "My Workshop Build";
}

export function createThinkamigbobBuildFilename(name) {
  const base=normalizeThinkamigbobBuildName(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,80);
  return `${base || "ThinkamigBOB-Build"}.thinkamigbob.json`;
}
