/* =====================================================================
   V8  ·  SRM operational screens — Part Assignment · Tool Readiness · Milestone Tracking · Readiness (R/Y/G) · Alerts & Escalations
   Same data model as the dashboards (SrmData + SrmData.ops), same filters. Actions (assign, approve a milestone amendment, send a
   reminder, escalate) change the in-page state and write audit / task-centre entries; they reset on reload like the other prototype actions.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, S=SrmData, O=S.ops, V=V8Charts, K=V8Srm, esc=C.esc, nf=C.nf, DAY=S.DAY, MS=S.MS;
const fmtDate=K.fmtDate, chip=K.chip, short=K.short, add=K.add;
const ST={av:"all",tv:"all",ms:-1,al:"all"};
const canWrite=()=>["srm","pm","admin"].includes(RBAC.role);
const approverRole=a=>a.approver==="Supervisor"?"pm":"commodity";
const canDecide=a=>RBAC.role===approverRole(a)||RBAC.role==="admin";
const approverName=a=>Flow.nameOf(approverRole(a));
const crore=L=>"₹ "+nf(L/100,L>=1000?0:1)+" Cr";
const seg=(items,cur,kind)=>`<div class="fc-segs tight">${items.map(([id,l])=>`<button type="button" class="fc-seg ${String(cur)===String(id)?"on":""}" data-act="ops:${kind}=${esc(id)}">${l}</button>`).join("")}</div>`;
const lim=(rows,n)=>({rows:rows.slice(0,n),more:rows.length>n?`<div class="panel-body text-muted" style="font-size:12px;">Showing ${n} of ${rows.length} — narrow the filters to see the rest.</div>`:""});
function context(){ const m=K.model(), ev=S.scope(m,K.F); return {m,ev,sm:S.summary(ev)}; }
const partCell=e=>`<b>${esc(e.pt.name)}</b><small class="v8-sm">${esc(K.short(e.pt.progName))} · ${esc(e.pt.family)}</small>`;
const dot=c=>`<i class="v8-ryg ${c}"></i>`;
/* ranked rows (avatar / label, thin bar, count) used by the SRM operational panels; items:[{label,sub,value,color,act}] */
const initials=n=>String(n).replace(/[^A-Za-z. ]/g,"").split(/[ .]+/).filter(Boolean).map((x,i,a)=>i===0||i===a.length-1?x[0]:"").join("").toUpperCase();
function rank(items,o){ o=o||{}; const mx=Math.max(1,o.max||0,...items.map(i=>i.value));
  return `<div class="ops-rank${o.av?" av":""}${o.roomy?" roomy":""}">${items.map(i=>`<div class="r${i.act?" click":""}"${i.act?` data-act="${esc(i.act)}" role="button" tabindex="0"`:""}>${o.av?`<span class="a">${esc(initials(i.label))}</span>`:""}<div class="nm"><b>${esc(i.label)}</b>${i.sub?`<small>${i.sub}</small>`:""}</div><div class="tr"><i style="width:${Math.max(2,i.value/mx*100).toFixed(1)}%;background:${i.color||V.COL.info}"></i></div><b class="n">${i.value}</b></div>`).join("")}</div>`; }
const sumLine=(a,b)=>`<div class="ops-sum"><span>${a}</span><span>${b}</span></div>`;
const fill=h=>{ const e=U.el(h); e.classList.add("v8-fill"); return e; };
/* a paginated, column-filterable table (FTable) inside a panel, with an optional quick-filter strip above it */
function ftPanel(w,title,quick,ft,o){ add(w,U.panel(title,quick||"",Object.assign({style:"margin-top:16px"},o||{}))); w.lastChild.querySelector(".panel-body").appendChild(ft); }
const RYG_TXT={G:"Green",Y:"Yellow",R:"Red"}, RYG_ST={G:"ok",Y:"risk",R:"delayed"};

