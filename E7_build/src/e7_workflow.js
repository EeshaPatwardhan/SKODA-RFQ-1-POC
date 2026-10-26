/* =====================================================================
   E7 / V8  ·  Flow — one routing model for every approval
   Before: creating a change request, a commodity / FX change or a technical change only showed a toast; the "task" went to a list the
   notification centre never read, nothing was routed to the next person, and approving applied the change in one click.
   Now every approval is an ApprovalEngine flow with ordered steps, each owned by a role:
     start  → the first approver gets a task + e-mail-log entry + bell badge (and the sidebar "Approvals" badge)
     decide → closes that task, routes to the next role (Management for high-value items), or — on the last human step — applies the change
              (price version, CBD re-roll, FX / commodity record, approval note ...) and tells the initiator
     reject → closes the open task, logs the rejection and raises a rework task on the initiator
   Switch role (top bar) to act as each person; the bell, Home, Approvals and the item's own screen all show the same state.
   ===================================================================== */
const Flow=(function(){
"use strict";
const T0=(typeof TODAY!=="undefined")?TODAY:"2026-07-29";
const KIND={"change-request":"Change request","commodity-price":"Commodity price change","fx-rate":"FX rate change","technical-change":"Technical change","milestone-amendment":"Milestone amendment"};
const VERB={"change-request":"Approve change request","commodity-price":"Approve commodity price change","fx-rate":"Approve FX rate change","technical-change":"Sign off technical change","milestone-amendment":"Approve milestone amendment"};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now=()=>new Date().toISOString().slice(0,16).replace("T"," ");
const roleLabel=r=>(ROLES.find(x=>x.id===r)||{}).label||r;
const userOf=r=>DATA.users.find(u=>u.role===r)||null;
const nameOf=r=>{ const u=userOf(r); return u?u.name:roleLabel(r); };
const me=()=>({role:RBAC.role,name:nameOf(RBAC.role)});
const fmt=n=>(Math.round((+n||0)*100)/100).toLocaleString("en-IN");
let seq=0;

/* ------------------------------------------------------------ tasks, e-mail log, badge */
function notify(role,o){
  const types=window.TASK_TYPES||{}, type=o.type||"approval-pending", tt=types[type]||{icon:"🔔",label:"Notification"};
  const t={id:"TN"+(++seq)+Date.now().toString(36).slice(-3),state:"open",reminders:0,icon:o.icon||tt.icon,escalationTarget:null,type,owner:role,entity:o.entity||o.title,wf:o.wf||"—",
    due:o.due||"Due today",dueDays:o.dueDays==null?0:o.dueDays,cadence:"On event",title:o.title,meta:o.meta||"",open:o.open||null,flowId:o.flowId||null,created:now()};
  TaskCentre.tasks.unshift(t);
  TaskCentre.emailLog.unshift({when:t.created,to:role,subj:"["+t.wf+"] "+tt.label+" — "+o.title,opened:false});
  refresh(); return t;
}
function closeTasks(wf,pred){ TaskCentre.tasks.forEach(t=>{ if(t.state==="open"&&t.wf===wf&&t.type==="approval-pending"&&(!pred||pred(t))) t.state="done"; }); }
function refresh(){ try{ Notif.updateBadge(); }catch(e){} }
const mine=()=>TaskCentre.forRole(RBAC.role);

/* ------------------------------------------------------------ flows */
const live=f=>f.status!=="approved"&&f.status!=="rejected";
function canAct(f){ if(!f||!live(f)) return false; const c=f.steps.find(s=>s.status==="current"); return !!c&&!c.system&&(c.role===RBAC.role||RBAC.role==="admin"); }
function awaitingHtml(f){ const c=f.steps.find(s=>s.status==="current");
  if(f.status==="approved") return `<span class="chip chip-green"><span class="chip-dot"></span>Approved &amp; applied</span>`;
  if(f.status==="rejected") return `<span class="chip chip-red"><span class="chip-dot"></span>Rejected — sent back to ${esc(f.ctx&&f.ctx.initiator?f.ctx.initiator.name:"the initiator")}</span>`;
  return c?`<span class="chip chip-amber"><span class="chip-dot"></span>Awaiting ${esc(nameOf(c.role))} (${esc(roleLabel(c.role))}) — switch role to act</span>`:""; }
function activate(f){
  const next=f.steps.find(s=>s.status==="pending");
  if(!next) return complete(f);
  next.status="current";
  f.steps.forEach(s=>{ if(s.status==="pending"&&s.system===undefined) s.system=false; });
  if(next.system) return complete(f);
  const humans=f.steps.filter(s=>!s.system), pos=humans.indexOf(next);
  notify(next.role,{type:"approval-pending",title:`${(f.ctx&&f.ctx.verb)||VERB[f.kind]||"Approve"} — ${f.entity}`,meta:`${KIND[f.kind]||f.kind} • ${next.label} • from ${f.ctx&&f.ctx.initiator?f.ctx.initiator.name:"—"}`,
    wf:f.wf,open:f.ctx&&f.ctx.open,flowId:f.id,due:humans.length>2&&pos>1?"Due in 2d":"Due in 1d",dueDays:1,entity:f.entity});
}
function start(o){
  const init=o.initiator||me();
  const steps=[{role:init.role,label:o.initLabel||"Initiated / submitted",status:"done",actor:init.name,decisionDate:T0,comment:o.initComment||null}].concat(o.steps.map(s=>({role:s.role,label:s.label,status:"pending",system:!!s.system})));
  const f=ApprovalEngine.create(o.kind,o.entity,steps,{wf:o.wf});
  f.steps.forEach((s,i)=>{ s.system=!!steps[i].system; });
  f.status="open"; f.ctx={record:o.record||null,open:o.open||null,hooks:o.hooks||{},initiator:init,verb:o.verb||null,meta:o.meta||null};
  (o.preDone||[]).forEach((d,i)=>{ const st=f.steps[i+1]; if(st&&d){ st.status="done"; st.actor=d.actor||nameOf(st.role); st.decisionDate=d.date||T0; st.comment=d.comment||"Approved"; } });
  if(o.silent){ f.steps.forEach(st=>{ if(st.status!=="done"){ st.status="done"; st.actor=st.system?"System":nameOf(st.role); st.decisionDate=T0; st.comment=st.system?"Applied":"Approved"; } }); f.status="approved"; return f; }
  activate(f); if(!o.quiet) Store.audit("Approval ["+f.kind+"]","submitted for approval",f.wf+" • "+f.entity);
  refresh(); return f;
}
function sync(f,step,decision,comment){ const h=f.ctx&&f.ctx.hooks; if(h&&h.onStep){ try{ h.onStep(f,step,decision,comment); }catch(e){ console.error(e); } } }
function complete(f){
  const sys=f.steps.find(s=>s.system&&s.status!=="done");
  if(sys){ sys.status="done"; sys.actor="System"; sys.decisionDate=T0; sys.comment=sys.comment||"Applied"; }
  f.status="approved"; closeTasks(f.wf);
  let res=null; const h=f.ctx&&f.ctx.hooks; if(h&&h.onApproved){ try{ res=h.onApproved(f); }catch(e){ console.error(e); } }
  const ini=f.ctx&&f.ctx.initiator;
  if(ini&&!(res&&res.noInitiatorNote)) notify(ini.role,{type:"approval-result",title:`${KIND[f.kind]||f.kind} approved — ${f.entity}`,meta:(res&&res.text)||"All approval steps cleared; the record has been updated.",wf:f.wf,open:f.ctx.open,flowId:f.id,due:"FYI",dueDays:5,entity:f.entity});
  Store.audit("Approval ["+f.kind+"]","approved & applied",f.wf);
  refresh();
}
function reject(f,cur,comment,actor){
  cur.status="rejected"; cur.actor=actor.name; cur.decisionDate=T0; cur.comment=comment||"Returned for rework";
  f.status="rejected"; closeTasks(f.wf);
  const h=f.ctx&&f.ctx.hooks; if(h&&h.onRejected){ try{ h.onRejected(f,cur.comment); }catch(e){ console.error(e); } }
  const ini=f.ctx&&f.ctx.initiator;
  if(ini) notify(ini.role,{type:"rejection-follow-up",title:`Rework rejected ${(KIND[f.kind]||f.kind).toLowerCase()} — ${f.entity}`,meta:`${f.wf} • rejected by ${actor.name} (${cur.label}) — “${cur.comment}”`,wf:f.wf,open:f.ctx.open,flowId:f.id,due:"Due in 2d",dueDays:2,entity:f.entity});
  Store.audit("Approval ["+f.kind+"]","rejected at "+cur.label,f.wf+" • "+cur.comment);
  Toast.show(`${f.wf} rejected at ${cur.label}. ${ini?ini.name+" has a rework task.":""}`,"warn");
  refresh();
}
function decide(f,decision,comment){
  if(typeof f==="string") f=ApprovalEngine.flows.find(x=>x.id===f); if(!f) return;
  const cur=f.steps.find(s=>s.status==="current");
  if(!cur||!live(f)){ const by=f.steps.filter(x=>x.status==="done"||x.status==="rejected").slice(-1)[0];
    return Toast.show(`${f.wf} is already ${f.status==="rejected"?"rejected":"approved and applied"}${by&&by.actor?" (last step by "+by.actor+")":""} — nothing more to approve here.`,"info"); }
  if(!canAct(f)) return Toast.show(`This step belongs to ${roleLabel(cur.role)} (${nameOf(cur.role)}) — switch role to act.`,"warn");
  const actor=me();
  if(decision==="reject"){ reject(f,cur,comment,actor); sync(f,cur,"reject",comment); return rerender(); }
  cur.status="done"; cur.actor=actor.name; cur.decisionDate=T0; cur.comment=comment||"Approved";
  closeTasks(f.wf,t=>t.owner===cur.role||RBAC.role==="admin");
  Store.audit("Approval ["+f.kind+"]","approved step "+cur.order+" ("+cur.label+")",f.wf);
  const next=f.steps.find(s=>s.status==="pending");
  activate(f); sync(f,cur,"approve",comment);
  if(next&&!next.system) Toast.show(`${cur.label} approved by ${actor.name}. Routed to ${nameOf(next.role)} (${roleLabel(next.role)}) — task and notification sent.`,"success");
  rerender();
}
function rerender(){ refresh(); try{ Router.render(); }catch(e){} }

/* ------------------------------------------------------------ the engine's own screen + act() now run through decide() */
let idSeq=0; function fixIds(){ const seen=new Set(); ApprovalEngine.flows.forEach(f=>{ const n=+String(f.id).replace(/\D/g,"")||0; if(n>idSeq) idSeq=n; });
  ApprovalEngine.flows.forEach(f=>{ if(seen.has(f.id)) f.id="F"+(++idSeq); seen.add(f.id); }); }
fixIds();
const _create=ApprovalEngine.create.bind(ApprovalEngine);
ApprovalEngine.create=function(){ const f=_create.apply(null,arguments); fixIds(); if(ApprovalEngine.flows.filter(x=>x.id===f.id).length>1) f.id="F"+(++idSeq); return f; };
const _cur=ApprovalEngine.currentStep.bind(ApprovalEngine);
ApprovalEngine.currentStep=function(f){ return f.status==="rejected"||f.status==="approved"?null:_cur(f); };
ApprovalEngine.act=function(fId,decision,comment){ decide(fId,decision,comment); };
function sortedFlows(){ const rank=f=>f.status==="rejected"||f.status==="approved"?2:canAct(f)?0:1; return ApprovalEngine.flows.map((f,i)=>({f,i})).sort((a,b)=>rank(a.f)-rank(b.f)||b.i-a.i).map(x=>x.f); }

/* ------------------------------------------------------------ change requests */
function crSteps(cr){ return [{role:"approver",label:"Approver review"}].concat(cr.highValue?[{role:"pm",label:"Management sign-off (high value / business share)"}]:[]).concat([{role:"admin",label:"Applied & Approval Note circulated",system:true}]); }
function crHooks(cr){
  return {onStep:(f)=>{ if(f.status==="rejected") return; const c=f.steps.find(s=>s.status==="current"); cr.done=c?f.steps.indexOf(c):99; },
    onApproved:()=>{ window.__applyCR(cr); return {text:`Record updated${cr.forcesCbd?" (CBD re-rolled, new price version)":""}; Approval Note issued to ${cr.supplier} and circulation (${cr.circulation.join(", ")}).`}; },
    onRejected:(f,c)=>{ cr.status="Rejected"; DATA.approvalNotes.unshift({when:now(),kind:"Rejection",ref:cr.wf,text:`${cr.type} change "${cr.subject}" rejected — ${c}`}); }};
}
const crOpen=cr=>({module:"procurement",screen:"change-requests",act:"cr",id:cr.id});
function startCR(cr){
  const f=start({kind:"change-request",wf:cr.wf,entity:`${cr.subject} (${cr.type} change)`,record:cr,initiator:{role:RBAC.role,name:cr.initiatedBy},steps:crSteps(cr),open:crOpen(cr),
    initComment:cr.type==="price"?`₹${fmt(cr.value)} → ₹${fmt(cr.newValue)}`:cr.type,hooks:crHooks(cr)});
  cr.flowId=f.id; cr.done=1;
  Toast.show(`${cr.wf} created and sent for approval to ${nameOf("approver")} (Approver)${cr.highValue?`, then Management sign-off by ${nameOf("pm")}`:""}. They have been notified — switch role to act.`,"success");
  return f;
}
function crFlow(cr){
  let f=ApprovalEngine.flows.find(x=>x.id===cr.flowId||x.wf===cr.wf);
  if(f){ cr.flowId=f.id; return f; }
  /* a request that pre-dates the engine: rebuild its flow from the stored state */
  const steps=crSteps(cr), init={role:"buyer",name:cr.initiatedBy};
  f=ApprovalEngine.create("change-request",`${cr.subject} (${cr.type} change)`,[{role:init.role,label:"Initiated / submitted",status:"done",actor:init.name,decisionDate:T0}].concat(steps.map(s=>({role:s.role,label:s.label,status:"pending"}))),{wf:cr.wf});
  f.steps.forEach((s,i)=>{ s.system=i>0&&!!steps[i-1].system; });
  f.ctx={record:cr,open:crOpen(cr),hooks:crHooks(cr),initiator:init};
  if(cr.status==="Approved"){ f.status="approved"; f.steps.forEach(s=>{ if(s.status!=="done"){ s.status="done"; s.actor=s.system?"System":nameOf(s.role); s.decisionDate=T0; } }); }
  else if(cr.status==="Rejected"){ f.status="rejected"; const i=Math.min(f.steps.length-1,Math.max(1,cr.done||1)); f.steps[i].status="rejected"; }
  else { f.status="open"; const idx=Math.min(f.steps.length-1,Math.max(1,cr.done||1)); for(let i=1;i<idx;i++){ f.steps[i].status="done"; f.steps[i].actor=nameOf(f.steps[i].role); f.steps[i].decisionDate=T0; } f.steps[idx].status="current"; }
  cr.flowId=f.id; return f;
}
function drawerRows(rows){ return `<div>${rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100);gap:12px;"><span class="text-muted">${k}</span><b style="text-align:right;">${v}</b></div>`).join("")}</div>`; }
function decisionFooter(f,after){
  const foot=document.querySelector("#drawer .drawer-footer"); foot.style.display="flex"; foot.style.flexWrap="wrap"; foot.innerHTML="";
  const close=document.createElement("button"); close.className="btn"; close.textContent="Close"; close.onclick=()=>Drawer.close();
  if(canAct(f)){
    const cur=f.steps.find(s=>s.status==="current"), next=f.steps.filter(s=>s.status==="pending")[0], more=next&&!next.system;
    const c=document.createElement("input"); c.type="text"; c.placeholder="Decision comment…"; c.style.cssText="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--gray-200);border-radius:8px;";
    const rj=document.createElement("button"); rj.className="btn"; rj.textContent="Reject"; rj.onclick=()=>{ Drawer.close(); decide(f,"reject",c.value); };
    const ok=document.createElement("button"); ok.className="btn btn-primary"; ok.textContent=more?`Approve (→ ${roleLabel(next.role)})`:"Approve & apply"; ok.onclick=()=>{ Drawer.close(); decide(f,"approve",c.value); };
    foot.appendChild(c); foot.appendChild(rj); foot.appendChild(ok);
  } else { const w=document.createElement("span"); w.style.marginRight="auto"; w.innerHTML=awaitingHtml(f); foot.appendChild(w); foot.appendChild(close); }
}
function reviewCR(cr){
  if(!cr) return; const f=crFlow(cr);
  const body=drawerRows([["Type",cr.type],["Subject",esc(cr.subject)],["Supplier",esc(cr.supplier)],["Workflow no.",cr.wf],["AEKO no.",cr.aeko||"—"],
    ["Price",cr.type==="price"?`₹${fmt(cr.value)} → ₹${fmt(cr.newValue)}`:"—"],["Forces CBD update",cr.forcesCbd?"Yes":"No"],["Documents",cr.docs.join(", ")],
    ["Routing",cr.highValue?"Approver → Management":"Approver"],["Circulation",cr.circulation.join(", ")],["Initiated by",esc(cr.initiatedBy)]])+
    `<div style="margin:14px 0 6px;font-size:12px;font-weight:700;color:var(--gray-600);">Approval timeline</div><div id="cr-tl"></div>`;
  Drawer.open(cr.subject,body,null);
  document.getElementById("cr-tl").appendChild(Components.approvalTimeline(ApprovalEngine.timelineSteps(f)));
  decisionFooter(f);
}

/* ------------------------------------------------------------ commodity / FX changes */
function startCommodity(ap){
  const isC=ap.kind==="commodity", init={role:RBAC.role,name:ap.submittedBy};
  const steps=[{role:"approver",label:"Approver review"}].concat(ap.highValue?[{role:"pm",label:"Management sign-off (move of 5% or more)"}]:[]).concat([{role:"admin",label:isC?"Applied + CBD auto-recalc":"Applied + CBD / FX auto-recalc",system:true}]);
  const f=start({kind:isC?"commodity-price":"fx-rate",wf:ap.wf,entity:`${ap.label} → ${fmt(ap.newValue)}`,record:ap,initiator:init,steps,open:{module:"procurement",screen:"commodity",act:"cf",id:ap.id},initComment:`${fmt(ap.oldValue)} → ${fmt(ap.newValue)}`,
    hooks:{onStep:(fl)=>{ if(fl.status==="rejected") return; const c=fl.steps.find(s=>s.status==="current"); ap.done=c?fl.steps.indexOf(c):99; ap.stage=c?c.label:"Applied"; },
      onApproved:()=>{ window.__applyCommodity(ap); return {text:`New ${isC?"price":"rate"} ${fmt(ap.newValue)} effective ${ap.effectiveFrom}; ${(ap.recalculated||[]).length} dependent CBD(s) recalculated.`}; },
      onRejected:(fl,c)=>{ ap.status="Rejected"; ap.stage="Rejected"; DATA.approvalNotes.unshift({when:now(),kind:"Rejection",ref:ap.wf,text:`${ap.label} change to ${ap.newValue} rejected — ${c}`}); }}});
  ap.flowId=f.id; ap.done=1;
  Toast.show(`${ap.wf} submitted and sent for approval to ${nameOf("approver")} (Approver)${ap.highValue?`, then Management sign-off by ${nameOf("pm")} (move of ${ap.movePct.toFixed(1)}%)`:""}. They have been notified.`,"success");
  return f;
}
function commodityView(){
  const holder=document.createElement("div");
  if(!DATA.commodityApprovals.length){ holder.appendChild(Components.el(`<div class="coming-soon"><div class="cs-icon">📄</div><div class="cs-title">No commodity / FX changes yet</div><div class="text-muted">Submit a change from the Prices & Rates tab to start an approval.</div></div>`)); return holder; }
  DATA.commodityApprovals.forEach(ap=>{
    const f=ApprovalEngine.flows.find(x=>x.id===ap.flowId||x.wf===ap.wf); const chip=ap.status==="Approved"?Components.chip("Approved"):ap.status==="Rejected"?Components.chip("Rejected"):Components.chip("Pending");
    const p=document.createElement("div"); p.className="panel"; p.style.marginBottom="14px";
    p.innerHTML=`<div class="panel-header"><h3>${ap.kind==="commodity"&&ap.label.toLowerCase().includes("steel")?"🔵 ":""}${esc(ap.label)} ${Components.wfChip(ap.wf)}</h3><span>${chip}</span></div>`;
    const body=document.createElement("div"); body.className="panel-body"; const move=ap.newValue-ap.oldValue, mp=ap.movePct||0;
    const grid=document.createElement("div"); grid.className="grid grid-2";
    grid.innerHTML=`<div>${[["Type",ap.kind==="commodity"?"Commodity price":"FX rate"],["Current",fmt(ap.oldValue)],["Proposed",`<b>${fmt(ap.newValue)}</b>`],["Move",`<span class="chip ${move>0?"chip-red":"chip-green"}"><span class="chip-dot"></span>${move>=0?"+":""}${fmt(move)} (${mp.toFixed(1)}%)</span>`],["Effective from",ap.effectiveFrom],["Source",esc(ap.source)],["Routing",ap.highValue?"Approver → Management (high move)":"Approver"],["Submitted by",esc(ap.submittedBy)]].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--gray-100);"><span class="text-muted">${k}</span><span>${v}</span></div>`).join("")}</div>`;
    const tl=document.createElement("div"); tl.innerHTML=`<div class="text-muted" style="font-size:12px;margin-bottom:8px;">Approval timeline</div>`; if(f) tl.appendChild(Components.approvalTimeline(ApprovalEngine.timelineSteps(f))); grid.appendChild(tl); body.appendChild(grid);
    if(ap.status==="Approved"&&ap.recalculated&&ap.recalculated.length) body.appendChild(Components.el(`<div class="panel" style="border-left:4px solid var(--green);margin-top:12px;"><div class="panel-body" style="display:flex;gap:10px;align-items:center;"><span style="font-size:18px;">🔄</span><div><b>Auto-recalculated:</b> <span class="text-muted">${ap.recalculated.map(esc).join(", ")} — material cost & risk figures refreshed.</span></div></div></div>`));
    if(f&&ap.status==="Pending"){
      const act=document.createElement("div"); act.style.cssText="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:14px;flex-wrap:wrap;";
      if(canAct(f)){ const next=f.steps.filter(s=>s.status==="pending")[0], more=next&&!next.system;
        act.innerHTML=`<input class="ap-c" type="text" placeholder="Decision comment…" style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--gray-200);border-radius:8px;"><button class="btn ap-r">Reject</button><button class="btn btn-primary ap-a">${more?"Approve (→ "+esc(roleLabel(next.role))+")":"Approve & apply"}</button>`;
        act.querySelector(".ap-a").onclick=()=>decide(f,"approve",act.querySelector(".ap-c").value); act.querySelector(".ap-r").onclick=()=>decide(f,"reject",act.querySelector(".ap-c").value);
      } else act.innerHTML=awaitingHtml(f);
      body.appendChild(act);
    }
    p.appendChild(body); holder.appendChild(p);
  });
  return holder;
}

