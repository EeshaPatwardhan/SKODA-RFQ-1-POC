/* =====================================================================
   V8  ·  Procurement drill-downs — Part Details · Supplier Details · Price Analysis
   Reached from the Procurement Dashboard (click a part, a supplier, the Since-nomination KPI) and from the Procurement menu.
   Nothing here creates data: every figure comes from the same part panel (PocCore), price versions, cost breakdowns, change requests,
   technical changes, supplier master and SRM model that the rest of the prototype uses, and the same cost-per-vehicle basis
   (piece price × quantity per vehicle).  History only — forecasts stay in Forecast & risk.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, esc=C.esc, nf=C.nf, NH=P.NH, PX=window.V8Proc;
const TODAY_S=(typeof TODAY!=="undefined"?TODAY:"2026-07-29");
const pct=(a,b)=>b?(a/b-1)*100:0, sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const sgn=(v,d)=>U.sgn(v,d==null?1:d), cr=v=>U.cr(v), inr=(v,d)=>U.inr(v,d), sp=(v,s)=>U.spend(v,s);
const short=n=>String(n).replace(/^(SKODA|VW) /,"");
const fmtDate=d=>{ try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch(e){ return String(d); } };
const A=()=>window.__cbdApi;
const CTX={part:null,vert:"",sup:"",supplier:null,svert:"",spart:"",price:{category:"",supplier:"",part:"",vpart:"",vtab:"category"}};
const progOf=code=>P.PROGS.find(p=>p.code===code)||P.PROGS[0];
const projectParts=code=>P.PARTS.filter(p=>p.progCode===code);
const costOf=(l,f)=>sum(l,f);                       // one project at a time → cost of that car
const lineCost=p=>p.qty*p.cur;
const dpOf=id=>DATA.parts.find(x=>x.number===id);
const versionsOf=id=>(DATA.priceVersions[id]||[]).slice().sort((a,b)=>new Date(a.effectiveFrom)-new Date(b.effectiveFrom));
const targetOf=id=>{ const v=versionsOf(id), l=v[v.length-1]; return l&&l.target?l.target:null; };
const chip=(v)=>`<span class="chip ${Math.abs(v)<0.05?"chip-gray":v>0?"chip-red":"chip-green"}"><span class="chip-dot"></span>${sgn(v)}</span>`;   // price up = red
const tone=v=>v>0?"bad":v<0?"good":"";
const info=t=>`<span class="pd-i" title="${esc(t)}">${Icons.svg("info")}</span>`;
const ptitle=(t,tip)=>tip?`${t} ${info(tip)}`:t;
const empty=t=>`<div class="pd-empty">${t}</div>`;
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const more=(act,label)=>`<div class="pd-more"><a href="#" data-act="${act}">${label}${arrow}</a></div>`;
const srm=()=>{ try{ if(typeof SrmData==="undefined"||!window.V8Srm) return null; const m=V8Srm.model(); return {m,ev:SrmData.evaluate(m)}; }catch(e){ return null; } };
const kcard=(o)=>`<div class="pd-kpi${o.act?" kpi-link":""}" ${o.act?`data-act="${o.act}" role="button" tabindex="0"`:""} title="${esc(o.tip||"")}"><div class="top"><span class="ic">${Icons.svg(o.icon)}</span><span class="lb${o.wrap?" wrap":""}">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span>${o.chip?`<span class="ch" title="${esc(o.chipTip||"")}">${o.chip}</span>`:""}</div><div class="sb" title="${esc(String(o.sub||"").replace(/<[^>]*>/g,""))}">${o.sub||""}</div></div>`;
const sel=(k,label,opts,val,icon)=>`<label class="pd-f"><span>${label}</span><span class="pd-sel">${icon?Icons.svg(icon):""}<select data-pf="${k}">${opts.map(o=>`<option value="${esc(o[0])}"${String(o[0])===String(val)?" selected":""}>${esc(o[1])}</option>`).join("")}</select></span></label>`;
const projSel=()=>sel("project","Project",P.PROGS.map(p=>[p.code,p.name]),PX.PF.project,"car");
function go(screen){ Router.go(screen,"procurement"); }
/* shows `size` rows at a time with a pager under the table */
function paginate(panel,rowSel,size,host){
  const rows=[...panel.querySelectorAll(rowSel)], body=host||panel.querySelector(".panel-body"); if(rows.length<=size||!body) return;
  const pages=Math.ceil(rows.length/size), foot=document.createElement("div"); foot.className="pd-pgf"; let p=0;
  const draw=()=>{ rows.forEach((r,i)=>r.classList.toggle("pd-hide",Math.floor(i/size)!==p));
    foot.innerHTML=`<span>${p*size+1}–${Math.min(rows.length,(p+1)*size)} of ${rows.length}</span><div class="ft-pg"><button type="button" data-p="${p-1}" ${p<=0?"disabled":""} aria-label="Previous page">‹</button>${Array.from({length:pages},(_,i)=>`<button type="button" data-p="${i}" class="${i===p?"on":""}" ${i===p?'aria-current="page"':""}>${i+1}</button>`).join("")}<button type="button" data-p="${p+1}" ${p>=pages-1?"disabled":""} aria-label="Next page">›</button></div>`; };
  foot.addEventListener("click",e=>{ const b=e.target.closest("[data-p]"); if(b&&!b.disabled){ p=+b.dataset.p; draw(); } });
  body.appendChild(foot); draw();
}

/* ------------------------------------------------------------ page frame: header, back action, as-of + disclaimer, filter bar */
function frame(title,barHtml,onChange){
  const w=document.createElement("div"); w.className="v8-page v8-board";
  const hd=U.header(title);
  const meta=document.createElement("div"); meta.className="pd-meta";
  meta.innerHTML=`<span>Prices as of <b>${esc(P.monthLabel(P.MONTHS[NH-1]))}</b> · workflows as of <b>${esc(fmtDate(TODAY_S))}</b></span><span class="pd-ill">Illustrative data — synthetic scenario</span><button type="button" class="btn btn-sm" data-act="pdback">Back to Procurement Overview</button>`;
  hd.appendChild(meta); w.appendChild(hd);
  if(barHtml){ const bar=document.createElement("div"); bar.className="pd-fbar"; const pg=progOf(PX.PF.project);
    bar.innerHTML=(pg&&window.V8Art?`<div class="pd-carbox solo">${window.V8Art.car(pg.code)}</div>`:"")+barHtml;
    bar.addEventListener("change",e=>{ const k=e.target.dataset&&e.target.dataset.pf; if(k) onChange(k,e.target.value); });
    bar.addEventListener("click",e=>{ if(e.target.closest('[data-pf-reset]')) onChange("reset"); });
    w.appendChild(bar); }
  return w;
}
const add=(w,h)=>{ const e=U.el(h); w.appendChild(e); return e; };
const row=(w,cls,panels)=>{ const g=document.createElement("div"); g.className="pd-gw"; g.innerHTML=`<div class="pd-row ${cls}"></div>`; const r=g.firstChild; panels.forEach(h=>r.appendChild(U.el(h))); w.appendChild(g); return r; };
const kpis=(w,cards,n)=>add(w,`<div class="pd-kw"><div class="pd-kpis k${n||cards.length}">${cards.join("")}</div></div>`);
const note=t=>`<div class="v8-foot">${t}</div>`;

