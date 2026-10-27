/* =====================================================================
   V8  ·  Technical Change — AEKO / AWE / AeA management (ported from the E4 prototype, rebuilt on the current UI and data)
   Stages: Intake → AI extraction → Evaluation → Validation → Supplier offers → MOD sheet → Impact → Approval → Implementation → Closed.
   Platform data replaces E4's hard-coded values: the part, project, supplier and prices come from the POC part panel and masters; the MOD sheet
   starts from the part's cost breakdown (CBD); annual volume comes from the car-volume master; risk blends cost delta, SRM milestone proximity and
   supplier risk; implementing a change really appends the price version, BOM-at-SOP line and PO.  Documents, TUL values, clarifications and the
   "similar historical changes" are generated for this prototype.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, S=SrmData, K=V8Srm, esc=C.esc, nf=C.nf, A=()=>window.__cbdApi;
const T0=(typeof TODAY!=="undefined"?TODAY:"2026-07-29"), h=S.hash;
const STAGES=["Intake","AI Extraction","Evaluation","Validation","Supplier Offers","MOD Sheet","Impact","Approval","Implementation","Closed"];
const STAGE_SCREEN={"Intake":"intake","AI Extraction":"doc-upload","Evaluation":"eval-sheet","Validation":"validation","Supplier Offers":"supplier-offers","MOD Sheet":"mod-sheet","Impact":"impact-analysis","Approval":"approval-workflow","Implementation":"implementation","Closed":"change-dashboard"};
const STAGE_ALIAS={"Impact Analysis":"Impact","Approval Workflow":"Approval"};
const TYPES=["AEKO","AWE","AeA","Running","Model-Year","Supplier proposal"], PREFIX={AEKO:"AEKO",AWE:"AWE",AeA:"AEA",Running:"RUN","Model-Year":"MY","Supplier proposal":"SUP"};
const TUL_FIELDS=[["item","ITEM"],["pl","PL"],["nfuai","NFUAI"],["partNo","Part number"],["pou","Point of use"],["z","Z"],["desig","Part designation"],["partVal","PART VAL."],["uoq","UoQ"],["ww","WW"],["comTyp","ComTypApp-Rel"],["bmg","BMG 1–4"],["desBrel","DES. B-REL"],["desBmg","Des. BMG"],["bmgObl","BMG obligation"],["brel","B_REL"],["duns","DUNS 1–4 BMG"],["actDate","ACT.DATE"],["deg","Design engineering group"],["module","Module type"],["sdraw","SDRAW"],["brand","Brand columns"]].map(([k,label])=>({k,label}));
const APPROVAL_CHAIN=[["Engineering","Eng owner"],["Quality","Quality"],["SRM","SRM engineer"],["Finance","Finance"],["Commodity","Commodity mgr"],["Management","Management"]];
const IMPL_TASKS=["Update price in CBD / price history","Update BOM at SOP","Update / re-issue Purchase Order (EBON)","Notify supplier of approval","Release updated drawing","Raise tool modification order","Notify plant · quality · production","Confirm implementation & close change"];
const EG={Electrical:"EG-Electrical",Lighting:"EG-Electrical",Sensors:"EG-Electrical",Powertrain:"EG-Powertrain",Chassis:"EG-Chassis",Braking:"EG-Chassis","Interior Trim":"EG-Body-Interior",HVAC:"EG-Body-Interior","Body Stampings":"EG-Body-Interior",Fasteners:"EG-Body-Interior"};
const users=role=>DATA.users.filter(u=>u.role===role).map(u=>u.name);
const buyers=users("buyer"), srms=users("srm"), approvers=users("approver");
const dayDiff=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5), addDays=(d,n)=>new Date(new Date(d).getTime()+n*864e5).toISOString().slice(0,10);
const fmtDate=d=>{ try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch(e){ return String(d); } };
const inr=(v,d)=>U.inr(v,d), cr=v=>U.cr(v);
const money=v=>(v>0?"+":v<0?"−":"")+"₹"+nf(Math.abs(v),0);
const stageOf=c=>{ const s=STAGE_ALIAS[c.stage]||c.stage, i=STAGES.indexOf(s); return i>=0?i:2; };
const CD={};
const ctx={activeId:null,get(){ return CD[this.activeId]; },set(id){ this.activeId=id; Router.render(); }};

/* ------------------------------------------------------------ seeding from platform data */
const dpOf=c=>DATA.parts.find(p=>p.designation===c.part&&DATA.priceVersions[p.number])||DATA.parts.find(p=>p.designation===c.part)||null;
const projOf=code=>DATA.projects.find(p=>p.code===code);
const carName=code=>{ const p=projOf(code); return p?p.name:code; };
function tulSeed(c){
  const dp=dpOf(c), pr=projOf(c.project), cat=dp&&dp.poc?dp.poc.category:"";
  return {item:"010",pl:String(3+h("pl|"+c.id)%5),nfuai:"N",partNo:c.partNo,pou:["Front-LH","Front-RH","Rear-LH","Rear-RH","Centre"][h("pu|"+c.id)%5],z:"Z"+(1+h("z|"+c.id)%3),desig:c.part,partVal:"A",uoq:"PCE",ww:String(20+h("ww|"+c.id)%8),
    comTyp:"CTA-REL "+(1+h("ct|"+c.id)%3),bmg:"BMG "+(1+h("bm|"+c.id)%4),desBrel:addDays(T0,-(60+h("db|"+c.id)%30)),desBmg:"Des-BMG-0"+(1+h("dg|"+c.id)%9),bmgObl:"Yes",brel:"B_REL-"+(1+h("br|"+c.id)%4),
    duns:c.supplierDuns,actDate:addDays(T0,-(30+h("ad|"+c.id)%25)),deg:EG[cat]||"EG-Body-Interior",module:"MQB-A0-IN",sdraw:"SD-"+c.partNo,brand:pr&&pr.oem==="SKODA"?"Skoda":"VW"};
}
function modRows(c){
  const dp=dpOf(c), cbd=dp&&DATA.cbds[dp.number];
  if(cbd){ A().sync(cbd); return cbd.tree.map(n=>({comp:String(n.name).replace(/\s*\(.*\)$/,""),cur:Math.round(n.cost*100)/100,neu:null,src:n.derived?"CBD · derived from weights / import content":"CBD · cost tree"})); }
  const cur=dp&&dp.poc?dp.poc.cur:500; return [["Material",.52],["Process",.26],["Overhead",.12],["Logistics",.10]].map(([comp,s])=>({comp,cur:Math.round(cur*s*100)/100,neu:null,src:"Estimated split — no cost breakdown yet"}));
}
function approvalSeed(stageIdx){
  const n=stageIdx>7?6:stageIdx===7?3:0;
  return APPROVAL_CHAIN.map(([stage,role],i)=>{ const u=DATA.users[(i+2)%DATA.users.length]; return {stage,role,status:i<n?"Approved":"Pending",by:i<n?u.name:null,on:i<n?addDays(T0,-(8-i)):null,comment:i<n?"Reviewed — no objection.":"",signature:i<n?u.name.replace(/\./g,""):null}; });
}
function seedChange(c,i,stageIdx){
  const dp=dpOf(c); c.partNo=c.partNo||(dp?dp.number:"—"); c.project=c.project||(dp?dp.project:""); c.supplier=c.supplier||(dp?dp.supplier:"");
  const sup=DATA.suppliers.find(s=>s.name===c.supplier); c.supplierDuns=c.supplierDuns||(sup?sup.duns:"430000000");
  const mod=modRows(c), tot=mod.reduce((s,r)=>s+r.cur,0);
  const sIdx=stageIdx==null?stageOf(c):stageIdx;
  CD[c.id]={ref:c,changeId:"CHG-"+c.wf.split("-").slice(1).join(""),createdBy:"P. Nair (AEKO Coord)",createdOn:addDays(T0,-(18-i*2)),
    reason:["Design revision — cavity re-profiling","Cost-down: material substitution","Supplier proposal — VA/VE","Model-year update — connector spec","Running change — tolerance correction"][i%5],
    stageIdx:sIdx,extracted:sIdx>=1,evalVerified:sIdx>=3,tul:tulSeed(c),tulVerified:{},tulEdited:{},revMismatch:i===0,
    assign:{buyer:buyers[i%buyers.length],srm:srms[i%srms.length],engineering:(EG[dp&&dp.poc?dp.poc.category:""]||"EG-Body-Interior"),approver:approvers[i%approvers.length]},
    supplier:{distributed:sIdx>=4,distributedOn:sIdx>=4?addDays(T0,-(7+i)):null,offerReceived:sIdx>=5||(sIdx===4&&i===3),price:sIdx>=4?Math.round(tot*(1.03+h("op|"+c.id)%5/100)):0,timeline:sIdx>=4?(4+h("tl|"+c.id)%5)+" weeks":"",investment:sIdx>=4?"₹"+(2+h("iv|"+c.id)%6)+".2 L (tooling mod)":"",tooling:sIdx>=4?"1 tool · "+[1,2,4][h("tc|"+c.id)%3]+" cavities":"",capacity:sIdx>=4?"OK — confirmed":"",locked:sIdx>=5,clar:[]},
    mod:{currency:"INR",rows:mod.map(r=>Object.assign({},r)),overwrites:[]},impact:{commercial:"",technical:"",supplyChain:"",production:""},
    approvals:approvalSeed(sIdx),implementation:IMPL_TASKS.map((t,k)=>({task:t,done:sIdx>=9||(sIdx===8&&c.id==="TC2"&&k<3)}))};
  const d=CD[c.id];
  if(sIdx>=6||(sIdx>=5&&d.supplier.locked)){ const f=1+(h("nf|"+c.id)%7)/100; d.mod.rows.forEach(r=>{ r.neu=Math.round(r.cur*f*100)/100; }); }   // a locked offer has produced new prices
  Object.assign(d.impact,impactText(d));
  if(sIdx>=9) c.status="Approved"; else if(sIdx>=8) c.status="Approved"; else if(sIdx>=7) c.status="Pending";
  return d;
}
function impactText(d){
  const c=d.ref,t=totals(d);
  return {commercial:`Piece price ${t.delta>=0?"rises":"falls"} by ${money(t.delta)} (${t.pct>=0?"+":"−"}${Math.abs(t.pct).toFixed(1)}%) against ${inr(t.cur)} today; tooling modification ${d.supplier.investment||"to be quoted"}.`,
    technical:`${c.type} on ${c.part} (${c.partNo}) — ${d.reason.toLowerCase()}. Drawing revision to be released after approval.`,
    supplyChain:`${c.supplier} confirms capacity; lead time ${d.supplier.timeline||"to be confirmed"} during changeover.`,
    production:`Line changeover aligned with the next project milestone; updated poka-yoke fixture and first-parts inspection required.`};
}
DATA.changes.forEach((c,i)=>seedChange(c,i)); ctx.activeId=(DATA.changes.find(c=>c.id==="TC4")||DATA.changes[0]).id;
/* the E6 seed carried a generic engine flow / sign-off task for these workflow numbers; the module's own approval chain replaces them */
(function(){ const wfs=new Set(DATA.changes.map(c=>c.wf));
  for(let i=ApprovalEngine.flows.length-1;i>=0;i--) if(wfs.has(ApprovalEngine.flows[i].wf)) ApprovalEngine.flows.splice(i,1);
  TaskCentre.tasks.forEach(t=>{ if(wfs.has(t.wf)&&t.state==="open"&&t.type==="approval-pending") t.state="done"; }); Flow.fixIds(); })();