/* ------------------------------------------------------------ opening whatever a task points at */
function homeModule(){ return ["procurement","techchange","srm"].includes(Router.module)?Router.module:"procurement"; }
function openTask(t){
  if(typeof t==="string") t=TaskCentre.tasks.find(x=>x.id===t); if(!t) return;
  const o=t.open;
  if(!o){ const f=ApprovalEngine.flows.find(x=>x.wf===t.wf); Router.go("approvals",homeModule()); return; }
  if(o.act==="cf"&&window.__setCfTab) window.__setCfTab("approvals");
  if(o.act==="tc"&&window.V8TC) window.V8TC.focus(o.id);
  Router.go(o.screen,o.module);
  if(o.act==="cr") setTimeout(()=>reviewCR(DATA.changeRequests.find(c=>c.id===o.id)),80);
}
function openByWf(wf){ const t=TaskCentre.tasks.find(x=>x.wf===wf&&x.state==="open"&&(x.owner===RBAC.role||RBAC.role==="admin")); if(t) openTask(t); else Router.go("approvals",homeModule()); }
Components.taskCard=function(t){
  const el=Components.el(`<div class="task-card"><div class="task-icon">${t.icon}</div><div class="task-body"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span>${esc(t.meta)}</span><span>•</span><span>${Components.wfChip(t.wf)}</span><span>•</span><span>${(t.due||"").includes("Overdue")?Components.chip("Overdue"):(/today|tomorrow|1d/.test(t.due||"")?Components.chip("Due"):esc(t.due||""))}</span></div></div><div class="task-action"><button class="btn btn-sm ${t.type==="approval-pending"?"btn-primary":""}">${t.type==="approval-pending"?"Review":"Open"}</button></div></div>`);
  el.querySelector("button").onclick=()=>{ UI.toggleNotifPanel&&document.getElementById("notif-panel").classList.contains("show")&&UI.toggleNotifPanel(); openTask(t); };
  return el;
};

