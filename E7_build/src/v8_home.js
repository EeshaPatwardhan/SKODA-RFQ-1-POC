/* =====================================================================
   V8  ·  Home / My Tasks — what needs you today, then how the platform is doing
   Replaces the E6 task list on Home (the full Task & Notification Centre screen is unchanged and linked from here).
   Nothing is invented: tasks are TaskCentre, approvals are the ApprovalEngine flows, forecast figures are PocCore, milestone
   figures are the SRM model (SrmData), technical changes are DATA.changes, freshness is DATA.freshness, activity is DATA.auditLog.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, S=SrmData, esc=C.esc;
const T0=(typeof TODAY!=="undefined"?TODAY:"2026-07-29");
const ST={tab:"all",q:"",all:false}, CAP=12;

/* ------------------------------------------------------------ task vocabulary */
const TYPE={
  "approval-pending":{ic:"check-circle",act:"Review",tab:"approvals"},
  "fill-details":{ic:"edit",act:"Fill in",tab:"fill"},
  "rejection-follow-up":{ic:"undo",act:"Rework",tab:"fill"},
  "milestone-alert":{ic:"flag",act:"View",tab:"alerts"},
  "escalation":{ic:"alert",act:"Resolve",tab:"alerts"},
  "reminder":{ic:"clock",act:"Open",tab:"reminders"},
  "approval-result":{ic:"mail",act:"Open",tab:"reminders"}
};
const TABS=[["all","All"],["approvals","Approvals"],["fill","To fill in"],["alerts","Alerts & escalations"],["reminders","Reminders & FYI"]];
const GROUPS=[
  ["over","Overdue",t=>t.dueDays<0,"bad"],
  ["soon","Today & tomorrow",t=>t.dueDays>=0&&t.dueDays<=1,"warn"],
  ["week","Next 7 days",t=>t.dueDays>=2&&t.dueDays<=7,""],
  ["later","Later",t=>t.dueDays>7,""]
];
const tabOf=t=>(TYPE[t.type]||{}).tab||"reminders";
const isEsc=t=>t.reminders>=4||t.type==="escalation";
const roleLabel=r=>(ROLES.find(x=>x.id===r)||{}).label||r;
const typeLabel=t=>((window.TASK_TYPES||{})[t.type]||{}).label||"Task";
const mineNow=()=>TaskCentre.forRole(RBAC.role);
const nav=(screen,mod)=>`data-nav="${screen}|${mod}"`;
const ic=n=>Icons.svg(n);
const modOk=m=>(MODULE_ACCESS[RBAC.role]||[]).includes(m);
const homeMod=()=>["procurement","techchange","srm"].includes(Router.module)?Router.module:"procurement";

/* where a task without its own link should take the person (by workflow number / wording) */
function target(t){
  if(t.open){ Flow.openTask(t); return; }
  const w=String(t.wf||""), ti=String(t.title||""); let r=null;
  if(/^SRC-/.test(w)) r=["procurement",/cbd/i.test(ti)?"cbd-weights":"sourcing-records"];
  else if(/^CMD-/.test(w)) r=["procurement","commodity"];
  else if(/^CR-/.test(w)) r=["procurement","change-requests"];
  else if(/^INV-/.test(w)) r=["procurement","investment"];
  else if(/^PRJ-/.test(w)) r=["procurement","masters-hub"];
  else if(/^GEO-/.test(w)) r=["procurement","fc-geo"];
  else if(/^FCT-/.test(w)) r=["procurement","fc-outlook"];
  else if(/^(AEKO|AWE|AEA)-/.test(w)) r=["techchange","change-dashboard"];
  else if(/^(SRM|AMD)-/.test(w)) r=["srm",/tooling/i.test(ti)?"tool-readiness":/milestone|escalat/i.test(ti)?"alerts-escalations":"milestone-tracking"];
  else if(/^ADM-/.test(w)) r=["admin","rbac-matrix"];
  if(r&&modOk(r[0])) Router.go(r[1],r[0]); else Flow.openTask(t);
}

/* ------------------------------------------------------------ pieces */
const kc=o=>`<div class="pd-kpi kpi-link" ${o.scroll?`data-scroll="${o.scroll}"`:`data-tab="${o.tab}"`} role="button" tabindex="0" title="${esc(o.tip||"")}"><div class="top"><span class="ic">${ic(o.icon)}</span><span class="lb">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span></div><div class="sb">${o.sub}</div></div>`;

