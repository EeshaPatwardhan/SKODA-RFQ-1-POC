/* =====================================================================
   V8  ·  Procurement Dashboard — where the money and the workflows stand today (history and actuals, no forecast)
   Sits next to the Forecast Dashboard (Forecast & risk). Money views use the POC part panel on its unit-price basis (same basket as the
   forecast screens — not volume-weighted); workflow views use the platform's own records (approvals, change requests, EBON POs,
   imported parts, commodity / FX masters, freshness, price versions, CBDs).
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, esc=C.esc, nf=C.nf, V=V8Charts, A=()=>window.__cbdApi;
const NH=P.NH, TODAY_S=(typeof TODAY!=="undefined"?TODAY:"2026-07-29");
const PF={project:P.PROGS[0].code,category:"",supplier:""};
const pct=(a,b)=>b?(a/b-1)*100:0, sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const sgn=(v,d)=>U.sgn(v,d==null?1:d), cr=v=>U.cr(v), inr=(v,d)=>U.inr(v,d);
const chgChip=v=>`<span class="chip ${Math.abs(v)<0.05?"chip-gray":v>0?"chip-red":"chip-green"}"><span class="chip-dot"></span>${sgn(v)}</span>`;   // cost up = red
const short=n=>String(n).replace(/^(SKODA|VW) /,"");
const dayDiff=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const fmtDate=d=>{ try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch(e){ return String(d); } };

function scope(skipCategory){ return P.PARTS.filter(p=>(!PF.project||p.progCode===PF.project)&&(skipCategory||!PF.category||p.category===PF.category)&&(!PF.supplier||p.vendorName===PF.supplier)); }
function group(list,key){
  const by={}; list.forEach(p=>{ const k=key(p); (by[k]=by[k]||[]).push(p); });
  const np=P.projCount(list), c=(l,f)=>P.cost(l,f,np), tot=c(list,p=>p.cur)||1;
  return Object.keys(by).map(k=>{ const l=by[k], cur=c(l,p=>p.cur);
    return {name:k,n:l.length,cur,share:cur/tot*100,sinceNom:pct(cur,c(l,p=>p.nom)),chg12:pct(cur,c(l,p=>p.h[NH-13])),ser:Array.from({length:12},(_,j)=>c(l,p=>p.h[NH-12+j])),list:l}; });
}
const DEFAULT_PROJECT=P.PROGS[0].code;
const art=p=>p&&window.V8Art?window.V8Art.part(p.name,p.category,"sm"):"";
function filterBar(){
  const d=document.createElement("div"); d.className="pd-fbar";
  const sel=(k,label,opts,icon)=>`<label class="pd-f"><span>${label}</span><span class="pd-sel">${icon||""}<select data-f="${k}">${opts.map(o=>`<option value="${esc(o[0])}"${o[0]===PF[k]?" selected":""}>${esc(o[1])}</option>`).join("")}</select></span></label>`;
  const pg=P.PROGS.find(x=>x.code===PF.project);
  d.innerHTML=(pg&&window.V8Art?`<div class="pd-carbox">${window.V8Art.car(pg.code)}<div class="cap"><b>${esc(pg.name)}</b><small>${esc(pg.segment)}</small></div></div>`:"")+sel("project","Project",P.PROGS.map(p=>[p.code,p.name]).sort((a,b)=>a[1].localeCompare(b[1])),Icons.svg("car"))+
    sel("category","Vertical",[["","All verticals"]].concat(P.CATS.map(c=>[c.name,c.name]).sort((a,b)=>a[0].localeCompare(b[0]))),Icons.svg("layers"))+
    sel("supplier","Supplier",[["","All suppliers ("+P.VENDS.length+")"]].concat(P.VENDS.map(v=>[v.name,v.name]).sort((a,b)=>a[0].localeCompare(b[0]))),Icons.svg("building"))+
    `<button type="button" class="pd-reset" data-f="reset" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`;
  d.addEventListener("change",e=>{ const k=e.target.dataset&&e.target.dataset.f; if(k&&k!=="reset"){ PF[k]=e.target.value||(k==="project"?DEFAULT_PROJECT:""); Router.render(); } });
  d.addEventListener("click",e=>{ if(e.target.closest('[data-f="reset"]')){ PF.project=DEFAULT_PROJECT; PF.category=PF.supplier=""; Router.render(); } });
  return d;
}
/* KPI card: icon, label, value, one line of context, optional change chip (all values come from the figures computed in build()) */
const kcard=(o)=>`<div class="pd-kpi${o.act?" kpi-link":""}" ${o.act?`data-act="${o.act}" role="button" tabindex="0"`:""} title="${esc(o.tip||"")}"><div class="top"><span class="ic">${Icons.svg(o.icon)}</span><span class="lb">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span>${o.chip?`<span class="ch" title="${esc(o.chipTip||"")}">${o.chip}</span>`:""}</div><div class="sb" title="${esc(String(o.sub||"").replace(/<[^>]*>/g,""))}">${o.sub||""}</div></div>`;
const upDown=(v,unit)=>`<span class="${v>0?"v8-bad":"v8-good"}">${v>0?"▲":"▼"} ${Math.abs(v).toFixed(1)}${unit||"%"}</span>`;

