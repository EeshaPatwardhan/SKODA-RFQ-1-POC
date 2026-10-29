/* =====================================================================
   V8  ·  SRM dashboards — Overview · Part Readiness · Status Tracking · Supplier Performance
   Data: SrmData (v8_srm_data.js).  Visuals: V8Charts (v8_charts.js) + the POC chart library.
   The three shared reference dashboards were reduced to what Supplier Readiness Management owns (RFQ: "Tooling and Part
   Readiness" + "Status Tracking"): readiness, tooling, milestones, supplier risk. Material-cost / commodity panels of the
   mock-ups already live in Procurement → Forecast & risk and are linked, not duplicated.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, S=SrmData, V=V8Charts, esc=C.esc, nf=C.nf;
const TODAY_STR=(typeof TODAY!=="undefined"?TODAY:"2026-07-29");
let MODEL=null;
const model=()=>MODEL||(MODEL=S.build({today:TODAY_STR,parts:P.PARTS,vendors:P.VENDS,programmes:DATA.projects.map(p=>({code:p.code,name:p.name,sop:p.sop}))}));
const F={project:"",family:"",supplier:"",brand:"",sopYear:""}; let DRILL=null; let PCOLS=2; let MSEL=-1;   // MSEL: milestone picked on Status Tracking (-1 = next open one)
const MS=S.MS, DAY=S.DAY, fmtDate=V.fmtDate;
const pct0=v=>v==null?"—":Math.round(v)+"%";
const chipCls={ok:"chip-green",risk:"chip-amber",delayed:"chip-red",notstarted:"chip-gray"};
const chip=(st,txt)=>`<span class="chip ${chipCls[st]}"><span class="chip-dot"></span>${esc(txt||S.STATUS[st])}</span>`;
const short=n=>String(n).replace(/^(SKODA|VW) /,"");
function weekLabel(t){ const d=new Date(t); const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const day=x.getUTCDay()||7; x.setUTCDate(x.getUTCDate()+4-day); const y0=Date.UTC(x.getUTCFullYear(),0,1); return "CW "+Math.ceil(((x-y0)/DAY+1)/7)+"/"+String(x.getUTCFullYear()).slice(2); }

/* ------------------------------------------------------------ shared context + filter bar */
function projectOf(code){ return (typeof DATA!=="undefined"&&DATA.projects||[]).find(x=>x.code===code)||null; }
function inBrand(code){ if(!F.brand) return true; const p=projectOf(code); return !!(p&&p.brand===F.brand); }
/* Brand and SOP year are not part of SrmData.scope. Brand is the project master; SOP year is the part's own SOP (facelift uses the project date). */
function applyExtra(ev){
  if(!F.brand&&!F.sopYear) return ev;
  return ev.filter(e=>{
    if(F.brand&&!inBrand(e.pt.prog)) return false;
    if(F.sopYear&&String(new Date(e.pt.sop).getUTCFullYear())!==String(F.sopYear)) return false;
    return true;
  });
}
function ctx(){
  const m=model(), ev=applyExtra(S.scope(m,F)), ev7=applyExtra(S.scope(m,F,m.today-7*S.DAY));
  return {m,ev,ev7,sm:S.summary(ev),sm7:S.summary(ev7)};
}
function suppliers(m,ev){
  const by={}; ev.forEach(e=>{ (by[e.pt.vendor]=by[e.pt.vendor]||[]).push(e); });
  return Object.keys(by).map(name=>{ const l=by[name], s=S.summary(l), v=m.vend[name];
    return {name,n:l.length,started:s.started,counts:s.counts,readiness:s.readiness,toolReadiness:s.toolReadiness,delivery:v.delivery,quality:v.quality,owner:v.owner,origin:v.origin,list:l}; });
}
function trend(m,name){ const out=[]; for(let k=5;k>=0;k--){ const t=m.today-k*30*DAY; const s=S.summary(S.evaluate(m,t).filter(e=>e.pt.vendor===name)); out.push(s.readiness); } return out; }
function brandOptions(){ return [...new Set((typeof DATA!=="undefined"&&DATA.projects||[]).map(p=>p.brand).filter(Boolean))].sort(); }
function sopYearOptions(m){ return [...new Set(m.parts.map(p=>new Date(p.sop).getUTCFullYear()))].sort((a,b)=>a-b); }
function projectsForFilters(m){ return m.programmes.filter(p=>inBrand(p.code)); }
function filtersOn(){ return !!(F.project||F.family||F.supplier||F.brand||F.sopYear); }
function filterSpec(m){
  const projs=projectsForFilters(m), years=sopYearOptions(m), brands=brandOptions();
  return [
    ["project","Project",[["","All projects ("+projs.length+")"]].concat(projs.map(p=>[p.code,p.name])),"Vehicle programme"],
    ["supplier","Supplier",[["","All suppliers ("+Object.keys(m.vend).length+")"]].concat(Object.keys(m.vend).sort().map(v=>[v,v]))],
    ["brand","Brand",[["","All brands"]].concat(brands.map(b=>[b,b])),"Brand on the project master. The vehicle is the project."],
    ["family","Vertical",[["","All verticals"]].concat(S.FAMILIES.map(f=>[f,f]))],
    ["sopYear","SOP Year",[["","All SOP years"]].concat(years.map(y=>[String(y),String(y)])),"Year of the part SOP date. Facelift parts use the project SOP; model-year and AEKO parts use their own date."]
  ];
}
function bindFilters(d){
  d.addEventListener("change",e=>{
    const k=e.target.dataset&&e.target.dataset.f; if(!k||k==="reset") return;
    F[k]=e.target.value; DRILL=null;
    if(k==="brand"&&F.project&&!inBrand(F.project)) F.project="";
    if(k==="project"&&F.project&&F.brand&&!inBrand(F.project)) F.brand="";
    Router.render();
  });
  d.addEventListener("click",e=>{ if(e.target.closest('[data-f="reset"]')){ F.project=F.family=F.supplier=F.brand=F.sopYear=""; DRILL=null; Router.render(); } });
}
function filterSelect(k,label,opts,tip){
  return `<label class="v8-f"><span${tip?` title="${esc(tip)}"`:""}>${label}</span><select data-f="${k}" aria-label="${esc(label)}">${opts.map(o=>`<option value="${esc(o[0])}"${String(o[0])===String(F[k])?" selected":""}>${esc(o[1])}</option>`).join("")}</select></label>`;
}
function filterBar(m){
  const d=document.createElement("div"); d.className="v8-filters";
  d.innerHTML=filterSpec(m).map(s=>filterSelect(s[0],s[1],s[2],s[3])).join("")+
    (filtersOn()?`<button type="button" class="btn btn-sm" data-f="reset">Clear filters</button>`:"")+
    `<span class="v8-asof" title="Dates and statuses are evaluated as of this date">As of <b>${fmtDate(m.today)}</b> · ${weekLabel(m.today)}</span>`;
  bindFilters(d); return d;
}
function srmMeta(m){
  const d=document.createElement("div"); d.className="pd-meta";
  d.innerHTML=`<span title="Statuses are evaluated as of this date">Data as of <b>${fmtDate(m.today)}</b></span><span class="pd-ill" title="Milestone commitments, tool plans and owner names are generated for this prototype. Parts, projects, suppliers and SOP dates are platform data.">Illustrative data</span>`;
  return d;
}
function page(title,sub){ const w=document.createElement("div"), m=model(), hd=U.header(title,sub); w.className="v8-page v8-board ov-page"; hd.appendChild(srmMeta(m)); w.appendChild(hd); w.appendChild(overviewFilters(m)); return w; }
const add=(w,html)=>{ const e=U.el(html); w.appendChild(e); return e; };
const kpiRow=(w,cards)=>add(w,`<div class="v8-kpis">${cards.join("")}</div>`);
const kcard=(label,value,sub,o)=>{ o=o||{}; return `<div class="kpi-card v8-kpi${o.act?" kpi-link":""}" ${o.act?`data-act="${o.act}" role="button" tabindex="0"`:""}><div class="kpi-label">${label}</div><div class="v8-kv"><div class="kpi-value">${value}</div>${o.ring!=null?V.ring(o.ring):""}</div><div class="v8-ks">${sub||""}</div></div>`; };
/* SRM KPI card + row (same markup as the Procurement dashboard): icon, label, value, one line of context. Five per screen. */
const scard=(icon,label,value,sub,o)=>{ o=o||{}; return ovKpi({icon,label,value,sub,tone:o.tone,act:o.act,tip:o.tip}); };
const skpis=(w,cards)=>add(w,`<div class="pd-kw"><div class="pd-kpis k5">${cards.join("")}</div></div>`);
const delta=(a,b,unit,good)=>{ if(a==null||b==null) return ""; const d=a-b; if(Math.abs(d)<0.05) return `<span class="v8-flat">no change vs last week</span>`; const up=d>0, ok=good==="up"?up:!up; return `<span class="${ok?"v8-good":"v8-bad"}">${up?"▲":"▼"} ${Math.abs(d)<10?Math.abs(d).toFixed(1):Math.round(Math.abs(d))}${unit} vs last week</span>`; };

/* ------------------------------------------------------------ project milestone status (facelift parts of each project) */
function progMilestones(m,ev){
  return m.programmes.filter(p=>(!F.project||p.code===F.project)&&inBrand(p.code)).map(p=>{
    const evp=ev.filter(e=>e.pt.prog===p.code&&e.pt.changeType==="Facelift");
    return {p,evp,ms:MS.map((d,i)=>{ const R=p.sop-d.off*DAY, st=S.milestoneStatus(evp,i); return Object.assign({id:d.id,R,need:d.need,future:R>=m.today},st,{fc:st.avgSlip==null?null:R+Math.max(0,st.avgSlip)*DAY}); })};
  });
}
/* hover card for a milestone diamond on the project timeline */
function msTip(x,k){
  const st=k.n?k.st:"notstarted", lbl={ok:"On track",risk:"At risk",delayed:"Delayed",notstarted:"Not started"}, col={ok:"var(--ok)",risk:"var(--c-amber)",delayed:"var(--red)",notstarted:"var(--faint)"};
  const d=Math.round((k.R-model().today)/DAY), when=d>0?"in "+d+" days":d===0?"today":Math.abs(d)+" days ago", sl=Math.round(k.avgSlip||0);
  return {t:`${k.id} · ${short(x.p.name)}`,s:k.need,b:[lbl[st],col[st]],
    r:k.n?[["Required by",fmtDate(k.R)+" · "+when],["Supplier commitment",k.fc?fmtDate(k.fc):"—"],["Parts late",`${k.bad} of ${k.n}`],["Average slip",(sl>0?"+":"")+sl+" d"]]:[["Required by",fmtDate(k.R)+" · "+when],["Facelift parts","none started"]],f:"Click for details"};
}
function ganttRows(pm,forecast){
  return pm.map(x=>({label:short(x.p.name),sub:"SOP "+fmtDate(x.p.sop),start:x.p.sop-500*DAY,end:x.p.sop,
    ms:x.ms.map((k,i)=>({id:k.id,t:k.R,st:k.st,fc:forecast?k.fc:null,tip:msTip(x,k),click:"smd:"+x.p.code+"|"+i,title:`${x.p.name} · ${k.id} (${k.need}) · plan ${fmtDate(k.R)}${k.n?` · ${V.LABEL[k.st]} · ${k.bad} of ${k.n} parts late, avg slip ${Math.round(k.avgSlip)} d`:""}`}))}));
}
function msCounts(pm){ const c={ok:0,risk:0,delayed:0,notstarted:0}; pm.forEach(x=>x.ms.forEach(k=>{ if(k.future) c[k.st]++; })); return c; }