function row(t){
  const ty=TYPE[t.type]||{ic:"bell",act:"Open"}, tone=t.dueDays<0?"bad":t.dueDays<=1?"warn":"";
  const primary=t.type==="approval-pending"||t.type==="escalation"||t.type==="rejection-follow-up";
  return `<div class="hm-row ${tone}" data-id="${esc(t.id)}" tabindex="0"><span class="hm-ic">${ic(ty.ic)}</span>
    <div class="hm-bd"><div class="hm-t">${esc(t.title)}</div>
      <div class="hm-m"><span class="hm-ty">${esc(typeLabel(t))}</span>${t.meta?`<span class="hm-sep">·</span><span class="hm-meta">${esc(t.meta)}</span>`:""}<span class="hm-sep">·</span>${Components.wfChip(t.wf)}${isEsc(t)?`<span class="chip chip-red"><span class="chip-dot"></span>→ ${esc(t.escalationTarget||"Head")}</span>`:""}</div></div>
    <span class="hm-due ${tone}" title="${esc(t.cadence?"Cadence: "+t.cadence:"")}">${ic(tone==="bad"?"alert":"calendar")}${esc(t.due||"")}</span>
    <div class="hm-ac"><button type="button" class="btn btn-sm ${primary?"btn-primary":""}" data-go="${esc(t.id)}">${ty.act}</button><button type="button" class="hm-done" data-done="${esc(t.id)}" title="Mark as done" aria-label="Mark as done">${ic("check")}</button></div></div>`;
}

function listBody(){
  const q=ST.q.trim().toLowerCase();
  let list=mineNow().filter(t=>ST.tab==="all"||tabOf(t)===ST.tab);
  if(q) list=list.filter(t=>(t.title+" "+t.meta+" "+t.wf+" "+t.entity).toLowerCase().includes(q));
  if(!list.length){
    const none=!mineNow().length;
    return `<div class="hm-empty">${ic(none?"check-circle":"search")}<b>${none?"You are all caught up":"Nothing matches"}</b><span>${none?"No open tasks for "+esc(roleLabel(RBAC.role))+". New approvals, reminders and alerts appear here.":"Try another tab or clear the search."}</span></div>`;
  }
  let left=ST.all?1e9:CAP;
  const html=GROUPS.map(([id,label,fn,tone])=>{
    const g=list.filter(fn).sort((a,b)=>a.dueDays-b.dueDays); if(!g.length||left<=0) return "";
    const show=g.slice(0,left); left-=show.length;
    return `<div class="hm-grp ${tone}"><div class="hm-gh"><span>${label}</span><b>${g.length}</b></div>${show.map(row).join("")}</div>`;
  }).join("");
  return html+(list.length>CAP?`<div class="hm-showall"><button type="button" class="btn btn-sm" data-showall="1">${ST.all?"Show fewer":"Show all "+list.length+" tasks"}</button></div>`:"");
}

/* the same approval tasks the KPI counts; a task that belongs to an ApprovalEngine flow also shows its steps */
function approvalsPanel(){
  const ts=mineNow().filter(t=>t.type==="approval-pending").sort((a,b)=>a.dueDays-b.dueDays), live=ApprovalEngine.flows.filter(f=>f.status!=="approved"&&f.status!=="rejected").length;
  const body=ts.length?ts.slice(0,5).map(t=>{
    const f=ApprovalEngine.flows.find(x=>x.wf===t.wf), hs=f?f.steps.filter(s=>!s.system):[], cur=hs.findIndex(s=>s.status==="current");
    return `<button type="button" class="hm-ap" data-go="${esc(t.id)}"><span class="hm-apt"><b>${esc(t.title)}</b><small>${esc(t.wf)}${f?" · "+esc(Flow.KIND[f.kind]||f.kind):""} · ${esc(t.due||"")}</small></span>
      ${hs.length?`<span class="hm-steps" title="Step ${cur+1} of ${hs.length}">${hs.map(s=>`<i class="${s.status==="done"?"d":s.status==="current"?"c":""}"></i>`).join("")}</span>`:""}<span class="hm-go">${ic("chevron-right")}</span></button>`;
  }).join("")+(ts.length>5?`<div class="hm-more">+ ${ts.length-5} more</div>`:"")
  :`<div class="hm-none">${ic("check-circle")}<span>Nothing is waiting for your sign-off.</span></div>`;
  return U.panel(`Waiting for your approval${ts.length?` <span class="count-pill">${ts.length}</span>`:""}`,body,{cls:"hm-side",sub:`${live} approval${live===1?"":"s"} in flight across the platform`,right:`<button type="button" class="btn btn-sm" ${nav("approvals",homeMod())}>All approvals</button>`});
}

