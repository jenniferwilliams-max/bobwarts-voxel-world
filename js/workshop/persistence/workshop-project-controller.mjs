export function createWorkshopProjectController({
  serializer,
  storage,
  draft,
  history,
  getObjects,
  createCandidate,
  validateCandidates,
  replaceObjects,
  disposeCandidates = () => {},
  now = () => Date.now(),
  createId,
} = {}) {
  if (!serializer || !storage || !draft || !history ||
      typeof getObjects !== "function" || typeof createCandidate !== "function" ||
      typeof validateCandidates !== "function" || typeof replaceObjects !== "function") {
    throw new TypeError("Workshop project controller adapters are required.");
  }
  let currentProject = null;
  let fallbackIdSequence = 0;

  const generateProjectId = typeof createId === "function"
    ? createId
    : () => {
        try {
          if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return `workshop-${globalThis.crypto.randomUUID()}`;
          }
        } catch (_) {}
        fallbackIdSequence += 1;
        return `workshop-${now().toString(36)}-${fallbackIdSequence.toString(36)}`;
      };

  const snapshot = () => Object.freeze({
    currentProjectId:currentProject ? currentProject.id : null,
    currentProjectName:currentProject ? currentProject.name : null,
    dirty:draft.getSnapshot().dirty,
  });

  const installProject = (project) => {
    const previousProject = currentProject;
    const validated = serializer.validate(project);
    if (!validated) return Object.freeze({ok:false,code:"INVALID_PROJECT"});
    const candidates = [];
    try {
      for (const record of validated.objects) {
        const candidate = createCandidate(record);
        if (!candidate) throw new Error("UNSUPPORTED_OBJECT");
        candidates.push(candidate);
      }
      if (validateCandidates(candidates,validated.objects) !== true) {
        throw new Error("INVALID_GEOMETRY");
      }
    } catch (error) {
      disposeCandidates(candidates);
      return Object.freeze({ok:false,code:error.message || "OPEN_FAILED"});
    }
    if (replaceObjects(candidates) !== true) {
      disposeCandidates(candidates);
      return Object.freeze({ok:false,code:"REPLACE_FAILED"});
    }
    history.reset();
    draft.replaceActive(candidates);
    currentProject = validated;
    return Object.freeze({
      ok:true,code:"OPENED",project:validated,previousProject,snapshot:snapshot()
    });
  };

  return Object.freeze({
    getSnapshot:snapshot,
    list() { return storage.list(); },
    prepareExport(name) {
      const timestamp = now();
      const id = currentProject ? currentProject.id : generateProjectId();
      const createdAt = currentProject ? currentProject.createdAt : timestamp;
      return serializer.serialize({
        id,name,createdAt,updatedAt:timestamp,objects:getObjects(),
      });
    },
    confirmExport(project) {
      const validated = serializer.validate(project);
      if (!validated) return Object.freeze({ok:false,code:"INVALID_PROJECT"});
      currentProject = validated;
      draft.markCheckpoint();
      return Object.freeze({ok:true,code:"SAVED",project:validated,snapshot:snapshot()});
    },
    importProject(project) { return installProject(project); },
    restoreProjectIdentity(project) {
      currentProject = project || null;
      return snapshot();
    },
    save(name,{replaceDuplicate=false}={}) {
      const timestamp = now();
      const id = currentProject ? currentProject.id : generateProjectId();
      const createdAt = currentProject ? currentProject.createdAt : timestamp;
      const serialized = serializer.serialize({
        id,name,createdAt,updatedAt:timestamp,objects:getObjects(),
      });
      if (!serialized.ok) return serialized;
      const saved = storage.save(serialized.project,{replaceDuplicate});
      if (!saved.ok) return saved;
      currentProject = saved.project;
      draft.markCheckpoint();
      return Object.freeze({ok:true,code:"SAVED",project:saved.project,snapshot:snapshot()});
    },
    open(id) {
      const stored = storage.get(id);
      if (!stored.ok) return stored;
      return installProject(stored.project);
    },
    newProject() {
      if (replaceObjects([]) !== true) {
        return Object.freeze({ok:false,code:"REPLACE_FAILED"});
      }
      history.reset();
      draft.replaceActive([]);
      currentProject = null;
      return Object.freeze({ok:true,code:"NEW",snapshot:snapshot()});
    },
  });
}