/* ================================================================== PART DETAILS */
function pickPart(){
  let p=CTX.part?P.part(CTX.part):null; const missing=!!CTX.part&&!p;
  if(p) PX.PF.project=p.progCode; else p=projectParts(PX.PF.project).sort((a,b)=>lineCost(b)-lineCost(a))[0];
  CTX.part=p.id; return {p,missing};
}
function partHeader(p,tgt){
  const s=srm(), ev=s&&s.ev.find(e=>e.pt.id===p.id), st=ev&&SrmData.STAGES[ev.stage];
  const vs=versionsOf(p.id), last=vs[vs.length-1], lastUp=last?fmtDate(last.effectiveFrom):P.monthLabel(P.MONTHS[NH-1]);
  const phase=ev?(ev.stage<0?"Not started":st.label):null;
  return `<div class="pd-card pd-slim"><dl class="meta"><div><dt>Part number</dt><dd class="mono">${esc(p.id)}</dd></div><div><dt>Program phase</dt><dd>${phase?esc(phase):"—"}</dd></div><div><dt>SRM status</dt><dd>${ev?`<span class="chip ${({ok:"chip-green",risk:"chip-amber",delayed:"chip-red",notstarted:"chip-gray"})[ev.status]}"><span class="chip-dot"></span>${esc(SrmData.STATUS[ev.status])}</span>`:"—"}</dd></div><div><dt>Last price update</dt><dd>${esc(lastUp)}</dd></div></dl></div>`;
}
function priceHistoryPanel(p,tgt){
  const vs=versionsOf(p.id); let chart;
  if(vs.length&&window.__priceTimeline){ chart=window.__priceTimeline(vs,p,vs[vs.length-1].vsi,tgt); }
  else{
    const series=[{name:"Monthly price",data:p.h,color:C.C.anchor,width:2.2,area:true},{name:"Nomination price",data:new Array(NH).fill(p.nom),color:C.C.info,dash:"5 4",width:1.4}];
    if(tgt) series.push({name:"Target price",data:new Array(NH).fill(tgt),color:C.C.ok,dash:"5 4",width:1.4});
    chart=C.line({labels:P.MONTHS.map(U.ml),height:300,mLeft:64,maxX:8,yFmt:v=>inr(v),aria:"Price history of "+p.name,series,tip:true,tipExtra:i=>({k:"Change vs nomination",v:sgn(pct(p.h[i],p.nom)),tone:tone(pct(p.h[i],p.nom))})});
  }
  return U.panel(ptitle("Price history","Monthly piece price from the price panel (nomination = first month). Where the part has recorded price versions they are drawn as the stepped line."),chart);
}
function priceDetailsPanel(p){
  const vs=versionsOf(p.id); let body;
  if(vs.length){
    body=U.table(["Price type","Effective","Price (₹)","Change (₹)","Change","Remarks"],vs.map((v,i)=>{ const pv=i?vs[i-1]:null, d=pv?v.price-pv.price:null;
      return `<tr><td><b>${i===0?"Nomination price":esc(v.source)}</b></td><td>${esc(fmtDate(v.effectiveFrom))}</td><td class="r">${nf(v.price,0)}</td><td class="r ${tone(d)}">${d==null?"—":(d>=0?"+":"−")+nf(Math.abs(d),0)}</td><td>${pv?chip(pct(v.price,pv.price)):"—"}</td><td>${v.changeReq?Components.wfChip(v.changeReq):(i===0?"Initial price":"—")}</td></tr>`; }).join(""));
  }else{
    const idx=[[0,"Nomination"],[NH-25,"24 months ago"],[NH-13,"12 months ago"],[NH-7,"6 months ago"],[NH-1,"Current"]];
    body=`<div class="mut small" style="margin-bottom:8px">No recorded price versions for this part — the monthly price panel is shown instead.</div>`+U.table(["Point","Month","Price (₹)","Change (₹)","Change"],idx.map(([i,l],k)=>{ const v=p.h[i], pv=k?p.h[idx[k-1][0]]:null, d=pv==null?null:v-pv;
      return `<tr><td><b>${l}</b></td><td>${esc(P.monthLabel(P.MONTHS[i]))}</td><td class="r">${nf(v,0)}</td><td class="r ${tone(d)}">${d==null?"—":(d>=0?"+":"−")+nf(Math.abs(d),0)}</td><td>${pv==null?"—":chip(pct(v,pv))}</td></tr>`; }).join(""));
  }
  return U.panel(ptitle("Price details","Recorded price versions with effective dates and the change request behind each, or the monthly price panel when none exist."),`<div class="pd-tscroll">${body}</div>`);
}
function costBreakdownPanel(p){
  const cbd=DATA.cbds[p.id]; if(!cbd||!A()) return U.panel(ptitle("Cost breakdown","Cost components of the current piece price, from the part's cost breakdown (CBD)."),empty("No cost breakdown has been built for this part."));
  try{ A().sync(cbd); }catch(e){}
  const nodes=window.CbdCore?CbdCore.contributing(cbd):cbd.tree.filter(n=>+n.cost>0), tot=sum(nodes,n=>+n.cost)||1, pal=["#0a6a4e","#2f8f6e","#5bb08f","#8fcdb3","#c3e5d4","#9db7ad"];
  const slices=nodes.map((n,i)=>({label:n.name.replace(/\s*\(.*\)$/,""),value:+n.cost,color:pal[i%pal.length]}));
  const donut=C.donut(slices,{size:150,center:inr(tot),centerSub:"per part",aria:"Cost breakdown"}).replace(/<ul class="pc-dl">[\s\S]*?<\/ul>/,"");
  return U.panel(ptitle("Cost breakdown (current price)","Components of the cost breakdown: raw material (weights × commodity price), import content (× FX) and manual cost nodes. Total is the cost-breakdown price, which the part's piece price follows."),`<div class="pd-conc2"><div class="dn">${donut}</div><div class="lg">${slices.map(s=>`<div class="o"><i style="background:${s.color}"></i><span title="${esc(s.label)}">${esc(s.label)}</span><b>${(s.value/tot*100).toFixed(0)}% · ${inr(s.value)}</b></div>`).join("")}</div></div><div class="pd-tag">Cost-breakdown total <b>${inr(tot)}</b> · piece price <b>${inr(p.cur)}</b></div>`);
}
function decisionsFor(match){
  const out=[];
  DATA.changeRequests.filter(match.cr).forEach(c=>out.push({kind:"Change request",wf:c.wf,subject:c.subject+(c.type==="price"&&c.newValue?` · ₹${nf(c.value,0)} → ₹${nf(c.newValue,0)}`:""),status:c.status,stage:(ApprovalEngine.flows.find(f=>f.wf===c.wf)||{}).steps?((ApprovalEngine.currentStep(ApprovalEngine.flows.find(f=>f.wf===c.wf))||{}).label||"Complete"):"—"}));
  DATA.changes.filter(match.tc).forEach(c=>out.push({kind:"Technical change",wf:c.wf,subject:`${c.type} on ${c.part}`,status:c.status,stage:c.stage||"—"}));
  return out;
}
const stChip=s=>`<span class="chip ${({Pending:"chip-amber",Approved:"chip-green",Rejected:"chip-red",Open:"chip-blue"})[s]||"chip-gray"}"><span class="chip-dot"></span>${esc(s)}</span>`;
function decisionsTable(list){
  return list.length?U.table(["Type","Reference","Subject","Stage","Status"],list.slice(0,6).map(d=>`<tr class="v8-row" data-act="go:approvals" role="button" tabindex="0"><td><b>${esc(d.kind)}</b></td><td>${Components.wfChip(d.wf)}</td><td>${esc(d.subject)}</td><td>${esc(d.stage)}</td><td>${stChip(d.status)}</td></tr>`).join(""))+(list.length>6?`<div class="mut small" style="margin-top:6px">+${list.length-6} more</div>`:""):empty("No commercial decision is linked to this selection.");
}
function notesPanel(p){
  const vs=versionsOf(p.id), dp=dpOf(p.id), items=[];
  vs.slice().reverse().slice(0,4).forEach((v,i,a)=>items.push(`${fmtDate(v.effectiveFrom)} — ${esc(v.source)}${v.changeReq?" ("+esc(v.changeReq)+")":""}: ${inr(v.price)}`));
  if(dp) items.push(`Part master last updated ${esc(fmtDate(dp.lastUpdated))} — data status <b>${esc(dp.status)}</b>.`);
  if(DATA.cbds[p.id]) items.push(`Cost breakdown last updated ${esc(fmtDate(DATA.cbds[p.id].lastUpdated))}.`);
  return U.panel(ptitle("Notes & remarks","Recorded sources only: price-version sources, the part master and the cost breakdown. Nothing is added here."),items.length?`<ul class="pd-notes">${items.map(x=>`<li>${x}</li>`).join("")}</ul>`:empty("No notes are recorded for this part."));
}
function buildPart(){
  const {p,missing}=pickPart(), pg=progOf(p.progCode), tgt=targetOf(p.id), cpv=lineCost(p), annual=(p.cur-p.nom)*p.qty*pg.volume;
  const parts=projectParts(p.progCode).sort((a,b)=>lineCost(b)-lineCost(a));
  if(CTX.vert&&p.category!==CTX.vert) CTX.vert="";      // a part opened from elsewhere wins over the vertical / supplier filters
  if(CTX.sup&&p.vendorName!==CTX.sup) CTX.sup="";
  const byCost=(a,b)=>lineCost(b)-lineCost(a), scope=(code,v,s)=>projectParts(code).filter(x=>(!v||x.category===v)&&(!s||x.vendorName===s)).sort(byCost), top=(code,v,s)=>{ const l=scope(code,v,s); return l[0]?l[0].id:null; };
  const pick=scope(p.progCode,CTX.vert,CTX.sup);
  const vertOpts=P.CATS.map(c=>c.name).filter(n=>scope(p.progCode,"",CTX.sup).some(x=>x.category===n)), supOpts=[...new Set(scope(p.progCode,CTX.vert,"").map(x=>x.vendorName))].sort();   // each list only offers values that still have parts
  const dup={}; pick.forEach(x=>{ dup[x.name]=(dup[x.name]||0)+1; }); const seen={};   // same part name more than once: number them, biggest cost first
  const partOpts=pick.map(x=>[x.id,dup[x.name]>1?`${x.name} (${(seen[x.name]=(seen[x.name]||0)+1)})`:x.name]);
  const w=frame("Part Details",
    projSel()+sel("vert","Vertical",[["","All verticals"]].concat(vertOpts.map(n=>[n,n])),CTX.vert,"layers")+sel("sup","Supplier",[["","All suppliers"]].concat(supOpts.map(n=>[n,n])),CTX.sup,"building")+sel("part","Part",partOpts,p.id,"wrench")+`<button type="button" class="pd-reset" data-pf-reset="1" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`,
    (k,v)=>{ const pj=PX.PF.project; let id;
      if(k==="project"){ PX.PF.project=v; id=top(v,CTX.vert,CTX.sup); if(!id){ CTX.vert=CTX.sup=""; id=top(v,"",""); } CTX.part=id; }
      else if(k==="vert"){ CTX.vert=v; id=top(pj,v,CTX.sup); if(!id){ CTX.sup=""; id=top(pj,v,""); } CTX.part=id; }
      else if(k==="sup"){ CTX.sup=v; id=top(pj,CTX.vert,v); if(!id){ CTX.vert=""; id=top(pj,"",v); } CTX.part=id; }
      else if(k==="part") CTX.part=v;
      else { PX.PF.project=PX.DEFAULT; CTX.part=null; CTX.vert=CTX.sup=""; }
      Router.render(); });
  if(missing) add(w,U.note("The selected part was not found — showing the part with the highest cost per vehicle in "+esc(p.progName)+".","warn"));
  add(w,partHeader(p,tgt));
  kpis(w,[
    kcard({icon:"coins",label:"Nomination price",value:inr(p.nom,0),sub:esc(P.monthLabel(P.MONTHS[0]))+" · piece price"}),
    kcard({icon:"trend-up",label:"Current price",value:inr(p.cur,0),chip:`<b class="${tone(pct(p.cur,p.nom))}">${pct(p.cur,p.nom)>=0?"▲":"▼"} ${Math.abs(pct(p.cur,p.nom)).toFixed(1)}%</b>`,chipTip:"Change since nomination",sub:esc(P.monthLabel(P.MONTHS[NH-1]))+" · since nomination"}),
    kcard({icon:"target",label:"Target price",value:tgt?inr(tgt,0):"—",tone:tgt&&p.cur>tgt?"bad":"",sub:tgt?`${sgn(pct(p.cur,tgt))} vs target`:"no cost target recorded"}),
    kcard({icon:"package",label:"Quantity per vehicle",value:String(p.qty),sub:"fitted per "+esc(short(p.progName))}),
    kcard({icon:"calculator",label:"Annual price impact",value:cr(annual),tone:tone(annual),sub:`(current − nomination) × qty × ${nf(pg.volume,0)} vehicles`,tip:"Yearly cost effect of the price change since nomination: (current − nomination price) × quantity per vehicle × the project's planned annual volume."})],5);
  row(w,"c21",[priceHistoryPanel(p,tgt),priceDetailsPanel(p)]);
  row(w,"c21r",[costBreakdownPanel(p),notesPanel(p)]);
  const dec=decisionsFor({cr:c=>c.partNumber===p.id,tc:c=>c.partNo===p.id});
  row(w,"c1",[U.panel(ptitle("Related commercial decisions","Change requests and technical changes raised against this part number."),decisionsTable(dec))]);
  w.appendChild(U.el(note("All prices in ₹ per piece unless stated. Cost per vehicle = piece price × quantity per vehicle. Illustrative data; history only — forecasts are in Forecast &amp; risk.")));
  U.wire(w); return w;
}