/* ------------------------------------------------------------ 1 · Part assignment */
function buildAssign(){
  const {m,ev,sm}=context(), w=K.page("Part Assignment","Who is responsible for each part's readiness — KTM expert, buyer, SRM engineer, QE, logistics and tool owner.");
  const rows=ev.map(e=>({e,p:O.people(m,e)})), gaps=rows.filter(r=>O.missing(r.p).length), mon=rows.filter(r=>O.monitoring(r.e));
  const owners={}; rows.forEach(r=>{ owners[r.p.srm]=(owners[r.p.srm]||0)+1; });
  K.skpis(w,[K.scard("package","Parts tracked",sm.n,`${new Set(rows.map(r=>r.e.pt.prog)).size} projects`),K.scard("activity","Monitoring active",mon.length,`${sm.n-mon.length} not yet started`),
    K.scard("check-circle","Fully staffed",rows.length-gaps.length,`${rows.length?Math.round((rows.length-gaps.length)/rows.length*100):0}% of parts`),K.scard("alert","With gaps",gaps.length,gaps.length?`<span class="bad">a role is unassigned</span>`:`<span class="good">all roles assigned</span>`,{tone:gaps.length?"bad":""}),
    K.scard("users","SRM engineers",Object.keys(owners).length,`avg ${Object.keys(owners).length?Math.round(rows.length/Object.keys(owners).length):0} parts each`)]);
  const g=add(w,`<div class="v8-g v8-g2"></div>`);
  const own=Object.entries(owners).sort((a,b)=>b[1]-a[1]), avgOwn=own.length?Math.round(rows.length/own.length):0;
  g.appendChild(fill(U.panel("Workload by SRM engineer",sumLine(`<b>${own.length}</b> engineers`,`average <b>${avgOwn}</b> parts each`)+rank(own.map(([n,c])=>({label:n,sub:`${rows.length?Math.round(c/rows.length*100):0}% of parts`,value:c,color:c>avgOwn*1.15?V.COL.risk:V.COL.info})),{av:true})+`<div class="ops-key"><span><i style="background:${V.COL.info}"></i>Around the average</span><span><i style="background:${V.COL.risk}"></i>More than 15% above average</span></div>`,{sub:"Parts per engineer in this selection"})));
  const miss={}; gaps.forEach(r=>O.missing(r.p).forEach(k=>{ miss[k]=(miss[k]||0)+1; }));
  const ROLE={qe:"Quality engineer (QE)",log:"Logistics",tool:"Tool owner",ktm:"KTM expert",buyer:"Buyer",srm:"SRM engineer"};
  g.appendChild(fill(U.panel("Unassigned roles",Object.keys(miss).length?sumLine(`<b>${gaps.length}</b> of ${rows.length} parts`,`have a role still open`)+rank(Object.entries(miss).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({label:ROLE[n]||n,sub:`${rows.length?Math.round(c/rows.length*100):0}% of parts`,value:c,color:V.COL.delayed,act:"ops:av=gaps"})),{roomy:true})+`<div class="ops-key"><span>Click a role to list the parts with gaps</span></div>`:`<div class="mut small">Every part has all roles assigned.</div>`,{sub:"Parts missing that stakeholder — click to list them"})));
  let list=rows; if(ST.av==="gaps") list=gaps; else if(ST.av==="notmon") list=rows.filter(r=>!O.monitoring(r.e));
  list=list.slice().sort((a,b)=>O.missing(b.p).length-O.missing(a.p).length||a.e.pt.name.localeCompare(b.e.pt.name));
  const cell=v=>v===null?`<span class="chip chip-red"><span class="chip-dot"></span>Unassigned</span>`:v==="n/a"?`<span class="mut">no tool</span>`:esc(v), txt=v=>v===null?"Unassigned":v==="n/a"?"No tool":v;
  const ft=FTable.create({id:"srm-assign",pageSize:10,rowAct:r=>"ops:assign="+r.e.pt.id,empty:"No part matches these filters.",rows:list,columns:[
    {key:"part",label:"Part",get:r=>r.e.pt.name,html:r=>partCell(r.e)+(r.e.pt.tier==="C"?`<small class="v8-sm">Fakum / colour variant of ${esc(O.baseOf(m,r.e)||"base part")}</small>`:"")},
    {key:"sup",label:"Supplier",get:r=>r.e.pt.vendor},{key:"ktm",label:"KTM expert",get:r=>r.p.ktm},{key:"buyer",label:"Buyer",get:r=>r.p.buyer},{key:"srm",label:"SRM engineer",get:r=>r.p.srm},
    {key:"qe",label:"QE",get:r=>txt(r.p.qe),html:r=>cell(r.p.qe)},{key:"log",label:"Logistics",get:r=>txt(r.p.log),html:r=>cell(r.p.log)},{key:"tool",label:"Tool owner",get:r=>txt(r.p.tool),html:r=>cell(r.p.tool)},
    {key:"mon",label:"Monitoring",get:r=>O.monitoring(r.e)?"Active":"Not started",html:r=>O.monitoring(r.e)?chip("ok","Active"):chip("notstarted","Not started")}]});
  ftPanel(w,`Assignments <span class="count-pill">${list.length}</span>`,seg([["all","All parts"],["gaps","Gaps only"],["notmon","Not monitored"]],ST.av,"av"),ft,{sub:canWrite()?"Click a row to assign stakeholders or start monitoring · filter any column from its heading":"Sign in as SRM, Project Manager or Admin to edit assignments"});
  U.wire(w); return w;
}
function openAssign(id){
  const m=K.model(), e=S.evaluate(m).find(x=>x.pt.id===id); if(!e) return; const p=O.people(m,e);
  const sel=(k,label,pool,cur)=>`<div class="form-row"><label>${label}</label><select id="as-${k}"><option value="">— unassigned —</option>${pool.map(n=>`<option${n===cur?" selected":""}>${esc(n)}</option>`).join("")}</select></div>`;
  Drawer.open("Assign stakeholders — "+e.pt.name,
    `<div class="text-muted" style="font-size:12.5px;margin-bottom:12px;">${esc(e.pt.progName)} · ${esc(e.pt.vendor)} · part no. ${esc(e.pt.id)}<br>KTM expert (${esc(p.ktm)}) and buyer (${esc(p.buyer)}) follow the project and supplier masters.</div>`+
    sel("srm","SRM engineer",O.NAMES.srm||Object.values(m.vend).map(v=>v.owner).filter((v,i,a)=>a.indexOf(v)===i),p.srm)+sel("qe","Quality engineer (QE)",O.NAMES.qe,p.qe)+sel("log","Logistics",O.NAMES.log,p.log)+(e.pt.toolReq?sel("tool","Tool owner",O.NAMES.tool,p.tool):"")+
    `<div class="form-row"><label><input type="checkbox" id="as-mon" ${O.monitoring(e)?"checked disabled":""}> Start monitoring (reminders and alerts begin)</label></div>`,
    ()=>{ if(!canWrite()) return Toast.show("Switch to SRM / Project Mgr / Admin to edit assignments.","warn");
      const v=k=>{ const n=document.getElementById("as-"+k); return n?n.value||null:undefined; };
      O.OV.assign[id]=Object.assign(O.OV.assign[id]||{},{srm:v("srm")||p.srm,qe:v("qe"),log:v("log"),tool:v("tool")});
      if(O.OV.assign[id].qe===null) O.OV.assign[id].qe=undefined; if(O.OV.assign[id].log===null) O.OV.assign[id].log=undefined; if(O.OV.assign[id].tool===null) O.OV.assign[id].tool=undefined;
      if(document.getElementById("as-mon").checked) O.OV.monitor[id]=true;
      Store.audit("SRM assignment","stakeholders updated",e.pt.name+" ("+e.pt.progName+")"); Toast.show("Assignment saved · audit entry written.","success"); setTimeout(()=>Router.render(),40); });
}

