export const WORKSHOP_SELECTION_STATES = Object.freeze({
  INACTIVE:"INACTIVE",
  SELECT_ONE:"SELECT_ONE",
  SELECT_MULTIPLE:"SELECT_MULTIPLE",
  SELECT_STACK:"SELECT_STACK",
});

export const WORKSHOP_SELECTION_CONTACT_TOLERANCE = 0.0001;

const freezeSelection = (objects) => Object.freeze(
  Array.isArray(objects) ? objects.filter((object,index,list) =>
    object && list.indexOf(object) === index
  ) : []
);

const result = (ok,code,snapshot,selection) => Object.freeze({
  ok,code,snapshot,selection:freezeSelection(selection),
});

export function createWorkshopSelectionFoundationController(){
  let state=WORKSHOP_SELECTION_STATES.INACTIVE;
  let entrySelection=freezeSelection([]);
  let workingSelection=freezeSelection([]);
  let firstSeedPending=false;

  const getSnapshot=() => Object.freeze({
    state,entrySelection,workingSelection,firstSeedPending,
  });
  const begin=(nextState,currentSelection) => {
    entrySelection=freezeSelection(currentSelection);
    workingSelection=entrySelection;
    state=nextState;
    firstSeedPending=nextState===WORKSHOP_SELECTION_STATES.SELECT_MULTIPLE;
    return result(true,nextState,getSnapshot(),workingSelection);
  };

  return Object.freeze({
    beginSelectOne(selection){
      return begin(WORKSHOP_SELECTION_STATES.SELECT_ONE,selection);
    },
    beginSelectMultiple(selection){
      return begin(WORKSHOP_SELECTION_STATES.SELECT_MULTIPLE,selection);
    },
    beginSelectStack(selection){
      return begin(WORKSHOP_SELECTION_STATES.SELECT_STACK,selection);
    },
    update(selection){
      if(state===WORKSHOP_SELECTION_STATES.INACTIVE){
        return result(false,"INACTIVE",getSnapshot(),workingSelection);
      }
      workingSelection=freezeSelection(selection);
      return result(true,"UPDATED",getSnapshot(),workingSelection);
    },
    acceptFirstSeed(selection){
      if(state!==WORKSHOP_SELECTION_STATES.SELECT_MULTIPLE ||
        !firstSeedPending){
        return result(false,"FIRST_SEED_NOT_PENDING",getSnapshot(),workingSelection);
      }
      workingSelection=freezeSelection(selection);
      firstSeedPending=false;
      return result(true,"FIRST_SEED_ACCEPTED",getSnapshot(),workingSelection);
    },
    finish(){
      if(state!==WORKSHOP_SELECTION_STATES.SELECT_MULTIPLE){
        return result(false,"NOT_MULTIPLE",getSnapshot(),workingSelection);
      }
      const settled=workingSelection;
      state=WORKSHOP_SELECTION_STATES.INACTIVE;
      firstSeedPending=false;
      entrySelection=freezeSelection([]);
      workingSelection=settled;
      return result(true,"FINISHED",getSnapshot(),settled);
    },
    cancel(){
      if(state===WORKSHOP_SELECTION_STATES.INACTIVE){
        return result(true,"IDEMPOTENT",getSnapshot(),workingSelection);
      }
      const restored=entrySelection;
      state=WORKSHOP_SELECTION_STATES.INACTIVE;
      firstSeedPending=false;
      entrySelection=freezeSelection([]);
      workingSelection=restored;
      return result(true,"CANCELLED",getSnapshot(),restored);
    },
    reset(){
      state=WORKSHOP_SELECTION_STATES.INACTIVE;
      firstSeedPending=false;
      entrySelection=freezeSelection([]);
      workingSelection=freezeSelection([]);
      return result(true,"RESET",getSnapshot(),workingSelection);
    },
    getSnapshot,
  });
}

const validBounds = (bounds) => bounds && bounds.min && bounds.max &&
  [bounds.min.x,bounds.min.y,bounds.min.z,
    bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite) &&
  bounds.min.x<=bounds.max.x && bounds.min.y<=bounds.max.y &&
  bounds.min.z<=bounds.max.z;