/* ================================================================== SUPPLIER DETAILS */
function supplierNames(code){ return [...new Set(projectParts(code).map(p=>p.vendorName))].sort(); }
function pickSupplier(){
  const names=supplierNames(PX.PF.project); let s=CTX.supplier, missing=false;
  if(s&&!P.VENDS.some(v=>v.name===s)){ missing=true; s=null; }
  if(s&&!names.includes(s)) s=null;   // no parts in this project: show the project's first supplier
  if(!s) s=names[0]; CTX.supplier=s; return {s,missing,names};
}
function seriesIdx(list){ const base=costOf(list,p=>p.qty*p.h[0])||1; return P.MONTHS.map((m,i)=>costOf(list,p=>p.qty*p.h[i])/base*100); }
function buildSupplier(){
  const {s,missing}=pickSupplier(), code=PX.PF.project, pg=progOf(code), all=projectParts(code), sm=DATA.suppliers.find(x=>x.name===s), vend=P.VENDS.find(v=>v.name===s);
  const byCost=(a,b)=>lineCost(b)-lineCost(a), sAll=all.filter(p=>p.vendorName===s);
  if(CTX.svert&&!sAll.some(p=>p.category===CTX.svert)) CTX.svert="";      // same filters as Part Details; each list only offers values that still have parts
  const inV=p=>!CTX.svert||p.category===CTX.svert, sV=sAll.filter(inV).sort(byCost);
  if(CTX.spart&&!sV.some(p=>p.id===CTX.spart)) CTX.spart="";
  const list=sV.filter(p=>!CTX.spart||p.id===CTX.spart), allV=all.filter(inV);
  const vertOpts=P.CATS.map(c=>c.name).filter(n=>sAll.some(p=>p.category===n)), supOpts=[...new Set(allV.map(p=>p.vendorName))].sort();
  const dup={}; sV.forEach(x=>{ dup[x.name]=(dup[x.name]||0)+1; }); const seen={};
  const partOpts=sV.map(x=>[x.id,dup[x.name]>1?`${x.name} (${(seen[x.name]=(seen[x.name]||0)+1)})`:x.name]);
  const w=frame("Supplier Details",
    projSel()+sel("svert","Vertical",[["","All verticals"]].concat(vertOpts.map(n=>[n,n])),CTX.svert,"layers")+sel("supplier","Supplier",supOpts.map(n=>[n,n]),s,"building")+sel("spart","Part",[["","All parts"]].concat(partOpts),CTX.spart,"wrench")+`<button type="button" class="pd-reset" data-pf-reset="1" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`,
    (k,v)=>{ if(k==="project"){ PX.PF.project=v; CTX.spart=""; } else if(k==="svert"){ CTX.svert=v; CTX.spart=""; } else if(k==="supplier"){ CTX.supplier=v; CTX.spart=""; } else if(k==="spart") CTX.spart=v; else { PX.PF.project=PX.DEFAULT; CTX.supplier=null; CTX.svert=CTX.spart=""; } Router.render(); });
  if(missing) add(w,U.note("The selected supplier was not found — showing another supplier of this project.","warn"));
  const totCost=costOf(all,lineCost), cost=costOf(list,lineCost), nomC=costOf(list,p=>p.qty*p.nom), annual=cost*pg.volume;
  const sr=srm(), sv=sr&&sr.m.vend[s];
  const riskChip=sm?`<span class="chip ${({High:"chip-red",Medium:"chip-amber",Low:"chip-green"})[sm.riskRating]||"chip-gray"}"><span class="chip-dot"></span>${esc(sm.riskRating)}</span>`:"—";
  row(w,"c1",[U.panel("Supplier Details",`<dl class="pd-sgrid">${[["Origin",sm?esc(sm.origin):"—"],["Location",sm?esc(sm.place)+" · plant "+esc(sm.plant):"—"],["Main commodity",sm?esc(sm.commodity):"—"],["Risk rating",riskChip],["Business share",sm?esc(sm.businessShare):"—"],["Import dependency",vend?Math.round(vend.importDep*100)+"%":"—"],["Re-price cycle",vend?"every "+vend.repriceMonths+" months":"—"],["SRM owner",sv?esc(sv.owner):"—"]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`)]);
  if(!list.length){ add(w,U.panel("No parts in this project",empty(esc(s)+" supplies no tracked part to "+esc(pg.name)+". Pick another project or supplier above."))); U.wire(w); return w; }
  const cats=[...new Set(list.map(p=>p.category))];
  kpis(w,[
    kcard({icon:"coins",label:"Spend with supplier (yearly)",value:cr(annual),sub:`${inr(cost,0)} per vehicle × ${nf(pg.volume,0)} vehicles`,tip:"Piece price × quantity per vehicle × planned annual volume of the project, over this supplier's tracked parts."}),
    kcard({icon:"pie",label:"Share of project spend",value:(cost/totCost*100).toFixed(1)+"%",sub:`of ${cr(totCost)} cost per vehicle`}),
    kcard({icon:"package",label:"Parts supplied",value:String(list.length),sub:`across ${cats.length} verticals`}),
    kcard({icon:"clock",label:"On-time delivery",value:sv?sv.delivery+"%":"—",sub:sv?"last 6 months · prototype score":"not available"}),
    kcard({icon:"shield",label:"Quality",value:sv?sv.quality+"%":"—",sub:sv?"last 6 months · prototype score":"not available"})],5);
  /* spend by vertical */
  const byCat={}; list.forEach(p=>{ (byCat[p.category]=byCat[p.category]||[]).push(p); });
  const catRows=Object.keys(byCat).map(k=>({k,c:costOf(byCat[k],lineCost),n:byCat[k].length})).sort((a,b)=>b.c-a.c), pal=["#0a6a4e","#1f7f5f","#2f8f6e","#4aa584","#6bb99b","#8fcdb3","#aadbc6","#c3e5d4","#9db7ad","#c9d3cf"];
  const slices=catRows.map((r,i)=>({label:r.k,value:r.c,color:pal[i%pal.length]}));
  const donut=C.donut(slices,{size:200,center:cr(annual),centerSub:"yearly spend",aria:"Spend by vertical"}).replace(/<ul class="pc-dl">[\s\S]*?<\/ul>/,"");
  const catPanel=U.panel(ptitle("Spend by component category","This supplier's cost per vehicle by vertical in the selected project."),`<div class="pd-catv"><div class="dn">${donut}</div><div class="lg">${catRows.map((r,i)=>`<div class="o"><i style="background:${pal[i%pal.length]}"></i><span title="${esc(r.k)} · ${r.n} part${r.n===1?"":"s"}">${esc(r.k)}</span><b>${(r.c/cost*100).toFixed(0)}%</b></div>`).join("")}</div></div>`);
  /* parts supplied (filterable, paginated) */
  const prows=list.sort((a,b)=>lineCost(b)-lineCost(a)).map(p=>({p}));
  const ft=FTable.create({id:"sup-parts",pageSize:10,rowAct:r=>"ppart:"+r.p.id,empty:"No part matches these filters.",rows:prows,columns:[
    {key:"part",label:"Part",get:r=>r.p.name,html:r=>`<span class="pd-pname">${V8Art.part(r.p.name,r.p.category,"sm")}<span><b>${esc(r.p.name)}</b><small class="v8-sm">${esc(r.p.id)}</small></span></span>`},
    {key:"vertical",label:"Vertical",get:r=>r.p.category},
    {key:"qty",label:"Qty / vehicle",get:r=>r.p.qty,align:"r",order:r=>r.p.qty},
    {key:"price",label:"Current price (₹)",get:r=>nf(r.p.cur,0),align:"r",order:r=>r.p.cur},
    {key:"var",label:"Variance vs nomination",get:r=>pct(r.p.cur,r.p.nom)>0?"Price up":pct(r.p.cur,r.p.nom)<0?"Price down":"Unchanged",html:r=>chip(pct(r.p.cur,r.p.nom))},
    {key:"cpv",label:"Cost / vehicle (₹)",get:r=>nf(lineCost(r.p),0),align:"r",order:r=>lineCost(r.p)},
    {key:"share",label:"Share of supplier cost",get:r=>(lineCost(r.p)/cost*100).toFixed(1)+"%",align:"r",order:r=>lineCost(r.p)}]});
  const partsHtml=U.panel(ptitle("Parts supplied to "+esc(short(pg.name)),"Every tracked part this supplier delivers to the selected project. Click a row for the part."),"");
  /* price performance */
  const ids=seriesIdx(list), idsAll=seriesIdx(allV), lab=P.MONTHS.map(U.ml);
  const perf=U.panel(ptitle("Price performance over time","Cost per vehicle of this supplier's parts against all suppliers of the project, indexed to 100 at nomination. History only."),C.line({labels:lab,height:250,mLeft:50,maxX:8,yFmt:v=>v.toFixed(0),aria:"Price performance",tip:true,series:[{name:short(s),data:ids,color:C.C.brand,width:2.6},{name:"All suppliers of "+short(pg.name),data:idsAll,color:C.C.faint,dash:"5 4",width:1.8}]})+`<div class="pd-tag">Now <b>${ids[NH-1].toFixed(1)}</b> vs <b>${idsAll[NH-1].toFixed(1)}</b> for all suppliers (nomination = 100)</div>`);
  const ids2=new Set(list.map(p=>p.id)), dec=decisionsFor({cr:c=>c.supplier===s||ids2.has(c.partNumber),tc:c=>c.supplier===s||ids2.has(c.partNo)});
  row(w,"c12",[catPanel,perf]);
  const g2=row(w,"c1",[partsHtml]); g2.children[0].querySelector(".panel-body").appendChild(ft);
  row(w,"c1",[U.panel(ptitle("Related commercial decisions","Change requests and technical changes for this supplier or its parts."),decisionsTable(dec))]);
  w.appendChild(U.el(note("Spend and shares are computed from the tracked parts of the selected project. Delivery and quality scores are the prototype's SRM scores, generated for this prototype. Illustrative data; history only.")));
  U.wire(w); return w;
}