/* ------------------------------------------------------------ legacy task writers (sourcing import, EBON reminder ...) now reach the notification centre too */
function bridge(t){
  const title=String(t.title||""), type=/^approve|^sign/i.test(title)?"approval-pending":/^fill|^update/i.test(title)?"fill-details":"reminder";
  const m=String(t.due||"").match(/(\d+)\s*d/); const dd=/overdue/i.test(t.due||"")?-(m?+m[1]:1):/today/i.test(t.due||"")?0:/tomorrow/i.test(t.due||"")?1:m?+m[1]:3;
  const tt=(window.TASK_TYPES||{})[type]||{icon:"🔔",label:"Notification"};
  TaskCentre.tasks.unshift({id:"TL"+(++seq),state:"open",reminders:0,icon:t.icon||tt.icon,escalationTarget:null,type,owner:t.role,entity:title,wf:t.wf||"—",due:t.due||"Due in 3d",dueDays:dd,cadence:"On event",title,meta:t.meta||"",open:null,created:now()});
  TaskCentre.emailLog.unshift({when:now(),to:t.role,subj:"["+(t.wf||"—")+"] "+tt.label+" — "+title,opened:false});
}
(function(){ const a=DATA.tasks; ["unshift","push"].forEach(k=>{ const o=a[k]; a[k]=function(){ [].slice.call(arguments).forEach(x=>{ try{ bridge(x); }catch(e){ console.error(e); } }); refresh(); return o.apply(this,arguments); }; }); })();

