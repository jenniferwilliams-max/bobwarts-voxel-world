export const WORKSHOP_PROJECT_FILE_EXTENSION = ".thinkamigbob.json";

const normalizeName = (value) => typeof value === "string" ? value.trim() : "";

export function createWorkshopProjectFilename(name) {
  const base = normalizeName(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "Workshop-Build"}${WORKSHOP_PROJECT_FILE_EXTENSION}`;
}

export function createWorkshopProjectFileService({ validateProject } = {}) {
  if (typeof validateProject !== "function") {
    throw new TypeError("Workshop project validation adapter is required.");
  }

  return Object.freeze({
    exportProject(project) {
      const validated = validateProject(project);
      if (!validated) return Object.freeze({ok:false,code:"INVALID_PROJECT"});
      try {
        return Object.freeze({
          ok:true,
          code:"EXPORTED",
          project:validated,
          filename:createWorkshopProjectFilename(validated.name),
          json:JSON.stringify(validated,null,2),
        });
      } catch (_) {
        return Object.freeze({ok:false,code:"EXPORT_FAILED"});
      }
    },
    importText(text) {
      if (typeof text !== "string" || !text.trim()) {
        return Object.freeze({ok:false,code:"EMPTY_FILE"});
      }
      let parsed = null;
      try { parsed = JSON.parse(text); }
      catch (_) { return Object.freeze({ok:false,code:"MALFORMED_FILE"}); }
      const project = validateProject(parsed);
      return project
        ? Object.freeze({ok:true,code:"IMPORTED",project})
        : Object.freeze({ok:false,code:"INVALID_PROJECT"});
    },
  });
}