/* ================================================================== PRICE ANALYSIS */
function paScope(){ const f=CTX.price; return projectParts(PX.PF.project).filter(p=>(!f.category||p.category===f.category)&&(!f.supplier||p.vendorName===f.supplier)); }
function paRows(list,keyf){ const by={}; list.forEach(p=>{ (by[keyf(p)]=by[keyf(p)]||[]).push(p); });
  return Object.keys(by).map(k=>{ const l=by[k], cur=costOf(l,lineCost), nom=costOf(l,p=>p.qty*p.nom); return {k,n:l.length,cur,nom,chg:pct(cur,nom),imp:cur-nom,list:l}; }); }
/* charts that redraw at their panel's width (and re-flow when the window is resized) instead of scaling a fixed drawing */
function fluid(reg,make){ reg.push(make); return `<div class="pd-fluid" data-fl="${reg.length-1}">${make(720)}</div>`; }
function wireFluid(w,reg){ w.querySelectorAll("[data-fl]").forEach(el=>{ const make=reg[+el.dataset.fl]; let last=0;
  new ResizeObserver(()=>{ const cw=Math.round(el.clientWidth); if(cw<80||Math.abs(cw-last)<4) return; last=cw; el.innerHTML=make(Math.max(280,cw)); }).observe(el); }); }