function workloadPanel(list){
  const n=GROUPS.map(([id,label,fn,tone])=>({id,label,tone,n:list.filter(fn).length})), tot=list.length;
  const body=tot?`<div class="hm-stack" role="img" aria-label="Open tasks by due date">${n.map(g=>g.n?`<i class="${g.id}" style="flex:${g.n}" title="${g.label}: ${g.n}"></i>`:"").join("")}</div>
    <div class="hm-leg">${n.map(g=>`<span><i class="${g.id}"></i>${g.label}<b>${g.n}</b></span>`).join("")}</div>`
    :`<div class="hm-none">${ic("check-circle")}<span>No open tasks.</span></div>`;
  return U.panel("Workload by due date",body,{cls:"hm-side",sub:`${tot} open task${tot===1?"":"s"} as ${esc(roleLabel(RBAC.role))}`});
}

function digestPanel(){
  const d=TaskCentre.mondayDigest(RBAC.role); if(!d.length) return "";
  return U.panel(`Monday reminder list <span class="count-pill">${d.length}</span>`,d.slice(0,4).map(t=>`<div class="hm-dg"><span>${ic("clock")}</span><div><b>${esc(t.title)}</b><small>${esc(t.cadence)} · ${esc(t.wf)}${t.reminders>=4?` · <i class="bad">escalating to ${esc(t.escalationTarget||"Head")}</i>`:""}</small></div></div>`).join("")+(d.length>4?`<div class="hm-more">+ ${d.length-4} more</div>`:""),
    {cls:"hm-side",sub:`${d.length} reminder${d.length===1?"":"s"} merged into one e-mail every Monday`});
}