/* ------------------------------------------------------------ insights (rules over the data — no model needed) */
function insights(m,ev,sm,sup){
  const out=[], started=ev.filter(e=>e.started);
  /* 1 · biggest cluster of parts that will miss a milestone */
  let best=null; S.FAMILIES.forEach(f=>MS.forEach((d,i)=>{ const l=started.filter(e=>e.pt.family===f&&e.milestones[i].future&&e.milestones[i].st!=="ok"); if(!best||l.length>best.l.length) best={f,d,i,l}; }));
  if(best&&best.l.length){ const bv={}; best.l.forEach(e=>{ bv[e.pt.vendor]=(bv[e.pt.vendor]||0)+1; }); const top=Object.entries(bv).sort((a,b)=>b[1]-a[1])[0];
    out.push({k:"risk",pri:"High",n:best.l.length,nl:"parts at risk",ni:"package",tags:[["building",top[0]],["layers",best.f],["flag",best.d.id]],t:`${best.l.length} ${best.f} parts at risk of missing ${best.d.id}`,s:`Mostly ${top[0]} (${top[1]} parts) — required: ${best.d.need.toLowerCase()}.`,a:"sgo:srm-tooling-dash",q:`SRM: which ${best.f} parts are at risk of missing ${best.d.id}?`}); }
  /* 2 · suppliers needing attention */
  const weak=sup.filter(x=>x.started>=5&&x.readiness!=null&&x.readiness<60).sort((a,b)=>a.readiness-b.readiness);
  if(weak.length) out.push({k:"warn",pri:"Medium",n:weak.length,nl:weak.length===1?"supplier":"suppliers",ni:"users",tags:[["building",weak.length>1?"Multiple suppliers":weak[0].name],["gauge","Below 60%"],["target","Readiness"]],t:`${weak.length} supplier${weak.length===1?"":"s"} below 60% readiness`,s:weak.slice(0,3).map(x=>`${x.name} ${Math.round(x.readiness)}%`).join(" · "),a:"sgo:srm-performance-dash",q:"SRM: which suppliers need attention on readiness?"});
  /* 3 · tooling */
  const tl=ev.filter(e=>e.tool&&(e.tool.st==="risk"||e.tool.st==="delayed")); if(tl.length){ const bv={}; tl.forEach(e=>{ bv[e.pt.vendor]=(bv[e.pt.vendor]||0)+1; }); const top=Object.entries(bv).sort((a,b)=>b[1]-a[1])[0];
    out.push({k:"warn",pri:"Medium",n:tl.length,nl:"parts",ni:"wrench",tags:[["building",top[0]],["wrench","Tooling"],["clock","> "+S.TH.delayed+" days"]],t:`${tl.length} parts have tooling behind plan`,s:`${tl.reduce((a,e)=>a+e.pt.tools,0)} tools in all. ${top[0]} has the most parts (${top[1]}); ${tl.filter(e=>e.tool.st==="delayed").length} parts are more than ${S.TH.delayed} days behind.`,a:"sgo:srm-tooling-dash",q:"SRM: tooling readiness — which tools are behind plan?"}); }
  /* 4 · project with the largest delayed share */
  const pr=m.programmes.map(p=>{ const l=started.filter(e=>e.pt.prog===p.code); return {p,n:l.length,d:l.filter(e=>e.status==="delayed").length}; }).filter(x=>x.n>=10).sort((a,b)=>b.d/b.n-a.d/a.n)[0];
  if(pr&&pr.d) out.push({k:"info",pri:pr.d/pr.n>=.2?"High":"Medium",n:Math.round(pr.d/pr.n*100)+"%",nl:"of parts delayed",ni:"alert",tags:[["car",short(pr.p.name)],["calendar","Milestones"],["clock","> "+S.TH.delayed+" days"]],t:`${short(pr.p.name)}: ${Math.round(pr.d/pr.n*100)}% of started parts delayed`,s:`${pr.d} of ${pr.n} parts forecast more than ${S.TH.delayed} days late on a milestone.`,a:"sgo:srm-status-dash",q:`SRM: milestone status for ${pr.p.name}`});
  /* 5 · where readiness risk meets the price forecast (POC) */
  const both=started.filter(e=>(e.status==="risk"||e.status==="delayed")&&e.pt.chgH>5);
  if(both.length){ const top=both.slice().sort((a,b)=>b.pt.chgH-a.pt.chgH)[0], av=both.reduce((s,e)=>s+e.pt.chgH,0)/both.length;
    out.push({k:"save",pri:"Medium",n:both.length,nl:"parts also rising",ni:"trend-up",tags:[["package",top.pt.name],["trend-up",U.sgn(av)+" avg"],["building",top.pt.vendor]],t:`${both.length} at-risk parts also forecast to rise >5%`,s:`Average ${U.sgn(av)}; largest ${top.pt.name} (${short(top.pt.progName)}, ${U.sgn(top.pt.chgH)}) — late delivery and a price rise on the same parts compound the cost risk.`,a:"go:fc-parts",q:"SRM: which at-risk parts also have a forecast price rise?"}); }
  return out.slice(0,5);
}
const insightHtml=list=>list.length?`<div class="v8-ins">${list.map(i=>`<div class="v8-in ${i.k}"><span class="d"></span><div><b>${esc(i.t)}</b><p>${esc(i.s)}</p></div><div class="b"><button type="button" class="btn btn-sm" data-act="ask:${esc(i.q)}" title="Ask AIS about this">✨ Ask AIS</button></div></div>`).join("")}</div>`:`<div class="mut small">Nothing stands out for this selection.</div>`;

/* ------------------------------------------------------------ redesigned pieces: status by vertical, readiness stages, supplier ranking */
const STK=["ok","risk","delayed","notstarted"], STN={ok:"On track",risk:"At risk",delayed:"Delayed",notstarted:"Not started"};
function verticalRows(ev,fn){
  return S.FAMILIES.map(f=>{ const l=ev.filter(e=>e.pt.family===f); const c={ok:0,risk:0,delayed:0,notstarted:0}; l.forEach(e=>{ c[fn?fn(e):e.status]++; }); return {label:f,counts:c}; });
}
/* every row is 100% of that vertical's parts, so rows compare; numbers only where the segment is wide enough; nothing here is clickable */
function statusBars(rows){
  const data=rows.map(r=>{ const n=STK.reduce((s,k)=>s+(r.counts[k]||0),0); return {...r,n,bad:n?((r.counts.risk||0)+(r.counts.delayed||0))/n:0}; }).filter(r=>r.n).sort((a,b)=>b.bad-a.bad);
  const tot={}; STK.forEach(k=>{ tot[k]=data.reduce((s,r)=>s+(r.counts[k]||0),0); }); const all=STK.reduce((s,k)=>s+tot[k],0)||1;
  const sum=`<div class="sv-sum">${STK.map(k=>`<div class="${k}"><i></i><b>${tot[k]}</b><span>${STN[k]}</span><em>${Math.round(tot[k]/all*100)}%</em></div>`).join("")}</div>`;
  const body=data.map(r=>`<div class="sv-r"><span class="n" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar">${STK.map(k=>{ const c=r.counts[k]||0; if(!c) return ""; const w=c/r.n*100; return `<i class="${k}" style="width:${w.toFixed(2)}%" title="${esc(r.label)} · ${STN[k]}: ${c} of ${r.n} parts (${Math.round(w)}%)">${w>=8?c:""}</i>`; }).join("")}</span><span class="t">${r.n}</span></div>`).join("");
  return `${sum}<div class="sv"><div class="sv-h"><span>Vertical</span><span>Share of the vertical's parts</span><span class="r">Parts</span></div>${body}</div>`;
}
const STAGE_COL=["#2b6cb0","#2f84c4","#2a9d9a","#3fae7a","#8cc34a","#c7d63f"];
function stageFlow(ev){
  const items=S.STAGES.map((st,i)=>({label:st.label,value:ev.filter(e=>e.stage>=i).length})), first=Math.max(1,items[0].value);
  let worst=null; items.forEach((it,i)=>{ if(!i) return; const drop=items[i-1].value-it.value; if(!worst||drop>worst.drop) worst={i,drop,rate:items[i-1].value?drop/items[i-1].value*100:0}; });
  const last=items[items.length-1];
  const head=`<div class="sf-hl"><div><b>${items[0].value}</b><span>parts have started</span></div><div><b>${last.value}</b><span>${esc(last.label)}</span></div>${worst&&worst.drop>0?`<div><b>−${worst.drop}</b><span>largest drop · ${esc(items[worst.i-1].label)} → ${esc(items[worst.i].label)}</span></div>`:""}</div>`;
  const rows=items.map((it,i)=>{ const prev=i?items[i-1].value:null, drop=prev!=null?prev-it.value:null;
    return `<div class="sf-r"><span class="n"><em>${i+1}</em>${esc(it.label)}</span><span class="bar"><i style="width:${Math.max(1.5,it.value/first*100).toFixed(1)}%;background:${STAGE_COL[i%STAGE_COL.length]}"></i></span><span class="v"><b>${it.value}</b><small>${Math.round(it.value/first*100)}%</small></span><span class="d">${drop==null?"":drop>0?"−"+drop+" vs previous":"no drop"}</span></div>`; }).join("");
  const ns=ev.filter(e=>e.stage<0).length;
  return `${head}<div class="sf"><div class="sf-h"><span>Stage</span><span>Parts that have reached it</span><span class="r">Parts</span><span class="r">Change</span></div>${rows}</div>${ns?`<div class="sf-ns"><b>${ns}</b> more parts have not started — their nomination is not yet due, so they are not counted above.</div>`:""}`;
}
function supplierRank(sup){
  const ranked=sup.filter(x=>x.started>=5&&x.readiness!=null).sort((a,b)=>b.readiness-a.readiness);
  if(!ranked.length) return `<div class="mut small">No supplier has five or more started parts in this selection.</div>`;
  const avg=ranked.reduce((s,x)=>s+x.readiness,0)/ranked.length, band=v=>v>=80?"ok":v>=60?"risk":"delayed";
  const n80=ranked.filter(x=>x.readiness>=80).length, n60=ranked.filter(x=>x.readiness<60).length;
  const row=(x,rk)=>`<button type="button" class="sr-r" data-act="sgo:srm-tooling-dash" title="Open Part Readiness"><span class="rk">${rk}</span><span class="nm"><b>${esc(x.name)}</b><small>${x.started} parts${x.counts.delayed?` · ${x.counts.delayed} delayed`:""}</small></span><span class="bar"><i class="${band(x.readiness)}" style="width:${x.readiness.toFixed(1)}%"></i><u style="left:${avg.toFixed(1)}%"></u></span><span class="v ${band(x.readiness)}">${Math.round(x.readiness)}%</span></button>`;
  const top=ranked.slice(0,5), bot=ranked.length>5?ranked.slice(-Math.min(5,ranked.length-5)).reverse():[];
  return `<div class="sf-hl"><div><b>${Math.round(avg)}%</b><span>average readiness</span></div><div><b class="good">${n80}</b><span>at 80% or more</span></div><div><b class="${n60?"bad":"good"}">${n60}</b><span>below 60%</span></div></div>
    <div class="sr"><div class="sr-g">Highest</div>${top.map((x,i)=>row(x,i+1)).join("")}${bot.length?`<div class="sr-g">Needs attention</div>${bot.map((x,i)=>row(x,ranked.length-i)).join("")}`:""}</div>
    <div class="pd-note"><u></u>Dashed line = average of the ${ranked.length} suppliers · Suppliers with fewer than 5 started parts are not ranked · Click a supplier to open its parts</div>`;
}

/* ------------------------------------------------------------ open actions: one row per part, status and priority in one place */
function actionsTable(ev,limit){
  const rows=ev.filter(e=>e.started&&(e.status==="risk"||e.status==="delayed")).sort((a,b)=>S.RANK[b.status]-S.RANK[a.status]||(a.next&&b.next?a.next.R-b.next.R:0)||a.readiness-b.readiness).slice(0,limit||8);
  if(!rows.length) return `<div class="mut small" style="padding:6px 2px">No part needs action for this selection.</div>`;
  const m=model();
  return `<div class="ao"><div class="ao-h"><span>Part</span><span>Supplier</span><span>Next milestone</span><span>Suggested next action</span><span>Owner</span><span class="r">Status</span></div>${rows.map(e=>{ const inD=e.next?Math.round((e.next.R-m.today)/DAY):null;
    return `<div class="ao-r ${e.status}" data-act="srmpart:${esc(e.pt.id)}" role="button" tabindex="0" title="Open the supplier-readiness detail"><span class="pt"><b>${esc(e.pt.name)}</b><small>${esc(short(e.pt.progName))} · ${esc(e.pt.family)}</small></span><span class="sp">${esc(e.pt.vendor)}</span><span class="ms">${e.next?`<b>${esc(e.next.id)}</b><small>${esc(fmtDate(e.next.R))}${inD!=null?` · ${inD>0?"in "+inD+" d":inD===0?"today":Math.abs(inD)+" d ago"}`:""}</small>`:"—"}</span><span class="na">${esc(S.nextAction(e))}</span><span class="ow">${esc(m.vend[e.pt.vendor].owner)}</span><span class="st">${chip(e.status)}<small>${e.status==="delayed"?"High":"Medium"} priority</small></span></div>`; }).join("")}</div>`;
}
function readBar(v){ return v==null?"—":`<div class="v8-rb"><i style="width:${v}%;background:${V.band(v)}"></i></div><span class="v8-rv">${Math.round(v)}%</span>`; }