/* Version history: compact table, newest first, prices only; the expand button opens the full table in a pop-up */
const EXPAND_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
function versionTable(vers){
  return `<div class="vh"><div class="vh-h"><span>Version</span><span>Price (₹)</span><span>Change</span><span>Event</span><span class="ra">Date</span></div><div class="vh-b">${vers.map((v,i)=>({v,i})).reverse().map(({v,i})=>{
    const prev=i?vers[i-1]:null, d=prev?v.price-prev.price:0;
    const chg=!prev?`<span class="vh-nil">—</span>`:`<span class="vh-c ${d>0?"bad":d<0?"good":""}"><b>${d>0?"▲":d<0?"▼":""} ${d>=0?"+":"−"}${inr(Math.abs(d))}</b></span>`;
    return `<div class="vh-r"><span class="vh-n"><i>${i+1}</i></span><span class="vh-p">${inr(v.price)}</span><span class="vh-x">${chg}</span><span class="vh-e">${esc(v.source)}</span><span class="vh-d">${esc(fmtDate(v.effectiveFrom))}</span></div>`; }).join("")}</div></div>`;
}
function openVersionModal(id){
  const pt=P.part(id), vers=pt?versionsOf(id):[]; if(!vers.length) return;
  const first=vers[0], lastV=vers[vers.length-1], tot=lastV.price-first.price, sg=d=>(d>=0?"+":"−")+inr(Math.abs(d)), col=v=>v>0?"bad":v<0?"good":"";
  const bk=document.createElement("div"); bk.className="fc-modal-bk"; document.body.appendChild(bk);
  const close=()=>{ bk.remove(); document.removeEventListener("keydown",esck); }, esck=e=>{ if(e.key==="Escape") close(); };
  document.addEventListener("keydown",esck); bk.onclick=e=>{ if(e.target===bk) close(); };
  const tg=vers.every(v=>v.target&&v.target===vers[0].target)?vers[0].target:null;
  const rows=vers.map((v,i)=>({v,i})).reverse().map(({v,i})=>{ const prev=i?vers[i-1]:null, d=prev?v.price-prev.price:0, dp=prev?pct(v.price,prev.price):0, gp=v.target?pct(v.price,v.target):null;
    return `<tr><td class="c"><i class="vm-n">${i+1}</i></td><td><b>${esc(v.source)}</b><small>${esc(fmtDate(v.effectiveFrom))}</small></td><td class="r"><b>${inr(v.price)}</b></td>`+
      `<td class="r">${prev?`<b class="${col(d)}">${d>0?"▲":d<0?"▼":""} ${sg(d)}</b><small>${sgn(dp)}</small>`:`<span class="m">—</span>`}</td>`+
      `<td class="r">${gp==null?`<span class="m">—</span>`:`<span class="vm-pill ${col(gp)}">${sgn(gp)}</span><small>${sg(v.price-v.target)}</small>`}</td>`+
      `<td>${v.changeReq?`<span class="vm-cr">${esc(v.changeReq)}</span>`:`<span class="m">—</span>`}</td></tr>`; }).join("");
  const kp=(l,v,s,c)=>`<div class="vm-k"><span>${l}</span><b class="${c||""}">${v}</b>${s?`<em>${s}</em>`:""}</div>`;
  bk.innerHTML=`<div class="fc-modal vm" role="dialog" aria-modal="true" aria-label="Version history"><div class="fm-h"><h2>Version history <span class="count-pill">${vers.length}</span></h2><button class="drawer-close" data-c="1" aria-label="Close">✕</button></div>`+
    `<p class="vm-s">${esc(pt.name)} · ${esc(pt.id)}</p>`+
    `<div class="vm-ks">${kp("At nomination",inr(first.price),fmtDate(first.effectiveFrom))}${kp("Today",inr(lastV.price),fmtDate(lastV.effectiveFrom))}${kp("Net change",sg(tot),sgn(pct(lastV.price,first.price)),col(tot))}${tg?kp("Target price",inr(tg),"same for every version"):""}</div>`+
    `<div class="vm-w"><table class="vm-t"><thead><tr><th class="c">Version</th><th>Event</th><th class="r">Price (₹)</th><th class="r">Change</th><th class="r">vs Target</th><th>Change request</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  bk.querySelector("[data-c]").onclick=close;
}
/* donut with a hover tooltip on every segment: items [{value,color,tip}] (tip = chart-tooltip payload) */
function tipRing(items,S,center,sub,centerTip){
  const r=S/2-20, c=S/2, tot=items.reduce((a,i)=>a+i.value,0)||1, on=items.filter(i=>i.value>0), gap=on.length>1?.022:0; let a=-Math.PI/2, g="";
  on.forEach(it=>{ const sw=it.value/tot*Math.PI*2, a0=a+gap/2, a1=Math.min(a+sw-gap/2,a0+Math.PI*2-.0001), pt=t=>[(c+r*Math.cos(t)).toFixed(2),(c+r*Math.sin(t)).toFixed(2)], [x0,y0]=pt(a0), [x1,y1]=pt(a1);
    g+=`<path class="pdd-seg" d="M${x0} ${y0}A${r} ${r} 0 ${a1-a0>Math.PI?1:0} 1 ${x1} ${y1}" fill="none" stroke="${it.color}" stroke-width="26" data-tip="${esc(JSON.stringify(it.tip))}"/>`; a+=sw; });
  return `<svg class="pdd-ring" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(sub)}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line2)" stroke-width="26" opacity=".6"/>${g}<circle cx="${c}" cy="${c}" r="${r-18}" fill="transparent"${centerTip?` data-tip="${esc(JSON.stringify(centerTip))}"`:""}/><text x="${c}" y="${c+2}" text-anchor="middle" class="pdd-ct">${esc(center)}</text><text x="${c}" y="${c+18}" text-anchor="middle" class="pdd-cs">${esc(sub)}</text></svg>`;
}
function buildPrice(){
  const f=CTX.price, code=PX.PF.project, pg=progOf(code), pp=projectParts(code), list=paScope(), fl=[];
  const w=frame("Price Analysis",
    projSel()+sel("category","Vertical",[["","All verticals"]].concat(P.CATS.map(c=>[c.name,c.name])),f.category,"layers")+sel("supplier","Supplier",[["","All suppliers"]].concat(supplierNames(code).map(n=>[n,n])),f.supplier,"building")+`<button type="button" class="pd-reset" data-pf-reset="1" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`,
    (k,v)=>{ if(k==="project"){ PX.PF.project=v; f.supplier=""; f.part=""; } else if(k==="category"){ f.category=v; f.part=""; } else if(k==="supplier"){ f.supplier=v; f.part=""; } else { PX.PF.project=PX.DEFAULT; f.category=f.supplier=f.part=""; } Router.render(); });
  if(!list.length){ add(w,U.panel("No parts",empty("No tracked part matches these filters."))); U.wire(w); return w; }
  const cur=costOf(list,lineCost), nom=costOf(list,p=>p.qty*p.nom), chg=pct(cur,nom), imp=cur-nom, vol=pg.volume;
  const up=list.filter(p=>p.cur>p.nom*1.0005).length, down=list.filter(p=>p.cur<p.nom*0.9995).length;
  const priced=PX.pricedParts(list).filter(r=>r.target), above=priced.filter(r=>r.price>r.target);
  kpis(w,[
    kcard({wrap:1,icon:"trend-up",label:"Price variance vs nomination",value:sgn(chg),tone:tone(chg),sub:`${cr(nom)} → ${cr(cur)} per vehicle`,tip:"Change in cost per vehicle against the nominated prices (July 2023 stands in for nomination)."}),
    kcard({icon:"alert",label:"Parts with price increases",value:String(up),tone:up?"bad":"",sub:`of ${list.length} tracked parts`}),
    kcard({icon:"check-circle",label:"Parts with price decreases",value:String(down),tone:down?"good":"",sub:`of ${list.length} tracked parts`}),
    kcard({icon:"calculator",label:"Net cost impact",value:sp(imp,true),tone:tone(imp),sub:`per vehicle · ${sp(imp*vol,true)} a year`,tip:"Cost per vehicle today minus at nomination; yearly = × planned annual volume of the project."}),
    kcard({icon:"target",label:"Parts above target",value:priced.length?String(above.length):"—",tone:above.length?"bad":"",sub:priced.length?`of ${priced.length} parts with a cost target`:"no cost target in this selection"})],5);

  const ranked=list.slice().sort((a,b)=>pct(b.cur,b.nom)-pct(a.cur,a.nom)); { const tp=f.part?P.part(f.part):null; f.part=tp&&list.includes(tp)?tp.id:""; }
  /* distribution: two rings over the same price-rise bands — how many parts, and what they add to a vehicle. Details sit in the tooltips. */
  const edges=[[-1e9,0,"Price fell","below nomination","#2f9e6e"],[0,5,"Up to 5%","small rise","#9bd3b8"],[5,10,"5–10%","moderate rise","#e6d06a"],[10,15,"10–15%","noticeable rise","#e0a030"],[15,20,"15–20%","large rise","#e0742f"],[20,30,"20–30%","steep rise","#c9402f"],[30,1e9,"Over 30%","severe rise","#8f1d1d"]];
  const bins=edges.map(([lo,hi,l,d,col])=>{ const ps=list.filter(p=>{ const c=pct(p.cur,p.nom); return lo===-1e9?c<0:(c>=lo&&c<hi); }).sort((x,y)=>pct(y.cur,y.nom)-pct(x.cur,x.nom)); return {l,d,col,ps,n:ps.length,imp:ps.reduce((t,p)=>t+(p.cur-p.nom)*p.qty,0)}; });
  const chgs=list.map(p=>pct(p.cur,p.nom)).sort((x,y)=>x-y), med=chgs[list.length>>1], over20=list.filter(p=>pct(p.cur,p.nom)>=20).length, riseN=list.filter(p=>p.cur>p.nom*1.0005).length, netAll=bins.reduce((t,b)=>t+b.imp,0);
  const bandTip=b=>{ const first=b.ps[0], last=b.ps[b.ps.length-1], fell=b.l==="Price fell", ex=fell?last:first;
    return {t:`${b.l} · ${b.d}`,r:b.n?[{n:"Parts",v:`${b.n} of ${list.length} (${Math.round(b.n/list.length*100)}%)`,c:b.col},{n:fell?"Takes off each vehicle":"Adds to each vehicle",v:sp(b.imp,true),c:b.col},{n:"Average change",v:sgn(b.ps.reduce((t,p)=>t+pct(p.cur,p.nom),0)/b.n),c:b.col},{n:fell?"Biggest fall":"Biggest rise",v:`${ex.name} ${sgn(pct(ex.cur,ex.nom))}`,c:b.col}]:[{n:"Parts",v:"none",c:b.col}],x:b.n&&!fell&&netAll>0?{k:"Share of the net increase",v:Math.round(b.imp/netAll*100)+"%",tone:"bad"}:null}; };
  const ring=tipRing(bins.map(b=>({value:b.n,color:b.col,tip:bandTip(b)})),190,String(list.length),"parts",{t:"All parts in the selection",r:[{n:"Cost more than at nomination",v:`${riseN} of ${list.length}`,c:"#c9402f"},{n:"Median change",v:sgn(med),c:"#0a6a4e"},{n:"Up 20% or more",v:`${over20} part${over20===1?"":"s"}`,c:"#8f1d1d"},{n:"Net change per vehicle",v:sp(netAll,true),c:"#c9402f"}],x:{k:"Per year",v:sp(netAll*vol,true),tone:netAll>0?"bad":"good"}});
  const dist=U.panel(ptitle("Price variance distribution","Share of the tracked parts by how far today's piece price is from its nomination price. Hover a segment or a band for the part count, what it adds to the cost of one vehicle, and the biggest rise in it."),
    `<div class="pdd"><div class="pdd-d">${ring}</div><ul class="pdd-lg"><li class="h"><span>Rise vs nomination</span><span>Parts</span><span>Share</span></li>${bins.map(b=>`<li data-tip="${esc(JSON.stringify(bandTip(b)))}"><i style="background:${b.col}"></i><b>${esc(b.l)}</b><em class="n">${b.n}</em><em>${list.length?Math.round(b.n/list.length*100):0}%</em></li>`).join("")}</ul></div>`);
  /* price variance by vertical / by supplier: one panel, two tabs */
  const vrAll=paRows(list,p=>p.category).sort((a,b)=>b.imp-a.imp), srAll=paRows(list,p=>p.vendorName).sort((a,b)=>b.imp-a.imp);
  const vxRows=(rows,total,what,icon,act)=>{ const mxv=Math.max(1,...rows.map(r=>Math.abs(r.imp)));
    return `<div class="vx"><div class="vx-h"><span>${what[0].toUpperCase()+what.slice(1)}</span><span></span><span class="ra">Change</span><span class="ra">₹ / vehicle</span></div>${rows.map(r=>{ const ic=icon(r.k);
      return `<div class="vx-r"${act?` data-act="${act(r)}" role="button" tabindex="0"`:""} title="${esc(r.k)} · ${r.n} part${r.n===1?"":"s"}"><span class="vx-i" style="--c:${ic[0]};--b:${ic[1]}">${ic[2]}</span><span class="vx-n">${esc(r.k)}</span><span class="vx-b"><i class="${r.imp<0?"neg":""}" style="width:${Math.max(3,Math.abs(r.imp)/mxv*100).toFixed(1)}%"></i></span><span class="vx-c ${tone(r.chg)}">${r.chg>0?"▲":r.chg<0?"▼":""} ${sgn(r.chg)}</span><span class="vx-v">${sp(r.imp,true)}</span></div>`; }).join("")}</div>`; };
  const ico=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const VIC={"Powertrain":["#c0392b","#fdecea",ico('<path d="M5 9h3l1-2h6l1 2h2v6h-2l-1 2H9l-1-2H5z"/><path d="M2 11v3M22 11v3"/>')],
    "Chassis":["#1f2d2a","#e6ecea",ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3.5 8l6 3M14.5 13l6 3M20.5 8l-6 3M9.5 13l-6 3"/>')],
    "Lighting":["#d98e04","#fff5dc",ico('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z"/>')],
    "Body Stampings":["#2b5fa8","#e8f0fb",ico('<path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>')],
    "Braking":["#1a7a4a","#e3f4ea",ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2"/>')],
    "Electrical":["#5b3aa8","#efe9fb",ico('<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>')],
    "Interior Trim":["#8a4f2a","#f8ece4",ico('<path d="M9 3h3a2 2 0 0 1 2 2l1 8H8L7 5a2 2 0 0 1 2-2z"/><path d="M8 13l-1 5h11v-3l-3-2M7 21h12"/>')],
    "HVAC":["#2b6fc4","#e6f0fc",ico('<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4-1 2-3 3-6 3zM14 12c4 0 7 1 7 4 0 2-2 3-4 2-2-1-3-3-3-6zM12 14c0 4-1 7-4 7-2 0-3-2-2-4 1-2 3-3 6-3zM10 12c-4 0-7-1-7-4 0-2 2-3 4-2 2 1 3 3 3 6z"/>')],
    "Fasteners":["#5f6b68","#eceff0",ico('<path d="M7 3h10l1 4H6zM9 7v14h6V7M9 11h6M9 15h6"/>')],
    "Sensors":["#0e8a8a","#e0f3f3",ico('<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>')]};
  const vIcon=k=>VIC[k]||["#5f6b68","#eceff0",ico('<rect x="4" y="4" width="16" height="16" rx="3"/>')], sIcon=()=>["var(--brand)","var(--brand-soft)",Icons.svg("building")];
  if(f.vtab!=="supplier") f.vtab="category";
  const tabBtn=(id,l)=>`<button type="button" role="tab" class="fc-seg ${f.vtab===id?"on":""}" data-pvt="${id}" aria-selected="${f.vtab===id}">${l}</button>`;
  const byVS=U.panel(ptitle("Price variance","Change in cost per vehicle since nomination, and what it adds to one vehicle. Click a supplier to open it."),
    `<div class="vx-tab" data-vxp="category"${f.vtab==="category"?"":" hidden"}>${vxRows(vrAll,vrAll.length,"vertical",vIcon,null)}</div><div class="vx-tab" data-vxp="supplier"${f.vtab==="supplier"?"":" hidden"}>${vxRows(srAll,srAll.length,"supplier",sIcon,r=>"psup:"+r.k)}</div>`,
    {sub:"Change in cost per vehicle since nomination",right:`<div class="fc-segs tight vx-tabs" role="tablist" aria-label="Price variance by">${tabBtn("category","By vertical")}${tabBtn("supplier","By supplier")}</div>`});
  const vrow=row(w,"c11",[dist,byVS]);
  vrow.querySelectorAll(".vx-tab").forEach(t=>{ paginate(t,".vx-r",5,t.querySelector(".vx")); });
  /* Recorded price history — What drove the price + Version history (as on Cost & price › Price History), under the variance panels. They exist for parts that have recorded price versions,
     so the part comes from the part the page was opened for when that part has versions, otherwise from this selector. */
  const partsV=list.filter(p=>versionsOf(p.id).length).sort((a,b)=>pct(b.cur,b.nom)-pct(a.cur,a.nom)), K=window.__priceKit;
  const tpF=f.part?P.part(f.part):null; let vp=tpF&&partsV.includes(tpF)?tpF:(f.vpart&&partsV.find(p=>p.id===f.vpart))||partsV[0]||null; f.vpart=vp?vp.id:"";
  if(vp&&K){
    const vers=versionsOf(vp.id), st=K.stats(vers), latest=st.last, scopeV=`${vp.name} · ${vp.id}`;
    add(w,`<div class="pd-vhead"><span class="cap">Recorded price history</span><label class="pd-sel">${Icons.svg("wrench")}<select data-pa="vpart" aria-label="Part with recorded price versions">${partsV.map(p=>`<option value="${esc(p.id)}"${p.id===vp.id?" selected":""}>${esc(p.name)} · ${esc(p.id)} (${sgn(pct(p.cur,p.nom))})</option>`).join("")}</select></label></div>`);
    row(w,"c11",[U.panel("What drove the price",fluid(fl,cw=>K.walk(st,{width:cw,ends:true,tip:true,height:Math.round(Math.min(290,Math.max(240,cw*.4)))})),{sub:scopeV}),
      U.panel(`Version history <span class="count-pill">${vers.length}</span>`,versionTable(vers),{sub:scopeV,cls:"vh-panel",right:`<button type="button" class="btn btn-sm vh-more" data-act="vhmore:${esc(vp.id)}" title="View full version table" aria-label="View full version table">${EXPAND_SVG}</button>`})]);
  } else row(w,"c1",[U.panel(ptitle("What drove the price · Version history","Shown for parts that have recorded price versions, as on Cost & price › Price History."),empty("No part in this selection has recorded price versions. Change the vertical or supplier filter to see one."))]);
  /* top increases */
  const top=ranked.slice(0,20);
  const tbl=U.panel(ptitle("Parts with highest price increases","Largest percentage rise against the nomination price. Impact = (current − nomination) × quantity per vehicle. Click a row for the part."),`<div class="pd-tscroll"><div class="pd-t pd-pa"><div class="h"><span>#</span><span>Part</span><span>Vertical</span><span class="ra">Nomination (₹)</span><span class="ra">Current (₹)</span><span class="ra">Change</span><span class="ra">Impact (₹ / veh.)</span></div>${top.map((p,i)=>`<div class="r" data-act="ppart:${esc(p.id)}" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n hasth">${V8Art.part(p.name,p.category,"sm")}<span class="nt"><b>${esc(p.name)}</b><small>${esc(p.id)}</small></span></span><span class="s">${esc(p.category)}</span><span class="v">${nf(p.nom,0)}</span><span class="v">${nf(p.cur,0)}</span><span class="v ${tone(pct(p.cur,p.nom))}">${sgn(pct(p.cur,p.nom))}</span><span class="v">${sp((p.cur-p.nom)*p.qty,true)}</span></div>`).join("")}</div></div>`);
  const tr=row(w,"c1",[tbl]); paginate(tr.children[0],".pd-pa > .r",5);
  w.appendChild(U.el(note("Comparison basis: today's piece price against the nomination price (July 2023 stands in for it), × quantity per vehicle. Units: ₹ per piece or ₹ per vehicle as labelled. Illustrative data; history only — forecast scenarios are in Forecast &amp; risk.")));
  w.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-pvt]"); if(!b||!w.contains(b)) return; f.vtab=b.dataset.pvt;
    w.querySelectorAll("[data-pvt]").forEach(x=>{ const on=x===b; x.classList.toggle("on",on); x.setAttribute("aria-selected",on); }); w.querySelectorAll("[data-vxp]").forEach(x=>{ x.hidden=x.dataset.vxp!==f.vtab; }); });
  w.addEventListener("change",e=>{ const pa=e.target.dataset&&e.target.dataset.pa; if(pa==="vpart"){ f.vpart=e.target.value; f.part=""; Router.render(); } });
  wireFluid(w,fl); U.wire(w); return w;
}