/* ------------------------------------------------------------ platform pulse */
function pulseProc(){
  const k=P.kpis(), top=P.ALERTS.slice(0,3);
  return U.panel("Procurement · price outlook",`<div class="hm-st3"><div><span>Cost per vehicle</span><b>${U.cr(k.basket.value)}</b><small>${U.sgn(k.basket.change,2)} vs last month</small></div><div><span>Forecast ${esc(k.forecast.to)}</span><b>${U.cr(k.forecast.value)}</b><small>${U.sgn(k.forecast.change,2)}</small></div><div><span>Cost at risk (&gt;5%)</span><b>${U.cr(k.atrisk.value)}</b><small>${k.atrisk.parts} parts</small></div></div>
    <div class="hm-lst">${top.map(a=>`<button type="button" class="hm-li" data-act="part:${esc(a.partId)}"><span class="n"><b>${esc(a.part?a.part.name:a.partId)}</b><small>${esc(a.part?a.part.progName+" · "+a.part.vendorName:a.title)}</small></span>${U.dirChip(a.change)}</button>`).join("")}</div>`,
    {cls:"hm-pulse",right:`<button type="button" class="btn btn-sm" ${nav("proc-overview","procurement")}>Dashboard</button>`});
}
function pulseSrm(){
  const m=V8Srm.model(), ev=S.evaluate(m), sm=S.summary(ev), al=S.ops.alerts(m,ev), over=al.filter(a=>a.level==="overdue").length, esc2=al.filter(a=>a.esc).length, am=S.ops.amendments(m,ev).filter(x=>x.status==="pending").length;
  const c=sm.counts, tot=(c.ok+c.risk+c.delayed+c.notstarted)||1;
  return U.panel("SRM · part readiness",`<div class="hm-st3"><div><span>Parts on track</span><b>${c.ok}</b><small>of ${sm.n} in scope</small></div><div><span>At risk / delayed</span><b class="${c.delayed?"bad":""}">${c.risk+c.delayed}</b><small>${c.delayed} delayed</small></div><div><span>Open alerts</span><b>${al.length}</b><small>${over} overdue · ${esc2} escalated</small></div></div>
    <div class="hm-stack slim" role="img" aria-label="Parts by milestone status">${[["ok",c.ok],["risk",c.risk],["delayed",c.delayed],["ns",c.notstarted]].map(([k,v])=>v?`<i class="${k}" style="flex:${v}"></i>`:"").join("")}</div>
    <div class="hm-leg sm"><span><i class="ok"></i>On track<b>${c.ok}</b></span><span><i class="risk"></i>At risk<b>${c.risk}</b></span><span><i class="delayed"></i>Delayed<b>${c.delayed}</b></span><span><i class="ns"></i>Not started<b>${c.notstarted}</b></span></div>
    <div class="hm-foot">${am?`<b>${am}</b> milestone amendment${am===1?"":"s"} waiting for approval`:"No milestone amendment waiting"}</div>`,
    {cls:"hm-pulse",right:`<button type="button" class="btn btn-sm" ${nav("srm-overview","srm")}>Overview</button>`});
}
function pulseTc(){
  const ch=DATA.changes||[], open=ch.filter(c=>c.status!=="Approved"), pend=ch.filter(c=>c.status==="Pending");
  const rows=open.slice(0,3).map(c=>`<button type="button" class="hm-li" ${nav("change-dashboard","techchange")}><span class="n"><b>${esc(c.part)}</b><small>${esc(c.type)} · ${esc(c.wf)} · ${esc(c.stage)}</small></span><span class="chip ${c.status==="Pending"?"chip-amber":"chip-blue"}"><span class="chip-dot"></span>${esc(c.status)}</span></button>`).join("");
  return U.panel("Technical change · pipeline",`<div class="hm-st3"><div><span>Open changes</span><b>${open.length}</b><small>of ${ch.length} in total</small></div><div><span>Awaiting approval</span><b>${pend.length}</b><small>in the approval chain</small></div><div><span>Approved</span><b>${ch.length-open.length}</b><small>ready to implement</small></div></div><div class="hm-lst">${rows||`<div class="hm-none"><span>No open technical change.</span></div>`}</div>`,
    {cls:"hm-pulse",right:`<button type="button" class="btn btn-sm" ${nav("change-dashboard","techchange")}>Dashboard</button>`});
}
const safe=(fn,name)=>{ try{ return fn(); }catch(e){ console.error("home "+name,e); return ""; } };

function freshnessPanel(){
  return U.panel("Data freshness",DATA.freshness.map(f=>`<div class="hm-fr"><span class="d">${ic("calendar")}</span><div><b>${esc(f.name)}</b><small>${esc(f.cadence)}${f.daysOverdue>0?" · "+f.daysOverdue+" days overdue":" · up to date"}</small></div>${Components.freshnessChip(f.daysOverdue)}</div>`).join(""),
    {cls:"hm-pulse",right:modOk("procurement")?`<button type="button" class="btn btn-sm" ${nav("freshness-board","procurement")}>Board</button>`:""});
}
function activityPanel(){
  const log=(DATA.auditLog||[]).slice(0,6);
  return U.panel("Recent activity",log.length?log.map(a=>`<div class="hm-ac2"><span class="d">${ic("history")}</span><div><b>${esc(a.entity)} · ${esc(a.action)}</b><small>${esc(a.ref||"")}</small></div><time>${esc(String(a.when||"").slice(11,16))}</time></div>`).join("")
      :`<div class="hm-none">${ic("history")}<span>Actions you take in this session — approvals, price changes, reminders — are listed here.</span></div>`,
    {cls:"hm-pulse",right:modOk("admin")?`<button type="button" class="btn btn-sm" ${nav("audit-logs","admin")}>Audit log</button>`:""});
}
function jumpPanel(){
  const L=[];
  if(modOk("procurement")){ L.push(["Procurement dashboard","bar-chart",nav("proc-overview","procurement")],["Forecast dashboard","trend-up",nav("fc-outlook","procurement")],["Material cost forecast","coins",nav("fc-material","procurement")]); }
  if(modOk("srm")) L.push(["SRM overview","gauge",nav("srm-overview","srm")],["Alerts & escalations","alert",nav("alerts-escalations","srm")]);
  if(modOk("techchange")) L.push(["Change dashboard","swap",nav("change-dashboard","techchange")]);
  L.push(["Approvals","check-circle",nav("approvals",homeMod())],["Ask AIS","sparkles",`data-act="ask:What needs my attention today?"`]);
  return U.panel("Jump to",`<div class="hm-jump">${L.map(([l,i,a])=>`<button type="button" class="hm-jb" ${a}><span>${ic(i)}</span>${esc(l)}</button>`).join("")}</div>`,{cls:"hm-pulse"});
}