/* ------------------------------------------------------------ part drawer (SRM view): what is wrong, why it has that status, what to do, and the evidence */
function openSrmPart(id){
  const m=model(), e=S.evaluate(m).find(x=>x.pt.id===id); if(!e) return;
  const pt=e.pt, v=m.vend[pt.vendor], own=v.owner, TH=S.TH, dd=t=>Math.round((t-m.today)/DAY);
  const when=d=>d>0?"in "+d+" days":d===0?"today":Math.abs(d)+" days ago";
  const planStage=(()=>{ let s=-1; S.STAGES.forEach((x,i)=>{ if(e.fPlan>=x.min) s=i; }); return s; })();
  const gap=planStage-e.stage;
  /* the milestone that sets the status: the first upcoming one at the worst level */
  const key=e.started?e.milestones.find(k=>k.future&&k.st===e.status):null, late=e.started?e.milestones.filter(k=>k.future&&k.st!=="ok").length:0, ahead=e.started?e.milestones.filter(k=>k.future).length:0;
  const why=!e.started?`Nomination is not yet due, so SRM has not started tracking this part. It starts when the part enters planning ahead of its SOP on ${esc(fmtDate(pt.sop))}.`
    : e.status==="ok"?`Every upcoming supplier commitment is within ${TH.risk} days of the date it is needed. Nothing needs escalating.`
    : `<b>${esc(key.id)}</b> (${esc(MS.find(x=>x.id===key.id).need.toLowerCase())}) is needed by <b>${esc(fmtDate(key.R))}</b> but the supplier has committed to <b>${esc(fmtDate(key.C))}</b> — <b>${Math.round(key.dm)} days late</b>. ${late>1?`${late} of the ${ahead} upcoming milestones are late. `:""}${e.status==="delayed"?`More than ${TH.delayed} days late is “Delayed”.`:`${TH.risk+1} to ${TH.delayed} days late is “At risk”.`}`;
  const stageTxt=e.stage<0?"Not started":esc(S.STAGES[e.stage].label);
  const planTxt=!e.started?"nomination not yet due":gap>0?`${gap} stage${gap===1?"":"s"} behind plan — plan expects ${esc(S.STAGES[planStage].label)}`:"on plan";
  const rows=e.milestones.map(k=>{ const dm=Math.round(k.dm), past=!k.future; let st;
    if(!e.started) st=chip("notstarted");
    else if(past) st=k.C<=m.today?(dm>TH.risk?chip(dm>TH.delayed?"delayed":"risk","Met "+dm+" d late"):chip("ok","Met")):chip("delayed","Overdue");
    else st=chip(k.st);
    return `<tr><td><b>${esc(k.id)}</b><small class="v8-sm">${esc(MS.find(x=>x.id===k.id).need)}</small></td><td>${esc(fmtDate(k.R))}<small class="v8-sm">${when(dd(k.R))}</small></td><td>${e.started?esc(fmtDate(k.C)):"—"}</td><td class="${!e.started?"":dm>TH.delayed?"bad":dm>TH.risk?"warn":""}">${e.started?(dm>0?"+":"")+dm+" d":"—"}</td><td>${st}</td></tr>`; }).join("");
  const tool=e.tool?`${pt.tools} tool${pt.tools===1?"":"s"} · ${pt.cavities} cavit${pt.cavities===1?"y":"ies"} · build stage <b>${esc(e.tool.stage)}</b> ${chip(e.tool.st)}`:"No dedicated tool is needed for this part";
  const price=pt.chgH==null?"":`<div><dt>Price outlook</dt><dd><b class="${pt.chgH>5?"bad":""}">${U.sgn(pt.chgH)}</b> forecast over the next six months${pt.chgH>5&&(e.status==="risk"||e.status==="delayed")?` — a late supplier and a rising price on the same part`:""}</dd></div>`;
  const html=`<div class="dr">
    <div class="dr-hd"><div><div class="dr-n">${esc(pt.name)}</div><div class="dr-tags"><span>${esc(pt.progName)}</span><span>${esc(pt.vendor)}</span><span>${esc(pt.family)}</span><span class="m">Part no. ${esc(pt.id)}</span></div></div>${chip(e.status)}</div>
    <div class="dr-why ${e.status}"><span>Why ${e.started?esc(S.STATUS[e.status].toLowerCase()):"not started"}</span><p>${why}</p></div>
    <div class="dr-cards">
      <div class="dr-c"><span>Readiness</span><b>${e.readiness==null?"—":Math.round(e.readiness*100)+"%"}</b>${e.readiness==null?`<small>Not started</small>`:`<div class="bar"><i style="width:${Math.round(e.readiness*100)}%;background:${V.band(e.readiness*100)}"></i></div><small>100% = commitments on date · 0% = ${40}+ days late</small>`}</div>
      <div class="dr-c"><span>Stage reached</span><b>${stageTxt}</b><small>${e.stage<0?"":"stage "+(e.stage+1)+" of "+S.STAGES.length+" · "}${planTxt}</small></div>
      <div class="dr-c"><span>Next milestone</span><b>${e.next?esc(e.next.id):"—"}</b><small>${e.next?"needed "+esc(fmtDate(e.next.R))+" · "+when(dd(e.next.R)):"none ahead"}</small></div></div>
    ${e.started&&e.status!=="ok"?`<div class="dr-next"><span>Suggested next action</span><p>${esc(S.nextAction(e))}</p><small>SRM owner · ${esc(own)} · ${e.status==="delayed"?"High":"Medium"} priority</small></div>`:`<div class="dr-next ok"><span>Next action</span><p>${esc(S.nextAction(e))}</p><small>SRM owner · ${esc(own)}</small></div>`}
    <div class="dr-sec"><h4>Part details</h4><dl><div><dt>Change type</dt><dd>${esc(pt.changeType)} · part SOP ${esc(fmtDate(pt.sop))}</dd></div><div><dt>Tooling</dt><dd>${tool}</dd></div><div><dt>Supplier scorecard</dt><dd>${esc(pt.vendor)}: on-time delivery <b>${v.delivery}%</b> · quality <b>${v.quality}%</b> (last 6 months)</dd></div>${price}</dl></div>
    ${window.V8SrmOps?V8SrmOps.drawerBlock(e):""}
    <div class="dr-sec"><h4>Milestones — required vs supplier commitment</h4><div class="dr-asof">As of ${esc(fmtDate(m.today))} · ${S.TH.risk} days late or less is on track, up to ${S.TH.delayed} is at risk, more is delayed</div><div class="dr-tbl">${U.table(["Milestone","Required","Supplier commitment","Slip","Status"],rows)}</div>
    <div class="mut small" style="margin-top:10px">Commitment dates are generated for this prototype (no commitment-sheet feed yet); the part, project, supplier and SOP dates are platform data.</div></div>
    <div class="dr-act"><button class="btn btn-sm btn-primary" data-act="part:${esc(pt.id)}">Price forecast &amp; cost walk</button><button class="btn btn-sm" data-act="ask:SRM: what is the readiness status of ${esc(pt.name)} ${esc(short(pt.progName))}?">✨ Ask AIS</button></div></div>`;
  Drawer.open(pt.name+" · supplier readiness","",null);
  const bd=document.getElementById("drawer-body"); bd.innerHTML=html; U.wire(bd);
  document.querySelector("#drawer .drawer-footer").style.display="none"; document.getElementById("drawer").classList.add("fcwide");
}