/* ------------------------------------------------------------ actions and routing */
Object.assign(U.actions,{
  ppart:v=>{ const p=P.part(v); if(!p) return; CTX.part=p.id; PX.PF.project=p.progCode; go("proc-part"); },
  psup:v=>{ CTX.supplier=v; go("proc-supplier"); },
  pprice:v=>{ const f=CTX.price; f.part=""; if(Router.screen==="proc-overview"){ f.category=PX.PF.category||""; f.supplier=PX.PF.supplier||""; } if(v){ const [k,val]=v.split("="); if(k==="part"){ f.part=val; const p=P.part(val); if(p) PX.PF.project=p.progCode; } else if(k==="category") f.category=val; else if(k==="supplier") f.supplier=val; } go("proc-price"); },
  pafilter:v=>{ const [k,val]=v.split("="); CTX.price[k]=CTX.price[k]===val?"":val; CTX.price.part=""; Router.render(); },
  vhmore:v=>openVersionModal(v),
  pdback:()=>go("proc-overview"),
});

/* ------------------------------------------------------------ menu + screens */
const SC={"proc-part":["Part Details","layers",buildPart],"proc-supplier":["Supplier Details","building",buildSupplier],"proc-price":["Price Analysis","trend-up",buildPrice]};
const at=NAV.procurement.findIndex(x=>x.id==="proc-overview");
Object.keys(SC).forEach((id,i)=>{ NAV.procurement.splice(at+1+i,0,{id,label:SC[id][0],icon:"📊"}); NAV_ICONS[id]=SC[id][1]; NAV_SHORT[id]=SC[id][0]; SCREENS.procurement[id]=SC[id][2]; });
const grp=MODULE_TREE.procurement.find(g=>g[0]==="Procurement dashboard"); if(grp) grp[1]=grp[1].concat(Object.keys(SC));
const _nl4=navLabel; navLabel=function(m,s){ return SC[s]?SC[s][0]:_nl4(m,s); };
window.V8Detail={CTX};
})();