const overlap = (first,second,axis) =>
  Math.min(first.max[axis],second.max[axis])-
  Math.max(first.min[axis],second.min[axis]);

export function workshopBoundsShareFace(first,second,
  tolerance=WORKSHOP_SELECTION_CONTACT_TOLERANCE){
  if(!validBounds(first) || !validBounds(second) ||
    !Number.isFinite(tolerance) || tolerance<0) return false;
  return ["x","y","z"].some((faceAxis) => {
    const meets=Math.min(
      Math.abs(first.max[faceAxis]-second.min[faceAxis]),
      Math.abs(second.max[faceAxis]-first.min[faceAxis])
    )<=tolerance;
    if(!meets) return false;
    return ["x","y","z"].filter((axis) => axis!==faceAxis)
      .every((axis) => overlap(first,second,axis)>tolerance);
  });
}

export function getWorkshopConnectedSelection({
  seed,objects,getBounds,tolerance=WORKSHOP_SELECTION_CONTACT_TOLERANCE,
}={}){
  if(!seed || !Array.isArray(objects) || !objects.includes(seed) ||
    typeof getBounds!=="function") return Object.freeze([]);
  const eligible=objects.filter((object,index,list) =>
    object && list.indexOf(object)===index
  );
  const bounds=new Map();
  for(const object of eligible){
    const value=getBounds(object);
    if(validBounds(value)) bounds.set(object,value);
  }
  if(!bounds.has(seed)) return Object.freeze([]);
  const connected=[];
  const pending=[seed];
  const visited=new Set();
  while(pending.length){
    const object=pending.shift();
    if(visited.has(object)) continue;
    visited.add(object);
    connected.push(object);
    for(const candidate of eligible){
      if(!visited.has(candidate) && bounds.has(candidate) &&
        workshopBoundsShareFace(bounds.get(object),bounds.get(candidate),tolerance)){
        pending.push(candidate);
      }
    }
  }
  return Object.freeze(connected);
}

const centerOnAxis = (bounds,axis) =>
  (bounds.min[axis]+bounds.max[axis])/2;

export function workshopBoundsShareVerticalStackFace(first,second,
  tolerance=WORKSHOP_SELECTION_CONTACT_TOLERANCE){
  if(!validBounds(first) || !validBounds(second) ||
    !Number.isFinite(tolerance) || tolerance<0) return false;
  const sameColumn=["x","z"].every((axis) =>
    Math.abs(centerOnAxis(first,axis)-centerOnAxis(second,axis))<=tolerance
  );
  const verticalFaceMeets=Math.min(
    Math.abs(first.max.y-second.min.y),
    Math.abs(second.max.y-first.min.y)
  )<=tolerance;
  return sameColumn && verticalFaceMeets &&
    overlap(first,second,"x")>tolerance &&
    overlap(first,second,"z")>tolerance;
}

export function getWorkshopVerticalStackSelection({
  seed,objects,getBounds,isEligible,
  tolerance=WORKSHOP_SELECTION_CONTACT_TOLERANCE,
}={}){
  if(!seed || !Array.isArray(objects) || !objects.includes(seed) ||
    typeof getBounds!=="function" || typeof isEligible!=="function" ||
    !isEligible(seed)) return Object.freeze([]);
  const eligible=objects.filter((object,index,list) =>
    object && list.indexOf(object)===index && isEligible(object)
  );
  const bounds=new Map();
  for(const object of eligible){
    const value=getBounds(object);
    if(validBounds(value)) bounds.set(object,value);
  }
  if(!bounds.has(seed)) return Object.freeze([]);
  const connected=[];
  const pending=[seed];
  const visited=new Set();
  while(pending.length){
    const object=pending.shift();
    if(visited.has(object)) continue;
    visited.add(object);
    connected.push(object);
    for(const candidate of eligible){
      if(!visited.has(candidate) && bounds.has(candidate) &&
        workshopBoundsShareVerticalStackFace(
          bounds.get(object),bounds.get(candidate),tolerance)){
        pending.push(candidate);
      }
    }
  }
  connected.sort((first,second) =>
    bounds.get(first).min.y-bounds.get(second).min.y
  );
  return Object.freeze(connected);
}
