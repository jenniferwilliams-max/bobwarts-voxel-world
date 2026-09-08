const SEQUENCE_ID="builder-first-mission-challenge";
const SETTLE_DELAY_MS=220;
const WELCOME_POLL_MS=80;

function missionId(win){
  return String(win.selectedStartWorld || "buildCastle");
}

function missionPopupIsOpen(doc,win){
  const popup=doc.getElementById("missionPopup");
  if(!popup || popup.hidden) return false;
  return !win.getComputedStyle || win.getComputedStyle(popup).display!=="none";
}

function builderIsReady(doc,win){
  return !doc.body.classList.contains("starterScreenActive") &&
    !doc.body.classList.contains("workshopMode") &&
    !missionPopupIsOpen(doc,win);
}

function revealChallenge(info,{template=false}={}){
  info.classList.add("bobGuidanceChallengeReveal");
  if(template) info.classList.add("bobGuidanceChallengeTemplateReveal");
  return ()=>{
    info.classList.remove("bobGuidanceChallengeReveal","bobGuidanceChallengeTemplateReveal");
  };
}

export function installFirstMissionBuilderChallengeGuidance({
  window:win=globalThis.window,
  document:doc=globalThis.document,
  guidance=win?.bobGuidance,
}={}){
  const start=doc?.getElementById("startBuildingButton");
  const root=doc?.getElementById("bobGuidanceRoot");
  if(!win || !doc || !guidance || !start || !root) return Object.freeze({ok:false,code:"MISSING_OWNER"});

  const guidedMissions=new Set();
  let generation=0;
  let pending=null;
  let settleTimer=0;
  let welcomePollTimer=0;

  function clearPending(reason="cancelled"){
    generation+=1;
    pending=null;
    if(settleTimer){win.clearTimeout(settleTimer);settleTimer=0;}
    if(welcomePollTimer){win.clearInterval(welcomePollTimer);welcomePollTimer=0;}
    const snapshot=guidance.getSnapshot();
    if(snapshot.active && snapshot.sequenceId===SEQUENCE_ID) guidance.cancel(reason);
  }

  function armFreshMission(){
    const id=missionId(win);
    clearPending("new-mission-start");
    if(guidedMissions.has(id)) return;
    pending={token:generation,id,welcomeOwner:null};
    const mount=doc.getElementById("thinkerBobRigMount");
    mount?.removeAttribute("data-welcome-wave-cycles");
    welcomePollTimer=win.setInterval(()=>{
      if(!pending) return;
      const currentMount=doc.getElementById("thinkerBobRigMount");
      if(currentMount?.dataset?.welcomeWaveCycles!=="2" || currentMount.dataset.welcomeWaveState!=="idle") return;
      scheduleGuidance(pending.token);
    },WELCOME_POLL_MS);
  }

  function scheduleGuidance(token){
    if(!pending || pending.token!==token || settleTimer) return;
    if(welcomePollTimer){win.clearInterval(welcomePollTimer);welcomePollTimer=0;}
    settleTimer=win.setTimeout(()=>beginGuidance(token),
      win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : SETTLE_DELAY_MS);
  }

  function beginGuidance(token){
    settleTimer=0;
    if(!pending || pending.token!==token || !builderIsReady(doc,win)) return;
    const id=missionId(win);
    if(id!==pending.id) return clearPending("stale-mission");
    pending.id=id;
    if(guidedMissions.has(id)) return clearPending("already-guided");
    const info=doc.getElementById("info");
    const firstCheckpoint=doc.querySelector("#challengeChecklist input");
    if(!info || !firstCheckpoint) return clearPending("missing-challenge");
    pending=null;
    const result=guidance.start({
      id:SEQUENCE_ID,
      steps:[
        {
          id:"challenge-roadmap",target:info,title:"Your Builder Challenge",
          message:"Your Builder Challenge is your Mission roadmap.",
          amigCategory:"Ask it",placement:"top",back:false,showMe:false,
          reveal:()=>revealChallenge(info),
        },
        {
          id:"starting-template",target:info,title:"Start with the Template",
          message:"This is your starting template. Use it as a starting point, then make the design your own.",
          amigCategory:"Make it happen",placement:"top",showMe:false,
          reveal:()=>revealChallenge(info,{template:true}),
        },
        {
          id:"mission-checkpoints",target:"#challengeChecklist",title:"Mission Checkpoints",
          message:"Use these checkpoints to build, change, solve, and improve your design.",
          amigCategory:"Improve it",placement:"top",showMe:false,
          reveal:()=>revealChallenge(info),
        },
        {
          id:"ready-to-build",target:info,title:"Ready to Build!",
          message:"You know the plan. Start building, test your ideas, and make them even better!",
          amigCategory:"Grow what you know",placement:"top",showMe:false,
          nextLabel:"GOT IT — LET'S BUILD",reveal:()=>revealChallenge(info),
        },
      ],
    });
    if(result.ok) guidedMissions.add(id);
  }

  doc.addEventListener("click",event=>{
    if(event.target?.closest?.("#startBuildingButton")) armFreshMission();
  },true);
  win.addEventListener("builderBobMissionWelcome",event=>{
    if(!pending) return;
    pending.id=missionId(win);
    pending.welcomeOwner=event.detail?.owner;
  });
  win.addEventListener("builderBobMissionWelcomeComplete",event=>{
    if(!pending || (pending.welcomeOwner!=null && pending.welcomeOwner!==event.detail?.owner)) return;
    scheduleGuidance(pending.token);
  });
  root.addEventListener("bobguidance:complete",event=>{
    if(event.detail?.sequenceId===SEQUENCE_ID) firstFocusableChallenge(doc)?.focus?.({preventScroll:true});
  });
  root.addEventListener("bobguidance:cancel",event=>{
    if(event.detail?.sequenceId===SEQUENCE_ID) firstFocusableChallenge(doc)?.focus?.({preventScroll:true});
  });
  new win.MutationObserver(()=>{
    if(doc.body.classList.contains("workshopMode")) clearPending("view-change");
  }).observe(doc.body,{attributes:true,attributeFilter:["class"]});
  win.addEventListener("pagehide",()=>clearPending("pagehide"),{once:true});
  return Object.freeze({ok:true,cancel:clearPending});
}

function firstFocusableChallenge(doc){
  return doc.querySelector("#challengeChecklist input") || doc.getElementById("workspaceModeSwitch");
}