/* ------------------------------------------------------------ pieces */
function pricedParts(list){
  const set=new Set(list.map(p=>p.id)); const rows=[];
  Object.keys(DATA.priceVersions).forEach(no=>{ if(!set.has(no)) return;
    const v=DATA.priceVersions[no].slice().sort((a,b)=>new Date(a.effectiveFrom)-new Date(b.effectiveFrom)), l=v[v.length-1], p=P.part(no), cbd=DATA.cbds[no];
    let carCost=null; if(cbd){ try{ A().sync(cbd); carCost=A().carCost(cbd); }catch(e){} }
    rows.push({no,p,price:l.price,vsi:l.vsi,target:l.target,vVsi:l.vsi?pct(l.price,l.vsi):null,vTgt:l.target?pct(l.price,l.target):null,qty:cbd?cbd.qtyPerCar:null,carCost,versions:v.length,since:l.effectiveFrom}); });
  return rows.sort((a,b)=>(b.vTgt||0)-(a.vTgt||0));
}
/* ------------------------------------------------------------ terminology (shown on the page, not only in the guide) */
const GLOSSARY=[
  ["Project","One vehicle line: Kushaq, Slavia, Kylaq, Taigun, Virtus or Kodiaq."],
  ["Vertical","A family of parts bought together, for example Powertrain, Electrical, Braking or Interior Trim."],
  ["Tracked parts","The 480 bought-out parts this page adds up (about 80 per project)."],
  ["Piece price","What one part costs today, in ₹, as bought from its supplier."],
  ["Cost per vehicle","The tracked parts of one car at today’s piece prices (piece price × quantity per car). "],
  ["Nomination price","The price agreed when the supplier was nominated. July 2023 stands in for it in this prototype."],
  ["Cost target","The price the plan expects for a part. Only parts with a cost breakdown have one."],
  ["Over target","Today’s piece price is above its cost target. More than 5% over is counted as a problem."],
  ["Share of cost","A supplier’s slice of the cost per vehicle."],
];
/* the glossary lives in the user menu (sidebar footer → Glossary), not on the page */
window.V8Glossary={open(){ Drawer.open("Glossary",`<p class="text-muted" style="margin:0 0 6px;line-height:1.55">Terms used in the Procurement dashboards.</p><dl class="gl-dl">${GLOSSARY.map(([t,d])=>`<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl>`,null); document.querySelector("#drawer .drawer-footer").style.display="none"; }};
(function(){ const render=UserMenu.render, act=UserMenu.act;
  UserMenu.render=function(){ render.call(this); const g=this.pop().querySelector('[data-a="guide"]'); if(!g) return; const b=document.createElement("button"); b.type="button"; b.dataset.a="glossary"; b.innerHTML=Icons.svg("list")+"<span>Glossary</span>"; g.after(b); };
  UserMenu.act=function(a){ if(a==="glossary"){ this.close(); window.V8Glossary.open(); } else act.call(this,a); };
})();

/* ------------------------------------------------------------ panels (every figure is computed from the existing part, price-version and approval records) */
const info=t=>`<span class="pd-i" title="${esc(t)}">${Icons.svg("info")}</span>`;
const ptitle=(t,tip)=>`${t} ${info(tip)}`;
const more=(act,label)=>`<div class="pd-more"><a href="#" data-act="${act}">${label}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>`;
const empty=t=>`<div class="mut small" style="padding:8px 2px">${t}</div>`;
const dim=(list)=>({np:P.projCount(list)});

/* 1 · Material cost by component category (vertical). The Vertical filter does not apply here — it would leave one row. */
function categoryPanel(listNoCat){
  const rows=group(listNoCat,p=>p.category).sort((a,b)=>b.cur-a.cur), mx=Math.max(1,...rows.map(r=>r.cur));
  const body=rows.length?`<div class="pd-t pd-cat"><div class="h"><span>Vertical</span><span></span><span class="ra">₹ per vehicle</span><span class="ra">Share</span></div>${rows.map(r=>`<button type="button" class="r ${PF.category===r.name?"on":""}" data-act="pset:category=${esc(r.name)}" title="Filter the other panels to ${esc(r.name)}"><span class="n"><b>${esc(r.name)}</b><small class="${r.chg12>0?"bad":"good"}">12 mo ${sgn(r.chg12)}</small></span><span class="bar"><i style="width:${(r.cur/mx*100).toFixed(1)}%"></i></span><span class="v">${nf(Math.round(r.cur),0)}</span><span class="s">${r.share.toFixed(0)}%</span></button>`).join("")}</div>`:empty("No parts in this selection.");
  return U.panel(ptitle("Material cost by component category","Cost per vehicle of the tracked parts, by vertical (piece price × quantity per vehicle). The small figure is the change in that vertical's cost over 12 months. The Vertical filter does not narrow this panel; click a row to filter the others."),body);
}
/* 2 · Top parts by material cost */
function topCostPanel(list){
  const np=P.projCount(list), tot=P.cost(list,p=>p.cur,np)||1, rows=list.map(p=>({p,c:p.qty*p.cur/np})).sort((a,b)=>b.c-a.c).slice(0,5), mx=Math.max(1,...rows.map(r=>r.c));
  const body=rows.length?`<div class="pd-t pd-top"><div class="h"><span>#</span><span>Part</span><span></span><span class="ra">₹ per vehicle</span><span class="ra">Share</span></div>${rows.map((r,i)=>`<div class="r" data-act="ppart:${esc(r.p.id)}" role="button" tabindex="0" title="Open part details"><span class="k">${i+1}</span><span class="n hasth">${art(r.p)}<span class="nt"><b>${esc(r.p.name)}</b><small>${esc(r.p.id)}</small></span></span><span class="bar"><i style="width:${(r.c/mx*100).toFixed(1)}%"></i></span><span class="v">${nf(Math.round(r.c),0)}</span><span class="s">${(r.c/tot*100).toFixed(1)}%</span></div>`).join("")}</div>${more("go:fc-parts","View all parts")}`:empty("No parts in this selection.");
  return U.panel(ptitle("Top parts by material cost","The five parts that add most to the cost per vehicle: piece price × quantity fitted per vehicle. Share = part's cost ÷ cost per vehicle of the selection."),body);
}
/* 3 · Supplier spend concentration */
function supplierPanel(list,cur){
  const sup=group(list,p=>p.vendorName).sort((a,b)=>b.cur-a.cur), top=sup.slice(0,8), rest=sup.slice(8), top4=sum(sup.slice(0,4),s=>s.share), restShare=sum(rest,s=>s.share);
  let seg=0;
  const COL=["#0a6a4e","#1f7f5f","#2f8f6e","#4aa584","#6bb99b","#8fcdb3","#aadbc6","#c3e5d4"], OTH="#c9d3cf";
  const slices=top.map((s,i)=>({label:s.name,value:s.share,color:COL[i]})).concat(rest.length?[{label:"Others",value:restShare,color:OTH}]:[]);
  const donut=C.donut(slices,{size:250,center:cr(cur),centerSub:"Cost per vehicle",aria:"Cost per vehicle by supplier"}).replace(/<ul class="pc-dl">[\s\S]*?<\/ul>/,"").replace(/<path /g,(m)=>{ const sl=slices[seg++]; return sl&&sl.label!=="Others"?`<path class="pd-seg" data-act="psup:${esc(sl.label)}" role="button" tabindex="0" `:m; });
  const body=sup.length?`<div class="pd-conc2"><div class="dn">${donut}</div><div class="lg">${top.map((s,i)=>`<button type="button" data-act="psup:${esc(s.name)}" title="Open ${esc(s.name)} · ${sgn(s.chg12)} in 12 months"><i style="background:${COL[i]}"></i><span>${esc(s.name)}</span><b>${s.share.toFixed(0)}%</b></button>`).join("")}${rest.length?`<div class="o"><i style="background:${OTH}"></i><span>Others (${rest.length})</span><b>${restShare.toFixed(0)}%</b></div>`:""}</div></div><div class="pd-tag">Top 4 suppliers hold <b>${Math.round(top4)}%</b> of cost per vehicle</div>`:empty("No supplier in this selection.");
  return U.panel(ptitle("Supplier spend concentration","Each supplier's share of the cost per vehicle. Click a supplier (or its ring segment) to open its details."),body);
}
/* 4 · Parts with the highest price increase since nomination */
function increasePanel(list){
  const rows=list.filter(p=>p.nom>0).map(p=>({p,c:pct(p.cur,p.nom)})).sort((a,b)=>b.c-a.c).slice(0,5);
  const body=rows.length?`<div class="pd-t pd-inc"><div class="h"><span>#</span><span>Part</span><span class="ra">Nomination</span><span class="ra">Current</span><span class="ra">Change</span></div>${rows.map((r,i)=>`<div class="r" data-act="ppart:${esc(r.p.id)}" role="button" tabindex="0" title="Open part details"><span class="k">${i+1}</span><span class="n hasth">${art(r.p)}<span class="nt"><b>${esc(r.p.name)}</b><small>${esc(r.p.id)}</small></span></span><span class="v">${nf(Math.round(r.p.nom),0)}</span><span class="v">${nf(Math.round(r.p.cur),0)}</span><span class="v ${r.c>0?"bad":"good"}">${sgn(r.c)}</span></div>`).join("")}</div>${more("pprice:","View all price movements")}`:empty("No parts in this selection.");
  return U.panel(ptitle("Parts with highest price increase","Piece price in ₹ today against the price at nomination (July 2023 stands in for it), largest percentage rise first."),body);
}
/* 5 · Cost vs target: parts over target (parts that have a cost breakdown and a cost target) */
function targetPanel(priced){
  const rows=priced.filter(r=>r.vTgt!=null).slice(0,5);
  const body=rows.length?`<div class="pd-t pd-tgt"><div class="h"><span>#</span><span>Part</span><span class="ra">Target</span><span class="ra">Current</span><span class="ra">Variance</span><span class="ra">Impact</span></div>${rows.map((r,i)=>`<div class="r" data-act="ppart:${esc(r.no)}" role="button" tabindex="0" title="Open part details"><span class="k">${i+1}</span><span class="n hasth">${art(r.p)}<span class="nt"><b>${esc(r.p?r.p.name:r.no)}</b><small>${esc(r.no)}</small></span></span><span class="v">${nf(Math.round(r.target),0)}</span><span class="v">${nf(Math.round(r.price),0)}</span><span class="v ${r.vTgt>0?"bad":"good"}">${sgn(r.vTgt)}</span><span class="v">${r.qty!=null?(r.price-r.target>=0?"+":"−")+nf(Math.round(Math.abs(r.price-r.target)*r.qty),0):"—"}</span></div>`).join("")}</div>${more("pprice:","View all parts over target")}`:empty("No part with a cost breakdown and a cost target is in this selection.");
  return U.panel(ptitle("Cost vs target — top parts over target","Parts that have a cost breakdown and a cost target, ranked by how far today's piece price is above target. Prices and impact in ₹; impact = (price − target) × quantity per vehicle."),body);
}
/* 6 · Pending procurement decisions (approval workflows; these are platform-wide, not per project) */
function decisionsPanel(){
  const LBL={"change-request":"Change request","commodity-price":"Commodity price","technical-change":"Technical change","milestone-amendment":"Milestone amendment"};
  const open=ApprovalEngine.flows.filter(f=>ApprovalEngine.currentStep(f)&&f.steps.some(s=>s.status==="current")).map(f=>({f,esc2:ApprovalEngine.escalationFor(f)})).sort((a,b)=>(!!b.esc2)-(!!a.esc2));
  const body=open.length?`<div class="pd-t pd-dec"><div class="h"><span>#</span><span>Type</span><span>Item</span><span>Stage</span><span class="ra">Status</span></div>${open.slice(0,5).map((o,i)=>{ const cur=ApprovalEngine.currentStep(o.f);
      return `<div class="r" data-act="go:approvals" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n"><b>${esc(LBL[o.f.kind]||o.f.kind)}</b><small>${esc(o.f.wf)}</small></span><span class="it">${esc(o.f.entity)}</span><span class="st">${esc(cur?cur.label:"Complete")}</span><span class="v">${o.esc2?`<span class="chip chip-red"><span class="chip-dot"></span>Escalated</span>`:`<span class="chip chip-amber"><span class="chip-dot"></span>Pending</span>`}</span></div>`; }).join("")}</div>`:empty("No decision is pending.");
  return U.panel(ptitle("Pending procurement decisions","Approval workflows with an open step (change requests, commodity prices, technical changes, milestone amendments). Platform-wide: the project, vertical and supplier filters do not apply."),body,{id:"pd-decisions"});
}

/* shows 5 rows at a time with a small pager under the table (rows keep their rank numbers; the page resets when the filters change) */
function paginate(panel,size){
  const rows=[...panel.querySelectorAll(".pd-t > .r")], body=panel.querySelector(".panel-body"); if(rows.length<=size||!body) return;
  const pages=Math.ceil(rows.length/size), foot=document.createElement("div"); foot.className="pd-pgf"; let p=0;
  const draw=()=>{ rows.forEach((r,i)=>r.classList.toggle("pd-hide",Math.floor(i/size)!==p));
    foot.innerHTML=`<span>${p*size+1}–${Math.min(rows.length,(p+1)*size)} of ${rows.length}</span><div class="ft-pg"><button type="button" data-p="${p-1}" ${p<=0?"disabled":""} aria-label="Previous page">‹</button>${Array.from({length:pages},(_,i)=>`<button type="button" data-p="${i}" class="${i===p?"on":""}" ${i===p?'aria-current="page"':""}>${i+1}</button>`).join("")}<button type="button" data-p="${p+1}" ${p>=pages-1?"disabled":""} aria-label="Next page">›</button></div>`; };
  foot.addEventListener("click",e=>{ const b=e.target.closest("[data-p]"); if(b&&!b.disabled){ p=+b.dataset.p; draw(); } });
  const more=body.querySelector(".pd-more"); more?body.insertBefore(foot,more):body.appendChild(foot); draw();
}
/* ------------------------------------------------------------ screen */
function build(){
  const w=document.createElement("div"); w.className="v8-page v8-board";
  const hd=U.header("Procurement Dashboard");
  const meta=document.createElement("div"); meta.className="pd-meta"; meta.innerHTML=`<span>Prices as of <b>${esc(P.monthLabel(P.MONTHS[NH-1]))}</b> · workflows as of <b>${esc(fmtDate(TODAY_S))}</b></span><span class="pd-ill">Illustrative data — synthetic scenario</span>`; hd.appendChild(meta);
  w.appendChild(hd); w.appendChild(filterBar());
  const add=h=>{ const e=U.el(h); w.appendChild(e); return e; };
  const list=scope(), listNoCat=scope(true), cur=P.cost(list,p=>p.cur), nom=P.cost(list,p=>p.nom), h12=P.cost(list,p=>p.h[NH-13]), ch12=pct(cur,h12), chNom=pct(cur,nom);
  const sup=group(list,p=>p.vendorName).sort((a,b)=>b.cur-a.cur), top4=sum(sup.slice(0,4),s=>s.share);
  const priced=pricedParts(list), avgT=priced.length?sum(priced,r=>r.vTgt||0)/priced.length:null;
  const vol=(P.PROGS.find(x=>x.code===PF.project)||{}).volume||0, withT=priced.filter(r=>r.target&&r.qty!=null);
  const overPer=sum(withT,r=>Math.max(0,r.price-r.target)*r.qty), overAnn=withT.length&&vol?overPer*vol:null;
  const openF=ApprovalEngine.flows.filter(f=>ApprovalEngine.currentStep(f)&&f.steps.some(s=>s.status==="current")), escN=openF.filter(f=>ApprovalEngine.escalationFor(f)).length;
  add(`<div class="pd-kw"><div class="pd-kpis k5">${[
    kcard({icon:"coins",label:"Cost per vehicle",value:cr(cur),sub:`For ${list.length} tracked parts`,chip:`<b class="${ch12>0?"bad":"good"}">${ch12>0?"▲":"▼"} ${Math.abs(ch12).toFixed(1)}%</b><small>vs 12 mo ago</small>`,chipTip:"Change in cost per vehicle against 12 months ago",tip:"What one car's tracked parts cost today: piece price × quantity per vehicle."}),
    kcard({icon:"trend-up",label:"Since nomination",value:sgn(chNom),tone:chNom>0?"bad":"good",sub:`${cr(nom)} → ${cr(cur)}`,chip:`<b class="${cur-nom>0?"bad":"good"}">${U.spend(cur-nom,true)}</b><small>per vehicle</small>`,chipTip:"Rupee change per vehicle since nomination",act:"pprice:",tip:"Change in cost per vehicle against the nominated prices. Click to open Price Analysis."}),
    kcard({icon:"target",label:"Spend above target",value:overAnn==null?"—":cr(overAnn),tone:overAnn>0?"bad":"",sub:overAnn==null?"no cost target in this selection":`${U.spend(overPer)} per vehicle · ${sgn(avgT)} vs target`,tip:"Yearly spend above cost target: for the parts that have a cost breakdown and a cost target, (piece price − target) × quantity per vehicle × planned annual volume of the project. Only parts above their target count."}),
    kcard({icon:"users",label:"Top-4 supplier share",value:sup.length?Math.round(top4)+"%":"—",sub:sup[0]?`largest: ${esc(sup[0].name)} ${Math.round(sup[0].share)}%`:"",tip:"Share of cost per vehicle held by the four largest suppliers."}),
    kcard({icon:"clipboard-check",label:"Decisions pending",value:openF.length,sub:escN?`<span class="v8-bad">${escN} escalated</span>`:"none escalated",act:"pscroll:pd-decisions",tip:"Approvals waiting for a decision (platform-wide). Click to jump to the list on this page."})].join("")}</div></div>`);
  const gw=add(`<div class="pd-gw"><div class="pd-grid"></div></div>`), g=gw.querySelector(".pd-grid");
  [categoryPanel(listNoCat),topCostPanel(list),supplierPanel(list,cur),increasePanel(list),targetPanel(priced),decisionsPanel()].forEach((h,i)=>{ const e=U.el(h); g.appendChild(e); if(i===0) paginate(e,5); });
  w.appendChild(U.el(`<div class="v8-foot">Cost per vehicle of the tracked parts (piece price × quantity per vehicle) — the same basis as the <a href="#" data-act="go:fc-outlook">Forecast Dashboard</a>. Part prices are illustrative; cost vs target covers the ${Object.keys(DATA.priceVersions).length} parts with a cost breakdown.</div>`));
  U.wire(w); return w;
}

window.V8Proc={PF,DEFAULT:DEFAULT_PROJECT,pricedParts};
/* floating "back to top" button on the Procurement dashboard pages (the page scrolls inside #content) */
(function(){
  let b=null; const box=()=>document.getElementById("content");
  const ensure=()=>{ if(b) return b; b=document.createElement("button"); b.id="v8-top"; b.type="button"; b.title="Back to top"; b.setAttribute("aria-label","Back to top");
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'; b.onclick=()=>{ const c=box(); if(c) c.scrollTo({top:0,behavior:"smooth"}); }; document.body.appendChild(b); return b; };
  const upd=()=>{ const c=box(), on=!!c&&/^proc-/.test(Router.screen||"")&&c.scrollTop>360; ensure().classList.toggle("on",on); };
  document.addEventListener("scroll",upd,true); setInterval(upd,400);
})();
/* ------------------------------------------------------------ wiring */
Object.assign(U.actions,{
  pset:v=>{ const [k,val]=v.split("="); PF[k]=(k==="category"&&PF.category===val)?"":val; Router.render(); },
  pgo:v=>{ const [k,id]=v.split("|"); if(k==="price") __openPrice(id); },
  pscroll:id=>{ const el=document.getElementById(id); if(!el) return; el.scrollIntoView({behavior:"smooth",block:"start"}); el.classList.remove("pd-flash"); void el.offsetWidth; el.classList.add("pd-flash"); setTimeout(()=>el.classList.remove("pd-flash"),1800); },
});
NAV.procurement.splice(1,0,{sep:"Procurement dashboard"},{id:"proc-overview",label:"Procurement Dashboard",icon:"📊"});
Object.assign(NAV_ICONS,{"proc-overview":"layout"}); Object.assign(NAV_SHORT,{"proc-overview":"Overview"});
MODULE_TREE.procurement.unshift(["Procurement dashboard",["proc-overview"]]);
const _nl3=navLabel; navLabel=function(m,s){ return s==="proc-overview"?"Procurement Dashboard":_nl3(m,s); };
SCREENS.procurement["proc-overview"]=build;
})();
