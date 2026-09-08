export const WORKSHOP_PROJECT_SCHEMA = Object.freeze({
  app:"THINKamigBOB Workshop",
  schema:"workshop-project",
  version:1,
});

export const WORKSHOP_PROJECT_OBJECT_KINDS = Object.freeze({
  STANDARD_SHAPE:"STANDARD_SHAPE",
  TRUSTED_PART:"TRUSTED_PART",
});

export const WORKSHOP_PROJECT_SHAPES = Object.freeze([
  "cube", "sphere", "trianglePrism",
]);

export const WORKSHOP_PROJECT_FAMILIES = Object.freeze([
  "SUPPORT_COLUMN", "BRIDGE_BEAM",
]);

const finite = (value) => Number.isFinite(value);
const ROTATION_EPSILON = 1e-9;
const validText = (value, maximum = 80) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum;
const freezeVector = (value, positive = false) => {
  if (!value || !finite(value.x) || !finite(value.y) || !finite(value.z)) return null;
  if (positive && (value.x <= 0 || value.y <= 0 || value.z <= 0)) return null;
  return Object.freeze({ x:value.x, y:value.y, z:value.z });
};
const freezeDimensions = (value) => {
  if (!value || !finite(value.width) || !finite(value.height) ||
      !finite(value.depth) || value.width <= 0 || value.height <= 0 ||
      value.depth <= 0) return null;
  return Object.freeze({
    width:value.width, height:value.height, depth:value.depth,
  });
};

function freezeObjectRecord(record) {
  if (!record || !validText(record.id, 100) ||
      !Object.values(WORKSHOP_PROJECT_OBJECT_KINDS).includes(record.kind)) return null;
  const position = freezeVector(record.position);
  const rotation = freezeVector(record.rotation);
  const scale = freezeVector(record.scale, true);
  if (!position || !rotation || !scale || !Number.isInteger(record.color) ||
      record.color < 0 || record.color > 0xffffff) return null;
  if (Math.abs(rotation.x) > ROTATION_EPSILON ||
      Math.abs(rotation.z) > ROTATION_EPSILON) return null;
  if (position.x < -25 || position.x > 25 || position.z < -25 ||
      position.z > 25 || position.y < 0) return null;

  if (record.kind === WORKSHOP_PROJECT_OBJECT_KINDS.STANDARD_SHAPE) {
    if (!WORKSHOP_PROJECT_SHAPES.includes(record.shape)) return null;
    const dimensions = record.shape === "cube"
      ? freezeDimensions(record.dimensions)
      : null;
    if (record.shape === "cube" && !dimensions) return null;
    if (record.family != null) return null;
    return Object.freeze({
      id:record.id.trim(), kind:record.kind, shape:record.shape,
      position, rotation, scale, color:record.color,
      dimensions,
    });
  }

  if (!WORKSHOP_PROJECT_FAMILIES.includes(record.family) || record.shape != null) return null;
  const dimensions = freezeDimensions(record.dimensions);
  if (!dimensions) return null;
  if (record.family === "BRIDGE_BEAM" && dimensions.height < 0.5) return null;
  if (record.family === "SUPPORT_COLUMN" &&
      (dimensions.width < 1 || dimensions.height < 1 || dimensions.depth < 1)) return null;
  return Object.freeze({
    id:record.id.trim(), kind:record.kind, family:record.family,
    position, rotation, scale, color:record.color, dimensions,
  });
}

export function validateWorkshopProject(project) {
  if (!project || project.app !== WORKSHOP_PROJECT_SCHEMA.app ||
      project.schema !== WORKSHOP_PROJECT_SCHEMA.schema ||
      project.version !== WORKSHOP_PROJECT_SCHEMA.version ||
      !validText(project.id, 100) || !validText(project.name, 60) ||
      !finite(project.createdAt) || !finite(project.updatedAt) ||
      project.createdAt < 0 || project.updatedAt < project.createdAt ||
      !Array.isArray(project.objects)) return null;
  const objects = project.objects.map(freezeObjectRecord);
  if (objects.some((record) => !record)) return null;
  const ids = objects.map((record) => record.id);
  if (new Set(ids).size !== ids.length) return null;
  return Object.freeze({
    app:WORKSHOP_PROJECT_SCHEMA.app,
    schema:WORKSHOP_PROJECT_SCHEMA.schema,
    version:WORKSHOP_PROJECT_SCHEMA.version,
    id:project.id.trim(),
    name:project.name.trim(),
    createdAt:project.createdAt,
    updatedAt:project.updatedAt,
    objects:Object.freeze(objects),
  });
}

export function createWorkshopProjectSerializer({ describeObject } = {}) {
  if (typeof describeObject !== "function") {
    throw new TypeError("Workshop object description adapter is required.");
  }
  return Object.freeze({
    serialize({ id, name, createdAt, updatedAt, objects } = {}) {
      if (!Array.isArray(objects)) return Object.freeze({ok:false,code:"INVALID_OBJECTS"});
      const records = [];
      for (let index = 0; index < objects.length; index += 1) {
        let described = null;
        try { described = describeObject(objects[index]); } catch (_) { described = null; }
        if (!described) {
          return Object.freeze({ok:false,code:"UNSUPPORTED_OBJECT",index});
        }
        records.push({...described,id:`object-${index + 1}`});
      }
      const project = validateWorkshopProject({
        ...WORKSHOP_PROJECT_SCHEMA,id,name,createdAt,updatedAt,objects:records,
      });
      return project
        ? Object.freeze({ok:true,code:"SERIALIZED",project})
        : Object.freeze({ok:false,code:"INVALID_PROJECT"});
    },
    validate:validateWorkshopProject,
  });
}