window.V8TC={focus:id=>{ if(CD[id]) ctx.activeId=id; }};

/* ------------------------------------------------------------ calculations */
function totals(d){ const m=d.mod.rows, cur=m.reduce((s,r)=>s+(+r.cur||0),0), neu=m.reduce((s,r)=>s+(r.neu!=null?+r.neu:+r.cur||0),0), delta=neu-cur;
  return {cur,neu,delta,pct:cur?delta/cur*100:0}; }
function volumeOf(d){ const code=d.ref.project, v=DATA.carVolumes.filter(x=>x.project===code).sort((a,b)=>b.year-a.year)[0], cbd=DATA.cbds[d.ref.partNo];
  return {car:v?v.volume:0,qty:cbd?cbd.qtyPerCar:1,annual:(v?v.volume:0)*(cbd?cbd.qtyPerCar:1),year:v?v.year:null}; }
let EVAL_AT=null, EVAL_MAP=null;
function evalOf(m,partNo){ if(EVAL_AT!==m){ EVAL_AT=m; EVAL_MAP=new Map(S.evaluate(m).map(x=>[x.pt.id,x])); } return EVAL_MAP.get(partNo); }
function riskOf(d){ return riskCalc(totals(d).pct,d.ref.supplier,d.ref.partNo); }
function riskCalc(pct,supplier,partNo){
  const t={pct}, sup=DATA.suppliers.find(s=>s.name===supplier), m=K.model(), e=evalOf(m,partNo);
  const f=[];
  f.push({k:"Cost",hit:t.pct>3,txt:t.pct>3?`Piece price ${t.pct.toFixed(1)}% up`:"Cost delta contained"});
  const next=e&&e.next, days=next?Math.round((next.R-m.today)/S.DAY):null;
  f.push({k:"Delay",hit:!!(next&&days<=90&&e.status!=="ok"),txt:next?`Next milestone ${next.id} in ${days} days${e.status!=="ok"?" — supplier commitment "+(S.STATUS[e.status]||"").toLowerCase():" — on track"}`:"No open milestone"});
  const hi=sup&&/high/i.test(String(sup.riskRating));
  f.push({k:"Supplier",hit:!!hi,txt:sup?`${sup.name}: risk rating ${sup.riskRating}, ${sup.importDep!=null?"import dependence "+sup.importDep+"%":"domestic"}`:"Supplier not found"});
  const n=f.filter(x=>x.hit).length; return {level:n>=3?"High":n===2?"Medium":"Low",factors:f};
}
const riskChip=l=>Components.chip(l==="Low"?"Green":l==="Medium"?"Amber":"Red");
const typeChip=t=>`<span class="chip ${{AEKO:"chip-blue",AWE:"chip-amber",AeA:"chip-green"}[t]||"chip-gray"}"><span class="chip-dot"></span>${esc(t)}</span>`;
function advance(name){ const d=ctx.get(), i=STAGES.indexOf(name); if(i>d.stageIdx){ d.stageIdx=i; d.ref.stage=name; } Store.audit("Technical Change","Stage → "+name,d.ref.wf); }
const can={eval:()=>["aeko","admin","pm"].includes(RBAC.role),buyer:()=>["buyer","admin","pm"].includes(RBAC.role),buyerSrm:()=>["buyer","srm","admin","pm"].includes(RBAC.role),
  impact:()=>["buyer","approver","admin","pm"].includes(RBAC.role),approve:()=>["approver","admin","pm","finance","commodity","srm"].includes(RBAC.role),confirm:()=>["aeko","admin","pm"].includes(RBAC.role)};
const roleLabel=()=>(ROLES.find(r=>r.id===RBAC.role)||{}).label||RBAC.role;
const readOnlyChip=()=>`<span class="chip chip-amber"><span class="chip-dot"></span>Read-only for ${esc(roleLabel())}</span>`;
const btn=(id,label,primary,dis)=>`<button type="button" class="btn${primary?" btn-primary":""}" id="${id}"${dis?" disabled":""}>${label}</button>`;

/* ------------------------------------------------------------ shared page parts */
function head(title,sub){
  const d=ctx.get(), c=d.ref, w=document.createElement("div"); w.className="v8-page tc-page";
  w.appendChild(U.header(title,sub));
  const bar=U.el(`<div class="v8-filters tc-ctx"><label class="v8-f"><span>Active change</span><select>${DATA.changes.map(x=>`<option value="${esc(x.id)}"${x.id===ctx.activeId?" selected":""}>${esc(x.wf)} · ${esc(x.part)} · ${esc(K.short(carName(x.project)))}</option>`).join("")}</select></label>
    <div class="tc-ctx-chips">${typeChip(c.type)} ${Components.wfChip(c.wf)} ${Components.chip(c.status)}</div><span class="v8-asof">Change ID <b>${esc(d.changeId)}</b> · ${esc(c.partNo)} · ${esc(c.supplier)}</span></div>`);
  bar.querySelector("select").onchange=e=>ctx.set(e.target.value); w.appendChild(bar);
  w.appendChild(U.el(`<div class="tc-flow">${STAGES.map((s,i)=>`<div class="sf ${i<d.stageIdx?"done":i===d.stageIdx?"current":""}"><div class="n">${i<d.stageIdx?"✓":i+1}</div>${esc(s)}</div>`).join("")}</div>`));
  return w;
}
const add=(w,html)=>{ const e=U.el(html); w.appendChild(e); return e; };
const gate=(w,icon,title,text,btnLabel,screen)=>{ add(w,`<div class="coming-soon tc-gate"><div class="cs-icon">${icon}</div><div class="cs-title">${title}</div><div class="text-muted">${text}</div><button type="button" class="btn btn-primary" style="margin-top:14px" onclick="Router.go('${screen}','techchange')">${btnLabel}</button></div>`); return w; };
const ai=(txt)=>`<span class="tc-ai${txt==="verified"?" ok":""}">${txt==="verified"?"✓ verified":"✦ AI-extracted"}</span>`;

/* ------------------------------------------------------------ 1 · Technical Change Dashboard (management view)
   Every figure comes from the module's own records: DATA.changes (status, stage, type), the MOD sheets (piece-price delta), the car-volume master
   (annualised impact = piece-price delta × quantity per car × annual volume — the calculation the previous dashboard used), the project master (SOP date),
   the risk indicator (riskOf), the supplier-offer rule (reminders from day 5) and the approval engine's escalation rule. Nothing is estimated or invented:
   where a record does not exist (due dates, in-production projects, running changes, history by month) the panel says so. */
let FILT="all";
const TF={project:""};
const sopOf=code=>{ const p=projOf(code); return p&&p.sop?p.sop:null; };
const inProduction=code=>{ const s=sopOf(code); return !!s&&s<=T0; };
const OFFER_DAYS=5;   // Supplier Offers: "Daily reminders to the buyer from day 5"
const lakh=v=>(v<0?"−":v>0?"+":"")+cr(Math.abs(v));
function tcModel(){
  const list=DATA.changes.filter(c=>!TF.project||c.project===TF.project);
  const rows=list.map(c=>{ const d=CD[c.id], t=totals(d), v=volumeOf(d), priced=t.neu!==t.cur; return {c,d,t,v,priced,ann:priced?t.delta*v.annual:null,stage:STAGE_ALIAS[c.stage]||c.stage,risk:riskOf(d)}; });
  return {rows,list};
}
const tcK=(o)=>`<div class="pd-kpi${o.act?" kpi-link":""}"${o.act?` data-act="${o.act}" role="button" tabindex="0"`:""} title="${esc(o.tip||"")}"><div class="top"><span class="ic ${o.ict||""}">${Icons.svg(o.icon)}</span><span class="lb wrap">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span></div><div class="sb" title="${esc(String(o.sub||"").replace(/<[^>]*>/g,""))}">${o.sub||""}</div></div>`;
const tcInfo=t=>`<span class="pd-i" title="${esc(t)}">${Icons.svg("info")}</span>`;
const tcPanel=(title,tip,body,extra)=>U.panel(`${title}${tip?tcInfo(tip):""}`,body,extra);
const tcEmpty=t=>`<div class="pd-empty">${t}</div>`;
const tcLink=(act,label)=>`<div class="pd-more"><a href="#" data-act="${act}">${label}${Icons.svg("chevron-right")}</a></div>`;
const STATUS_COL={Open:"var(--info)",Pending:"var(--c-amber,#e0a030)",Approved:"var(--ok)"};
/* horizontal bar rows: items [{label,value}] */
function tcBars(items,total,color){ const mx=Math.max(1,...items.map(i=>i.value));
  return `<div class="tcd-bars">${items.map(i=>`<div class="r"><span class="lb" title="${esc(i.label)}">${esc(i.label)}</span><span class="tr"><i style="width:${i.value?Math.max(3,i.value/mx*100):0}%;background:${i.color||color||"var(--brand)"}"></i></span><b class="n">${i.value}</b><span class="p">${total?Math.round(i.value/total*100):0}%</span></div>`).join("")}</div>`; }

