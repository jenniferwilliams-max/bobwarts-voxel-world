const TYPES = new Set(["display", "interactive"]);
const PLACEMENTS = new Set(["auto", "top", "bottom", "left", "right"]);

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  const prototype=Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function normalizeStep(step, index) {
  if (!step || typeof step !== "object" || !step.id || !step.target || !step.message) {
    throw new TypeError(`Invalid BOB Guidance step at index ${index}.`);
  }
  const guidanceType = TYPES.has(step.guidanceType) ? step.guidanceType : "display";
  const placement = PLACEMENTS.has(step.placement) ? step.placement : "auto";
  return freeze({
    id:String(step.id), target:step.target, message:String(step.message),
    title:step.title ? String(step.title) : "THINKer BOB",
    amigCategory:step.amigCategory ? String(step.amigCategory) : null,
    guidanceType, placement, highlight:step.highlight !== false,
    showMe:step.showMe !== false, next:step.next !== false,
    nextLabel:step.nextLabel ? String(step.nextLabel) : "Next",
    back:step.back !== false, cancel:step.cancel !== false,
    completion:step.completion === "target-activation" ? "target-activation" : "manual",
    reveal:typeof step.reveal === "function" ? step.reveal : null,
    restoreReveal:step.restoreReveal !== false,
  });
}