/* ------------------------------------------------------------ 2 · Tool readiness */
function buildTools(){
  const {m,ev}=context(), w=K.page("Tool Readiness","Tool register — kick-off, trial, completion and investment per tool."), tools=ev.flatMap(e=>O.toolRecords(m,e));
  const c={ok:0,risk:0,delayed:0,notstarted:0,done:0}; tools.forEach(t=>c[t.st]++);
  const act=tools.filter(t=>t.st!=="notstarted"), avg=act.length?act.reduce((s,t)=>s+t.pct,0)/act.length:null;
  const cap=tools.reduce((s,t)=>s+t.capexL,0), sp=tools.reduce((s,t)=>s+t.spentL,0);
  const trials=tools.filter(t=>t.st!=="done"&&t.st!=="notstarted"&&t.trial>=m.today&&t.trial<=m.today+60*DAY).sort((a,b)=>a.trial-b.trial);
  K.skpis(w,[K.scard("wrench","Tools tracked",tools.length,`${new Set(tools.map(t=>t.part.pt.id)).size} parts need tooling`),K.scard("gauge","Avg completion",K.pct0(avg),"tools in progress"),
    K.scard("check-circle","Approved",c.done,"trial passed, shipped"),K.scard("alert","At risk / delayed",c.risk+c.delayed,`<span class="warn">${c.risk} at risk</span> · <span class="bad">${c.delayed} delayed</span>`,{tone:c.delayed?"bad":c.risk?"warn":""}),
    K.scard("coins","Tooling investment",crore(cap),`${cap?Math.round(sp/cap*100):0}% spent (${crore(sp)})`)]);
  const g=add(w,`<div class="v8-g v8-g2"></div>`);
  const prog=m.programmes.filter(p=>!K.F.project||p.code===K.F.project);
  const sm7=S.summary(S.scope(m,K.F,m.today-7*DAY));
  g.appendChild(fill(U.panel("Tooling readiness",K.toolingBody(context().sm,sm7),{noPad:true,sub:"Plan attainment of tools that have started"})));
  g.appendChild(fill(U.panel("Tool status by project",V.stacked(prog.map(p=>{ const cc={ok:0,risk:0,delayed:0,notstarted:0}; tools.filter(t=>t.part.pt.prog===p.code).forEach(t=>{ cc[t.st==="done"?"ok":t.st]++; }); return {label:K.short(p.name),counts:cc}; })),{sub:"Approved tools count as on track"})));
  const g2=add(w,`<div class="v8-g v8-g2"></div>`);
  const cx=prog.map(p=>{ const l=tools.filter(t=>t.part.pt.prog===p.code); return {p,cap:l.reduce((s,t)=>s+t.capexL,0),sp:l.reduce((s,t)=>s+t.spentL,0)}; }), mx=Math.max(1,...cx.map(x=>x.cap));
  g2.appendChild(fill(U.panel("Tooling investment — committed vs spent",`<div class="v8-cx">${cx.map(x=>`<div class="r"><div class="lb">${esc(K.short(x.p.name))}</div><div class="tr" style="width:${x.cap/mx*100}%"><i style="width:${x.cap?x.sp/x.cap*100:0}%"></i></div><div class="vl">${crore(x.sp)} <span>of ${crore(x.cap)}</span></div></div>`).join("")}</div><div class="v8-legend"><span><i style="background:var(--brand)"></i>Spent (CAPEX × completion)</span><span><i style="background:var(--line2)"></i>Committed</span></div>`,{sub:"Generated CAPEX per tool; spend follows completion %"})));
  const stages=["Toolmaker — design","Toolmaker — build","Supplier plant — trial","Series plant","Not yet released"], stN=stages.map(s=>tools.filter(t=>t.location===s).length);
  g2.appendChild(fill(U.panel("Where the tools are",rank(stages.map((s,i)=>({label:s,sub:`${tools.length?Math.round(stN[i]/tools.length*100):0}% of tools`,value:stN[i],color:s==="Series plant"?V.COL.ok:s==="Not yet released"?V.COL.notstarted:V.COL.info}))),{sub:"Where each tool is today"})));
  const g3=add(w,`<div class="v8-g"></div>`);
  g3.appendChild(fill(U.panel("Trials in the next 60 days",trials.length?`<div class="ops-tbl">`+U.table(["Tool","Part","Trial"],trials.slice(0,5).map(t=>`<tr class="v8-row" data-act="srmpart:${esc(t.part.pt.id)}" role="button" tabindex="0"><td>${esc(t.no)}</td><td>${esc(t.part.pt.name)}<small class="v8-sm">${esc(K.short(t.part.pt.progName))}</small></td><td>${esc(fmtDate(t.trial))}</td></tr>`).join(""))+`</div>`+(trials.length>5?`<div class="ops-more">Next 5 of ${trials.length} — the rest are in the tool register below</div>`:""):`<div class="mut small">No trial is due in the next 60 days.</div>`,{noPad:true,sub:"Nearest first · click a row for the part"})));
  let list=tools; if(ST.tv==="risk") list=tools.filter(t=>t.st==="risk"); else if(ST.tv==="delayed") list=tools.filter(t=>t.st==="delayed"); else if(ST.tv==="done") list=tools.filter(t=>t.st==="done");
  const order={delayed:0,risk:1,ok:2,notstarted:3,done:4}; list=list.slice().sort((a,b)=>order[a.st]-order[b.st]||a.trial-b.trial);
  const tchip=t=>t.st==="done"?chip("ok","Approved"):chip(t.st), band=p=>p>=100?"100%":p>=75?"75–99%":p>=50?"50–74%":p>=25?"25–49%":"Under 25%";
  const ft=FTable.create({id:"srm-tools",pageSize:10,rowAct:t=>"srmpart:"+t.part.pt.id,empty:"No tool matches these filters.",rows:list,columns:[
    {key:"tool",label:"Tool",get:t=>t.no,html:t=>`<b>${esc(t.no)}</b>`},{key:"part",label:"Part",get:t=>t.part.pt.name,html:t=>`${esc(t.part.pt.name)}<small class="v8-sm">${esc(K.short(t.part.pt.progName))}</small>`},
    {key:"sup",label:"Supplier",get:t=>t.part.pt.vendor},{key:"type",label:"Type",get:t=>t.type},{key:"maker",label:"Tool maker",get:t=>t.maker},{key:"cav",label:"Cavities",get:t=>t.cavities,align:"r",order:t=>t.cavities},
    {key:"kick",label:"Kick-off",get:t=>fmtDate(t.kickoff),order:t=>t.kickoff},{key:"trial",label:"Trial",get:t=>fmtDate(t.trial),order:t=>t.trial},
    {key:"pct",label:"Completion",get:t=>band(t.pct),order:t=>-t.pct,html:t=>K.readBar(t.pct).replace(/background:[^"]*/,"background:"+(t.st==="done"?V.COL.ok:V.COL.info))},
    {key:"st",label:"Status",get:t=>t.st==="done"?"Approved":S.STATUS[t.st],order:t=>order[t.st],html:tchip},{key:"loc",label:"Location",get:t=>t.location},{key:"first",label:"First parts",get:t=>t.firstParts}]});
  ftPanel(w,`Tool register <span class="count-pill">${list.length}</span>`,seg([["all","All"],["risk","At risk"],["delayed","Delayed"],["done","Approved"]],ST.tv,"tv"),ft,{sub:"Filter any column from its heading · tool numbers, makers, dates and CAPEX are generated for this prototype"});
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 3 · Milestone tracking (with amendment approval) */
function buildMilestones(){
  const {m,ev}=context(), w=K.page("Milestone Tracking","Required date versus supplier commitment per part — amended dates stay visible, struck through, until approved."), am=O.amendments(m,ev);
  const mi=ST.ms>=0?ST.ms:Math.max(0,MS.findIndex((d,i)=>ev.some(e=>e.started&&e.milestones[i].future)));
  const started=ev.filter(e=>e.started), cur=started.filter(e=>e.milestones[mi].future);
  const due30=started.reduce((n,e)=>n+e.milestones.filter(k=>k.future&&k.R<=m.today+30*DAY).length,0), pend=am.filter(a=>a.status==="pending").length;
  const slip=cur.length?cur.reduce((s,e)=>s+e.milestones[mi].dm,0)/cur.length:null;
  K.skpis(w,[K.scard("package","Parts tracked",started.length,`${ev.length-started.length} not started`),K.scard("calendar","Milestone dates due in 30 days",due30,"across all parts"),K.scard("clipboard-check","Amendments awaiting approval",pend,pend?`<span class="warn">Supervisor / Commodity Lead</span>`:"nothing pending",{tone:pend?"warn":""}),
    K.scard("activity",MS[mi].id+" — avg slip",slip==null?"—":(slip>0?"+":"")+Math.round(slip)+" d",`${cur.length} parts with it ahead`),K.scard("alert",MS[mi].id+" — parts late",cur.filter(e=>e.milestones[mi].st!=="ok").length,`of ${cur.length}`)]);
  const picker=seg(MS.map((d,i)=>[i,d.id]),mi,"ms");
  const amOf={}; am.forEach(a=>{ amOf[a.key]=a; });
  let rows=cur.slice().sort((a,b)=>S.RANK[b.milestones[mi].st]-S.RANK[a.milestones[mi].st]||a.milestones[mi].R-b.milestones[mi].R);
  const amChip=a=>!a?"—":a.status==="pending"?chip("risk","Pending approval"):a.status==="rejected"?chip("delayed","Rejected"):chip("ok","Approved"), amTxt=a=>!a?"None":a.status==="pending"?"Pending approval":a.status==="rejected"?"Rejected":"Approved";
  const slipTxt=k=>(k.dm>0?"+":"")+Math.round(k.dm)+" d";
  const ft=FTable.create({id:"srm-ms",pageSize:10,rowAct:e=>"srmpart:"+e.pt.id,empty:"No part matches these filters.",rows,columns:[
    {key:"part",label:"Part",get:e=>e.pt.name,html:partCell},{key:"sup",label:"Supplier",get:e=>e.pt.vendor},
    {key:"req",label:"Required",get:e=>fmtDate(e.milestones[mi].R),order:e=>e.milestones[mi].R},
    {key:"com",label:"Supplier commitment",get:e=>fmtDate(e.milestones[mi].C),order:e=>e.milestones[mi].C,html:e=>{ const a=amOf[e.pt.id+"|"+mi]; return (a&&a.status!=="rejected"?`<s class="v8-old">${esc(fmtDate(a.oldT))}</s> `:"")+`<b>${esc(fmtDate(e.milestones[mi].C))}</b>`; }},
    {key:"slip",label:"Slip",get:e=>slipTxt(e.milestones[mi]),order:e=>e.milestones[mi].dm,align:"r"},
    {key:"st",label:"Status",get:e=>S.STATUS[e.milestones[mi].st],order:e=>-S.RANK[e.milestones[mi].st],html:e=>chip(e.milestones[mi].st)},
    {key:"am",label:"Amendment",get:e=>amTxt(amOf[e.pt.id+"|"+mi]),html:e=>amChip(amOf[e.pt.id+"|"+mi])}]});
  ftPanel(w,`${esc(MS[mi].id)} — part tracker <span class="count-pill">${rows.length}</span>`,picker,ft,{sub:MS[mi].need+" · filter any column from its heading"});
  const list=am.slice().sort((a,b)=>(a.status!=="pending")-(b.status!=="pending")||a.newT-b.newT);
  const ft2=FTable.create({id:"srm-am",pageSize:10,empty:"No amendment matches these filters.",rows:list,columns:[
    {key:"part",label:"Part",get:a=>a.e.pt.name,html:a=>partCell(a.e)},{key:"ms",label:"Milestone",get:a=>a.ms.id},
    {key:"chg",label:"Date change",get:a=>"+"+Math.round((a.newT-a.oldT)/DAY)+" days",order:a=>a.newT-a.oldT,html:a=>`<s class="v8-old">${esc(fmtDate(a.oldT))}</s> → <b>${esc(fmtDate(a.newT))}</b><small class="v8-sm">+${Math.round((a.newT-a.oldT)/DAY)} days</small>`},
    {key:"req",label:"Requested",get:a=>fmtDate(a.requested),order:a=>a.requested,html:a=>`${esc(fmtDate(a.requested))}<small class="v8-sm">by ${esc(a.by)}</small>`},
    {key:"apr",label:"Approver",get:a=>a.approver,html:a=>`${esc(a.approver)}${a.decidedBy?`<small class="v8-sm">${esc(a.decidedBy)}</small>`:""}`},
    {key:"st",label:"Status",get:a=>amTxt(a),html:amChip},
    {key:"act",label:"Decision",get:a=>a.status==="pending"?"Awaiting decision":"Decided",html:a=>a.status==="pending"?(canDecide(a)?`<button type="button" class="btn btn-sm btn-primary" data-act="ops:amok=${esc(a.key)}">Approve</button> <button type="button" class="btn btn-sm" data-act="ops:amno=${esc(a.key)}">Reject</button>`:`<small class="v8-sm">Awaiting ${esc(approverName(a))} (${esc(a.approver)})</small>`):""}]});
  ftPanel(w,`Milestone amendments <span class="count-pill">${am.length}</span>`,"",ft2,{sub:"Supervisor amendments go to the Project Manager, Commodity Lead amendments to the Commodity Manager — switch role to decide"});
  add(w,U.note(`Any change to a first-entered milestone date routes through the Supervisor or Commodity Lead; the previous value stays visible with a strikethrough. The workflow engine's example is on the <a href="#" data-act="sgo:approvals">Approvals</a> screen. The RFQ names a 19-stage milestone set; the five key stages (B-Release, VFF, PVS, 0-Series, SOP) are tracked here — the other stages need the stage list from SAVWIPL.`,"info"));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 4 · Readiness (R / Y / G) */
function buildRyg(){
  const {m,ev}=context(), w=K.page("Readiness (R / Y / G)","Seven readiness dimensions per part, rolled up to one traffic light."), rows=ev.map(e=>({e,r:O.ryg(m,e)})).filter(x=>x.r);
  const oc={G:0,Y:0,R:0}; rows.forEach(x=>oc[x.r.overall]++);
  const dimAvg=O.DIMS.map((d,i)=>({d,avg:rows.length?rows.reduce((s,x)=>s+x.r.dims[i].score,0)/rows.length:null})), weak=dimAvg.filter(x=>x.avg!=null).sort((a,b)=>a.avg-b.avg)[0];
  K.skpis(w,[K.scard("check-circle","Green",oc.G,`${rows.length?Math.round(oc.G/rows.length*100):0}% of ${rows.length} parts assessed`,{tone:"good"}),K.scard("clock","Yellow",oc.Y,"3 or more yellow dimensions",{tone:oc.Y?"warn":""}),
    K.scard("alert","Red",oc.R,"at least one red dimension",{tone:oc.R?"bad":""}),K.scard("gauge","Avg readiness score",rows.length?Math.round(rows.reduce((s,x)=>s+x.r.score,0)/rows.length):"—","mean of the 7 dimensions"),K.scard("layers","Weakest dimension",weak?esc(weak.d.label):"—",weak?`avg score ${Math.round(weak.avg)}`:"",{tone:"txt"})]);
  const g=add(w,`<div class="v8-g v8-g2"></div>`);
  g.appendChild(U.el(U.panel("Status by dimension",V.stacked(O.DIMS.map((d,i)=>({label:d.label,counts:{ok:rows.filter(x=>x.r.dims[i].c==="G").length,risk:rows.filter(x=>x.r.dims[i].c==="Y").length,delayed:rows.filter(x=>x.r.dims[i].c==="R").length}})),{keys:["ok","risk","delayed"],legend:false})+`<div class="v8-legend"><span><i style="background:${V.COL.ok}"></i>Green</span><span><i style="background:${V.COL.risk}"></i>Yellow</span><span><i style="background:${V.COL.delayed}"></i>Red</span></div>`,{sub:"Parts in each state, per dimension"})));
  const hl={lo:25,hi:50,legend:`<span><i style="background:rgba(46,158,107,.55)"></i>Score 75+</span><span><i style="background:rgba(240,160,48,.62)"></i>50–74</span><span><i style="background:rgba(217,72,59,.62)"></i>Below 50</span>`};
  const heatCell=(list)=>(i)=>{ if(!list.length) return null; const a=list.reduce((s,x)=>s+x.r.dims[i].score,0)/list.length; return {pct:100-a,text:Math.round(a),title:`avg score ${Math.round(a)} · ${list.length} parts`}; };
  g.appendChild(U.el(U.panel("Vertical × dimension",V.heat(S.FAMILIES,O.DIMS.map(d=>d.label),(f,dl)=>heatCell(rows.filter(x=>x.e.pt.family===f))(O.DIMS.findIndex(d=>d.label===dl)),hl),{sub:"Average score (100 = on or ahead of date)"})));
  const sup=K.suppliers(m,ev).filter(x=>x.started>=3).map(x=>({x,list:rows.filter(r=>r.e.pt.vendor===x.name)})).filter(y=>y.list.length).map(y=>({name:y.x.name,list:y.list,avg:y.list.reduce((s,r)=>s+r.r.score,0)/y.list.length})).sort((a,b)=>a.avg-b.avg).slice(0,10);
  add(w,U.panel("Weakest suppliers × dimension",V.heat(sup.map(s=>s.name),O.DIMS.map(d=>d.label),(n,dl)=>heatCell(sup.find(s=>s.name===n).list)(O.DIMS.findIndex(d=>d.label===dl)),hl),{sub:"The ten suppliers with the lowest average score",style:"margin-top:0"}));
  w.lastChild.style.marginTop="16px";
  const worst=rows.slice().sort((a,b)=>a.r.score-b.r.score), sh=lim(worst,30);
  add(w,U.panel(`Parts — lowest readiness first <span class="count-pill">${rows.length}</span>`,U.table(["Part","Supplier"].concat(O.DIMS.map(d=>d.label.slice(0,4)),["Overall","Score"]),sh.rows.map(x=>`<tr class="v8-row" data-act="srmpart:${esc(x.e.pt.id)}" role="button" tabindex="0"><td>${partCell(x.e)}</td><td>${esc(x.e.pt.vendor)}</td>${x.r.dims.map(d=>`<td title="${esc(d.label)}: ${d.score}">${dot(d.c)}</td>`).join("")}<td>${chip(RYG_ST[x.r.overall],RYG_TXT[x.r.overall])}</td><td><b>${x.r.score}</b></td></tr>`).join(""))+sh.more,{noPad:true,style:"margin-top:16px",sub:"Dimension scores are generated from each part's commitment slip (tooling uses the tool's own slip); overall = red if any dimension is red, yellow if three or more are yellow"}));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 5 · Alerts & escalations */
function buildAlerts(){
  const {m,ev}=context(), w=K.page("Alerts & Escalations","Automatic alerts 6, 4 and 2 weeks before a milestone and when it is overdue — with the escalation ladder."), all=O.alerts(m,ev);
  const lv={overdue:0,"2W":0,"4W":0,"6W":0}; all.forEach(a=>lv[a.level]++); const escd=all.filter(a=>a.esc);
  K.skpis(w,[K.scard("bell","Open alerts",all.length,`${new Set(all.map(a=>a.e.pt.id)).size} parts`),K.scard("alert","Overdue",lv.overdue,"milestone date passed",{tone:lv.overdue?"bad":""}),K.scard("clock","Within 2 weeks",lv["2W"],"final reminder window"),K.scard("calendar","Within 4 weeks",lv["4W"],"second reminder"),
    K.scard("trend-up","Escalated",escd.length,`${escd.filter(a=>a.esc==="Management").length} at management level`,{tone:escd.length?"warn":""})]);
  const g=add(w,`<div class="v8-g v8-g3"></div>`), LCOL={overdue:V.COL.delayed,"2W":V.COL.risk,"4W":V.COL.info,"6W":V.COL.notstarted};
  g.appendChild(U.el(U.panel("Alerts by cadence",C.bars({fmt:v=>v,items:[["overdue","Overdue"],["2W","2 weeks"],["4W","4 weeks"],["6W","6 weeks"]].map(([k,l])=>({label:l,value:lv[k],color:LCOL[k],onclick:"ops:al="+k}))}),{sub:"Click a bar to filter the list"})));
  const rung=[["SRM engineer (reminders)",all.filter(a=>!a.esc).length],["Supervisor",all.filter(a=>a.esc==="Supervisor").length],["Head of SRM",all.filter(a=>a.esc==="Head of SRM").length],["Management",all.filter(a=>a.esc==="Management").length]];
  g.appendChild(U.el(U.panel("Escalation ladder",C.bars({fmt:v=>v,items:rung.map(([l,v],i)=>({label:l,value:v,color:[V.COL.info,V.COL.risk,V.COL.risk,V.COL.delayed][i]}))})+`<div class="mut small" style="margin-top:8px">Overdue milestones go to the Supervisor after 3 reminders and to Management after 6; any alert reaching 4 reminders goes to the Head of SRM.</div>`)));
  const own={}; all.forEach(a=>{ own[a.owner]=(own[a.owner]||0)+1; });
  g.appendChild(U.el(U.panel("Monday digest — alerts per engineer",C.bars({fmt:v=>v,items:Object.entries(own).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({label:n,value:c,color:V.COL.info,onclick:"ops:digest="+n}))}),{sub:"Click a name to preview that engineer's weekly e-mail"})));
  const list=ST.al==="all"?all:all.filter(a=>a.level===ST.al), sh=lim(list,40), lchip=a=>chip(a.level==="overdue"?"delayed":a.level==="2W"?"risk":"notstarted",a.level==="overdue"?"Overdue":a.level==="2W"?"2 weeks":a.level==="4W"?"4 weeks":"6 weeks");
  add(w,U.panel(`Alert list <span class="count-pill">${list.length}</span>`,seg([["all","All"],["overdue","Overdue"],["2W","2 weeks"],["4W","4 weeks"],["6W","6 weeks"]],ST.al,"al")+
    U.table(["Alert","Part","Supplier","Milestone","Due","Reminders","Escalated to","Owner",""],sh.rows.map(a=>`<tr><td>${lchip(a)}</td><td class="v8-row" data-act="srmpart:${esc(a.e.pt.id)}" role="button" tabindex="0">${partCell(a.e)}</td><td>${esc(a.e.pt.vendor)}</td><td>${esc(a.ms.id)}</td><td>${esc(fmtDate(a.R))}<small class="v8-sm">${a.days<0?"overdue by "+(-a.days)+" days":a.days===0?"today":"in "+a.days+" days"}</small></td><td>${a.reminders}</td><td>${a.esc?esc(O.ESC_TEXT[a.esc]):"—"}</td><td>${esc(a.owner)}</td>
      <td class="v8-btns"><button type="button" class="btn btn-sm" data-act="ops:rem=${esc(a.key)}">Remind</button> <button type="button" class="btn btn-sm" data-act="ops:esc=${esc(a.key)}"${a.esc==="Management"?" disabled":""}>Escalate</button></td></tr>`).join(""))+sh.more,{noPad:true,style:"margin-top:16px",sub:"Alerts exist for milestones whose supplier commitment is late or whose date has passed unmet"}));
  U.wire(w); return w;
}
function alertAction(kind,key){
  const m=K.model(), a=O.alerts(m,S.evaluate(m)).find(x=>x.key===key); if(!a) return;
  const o=O.OV.alert[key]=O.OV.alert[key]||{};
  if(kind==="rem"){ o.reminders=a.reminders+1; const rem=o.reminders; if(!a.esc){ if(a.level==="overdue"&&rem>=6) o.esc="Management"; else if(a.level==="overdue"&&rem>=3) o.esc="Supervisor"; else if(rem>=4) o.esc="Head of SRM"; }
    Store.audit("SRM alert","reminder sent",a.e.pt.name+" · "+a.ms.id+" · reminder "+rem); try{ TaskCentre.emailLog.unshift({when:K.model().TODAY+" "+new Date().toTimeString().slice(0,5),to:"srm",subj:"["+a.e.pt.id+"] Reminder "+rem+" — "+a.ms.id+" · "+a.e.pt.name,opened:false}); }catch(e){}
    Toast.show("Reminder sent to "+a.owner+" and the supplier contact · logged.","success"); }
  else { const next=a.esc==="Supervisor"?"Management":a.esc==="Head of SRM"?"Management":"Supervisor"; o.esc=next; o.reminders=a.reminders;
    Store.audit("SRM alert","escalated to "+next,a.e.pt.name+" · "+a.ms.id); Toast.show("Escalated to "+O.ESC_TEXT[next]+" · audit entry written.","info"); }
  Router.render();
}
function digest(owner){
  const m=K.model(), list=O.alerts(m,S.scope(m,{})).filter(a=>a.owner===owner), rank={overdue:"Overdue","2W":"Due within 2 weeks","4W":"Due within 4 weeks","6W":"Due within 6 weeks"};
  Drawer.open("Weekly digest — "+owner,"",null); const b=document.getElementById("drawer-body");
  b.innerHTML=`<div class="text-muted" style="font-size:12.5px;margin-bottom:10px">Consolidated e-mail sent every Monday to each SRM engineer (preview, ${esc(fmtDate(m.today))}).</div><div class="v8-mail"><div><b>Subject:</b> SRM — ${list.length} milestone alerts for the week</div><div><b>To:</b> ${esc(owner)}</div><hr>`+
    Object.keys(rank).map(k=>{ const l=list.filter(a=>a.level===k); return l.length?`<p><b>${rank[k]} (${l.length})</b></p><ul>${l.slice(0,8).map(a=>`<li>${esc(a.e.pt.name)} · ${esc(K.short(a.e.pt.progName))} · ${esc(a.e.pt.vendor)} — ${esc(a.ms.id)} ${esc(fmtDate(a.R))}</li>`).join("")}${l.length>8?`<li>… and ${l.length-8} more</li>`:""}</ul>`:""; }).join("")+`</div>`;
  document.querySelector("#drawer .drawer-footer").style.display="none"; U.wire(b);
}

/* ------------------------------------------------------------ actions, drawer block, screens */
Object.assign(U.actions,{ops:v=>{ const i=v.indexOf("="), k=v.slice(0,i), a=v.slice(i+1);
  if(k==="av"){ ST.av=a; Router.render(); } else if(k==="tv"){ ST.tv=a; Router.render(); } else if(k==="ms"){ ST.ms=+a; Router.render(); } else if(k==="al"){ ST.al=a; Router.render(); }
  else if(k==="assign") openAssign(a); else if(k==="rem"||k==="esc") alertAction(k,a); else if(k==="digest") digest(a);
  else if(k==="amok"||k==="amno"){ const m=K.model(), am=O.amendments(m,S.evaluate(m)).find(x=>x.key===a); if(!am) return;
    if(am.status!=="pending") return Toast.show("This amendment has already been decided.","info");
    if(!canDecide(am)) return Toast.show(`This amendment is owned by the ${am.approver} (${approverName(am)}) — switch role to decide.`,"warn");
    const ok=k==="amok", who=(DATA.users.find(u=>u.role===RBAC.role)||{}).name||RBAC.role; O.OV.am[a]={status:ok?"approved":"rejected",by:who};
    const tag=am.e.pt.name+" · "+am.ms.id; Store.audit("Milestone amendment",ok?"approved":"rejected",tag+" → "+fmtDate(am.newT));
    Flow.notify("srm",{type:"approval-result",title:`Milestone amendment ${ok?"approved":"rejected"} — ${tag}`,meta:`${am.e.pt.vendor} • new date ${fmtDate(am.newT)} ${ok?"is now the plan of record (previous date struck through)":"was not accepted — supplier to resubmit"} • decided by ${who}`,wf:"AMD-"+am.e.pt.id.slice(-5)+"-"+am.ms.id,open:{module:"srm",screen:"milestone-tracking"},due:"FYI",dueDays:5,entity:tag});
    rollup();
    Toast.show(ok?`Amendment approved by ${who}. Previous date kept, struck through; ${Flow.nameOf("srm")} (SRM) notified.`:`Amendment rejected by ${who}. ${Flow.nameOf("srm")} (SRM) notified — supplier to resubmit.`,ok?"success":"warn"); Router.render(); } }});
window.V8SrmOps={drawerBlock(e){ const r=O.ryg(K.model(),e); if(!r) return ""; return `<div class="dr-sec"><div class="dr-sh"><h4>Readiness (R / Y / G)</h4><span class="chip ${K.chipCls[RYG_ST[r.overall]]}"><span class="chip-dot"></span>${RYG_TXT[r.overall]}</span></div><div class="dr-ryg">${r.dims.map(d=>`<div class="${d.c}" title="${esc(d.label)} ${d.score}"><i></i><span>${esc(d.label)}</span><b>${d.score}</b></div>`).join("")}</div><div class="dr-asof">Score = 100 − 2.5 × days late (0–100) · Green 75 or more · Yellow 25–74 · Red under 25 · any Red dimension makes the part Red, three or more Yellows make it Yellow</div></div>`; }};
Object.assign(SCREENS.srm,{"part-assignment":buildAssign,"tool-readiness":buildTools,"milestone-tracking":buildMilestones,"readiness-ryg":buildRyg,"alerts-escalations":buildAlerts});

/* every approver role that has amendments waiting gets one roll-up task (not one per part); it is kept in step as amendments are decided */
function rollup(){ try{ const m=K.model(), am=O.amendments(m,S.evaluate(m)).filter(x=>x.status==="pending"), by={pm:0,commodity:0}; am.forEach(x=>{ by[approverRole(x)]++; });
  [["pm","Supervisor"],["commodity","Commodity Lead"]].forEach(([role,label])=>{ const wf="AMD-"+role.toUpperCase(), t=TaskCentre.tasks.find(x=>x.wf===wf&&x.state==="open");
    if(!by[role]){ if(t) t.state="done"; return; }
    const title=`${by[role]} milestone amendments awaiting your approval`;
    if(t) t.title=title; else Flow.notify(role,{type:"approval-pending",title,meta:`SRM • milestone dates changed by suppliers — ${label} approval`,wf,open:{module:"srm",screen:"milestone-tracking"},due:"Due in 2d",dueDays:2,entity:"Milestone amendments"}); });
  Notif.updateBadge(); }catch(e){ console.error(e); } }
rollup();
})();