function buildDashboard(){
  const {rows,list}=tcModel(), n=list.length, w=document.createElement("div"); w.className="v8-page v8-board tc-page tcd";
  /* ---------- header: title, filter, data-as-of */
  const hd=U.header("Technical Change Dashboard","Overview of technical changes, financial impact, production status and key decisions.");
  const codes=[...new Set(DATA.projects.map(p=>p.code))], pj=projOf(TF.project);
  const hr=document.createElement("div"); hr.className="tcd-hr";
  hr.innerHTML=`<label class="pd-f"><span>Project</span><span class="pd-sel">${Icons.svg("car")}<select data-f="project"><option value="">All projects</option>${codes.map(c=>`<option value="${esc(c)}"${c===TF.project?" selected":""}>${esc(carName(c))} (${DATA.changes.filter(x=>x.project===c).length})</option>`).join("")}</select></span></label>
    <div class="tcd-meta"><span>Data as of <b>${esc(fmtDate(T0))}</b></span><span class="pd-ill">Illustrative data — synthetic scenario</span></div>`;
  const car=pj&&window.V8Art?window.V8Art.car(pj.code):""; if(car) hr.insertAdjacentHTML("afterbegin",`<div class="tcd-car">${car}</div>`);
  hr.addEventListener("change",e=>{ if(e.target.dataset&&e.target.dataset.f==="project"){ TF.project=e.target.value; Router.render(); } });
  hd.appendChild(hr); w.appendChild(hd);

  /* ---------- KPI row */
  const st=s=>rows.filter(r=>r.c.status===s).length, closed=rows.filter(r=>r.d.stageIdx>=9).length, inImpl=rows.filter(r=>r.c.status==="Approved"&&r.d.stageIdx<9).length;
  const pricedR=rows.filter(r=>r.priced), avgPct=pricedR.length?pricedR.reduce((s,r)=>s+r.t.pct,0)/pricedR.length:null, ann=pricedR.reduce((s,r)=>s+r.ann,0);
  const pc=v=>n?Math.round(v/n*100)+"% of total":"—";
  add(w,`<div class="pd-kw"><div class="pd-kpis k7">${[
    tcK({icon:"file",label:"Total changes",value:n,sub:`${new Set(rows.map(r=>r.c.project)).size} project${new Set(rows.map(r=>r.c.project)).size===1?"":"s"}`,tip:"Every technical change in the selection (AEKO, AWE, AeA)."}),
    tcK({icon:"clipboard",label:"Open",value:st("Open"),sub:pc(st("Open")),ict:"info",tip:"Status Open: intake and evaluation."}),
    tcK({icon:"clock",label:"Pending",value:st("Pending"),sub:pc(st("Pending")),ict:"warn",tip:"Status Pending: validation, supplier offer, MOD sheet, impact analysis or approval."}),
    tcK({icon:"check-circle",label:"Approved",value:st("Approved"),sub:inImpl||closed?`${inImpl} in implementation · ${closed} closed`:pc(st("Approved")),ict:"ok",tip:"Status Approved: approved changes, whether being implemented or already closed."}),
    tcK({icon:"settings",label:"Implemented",value:closed,sub:closed?pc(closed):"none closed yet",tip:"Changes whose implementation tasks are complete and that are closed."}),
    tcK({icon:"scale",label:"Avg price effect (per part)",value:avgPct==null?"—":(avgPct>0?"+":"−")+Math.abs(avgPct).toFixed(1)+"%",tone:avgPct==null?"":avgPct>0?"bad":"good",sub:avgPct==null?"no MOD sheet priced yet":`${avgPct>0?"cost increase":"cost reduction"} · ${pricedR.length} priced`,tip:"Average piece-price change of the changes that already have a priced MOD sheet."}),
    tcK({icon:"bar-chart",label:"Annualized impact",value:pricedR.length?lakh(ann):"—",tone:!pricedR.length?"":ann>0?"bad":"good",sub:pricedR.length?(ann>0?"net cost increase":"net saving")+" per year":"no MOD sheet priced yet",tip:"Piece-price change × quantity per car × annual volume of the project, summed over the priced changes."})].join("")}</div></div>`);

  /* ---------- row 1: status · type · stage */
  const r1=add(w,`<div class="pd-gw"><div class="pd-row c3"></div></div>`).firstChild;
  const slices=["Open","Pending","Approved"].map(s=>({label:s,value:st(s),color:STATUS_COL[s]})), seg=0;
  const donut=n?C.donut(slices.filter(s=>s.value),{size:176,center:String(n),centerSub:"Total changes",aria:"Changes by status"}).replace(/<ul class="pc-dl">[\s\S]*?<\/ul>/,""):"";
  r1.appendChild(U.el(tcPanel("Changes by status","Status as held in the workflow: Open, Pending, Approved.",n?`<div class="tcd-status"><div class="dn">${donut}</div><div class="lg">${slices.map(s=>`<div class="o"><i style="background:${s.color}"></i><span>${s.label}</span><b>${s.value}</b><em>${Math.round(s.value/n*100)}%</em></div>`).join("")}</div></div>`:tcEmpty("No technical change in this selection."))));
  const types=[...new Set(DATA.changes.map(c=>c.type))].map(t=>({label:t,value:rows.filter(r=>r.c.type===t).length})).sort((a,b)=>b.value-a.value);
  r1.appendChild(U.el(tcPanel("Changes by type","The change categories present in the Technical Change module.",n?tcBars(types.filter(t=>t.value||!TF.project),n,"var(--brand)"):tcEmpty("No technical change in this selection."))));
  const stages=STAGES.map(s=>({label:s,value:rows.filter(r=>r.stage===s).length}));
  r1.appendChild(U.el(tcPanel("Changes by stage","Where each change sits in the workflow today.",n?tcBars(stages,n,"var(--info)"):tcEmpty("No technical change in this selection."))));

  /* ---------- row 2: financial · by project · production */
  const r2=add(w,`<div class="pd-gw"><div class="pd-row c3"></div></div>`).firstChild;
  const sav=pricedR.filter(r=>r.ann<0).reduce((s,r)=>s-r.ann,0), add$=pricedR.filter(r=>r.ann>0).reduce((s,r)=>s+r.ann,0), gross=sav+add$;
  const finBody=pricedR.length?`<div class="tcd-fin3"><div class="g"><span>Estimated savings<small>annualised</small></span><b class="good">${cr(sav)}</b><em>${gross?Math.round(sav/gross*100):0}% of gross</em></div><div class="g"><span>Additional cost<small>annualised</small></span><b class="bad">${cr(add$)}</b><em>${gross?Math.round(add$/gross*100):0}% of gross</em></div><div class="g"><span>Net impact<small>annualised</small></span><b class="${ann>0?"bad":"good"}">${lakh(ann)}</b><em>${ann>0?"net cost increase":"net saving"}</em></div></div>`+
    C.bars({signed:true,fmt:v=>lakh(v),items:pricedR.slice().sort((a,b)=>Math.abs(b.ann)-Math.abs(a.ann)).map(r=>({label:r.c.part+" · "+K.short(carName(r.c.project)),value:r.ann,note:r.c.wf}))})+`<div class="tcd-note">${pricedR.length} of ${n} change${n===1?"":"s"} ${pricedR.length===1?"has":"have"} a priced MOD sheet; the rest are not yet priced and are not counted. Cost increases in red, savings in green. No month-by-month history exists for technical changes.</div>`
    :tcEmpty("No change in this selection has a priced MOD sheet yet, so there is no financial impact to show.");
  r2.appendChild(U.el(tcPanel("Financial impact","Annualised impact = piece-price change × quantity per car × annual volume, for changes with a priced MOD sheet.",finBody)));
  const byP=[...new Set(rows.map(r=>r.c.project))].map(code=>{ const l=rows.filter(r=>r.c.project===code), s=x=>l.filter(r=>r.c.status===x).length; return {code,t:l.length,o:s("Open"),p:s("Pending"),a:s("Approved"),i:l.filter(r=>r.d.stageIdx>=9).length}; }).sort((a,b)=>b.t-a.t);
  r2.appendChild(U.el(tcPanel("Changes by project","Counts of the changes in the selection, per project.",byP.length?`<div class="pd-t tcd-proj"><div class="h"><span>Project</span><span class="ra">Total</span><span class="ra">Open</span><span class="ra">Pending</span><span class="ra">Approved</span><span class="ra">Impl.</span></div>${byP.map(x=>`<div class="r" data-act="tc:proj=${esc(x.code)}" role="button" tabindex="0" title="Show only ${esc(carName(x.code))}"><span class="n">${esc(carName(x.code))}<small>SOP ${esc(sopOf(x.code)?fmtDate(sopOf(x.code)):"—")}</small></span><span class="v">${x.t}</span><span class="v">${x.o}</span><span class="v">${x.p}</span><span class="v">${x.a}</span><span class="v">${x.i}</span></div>`).join("")}</div>`:tcEmpty("No technical change in this selection."))));
  /* production impact: a project's production status (SOP date) is shown apart from the change's own status */
  const inProdN=rows.filter(r=>inProduction(r.c.project)).length, running=rows.filter(r=>r.c.type==="Running").length, awaiting=rows.filter(r=>r.c.status==="Approved"&&r.d.stageIdx<9);
  const nextSop=[...new Set(DATA.projects.map(p=>p.sop).filter(Boolean))].sort().find(s=>s>T0), taskDone=awaiting.reduce((s,r)=>s+r.d.implementation.filter(t=>t.done).length,0), taskAll=awaiting.reduce((s,r)=>s+r.d.implementation.length,0);
  const prodRows=rows.slice().sort((a,b)=>String(sopOf(a.c.project)).localeCompare(String(sopOf(b.c.project)))||b.d.stageIdx-a.d.stageIdx).slice(0,5);
  r2.appendChild(U.el(tcPanel("Production impact","A project's production status (SOP date) is shown separately from the status of each change. No implementation date is recorded for individual changes.",`<div class="tcd-mini3"><div class="m"><span>Changes in in-production projects</span><b>${inProdN}</b><em>${DATA.projects.some(p=>inProduction(p.code))?"project SOP reached":`no project in production yet${nextSop?" · first SOP "+esc(fmtDate(nextSop)):""}`}</em></div><div class="m"><span>Running changes</span><b>${running}</b><em>${running?"type Running":"none registered"}</em></div><div class="m"><span>Approved, awaiting implementation</span><b>${awaiting.length}</b><em>${awaiting.length?`${taskDone} of ${taskAll} tasks done`:"none"}</em></div></div>`+
    (prodRows.length?`<div class="pd-t tcd-prod"><div class="h"><span>#</span><span>Change</span><span>Type</span><span>Project SOP</span><span class="ra">Status</span></div>${prodRows.map((r,i)=>`<div class="r" data-act="tc:open=${esc(r.c.id)}" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n"><b>${esc(r.c.part)}</b><small>${esc(K.short(carName(r.c.project)))} · ${esc(r.stage)}</small></span><span class="s">${esc(r.c.type)}</span><span class="s">${esc(sopOf(r.c.project)?fmtDate(sopOf(r.c.project)):"—")}</span><span class="ra">${Components.chip(r.c.status)}</span></div>`).join("")}</div>`+tcLink("tcgo:implementation","View implementation"):""))));

  /* ---------- row 3: high impact · overdue · management attention */
  const r3=add(w,`<div class="pd-gw"><div class="pd-row c3"></div></div>`).firstChild;
  const hi=pricedR.slice().sort((a,b)=>Math.abs(b.ann)-Math.abs(a.ann)).slice(0,5);
  r3.appendChild(U.el(tcPanel("High-impact changes","Changes with the largest annualised financial impact (priced MOD sheets only), biggest first.",hi.length?`<div class="pd-t tcd-hi"><div class="h"><span>#</span><span>Change</span><span>Type</span><span class="ra">Annualised</span><span class="ra">Status</span></div>${hi.map((r,i)=>`<div class="r" data-act="tc:open=${esc(r.c.id)}" role="button" tabindex="0" title="Open ${esc(r.c.wf)}"><span class="k">${i+1}</span><span class="n"><b>${esc(r.c.part)}</b><small>${esc(K.short(carName(r.c.project)))} · ${esc(r.d.reason)}</small></span><span class="s">${esc(r.c.type)}</span><span class="v ${r.ann>0?"bad":"good"}">${lakh(r.ann)}</span><span class="ra">${Components.chip(r.c.status)}</span></div>`).join("")}</div>`:tcEmpty("No change in this selection has a priced MOD sheet yet."))));
  /* overdue: only against rules the application already has — a supplier offer is due within 5 days of the package being sent */
  const od=rows.filter(r=>r.d.supplier.distributed&&r.d.supplier.distributedOn&&!r.d.supplier.locked).map(r=>({r,days:Store.daysSince(r.d.supplier.distributedOn)-OFFER_DAYS})).filter(x=>x.days>0).sort((a,b)=>b.days-a.days);
  r3.appendChild(U.el(tcPanel("Overdue changes",`Measured against the existing rule: a supplier offer is expected within ${OFFER_DAYS} days of the change package being sent (buyer reminders start on day ${OFFER_DAYS}). Changes have no other due date in the data.`,od.length?`<div class="pd-t tcd-od"><div class="h"><span>#</span><span>Change</span><span>Stage</span><span class="ra">Days over</span><span>Owner</span></div>${od.map((x,i)=>`<div class="r" data-act="tc:open=${esc(x.r.c.id)}" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n"><b>${esc(x.r.c.part)}</b><small>${esc(K.short(carName(x.r.c.project)))} · supplier offer</small></span><span class="s">${esc(x.r.stage)}</span><span class="v bad">${x.days}</span><span class="s">${esc(x.r.d.assign.buyer)}</span></div>`).join("")}</div>`:tcEmpty(`No change is past its due date: every supplier offer is inside the ${OFFER_DAYS}-day window or already locked.`))));
  /* management attention: only what the data evidences — the module's risk indicator, the offer rule and the approval engine's escalation */
  const att=[], LV={High:0,Medium:1,Low:2};
  rows.forEach(r=>{ r.risk.factors.filter(f=>f.hit).forEach(f=>att.push({r,issue:f.txt,kind:f.k==="Cost"?"High cost increase":f.k==="Delay"?"Production milestone at risk":"Supplier risk"})); });
  od.forEach(x=>att.push({r:x.r,issue:`Supplier offer ${x.days} day${x.days===1?"":"s"} past the ${OFFER_DAYS}-day window`,kind:"Delayed supplier response"}));
  rows.forEach(r=>{ const f=r.d.flow, e=f&&ApprovalEngine.escalationFor(f); if(e) att.push({r,issue:e,kind:"Delayed approval"}); });
  rows.forEach(r=>{ if(r.d.stageIdx>=2&&r.d.stageIdx<=3&&!r.d.evalVerified) att.push({r,issue:"Evaluation sheet not yet verified",kind:"Validation dependency"}); });
  att.sort((a,b)=>LV[a.r.risk.level]-LV[b.r.risk.level]); const attS=att.slice(0,6);
  r3.appendChild(U.el(tcPanel("Management attention required","Issues flagged only where the data shows evidence: the change risk indicator (cost, milestone, supplier), the supplier-offer rule and approval escalations.",attS.length?`<div class="pd-t tcd-att"><div class="h"><span>#</span><span>Issue</span><span class="ra">Risk</span></div>${attS.map((x,i)=>`<div class="r" data-act="tc:open=${esc(x.r.c.id)}" role="button" tabindex="0" title="${esc(x.issue)}"><span class="k">${i+1}</span><span class="n"><b>${esc(x.kind)}</b><small>${esc(K.short(carName(x.r.c.project)))} · ${esc(x.r.c.part)} · ${esc(x.issue)}</small></span><span class="ra">${riskChip(x.r.risk.level)}</span></div>`).join("")}</div>${att.length>attS.length?`<div class="tcd-note">${att.length-attS.length} more flagged — open the change for the full risk view.</div>`:""}`:tcEmpty("Nothing needs management attention: no cost, milestone, supplier, approval or validation issue is evidenced in this selection."))));

  /* ---------- the operational status board (unchanged behaviour) */
  const brows=list.filter(c=>FILT==="all"||c.status===FILT);
  add(w,U.panel(`Status board <span class="count-pill">${brows.length}</span>`,`<div class="fc-segs tight">${[["all","All"],["Open","Open"],["Pending","Pending"],["Approved","Approved"]].map(([k,l])=>`<button type="button" class="fc-seg ${FILT===k?"on":""}" data-act="tc:filt=${k}">${l}</button>`).join("")}</div>`+
    U.table(["Workflow","Type","Part","Supplier","Stage","Status","Δ cost / pc","Risk",""],brows.map(c=>{ const d=CD[c.id], t=totals(d), r=riskOf(d);
      return `<tr class="v8-row" data-act="tc:open=${esc(c.id)}" role="button" tabindex="0"><td>${Components.wfChip(c.wf)}</td><td>${typeChip(c.type)}</td><td><b>${esc(c.part)}</b><small class="v8-sm">${esc(K.short(carName(c.project)))} · ${esc(c.partNo)}</small></td><td>${esc(c.supplier)}</td><td>${esc(STAGE_ALIAS[c.stage]||c.stage)}</td><td>${Components.chip(c.status)}</td><td><span class="${t.delta>0?"v8-bad":t.delta<0?"v8-good":""}">${t.neu===t.cur?"—":money(t.delta)}</span></td><td>${riskChip(r.level)}</td><td><button type="button" class="btn btn-sm">Open</button></td></tr>`; }).join("")),
    {noPad:true,style:"margin-top:0",sub:"Click a row to continue the change at its current stage"}));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 2 · Intake */
function buildIntake(){
  const w=document.createElement("div"); w.className="v8-page tc-page"; w.appendChild(U.header("Create Change","Register an AEKO / AWE / AeA / running / model-year / supplier-proposal change. A Change ID and a unique workflow number are generated."));
  const g=add(w,`<div class="v8-g v8-g2"></div>`), projects=DATA.projects;
  const form=U.el(U.panel("New change",`<div id="ik">
    <div class="form-row"><label>Change type</label><select id="ik-type">${TYPES.map(t=>`<option>${t}</option>`).join("")}</select></div>
    <div class="form-row"><label>Car</label><select id="ik-project">${projects.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="form-row"><label>Supplier</label><select id="ik-supplier"></select></div>
    <div class="form-row"><label>Part</label><select id="ik-part"></select></div>
    <div class="form-row"><label>Reason / title</label><input id="ik-reason" placeholder="e.g. Cavity re-profiling on rear bracket"></div>
    <div class="form-row" id="ik-manual-wrap" style="display:none"><label>Manual TUL entry (model-year)</label><textarea id="ik-manual" placeholder="The coordinator may enter TUL fields manually for internal tracking…"></textarea><div class="hint">Manual entry is for model-year changes where no supplier PDF exists.</div></div></div>`));
  g.appendChild(form);
  const docs=[["📄","change_package.pdf","1.8 MB · technical change document"],["📊","cost_impact_worksheet.xlsx","96 KB · price & BOM lines"],["📐","drawing.pdf","640 KB · engineering drawing"]];
  g.appendChild(U.el(U.panel("Change documents",`<div class="upload-drop"><div class="icon">📎</div><div><b>Drop change PDF + Excel + drawings</b></div><div class="text-muted" style="margin-top:6px">PDF · XLSX · DWG / PDF drawings (sample files attached)</div></div><div class="tc-docs">${docs.map(d=>`<div class="tc-doc"><div class="di">${d[0]}</div><div class="dn"><b>${d[1]}</b><div>${d[2]}</div></div><span class="chip chip-green"><span class="chip-dot"></span>attached</span></div>`).join("")}</div>`)));
  const act=add(w,`<div class="panel" style="margin-top:16px"><div class="panel-body tc-actbar">${btn("ik-create","Create change &amp; generate IDs",true)}<span class="text-muted" style="font-size:12px">A Change ID and workflow number are assigned and AI extraction is queued.</span><span id="ik-result" style="margin-left:auto"></span></div></div>`);
  const proj=form.querySelector("#ik-project"), part=form.querySelector("#ik-part"), sup=form.querySelector("#ik-supplier");
  const fill=(resetSup)=>{ const inCar=DATA.parts.filter(p=>p.project===proj.value), sups=[...new Set(inCar.map(p=>p.supplier))].sort(), keep=resetSup?"":sup.value;
    sup.innerHTML=`<option value="">All suppliers (${sups.length})</option>`+sups.map(x=>`<option${x===keep?" selected":""}>${esc(x)}</option>`).join("");
    const l=inCar.filter(p=>!sup.value||p.supplier===sup.value).sort((a,b)=>a.designation.localeCompare(b.designation));
    part.innerHTML=l.map(p=>`<option value="${esc(p.number)}">${esc(PartPick.label(p,l))}</option>`).join(""); };
  proj.onchange=()=>fill(true); sup.onchange=()=>fill(false); fill(true);
  form.querySelector("#ik-type").onchange=e=>{ form.querySelector("#ik-manual-wrap").style.display=e.target.value==="Model-Year"?"block":"none"; };
  act.querySelector("#ik-create").onclick=()=>{
    const type=form.querySelector("#ik-type").value, seq=String(50+DATA.changes.length+1).padStart(4,"0"), wf=`${PREFIX[type]}-2026-${seq}`, p=DATA.parts.find(x=>x.number===part.value); if(!p) return;
    const c={id:"TC"+(DATA.changes.length+1),type,wf,part:p.designation,status:"Open",stage:"Intake",partNo:p.number,project:p.project,supplier:p.supplier,supplierDuns:(DATA.suppliers.find(s=>s.name===p.supplier)||{}).duns};
    DATA.changes.push(c); const d=seedChange(c,DATA.changes.length-1,0); d.changeId="CHG-2026"+seq; d.createdOn=T0; d.reason=form.querySelector("#ik-reason").value||"—"; d.mod.rows.forEach(r=>{ r.neu=null; }); Object.assign(d.impact,{commercial:"",technical:"",supplyChain:"",production:""});
    ctx.activeId=c.id; Store.audit("Technical Change","Created ("+type+")",wf);
    act.querySelector("#ik-result").innerHTML=`<span class="chip chip-green"><span class="chip-dot"></span>Created</span> ${Components.wfChip(wf)} <span class="text-muted" style="font-size:12px">Change ID <b>${d.changeId}</b></span>`;
    Toast.show(`Change created · ${wf} · ${d.changeId}. AI extraction queued.`,"success"); setTimeout(()=>Router.go("doc-upload","techchange"),700); };
  return w;
}

/* ------------------------------------------------------------ 3 · Document upload & AI extraction */
function buildDoc(){
  const d=ctx.get(), w=head("AI Extraction","AI reads the uploaded change PDF and Excel and drafts the evaluation sheet — removing hours of manual reading.");
  const g=add(w,`<div class="v8-g v8-g2"></div>`);
  g.appendChild(U.el(U.panel("Uploaded documents",`<div class="tc-docs"><div class="tc-doc"><div class="di">📄</div><div class="dn"><b>${esc(d.ref.type)}_change_package.pdf</b><div>1.8 MB · technical change document</div></div><span class="chip chip-green"><span class="chip-dot"></span>attached</span></div>
    <div class="tc-doc"><div class="di">📊</div><div class="dn"><b>cost_impact_worksheet.xlsx</b><div>96 KB · price &amp; BOM lines</div></div><span class="chip chip-green"><span class="chip-dot"></span>attached</span></div>
    <div class="tc-doc"><div class="di">📐</div><div class="dn"><b>drawing_${esc(d.ref.partNo)}.pdf</b><div>640 KB · engineering drawing</div></div><span class="chip chip-green"><span class="chip-dot"></span>attached</span></div></div>`)));
  const ep=U.el(U.panel("AI extraction",`<div id="ax"></div>`)); g.appendChild(ep); const ax=ep.querySelector("#ax");
  const render=()=>{
    if(!d.extracted){ ax.innerHTML=`<div class="text-muted" style="font-size:12.5px;margin-bottom:14px">The extractor reads the PDF and Excel and maps their content to the ${TUL_FIELDS.length} TUL fields of the evaluation sheet. Every field is tagged ${ai("")} for the AEKO Coordinator to verify or edit.</div>${btn("ax-run","✦ Run AI extraction",true)}`;
      ax.querySelector("#ax-run").onclick=()=>{ ax.innerHTML=`<div class="tc-wait">✦ Reading documents &amp; extracting TUL fields…</div>`; setTimeout(()=>{ d.extracted=true; advance("AI Extraction"); Store.audit("Technical Change","AI extraction completed",d.ref.wf); Router.render(); },900); }; }
    else { ax.innerHTML=`<div class="tc-row"><span class="tc-ai ok">✓ Extraction complete</span><span class="text-muted" style="font-size:12px">${TUL_FIELDS.length} fields populated from PDF + Excel.</span></div>${U.table(["TUL field","Extracted value"],TUL_FIELDS.slice(0,8).map(f=>`<tr><td>${esc(f.label)}</td><td>${esc(d.tul[f.k])} ${ai("")}</td></tr>`).join(""))}<div style="margin-top:14px">${btn("ax-open","Open evaluation sheet →",true)}</div>`;
      ax.querySelector("#ax-open").onclick=()=>Router.go("eval-sheet","techchange"); } };
  render(); return w;
}

/* ------------------------------------------------------------ 4 · Evaluation sheet (TUL) */
function buildEval(){
  const d=ctx.get(), w=head("Evaluation Sheet","Drafted from the AI-extracted TUL fields. The AEKO Coordinator verifies or edits each field, then triggers the sheet to the assigned buyer.");
  if(!d.extracted) return gate(w,"✦","No extraction yet","Run AI extraction on the uploaded documents first.","Go to AI extraction","doc-upload");
  const cw=can.eval(), ver=()=>Object.values(d.tulVerified).filter(Boolean).length;
  const panel=add(w,`<div class="panel"><div class="panel-header"><h3>TUL evaluation fields <span class="count-pill" id="ev-count">${ver()}/${TUL_FIELDS.length} verified</span></h3><div>${cw?`<button type="button" class="btn btn-sm" id="ev-all">Verify all</button>`:readOnlyChip()}</div></div><div class="panel-body"><div class="tc-fields" id="ev-fields"></div></div></div>`);
  const host=panel.querySelector("#ev-fields"), upd=()=>{ panel.querySelector("#ev-count").textContent=`${ver()}/${TUL_FIELDS.length} verified`; };
  TUL_FIELDS.forEach(f=>{ const el=U.el(`<div class="tc-field"><div class="lab"><span class="k">${esc(f.label)}</span><span class="b">${d.tulVerified[f.k]?ai("verified"):ai("")}</span></div><input value="${esc(d.tul[f.k]==null?"":d.tul[f.k])}" class="${d.tulEdited[f.k]?"edited":""}"${cw?"":" disabled"}></div>`), inp=el.querySelector("input"), b=el.querySelector(".b");
    inp.oninput=()=>{ d.tul[f.k]=inp.value; d.tulEdited[f.k]=true; d.tulVerified[f.k]=true; inp.classList.add("edited"); b.innerHTML=ai("verified"); upd(); };
    if(cw) inp.onblur=()=>{ if(!d.tulVerified[f.k]){ d.tulVerified[f.k]=true; b.innerHTML=ai("verified"); upd(); } }; host.appendChild(el); });
  if(cw) panel.querySelector("#ev-all").onclick=()=>{ TUL_FIELDS.forEach(f=>{ d.tulVerified[f.k]=true; }); Router.render(); Toast.show("All TUL fields marked verified.","success"); };
  const all=ver()===TUL_FIELDS.length;
  const foot=add(w,`<div class="panel" style="margin-top:16px"><div class="panel-body tc-actbar">${btn("ev-go","Verify &amp; trigger to buyer →",true,!cw||!all)}<span class="text-muted" style="font-size:12px">Sends the sheet and the PDF / technical details to <b>${esc(d.assign.buyer)}</b> and moves the change to validation.</span></div></div>`);
  if(cw&&all) foot.querySelector("#ev-go").onclick=()=>{ d.evalVerified=true; advance("Validation"); Toast.show(`Evaluation sheet triggered to ${d.assign.buyer}. Change moved to validation.`,"success"); Router.go("validation","techchange"); };
  return w;
}

/* ------------------------------------------------------------ 5 · Validation & assignment */
function checks(d){
  const c=d.ref, pr=projOf(c.project), p=dpOf(c), sup=DATA.suppliers.find(s=>s.name===c.supplier), bom=DATA.bomSop.find(b=>b.partNumber===c.partNo), pv=DATA.priceVersions[c.partNo];
  return [{k:"Project",ok:!!pr,hard:true,note:pr?`Matches project ${pr.name} (SOP ${fmtDate(pr.sop)})`:"Project not found"},{k:"Part",ok:!!p,hard:true,note:p?`Part ${c.partNo} found in the part master`:"Part not in master"},
    {k:"Supplier",ok:!!sup,hard:true,note:sup?`${sup.name} · DUNS ${sup.duns} · risk rating ${sup.riskRating}`:"Supplier not in master"},
    {k:"BOM",ok:!!bom,hard:false,note:bom?`Part present in BOM at SOP (${bom.xPerCar} per car)`:"Not yet linked in BOM at SOP"},
    {k:"Price",ok:!!pv,hard:false,note:pv?`Current price ${inr(pv[pv.length-1].price)} on record (${pv.length} versions)`:"No recorded price version"},
    {k:"Revision",ok:!d.revMismatch,hard:false,note:d.revMismatch?"Drawing revision C vs master revision B — mismatch":"Revision index consistent"}];
}
function buildValidation(){
  const d=ctx.get(), w=head("Validation & Assignment","Automatic checks against project, part, supplier, BOM, price and revision, then routing to the right people — with a return-for-correction path.");
  const ck=checks(d), hard=ck.filter(x=>!x.ok&&x.hard).length, warn=ck.filter(x=>!x.ok&&!x.hard).length, cw=can.eval();
  add(w,U.panel("Auto-validation",U.table(["Check","Result","Detail"],ck.map(x=>`<tr><td><b>${x.k}</b></td><td>${x.ok?Components.chip("Approved").replace("Approved","Passed"):x.hard?Components.chip("Rejected").replace("Rejected","Mismatch"):Components.chip("Pending").replace("Pending","Warning")}</td><td>${esc(x.note)}</td></tr>`).join("")),{noPad:true,right:hard?`<span class="chip chip-red"><span class="chip-dot"></span>${hard} mismatch${hard>1?"es":""}</span>`:warn?`<span class="chip chip-amber"><span class="chip-dot"></span>${warn} warning${warn>1?"s":""}</span>`:`<span class="chip chip-green"><span class="chip-dot"></span>All checks passed</span>`,sub:"Mismatches block the change; warnings are logged and the change may proceed"}));
  const g=add(w,`<div class="v8-g v8-g2" style="margin-top:16px"></div>`);
  const sel=(lab,id,val,opts)=>`<div class="form-row"><label>${lab}</label><select id="as-${id}"${cw?"":" disabled"}>${opts.map(o=>`<option${o===val?" selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  const ap=U.el(U.panel("Assignment",sel("Buyer","buyer",d.assign.buyer,buyers)+sel("SRM engineer","srm",d.assign.srm,srms)+sel("Engineering owner","engineering",d.assign.engineering,["EG-Body-Interior","EG-Chassis","EG-Electrical","EG-Powertrain"])+sel("Approver","approver",d.assign.approver,approvers)));
  g.appendChild(ap); if(cw) ["buyer","srm","engineering","approver"].forEach(id=>{ ap.querySelector("#as-"+id).onchange=e=>{ d.assign[id]=e.target.value; Toast.show("Assignment updated.","info"); }; });
  const tp=U.el(U.panel("Triage actions",`<div class="tc-kv"><span>Evaluation sheet</span><b>${d.evalVerified?Components.chip("Approved"):Components.chip("Pending")}</b></div><div class="tc-kv"><span>Documents</span><b>PDF + Excel + drawing attached</b></div><div class="tc-kv"><span>Current stage</span><b>${esc(STAGES[d.stageIdx])}</b></div>
    <div class="tc-actbar" style="margin-top:14px">${btn("tr-fwd","Trigger to buyer →",true,!cw)}${btn("tr-ret","↩ Return for correction",false,!cw)}</div><div class="hint" style="margin-top:8px">Return-for-correction sends the change back to the originator with the flagged checks.</div>`)); g.appendChild(tp);
  if(cw){ tp.querySelector("#tr-fwd").onclick=()=>{ if(hard) return Toast.show(`${hard} mismatch(es) open — resolve or return before triggering.`,"warn"); advance("Supplier Offers"); if(warn) Store.audit("Technical Change",warn+" validation warning(s) accepted",d.ref.wf); Toast.show(`Triggered to ${d.assign.buyer}. Supplier evaluation opened.`,"success"); Router.go("supplier-offers","techchange"); };
    tp.querySelector("#tr-ret").onclick=()=>{ d.ref.status="Open"; Store.audit("Technical Change","Returned for correction",d.ref.wf); Toast.show("Change returned for correction to the originator.","warn"); Router.render(); }; }
  return w;
}

/* ------------------------------------------------------------ 6 · Supplier evaluation & offers */
function buildOffers(){
  const d=ctx.get(), s=d.supplier, w=head("Supplier Offers","Send the change package to the supplier, capture the offer, run the clarification loop and lock the final offer. Daily reminders to the buyer from day 5.");
  const cw=can.buyerSrm(), days=s.distributedOn?Store.daysSince(s.distributedOn):0;
  if(!s.distributed){ const p=add(w,U.panel("Distribute change package",`<div class="text-muted" style="font-size:12.5px;margin-bottom:14px">Send the evaluation sheet, PDF and drawing to <b>${esc(d.ref.supplier)}</b> (DUNS ${esc(d.ref.supplierDuns)}) for an offer.</div>${btn("so-send","📤 Send package to supplier",true,!cw)}`));
    if(cw) p.querySelector("#so-send").onclick=()=>{ s.distributed=true; s.distributedOn=T0; advance("Supplier Offers"); Store.audit("Technical Change","Package sent to supplier",d.ref.wf); Toast.show("Package distributed. Day count started.","success"); Router.render(); }; return w; }
  if(days>=5&&!s.locked) add(w,`<div class="panel tc-warn"><div class="panel-body"><span style="font-size:18px">⏰</span><div><b>Daily reminder to buyer ${esc(d.assign.buyer)}</b><div class="text-muted" style="font-size:12px">Distributed ${esc(fmtDate(s.distributedOn))} · <b>${days} days</b> since distribution — offer ${s.offerReceived?"received but not locked":"still awaited"}.</div></div></div></div>`);
  const g=add(w,`<div class="v8-g v8-g2"></div>`), lock=s.locked, cur=totals(d).cur;
  const of=(lab,id,val,ph)=>`<div class="form-row"><label>${lab}</label><input id="so-${id}" value="${esc(val||"")}" placeholder="${esc(ph||"")}"${lock?" disabled":""}></div>`;
  const op=U.el(U.panel("Supplier offer",of("Offered piece price (₹)","price",s.price||"",cur?"current "+Math.round(cur):"")+of("Timeline / lead time","timeline",s.timeline)+of("Investment (tooling / CAPEX)","investment",s.investment)+of("Tooling","tooling",s.tooling)+of("Capacity","capacity",s.capacity)+
    `<div class="tc-actbar" style="margin-top:6px">${lock?`<span class="chip chip-green"><span class="chip-dot"></span>Offer locked — read-only</span>`:btn("so-save","Save offer")+btn("so-lock","🔒 Lock final offer",true)}</div>`,{right:lock?Components.chip("Approved"):s.offerReceived?Components.chip("Pending"):Components.chip("Open"),sub:s.price?`Today's piece price ${inr(cur)} · offer ${s.price>cur?"+":"−"}${inr(Math.abs(s.price-cur))}`:""})); g.appendChild(op);
  const read=()=>{ ["price","timeline","investment","tooling","capacity"].forEach(k=>{ const v=op.querySelector("#so-"+k).value; s[k]=k==="price"?(+v||0):v; }); };
  if(!lock&&cw){ op.querySelector("#so-save").onclick=()=>{ read(); s.offerReceived=true; Toast.show("Offer captured.","success"); Router.render(); };
    op.querySelector("#so-lock").onclick=()=>{ read(); s.offerReceived=true; s.locked=true; advance("MOD Sheet"); Store.audit("Technical Change","Supplier offer locked",d.ref.wf); Toast.show("Final offer locked. MOD sheet ready.","success"); Router.render(); }; }
  const cp=U.el(U.panel("Buyer ⇄ supplier clarifications",`<div id="so-clar" class="tc-clar"></div><div class="tc-row" style="margin-top:12px"><input id="so-in" placeholder="Add a clarification…"${lock?" disabled":""}>${btn("so-add","Send",true,lock)}</div>`)); g.appendChild(cp);
  const box=cp.querySelector("#so-clar"), paint=()=>{ box.innerHTML=s.clar.length?s.clar.map(m=>`<div class="tc-doc"><div class="di">${m.who==="Buyer"?"🧑‍💼":"🏭"}</div><div class="dn"><b>${m.who}</b><div>${esc(m.txt)}</div></div><span class="text-muted" style="font-size:10px">${esc(m.on)}</span></div>`).join(""):`<div class="text-muted" style="font-size:12px">No clarifications yet.</div>`; }; paint();
  if(!lock) cp.querySelector("#so-add").onclick=()=>{ const i=cp.querySelector("#so-in"), v=i.value.trim(); if(!v) return; s.clar.push({who:"Buyer",txt:v,on:T0}); i.value=""; paint(); setTimeout(()=>{ s.clar.push({who:"Supplier",txt:"Acknowledged — will revert with updated figures.",on:T0}); paint(); },500); };
  return w;
}

/* ------------------------------------------------------------ 7 · MOD sheet */
function buildMod(){
  const d=ctx.get(), m=d.mod, w=head("MOD Sheet","Current prices come from the part's cost breakdown (overwritable — the previous value is recorded). The buyer enters the new prices; the delta feeds the impact analysis."), cw=can.buyer();
  const panel=add(w,`<div class="panel"><div class="panel-header"><h3>Modification price sheet · ${m.currency}</h3><button type="button" class="btn btn-sm" id="mod-fetch">↻ Re-fetch current prices</button></div><div class="panel-body no-pad"><table class="mtable fc-table"><thead><tr><th>Cost component</th><th class="r">Current</th><th>Source</th><th class="r">New price</th><th class="r">Delta</th></tr></thead><tbody id="mod-rows"></tbody></table></div></div>`);
  const tb=panel.querySelector("#mod-rows"), fm=v=>nf(v,2);
  const paint=()=>{ tb.innerHTML=""; m.rows.forEach((r,i)=>{ const dl=r.neu!=null?r.neu-r.cur:null; const tr=document.createElement("tr");
      tr.innerHTML=`<td><b>${esc(r.comp)}</b></td><td class="r"><b>${fm(r.cur)}</b> <span class="tc-ai">✦ fetched</span>${r.prev!=null?`<small class="v8-sm">previous: <s class="v8-old">${fm(r.prev)}</s></small>`:""}</td><td><span class="text-muted" style="font-size:11.5px">${esc(r.src)}</span></td><td class="r"><input class="tc-num" value="${r.neu!=null?r.neu:""}" data-i="${i}"${cw?"":" disabled"}></td><td class="r">${dl==null?"—":`<span class="${dl>0?"v8-bad":dl<0?"v8-good":""}">${dl>0?"+":""}${fm(dl)}</span>`}</td>`; tb.appendChild(tr); });
    const t=totals(d), tr=document.createElement("tr"); tr.className="v8-tot"; tr.innerHTML=`<td><b>Total piece price</b></td><td class="r"><b>${fm(t.cur)}</b></td><td></td><td class="r"><b>${fm(t.neu)}</b></td><td class="r"><b class="${t.delta>0?"v8-bad":t.delta<0?"v8-good":""}">${t.delta>0?"+":""}${fm(t.delta)}</b></td>`; tb.appendChild(tr);
    tb.querySelectorAll("input[data-i]").forEach(inp=>{ inp.onchange=()=>{ m.rows[+inp.dataset.i].neu=inp.value===""?null:+inp.value; paint(); }; }); };
  paint();
  panel.querySelector("#mod-fetch").onclick=()=>{ const fresh=modRows(d.ref); m.rows.forEach((r,i)=>{ const f=fresh[i]; if(f&&Math.abs(f.cur-r.cur)>0.004){ r.prev=r.cur; r.cur=f.cur; } }); m.overwrites.push({on:T0,by:"knowledge source"}); Store.audit("Technical Change","MOD current prices re-fetched (previous recorded)",d.ref.wf); Toast.show("Current prices re-fetched from the cost breakdown. Previous values recorded where they changed.","success"); paint(); };
  const t0=totals(d), cbd=DATA.cbds[d.ref.partNo];
  add(w,`<div class="v8-foot" style="margin-top:10px">${cbd?`Current prices are the cost-tree nodes of <b>${esc(d.ref.part)}</b> (total ${inr(t0.cur)}).`:`No cost breakdown exists for this part yet — current prices are an estimated split of ${inr(t0.cur)}.`} A re-fetch picks up any CBD change made since.</div>`);
  const foot=add(w,`<div class="panel" style="margin-top:16px"><div class="panel-body tc-actbar">${btn("mod-next","Save MOD &amp; open impact analysis →",true,!cw)}<span class="text-muted" style="font-size:12px">The total delta is carried into the impact and cost analysis.</span></div></div>`);
  if(cw) foot.querySelector("#mod-next").onclick=()=>{ advance("Impact"); Toast.show("MOD sheet saved.","success"); Router.go("impact-analysis","techchange"); };
  return w;
}

/* ------------------------------------------------------------ 8 · Impact analysis */
const SIMILAR_NOTE={Electrical:"Connector re-pin · cost +₹16/pc · approved in 4 wk",Lighting:"Lens tooling change · tooling ₹3.8 L · no line stop",Sensors:"Calibration spec update · no cost change · low risk",Powertrain:"Casting die rework · tooling ₹6.1 L · 0-series buffer used",Chassis:"Bracket re-profile · cost −₹9/pc · approved in 3 wk",Braking:"Pad compound update · cost +₹11/pc · extra validation",HVAC:"Duct clip change · cost-neutral · low risk","Interior Trim":"Grain spec update · minor cost-down · low risk","Body Stampings":"Panel gauge change · cost −₹14/pc · tool mod","Fasteners":"Coating spec change · cost +₹2/pc · approved in 2 wk"};
function buildImpact(){
  const d=ctx.get(), w=head("Impact Analysis","Commercial, technical, supply-chain and production impact with cost and savings — plus similar historical changes and a data-driven risk indicator."), cw=can.impact();
  const t=totals(d), vol=volumeOf(d), annual=t.delta*vol.annual, risk=riskOf(d);
  add(w,`<div class="v8-kpis v8-kpis5">${[K.kcard("Piece-price delta",t.neu===t.cur?"—":money(t.delta),t.neu===t.cur?"MOD sheet not priced":`<span class="${t.delta>0?"v8-bad":"v8-good"}">${t.delta>0?"increase":"saving"}</span> · ${t.pct>=0?"+":"−"}${Math.abs(t.pct).toFixed(1)}%`),
    K.kcard("Annualised impact",(annual>=0?"+":"−")+"₹"+nf(Math.abs(annual)/1e5,2)+" L",vol.annual?`${nf(vol.annual,0)} pieces a year`:"no car volume on record"),K.kcard("Volume basis",nf(vol.annual,0),`${nf(vol.car,0)} cars × ${vol.qty} per car${vol.year?" ("+vol.year+")":""}`),
    K.kcard("Today's piece price",inr(t.cur),`${esc(d.ref.partNo)}`),K.kcard("Risk indicator",risk.level,`from cost, delay and supplier factors`)].join("")}</div>`);
  const dims=[["commercial","💰 Commercial"],["technical","🔧 Technical"],["supplyChain","🚚 Supply chain"],["production","🏭 Production"]];
  add(w,`<div class="tc-impact">${dims.map(([k,l])=>`<div class="panel"><div class="panel-header"><h3>${l}</h3></div><div class="panel-body"><textarea data-k="${k}"${cw?"":" disabled"}>${esc(d.impact[k]||"")}</textarea></div></div>`).join("")}</div>`).querySelectorAll("textarea").forEach(t=>{ t.oninput=()=>{ d.impact[t.dataset.k]=t.value; }; });
  const g=add(w,`<div class="v8-g v8-g2" style="margin-top:16px"></div>`), dp=dpOf(d.ref), cat=dp&&dp.poc?dp.poc.category:"";
  const sim=P.PARTS.filter(p=>p.category===cat&&p.id!==d.ref.partNo).slice(0,3).map((p,i)=>({wf:`${["AEKO","AWE","AeA"][i%3]}-2025-0${100+h("sw|"+p.id)%90}`,name:p.name,car:K.short(p.progName),pct:[91,78,64][i],note:SIMILAR_NOTE[cat]||"Spec update · low risk"}));
  g.appendChild(U.el(U.panel("✦ Similar historical changes",`<div class="tc-docs">${sim.map(x=>`<div class="tc-doc"><div class="di">🔄</div><div class="dn"><b>${esc(x.wf)} · ${esc(x.name)}</b><div>${esc(x.car)} — ${esc(x.note)}</div></div><span class="chip chip-blue"><span class="chip-dot"></span>${x.pct}% match</span></div>`).join("")}</div><div class="text-muted" style="font-size:11.5px;margin-top:6px">Matched on part family and change type. Illustrative — no change history before 2026 is loaded yet.</div>`)));
  const on=risk.level==="Low"?1:risk.level==="Medium"?2:3, col=risk.level==="High"?"high":risk.level==="Medium"?"med":"low";
  g.appendChild(U.el(U.panel("✦ Risk indicator",`<div class="tc-meter">${[1,2,3].map(i=>`<i class="${on>=i?"on-"+col:""}"></i>`).join("")}<b class="${col}">${risk.level}</b></div>${risk.factors.map(f=>`<div class="tc-kv"><span>${f.k} risk</span><b class="${f.hit?"v8-bad":""}">${esc(f.txt)}</b></div>`).join("")}<div class="text-muted" style="font-size:11.5px;margin-top:8px">Risk = how many of three factors apply: price up more than 3%, a milestone within 90 days with a late supplier commitment, a high-risk supplier.</div>`)));
  const foot=add(w,`<div class="panel" style="margin-top:16px"><div class="panel-body tc-actbar">${btn("im-next","Submit to approval workflow →",true,!cw)}</div></div>`);
  if(cw) foot.querySelector("#im-next").onclick=()=>{ advance("Approval"); d.ref.status="Pending"; tcStart(d); Toast.show(`${d.ref.wf} submitted for approval — ${Flow.nameOf(STAGE_ROLE.Engineering)} (Engineering) has been notified; Quality, SRM, Finance, Commodity and Management follow in turn.`,"success"); Router.go("approval-workflow","techchange"); };
  return w;
}

/* ------------------------------------------------------------ 9 · Approval workflow (routed through Flow: role-owned steps, tasks, notifications) */
const STAGE_ROLE={Engineering:"aeko",Quality:"approver",SRM:"srm",Finance:"finance",Commodity:"commodity",Management:"pm"};
const tcOpen=d=>({module:"techchange",screen:"approval-workflow",act:"tc",id:d.ref.id});
const tcEntity=d=>`${d.ref.part} — ${d.ref.type} (${K.short(carName(d.ref.project))})`;
function tcSteps(){ return APPROVAL_CHAIN.map(([stage])=>({role:STAGE_ROLE[stage],label:stage+" approval"})).concat([{role:"aeko",label:"AEKO Coordinator — confirm final approval"},{role:"admin",label:"Implementation released",system:true}]); }
function tcHooks(d){
  return {
    onStep:(f,step,decision,comment)=>{ const i=step.order-2, a=d.approvals[i]; if(!a||i>5) return;
      if(decision==="approve"){ a.status="Approved"; a.by=step.actor; a.on=T0; a.comment=comment||"Reviewed — no objection."; a.signature=String(step.actor||"").replace(/\./g,""); } },
    onApproved:f=>{ d.ref.status="Approved"; d.flow=f; advance("Implementation"); Store.audit("Technical Change","Final approval confirmed",d.ref.wf);
      const open={module:"techchange",screen:"implementation",act:"tc",id:d.ref.id};
      Flow.notify("buyer",{type:"approval-result",title:`Technical change approved — implement ${d.ref.part}`,meta:`${d.ref.wf} • all six approval stages cleared — update price, BOM and PO`,wf:d.ref.wf,open,due:"Due in 2d",dueDays:2,entity:d.ref.part});
      Flow.notify("srm",{type:"approval-result",title:`Technical change approved — ${d.ref.part}`,meta:`${d.ref.wf} • tooling and milestone follow-up for SRM`,wf:d.ref.wf,open,due:"FYI",dueDays:5,entity:d.ref.part});
      return {text:`Final approval confirmed; buyer ${d.assign.buyer} and SRM ${d.assign.srm} notified to implement.`,noInitiatorNote:true}; },
    onRejected:()=>{ d.ref.status="Open"; d.stageIdx=6; d.ref.stage="Impact"; d.approvals.forEach(a=>{ a.status="Pending"; a.by=null; a.on=null; a.comment=""; a.signature=null; }); d.flow=null; Store.audit("Technical Change","Returned to the buyer after rejection",d.ref.wf); }
  };
}
function tcStart(d,extra){
  const f=Flow.start(Object.assign({kind:"technical-change",wf:d.ref.wf,entity:tcEntity(d),record:d,initiator:{role:"buyer",name:d.assign.buyer},initLabel:"Impact analysis submitted",steps:tcSteps(),open:tcOpen(d),verb:"Sign off technical change",hooks:tcHooks(d)},extra||{}));
  d.flow=f; return f;
}
/* a change that reached the approval stage before the flow existed (the seeded ones) gets its flow rebuilt from the stored approvals */
function tcEnsure(d){
  if(d.flow) return d.flow;
  const done=d.approvals.map(a=>a.status==="Approved"?{actor:a.by,date:a.on,comment:a.comment}:null).filter(Boolean);
  if(d.stageIdx>=8) return tcStart(d,{silent:true,preDone:done.concat([{actor:Flow.nameOf("aeko"),comment:"Confirmed"}])});
  if(d.stageIdx===7) return tcStart(d,{quiet:true,preDone:done});
  return null;
}
function buildApproval(){
  const d=ctx.get(), w=head("Approval Workflow","Engineering → Quality → SRM → Finance → Commodity → Management, with comments, digital-signature stubs and version control. Every stage is owned by a role: it gets a task and a notification. The AEKO Coordinator then confirms, and buyer and SRM are notified.");
  if(d.stageIdx<7) return gate(w,"🔒","Not yet submitted","The change has to pass impact analysis before it can be submitted for approval.","Go to impact analysis","impact-analysis");
  const f=tcEnsure(d), ci=(()=>{ const c=f.steps.find(s=>s.status==="current"); return c?f.steps.indexOf(c):-1; })(), canNow=Flow.canAct(f), approved=d.approvals.filter(a=>a.status==="Approved").length;
  const panel=add(w,`<div class="panel"><div class="panel-header"><h3>Approval chain <span class="count-pill">${approved}/6 approved</span></h3><span class="chip chip-gray"><span class="chip-dot"></span>Version ${1+d.mod.overwrites.length}.0</span></div><div class="panel-body"><div id="ap-who" style="margin-bottom:12px"></div><ul class="timeline" id="ap-list"></ul></div></div>`), list=panel.querySelector("#ap-list");
  panel.querySelector("#ap-who").innerHTML=Flow.awaitingHtml(f);
  d.approvals.forEach((a,i)=>{
    const st=f.steps[i+1], ok=a.status==="Approved", cur=ci===i+1, li=document.createElement("li"); li.className=ok?"done":cur?"current":"";
    li.innerHTML=`<div class="tl-dot">${ok?"✓":i+1}</div><div class="tl-body" style="flex:1"><div class="tl-title">${esc(a.stage)} <span class="text-muted" style="font-weight:500">· ${esc(a.role)} · ${esc(Flow.nameOf(st.role))}</span> ${ok?Components.chip("Approved"):cur?Components.chip("Pending"):`<span class="chip chip-gray"><span class="chip-dot"></span>waiting</span>`}</div>
      <div class="tl-meta">${ok?`Signed by ${esc(a.by)} on ${esc(fmtDate(a.on))} — “${esc(a.comment)}”`:cur?`Awaiting ${esc(Flow.roleLabel(st.role))} (${esc(Flow.nameOf(st.role))})`:"Locked until the previous stage clears"}</div>${ok?`<div class="tc-sig">${esc(a.signature)}</div>`:""}
      ${cur&&canNow?`<div class="tc-row" style="margin-top:10px"><input id="ap-c" placeholder="Comment…"><button type="button" class="btn btn-primary btn-sm" data-do="approve">✍ Sign &amp; approve</button><button type="button" class="btn btn-sm" data-do="reject">Reject</button></div>`:""}</div>`;
    list.appendChild(li); });
  list.querySelectorAll("[data-do]").forEach(b=>{ b.onclick=()=>{ const c=document.getElementById("ap-c"); Flow.decide(f,b.dataset.do,c?c.value:""); }; });
  const all=d.approvals.every(a=>a.status==="Approved"), cs=f.steps[7], mine=all&&f.status!=="approved"&&Flow.canAct(f)&&cs&&cs.status==="current";
  const cf=add(w,`<div class="panel" style="margin-top:16px"><div class="panel-header"><h3>AEKO Coordinator confirmation</h3></div><div class="panel-body" id="ap-confirm"></div></div>`), body=cf.querySelector("#ap-confirm");
  body.innerHTML=`<div class="text-muted" style="font-size:12.5px;margin-bottom:12px">${d.ref.status==="Approved"?"Final approval confirmed — buyer and SRM have been notified.":all?`All six stages approved. ${esc(Flow.nameOf("aeko"))} (AEKO Coordinator) confirms the final approval; buyer and SRM are then notified.`:"Confirmation unlocks once all six stages are approved."}</div>${btn("ap-ok",d.ref.status==="Approved"?"✓ Confirmed":"✓ Confirm final approval &amp; notify buyer + SRM",true,!mine)}`;
  if(mine) body.querySelector("#ap-ok").onclick=()=>{ Flow.decide(f,"approve","Confirmed"); setTimeout(()=>Router.go("implementation","techchange"),60); };
  return w;
}

/* ------------------------------------------------------------ 10 · Implementation & control (the actions really write to the platform) */
function applyTask(d,i){
  const c=d.ref, t=totals(d), pn=c.partNo;
  if(i===0&&DATA.priceVersions[pn]&&t.neu!==t.cur){ const l=DATA.priceVersions[pn][DATA.priceVersions[pn].length-1]; DATA.priceVersions[pn].push({price:Math.round(t.neu),vsi:l.vsi,target:l.target,effectiveFrom:T0,source:"Technical change "+c.wf,changeReq:c.wf}); return "Price "+inr(Math.round(t.neu))+" appended to the price history"; }
  if(i===1&&!DATA.bomSop.find(b=>b.partNumber===pn)){ DATA.bomSop.push({id:"B"+(DATA.bomSop.length+1),model:c.project,part:c.part,partNumber:pn,applicable:true,xPerCar:(DATA.cbds[pn]||{}).qtyPerCar||1}); return "Part added to BOM at SOP"; }
  if(i===2){ const po=DATA.ebonPOs.find(p=>p.partNumber===pn); if(po){ po.price=Math.round(t.neu*100)/100; po.lastUpdated=T0; return "PO "+po.poNo+" re-issued at the new price"; }
    DATA.ebonPOs.push({id:"PO"+(DATA.ebonPOs.length+1),poNo:String(450012000+DATA.ebonPOs.length*7),part:c.part,partNumber:pn,supplier:c.supplier,price:Math.round(t.neu*100)/100,qty:1200,status:"Open",lastUpdated:T0}); return "New EBON purchase order raised"; }
  return null;
}
function buildImplementation(){
  const d=ctx.get(), w=head("Implementation & Control","On approval: update price, BOM and PO, notify the supplier, release the drawing, raise the tool order and notify plant, quality and production — monitored to closure.");
  if(d.ref.status!=="Approved"&&d.stageIdx<8) return gate(w,"🔒","Not yet approved","Implementation actions unlock after the final approval is confirmed.","Go to approval workflow","approval-workflow");
  const cw=can.buyerSrm(), n=()=>d.implementation.filter(t=>t.done).length;
  const panel=add(w,`<div class="panel"><div class="panel-header"><h3>Downstream implementation <span class="count-pill">${n()}/${d.implementation.length} done</span></h3><button type="button" class="btn btn-sm" id="im-all"${cw?"":" disabled"}>Fire all remaining</button></div><div class="panel-body"><div class="tc-docs" id="im-list"></div></div></div>`), list=panel.querySelector("#im-list");
  const close=()=>{ if(d.implementation.every(t=>t.done)){ d.stageIdx=9; d.ref.stage="Closed"; d.ref.status="Approved"; } };
  d.implementation.forEach((t,i)=>{ list.appendChild(U.el(`<div class="tc-doc"><div class="di">${t.done?"✅":"⚙️"}</div><div class="dn"><b>${esc(t.task)}</b><div>${t.done?(t.note?esc(t.note):"completed"):"pending"}</div></div>${t.done?Components.chip("Approved"):`<button type="button" class="btn btn-sm" data-im="${i}"${cw?"":" disabled"}>Fire</button>`}</div>`)); });
  list.querySelectorAll("[data-im]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.im, t=d.implementation[i]; t.done=true; t.note=applyTask(d,i)||("completed "+fmtDate(T0)); Store.audit("Technical Change","Implementation: "+t.task,d.ref.wf); Toast.show(t.note,"success"); close(); Router.render(); });
  if(cw) panel.querySelector("#im-all").onclick=()=>{ d.implementation.forEach((t,i)=>{ if(!t.done){ t.done=true; t.note=applyTask(d,i)||("completed "+fmtDate(T0)); } }); Store.audit("Technical Change","All implementation actions fired",d.ref.wf); close(); Toast.show("All actions fired. Change closed.","success"); Router.render(); };
  const closed=d.implementation.every(t=>t.done);
  add(w,`<div class="panel" style="margin-top:16px"><div class="panel-body tc-row">${closed?`<span class="chip chip-green"><span class="chip-dot"></span>Change closed</span><span class="text-muted" style="font-size:12.5px">${esc(d.ref.wf)} implemented; price history, BOM and PO updated where applicable.</span>`:`<span class="chip chip-amber"><span class="chip-dot"></span>In implementation</span><span class="text-muted" style="font-size:12.5px">Firing the price, BOM and PO actions updates the Procurement screens.</span>`}</div></div>`);
  return w;
}

/* ------------------------------------------------------------ 11 · Change history & audit */
function buildHistory(){
  const d=ctx.get(), w=document.createElement("div"); w.className="v8-page tc-page"; w.appendChild(U.header("Change History & Audit","Full audit trail and version history for every workflow number."));
  if(DATA.auditLog.filter(a=>a.entity==="Technical Change").length<3)
    [["Created (AEKO)","AEKO-2026-0041"],["AI extraction completed","AEKO-2026-0052"],["Supplier offer locked","AWE-2026-0021"],["Engineering approved","AEKO-2026-0041"],["Final approval confirmed","AWE-2026-0018"]].forEach(([act,wf],i)=>DATA.auditLog.push({id:"seed"+i,when:"2026-07-2"+i+" 10:0"+i,user:DATA.users[i].name,role:DATA.users[i].role,entity:"Technical Change",action:act,ref:wf}));
  const rows=DATA.auditLog.filter(a=>a.entity==="Technical Change").slice().sort((a,b)=>String(b.when).localeCompare(String(a.when)));
  add(w,U.panel(`Audit trail <span class="count-pill">${rows.length}</span>`,U.table(["Timestamp","Workflow","Action","User","Role"],rows.slice(0,40).map(r=>`<tr><td>${esc(r.when)}</td><td>${Components.wfChip(r.ref)}</td><td>${esc(r.action)}</td><td>${esc(r.user)}</td><td><span class="chip chip-gray"><span class="chip-dot"></span>${esc((ROLES.find(x=>x.id===r.role)||{}).label||r.role)}</span></td></tr>`).join("")),{noPad:true,sub:rows.length>40?"Latest 40 entries":""}));
  const vs=[{v:"1.0",note:"Initial evaluation sheet from AI extraction",on:d.createdOn}].concat(d.mod.overwrites.map((o,i)=>({v:(i+2)+".0",note:"MOD prices re-fetched",on:o.on})));
  add(w,U.panel("Version history · "+esc(d.ref.wf),`<ul class="timeline">${vs.map((v,i)=>`<li class="${i===vs.length-1?"current":"done"}"><div class="tl-dot">${i===vs.length-1?"●":"✓"}</div><div class="tl-body"><div class="tl-title">Version ${v.v}</div><div class="tl-meta">${esc(v.note)} · ${esc(fmtDate(v.on))}</div></div></li>`).join("")}</ul>`,{style:"margin-top:16px"}));
  return w;
}

/* ------------------------------------------------------------ wiring */
Object.assign(U.actions,{tcgo:v=>{ Router.go(v,"techchange"); },tc:v=>{ const i=v.indexOf("="), k=v.slice(0,i), a=v.slice(i+1);
  if(k==="filt"){ FILT=a; Router.render(); } else if(k==="proj"){ TF.project=TF.project===a?"":a; Router.render(); } else if(k==="open"){ ctx.activeId=a; const st=STAGE_ALIAS[CD[a].ref.stage]||CD[a].ref.stage; Router.go(st==="Intake"?"doc-upload":(STAGE_SCREEN[st]||"eval-sheet"),"techchange"); } }});
const TC_IDS=["change-dashboard","intake","doc-upload","eval-sheet","validation","supplier-offers","mod-sheet","impact-analysis","approval-workflow","implementation","change-history"];
const TC_LABEL={"change-dashboard":"Change Dashboard","intake":"Create Change","doc-upload":"AI Extraction","eval-sheet":"Evaluation Sheet","validation":"Validation & Assignment","supplier-offers":"Supplier Offers","mod-sheet":"MOD Sheet","impact-analysis":"Impact Analysis","approval-workflow":"Approval Workflow","implementation":"Implementation","change-history":"Change History"};
Object.assign(SCREENS.techchange,{"change-dashboard":buildDashboard,"intake":buildIntake,"doc-upload":buildDoc,"eval-sheet":buildEval,"validation":buildValidation,"supplier-offers":buildOffers,"mod-sheet":buildMod,"impact-analysis":buildImpact,"approval-workflow":buildApproval,"implementation":buildImplementation,"change-history":buildHistory});
NAV.techchange.forEach(i=>{ if(TC_LABEL[i.id]) i.label=TC_LABEL[i.id]; });
Object.assign(NAV_ICONS,{"change-dashboard":"layout","intake":"plus","doc-upload":"sparkles","eval-sheet":"clipboard","validation":"check-circle","supplier-offers":"users","mod-sheet":"edit","impact-analysis":"activity","approval-workflow":"check-circle","implementation":"settings","change-history":"clock"});
Object.assign(NAV_SHORT,{"intake":"Create Change","doc-upload":"AI Extraction","eval-sheet":"Evaluation Sheet","validation":"Validation","supplier-offers":"Supplier Offers","impact-analysis":"Impact Analysis","approval-workflow":"Approval Chain","change-history":"History"});
TC_IDS.forEach(id=>NAV_HIDDEN.delete(id));
MODULE_TREE.techchange.splice(0,MODULE_TREE.techchange.length,
  ["Overview & reports",["change-dashboard","reports-tc"]],
  ["Intake & evaluation",["intake","doc-upload","eval-sheet","validation"]],
  ["Supplier & cost",["supplier-offers","mod-sheet","impact-analysis"]],
  ["Approval & rollout",["approval-workflow","implementation","approvals","change-history"]]);
const _nl4=navLabel; navLabel=function(m,s){ return (m==="techchange"&&TC_LABEL[s])||_nl4(m,s); };

/* changes already at / past the approval stage get their (silent) flows now, so the right role has a task from the first load */
DATA.changes.forEach(c=>{ const d=CD[c.id]; if(d&&d.stageIdx>=7) tcEnsure(d); });

/* read-only access for the management pages (v8_tcm.js): the live workflow records and the helpers that price and rate a change */
window.V8TC={T0,STAGES,STAGE_ALIAS,STAGE_SCREEN,APPROVAL_CHAIN,STAGE_ROLE,IMPL_TASKS,OFFER_DAYS,CD,ctx,riskOf,riskCalc,totals,volumeOf,projOf,carName,sopOf,fmtDate,addDays,dayDiff,users};

/* Ask AIS: technical-change questions */
(function(){
  const base=Radar.local, R=Radar.R, RE=/(\baeko\b|\bawe\b|\baea\b|technical change|mod sheet|change (status|pipeline)|running change)/i;
  Radar.local=function(q,c2){
    if(!RE.test(q)) return base(q,c2);
    const list=DATA.changes, st=s=>list.filter(c=>c.status===s).length, rows=list.map(c=>({c,t:totals(CD[c.id])}));
    const html=`<p><b>${list.length}</b> technical changes: <b>${st("Open")}</b> open, <b>${st("Pending")}</b> pending, <b>${st("Approved")}</b> approved.</p><ul>${rows.map(x=>`<li><b>${esc(x.c.wf)}</b> · ${esc(x.c.part)} (${esc(K.short(carName(x.c.project)))}) — ${esc(STAGE_ALIAS[x.c.stage]||x.c.stage)}${x.t.neu===x.t.cur?"":", "+money(x.t.delta)+" per piece"}</li>`).join("")}</ul>`;
    return R(html,{charts:[{kind:"bar",title:"Changes by stage",unit:"currency",currencySymbol:"",source:"Technical Change module",orientation:"horizontal",series:[{key:"v",label:"Changes"}],rows:STAGES.filter(s=>list.some(c=>(STAGE_ALIAS[c.stage]||c.stage)===s)).map(s=>({label:s,values:{v:list.filter(c=>(STAGE_ALIAS[c.stage]||c.stage)===s).length},tone:"neutral"}))}],
      actions:[{l:"Change Dashboard",a:"goto:techchange/change-dashboard"},{l:"Approval workflow",a:"goto:techchange/approval-workflow"}],basis:"Technical Change module · computed in this page"});
  };
})();
})();