export function createBobGuidanceController({
  document:doc = globalThis.document,
  window:win = globalThis.window,
  root,
  duplicateWindowMs = 500,
  now = () => Date.now(),
} = {}) {
  if (!doc || !win || !root) throw new TypeError("BOB Guidance requires document, window, and root.");
  const q = (name) => root.querySelector(`[data-bob-guidance="${name}"]`);
  const callout=q("callout"), title=q("title"), category=q("category"), message=q("message");
  const showMe=q("show-me"), back=q("back"), next=q("next"), cancelButton=q("cancel");
  const guard=q("guard"), curtains=[q("top"),q("right"),q("bottom"),q("left")];
  if ([callout,title,category,message,showMe,back,next,cancelButton,guard,...curtains].some(v=>!v)) {
    throw new TypeError("BOB Guidance presentation is incomplete.");
  }

  let sequence=null, index=-1, target=null, targetListener=null, revealCleanup=null;
  let restoreFocus=null, lastStart={id:null,time:-Infinity}, generation=0, observer=null;
  const reduced=()=>win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const resolve=(value)=>{
    try {
      const candidate=typeof value === "function" ? value() : typeof value === "string" ? doc.querySelector(value) : value;
      return candidate && candidate.isConnected !== false && typeof candidate.getBoundingClientRect === "function" ? candidate : null;
    } catch (_) { return null; }
  };
  const current=()=>sequence?.steps[index] || null;
  const snapshot=()=>freeze({active:!!sequence,sequenceId:sequence?.id||null,index,stepId:current()?.id||null});
  const emit=(name,detail={})=>root.dispatchEvent(new win.CustomEvent(`bobguidance:${name}`,{detail:freeze({...detail,snapshot:snapshot()})}));

  function clearTarget() {
    if (target && targetListener) target.removeEventListener("click",targetListener,true);
    targetListener=null;
    target?.classList?.remove("bobGuidanceTarget");
    if (revealCleanup) { try { revealCleanup(); } catch (_) {} }
    revealCleanup=null; target=null;
  }
  function hide() {
    root.hidden=true; root.setAttribute("aria-hidden","true");
    clearTarget();
  }
  function cancel(reason="cancelled",{restore=true}={}) {
    if (!sequence) return false;
    const old=sequence; generation+=1; sequence=null; index=-1;
    observer?.disconnect(); observer=null; hide();
    if (restore && restoreFocus?.isConnected && typeof restoreFocus.focus === "function") restoreFocus.focus({preventScroll:true});
    restoreFocus=null; emit("cancel",{reason,sequenceId:old.id}); return true;
  }

  function layout() {
    if (!target || root.hidden) return false;
    const r=target.getBoundingClientRect(), vw=win.innerWidth, vh=win.innerHeight;
    if (![r.left,r.top,r.right,r.bottom,vw,vh].every(Number.isFinite) || r.width<=0 || r.height<=0) return cancel("invalid-target-geometry");
    const pad=6, left=Math.max(0,r.left-pad), top=Math.max(0,r.top-pad), right=Math.min(vw,r.right+pad), bottom=Math.min(vh,r.bottom+pad);
    const rects=[[0,0,vw,top],[right,top,vw-right,bottom-top],[0,bottom,vw,vh-bottom],[0,top,left,bottom-top]];
    curtains.forEach((el,i)=>{const [x,y,w,h]=rects[i]; Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${Math.max(0,w)}px`,height:`${Math.max(0,h)}px`});});
    Object.assign(guard.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
    guard.hidden=current().guidanceType === "interactive";
    const box=callout.getBoundingClientRect(), gap=12, maxX=Math.max(8,vw-box.width-8), maxY=Math.max(8,vh-box.height-8);
    const available={top:top,bottom:vh-bottom,left,right:vw-right};
    let place=current().placement;
    if (place === "auto") place=Object.entries(available).sort((a,b)=>b[1]-a[1])[0][0];
    let x=(left+right-box.width)/2, y=bottom+gap;
    if(place==="top") y=top-box.height-gap;
    if(place==="left"){x=left-box.width-gap;y=(top+bottom-box.height)/2;}
    if(place==="right"){x=right+gap;y=(top+bottom-box.height)/2;}
    Object.assign(callout.style,{left:`${Math.min(maxX,Math.max(8,x))}px`,top:`${Math.min(maxY,Math.max(8,y))}px`});
    return true;
  }

  function present() {
    const step=current(); clearTarget();
    target=resolve(step?.target);
    if (!step || !target) { cancel("missing-target"); return false; }
    if (step.reveal) {
      try { const cleanup=step.reveal({target,step,reducedMotion:reduced()}); if(typeof cleanup==="function") revealCleanup=cleanup; }
      catch (_) { cancel("reveal-failed"); return false; }
    } else target.scrollIntoView?.({block:"nearest",inline:"nearest",behavior:reduced()?"auto":"smooth"});
    title.textContent=step.title; message.textContent=step.message;
    category.textContent=step.amigCategory || ""; category.hidden=!step.amigCategory;
    showMe.hidden=!step.showMe; back.hidden=!step.back || index===0; next.hidden=!step.next;
    next.textContent=step.nextLabel;
    cancelButton.hidden=!step.cancel; target.classList?.toggle("bobGuidanceTarget",step.highlight);
    root.hidden=false; root.setAttribute("aria-hidden","false");
    if(step.completion === "target-activation") {
      const token=generation;
      targetListener=()=>queueMicrotask(()=>{if(token===generation && sequence) advance("target-activation");});
      target.addEventListener("click",targetListener,true);
    }
    win.requestAnimationFrame?.(layout) ?? layout();
    cancelButton.focus({preventScroll:true}); emit("step",{stepId:step.id,index}); return true;
  }
  function advance(reason="next") {
    if (!sequence) return false;
    if(index >= sequence.steps.length-1){const id=sequence.id; generation+=1; sequence=null; index=-1; observer?.disconnect(); observer=null; hide(); emit("complete",{reason,sequenceId:id}); return true;}
    index+=1; return present();
  }
  function start(input) {
    const id=String(input?.id||"");
    if(!id || !Array.isArray(input?.steps) || !input.steps.length) throw new TypeError("A non-empty BOB Guidance sequence is required.");
    const time=now(); if(lastStart.id===id && time-lastStart.time<duplicateWindowMs) return freeze({ok:false,code:"DUPLICATE"});
    lastStart={id,time}; if(sequence) cancel("superseded",{restore:false});
    const steps=input.steps.map(normalizeStep); sequence=freeze({id,steps}); index=0; generation+=1; restoreFocus=doc.activeElement;
    observer=new win.MutationObserver(()=>{if(target && !target.isConnected) cancel("stale-target");});
    observer.observe(doc.documentElement,{childList:true,subtree:true});
    return present() ? freeze({ok:true,snapshot:snapshot()}) : freeze({ok:false,code:"MISSING_TARGET"});
  }

  showMe.addEventListener("click",()=>{if(!target)return; target.classList?.add("bobGuidanceTarget"); target.scrollIntoView?.({block:"nearest",inline:"nearest",behavior:reduced()?"auto":"smooth"}); if(current()?.guidanceType==="interactive") target.focus?.({preventScroll:true}); layout();});
  back.addEventListener("click",()=>{if(sequence&&index>0){index-=1;present();}});
  next.addEventListener("click",()=>advance()); cancelButton.addEventListener("click",()=>cancel());
  doc.addEventListener("keydown",event=>{
    if(!sequence) return;
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();cancel("escape");return;}
    if(event.key==="Tab" && callout.contains(doc.activeElement)){
      const controls=[showMe,back,next,cancelButton].filter(button=>!button.hidden&&!button.disabled);
      if(!controls.length) return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    }
  },true);
  win.addEventListener("resize",layout); win.addEventListener("scroll",layout,true);
  return freeze({start,cancel,next:advance,back:()=>{if(!sequence||index<=0)return false;index-=1;return present();},showMe:()=>showMe.click(),refresh:layout,handleViewChange:()=>cancel("view-change"),getSnapshot:snapshot});
}
