export const WORKSHOP_PROJECT_STORAGE_KEY = "thinkamigbob-workshop-projects-v1";

const collectionShape = (projects) => ({
  app:"THINKamigBOB Workshop",
  schema:"workshop-project-collection",
  version:1,
  projects,
});

export function createWorkshopProjectStorage({
  storage,
  validateProject,
  key = WORKSHOP_PROJECT_STORAGE_KEY,
} = {}) {
  if (!storage || typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function" || typeof validateProject !== "function") {
    throw new TypeError("Workshop project storage adapters are required.");
  }

  const read = () => {
    let raw = null;
    try { raw = storage.getItem(key); } catch (_) {
      return Object.freeze({ok:false,code:"STORAGE_UNAVAILABLE"});
    }
    if (!raw) return Object.freeze({ok:true,projects:Object.freeze([])});
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {
      return Object.freeze({ok:false,code:"MALFORMED_STORAGE"});
    }
    if (!parsed || parsed.app !== "THINKamigBOB Workshop" ||
        parsed.schema !== "workshop-project-collection" || parsed.version !== 1 ||
        !Array.isArray(parsed.projects)) {
      return Object.freeze({ok:false,code:"INVALID_STORAGE"});
    }
    const projects = [];
    let invalidCount = 0;
    parsed.projects.forEach((entry) => {
      const project = validateProject(entry);
      if (project) projects.push(project);
      else invalidCount += 1;
    });
    if (new Set(projects.map((project) => project.id)).size !== projects.length) {
      return Object.freeze({ok:false,code:"INVALID_STORAGE"});
    }
    return Object.freeze({
      ok:true,
      projects:Object.freeze(projects),
      invalidCount,
    });
  };

  const sorted = (projects) => [...projects].sort((left,right) =>
    right.updatedAt-left.updatedAt || left.name.localeCompare(right.name)
  );

  return Object.freeze({
    list() {
      const result = read();
      return result.ok
        ? Object.freeze({
            ok:true,
            projects:Object.freeze(sorted(result.projects)),
            invalidCount:result.invalidCount,
          })
        : result;
    },
    get(id) {
      const result = read();
      if (!result.ok) return result;
      const project = result.projects.find((candidate) => candidate.id === id);
      return project
        ? Object.freeze({ok:true,project})
        : Object.freeze({ok:false,code:"NOT_FOUND"});
    },
    save(project,{replaceDuplicate=false}={}) {
      const validated = validateProject(project);
      if (!validated) return Object.freeze({ok:false,code:"INVALID_PROJECT"});
      const result = read();
      if (!result.ok) return result;
      const normalizedName = validated.name.toLocaleLowerCase();
      const duplicate = result.projects.find((candidate) =>
        candidate.id !== validated.id && candidate.name.toLocaleLowerCase() === normalizedName
      );
      if (duplicate && !replaceDuplicate) {
        return Object.freeze({ok:false,code:"DUPLICATE_NAME",duplicate});
      }
      const next = result.projects.filter((candidate) =>
        candidate.id !== validated.id && (!duplicate || candidate.id !== duplicate.id)
      );
      next.push(validated);
      try { storage.setItem(key,JSON.stringify(collectionShape(next))); }
      catch (_) { return Object.freeze({ok:false,code:"WRITE_FAILED"}); }
      return Object.freeze({ok:true,code:"SAVED",project:validated});
    },
  });
}