/* ------------------------------------------------------------ 1 · Overview — management board (KPIs, stacked milestone health, tables, timeline) */
const ovInfo=t=>`<span class="ov-i" title="${esc(t)}">${Icons.svg("info")}</span>`;
const ovLeg=`<div class="ov-leg mh"><span><i class="ok"></i>On track</span><span><i class="risk"></i>At risk</span><span><i class="delayed"></i>Delayed</span></div>`;
function ovDelta(a,b,good,unit){
  if(a==null||b==null||isNaN(a)||isNaN(b)) return "";
  const d=a-b; if(Math.abs(d)<0.05) return "";
  const up=d>0, ok=good==="up"?up:!up, n=Math.abs(d)<10?Math.abs(d).toFixed(1):String(Math.round(Math.abs(d)));
  return `<span class="ov-ch ${ok?"good":"bad"}" title="Same filters, seven days earlier"><b>${up?"▲":"▼"} ${n}${unit||""}</b><small>vs last week</small></span>`;
}
function bandCls(v){ if(v==null) return ""; return v>=80?"good":v>=60?"warn":"bad"; }
function sixMonths(today){
  const d=new Date(today), y=d.getUTCFullYear(), mo=d.getUTCMonth(), months=[];
  for(let i=0;i<6;i++) months.push(Date.UTC(y,mo+i,1));
  return {months,end:Date.UTC(y,mo+6,1)};
}
function driverMs(e){ const fut=(e.milestones||[]).filter(k=>k.future&&k.st===e.status); return fut[0]||e.next; }
function attention(ev){ return ev.filter(e=>e.started&&(e.status==="risk"||e.status==="delayed")); }
function overviewFilters(m){
  const icons={project:"car",supplier:"building",brand:"flag",family:"layers",sopYear:"calendar"};
  const d=document.createElement("div"); d.className="pd-fbar";
  const pic=F.project&&window.V8Art?V8Art.car(F.project):""; /* the project's car, or the model line-up; an empty frame of the same size keeps the filters in place */
  d.innerHTML=`<div class="pd-carbox solo">${pic||(window.V8Art&&V8Art.lineup())||'<span class="va-car" aria-hidden="true"></span>'}</div>`+filterSpec(m).map(([k,label,opts,tip])=>`<label class="pd-f"><span${tip?` title="${esc(tip)}"`:""}>${esc(label)}</span><span class="pd-sel">${Icons.svg(icons[k]||"filter")}<select data-f="${k}" aria-label="${esc(label)}">${opts.map(o=>`<option value="${esc(o[0])}"${String(o[0])===String(F[k])?" selected":""}>${esc(o[1])}</option>`).join("")}</select></span></label>`).join("")+
    `<button type="button" class="pd-reset" data-f="reset" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`;
  bindFilters(d); return d;
}
function ovKpi(o){
  return `<div class="pd-kpi${o.act?" kpi-link":""}" ${o.act?`data-act="${o.act}" role="button" tabindex="0"`:""} title="${esc(o.tip||"")}"><div class="top"><span class="ic">${Icons.svg(o.icon)}</span><span class="lb">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span></div><div class="sb" title="${esc(String(o.sub||"").replace(/<[^>]*>/g,""))}">${o.sub||""}</div></div>`;
}
/* whole-number shares that add up to 100 (largest remainder), so the labels on a stacked bar never total 99 or 101 */
function share100(vals){
  const t=vals.reduce((a,b)=>a+b,0); if(!t) return vals.map(()=>0);
  const raw=vals.map(v=>v/t*100), out=raw.map(Math.floor); let left=100-out.reduce((a,b)=>a+b,0);
  raw.map((r,i)=>[r-out[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{ if(left>0&&vals[i]>0){ out[i]++; left--; } });
  return out;
}
/* pages a list that is already in the DOM: hides rows outside the page and adds a pager footer to the panel body (page 1 again when the filters redraw the screen) */
function ovPaginate(panel,rowSel,size,unit,hostSel){
  const rows=[...panel.querySelectorAll(rowSel)], body=panel.querySelector(".panel-body"); if(!body||rows.length<=size) return;
  const pages=Math.ceil(rows.length/size), foot=document.createElement("div"); foot.className="ov-pg"; let p=0;
  const draw=()=>{ rows.forEach((r,i)=>{ r.hidden=Math.floor(i/size)!==p; });
    const nums=pages<=5?Array.from({length:pages},(_,i)=>`<button type="button" data-p="${i}" class="${i===p?"on":""}"${i===p?' aria-current="page"':""} aria-label="Page ${i+1}">${i+1}</button>`).join(""):`<span class="of">Page ${p+1} of ${pages}</span>`;
    foot.innerHTML=`<span class="rg">${p*size+1}–${Math.min(rows.length,(p+1)*size)} of ${rows.length}${unit?" "+unit:""}</span><div class="ft-pg"><button type="button" data-p="${p-1}" ${p<=0?"disabled":""} aria-label="Previous page">‹</button>${nums}<button type="button" data-p="${p+1}" ${p>=pages-1?"disabled":""} aria-label="Next page">›</button></div>`; };
  foot.addEventListener("click",e=>{ const b=e.target.closest("[data-p]"); if(b&&!b.disabled){ p=+b.dataset.p; draw(); } });
  const host=hostSel&&panel.querySelector(hostSel); if(host) foot.classList.add("hd"); (host||body).appendChild(foot); draw();
}
function milestoneHealth(m,ev){
  const seen=new Set(ev.map(e=>e.pt.prog));
  const rows=m.programmes.filter(p=>seen.has(p.code)).map(p=>{
    const l=ev.filter(e=>e.pt.prog===p.code), started=l.filter(e=>e.started), c={ok:0,risk:0,delayed:0};
    started.forEach(e=>{ if(c[e.status]!=null) c[e.status]++; });
    const n=started.length;
    return {p,all:l.length,n,ns:l.length-n,c,dshare:n?c.delayed/n:0,rshare:n?c.risk/n:0};
  }).sort((a,b)=>b.dshare-a.dshare||b.rshare-a.rshare||short(a.p.name).localeCompare(short(b.p.name)));
  if(!rows.length) return `<div class="ov-empty">No parts in this selection.</div>`;
  const KS=["ok","risk","delayed"], LB={ok:"On track",risk:"At risk",delayed:"Delayed"};
  const body=rows.map(r=>{
    const pc=share100(KS.map(k=>r.c[k]));
    const tip={t:short(r.p.name),s:"SOP "+fmtDate(r.p.sop)+" · "+r.all+" parts in scope",r:[["Started parts",r.n],["On track",r.c.ok],["At risk",r.c.risk],["Delayed",r.c.delayed],["Not started",r.ns]],f:"Click to open status tracking"};
    const cells=KS.map((k,i)=>`<span class="cl"><em class="${k}">${r.n?pc[i]+"%":"—"}</em></span>`).join("");
    return `<button type="button" class="mh-r" data-act="sgo:srm-status-dash" data-sc-tip="${esc(JSON.stringify(tip))}"><span class="pj"><b>${esc(short(r.p.name))}</b></span>${cells}<span class="cl pn"><em class="pt">${r.n}</em></span></button>`;
  }).join("");
  return `<div class="mh-h"><span>Project</span>${KS.map(k=>`<span><i class="${k}"></i>${LB[k]}</span>`).join("")}<span>Parts</span></div>${body}`;
}
function supplierTable(sup){
  const ranked=sup.filter(x=>x.started>=5&&x.readiness!=null).sort((a,b)=>a.readiness-b.readiness||b.counts.delayed-a.counts.delayed||a.name.localeCompare(b.name));
  if(!ranked.length) return `<div class="ov-empty">No supplier has five or more started parts in this selection. That is the same cutoff as the suppliers KPI.</div>`;
  const band=v=>v>=80?"ok":v>=60?"risk":"delayed";
  const rows=ranked.map((x,i)=>`<tr class="ov-go" data-act="sgo:srm-tooling-dash" role="button" tabindex="0" title="Open Part Readiness"><td class="rk">${i+1}</td><td class="nm"><b title="${esc(x.name)}">${esc(x.name)}</b></td><td class="num" title="Started parts">${x.started}</td><td class="rd"><span class="ov-mini"><i class="${band(x.readiness)}" style="width:${Math.max(0,Math.min(100,x.readiness)).toFixed(1)}%"></i></span><span class="pc">${Math.round(x.readiness)}%</span></td><td class="num ${x.counts.risk?"warn":"zero"}">${x.counts.risk}</td><td class="num ${x.counts.delayed?"bad":"zero"}">${x.counts.delayed}</td></tr>`).join("");
  return `<table class="ov-tbl ov-sup"><thead><tr><th title="1 = lowest readiness">#</th><th>Supplier</th><th class="r" title="Started parts">Parts</th><th>Readiness</th><th class="r">At risk</th><th class="r">Delayed</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function stageBars(ev){
  if(!ev.length) return `<div class="ov-empty">No parts in this selection.</div>`;
  const rows=[{label:"Not started",n:ev.filter(e=>e.stage<0).length,k:-1}].concat(S.STAGES.map((st,i)=>({label:st.label,n:ev.filter(e=>e.stage===i).length,k:i})));
  const all=ev.length, max=Math.max(1,...rows.map(r=>r.n));
  return `<div class="ov-st">${rows.map(r=>{ const p=Math.round(r.n/all*100), tone=r.k<0?"ns":"st"+r.k;
    return `<div class="ov-st-r" title="${esc(r.label)}: ${r.n} of ${all} parts (${p}%)"><span class="n">${esc(r.label)}</span><span class="bar"><i class="${tone}" style="width:${Math.max(r.n?3:0,r.n/max*100).toFixed(1)}%"></i></span><span class="v"><b>${r.n}</b><small>${p}%</small></span></div>`; }).join("")}</div><p class="ov-note">Parts at each stage now, not a cumulative funnel. Not started means nomination is not yet due.</p>`;
}
function originLabel(o){ const s=String(o||"Unknown"); if(s==="international") return "International"; if(s==="domestic") return "Domestic"; return s.charAt(0).toUpperCase()+s.slice(1); }
function groupOrigin(m,list){ const g={}; list.forEach(e=>{ const o=(m.vend[e.pt.vendor]&&m.vend[e.pt.vendor].origin)||"Unknown"; (g[o]=g[o]||[]).push(e); }); return g; }
function originPanel(m,ev,ev7){
  const g=groupOrigin(m,ev), g7=groupOrigin(m,ev7), keys=Object.keys(g);
  if(!keys.length) return `<div class="ov-empty">No parts in this selection.</div>`;
  keys.sort((a,b)=>{ const ra=S.summary(g[a]).readiness, rb=S.summary(g[b]).readiness; if(ra==null) return 1; if(rb==null) return -1; return ra-rb; });
  return keys.map(o=>{
    const s=S.summary(g[o]), s7=S.summary(g7[o]||[]), started=s.started||0;
    const segs=["ok","risk","delayed"].map(k=>{ const c=s.counts[k]||0; if(!c||!started) return ""; return `<i class="${k}" style="width:${(c/started*100).toFixed(2)}%" title="${esc(V.LABEL[k]+": "+c)}"></i>`; }).join("");
    return `<div class="ov-og"><div class="ov-og-h"><b>${esc(originLabel(o))}</b><span>${s.suppliers} supplier${s.suppliers===1?"":"s"} · ${nf(g[o].length,0)} parts</span></div><div class="ov-og-m"><b class="${bandCls(s.readiness)}">${pct0(s.readiness)}</b>${ovDelta(s.readiness,s7.readiness,"up","%")}</div>${started?`<div class="ov-stk">${segs}</div>`:`<div class="ov-nil">No started parts</div>`}<div class="ov-og-f"><span><i class="risk"></i>${s.counts.risk} at risk</span><span><i class="delayed"></i>${s.counts.delayed} delayed</span><span><i class="ns"></i>${s.counts.notstarted} not started</span></div></div>`;
  }).join("");
}
function timeline(m,pm){
  const hz=sixMonths(m.today);
  const rows=pm.map(x=>({x,items:x.ms.map((k,i)=>({k,i})).filter(({k})=>k.future&&k.R<hz.end&&k.n)})).filter(r=>r.items.length);
  if(!rows.length) return `<div class="ov-empty">No project facelift gate falls in the next 6 months for this selection. Those gates follow the project SOP, so a part-level SOP year can hide them.</div>`;
  const head=`<div class="ov-tl-h"><span></span>${hz.months.map((t,i)=>`<span class="mo${i===0?" now":""}">${esc(V.monY(t))}</span>`).join("")}</div>`;
  const body=rows.map(r=>{
    const cells=hz.months.map((t,i)=>{
      const next=i<5?hz.months[i+1]:hz.end, hit=r.items.filter(({k})=>k.R>=t&&k.R<next);
      return `<div class="mo${i===0?" now":""}">${hit.map(({k,i:mi})=>{
        const tip=`${r.x.p.name} · ${k.id} (${k.need}) · ${fmtDate(k.R)} · ${V.LABEL[k.st]||k.st} · ${k.bad} of ${k.n} facelift parts late`;
        return `<button type="button" class="ov-ms ${esc(k.st)}" data-act="sgo:srm-status-dash" title="${esc(tip)}"><i></i><span>${esc(k.id)}</span></button>`;
      }).join("")}</div>`;
    }).join("");
    return `<div class="ov-tl-r"><button type="button" class="pj" data-act="sgo:srm-status-dash" title="Open status tracking"><b>${esc(short(r.x.p.name))}</b><small>SOP ${esc(fmtDate(r.x.p.sop))}</small></button>${cells}</div>`;
  }).join("");
  return `<div class="ov-leg ov-leg-in"><span><i class="ok"></i>On track</span><span><i class="risk"></i>At risk</span><span><i class="delayed"></i>Delayed</span></div><div class="ov-tl">${head}${body}</div>`;
}
function toolingBody(sm,sm7){
  const v=sm.toolReadiness, rows=[["ok","On track",sm.toolCounts.ok],["risk","At risk",sm.toolCounts.risk],["delayed","Delayed",sm.toolCounts.delayed],["notstarted","Not yet due",sm.toolCounts.notstarted]];
  const max=Math.max(1,...rows.map(r=>r[2])), bar=v==null?0:Math.max(0,Math.min(100,v));
  return `<div class="ov-tool"><div class="ov-tool-top"><b class="${bandCls(v)}">${pct0(v)}</b><div class="ov-pbar" role="img" aria-label="Tooling readiness ${esc(pct0(v))}"><i class="${bandCls(v)}" style="width:${bar.toFixed(1)}%"></i></div>${ovDelta(v,sm7.toolReadiness,"up","%")}</div><div class="ov-tool-meta"><span><b>${nf(sm.toolSum,0)}</b> tools in progress</span><span><b>${nf(sm.toolN,0)}</b> parts started</span></div><div class="ov-tool-rows">${rows.map(([k,lab,n])=>`<div class="ov-tr"><span>${lab}</span><span class="bar"><i class="${k}" style="width:${(n/max*100).toFixed(1)}%"></i></span><b>${n}</b></div>`).join("")}</div><p class="ov-note">The percentage is plan attainment of parts whose tools have started. The rows count parts, by tooling status.</p></div>`;
}
const OV_LIST=20;   // rows kept in the two ranked lists on the Overview (paged 5 at a time); the full list is on Part Readiness
function riskTable(m,ev,end){
  const all=attention(ev).slice().sort((a,b)=>S.RANK[b.status]-S.RANK[a.status]||a.pt.sop-b.pt.sop||a.readiness-b.readiness);
  if(!all.length) return {n:0,shown:0,html:`<div class="ov-empty">No started part is at risk or delayed for this selection.</div>`};
  const rows=all.slice(0,OV_LIST);
  const body=rows.map((e,i)=>{
    const soon=e.pt.sop>=m.today&&e.pt.sop<end, k=driverMs(e), bits=[];
    if(e.tool&&(e.tool.st==="risk"||e.tool.st==="delayed")) bits.push(e.tool.st==="delayed"?"Tooling delayed":"Tooling at risk");
    if(k){ const dm=Math.round(k.dm); bits.push(k.id+" "+(dm>0?"+":"")+dm+" d"); }
    const high=e.status==="delayed";
    const impTip=high?"More than "+S.TH.delayed+" days late on an upcoming milestone":(S.TH.risk+1)+" to "+S.TH.delayed+" days late on an upcoming milestone";
    return `<button type="button" class="ov-li" data-act="srmpart:${esc(e.pt.id)}" title="Open supplier-readiness detail"><span class="rk">${i+1}</span><span class="bd"><b>${esc(e.pt.name)}</b><small>${esc(short(e.pt.progName))} · ${esc(e.pt.vendor)} · ${esc(bits.join(" · ")||S.STATUS[e.status])}</small></span><span class="ed"><span class="chip ${high?"chip-red":"chip-amber"}" title="${esc(impTip)}"><span class="chip-dot"></span>${high?"High":"Medium"}</span><small>${esc(fmtDate(e.pt.sop))}${soon?` <em class="ov-soon" title="SOP falls in the next 6 months">6 mo</em>`:""}</small></span></button>`;
  }).join("");
  return {n:all.length,shown:rows.length,html:`<div class="ov-li-h"><span></span><span>Part · project · supplier · risk</span><span>Impact · SOP</span></div><div class="ov-lis">${body}</div>`};
}
function actionTable(m,ev){
  const all=attention(ev).slice().sort((a,b)=>S.RANK[b.status]-S.RANK[a.status]||(a.next&&b.next?a.next.R-b.next.R:0)||a.readiness-b.readiness);
  if(!all.length) return {n:0,shown:0,html:`<div class="ov-empty">No part needs an action for this selection.</div>`};
  const rows=all.slice(0,OV_LIST), lbl={risk:"At risk",delayed:"Delayed"}, col={risk:"var(--c-amber)",delayed:"var(--red)"};
  const body=rows.map((e,i)=>{
    const due=e.next, drv=driverMs(e), own=m.vend[e.pt.vendor]?m.vend[e.pt.vendor].owner:"—", d=due?Math.round((due.R-m.today)/DAY):null;
    const when=d==null?"":d>0?"in "+d+" d":d===0?"today":Math.abs(d)+" d ago", act=S.nextAction(e);
    const rr=[["Owner",own]]; if(due) rr.push(["Next milestone",due.id+" · "+fmtDate(due.R)]);
    if(drv){ const dm=Math.round(drv.dm); rr.push(["Late milestone",drv.id+" "+(dm>0?"+":"")+dm+" d"]); }
    if(e.tool&&(e.tool.st==="risk"||e.tool.st==="delayed")) rr.push(["Tooling",e.tool.st==="delayed"?"Delayed":"At risk"]);
    rr.push(["Part SOP",fmtDate(e.pt.sop)]);
    const tip={t:e.pt.name,s:short(e.pt.progName)+" · "+e.pt.vendor,b:[lbl[e.status],col[e.status]],r:rr,f:"Click for part detail"};
    return `<tr class="ov-go" data-act="srmpart:${esc(e.pt.id)}" role="button" tabindex="0" data-sc-tip="${esc(JSON.stringify(tip))}"><td class="rk">${i+1}</td><td class="act"><b title="${esc(act)}">${esc(act)}</b></td><td class="pt"><b>${esc(e.pt.name)}</b><small>${esc(short(e.pt.progName))}</small></td><td class="sp">${esc(e.pt.vendor)}</td><td class="ow">${esc(own)}</td><td class="du">${due?`<b>${esc(fmtDate(due.R))}</b><small>${esc(when)}</small>`:"—"}</td><td class="st">${chip(e.status)}</td></tr>`; }).join("");
  return {n:all.length,shown:rows.length,html:`<table class="ov-tbl ov-aq"><thead><tr><th>#</th><th>Next action</th><th>Part</th><th>Supplier</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`};
}
/* Open actions: every at-risk / delayed part, one row each, with a value filter on every column heading and paging (FTable) */
function actionPanel(m,ev){
  const all=attention(ev).slice().sort((a,b)=>S.RANK[b.status]-S.RANK[a.status]||(a.next&&b.next?a.next.R-b.next.R:0)||a.readiness-b.readiness);
  const info=ovInfo("One row per at-risk or delayed part: delayed first, then the nearest next milestone. The action is that milestone's standard next step. Hover a row for the late milestone, tooling and part SOP date. Use the heading of any column to filter.");
  const head=`Open actions — highest priority <span class="count-pill">${all.length}</span> ${info}`, btn=`<button type="button" class="btn btn-sm" data-act="sgo:srm-tooling-dash">View all</button>`;
  if(!all.length) return U.el(U.panel(head,`<div class="ov-empty">No part needs an action for this selection.</div>`,{noPad:true,right:btn}));
  const lbl={risk:"At risk",delayed:"Delayed"}, col={risk:"var(--c-amber)",delayed:"var(--red)"};
  const splitAct=a=>{ const k="Escalate — recovery call: "; return a.startsWith(k)?{type:"Escalate — recovery call",step:a.charAt(k.length).toUpperCase()+a.slice(k.length+1)}:{type:a==="No open milestone"?"—":"Follow up",step:a}; };
  const rows=all.map(e=>{
    const due=e.next, drv=driverMs(e), own=m.vend[e.pt.vendor]?m.vend[e.pt.vendor].owner:"—", d=due?Math.round((due.R-m.today)/DAY):null;
    const when=d==null?"":d>0?"in "+d+" d":d===0?"today":Math.abs(d)+" d ago";
    const rr=[["Owner",own]]; if(due) rr.push(["Next milestone",due.id+" · "+fmtDate(due.R)]);
    if(drv){ const dm=Math.round(drv.dm); rr.push(["Late milestone",drv.id+" "+(dm>0?"+":"")+dm+" d"]); }
    if(e.tool&&(e.tool.st==="risk"||e.tool.st==="delayed")) rr.push(["Tooling",e.tool.st==="delayed"?"Delayed":"At risk"]);
    rr.push(["Part SOP",fmtDate(e.pt.sop)]);
    return {e,due,own,when,...splitAct(S.nextAction(e)),tip:{t:e.pt.name,s:short(e.pt.progName)+" · "+e.pt.vendor,b:[lbl[e.status],col[e.status]],r:rr,f:"Click for part detail"}};
  });
  const cell=(r,inner,cls)=>`<span class="oa-t${cls?" "+cls:""}" data-sc-tip="${esc(JSON.stringify(r.tip))}">${inner}</span>`;
  const plain=(key,label,f,w)=>({key,label,w,get:f,html:r=>cell(r,esc(f(r)))});
  const ft=FTable.create({id:"ov-actions",hideSum:true,sortable:true,pageSize:10,rowAct:r=>"srmpart:"+r.e.pt.id,empty:"No action matches these filters.",rows,columns:[
    plain("type","Action",r=>r.type,"14%"),plain("step","Next step",r=>r.step,"25%"),
    {key:"part",label:"Part",w:"14%",get:r=>r.e.pt.name,html:r=>cell(r,`<b>${esc(r.e.pt.name)}</b>`)},
    plain("proj","Project",r=>short(r.e.pt.progName),"8%"),plain("sup","Supplier",r=>r.e.pt.vendor,"13%"),plain("own","Owner",r=>r.own,"8%"),
    {key:"due",label:"Due",w:"9%",get:r=>r.due?fmtDate(r.due.R):"—",order:r=>r.due?r.due.R:9e15,html:r=>r.due?cell(r,`${esc(fmtDate(r.due.R))}<small class="v8-sm">${esc(r.when)}</small>`,"nw"):"—"},
    {key:"st",label:"Status",w:"9%",get:r=>S.STATUS[r.e.status],order:r=>-S.RANK[r.e.status],html:r=>cell(r,chip(r.e.status))}]});
  const pn=U.el(U.panel(head,"",{right:btn,sub:"Delayed first, then nearest milestone"}));
  pn.querySelector(".panel-body").appendChild(ft); return pn;
}
function insightPanel(list){
  if(!list.length) return `<div class="ov-empty">Nothing stands out for this selection.</div>`;
  const spark=Icons.svg("sparkles");
  return `<div class="ov-ins">${list.map(i=>`<div class="ov-in ${i.pri==="High"?"bad":"warn"}" ${i.a?`data-act="${esc(i.a)}" role="button" tabindex="0"`:""}><span class="ic">${Icons.svg("alert")}</span><div class="bd" title="${esc(i.s)}"><b>${esc(i.t)}</b><div class="tags"><span class="pri">${esc(i.pri||"Medium")} priority</span>${(i.tags||[]).slice(0,1).map(([ic,l])=>`<span class="tg">${Icons.svg(ic)}${esc(l)}</span>`).join("")}</div></div><div class="stat"><span class="si">${Icons.svg(i.ni||"info")}</span><div><b>${esc(i.n==null?"":i.n)}</b><small>${esc(i.nl||"")}</small></div></div>${i.q?`<button type="button" class="ask" data-act="ask:${esc(i.q)}" data-no-icon aria-label="Ask AIS" title="Ask AIS">${spark}</button>`:`<span></span>`}</div>`).join("")}</div>`;
}
function buildOverview(){
  const {m,ev,ev7,sm,sm7}=ctx(), w=document.createElement("div"); w.className="v8-page v8-board ov-page";
  const hd=U.header("Overview","Supplier readiness, milestone health and the risks that can affect upcoming SOP dates. Every figure follows the filters.");
  const h1=hd.querySelector("h1"); if(h1) h1.textContent="Supplier Readiness Management (SRM)";
  hd.appendChild(srmMeta(m));
  w.appendChild(hd); w.appendChild(overviewFilters(m));
  const sup=suppliers(m,ev), pm=progMilestones(m,ev), mc=msCounts(pm), weak=sup.filter(x=>x.started>=5&&x.readiness!=null&&x.readiness<60).length;
  const gates=mc.risk+mc.delayed;
  add(w,`<div class="pd-kw"><div class="pd-kpis k5">${[
    ovKpi({icon:"users",label:"Suppliers in scope",value:nf(sm.suppliers,0),sub:weak?`<span class="bad">${weak} below 60% readiness</span>`:`<span class="good">None below 60% readiness</span>`,act:"sgo:srm-performance-dash",tip:"Suppliers with parts in the current filter. Below 60% counts only suppliers with at least 5 started parts."}),
    ovKpi({icon:"package",label:"Parts in scope",value:nf(sm.n,0),sub:`${nf(sm.started,0)} started · ${nf(sm.counts.notstarted,0)} not started`,act:"sgo:srm-tooling-dash",tip:"Parts in the current filter. Not started means nomination is not yet due."}),
    ovKpi({icon:"target",label:"Overall supplier readiness",value:pct0(sm.readiness),tone:bandCls(sm.readiness),sub:"Average of started parts",tip:"100% means the next commitment is on or ahead of the required date. 0% means 40 or more days late."}),
    ovKpi({icon:"alert",label:"Milestones at risk",value:nf(gates,0),tone:mc.delayed?"bad":mc.risk?"warn":"good",sub:`<span class="bad">${mc.delayed} delayed</span> · <span class="warn">${mc.risk} at risk</span>`,act:"sgo:srm-status-dash",tip:"Project facelift gates still ahead of today. A gate is delayed when at least 20% of its facelift parts are more than 30 days late, and at risk at the model's lower share. On-track gates are not in this count."}),
    ovKpi({icon:"clipboard-check",label:"Open actions",value:nf(sm.actions,0),tone:sm.counts.delayed?"bad":sm.counts.risk?"warn":"",sub:`<span class="bad">${sm.counts.delayed} delayed</span> · <span class="warn">${sm.counts.risk} at risk</span>`,act:"sgo:srm-tooling-dash",tip:"Started parts that are at risk or delayed. One action per part."})
  ].join("")}</div></div>`);
  const r1=add(w,`<div class="ov-row two"></div>`);
  r1.appendChild(U.el(U.panel("Milestone health by project "+ovInfo("Each started part is counted once, by its worst upcoming milestone. The bar excludes parts that have not started. Click a project to open status tracking."),milestoneHealth(m,ev),{noPad:true,sub:"Share of started parts by milestone status",right:ovLeg})));
  const pSup=U.el(U.panel("Supplier readiness "+ovInfo("Lowest readiness first. A supplier needs at least 5 started parts before it is ranked — the same rule as the suppliers KPI."),supplierTable(sup),{noPad:true,sub:"Click a supplier to view its parts",right:`<button type="button" class="btn btn-sm" data-act="sgo:srm-performance-dash">View all</button>`}));
  r1.appendChild(pSup); ovPaginate(pSup,"tbody tr",7,"suppliers");
  const r2=add(w,`<div class="ov-row s12"></div>`);
  r2.appendChild(U.el(U.panel("Readiness by stage "+ovInfo("How many parts are at each readiness stage today. This is not a cumulative count of parts that have passed the stage."),stageBars(ev),{noPad:true,sub:"Share of parts in scope"})));
  const pIns=U.el(U.panel("Key insights "+ovInfo("Existing rules only: the largest cluster missing a milestone, suppliers under 60% readiness, tooling behind plan, the project with the highest delayed share, and at-risk parts whose price forecast rises more than 5%."),insightPanel(insights(m,ev,sm,sup)),{noPad:true,sub:"Recommendations · click a card to open the view",right:`<div class="ov-pgh"></div>`}));
  r2.appendChild(pIns); ovPaginate(pIns,".ov-ins > .ov-in",3,"",".ov-pgh");
  const r3=add(w,`<div class="ov-row one"></div>`);
  r3.appendChild(actionPanel(m,ev));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 2 · Part readiness (tooling & parts) */
const CT=["Facelift","Model-year change","AEKO running change"], CT_CLS=["c1","c2","c3"];
const CT_WHY={"Facelift":"the project's facelift (SOP date of the project)","Model-year change":"a model-year change (own part-level SOP date)","AEKO running change":"an AEKO running change (own part-level SOP date)"};
/* why each part is in SRM scope, per vertical */
function typeBars(ev){
  const rows=S.FAMILIES.map(f=>{ const l=ev.filter(e=>e.pt.family===f), c={}; CT.forEach(t=>{ c[t]=l.filter(e=>e.pt.changeType===t).length; }); return {label:f,c,n:l.length}; }).filter(r=>r.n);
  const tot={}; CT.forEach(t=>{ tot[t]=rows.reduce((s,r)=>s+r.c[t],0); }); const all=CT.reduce((s,t)=>s+tot[t],0)||1;
  const sum=`<div class="pv-sum">${CT.map((t,i)=>`<div class="${CT_CLS[i]}"><i></i><b>${tot[t]}</b><span>${t}</span><em>${Math.round(tot[t]/all*100)}%</em></div>`).join("")}</div>`;
  const mx=Math.max(1,...rows.map(r=>r.n));
  const body=rows.map(r=>`<div class="pv-r"><span class="n">${esc(r.label)}</span><span class="bar" style="width:${(r.n/mx*100).toFixed(1)}%">${CT.map((t,i)=>r.c[t]?`<i class="${CT_CLS[i]}" style="flex:${r.c[t]}" title="${esc(r.label)} · ${t}: ${r.c[t]} of ${r.n} parts">${r.c[t]/r.n>=.14?r.c[t]:""}</i>`:"").join("")}</span><span class="t">${r.n}</span></div>`).join("");
  return `${sum}<div class="pv"><div class="pv-h"><span>Vertical</span><span>Parts by change type</span><span class="r">Parts</span></div>${body}</div>`;
}
/* tools by how far the build has got, coloured by plan status; counts TOOLS (a part can need several), not parts */
function toolStages(ev){
  const ST=["Not started","Design","Build","Trial","Approved"], K=["ok","risk","delayed","notstarted"];
  const rows=ST.map(s=>{ const l=ev.filter(e=>e.tool&&e.tool.stage===s), c={ok:0,risk:0,delayed:0,notstarted:0}; l.forEach(e=>{ c[e.tool.st]=(c[e.tool.st]||0)+e.pt.tools; }); return {s,c,tools:K.reduce((a,k)=>a+c[k],0),parts:l.length}; });
  const total=rows.reduce((a,r)=>a+r.tools,0)||1, mx=Math.max(1,...rows.map(r=>r.tools)), behind=rows.reduce((a,r)=>a+r.c.risk+r.c.delayed,0), appr=rows.find(r=>r.s==="Approved").tools, ns=rows[0].tools;
  const head=`<div class="sf-hl"><div><b>${total}</b><span>tools on ${rows.reduce((a,r)=>a+r.parts,0)} parts</span></div><div><b class="good">${Math.round(appr/total*100)}%</b><span>approved (${appr})</span></div><div><b class="${behind?"bad":"good"}">${behind}</b><span>behind plan</span></div></div>`;
  const body=rows.map((r,i)=>`<div class="tl-r"><span class="n"><em>${i+1}</em>${r.s}</span><span class="bar" style="width:${Math.max(r.tools?3:0,r.tools/mx*100).toFixed(1)}%">${K.map(k=>r.c[k]?`<i class="${k}" style="flex:${r.c[k]}" title="${r.s} · ${STN[k]}: ${r.c[k]} tools">${r.c[k]/r.tools>=.16&&r.tools/mx>=.2?r.c[k]:""}</i>`:"").join("")}</span><span class="t"><b>${r.tools}</b><small>${r.parts} parts</small></span></div>`).join("");
  return `${head}<div class="tl"><div class="tl-h"><span>Build stage</span><span>Tools, coloured against plan</span><span class="r">Tools</span></div>${body}</div>
    <div class="tl-key"><span><i class="ok"></i>On plan</span><span><i class="risk"></i>${S.TH.risk}–${S.TH.delayed} days late</span><span><i class="delayed"></i>over ${S.TH.delayed} days late</span><span><i class="notstarted"></i>not yet due</span></div>
    <div class="pd-note" style="margin-top:8px">Stage = how far the tool has actually got (Design under 25%, Build under 65%, then Trial, then Approved). “Not started” tools are not yet due to start.</div>`;
}
/* Tools by stage: a numbered stage track, one card per stage (tools, parts, status mix, one status pill) and a hover card with the status of the tools and parts at that stage */
const STAGE_SVG={
  "Not started":'<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5"/>',
  Design:'<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  Trial:'<path d="M9 3h6M10 3v6L5 19a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-10V3M7.5 15h9"/>'};
const stageIcon=s=>STAGE_SVG[s]?`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${STAGE_SVG[s]}</svg>`:Icons.svg(s==="Build"?"settings":"check-circle");
function toolStagesPanel(ev){
  const ST=["Not started","Design","Build","Trial","Approved"], K=["ok","risk","delayed","notstarted"];
  const rows=ST.map(s=>{ const l=ev.filter(e=>e.tool&&e.tool.stage===s), c={ok:0,risk:0,delayed:0,notstarted:0}; l.forEach(e=>{ c[e.tool.st]=(c[e.tool.st]||0)+e.pt.tools; }); return {s,l,c,tools:K.reduce((a,k)=>a+c[k],0),parts:l.length}; });
  const total=rows.reduce((a,r)=>a+r.tools,0)||1, partsN=rows.reduce((a,r)=>a+r.parts,0), behind=rows.reduce((a,r)=>a+r.c.risk+r.c.delayed,0), appr=rows.find(r=>r.s==="Approved").tools;
  const stat=(v,l,c)=>`<div class="ts-st"><b${c?` class="${c}"`:""}>${v}</b><span>${l}</span></div>`;
  const stats=`<div class="ts-stats">${stat(nf(total,0),`tools on ${partsN} parts`)}${stat(Math.round(appr/total*100)+"%",`approved (${appr})`,"good")}${stat(nf(behind,0),"behind plan",behind?"bad":"")}</div>`;
  const tone=r=>r.s==="Not started"?"ns":r.s==="Approved"?"done":r.tools&&r.c.delayed/r.tools>=.2?"bad":r.c.delayed||r.c.risk?"warn":"good";
  const cols=rows.map((r,i)=>{
    const ps=S.summary(r.l), rdy=ps.readiness==null?"—":Math.round(ps.readiness)+"%";
    const tip={t:r.s+" stage",g:[{h:"Tools",n:r.tools,s:[["on plan",r.c.ok,"var(--ok)"],["at risk",r.c.risk,"var(--c-amber)"],["delayed",r.c.delayed,"var(--red)"],["not yet due",r.c.notstarted,"var(--faint)"]]},{h:"Parts",n:r.parts,s:[["on track",ps.counts.ok,"var(--ok)"],["at risk",ps.counts.risk,"var(--c-amber)"],["delayed",ps.counts.delayed,"var(--red)"],["not started",ps.counts.notstarted,"var(--faint)"]]}]};
    const behindN=r.c.risk+r.c.delayed;
    return `<div class="ts-col ${tone(r)}"><div class="ts-nd"><i>${i+1}</i><span>${r.s}</span></div><div class="ts-card" tabindex="0" data-sc-tip="${esc(JSON.stringify(tip))}"><div class="ts-top"><span class="ts-ic">${stageIcon(r.s)}</span><div class="ts-big"><b>${nf(r.tools,0)}</b><small>tools</small></div></div><dl class="ts-rows"><div><dt>${r.s==="Not started"?"Not yet due":"On plan"}</dt><dd class="${(r.s==="Not started"?r.c.notstarted:r.c.ok)?"":"zero"}">${r.s==="Not started"?r.c.notstarted:r.c.ok}</dd></div><div><dt>Behind plan</dt><dd class="${behindN?(tone(r)==="bad"?"bad":"warn"):"zero"}">${behindN}</dd></div></dl></div></div>`; }).join("");
  return U.panel("Tools by stage",`<div class="ts"><div class="ts-cols">${cols}</div></div>`,{noPad:true,sub:"How far each tool has got, and whether that is on plan",right:stats});
}
const PARTS_COLS=()=>{ const m=model(), mon=t=>new Date(t).toLocaleDateString("en-GB",{month:"short",year:"numeric",timeZone:"UTC"}); return [
  {key:"part",label:"Part",get:r=>r.e.pt.name,html:r=>`<b>${esc(r.e.pt.name)}</b><small class="v8-sm">${esc(r.e.pt.id)}</small>`},
  {key:"project",label:"Project",get:r=>short(r.e.pt.progName)},
  {key:"vertical",label:"Vertical",get:r=>r.e.pt.family},
  {key:"supplier",label:"Supplier",get:r=>r.e.pt.vendor},
  {key:"milestone",label:"Next milestone",get:r=>r.e.next?r.e.next.id:"—",order:r=>r.e.next?MS.findIndex(x=>x.id===r.e.next.id):99,html:r=>r.e.next?`<b>${esc(r.e.next.id)}</b><small class="v8-sm">${esc(r.e.next.need||MS.find(x=>x.id===r.e.next.id).need)}</small>`:"—"},
  {key:"required",label:"Required by",get:r=>r.e.next?mon(r.e.next.R):"—",order:r=>r.e.next?r.e.next.R:9e15,html:r=>r.e.next?`${esc(fmtDate(r.e.next.R))}<small class="v8-sm">${(()=>{ const d=Math.round((r.e.next.R-m.today)/DAY); return d>0?"in "+d+" days":d===0?"today":Math.abs(d)+" days ago"; })()}</small>`:"—"},
  {key:"slip",label:"Supplier commitment",get:r=>r.e.next?(r.e.next.dm>S.TH.delayed?"More than "+S.TH.delayed+" days late":r.e.next.dm>S.TH.risk?S.TH.risk+"–"+S.TH.delayed+" days late":"Up to "+S.TH.risk+" days late / on time"):"—",order:r=>r.e.next?r.e.next.dm:-99,html:r=>r.e.next?`<b class="${r.e.next.dm>S.TH.delayed?"bad":r.e.next.dm>S.TH.risk?"warn":""}">${r.e.next.dm>0?"+":""}${Math.round(r.e.next.dm)} d</b><small class="v8-sm">committed ${esc(fmtDate(r.e.next.C))}</small>`:"—"},
  {key:"status",label:"Status",get:r=>S.STATUS[r.e.status],order:r=>-S.RANK[r.e.status],html:r=>chip(r.e.status)},
  {key:"action",label:"Suggested next action",get:r=>S.nextAction(r.e),html:r=>`<span class="na">${esc(S.nextAction(r.e))}</span>`},
  {key:"owner",label:"Owner",get:r=>m.vend[r.e.pt.vendor].owner}]; };
/* line icons for the verticals and change types (the platform icon set has no engine / seat / disc …) */
const VICON={Powertrain:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  Electrical:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  Lighting:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  Sensors:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  HVAC:'<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 14 3 17 4c2 .8 1.5 3.8-1 5.5M13.6 12c4.4 0 7.4 2 6.4 5-.8 2-3.8 1.5-5.5-1M12 13.6c0 4.4-2 7.4-5 6.4-2-.8-1.5-3.8 1-5.5M10.4 12C6 12 3 10 4 7c.8-2 3.8-1.5 5.5 1"/>',
  "Interior Trim":'<path d="M7 4h3l1 8h6a2 2 0 0 1 2 2v3H9a2 2 0 0 1-2-2zM9 20h10"/>',
  Braking:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/>',
  Fasteners:'<path d="M8 3h8v4H8zM10 7v14M14 7v14M10 11h4M10 15h4M10 19h4"/>'};
const vIcon=f=>VICON[f]?`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${VICON[f]}</svg>`:Icons.svg(f==="Chassis"||f==="Body Stampings"?"car":"layers");
const CT_ICON=["car","calendar","settings"];
/* popup: one vertical split by change type (why its parts are in SRM scope), with the status mix and readiness of each group */
function openScopeModal(fam,evScope){
  const l=evScope.filter(e=>e.pt.family===fam), n=l.length||1;
  const bk=document.createElement("div"); bk.className="fc-modal-bk"; document.body.appendChild(bk);
  const close=()=>{ bk.remove(); document.removeEventListener("keydown",esck); }, esck=e=>{ if(e.key==="Escape") close(); };
  document.addEventListener("keydown",esck); bk.onclick=e=>{ if(e.target===bk) close(); };
  const rows=CT.map((t,i)=>{ const g=l.filter(e=>e.pt.changeType===t); return {t,i,k:g.length,s:S.summary(g)}; });
  const pc=share100(rows.map(r=>r.k)), band=v=>v>=80?"ok":v>=60?"risk":"delayed";
  const bar=`<div class="sm-bar">${rows.map((r,i)=>r.k?`<i class="${CT_CLS[r.i]}" style="flex:${r.k}" data-n="${r.k}" data-p="${pc[i]}%" title="${esc(r.t)}: ${r.k} of ${l.length} parts">${r.k/n>=.06?r.k:""}</i>`:"").join("")}</div>`;
  const leg=rows.map((r,i)=>`<div class="lg"><span class="dot ${CT_CLS[r.i]}"></span><div><b>${r.k} parts</b><span>${esc(r.t)}</span><small>${pc[i]}% of total</small></div></div>`).join("");
  const body=rows.map(r=>`<tr><td><span class="vn"><span class="vt">${Icons.svg(CT_ICON[r.i])}</span><span><b>${esc(r.t)}</b><small>${esc(CT_WHY[r.t])}</small></span></span></td><td class="num">${r.k}</td><td class="num ok">${r.s.counts.ok}</td><td class="num ${r.s.counts.risk?"warn":"zero"}">${r.s.counts.risk}</td><td class="num ${r.s.counts.delayed?"bad":"zero"}">${r.s.counts.delayed}</td><td class="num mut">${r.s.counts.notstarted}</td><td class="rd">${r.s.readiness==null?"—":`<span class="ov-mini"><i class="${band(r.s.readiness)}" style="width:${Math.max(0,Math.min(100,r.s.readiness)).toFixed(1)}%"></i></span><span class="pc">${Math.round(r.s.readiness)}%</span>`}</td></tr>`).join("");
  bk.innerHTML=`<div class="fc-modal sm" role="dialog" aria-modal="true" aria-label="${esc(fam)} by change type"><div class="sm-hd"><span class="sm-ic">${vIcon(fam)}</span><div><h2>${esc(fam)} <span class="count-pill">${l.length} parts</span></h2><p>Why these parts are in SRM scope, and how ready each group is</p></div><button class="sm-x" data-c="1" aria-label="Close">${Icons.svg("x")}</button></div>`+
    `<div class="sm-b"><section class="sm-sec"><div class="sm-sh"><div><h3>Scope breakdown</h3><p>Distribution of ${l.length} parts by change type.</p></div><div class="fc-segs tight" role="group" aria-label="Bar labels"><button type="button" class="fc-seg on" data-m="n">Parts</button><button type="button" class="fc-seg" data-m="p">Percentage</button></div></div>${bar}<div class="sm-leg">${leg}</div></section>`+
    `<section class="sm-sec"><div class="sm-sh"><div><h3>Readiness by change type</h3><p>Status distribution and readiness for each change type.</p></div></div><table class="sm-tbl"><thead><tr><th>Change type</th><th class="r">Parts</th><th class="r">On track</th><th class="r">At risk</th><th class="r">Delayed</th><th class="r">Not started</th><th>Readiness</th></tr></thead><tbody>${body}</tbody></table></section></div></div>`;
  bk.querySelector("[data-c]").onclick=close;
  bk.addEventListener("click",e=>{ const b=e.target.closest("[data-m]"); if(!b) return; bk.querySelectorAll("[data-m]").forEach(x=>x.classList.toggle("on",x===b)); bk.querySelectorAll(".sm-bar i").forEach(i=>{ if(i.textContent!=="") i.textContent=b.dataset.m==="p"?i.dataset.p:i.dataset.n; }); });
}
function buildParts(){
  const {m,ev,sm}=ctx(), w=page("Part Readiness","Tooling and part readiness by vertical, supplier and stage — pick a part for its commitments."), sup=suppliers(m,ev);
  /* the two scope panels always show every vertical (the Vertical filter would leave one row); project and supplier filters still apply */
  const evScope=S.scope(m,{project:F.project,supplier:F.supplier}), smScope=S.summary(evScope);
  skpis(w,[
    scard("package","Parts in scope",nf(sm.n,0),`${sm.suppliers} suppliers · ${nf(sm.counts.notstarted,0)} not started`),
    scard("check-circle","On track",sm.counts.ok,`${sm.started?Math.round(sm.counts.ok/sm.started*100):0}% of started parts`),
    scard("alert","At risk",sm.counts.risk,`${S.TH.risk}–${S.TH.delayed} days late`,{tone:sm.counts.risk?"warn":""}),
    scard("clock","Delayed",sm.counts.delayed,`more than ${S.TH.delayed} days late`,{tone:sm.counts.delayed?"bad":""}),
    scard("wrench","Tooling readiness",pct0(sm.toolReadiness),`${sm.toolN} parts with tooling · ${sm.toolSum} tools`,{tone:bandCls(sm.toolReadiness)})]);
  const famRows=S.FAMILIES.map(f=>{ const l=evScope.filter(e=>e.pt.family===f), s=S.summary(l); return {f,s}; }).filter(r=>r.s.n);
  const rdTone=v=>v==null?"":v>=80?"good":v>=60?"warn":"bad", rdBand=v=>v>=80?"ok":v>=60?"risk":"delayed";
  const vRow=({f,s})=>`<tr data-vert="${esc(f)}" role="button" tabindex="0" title="Show ${esc(f)} by change type"><td class="nm"><span class="vn"><span class="vt">${vIcon(f)}</span><b>${esc(f)}</b></span></td><td class="num">${s.n}</td><td class="num">${s.counts.ok}</td><td class="num ${s.counts.risk?"warn":"zero"}">${s.counts.risk}</td><td class="num ${s.counts.delayed?"bad":"zero"}">${s.counts.delayed}</td><td class="num">${s.counts.notstarted}</td><td class="num rdv ${rdTone(s.readiness)}">${s.readiness==null?"—":Math.round(s.readiness)+"%"}</td><td class="go">${Icons.svg("chevron-right")}</td></tr>`;
  const vTable=rows=>`<div class="pr-card"><table class="pr-tbl"><colgroup><col class="c1"><col><col><col><col><col><col><col class="cg"></colgroup><thead><tr><th>Vertical</th><th class="r">Parts</th><th class="r">On track</th><th class="r">At risk</th><th class="r">Delayed</th><th class="r">Not started</th><th class="r">Readiness</th><th></th></tr></thead><tbody>${rows.map(vRow).join("")}</tbody></table></div>`;
  const half=Math.ceil(famRows.length/2);
  const drawGrid=()=>PCOLS===1?`<div class="pr-grid one">${vTable(famRows)}</div>`:`<div class="pr-grid">${vTable(famRows.slice(0,half))}${vTable(famRows.slice(half))}</div>`;
  const tot=smScope, st=(n,l,c)=>`<div class="st"><b${c?` class="${c}"`:""}>${n}</b><span>${l}</span></div>`;
  const totalStrip=`<div class="pr-ts"><div class="tt">Total</div>${st(tot.n,"parts")}${st(tot.counts.ok,"on track")}${st(tot.counts.risk,"at risk",tot.counts.risk?"warn":"")}${st(tot.counts.delayed,"delayed",tot.counts.delayed?"bad":"")}${st(tot.counts.notstarted,"not started")}<div class="ov"><span class="ov-mini"><i class="${rdBand(tot.readiness)}" style="width:${Math.max(0,Math.min(100,tot.readiness||0)).toFixed(1)}%"></i></span><div><b>${tot.readiness==null?"—":Math.round(tot.readiness)+"%"}</b><span>overall readiness</span></div></div></div>`;
  const colsCtl=`<div class="fc-segs tight pr-cols" role="group" aria-label="Table layout"><button type="button" class="fc-seg" data-cols="2">2 columns</button><button type="button" class="fc-seg" data-cols="1">1 column</button></div>`;
  const leg=`<div class="ov-leg pr-leg"><span><i class="ok"></i>On track</span><span><i class="risk"></i>At risk</span><span><i class="delayed"></i>Delayed</span><span><i class="ns"></i>Not started</span></div>`;
  const prPanel=U.el(U.panel("Readiness by vertical",`<div class="pr-body"><div class="pr-host">${drawGrid()}</div>${totalStrip}</div>`,{noPad:true,sub:"Select a vertical to view its change-type breakdown",right:`<div class="pr-hr">${leg}${colsCtl}</div>`}));
  const prSync=()=>prPanel.querySelectorAll("[data-cols]").forEach(b=>{ const on=+b.dataset.cols===PCOLS; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); });
  prPanel.addEventListener("click",e=>{ const c=e.target.closest("[data-cols]"); if(c){ PCOLS=+c.dataset.cols; prPanel.querySelector(".pr-host").innerHTML=drawGrid(); prSync(); return; } const r=e.target.closest("[data-vert]"); if(r) openScopeModal(r.dataset.vert,evScope); });
  prPanel.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const r=e.target.closest&&e.target.closest("[data-vert]"); if(r){ e.preventDefault(); openScopeModal(r.dataset.vert,evScope); } } });
  prSync(); w.appendChild(prPanel);
  const g2=add(w,`<div class="v8-g"></div>`);
  g2.appendChild(U.el(toolStagesPanel(ev)));
  const rows=ev.filter(e=>e.started&&(e.status==="risk"||e.status==="delayed")).sort((a,b)=>S.RANK[b.status]-S.RANK[a.status]||(a.next&&b.next?a.next.R-b.next.R:0)||a.readiness-b.readiness).map(e=>({e}));
  const t=FTable.create({id:"srm-risk-parts",columns:PARTS_COLS(),rows,pageSize:10,rowAct:r=>"srmpart:"+r.e.pt.id,empty:"No at-risk or delayed part matches these filters."});
  add(w,U.panel(`At-risk parts <span class="count-pill">${rows.length}</span>`,"",{style:"margin-top:16px",sub:"Delayed first, then at risk, nearest milestone first · filter any column from its heading · click a row for the part's detail"}));
  w.lastChild.querySelector(".panel-body").appendChild(t);
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 3 · Status tracking (milestones) */
/* side drawer for one milestone of one project (opened from a diamond on the project timeline): status by vertical + average slip by supplier, for that project's facelift parts */
function openMilestoneDrawer(code,mi){
  const m=model(), x=progMilestones(m,ctx().ev).find(r=>r.p.code===code); if(!x) return;
  const k=x.ms[mi], evp=x.evp, st=k.n?k.st:"notstarted", pn=short(x.p.name);
  const dd=Math.round((k.R-m.today)/DAY), when=dd>0?"in "+dd+" days":dd===0?"today":Math.abs(dd)+" days ago", sl=Math.round(k.avgSlip||0);
  const stOf=e=>e.started&&e.milestones[mi].future?e.milestones[mi].st:(e.started?"ok":"notstarted");
  const sup=suppliers(m,evp).map(s=>{ const l=s.list.filter(e=>e.started&&e.milestones[mi].future); return {name:s.name,n:l.length,v:l.length?l.reduce((a,e)=>a+e.milestones[mi].dm,0)/l.length:0}; }).filter(r=>r.n).sort((a,b)=>b.v-a.v);
  const card=(l,v,s)=>`<div class="dr-c"><span>${l}</span><b>${v}</b><small>${s}</small></div>`;
  const cards=`<div class="dr-cards">${card("Required by",esc(fmtDate(k.R)),when)}${card("Parts late",k.n?`${k.bad} of ${k.n}`:"—",k.n?"started facelift parts":"none started")}${card("Average slip",k.n?(sl>0?"+":"")+sl+" d":"—",k.fc?"supplier commitment "+esc(fmtDate(k.fc)):"")}</div>`;
  const body=!k.n?`<div class="dr-sec"><p class="mut small">No facelift part of ${esc(pn)} has started yet, so there is no status to break down.</p></div>`
    :`<div class="dr-sec"><h4>Status by vertical</h4>${statusBars(verticalRows(evp,stOf))}<div class="mut small" style="margin-top:8px">Parts whose date has passed count as met.</div></div>
      <div class="dr-sec"><h4>Average slip by supplier</h4>${sup.length?C.bars({signed:true,fmt:v=>(v>0?"+":"")+Math.round(v)+" d",items:sup.slice(0,8).map(r=>({label:r.name,value:r.v,note:r.n+(r.n===1?" part":" parts"),color:r.v>S.TH.delayed?V.COL.delayed:r.v>S.TH.risk?V.COL.risk:V.COL.ok}))}):`<div class="mut small">This milestone date has passed, so slip is only shown for upcoming milestones.</div>`}<div class="mut small" style="margin-top:8px">Days later (+) or earlier (−) than required, for parts with the milestone still ahead.</div></div>`;
  const html=`<div class="dr"><div class="dr-hd"><div><div class="dr-n">${esc(k.id)} · ${esc(pn)}</div><div class="dr-tags"><span>${esc(k.need)}</span><span>SOP ${esc(fmtDate(x.p.sop))}</span><span>${evp.length} facelift parts</span></div></div>${chip(st)}</div>${cards}${body}</div>`;
  Drawer.open(`${k.id} · ${pn}`,"",null);
  const bd=document.getElementById("drawer-body"); bd.innerHTML=html; U.wire(bd);
  document.querySelector("#drawer .drawer-footer").style.display="none"; document.getElementById("drawer").classList.add("fcwide");
}
function buildStatus(){
  const {m,ev,sm}=ctx(), w=page("Status Tracking","Milestone chain per project — required date versus what suppliers have committed."), pm=progMilestones(m,ev), mc=msCounts(pm);
  const started=ev.filter(e=>e.started), nextSlip=started.length?started.reduce((s,e)=>s+(e.next?e.next.dm:0),0)/started.length:null;
  const upcoming=[]; pm.forEach(x=>x.ms.forEach(k=>{ if(k.future) upcoming.push({x,k}); })); upcoming.sort((a,b)=>a.k.R-b.k.R);
  skpis(w,[
    scard("calendar","Milestones ahead",upcoming.length,`next: ${upcoming[0]?esc(upcoming[0].k.id)+" · "+esc(short(upcoming[0].x.p.name))+" · "+fmtDate(upcoming[0].k.R):"—"}`),
    scard("check-circle","On track",mc.ok,"supplier commitments in time"),
    scard("alert","At risk",mc.risk,"some parts forecast late",{tone:mc.risk?"warn":""}),
    scard("clock","Delayed",mc.delayed,"20%+ of parts late",{tone:mc.delayed?"bad":""}),
    scard("activity","Avg slip at next milestone",nextSlip==null?"—":(nextSlip>0?"+":"")+Math.round(nextSlip)+" d",`over ${started.length} started parts`)]);
  add(w,U.panel("Project timeline",V.gantt(ganttRows(pm,false),{today:m.today,rowH:50,width:980}),{sub:"Required date of each milestone per project, coloured by status · the red line is today"}));
  w.lastChild.style.marginTop="16px";
  /* matrix */
  /* upcoming */
  add(w,U.panel("Upcoming milestones",U.table(["Project","Milestone","Required","In","Status","Parts late"],upcoming.slice(0,8).map(({x,k})=>`<tr><td><b>${esc(short(x.p.name))}</b></td><td>${esc(k.id)}<small class="v8-sm">${esc(k.need)}</small></td><td>${esc(fmtDate(k.R))}</td><td>${Math.round((k.R-m.today)/DAY)} days</td><td>${chip(k.st)}</td><td>${k.n?k.bad+" of "+k.n:"—"}</td></tr>`).join("")),{noPad:true,style:"margin-top:16px"}));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ 4 · Supplier performance */
function buildPerformance(){
  if(DRILL){ F.supplier=DRILL.prev; DRILL=null; }   // coming back from a supplier's parts: show every supplier again
  const {m,ev,sm}=ctx(), w=page("Supplier Performance","Readiness, delivery and quality per supplier — who is on track and who needs a conversation."), sup=suppliers(m,ev).filter(x=>x.n);
  const ravg=sup.filter(x=>x.readiness!=null), av=k=>sup.length?sup.reduce((s,x)=>s+x[k],0)/sup.length:null;
  const avgR=ravg.length?ravg.reduce((s,x)=>s+x.readiness,0)/ravg.length:null, low60=ravg.filter(x=>x.readiness<60);
  skpis(w,[
    scard("building","Suppliers",sup.length,`${sup.filter(x=>x.origin==="international").length} international`),
    scard("target","Avg readiness",pct0(avgR),`${ravg.filter(x=>x.readiness>=80).length} suppliers at 80%+`,{tone:bandCls(avgR)}),
    scard("clock","Avg delivery",pct0(av("delivery")),"on-time delivery, last 6 months"),
    scard("shield","Avg quality",pct0(av("quality")),"quality performance, last 6 months"),
    scard("alert","Below 60% readiness",low60.length,`<span class="bad">${esc(low60.map(x=>x.name).slice(0,2).join(", ")||"none")}</span>`,{tone:low60.length?"bad":""})]);
  const low=ravg.slice().sort((a,b)=>a.readiness-b.readiness).slice(0,5).map(x=>x.name);
  const rdTxt=x=>x.readiness==null?"Not started":Math.round(x.readiness)+"%";
  const pts=sup.map(x=>({x:x.delivery,y:x.quality,r:x.n,color:x.readiness==null?V.COL.notstarted:V.band(x.readiness),label:x.name,showLabel:low.includes(x.name),click:"sgo:srm-tooling-dash",
    tip:{t:x.name,s:`${originLabel(x.origin)} · ${x.n} parts`,b:[rdTxt(x)+" ready",x.readiness==null?V.COL.notstarted:V.band(x.readiness)],r:[["Delivery",x.delivery+"%"],["Quality",x.quality+"%"],["On track",x.counts.ok],["At risk",x.counts.risk],["Delayed",x.counts.delayed],["SRM owner",x.owner]],f:"Click to open Part Readiness"}}));
  add(w,U.panel("Delivery vs quality",V.scatter(pts,{xLabel:"Delivery performance %",yLabel:"Quality performance %",width:1240,height:320})+`<div class="v8-legend"><span><i style="background:${V.COL.ok}"></i>Readiness 80%+</span><span><i style="background:${V.COL.risk}"></i>60–79%</span><span><i style="background:${V.COL.delayed}"></i>&lt;60%</span><span>Bubble size = parts</span></div>`,{}));
  /* all suppliers: paged, with a value filter on every column heading */
  const rdBand=x=>x.readiness==null?"Not started":x.readiness>=80?"80% or more":x.readiness>=60?"60–79%":"Under 60%", sBand=v=>v>=90?"90% or more":v>=80?"80–89%":"Below 80%";
  const rows=sup.slice().sort((a,b)=>(a.readiness==null)-(b.readiness==null)||b.readiness-a.readiness).map(x=>{ const tr=trend(m,x.name).map(v=>v==null?0:v); return Object.assign({tr,slope:tr[tr.length-1]-tr[0]},x); });
  const cnt=(key,label,f)=>({key,label,get:f,align:"r",order:f});
  const ft=FTable.create({id:"srm-suppliers",hideSum:true,pageSize:10,rowAct:x=>"sgo:srm-tooling-dash",empty:"No supplier matches these filters.",rows,columns:[
    {key:"sup",label:"Supplier",get:x=>x.name,html:x=>`<b>${esc(x.name)}</b><small class="v8-sm">${esc(originLabel(x.origin))}</small>`},
    cnt("n","Parts",x=>x.n),cnt("ok","On track",x=>x.counts.ok),cnt("risk","At risk",x=>x.counts.risk),cnt("delayed","Delayed",x=>x.counts.delayed),
    {key:"rd",label:"Readiness",get:rdBand,order:x=>x.readiness==null?-1:x.readiness,html:x=>readBar(x.readiness)},
    {key:"tr",label:"6-month trend",get:x=>x.slope>=2?"Improving":x.slope<=-2?"Declining":"Steady",order:x=>x.slope,html:x=>C.spark(x.tr,{w:84,h:24,color:x.readiness==null?V.COL.notstarted:V.band(x.readiness)})},
    {key:"del",label:"Delivery",get:x=>sBand(x.delivery),order:x=>x.delivery,html:x=>x.delivery+"%"},
    {key:"q",label:"Quality",get:x=>sBand(x.quality),order:x=>x.quality,html:x=>x.quality+"%"},
    {key:"own",label:"SRM owner",get:x=>x.owner}]});
  add(w,U.panel(`All suppliers <span class="count-pill">${rows.length}</span>`,"",{}));
  w.lastChild.querySelector(".panel-body").appendChild(ft);
  add(w,U.note("Delivery and quality scores are generated for this prototype (no supplier-scorecard feed yet); readiness and part counts come from the readiness model.","info"));
  U.wire(w); return w;
}

/* ------------------------------------------------------------ wiring: actions, navigation, screens */
Object.assign(U.actions,{
  sgo:v=>{ Router.go(v,"srm"); },
  sdrill:v=>{ DRILL={prev:F.supplier}; F.supplier=v; Router.go("srm-tooling-dash","srm"); },
  sfg:v=>{ const [kv,scr]=v.split("|"), [k,val]=kv.split("="); F[k]=val; Router.go(scr,"srm"); },
  sms:v=>{ MSEL=+v; Router.render(); },
  sml:v=>{ const [code,mi]=v.split("|"); if(code&&F.brand&&!inBrand(code)) F.brand=""; if(code) F.project=code; MSEL=+mi; Router.go("srm-status-dash","srm"); },
  srmpart:v=>{ openSrmPart(v); },
  smd:v=>{ const [code,mi]=v.split("|"); openMilestoneDrawer(code,+mi); },
});
const SRM_LABEL={"srm-overview":"Overview","srm-tooling-dash":"Part Readiness","srm-status-dash":"Status Tracking","srm-performance-dash":"Supplier Performance"};
const SRM_IDS=Object.keys(SRM_LABEL);
SRM_IDS.forEach(id=>{ const old=NAV.srm.findIndex(x=>x.id===id); if(old>=0) NAV.srm.splice(old,1); });
const at=NAV.srm.findIndex(x=>x.sep==="SRM Dashboards");
NAV.srm.splice(at+1,0,{id:"srm-overview",label:"Overview",icon:"📊"},{id:"srm-tooling-dash",label:"Part Readiness",icon:"🛠"},{id:"srm-status-dash",label:"Status Tracking",icon:"📍"},{id:"srm-performance-dash",label:"Supplier Performance",icon:"📈"});
Object.assign(NAV_ICONS,{"srm-overview":"layout","srm-performance-dash":"trend-up"});
Object.assign(NAV_SHORT,{"srm-performance-dash":"Performance"});
const dash=MODULE_TREE.srm.find(g=>g[0]==="Dashboards & reports"); if(dash) dash[1]=SRM_IDS.concat(["reports-srm"]);
NAV_HIDDEN.delete("srm-performance-dash");
const _nl2=navLabel; navLabel=function(mod,s){ return SRM_LABEL[s]||_nl2(mod,s); };
Object.assign(SCREENS.srm,{"srm-overview":buildOverview,"srm-tooling-dash":buildParts,"srm-status-dash":buildStatus,"srm-performance-dash":buildPerformance});

/* ------------------------------------------------------------ Radar (Ask AIS): SRM questions */
(function(){
  const base=Radar.local, R=Radar.R, SRM_RE=/(\bsrm\b|readiness|milestone (status|slip)|tooling (status|behind)|tools? behind|which suppliers.*(late|delay)|supplier.*(delay|late)|delayed (part|supplier)|b-release|\bvff\b|\bpvs\b|0-series|sop (readiness|status))/i;
  Radar.local=function(q,ctx){
    if(!SRM_RE.test(q)||/price|cost|forecast for/i.test(q)&&!/\bsrm\b|readiness|milestone/i.test(q)) return base(q,ctx);
    const m=model(), ev=S.scope(m,{}), sm=S.summary(ev), sup=suppliers(m,ev).filter(x=>x.started>=5&&x.readiness!=null).sort((a,b)=>a.readiness-b.readiness);
    const fam=S.FAMILIES.map(f=>{ const s=S.summary(ev.filter(e=>e.pt.family===f)); return {label:f,v:s.counts.risk+s.counts.delayed,tone:"up"}; });
    const html=`<p>Across <b>${sm.n}</b> parts and <b>${sm.suppliers}</b> suppliers, <b>${sm.started}</b> are in flight: <b>${sm.counts.ok}</b> on track, <b>${sm.counts.risk}</b> at risk, <b>${sm.counts.delayed}</b> delayed (${sm.counts.notstarted} not started). Supplier readiness is <b>${pct0(sm.readiness)}</b>, tooling readiness <b>${pct0(sm.toolReadiness)}</b> (${sm.toolN} tools).</p>`+
      `<p>Lowest readiness: ${sup.slice(0,3).map(x=>`<b>${esc(x.name)}</b> ${Math.round(x.readiness)}% (${x.counts.delayed} delayed)`).join(", ")}. Highest: ${sup.slice(-2).reverse().map(x=>`${esc(x.name)} ${Math.round(x.readiness)}%`).join(", ")}.</p><p class="rd-m">Readiness data is generated for this prototype; parts, projects, suppliers and SOP dates are platform data.</p>`;
    return R(html,{charts:[{kind:"bar",title:"Parts at risk or delayed, by vertical",unit:"currency",currencySymbol:"",source:"SRM readiness model",orientation:"horizontal",series:[{key:"v",label:"Parts"}],rows:fam.map(x=>({label:x.label,values:{v:x.v},tone:"neutral"}))}],
      actions:[{l:"SRM Overview",a:"goto:srm/srm-overview"},{l:"Part Readiness",a:"goto:srm/srm-tooling-dash"},{l:"Status Tracking",a:"goto:srm/srm-status-dash"}],basis:"SRM readiness model · computed in this page"});
  };
})();

window.V8Srm={scard,skpis,toolingBody,model,F,page,add,kpiRow,kcard,chip,short,fmtDate,suppliers,openSrmPart,pct0,readBar,delta,weekLabel,filterBar,chipCls};
})();