/* ------------------------------------------------------------ seeds: every open item has a task for the role that must act */
function seedCommodityRecord(f){
  if(DATA.commodityApprovals.some(a=>a.wf===f.wf)) return;
  const rec=DATA.commodities.find(c=>/steel/i.test(c.name)); if(!rec) return;
  const cur=Store.currentValue(rec)||0, m=String(f.entity).match(/(\d+(?:\.\d+)?)/), nv=m&&+m[1]>0?+m[1]:Math.round(cur*1.04*100)/100, mp=cur?Math.abs((nv-cur)/cur*100):0, hv=mp>=5, ap={id:"AP"+(DATA.commodityApprovals.length+1),wf:f.wf,kind:"commodity",targetId:rec.id,label:rec.name,oldValue:cur,newValue:nv,movePct:mp,effectiveFrom:"2026-08-01",source:"Index",status:"Pending",stage:"Approver review",highValue:hv,done:1,submittedBy:(f.steps[0]||{}).actor||"T. Rao",flowId:f.id};
  DATA.commodityApprovals.push(ap); f.entity=`${rec.name} → ${fmt(nv)}`;
  if(hv&&!f.steps.some(s=>s.role==="pm")){ const sys=f.steps.findIndex(s=>s.system); f.steps.splice(sys<0?f.steps.length:sys,0,{order:0,role:"pm",label:"Management sign-off (move of 5% or more)",status:"pending",actor:null,decisionDate:null,comment:null,system:false}); f.steps.forEach((s,i)=>{ s.order=i+1; }); }
  f.ctx.record=ap; f.ctx.open={module:"procurement",screen:"commodity",act:"cf",id:ap.id};
  f.ctx.hooks={onStep:(fl)=>{ if(fl.status==="rejected") return; const c=fl.steps.find(s=>s.status==="current"); ap.done=c?fl.steps.indexOf(c):99; ap.stage=c?c.label:"Applied"; },
    onApproved:()=>{ window.__applyCommodity(ap); return {text:`New price ${fmt(ap.newValue)} effective ${ap.effectiveFrom}; ${(ap.recalculated||[]).length} dependent CBD(s) recalculated.`}; },
    onRejected:(fl,c)=>{ ap.status="Rejected"; ap.stage="Rejected"; DATA.approvalNotes.unshift({when:now(),kind:"Rejection",ref:ap.wf,text:`${ap.label} change to ${ap.newValue} rejected — ${c}`}); }};
}
function reconcile(){
  DATA.changeRequests.forEach(cr=>{ const f=crFlow(cr); if(f.status==="open"||f.status===undefined){ const c=f.steps.find(s=>s.status==="current"); if(c&&!c.system&&!TaskCentre.tasks.some(t=>t.state==="open"&&t.wf===f.wf&&t.owner===c.role&&t.type==="approval-pending"))
      notify(c.role,{type:"approval-pending",title:`Approve change request — ${cr.subject}`,meta:`${KIND["change-request"]} • ${c.label} • from ${cr.initiatedBy}`,wf:f.wf,open:crOpen(cr),flowId:f.id,due:"Due in 1d",dueDays:1,entity:cr.subject}); } });
  ApprovalEngine.flows.forEach(f=>{ if(f.status===undefined) f.status="open"; if(!f.ctx) f.ctx={record:null,open:null,hooks:{},initiator:{role:(f.steps[0]||{}).role||"buyer",name:(f.steps[0]||{}).actor||nameOf((f.steps[0]||{}).role)}};
    f.steps.forEach(s=>{ if(s.system===undefined) s.system=/^applied|^implementation released/i.test(s.label); });
    if(f.kind==="commodity-price"&&live(f)) seedCommodityRecord(f);
    const c=f.steps.find(s=>s.status==="current"); if(c&&!c.system&&live(f)&&!TaskCentre.tasks.some(t=>t.state==="open"&&t.wf===f.wf&&t.owner===c.role&&t.type==="approval-pending"))
      notify(c.role,{type:"approval-pending",title:`${VERB[f.kind]||"Approve"} — ${f.entity}`,meta:`${KIND[f.kind]||f.kind} • ${c.label}`,wf:f.wf,open:f.ctx.open,flowId:f.id,due:"Due today",dueDays:0,entity:f.entity}); });
}
function dropContradictions(){ TaskCentre.tasks.forEach(t=>{ if(t.state==="open"&&t.type==="rejection-follow-up"&&ApprovalEngine.flows.some(f=>f.wf===t.wf&&live(f))) t.state="done"; }); }
function summaryStrip(){
  const fl=ApprovalEngine.flows, wait=fl.filter(canAct).length, flight=fl.filter(live).length, done=fl.length-flight;
  return Components.el(`<div class="fc-note ${wait?"info":""}" style="margin-bottom:14px"><b>${wait?wait+" waiting for you":"Nothing waiting for you"}</b> as ${esc(roleLabel(RBAC.role))} · ${flight} in flight · ${done} completed. Each step is owned by a role — switch role (top bar) to act as the next approver; every step creates a task, a notification and an audit entry.</div>`);
}
(function(){ ["procurement","techchange","srm"].forEach(m=>{ const b=SCREENS[m]&&SCREENS[m].approvals; if(!b) return; SCREENS[m].approvals=function(){ const w=b(); const h=w.querySelector(".page-header"); if(h) h.after(summaryStrip()); return w; }; }); })();
(function(){ const o=Drawer.open; Drawer.open=function(){ const ft=document.querySelector("#drawer .drawer-footer"); if(ft){ ft.style.cssText=""; ft.innerHTML='<button class="btn" onclick="Drawer.close()">Cancel</button><button class="btn btn-primary" onclick="Drawer.save()">Save</button>'; } return o.apply(Drawer,arguments); }; })();
const _sr=RBAC.setRole.bind(RBAC);
RBAC.setRole=function(r){ _sr(r); refresh(); const n=mine().filter(t=>t.type==="approval-pending").length; if(n) Toast.show(`${n} approval${n===1?"":"s"} waiting for you — see 🔔 Notifications or Approvals.`,"info"); };
reconcile(); dropContradictions(); refresh();

/* change-request form: the "current price" is the part's latest recorded price, not something to type */
function currentPrice(pn){ const v=DATA.priceVersions[pn]; if(v&&v.length) return v[v.length-1].price; const p=window.PocCore&&PocCore.part?PocCore.part(pn):null; return p?p.cur:null; }
function prefillCurrent(pn){
  const el=document.getElementById("cr-cur"); if(!el) return;
  const price=pn&&pn!=="__other"?currentPrice(pn):null;
  if(price==null){ if(el.readOnly) el.value=""; el.readOnly=false; el.style.background=""; el.title=""; return; }
  el.value=String(Math.round(price*100)/100); el.readOnly=true; el.style.background="var(--raise)"; el.title="Current price on record (latest price version)";
}

return {prefillCurrent,fixIds,notify,closeTasks,start,decide,canAct,awaitingHtml,startCR,reviewCR,startCommodity,commodityView,openTask,openByWf,sortedFlows,mine,nameOf,roleLabel,reconcile,KIND};
})();
