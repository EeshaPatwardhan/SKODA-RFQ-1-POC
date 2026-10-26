/* =====================================================================
   E7  ·  Radar — the POC's "Ask Radar" assistant, working across the whole prototype as "Ask AIS"
   Hybrid:  • offline engine (always available): the POC's tool set run in-page on the embedded data,
              extended with the prototype's own workflow data (price versions, CBDs, approvals, tasks ...)
            • optional Radar server (Admin → AI Model Settings): LLM answers + live news through the POC's
              /api/chat (NDJSON).  The API key lives only on that server — never in this page.
   ===================================================================== */
const RadarCfg = (function(){
  const K="ais-radar-cfg"; let c={url:"",mode:"auto",web:true};
  try{ const s=localStorage.getItem(K); if(s) c=Object.assign(c,JSON.parse(s)); }catch(e){}
  return { get:()=>c, set(p){ c=Object.assign(c,p); try{ localStorage.setItem(K,JSON.stringify(c)); }catch(e){} },
           server(){ return c.mode!=="offline" && /^https?:\/\//i.test(c.url||""); } };
})();

const Radar = (function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, nf=C.nf, esc=C.esc, cr=U.cr, inr=U.inr, sgn=U.sgn;
const MONTHS_LONG=["January","February","March","April","May","June","July","August","September","October","November","December"];
const mlab=P.monthLabel;
const R=(html,o)=>Object.assign({html,charts:[],actions:[],sources:[],basis:"forecasting POC · xgboost forecasts · computed in this page"},o||{});

/* ------------------------------------------------------------ markdown (for server replies) + inline helpers */
function md(t){
  const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[\s(])_([^_]+?)_(?=[\s).,;:!?]|$)/g,"$1<i>$2</i>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const L=String(t||"").split(/\r?\n/); let h="", list=null, tbl=null;
  const flush=()=>{ if(list){ h+="</"+list+">"; list=null; } if(tbl){ h+=`<table class="rd-table"><thead><tr>${tbl[0].map(c=>`<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${tbl.slice(1).map(r=>`<tr>${r.map(c=>`<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; tbl=null; } };
  for(let i=0;i<L.length;i++){
    const l=L[i];
    if(/^\s*\|.*\|\s*$/.test(l)){ if(!tbl){ flush(); tbl=[]; } if(/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue; tbl.push(l.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim())); continue; }
    if(tbl) flush();
    let m;
    if((m=l.match(/^(#{1,4})\s+(.*)/))){ flush(); h+=`<h5 class="rd-h">${inl(m[2])}</h5>`; }
    else if((m=l.match(/^\s*[-*•]\s+(.*)/))){ if(list!=="ul"){ flush(); h+="<ul>"; list="ul"; } h+=`<li>${inl(m[1])}</li>`; }
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){ if(list!=="ol"){ flush(); h+="<ol>"; list="ol"; } h+=`<li>${inl(m[1])}</li>`; }
    else if(!l.trim()){ flush(); }
    else { flush(); h+=`<p>${inl(l)}</p>`; }
  }
  flush(); return h;
}

/* ------------------------------------------------------------ chart specs (same shape the POC server returns) */
const unitFmt=s=>v=>s.unit==="pct"?sgn(v,1):s.unit==="currency"?(s.currencySymbol||"₹")+nf(v,0):nf(v,2);
function chartHtml(s){
  const f=unitFmt(s), cols=[C.C.anchor,C.C.brand,C.C.info,C.C.amber,C.C.red];
  let body="";
  if(s.kind==="line"){
    body=C.line({labels:s.points.map(p=>p.x),height:190,mLeft:56,maxX:6,yFmt:f,aria:s.title,
      series:s.series.map((se,i)=>({name:se.label,data:s.points.map(p=>p[se.key]==null?null:p[se.key]),color:cols[i%cols.length],dash:se.style==="dashed"?"5 4":null})),
      band:s.band?{lo:s.points.map(p=>p[s.band.lowerKey]==null?null:p[s.band.lowerKey]),hi:s.points.map(p=>p[s.band.upperKey]==null?null:p[s.band.upperKey]),name:s.band.label,color:C.C.brand}:null,
      split:s.splitAt});
  } else if(s.kind==="bar"){
    if(s.series.length<=1){
      const k=s.series[0].key;
      body=C.bars({signed:s.unit==="pct"||s.rows.some(r=>r.values[k]<0),fmt:f,items:s.rows.map(r=>({label:r.label,value:r.values[k],color:r.tone==="up"?C.C.red:r.tone==="down"?C.C.ok:null}))});
    } else {
      const mx=Math.max(...s.rows.flatMap(r=>s.series.map(se=>Math.abs(r.values[se.key]||0))),1e-9);
      body=`<div class="rd-gb">${s.rows.map(r=>`<div class="rd-gr"><div class="lb">${esc(r.label)}</div><div class="bs">${s.series.map((se,i)=>`<div class="b" title="${esc(se.label)}: ${esc(f(r.values[se.key]))}"><i style="width:${Math.abs(r.values[se.key]||0)/mx*100}%;background:${cols[(i+1)%cols.length]}"></i><span>${esc(f(r.values[se.key]))}</span></div>`).join("")}</div></div>`).join("")}</div><div class="pc-legend">${s.series.map((se,i)=>`<span><i style="background:${cols[(i+1)%cols.length]}"></i>${esc(se.label)}</span>`).join("")}</div>`;
    }
  } else if(s.kind==="donut"){
    body=C.donut(s.slices.map(x=>({label:x.label,value:x.value})),{aria:s.title});
  }
  return `<div class="rd-chart"><div class="rd-ct">${esc(s.title)}</div>${body}<div class="rd-cs">${esc(s.source||"")}</div></div>`;
}
const lineSpec=(title,labels,series,o)=>Object.assign({kind:"line",title,unit:"currency",currencySymbol:"₹",source:"forecasting POC",points:labels.map((x,i)=>{ const p={x}; series.forEach(se=>{ p[se.key]=se.data[i]; }); return p; }),series:series.filter(s=>!s.hidden).map(({key,label,style})=>({key,label,style:style||"solid"}))},o||{});
const barSpec=(title,rows,o)=>Object.assign({kind:"bar",title,unit:"pct",currencySymbol:"₹",source:"forecasting POC",orientation:"horizontal",series:[{key:"v",label:title}],rows:rows.map(r=>({label:r.label,values:{v:r.v},tone:r.tone}))},o||{});

/* ------------------------------------------------------------ the POC tool set, run in-page */
const Tools = {
  searchParts:(a)=>({totalMatches:P.search(a.query,{category:a.category,vendor:a.vendor,project:a.project}).length,results:P.search(a.query,{category:a.category,vendor:a.vendor,project:a.project}).slice(0,25)}),
  getTopMovers:(a)=>P.movers(a.direction,a.n||10,a.basis),
  getKpis:()=>P.kpis(),
  getCategoryBreakdown:()=>P.rollup("category"),
  getHierarchy:(a)=>P.rollup(a.level),
  getAlerts:()=>P.ALERTS,
  getRisk:(t)=>P.riskConcentration(t||5),
  getModelComparison:()=>({modelComparison:P.RAW.modelComparison,backtestSummary:P.RAW.backtestSummary}),
  getFxScenarios:()=>P.RAW.fxAnalysis.scenarios,
  getGeoScenarios:(a)=>P.RAW.geoAnalysis.scenarios.filter(s=>!a||!a.family||s.family===a.family),
  getGeoEventStudies:()=>P.RAW.geoAnalysis.eventStudies,
  getExposure:(d)=>P.exposure(d),
  getGeoHitlAlerts:()=>{ const a=PocHitl.alerts(); return {totalCount:a.length,pendingCount:PocHitl.pending().length,alerts:a.map(x=>({alertId:x.alertId,headline:x.headline,category:x.category,severity:x.severity,regionScope:x.regionScope,status:PocHitl.get(x.alertId)}))}; },
  confirmGeoAlert:(id)=>{ PocHitl.set(id,"confirmed"); return PocHitl.alerts().find(a=>a.alertId===id); },
  dismissGeoAlert:(id)=>{ PocHitl.set(id,"dismissed"); return {ok:true}; },
};

/* ------------------------------------------------------------ entity matching */
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
function matchVendor(q){ const n=" "+norm(q)+" "; return P.VENDS.find(v=>{ const vn=norm(v.name); if(n.includes(" "+vn+" ")) return true; const first=vn.split(" ")[0]; return first.length>3 && !["india","indian","group"].includes(first) && n.includes(" "+first+" "); }); }
function matchProg(q){ const n=" "+norm(q)+" "; return P.PROGS.find(p=>n.includes(" "+norm(p.name)+" ")||n.includes(" "+p.code.toLowerCase()+" ")||n.includes(" "+norm(p.name).split(" ").pop()+" ")); }
function matchCat(q){ const n=" "+norm(q)+" "; return P.CATS.find(c=>n.includes(" "+norm(c.name)+" ")||n.includes(" "+norm(c.name).replace(/s$/,"")+" ")); }
function matchParts(q){
  const m=String(q).match(/\b[A-Z]{3}-[A-Z]{3}-\d{5}\b/i); if(m){ const p=P.part(m[0]); return p?[p]:[]; }
  const n=norm(q);
  const names=[...new Set(P.PARTS.map(p=>p.name))].sort((a,b)=>b.length-a.length);
  const nm=names.find(x=>n.includes(norm(x)));
  if(!nm) return [];
  let c=P.PARTS.filter(p=>p.name===nm);
  const pr=matchProg(q), vd=matchVendor(q); if(pr){ const f=c.filter(p=>p.prog===pr); if(f.length) c=f; } if(vd){ const f=c.filter(p=>p.vendor===vd); if(f.length) c=f; }
  return c;
}
const heroByOld={"bracket":"bracket","bumper":"bumper","seat frame":"seat","wire harness":"harness"};

/* ------------------------------------------------------------ answers */
function partTable(list,o){
  o=o||{};
  return `<table class="rd-table"><thead><tr><th>Part</th><th>Vendor</th><th class="r">Now</th><th class="r">${o.h1?"Next mo.":"Forecast"}</th><th class="r">Move</th></tr></thead><tbody>${list.map(p=>`<tr><td><a href="#" data-rd="part:${esc(p.id)}">${esc(p.name)}</a><small>${esc(p.progCode)} · ${esc(p.id)}</small></td><td>${esc(p.vendorName)}</td><td class="r">${inr(p.cur)}</td><td class="r">${inr(o.h1?p.fc1:p.fcEnd)}</td><td class="r">${U.dirChip(o.h1?p.chg1:p.chgH)}</td></tr>`).join("")}</tbody></table>`;
}
function ansPart(p,ctx){
  ctx.lastPart=p;
  const lbl=P.MONTHS.map(U.ml).concat(P.FM.map(U.ml));
  const w=P.costWalk([p]), n2s=w.n2s, s2f=w.s2f;
  const b=[];
  b.push(`**${esc(p.name)}** (${esc(p.id)} · ${esc(p.progName)} · ${esc(p.vendorName)}): ${inr(p.cur,2)} in ${mlab(P.MONTHS[P.NH-1])}, forecast **${inr(p.fcEnd,2)}** by ${mlab(P.FM[P.NF-1])} (**${sgn(p.chgH)}**, model interval ${inr(p.loEnd)}–${inr(p.hiEnd)}).`);
  b.push(`Next month ${sgn(p.chg1)} → ${inr(p.fc1,2)}; since nomination (${mlab(P.MONTHS[0])}) ${sgn(p.chgHist)}.`);
  const dr=[]; if(Math.abs(n2s.fx)>0.5) dr.push(`currency ${n2s.fx>=0?"+":"−"}${inr(Math.abs(n2s.fx),1)}`); if(Math.abs(n2s.vendorReprice)>0.5) dr.push(`vendor re-price ${n2s.vendorReprice>=0?"+":"−"}${inr(Math.abs(n2s.vendorReprice),1)}`);
  if(dr.length) b.push(`Since nomination the price moved ${inr(p.cur-p.nom,2)}: ${dr.join(", ")}. ${p.vendor.origin==="international"?"The vendor is international ("+Math.round(p.vendor.importDep*100)+"% import dependency), so currency and freight matter more.":"The vendor is domestic ("+Math.round(p.vendor.importDep*100)+"% import dependency)."} It re-prices about every ${p.vendor.repriceMonths} months.`);
  if(p.reason) b.push(`Why (model reasons): ${esc(p.reason.summary)} Confidence **${p.conf.level}** — ${esc(p.reason.tip)}`);
  const mc=P.marketContext(p); b.push(`Market context (qualitative, not model inputs): ${esc(mc.specific[0])}`+(p.anomaly?` The POC flags this part as a structural-break case (${esc(p.anomaly.replace(/_/g," "))}).`:""));
  // prototype workflow facts
  const f=[]; const vers=DATA.priceVersions[p.id], cbd=DATA.cbds[p.id], inv=DATA.investments[p.id], ekl=DATA.eklTargets.find(e=>e.part===p.name&&e.project===p.progCode);
  if(vers) f.push(`${vers.length} price versions on file, latest ${inr(vers[vers.length-1].price)} (${esc(vers[vers.length-1].source)})`);
  if(cbd){ try{ const c=window.__cbdCost(cbd); f.push(`cost breakdown ${inr(c)} (${Math.abs((c/p.cur-1)*100).toFixed(1)}% ${c>p.cur?"above":"below"} the piece price)`); }catch(e){} }
  if(ekl){ const t=Store.currentValue(ekl); f.push(`EKL target ${inr(t)} — price is ${((p.cur/t-1)*100).toFixed(1)}% vs target, forecast ${((p.fcEnd/t-1)*100).toFixed(1)}%`); }
  if(inv) f.push(`tooling ${esc(inv.status)} (${esc(inv.toolingRef)}, capex ${cr(inv.capex)})`);
  const po=DATA.ebonPOs.find(x=>x.partNumber===p.id); if(po) f.push(`PO ${esc(po.poNo)} ${esc(po.status)} at ${inr(po.price,2)}`);
  if(f.length) b.push("In your workflows: "+f.join("; ")+".");
  const acts=[{l:"Part detail & cost walk",a:"part:"+p.id}]; if(vers) acts.push({l:"Price analysis",a:"price:"+p.id}); if(cbd) acts.push({l:"Cost breakdown",a:"cbd:"+p.id});
  acts.push({l:"Similar parts",a:"ask:Compare "+p.category+" parts forecast to rise the most"});
  const spec=lineSpec("Price history & forecast — "+p.name,lbl,[
      {key:"a",label:"Actual",data:p.h.concat(new Array(P.NF).fill(null))},
      {key:"f",label:"Forecast",style:"dashed",data:new Array(P.NH-1).fill(null).concat([p.cur]).concat(p.f)},
      {key:"lo",label:"Lower",hidden:true,data:new Array(P.NH).fill(null).concat(p.lo)},
      {key:"hi",label:"Upper",hidden:true,data:new Array(P.NH).fill(null).concat(p.hi)}],
    {band:{lowerKey:"lo",upperKey:"hi",label:"Forecast interval"},splitAt:P.NH,source:"forecasting POC · part price panel"});
  return R(b.map(x=>`<p>${md1(x)}</p>`).join(""),{charts:[spec],actions:acts});
}
const md1=s=>s.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
function ansAmbiguous(list,ctx,what){
  const top=list.slice().sort((a,b)=>Math.abs(b.chgH)-Math.abs(a.chgH)).slice(0,8);
  return R(`<p>I found <b>${list.length}</b> parts matching “${esc(what)}”. Here are the ${top.length} with the largest forecast move — pick one for the full picture:</p>`+partTable(top),{actions:top.slice(0,4).map(p=>({l:p.progCode+" · "+p.vendorName.split(" ")[0],a:"ask:Tell me about "+p.id}))});
}
function ansMovers(q,ctx){
  const down=/\b(fall|falling|drop|dropping|down|decrease|decreasing|ease|easing|cheaper|lowest|reduc)/i.test(q)&&!/\b(rise|rising|up|increase|rising)\b/i.test(q);
  const both=/compare|side by side|rising and falling|rise and fall/i.test(q);
  const n=Math.min(15,Math.max(3,+(q.match(/\b(\d{1,2})\b/)||[0,10])[1]));
  const h1=/next month|this month|one month|1.month/i.test(q);
  const cat=matchCat(q), vd=matchVendor(q), pr=matchProg(q);
  const filt=p=>(!cat||p.cat===cat)&&(!vd||p.vendor===vd)&&(!pr||p.prog===pr);
  const k=h1?"chg1":"chgH", all=P.PARTS.filter(filt);
  const sort=(d)=>all.slice().sort((a,b)=>d==="up"?b[k]-a[k]:a[k]-b[k]).slice(0,both?5:n);
  const scope=[cat&&cat.name,vd&&vd.name,pr&&pr.name].filter(Boolean).join(" · ")||"all "+P.PARTS.length+" parts";
  if(both){
    const up=sort("up"), dn=sort("down");
    return R(`<p><b>Top ${up.length} rising and falling parts</b> (${esc(scope)}, ${h1?"next month":"over "+P.NF+" months"}):</p><h5 class="rd-h">Rising</h5>`+partTable(up,{h1})+`<h5 class="rd-h">Falling</h5>`+partTable(dn,{h1}),
      {charts:[barSpec("Biggest movers — "+(h1?"next month":P.NF+" months"),up.map(p=>({label:p.name+" ("+p.progCode+")",v:p[k],tone:"up"})).concat(dn.map(p=>({label:p.name+" ("+p.progCode+")",v:p[k],tone:"down"}))))]});
  }
  const list=sort(down?"down":"up");
  return R(`<p><b>${down?"Biggest forecast falls":"Biggest forecast rises"}</b> — ${esc(scope)}, ${h1?"next month":"over the "+P.NF+"-month horizon"}:</p>`+partTable(list,{h1})+`<p class="rd-m">${all.filter(p=>p[k]>5).length} of ${all.length} parts are forecast to rise more than 5%.</p>`,
    {charts:[barSpec((down?"Biggest falls":"Biggest rises")+" (%)",list.map(p=>({label:p.name+" ("+p.progCode+")",v:p[k],tone:down?"down":"up"})))],
     actions:[{l:"Open in Parts outlook",a:"filter:dir="+(down?"down":"up")},{l:"Download CSV",a:"csv:movers"}]});
}
function ansKpis(){
  const k=P.kpis(), rc=P.riskConcentration(5), up=P.rollup("category")[0], dn=P.rollup("category").slice(-1)[0];
  const band=P.forecastBand();
  return R(`<p><b>Headline:</b> the cost per vehicle of the ${P.PARTS.length} tracked parts (average car) is <b>${cr(k.basket.value)}</b> (${sgn(k.basket.change,2)} vs last month). The model expects <b>${cr(k.forecast.value)}</b> by ${esc(k.forecast.to)} (<b>${sgn(k.forecast.change,2)}</b>).</p>
   <ul><li><b>${rc.partsAtRisk}</b> parts (${nf(rc.sharePct,1)}% of spend, ${cr(rc.totalSpendAtRisk)}) are forecast to rise more than 5%.</li><li>Biggest vertical rise: <b>${esc(up.name)}</b> ${sgn(up.changePct)}; easing: <b>${esc(dn.name)}</b> ${sgn(dn.changePct)}.</li><li>Best model: ${esc(k.accuracy.model)} at ${nf(k.accuracy.mape,2)}% MAPE on the synthetic panel (see model validation for the real-data check).</li></ul>`,
    {charts:[lineSpec("Cost per vehicle forecast",band.map(b=>U.ml(b.month)),[{key:"v",label:"Forecast cost per vehicle",data:band.map(b=>b.value)},{key:"lo",label:"Lower",hidden:true,data:band.map(b=>b.lower)},{key:"hi",label:"Upper",hidden:true,data:band.map(b=>b.upper)}],{band:{lowerKey:"lo",upperKey:"hi",label:"Interval"}})],
     actions:[{l:"Forecast outlook",a:"go:fc-outlook"},{l:"Risk concentration",a:"ask:Where does the forecast risk concentrate?"}]});
}
function ansCategory(cat,q){
  const r=P.rollup("category").find(x=>x.name===cat.name), ps=P.PARTS.filter(p=>p.cat===cat);
  const top=ps.slice().sort((a,b)=>b.chgH-a.chgH).slice(0,5), mc=P.marketContext(ps[0]);
  return R(`<p><b>${esc(cat.name)}</b> (${esc(cat.material)}): ${ps.length} parts, spend ${cr(r.currentSpend)} now → ${cr(r.forecastSpend)} by ${mlab(P.FM[P.NF-1])} (<b>${sgn(r.changePct)}</b>).</p>`+partTable(top)+`<p class="rd-m">Market context: ${mc.specific.map(esc).join(" ")}</p>`,
    {charts:[barSpec("Forecast move by vendor — "+cat.name,P.rollup("vendor",ps).map(v=>({label:v.name,v:v.changePct,tone:v.changePct>0?"up":"down"})))],actions:[{l:"Open in Parts outlook",a:"filter:cat="+cat.name}]});
}
function ansVendor(v,q){
  const ps=P.PARTS.filter(p=>p.vendor===v), r=P.rollup("vendor").find(x=>x.name===v.name), rc=P.riskConcentration(5).vendor.find(x=>x.name===v.name);
  const top=ps.slice().sort((a,b)=>b.chgH-a.chgH).slice(0,5), sup=DATA.suppliers.find(s=>s.name===v.name);
  const meeting=/meet|push back|negotiat|talk/i.test(q);
  return R(`<p><b>${esc(v.name)}</b> (${v.origin}, ${Math.round(v.importDep*100)}% import dependency, re-prices about every ${v.repriceMonths} months${sup?`, risk rating <b>${esc(sup.riskRating)}</b>`:""}): ${ps.length} parts, spend ${cr(r.currentSpend)} → ${cr(r.forecastSpend)} (<b>${sgn(r.changePct)}</b>).</p>`+
    (rc?`<p>${cr(rc.spendAtRisk)} of their cost per vehicle (${rc.parts} parts, average +${rc.avgIncreasePct.toFixed(1)}%) sits above the 5% risk line — ${nf(rc.shareOfRisk,1)}% of all cost at risk.</p>`:"<p>None of their parts is forecast to rise more than 5%.</p>")+
    (meeting?`<p><b>For the meeting:</b> lead with the parts below — the largest forecast rises. ${v.origin==="international"?"Ask how currency is passed through and whether a EUR/INR clause can cap the pass-through.":"Ask for the raw-material index behind the quoted prices and the date of the next re-price."}</p>`:"")+partTable(top),
    {charts:[barSpec("Forecast move — "+v.name+" parts",top.map(p=>({label:p.name+" ("+p.progCode+")",v:p.chgH,tone:p.chgH>0?"up":"down"})))],actions:[{l:"All "+ps.length+" parts",a:"filter:vendor="+v.name}]});
}
function ansProg(g,q){
  const ps=P.PARTS.filter(p=>p.prog===g), r=P.rollup("project").find(x=>x.name===g.name), cats=P.rollup("category",ps);
  const dp=DATA.projects.find(x=>x.code===g.code), ms=DATA.milestones.filter(m=>m.project===g.code);
  return R(`<p><b>${esc(g.name)}</b> (${esc(g.segment)}, ${nf(g.volume)} units a year, ${Math.round(g.localisation*100)}% localised): ${ps.length} parts, spend ${cr(r.currentSpend)} → ${cr(r.forecastSpend)} (<b>${sgn(r.changePct)}</b>).</p>`+
    `<p>Biggest vertical pressure: <b>${esc(cats[0].name)}</b> ${sgn(cats[0].changePct)}; easing: <b>${esc(cats[cats.length-1].name)}</b> ${sgn(cats[cats.length-1].changePct)}.`+(dp?` Next facelift/SOP milestone: ${esc(dp.sop)}.`:"")+(ms.length?` Milestones on file: ${ms.map(m=>esc(m.name)+" "+esc(m.planDate)).join(", ")}.`:"")+`</p>`,
    {charts:[barSpec("Forecast move by vertical — "+g.name,cats.map(c=>({label:c.name,v:c.changePct,tone:c.changePct>0?"up":"down"})))],actions:[{l:"All "+ps.length+" parts",a:"filter:prog="+g.code}]});
}
function ansRisk(){
  const rc=P.riskConcentration(5);
  return R(`<p><b>${cr(rc.totalSpendAtRisk)}</b> of cost per vehicle (${rc.partsAtRisk} parts, ${nf(rc.sharePct,1)}% of the total) is forecast to rise more than ${rc.thresholdPct}% over ${P.NF} months. The top 4 vendors hold <b>${nf(rc.top4VendorSharePct,1)}%</b> of it.</p>`+
    `<p>By vertical, <b>${esc(rc.category[0].name)}</b> carries ${nf(rc.category[0].shareOfRisk,1)}%; by project, <b>${esc(rc.project[0].name)}</b> ${nf(rc.project[0].shareOfRisk,1)}%.</p>`,
    {charts:[barSpec("Spend at risk by vendor (₹)",rc.vendor.slice(0,8).map(v=>({label:v.name,v:v.spendAtRisk,tone:"up"})),{unit:"currency"}),barSpec("Spend at risk by vertical (₹)",rc.category.map(v=>({label:v.name,v:v.spendAtRisk,tone:"up"})),{unit:"currency"})],
     actions:[{l:"Forecast outlook",a:"go:fc-outlook"},{l:"Show the risky parts",a:"filter:dir=risk"}]});
}
function commodityNow(id){ const c=DATA.commodities.find(x=>x.id===id); if(!c) return null; const h=c.history, cur=Store.currentValue(c), prev=h.length>1?h[h.length-2].value:cur; return {c,cur,mv:prev?(cur/prev-1)*100:0}; }
function ansFx(q){
  const m=q.match(/([-+]?\d+(?:\.\d+)?)\s*%/), shock=m?Math.max(-10,Math.min(10,+m[1])):5;
  const sign=/\b(weak|depreciat|fall|drop|lower)/i.test(q)&&!m?-1:1;
  const s=m?shock:shock*sign; const im=P.impact({fxPct:s,currency:/usd/i.test(q)&&!/eur/i.test(q)?"USDINR":/eur/i.test(q)&&!/usd/i.test(q)?"EURINR":"both"});
  const e=commodityNow("C1"), fx=DATA.fx[0], eur=Store.currentValue(DATA.fx.find(f=>f.currency==="EUR")), usd=Store.currentValue(DATA.fx.find(f=>f.currency==="USD"));
  const exposed=Object.values(DATA.cbds).filter(c=>c.importContent.value>0).length;
  return R(`<p>A <b>${sgn(s,0)}</b> rupee move (positive = weaker rupee) would change the forecast cost per vehicle by <b>${im.delta>=0?"+":"−"}${cr(Math.abs(im.delta)).replace("−","")}</b> (${sgn(im.deltaPct,2)}) on the ${mlab(P.FM[P.NF-1])} forecast, per the POC's FX shock scenarios.</p>`+
    `<p>Rates in the platform today: EUR/INR <b>${nf(eur,2)}</b>, USD/INR <b>${nf(usd,2)}</b>; ${exposed} cost breakdowns carry import content that re-rolls on an approved FX change.</p>`+
    `<p class="rd-m">Caveat from the model check: positive shocks respond in the right direction but saturate, and negative shocks are not coherent — the FX effect is detectable, not cleanly attributable on this window.</p>`,
    {charts:[barSpec("Extra cost by vertical — rupee "+sgn(s,0)+" (₹)",im.categories.slice(0,8).map(c=>({label:c.name,v:c.delta,tone:c.delta>0?"up":"down"})),{unit:"currency"})],
     actions:[{l:"FX impact",a:"go:fc-fx"},{l:"Cost impact what-if",a:"go:fc-impact"},{l:"Commodity & Forex",a:"go:commodity"}]});
}
function ansCommodity(q){
  const map=[["steel",/steel/i,"C1"],["aluminium",/alumin/i,"C2"],["copper",/copper/i,"C3"],["plastics",/plastic|polymer|resin/i,null],["electronics",/electronic|chip|semicond/i,null]];
  const hit=map.find(x=>x[1].test(q)); const driver=hit?hit[0]:"steel";
  const ex=P.exposure(driver), cm=hit&&hit[2]?commodityNow(hit[2]):null, m=q.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
  const matMap={steel:"Steel",aluminium:"Aluminium",copper:"Copper"};
  const im=m&&matMap[driver]?P.impact({material:matMap[driver],commodityPct:+m[1]}):null;
  return R(`<p><b>${esc(driver[0].toUpperCase()+driver.slice(1))}</b> reaches ${ex.parts} parts across ${ex.categories.map(esc).join(", ")} (${esc(ex.note)}). Their spend is ${cr(ex.currentSpend)}, forecast ${sgn(ex.changePct)} to ${cr(ex.forecastSpend)}.</p>`+
    (cm?`<p>Platform price today: <b>₹${nf(cm.cur,2)}/kg</b> (${sgn(cm.mv)} on the last move; source: ${esc(cm.c.history[cm.c.history.length-1].source)}).</p>`:"")+
    (im?`<p>If ${esc(driver)} moved ${sgn(+m[1],0)}, the illustrative pass-through adds <b>${im.delta>=0?"+":"−"}${cr(Math.abs(im.delta)).replace("−","")}</b> to the forecast cost per vehicle (${sgn(im.deltaPct,2)}).</p>`:"")+
    `<p class="rd-m">The commodity→category mapping is an assumption shipped with the POC, and the commodity series are offline fallbacks (synthetic) — use for direction, not for hedging decisions.</p>`+partTable(ex.top),
    {charts:[barSpec("Forecast move by exposed vertical",P.rollup("category",P.PARTS.filter(p=>ex.categories.includes(p.category))).map(c=>({label:c.name,v:c.changePct,tone:c.changePct>0?"up":"down"})))],
     actions:[{l:"Commodity & Forex — market",a:"go:commodity"}]});
}
function ansGeo(q){
  const g=P.RAW.geoAnalysis, hl=Tools.getGeoHitlAlerts();
  if(/alert|pending|review|confirm|dismiss|awaiting/i.test(q)){
    const pend=PocHitl.pending();
    const cd=/\b(confirm|dismiss)\b/i.exec(q);
    if(cd){ const hit=PocHitl.alerts().find(a=>norm(q).includes(norm(a.headline).slice(0,18))||q.includes(a.alertId)); if(hit){ const st=cd[1].toLowerCase()==="confirm"?"confirmed":"dismissed"; if(PocHitl.get(hit.alertId)==="pending"){ if(!PocHitl.canAct()) return R("<p>Switching role is needed to act on alerts: only Commodity Mgr, Buyer, PM or Admin can confirm or dismiss them.</p>"); PocHitl.set(hit.alertId,st); return ansHitlResult(hit,st); } return R(`<p>That alert is already <b>${esc(PocHitl.get(hit.alertId))}</b>.</p>`); } }
    return R(`<p>There ${pend.length===1?"is":"are"} <b>${pend.length}</b> geopolitical alert${pend.length===1?"":"s"} awaiting review out of ${hl.totalCount}. Impact stays hidden until an analyst confirms — nothing is applied to forecasts automatically.</p>`+
      (pend.length?`<div class="rd-hitl">${pend.map(a=>`<div class="rd-h1"><div><b>${esc(a.headline)}</b><small>${esc(a.category)} · ${esc(a.regionScope)} · severity ${a.severity}/5 · ${a.allSourcesVerified?"all sources verified":"some sources unverified"}</small></div><div class="rd-b"><button class="btn btn-sm btn-primary" data-rd="hitl:${esc(a.alertId)}|confirmed">Confirm</button><button class="btn btn-sm" data-rd="hitl:${esc(a.alertId)}|dismissed">Dismiss</button></div></div>`).join("")}</div>`:"<p>Everything has been reviewed.</p>"),
      {actions:[{l:"Open Geo risk",a:"go:fc-geo"}]});
  }
  const ev=g.eventStudies.find(e=>norm(q).includes(norm(e.eventId.replace(/_\d+$/,"")).split(" ")[0])||(/red sea|houthi/i.test(q)&&e.eventId.includes("red_sea"))||(/ukraine/i.test(q)&&e.eventId.includes("ukraine"))||(/israel|hamas|middle east/i.test(q)&&e.eventId.includes("israel"))||(/budget|duty|tariff/i.test(q)&&e.eventId.includes("budget")));
  const fam=/freight|shipping|container/i.test(q)?"freight":/duty|tariff/i.test(q)?"duty":/gpr|geopolit|risk index/i.test(q)?"gpr":null;
  const sc=Tools.getGeoScenarios({family:fam||undefined});
  let h=`<p>Geopolitics reaches part prices through channels (freight, commodities, duty, FX) — the model never applies news directly. `;
  if(ev) h+=`Event study <b>${esc(ev.eventId.replace(/_/g," "))}</b>: ${esc(ev.narrative)}</p>`; else h+=`There are ${hl.pendingCount} alerts awaiting review.</p>`;
  if(fam==="freight"){ const up=sc.filter(s=>s.shockPct>0); h+=`<p><b>Does our forecast support a freight-driven price spike?</b> Not in this model: ${up.map(s=>esc(s.name)+" → "+sgn(s.overallPriceChangePct,2)).join(", ")} on part prices — freight shocks barely move them and the sign is not stable, so a lock-in decision should not rest on this forecast alone.</p>`; }
  if(/news|headline|latest/i.test(q)&&!RadarCfg.server()) h+=`<p class="rd-m">Live news needs the Radar server — this answer uses the POC's modelled scenarios only.</p>`;
  h+=`<p>Modelled responses (${fam||"all families"}): ${sc.slice(0,6).map(s=>`${esc(s.name)} → ${sgn(s.overallPriceChangePct,2)}`).join("; ")}.</p><p class="rd-m">Weak and sometimes counter-intuitive signs are a finding: freight, geopolitical-risk and duty signals barely move part prices in this panel.</p>`;
  return R(h,{charts:ev?[lineSpec("Price vs event month — "+ev.eventId.replace(/_/g," "),ev.path.map(p=>(p.offset>0?"+":"")+p.offset+"m"),[{key:"v",label:"% vs event month",data:ev.path.map(p=>p.pctDelta)}],{unit:"pct"})]:[barSpec("Modelled price response (%)",sc.map(s=>({label:s.name,v:s.overallPriceChangePct,tone:s.overallPriceChangePct>0?"up":"down"})))],
    actions:[{l:"Geo risk",a:"go:fc-geo"},{l:"Pending alerts",a:"ask:Which geopolitical alerts are awaiting review?"}]});
}
function ansHitlResult(a,st){
  const im=a.impact;
  return R(st==="confirmed"&&im&&im.available?`<p><b>Alert confirmed:</b> ${esc(a.headline)}. Estimated change in forecast prices <b>${sgn(im.overallPriceChangePct,2)}</b> (${im.shockPct}% shock to ${im.channelsUsed.join(" + ")} over ${im.horizonMonths} months) ≈ ${cr(im.overallPriceChangePct/100*P.cost(P.PARTS,p=>p.fcEnd))} on the cost per vehicle. A follow-up task was created for the Buyer and the audit log updated.</p>`
    :`<p><b>Alert ${st}:</b> ${esc(a.headline)}. No impact was applied to the forecast. The audit log was updated.</p>`,
    {charts:st==="confirmed"&&im&&im.available?[barSpec("Impact by project (%)",im.byLevel.project.map(r=>({label:r.name,v:r.priceChangePct,tone:r.priceChangePct>0?"up":"down"})))]:[],actions:[{l:"Open Geo risk",a:"go:fc-geo"}]});
}
function ansModel(q){
  const mc=P.RAW.modelComparison, v=P.RAW.validation, ft=P.RAW.futureTest, rn=v.backtests.find(b=>b.model==="naive"), best=ft.scores.slice().sort((a,b)=>a.mape-b.mape)[0];
  return R(`<p><b>Hold-out (synthetic panel):</b> ${mc.map(m=>esc(m.model)+" "+nf(m.mape,2)+"%").join(" · ")} MAPE — ${esc(mc[0].model)} is best.</p>
   <p><b>Real data (BLS index, last ${rn.n_test} published months):</b> no fitted model beat carrying the last value forward — naive ${nf(rn.mape,2)}% MAPE. The real index is close to a random walk at this horizon.</p>
   <p><b>Blind simulated future (${ft.futureMonths} months):</b> ${esc(best.model)} ${nf(best.mape,2)}% MAPE against an irreducible noise floor of ${nf(ft.noiseFloor.meanFloorPct,2)}%.</p>
   <p class="rd-m">The part-level prices are synthetic, so absolute accuracy shows how well the pipeline recovers a known process — the model ranking transfers, the absolute error does not.</p>`,
    {charts:[barSpec("Hold-out MAPE by model (%)",mc.map(m=>({label:m.model,v:m.mape})),{unit:"number"})],actions:[{l:"Real-data validation",a:"go:fc-validation"},{l:"Simulated-future test",a:"go:fc-futuretest"},{l:"Technical FAQ",a:"go:fc-faq"}]});
}
function ansData(){
  const ds=P.RAW.dataSources, pv=P.RAW.provenance;
  return R(`<p>${esc(pv.disclaimer)}</p><ul>${ds.map(d=>`<li><b>${esc(d.name)}</b> — ${d.isReal?"real":"synthetic"}; ${esc(d.coverage)}. ${esc(d.usedFor)}</li>`).join("")}</ul><p class="rd-m">Commodity and freight series are offline fallbacks (synthetic); only FX, the BLS index and the geopolitical-risk index are real.</p>`,{actions:[{l:"Data sources & drivers",a:"go:fc-data"}]});
}
function ansWhy(ctx,q){
  const p=ctx.lastPart; if(!p) return null;
  const mc=P.marketContext(p), w=P.costWalk([p]), rs=p.reason, br=p.bridges?p.bridges.b2f:{};
  const items=P.BK.map(k=>[P.BRIDGE_PLAIN[k],br[k]||0]).filter(x=>Math.abs(x[1])>0.005), tot=P.sum(items,x=>Math.abs(x[1]))||1;
  const bom=(P.bomOf(p)||[]).slice().sort((a,b)=>Math.abs(b.fc-b.bg)-Math.abs(a.fc-a.bg)).slice(0,3);
  let h=`<h5 class="rd-h">Why the price moves</h5><p><b>${esc(p.name)}</b> (${esc(p.id)}) is forecast <b>${sgn(p.chgH)}</b> (${inr(p.cur,2)} → ${inr(p.fcEnd,2)}, interval ${inr(p.loEnd)}–${inr(p.hiEnd)}). Confidence is <b>${p.conf.level}</b>: the move is ${p.conf.ratio}× the model's typical ${p.conf.errPct}% error.</p>`;
  if(rs) h+=`<p>${esc(rs.summary)}</p><p class="rd-m">${esc(rs.story)}</p>`;
  if(items.length) h+=`<p>The cost walk attributes the move (budget → forecast) to: ${items.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([n,v])=>`${esc(n.toLowerCase())} ${Math.round(Math.abs(v)/tot*100)}% (${v>=0?"pushing up":"pulling down"})`).join("; ")}.</p>`;
  h+=`<h5 class="rd-h">Real-world reasons (market context, not model-measured)</h5><ul>${mc.specific.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><p class="rd-m">${esc(mc.part)}</p>`;
  if(bom.length) h+=`<h5 class="rd-h">Material cost impact (sample build-up)</h5><ul>${bom.map(m=>`<li>${esc(m.name)}: ${inr(m.bg,2)} → ${inr(m.fc,2)} (${sgn((m.fc/m.bg-1)*100)})</li>`).join("")}</ul>`;
  h+=`<h5 class="rd-h">What to do</h5><p>${p.conf.level==="high"?"The direction is worth acting on — raise it with "+esc(p.vendorName)+" before the next re-price"+(p.vendor.repriceMonths?" (they re-price about every "+p.vendor.repriceMonths+" months)":"")+".":p.conf.level==="medium"?"Use it as a review flag and double-check the top driver's source before negotiating.":"The move sits inside the model's usual error — do not act on the direction alone; watch it next month."}</p>`;
  return R(h,{actions:[{l:"Part detail & cost walk",a:"part:"+p.id}]});
}
function ansWalk(q){
  const steps=P.walkSteps(P.PARTS,/history|so far|until now|nominat/i.test(q)?"nom_to_sop":/next|ahead|forecast move|from today/i.test(q)?"sop_to_fc":"bg_to_fc"), tot=steps.filter(s=>s.kind==="total"), br=steps.filter(s=>s.kind==="bridge").filter(s=>Math.abs(s.value)>0.5).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  const d=tot[1].value-tot[0].value, da=Math.abs(d)||1;
  return R(`<p><b>${esc(tot[0].label)} ${cr(tot[0].value)} → ${esc(tot[1].label)} ${cr(tot[1].value)}</b> (${sgn(d/tot[0].value*100,1)}, ${spendS(d)}). Main reasons:</p><ul>${br.map(s=>`<li><b>${esc(P.BRIDGE_PLAIN[s.id])}</b> ${spendS(s.value)} — ${Math.round(Math.abs(s.value)/da*100)}% of the change</li>`).join("")}</ul><p class="rd-m">Budget is a derived proxy (the first history month); figures are cost per vehicle (piece price × quantity per vehicle, average car). Materials and shipping show no part-level signal in this POC build.</p>`,
    {charts:[barSpec("Cost walk drivers (₹)",br.map(s=>({label:P.BRIDGE_PLAIN[s.id],v:s.value,tone:s.value>0?"up":"down"})),{unit:"currency"})],actions:[{l:"Open Material Cost Forecast",a:"go:fc-material"},{l:"Hierarchy drill-down",a:"go:fc-hierarchy"}]});
}
const spendS=v=>(v>=0?"+":"−")+cr(Math.abs(v)).replace("−","");
function ansConfidence(){
  const hi=P.PARTS.filter(p=>p.conf.level==="high").sort((a,b)=>Math.abs(b.chgH)-Math.abs(a.chgH)), md=P.PARTS.filter(p=>p.conf.level==="medium").length, lo=P.PARTS.filter(p=>p.conf.level==="low").length;
  return R(`<p>Confidence is a <b>signal-to-error ratio</b>, not a probability: it compares the predicted move with the model's typical error at this horizon. <b>${hi.length}</b> parts are <b>high</b> (move ≥ 2× error — worth acting on), <b>${md}</b> medium, <b>${lo}</b> low (inside the noise).</p><p>The highest-confidence big movers:</p>`+partTable(hi.slice(0,8)),{actions:[{l:"Open in Parts",a:"filter:dir=high"},{l:"Hierarchy drill-down",a:"go:fc-hierarchy"}]});
}
/* ---- workflow data (the rest of the prototype) ---- */
function ansTasks(){
  const mine=TaskCentre.forRole(RBAC.role), role=(ROLES.find(r=>r.id===RBAC.role)||{}).label;
  const ap=ApprovalEngine.flows.filter(f=>{ const c=f.steps.find(s=>s.status==="current"); return c&&(RBAC.role==="admin"||c.role===RBAC.role); });
  return R(`<p>${esc(role)}: <b>${mine.length}</b> open task${mine.length===1?"":"s"} and <b>${ap.length}</b> approval${ap.length===1?"":"s"} waiting.</p><ul>${mine.slice(0,7).map(t=>`<li><b>${esc(t.title)}</b> — ${esc(t.due)} <span class="rd-m">(${esc(t.wf)})</span></li>`).join("")}</ul>`,{actions:[{l:"Open Home",a:"go:home"},{l:"Approvals",a:"go:approvals"}]});
}
function ansApprovals(){
  const fl=ApprovalEngine.flows; const rows=fl.map(f=>{ const c=f.steps.find(s=>s.status==="current"); return {f,c}; });
  return R(`<p><b>${fl.length}</b> workflows in the approval engine; <b>${rows.filter(r=>r.c).length}</b> waiting on a step:</p><ul>${rows.map(r=>`<li><b>${esc(r.f.wf)}</b> — ${esc(r.f.entity)}: ${r.c?"waiting on "+esc((ROLES.find(x=>x.id===r.c.role)||{}).label||r.c.role)+" ("+esc(r.c.label)+")":"complete"}</li>`).join("")}</ul>`,{actions:[{l:"Approvals & escalations",a:"go:approvals"}]});
}
function ansCarCost(){
  const by={}; Object.values(DATA.cbds).forEach(c=>{ try{ (by[c.project]=by[c.project]||{n:0,t:0}); by[c.project].n++; by[c.project].t+=window.__cbdCost(c)*(c.qtyPerCar||1)+(c.dd.amortPerCar||0); }catch(e){} });
  const rows=Object.entries(by);
  return R(`<p>Material cost at car level from the cost breakdowns on file (${Object.keys(DATA.cbds).length} parts with a CBD): ${rows.map(([k,v])=>`<b>${esc(k)}</b> ${inr(v.t)} per car over ${v.n} part${v.n>1?"s":""}`).join("; ")}.</p><p class="rd-m">Only parts with a built-up CBD are included; the forecast outlook covers all ${P.PARTS.length} parts.</p>`,
    {charts:[barSpec("Cost per car from CBD parts (₹)",rows.map(([k,v])=>({label:k,v:v.t})),{unit:"currency"})],actions:[{l:"Material Cost Forecast",a:"go:fc-material"}]});
}
function ansInvestment(){
  const inv=Object.values(DATA.investments); const tot=P.sum(inv,i=>i.capex);
  return R(`<p><b>${inv.length}</b> tooling records, committed capex <b>${cr(tot)}</b>: ${inv.slice(0,6).map(i=>`${esc(i.part)} (${esc(i.project)}) ${cr(i.capex)} — ${esc(i.status)}`).join("; ")}.</p><p class="rd-m">SRM tool-readiness (RYG) dashboards are not populated in this prototype build; tooling status above comes from the investment records.</p>`,{actions:[{l:"Investment dashboard",a:"go:investment-dash"}]});
}
function ansBenchmark(){
  return R(`<p>${DATA.benchmarks.length} benchmark references on file: ${DATA.benchmarks.map(b=>`${esc(b.ref)} at ${inr(b.benchPrice)} (${esc(b.commodity)}, ${esc(b.note)})`).join("; ")}.</p><p>Compare with the current prices: ${esc(DATA.parts[0].designation)} ${inr(DATA.parts[0].poc.cur)}, ${esc(DATA.parts[1].designation)} ${inr(DATA.parts[1].poc.cur)}.</p>`,{actions:[{l:"Investment benchmarking",a:"go:investment-benchmark"}]});
}
function ansSavings(){
  const rc=P.riskConcentration(5);
  return R(`<p>This prototype has no savings ledger. For sizing only: the forecast cost at risk per vehicle is ${cr(rc.totalSpendAtRisk)}; a 2% negotiated reduction on it would be worth about <b>${cr(rc.totalSpendAtRisk*0.02)}</b> per vehicle. Material Cost has a “Savings −2%” scenario toggle for the cost breakdowns.</p>`,{actions:[{l:"Material Cost",a:"go:fc-material"}]});
}
function ansBrief(){
  const k=P.kpis(), rc=P.riskConcentration(5), v0=rc.vendor[0], up=P.rollup("category")[0], m=P.movers("up",3,"horizon"), pend=PocHitl.pending();
  return R(`<p><b>Three cost risks to share</b> (forecast to ${mlab(P.FM[P.NF-1])}):</p><ol>
   <li><b>Vendor concentration:</b> ${esc(v0.name)} — ${cr(v0.spendAtRisk)} at risk over ${v0.parts} parts (average +${v0.avgIncreasePct.toFixed(1)}%). The top 4 vendors hold ${nf(rc.top4VendorSharePct,1)}% of the ${cr(rc.totalSpendAtRisk)} at risk.</li>
   <li><b>Vertical pressure:</b> ${esc(up.name)} is forecast ${sgn(up.changePct)} (${cr(up.changeAbs)} more) across ${up.parts} parts.</li>
   <li><b>Single-part spikes:</b> ${m.map(p=>esc(p.name)+" ("+esc(p.progCode)+") "+sgn(p.chgH)).join("; ")}.</li></ol>
   <p>Context: cost per vehicle ${cr(k.basket.value)} → ${cr(k.forecast.value)} (${sgn(k.forecast.change,2)}). ${pend.length} geopolitical alert${pend.length===1?"":"s"} still await review and are <b>not</b> included in these numbers.</p>`,
    {charts:[barSpec("Spend at risk by vendor (₹)",rc.vendor.slice(0,5).map(v=>({label:v.name,v:v.spendAtRisk,tone:"up"})),{unit:"currency"})],actions:[{l:"Forecast outlook",a:"go:fc-outlook"},{l:"Pending alerts",a:"ask:Which geopolitical alerts are awaiting review?"}]});
}
function ansHelp(){
  return R(`<p>I'm <b>Radar</b>, running inside Ask AIS. I answer from the forecasting POC data and the platform's own records — ask about:</p><ul><li><b>Parts & prices</b> — “Tell me about the Fuse Box for Kushaq”, “Wiring Harness forecast”</li><li><b>Movers & risk</b> — “Top 10 rising parts”, “Where does the risk concentrate?”</li><li><b>Vendors, projects, verticals</b> — “Bosch India”, “Taigun”, “Lighting”</li><li><b>FX, commodities, geopolitics</b> — “What if the rupee weakens 5%?”, “steel exposure”, “pending alerts”</li><li><b>Model trust</b> — “How accurate is the forecast?”, “which data is real?”</li><li><b>Your work</b> — “my tasks”, “approvals”, “material cost at car level”, “tooling”</li></ul><p class="rd-m">${RadarCfg.server()?"Radar server connected: questions go to the LLM with live news; this offline engine is the fallback.":"Offline mode: live news needs the Radar server (Admin → AI Model Settings)."}</p>`);
}

/* ------------------------------------------------------------ router */
function local(q,ctx){
  const t=q.toLowerCase().trim();
  if(!t) return ansHelp();
  if(/^(hi|hello|hey|help|what can you do|\?)\b/.test(t)) return ansHelp();
  if(/\b(why|reason|driving|driver|explain)\b/.test(t)&&!/(cost|spend|budget|walk|bridge)/.test(t)&&ctx.lastPart&&!matchParts(q).length&&!matchVendor(q)&&!matchCat(q)) return ansWhy(ctx,q);
  if(/(my tasks|my to.?do|need.*attention|what (should|do) i (do|work|focus|tackle)|open tasks|reminders|my approvals)/.test(t)) return ansTasks();
  if(/approval|escalat|sign.?off/.test(t)&&!/geo/.test(t)) return ansApprovals();
  if(/(alert|geopolit|red sea|ukraine|houthi|israel|freight|shipping|duty|tariff|gpr|sanction)/.test(t)&&!/part price|forecast for/.test(t)) return ansGeo(q);
  if(/\b(news|headline|latest|today.?s)\b/.test(t)&&!RadarCfg.server()){
    const r=ansCommodity("steel aluminium copper"); r.html=`<p><b>Live news needs the Radar server.</b> I'm running offline, so I can't search the web. Here is the forecast context for the commodities that usually drive the headlines, from the POC data:</p>`+r.html; r.actions.unshift({l:"Connect Radar server",a:"go:ai-model-settings"}); return r;
  }
  const parts=matchParts(q);
  if(parts.length===1&&/\b(why|reason|explain|driving)\b/.test(t)&&!/(cost|spend|budget|walk|bridge)/.test(t)){ ctx.lastPart=parts[0]; return ansWhy(ctx,q); }
  if(parts.length===1&&!/(compare|top|biggest|largest)/.test(t)) return ansPart(parts[0],ctx);
  if(parts.length>1&&!/(compare|top|biggest|largest|rise|fall|rising|falling)/.test(t)&&/(forecast|price|cost|tell|about|show|history|why|\bfor\b)/.test(t)) return ansAmbiguous(parts,ctx,parts[0].name);
  if(/(why (did|has|is) (the )?(cost|spend|budget)|cost walk|what moved|budget to forecast|bridge|drivers? of (the )?cost)/.test(t)) return ansWalk(q);
  if(/(confidence|which .*trust|signal.to.error|high.confidence)/.test(t)) return ansConfidence();
  if(/(hierarch|drill.?down|tree)/.test(t)) return R(`<p>The <b>Hierarchy Drill-down</b> shows project → vendor → vertical → part → material (drag the level boxes to regroup), with current and forecast annual spend, variance and a confidence badge per part. The roll-up below it shows the same forecast by project, vendor or vertical.</p>`,{actions:[{l:"Open Hierarchy",a:"go:fc-hierarchy"},{l:"Material Cost Forecast",a:"go:fc-material"}]});
  if(/(model|accura|mape|validat|back.?test|noise|reliab|trust|how good|future test)/.test(t)) return ansModel(q);
  if(/(data source|provenance|which data|real data|synthetic|where.*data)/.test(t)) return ansData();
  if(/(fx|forex|rupee|currency|usd|eur\b|euro|exchange)/.test(t)) return ansFx(q);
  if(/(steel|alumin|copper|plastic|polymer|resin|electronic|chip|semicond|commodit)/.test(t)) return ansCommodity(q);
  if(/(car level|per car|material cost|car cost)/.test(t)) return ansCarCost();
  if(/(investment|tooling|capex|readiness|ryg)/.test(t)) return ansInvestment();
  if(/benchmark/.test(t)) return ansBenchmark();
  if(/saving/.test(t)) return ansSavings();
  if(/(concentrat|at risk|spend at risk|cost at risk|hierarch)/.test(t)) return ansRisk();
  if(/(manager|director|leadership|management|board).*(risk|share|update)|(three|3) biggest.*risk|biggest.*cost risks?/.test(t)) return ansBrief();
  const vd0=matchVendor(q); if(vd0&&/meet|push back|negotiat|talk to|visit/.test(t)) return ansVendor(vd0,q);
  if(/(top|biggest|largest|most|rise|rising|fall|falling|mover|compare|side by side|increase|decrease|drop|cheaper)/.test(t)) return ansMovers(q,ctx);
  const vd=matchVendor(q); if(vd) return ansVendor(vd,q);
  const pr=matchProg(q); if(pr) return ansProg(pr,q);
  const ct=matchCat(q); if(ct) return ansCategory(ct,q);
  if(parts.length>1) return ansAmbiguous(parts,ctx,parts[0].name);
  if(/(overview|summary|headline|kpi|basket|cost per vehicle|outlook|forecast|price)/.test(t)) return ansKpis();
  const hits=P.search(q.replace(/[?.!]/g,"").slice(0,40)); if(hits.length&&hits.length<40) return ansAmbiguous(hits,ctx,q);
  return R(`<p>I couldn't match “${esc(q)}” to a part, vendor, project, vertical or topic. Try a part name with a project (“Fuse Box Kushaq”), a vendor (“Bosch India”), or one of the questions below.</p>`,{actions:[{l:"What can you do?",a:"ask:help"},{l:"Top rising parts",a:"ask:Top 10 rising parts"}]});
}

/* ------------------------------------------------------------ server mode (the POC's /api/chat, NDJSON) */
async function viaServer(history,onMode){
  const cfg=RadarCfg.get(), url=cfg.url.replace(/\/+$/,"")+"/api/chat";
  const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),65000);
  try{
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl.signal,body:JSON.stringify({messages:history.slice(-12),webEnabled:!!cfg.web,stream:true})});
    if(!res.ok){ let e=""; try{ e=(await res.json()).error; }catch(_){} throw new Error(e||("HTTP "+res.status)); }
    const rd=res.body.getReader(), dec=new TextDecoder(); let buf="", result=null;
    for(;;){
      const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
      let i; while((i=buf.indexOf("\n"))>=0){ const ln=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(!ln) continue;
        try{ const ev=JSON.parse(ln); if(ev.type==="mode"&&onMode) onMode(ev.mode); else if(ev.type==="result") result=ev; else if(ev.type==="error") throw new Error(ev.error); }catch(e){ if(e.message&&!/JSON/.test(e.message)) throw e; } }
    }
    if(!result) throw new Error("no result");
    return R(md(result.reply),{charts:result.charts||[],sources:result.sources||[],basis:"Radar server · "+(result.usedWeb?"live news + ":"")+"dashboard data",actions:[]});
  } finally { clearTimeout(to); }
}

/* ------------------------------------------------------------ suggestions */
/* the POC's "real business situations" open screen (lib/situations.ts) + a few prototype-wide questions */
const SUGG=[
  {label:"Supplier meeting",q:"I meet Bosch India next week. Which of their parts are forecast to rise the most, and what should I push back on?"},
  {label:"Leadership question",q:"My director thinks freight rates will spike and wants us to lock in prices. Does our forecast agree, and what is the news saying?"},
  {label:"Alert decision",q:"Two geopolitical alerts are still pending. What would each one cost us if confirmed?"},
  {label:"Manager update",q:"Give me the three biggest cost risks for this month that I can share with my manager, with numbers."},
  {label:"News check",q:"Aluminium and steel prices keep coming up in trade news. Is there anything current that could raise our costs, and how does it link back to our forecast?"},
  {label:"Cost comparison",q:"Compare our top 5 rising and falling parts this month so I can see them side by side."},
  {label:"What needs my attention?",q:"What needs my attention?"},
  {label:"Why did cost change?",q:"Why did the cost change from budget to forecast?"},
];
return {local,Tools,md,chartHtml,SUGG,ansHitlResult,ansHelp,R};
})();
/* The chat UI itself (the POC's Radar panel) lives in e7_chat.js; this file is the answer engine. */