/* ------------------------------------------------------------ page */
function build(){
  const wrap=document.createElement("div"); wrap.className="v8-page hm";
  const mine=mineNow(), over=mine.filter(t=>t.dueDays<0).length, today=mine.filter(t=>t.dueDays>=0&&t.dueDays<=1).length, soon=mine.filter(t=>t.dueDays>=0&&t.dueDays<=3).length;
  const apr=mine.filter(t=>t.type==="approval-pending").length, esc3=mine.filter(isEsc).length;
  const sub="";   // no summary sentence under the greeting
  const hd=Components.pageHeader("Home / My Tasks",sub);
  wrap.appendChild(hd);

  const k=document.createElement("div"); k.className="pd-kw";
  k.innerHTML=`<div class="pd-kpis k5">`+
    kc({tab:"all",icon:"bell",label:"Open tasks",value:mine.length,sub:esc(roleLabel(RBAC.role)),tip:"Show all open tasks"})+
    kc({tab:"all",icon:"alert",label:"Overdue",value:over,tone:over?"bad":"",sub:over?"past their due date":"nothing overdue",tip:"Jump to the overdue group"})+
    kc({tab:"approvals",icon:"check-circle",label:"Waiting for approval",value:apr,tone:apr?"":"",sub:apr?"your sign-off is needed":"nothing to sign off",tip:"Show approvals only"})+
    kc({tab:"alerts",icon:"flag",label:"Alerts & escalations",value:mine.filter(t=>tabOf(t)==="alerts").length,tone:esc3?"bad":"",sub:esc3?`${esc3} escalated`:"none escalated",tip:"Show alerts and escalations"})+
    kc({scroll:"hm-email",icon:"mail",label:"Email log",value:TaskCentre.emailLog.length,sub:"mirror of every task",tip:"Jump to the email log at the bottom of this page"})+
    `</div>`;
  wrap.appendChild(k);

  const main=document.createElement("div"); main.className="hm-mw"; wrap.appendChild(main);
  const grid=document.createElement("div"); grid.className="hm-main"; main.appendChild(grid);
  const left=document.createElement("div"); left.className="panel hm-work"; left.id="hm-work";
  left.innerHTML=`<div class="panel-header"><div class="ph-t"><h3>My work <span class="count-pill" id="hm-cnt">${mine.length}</span></h3><div class="ph-s">What needs you, most urgent first</div></div>
      <label class="hm-search">${ic("search")}<input type="search" id="hm-q" placeholder="Search tasks" value="${esc(ST.q)}" aria-label="Search tasks"></label></div>
    <div class="hm-tabs" role="tablist">${TABS.map(([id,l])=>`<button type="button" role="tab" class="hm-tab ${ST.tab===id?"on":""}" data-tab="${id}">${l}<b>${id==="all"?mine.length:mine.filter(t=>tabOf(t)===id).length}</b></button>`).join("")}</div>
    <div class="panel-body hm-list" id="hm-list">${listBody()}</div>`;
  grid.appendChild(left);
  const right=document.createElement("div"); right.className="hm-col";
  right.innerHTML=workloadPanel(mine)+approvalsPanel()+digestPanel(); grid.appendChild(right);

  /* what the old Task centre held beyond the task list: price outlook, geopolitical alerts for review, and the email log of every task */
  try{ const src=window.__tcSource&&window.__tcSource();
    if(src){ const pick=k=>[...src.querySelectorAll(".panel")].find(p=>{ const h=p.querySelector("h3"); return h&&h.innerText.trim().indexOf(k)===0; });
      const price=pick("Price outlook"), geo=pick("Geopolitical alerts"), mail=pick("Email log");
      if(price||geo){ const row=document.createElement("div"); row.className="hm-x"; [price,geo].forEach(p=>{ if(p) row.appendChild(p); }); wrap.appendChild(row); }
      if(mail){ mail.id="hm-email"; const m=document.createElement("div"); m.className="hm-x one"; m.appendChild(mail); wrap.appendChild(m); } }
  }catch(e){ console.error("home: task-centre panels",e); }
  /* the "Across the platform" section (platform pulse cards, data freshness, recent activity, jump-to) is no longer shown on Home */

  /* ---- behaviour */
  const list=wrap.querySelector("#hm-list"), cnt=wrap.querySelector("#hm-cnt");
  const redraw=()=>{ list.innerHTML=listBody(); wrap.querySelectorAll(".hm-tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===ST.tab)); };
  const setTab=(t,scroll)=>{ ST.tab=t; redraw(); if(scroll){ const el=wrap.querySelector("#hm-work"), cont=document.getElementById("content"); if(el&&cont) cont.scrollTo({top:Math.max(0,cont.scrollTop+el.getBoundingClientRect().top-cont.getBoundingClientRect().top-16),behavior:"smooth"}); } };
  const goTo=id=>{ const el=document.getElementById(id), cont=document.getElementById("content"); if(!el) return; if(cont) cont.scrollTo({top:Math.max(0,cont.scrollTop+el.getBoundingClientRect().top-cont.getBoundingClientRect().top-16),behavior:"smooth"}); else el.scrollIntoView({behavior:"smooth"}); el.classList.remove("pd-flash"); void el.offsetWidth; el.classList.add("pd-flash"); setTimeout(()=>el.classList.remove("pd-flash"),1800); };
  wrap.addEventListener("click",e=>{
    const sc=e.target.closest("[data-scroll]"); if(sc&&wrap.contains(sc)){ goTo(sc.dataset.scroll); return; }
    const t=e.target.closest("[data-tab]"); if(t&&wrap.contains(t)){ setTab(t.dataset.tab,!t.classList.contains("hm-tab")); return; }
    const n=e.target.closest("[data-nav]"); if(n){ const [s,m]=n.dataset.nav.split("|"); Router.go(s,m); return; }
    const w=e.target.closest("[data-wf]"); if(w){ Flow.openByWf(w.dataset.wf); return; }
    const sa=e.target.closest("[data-showall]"); if(sa){ ST.all=!ST.all; redraw(); return; }
    const d=e.target.closest("[data-done]"); if(d){ e.stopPropagation(); TaskCentre.markDone(d.dataset.done); Toast.show("Task marked done · audit entry written.","success"); return; }
    const gbtn=e.target.closest("[data-go]"); if(gbtn){ e.stopPropagation(); const x=TaskCentre.tasks.find(y=>y.id===gbtn.dataset.go); if(x) target(x); return; }
    const r=e.target.closest(".hm-row"); if(r&&list.contains(r)){ const x=TaskCentre.tasks.find(y=>y.id===r.dataset.id); if(x) target(x); }
  });
  wrap.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" ") return;
    const sc=e.target.closest("[data-scroll][role=button]"); if(sc){ e.preventDefault(); goTo(sc.dataset.scroll); return; }
    const t=e.target.closest("[data-tab][role=button]"); if(t){ e.preventDefault(); setTab(t.dataset.tab,true); return; }
    const r=e.target.closest(".hm-row"); if(r&&e.target===r){ e.preventDefault(); const x=TaskCentre.tasks.find(y=>y.id===r.dataset.id); if(x) target(x); }
  });
  wrap.querySelector("#hm-q").addEventListener("input",e=>{ ST.q=e.target.value; redraw(); });
  U.wire(wrap);
  return wrap;
}

/* Home → this page; the old E6 list stays reachable as the Task & Notification Centre (e7_integration wraps it) */
["procurement","techchange","srm","admin"].forEach(m=>{ if(SCREENS[m]) SCREENS[m].home=build; });
/* no separate Task centre in V8: no menu / search entry, and a stray link to it is titled as Home */
["procurement","techchange","srm","admin"].forEach(m=>{ if(NAV[m]){ const i=NAV[m].findIndex(x=>x.id==="task-centre"); if(i>=0) NAV[m].splice(i,1); } });
{ const _nl=navLabel; navLabel=function(m,s){ return s==="task-centre"?"Home / My Tasks":_nl(m,s); }; }
window.V8Home={build,state:ST};
})();
