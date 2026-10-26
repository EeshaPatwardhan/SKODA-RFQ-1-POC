/* =====================================================================
   E7  ·  Dashboard + Forecast detail (ports of the POC dashboard / forecast views)
   ===================================================================== */
(function(){
"use strict";
const U=PocUI, P=PocCore, C=PocCharts, R=P.RAW, esc=C.esc, nf=C.nf;
const {spend,cur,inr,sgn,ml,panel,kpi,note,seg,pill,varCell,arrow,axisCur,el,wire,header,state}=U;
const MS=R.materialCost.milestones;

/* ---------- KPI cards (POC KpiCard; recomputed for a date window like filterDashboardData) ---------- */
function kpiCards(){
  const r=U.rangeOf(), full=(r.start===U.ALLM[0]&&r.end===U.ALLM[U.ALLM.length-1]);
  const hist=P.MONTHS.map((m,i)=>({m,i})).filter(x=>U.inRange(x.m)), fut=P.FM.map((m,j)=>({m,j})).filter(x=>U.inRange(x.m));
  return R.kpis.map(k=>{
    let value=k.value, change=k.change, label=k.changeLabel, nt=k.note||"";
    if(!full){
      if(k.id==="basket"&&hist.length){ const a=hist[hist.length-1].i; value=P.basketAt(a); change=hist.length>1?(value/P.basketAt(hist[hist.length-2].i)-1)*100:null; label=change==null?"as of "+ml(P.MONTHS[a]):sgn(change,1)+" vs previous month in range"; nt="Window "+ml(U.rangeOf().start)+" – "+ml(U.rangeOf().end); }
      if(k.id==="forecast"&&fut.length){ const j=fut[fut.length-1].j; value=P.forecastBasketAt(j); const base=hist.length?P.basketAt(hist[hist.length-1].i):null; change=base?(value/base-1)*100:null; label=change==null?"as of "+ml(P.FM[j]):sgn(change,1)+" vs last actual in range"; nt="End of selected window ("+ml(P.FM[j])+")"; }
    }
    const val=k.format==="currency"?spend(value):k.format==="percent"?value.toFixed(1)+"%":nf(value,2);
    const IC={trending:"trend-up",package:"package",target:"target",alert:"alert"}[k.icon]||"trend-up";
    const up=change!=null&&change>0;
    return `<div class="kpi-card"><div class="kpi-label">${esc(k.label)}<span class="kpi-icon">${Icons.svg(IC)}</span></div><div class="kpi-value">${val}</div>
      <div class="kpi-trend2">${change!=null&&k.direction!=="flat"?`<span class="var ${up?"up":"dn"}">${arrow(up)}${sgn(change,2)}</span>`:""}<span class="mut">${esc(label||"")}</span></div>${nt?`<div class="kpi-note">${esc(nt)}</div>`:""}</div>`;
  }).join("");
}

/* ---------- Buyer brief: three supplier calls ---------- */
const DRIVER={fx:"currency",commodity:"materials",freight:"shipping",vendorReprice:"a supplier price change",mix:"part mix",seasonality:"seasonality",unexplained:"other cost movement"};
function buyerBrief(){
  const byV=new Map();
  P.PARTS.forEach(p=>{ const rise=p.fcEnd-p.cur; if(rise<=0) return; const c=byV.get(p.vendorName); if(!c||rise>c.rise){
    const s2f=p.bridges?p.bridges.s2f:{}, top=Object.entries(s2f).filter(([k,x])=>x>0.5).sort((a,b)=>b[1]-a[1])[0];
    byV.set(p.vendorName,{vendor:p.vendorName,part:p,rise,driver:top?DRIVER[top[0]]:"the forecast itself"}); } });
  const calls=[...byV.values()].sort((a,b)=>b.rise-a.rise).slice(0,3); if(!calls.length) return "";
  const gap=P.cost(P.PARTS,p=>p.fcEnd)-P.cost(P.PARTS,p=>p.cur), fl=MS.forecast.label;
  return `<section class="panel"><div class="panel-body"><div class="mut small">Radar</div><h3 class="bb-t">Hold these prices before ${esc(fl)}</h3>
    <p class="small mut" style="max-width:70ch">${gap>0?`Doing nothing adds ${spend(gap)} to the cost of an average vehicle between SOP and ${esc(fl)}. These three suppliers hold the largest single-part increases.`:`These three suppliers hold the largest single-part increases into ${esc(fl)}.`}</p>
    <ol class="bb-grid">${calls.map((c,i)=>`<li><button type="button" class="bb-b" data-act="part:${esc(c.part.id)}"><span class="mut small">Call ${i+1}</span><b>${esc(c.vendor)}</b><span class="bb-x">${esc(c.part.name)} is up <b class="var up">${spend(c.rise)}</b>, mainly from ${esc(c.driver)}. Ask them to hold the SOP price.</span></button>
      <button type="button" class="bb-ask" data-act="ask:Why should we talk to ${esc(c.vendor)} about ${esc(c.part.name)} before ${esc(fl)}? The forecast shows it up ${spend(c.rise)}, mainly from ${esc(c.driver)}. What should we ask for?">Ask why</button></li>`).join("")}</ol></div></section>`;
}

/* ---------- Mean-price forecast chart (POC PriceForecastChart) ---------- */
const lakh=v=>v==null||isNaN(v)?"--":"₹"+(v/1e5).toFixed(2)+" L";
function priceChart(view){
  const rows0=R.priceSeries.filter(p=>U.inRange(p.month));
  if(!rows0.length) return panel("Cost per vehicle: actual vs forecast",'<div class="mut">No price points fall inside the selected date range.</div>');
  let lastA=-1; rows0.forEach((p,i)=>{ if(p.actual!=null) lastA=i; });
  const hasF=rows0.some(p=>p.forecast!=null);
  const rows=rows0.map((p,i)=>{ const join=i===lastA&&hasF; return {...p,fl:join?p.actual:p.forecast,lo:join?p.actual:p.lower,hi:join?p.actual:p.upper}; });
  let vis=rows; if(view==="focus"&&hasF){ const f=rows.findIndex(r=>r.forecast!=null); vis=rows.slice(Math.max(0,f-12)); }
  const idxOf=m=>vis.findIndex(r=>r.month===m);
  const lastActRow=[...rows0].reverse().find(p=>p.actual!=null), lastFcRow=[...rows0].reverse().find(p=>p.forecast!=null);
  const vals=vis.flatMap(p=>[p.actual,p.fitted,p.forecast,p.lower,p.upper]).filter(v=>v!=null), yMax=Math.max(...vals);
  const fIdx=vis.map((p,i)=>p.forecast!=null?i:-1).filter(i=>i>=0), peak=fIdx.length?fIdx.reduce((a,b)=>vis[b].forecast>vis[a].forecast?b:a):-1;
  const marks=[]; const ni=idxOf(MS.nomination.month), si=idxOf(MS.sop.month), ti=lastActRow?idxOf(lastActRow.month):-1;
  if(ni>=0) marks.push({i:ni,label:"Nomination",y:12}); if(si>=0&&si!==ti) marks.push({i:si,label:"SOP",y:24}); if(ti>=0) marks.push({i:ti,label:hasF?"Today":"SOP",y:36,dash:"4 3",color:C.C.muted});
  const chart=C.line({labels:vis.map(r=>ml(r.month)),height:view==="focus"?320:290,mLeft:62,maxX:view==="focus"?14:9,aria:"Cost per vehicle, actual vs forecast",
    yFmt:v=>yMax>=1000&&yMax<1e5?"₹"+(v/1000).toFixed(2)+"K":axisCur(v,yMax),
    shade:hasF&&ti>=0&&ti<vis.length-1?[{from:ti,to:vis.length-1,color:"var(--amber-soft)",opacity:.7,label:"Next "+P.NF+" months",textColor:"var(--amber)"}]:[],
    marks,
    series:[{name:"Actual",data:vis.map(r=>r.actual),color:C.C.anchor,width:2.25},
      {name:"Model fit (holdout)",data:vis.map(r=>r.fitted),color:C.C.info,dash:"5 3",width:1.75,dots:true,dotR:2.4,dotFill:C.C.info},
      {name:"Forecast",data:vis.map(r=>r.fl),color:"var(--c-amber)",width:3,dots:(i)=>vis[i].forecast!=null,dotR:4.5,labelAt:[fIdx[0],peak,fIdx[fIdx.length-1]].filter((v,i,a)=>v!=null&&v>=0&&a.indexOf(v)===i),labelFmt:v=>spend(v)}],
    band:{lo:vis.map(r=>r.lo),hi:vis.map(r=>r.hi),name:"Likely range",color:"#f59e0b"}});
  const change=lastActRow&&lastFcRow?(lastFcRow.forecast/lastActRow.actual-1)*100:null;
  const kf=R.kpis.find(k=>k.id==="forecast");
  const tiles=hasF&&lastActRow&&lastFcRow?`<div class="fc-tiles"><div><p>Latest actual · ${esc(lastActRow.label)}</p><b>${lakh(lastActRow.actual)}</b></div><div class="amber"><p>Forecast · ${esc(lastFcRow.label)}</p><b>${lakh(lastFcRow.forecast)} ${change!=null?`<span class="var ${change>0?"up":"dn"}" style="font-size:12px">${change>0?"+":change<0?"−":""}${Math.abs(change).toFixed(1)}%</span>`:""}</b></div>${lastFcRow.lower!=null?`<div><p>Likely range · ${esc(lastFcRow.label)}</p><b>${lakh(lastFcRow.lower)} to ${lakh(lastFcRow.upper)}</b></div>`:""}<div><p>Forecast cost per vehicle · ${esc(lastFcRow.label)}</p><b>${spend(kf?kf.value:null)} <small class="mut">per vehicle</small></b></div></div>`:"";
  return panel("Cost per vehicle forecast",tiles+chart,{sub:"Tracked parts, average car · Nomination and SOP are history · the forecast is the next "+P.NF+" months",
    right:hasF?`<div class="fc-segs tight"><button class="fc-seg ${view==="focus"?"on":""}" data-act="set:dash.view=focus">Focus on forecast</button><button class="fc-seg ${view==="full"?"on":""}" data-act="set:dash.view=full">Full history</button></div>`:""});
}

/* ---------- Horizon bars with interval whiskers ---------- */
function horizonChart(){
  const hz=P.forecastBand().filter(b=>U.inRange(b.month));
  if(!hz.length) return panel("Forecast by Time Horizon",'<div class="mut">No forecast months fall inside the selected date range.</div>');
  const mx=Math.max(...hz.map(b=>b.upper));
  return panel("Forecast by Time Horizon",C.vbars({items:hz.map((b,i)=>({label:ml(b.month),value:b.value,lo:b.lower,hi:b.upper,color:i===0?C.C.brand:"color-mix(in srgb,var(--brand) 38%,var(--panel))"})),height:264,mLeft:62,yFmt:v=>axisCur(v,mx),rangeLabel:"Prediction interval"}),
    {sub:"Cost per vehicle · whiskers show the prediction interval"});
}

/* ---------- Cost per vehicle by vertical (donut) ---------- */
function donutPanel(){
  const cats=R.categories, total=P.sum(cats,c=>c.value);
  const pal=[C.C.info,C.C.ok,"#7c5cbf",C.C.amber,"#2a9d8f",C.C.red,"#be185d",C.C.faint,"#4d7c0f","#e76f51"];
  const slices=cats.map((c,i)=>({label:c.category,value:c.value,color:pal[i%pal.length]}));
  const lg=cats.map((c,i)=>`<div class="dl"><i style="background:${pal[i%pal.length]}"></i><span>${esc(c.category)}</span><span class="var ${c.forecastChange>=0?"up":"dn"} sm">${sgn(c.forecastChange,1)}</span><b>${c.share.toFixed(1)}%</b></div>`).join("");
  return panel("Cost per Vehicle by Vertical",`<div class="fc-donut">${C.donut(slices,{size:176,center:spend(total),centerSub:"Total",aria:"Cost per vehicle by vertical"}).replace(/<ul class="pc-dl">[\s\S]*?<\/ul>/,"")}<div class="dls">${lg}</div></div>`,{sub:"Share of total · forecast movement over horizon"});
}

/* ---------- Largest forecast moves ---------- */
function topParts(limit){
  const ids=R.topPartIds.slice(0,limit), ps=ids.map(id=>P.part(id)).filter(Boolean);
  return panel("Largest Forecast Price Moves",U.table(U.PARTS_HEAD.slice(0,8).concat(["Trend"]),ps.map(p=>`<tr class="clk" data-act="part:${esc(p.id)}"><td>${U.partCell(p)}</td><td class="mono">${esc(p.id)}</td><td>${esc(p.progName)}</td><td>${U.vendorCell(p)}</td><td>${esc(p.category)}</td><td class="r">${cur(p.cur,false)}</td><td class="r"><b>${cur(p.fcEnd,false)}</b></td><td class="r">${varCell(p.chgH,1)}</td><td>${U.sparkFor(p)}</td></tr>`).join("")),
    {noPad:true,sub:"Ranked by absolute change over the forecast horizon · click a row for the price path",right:limit<12?`<button class="btn btn-sm" data-act="go:fc-parts">All parts</button>`:""});
}

/* ---------- Cost at risk (POC RiskStrip) ---------- */
function riskStrip(){
  const rc=P.riskConcentration(5), dim=state.dash.dim, rows=(rc[dim]||[]).slice(0,6), mx=Math.max(...rows.map(r=>r.shareOfRisk),1);
  return `<div class="panel"><div class="panel-header"><div class="ph-t"><h3>${Icons.svg("alert")} Cost At Risk</h3><div class="ph-s">Forecast to rise more than ${rc.thresholdPct}% over the horizon</div></div>${seg([["vendor","Vendor"],["category","Vertical"],["project","Project"]],dim,"set:dash.dim=%v")}</div>
    <div class="fc-bigs"><div><div class="mut small">Exposed cost per vehicle</div><div class="bigv red">${spend(rc.totalSpendAtRisk)}</div><div class="mut small">across ${rc.partsAtRisk} parts</div></div><div><div class="mut small">Concentration</div><div class="bigv">${rc.top4VendorSharePct.toFixed(0)}%</div><div class="mut small">sits with 4 vendors</div></div></div>
    <div class="fc-rrows">${rows.map(r=>`<div class="rr"><span class="nm" title="${esc(r.name)}">${esc(r.name)}</span><span class="bar"><i style="width:${r.shareOfRisk/mx*100}%"></i></span><b>${spend(r.spendAtRisk)}</b><span class="mut">${r.shareOfRisk.toFixed(0)}%</span><span class="var up">${sgn(r.avgIncreasePct,1)}</span></div>`).join("")}</div></div>`;
}

/* ---------- "Why cost changed" driver list (POC CostWalkWaterfall) ---------- */
function walkList(steps,o){
  o=o||{};
  const tot=steps.filter(s=>s.kind==="total"), s0=tot[0], s1=tot[tot.length-1], br=steps.filter(s=>s.kind==="bridge");
  const start=s0?s0.value:0, end=s1?s1.value:0, delta=end-start, dp=start?delta/start*100:0;
  const act=br.filter(s=>Math.abs(s.value)>0.5).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)), zeros=br.length-act.length, da=Math.abs(delta)||1;
  const rows=act.length?act.map(s=>{ const sel=o.activeId===s.id, up=s.value>0, share=Math.round(Math.abs(s.value)/da*100), w=Math.max(8,Math.min(100,share));
    return `<li><button type="button" class="wl-r ${sel?"sel":""}" title="${esc(P.BRIDGE_HELP[s.id]||s.label)}" data-act="${esc(o.actFor(s,sel))}"><div class="wl-h"><div><b>${esc(P.BRIDGE_PLAIN[s.id]||s.label)}</b><div class="mut small">${share}% of the change</div></div><b class="var ${up?"up":"dn"}">${spend(s.value,true)}</b></div><div class="wl-bar"><i class="${up?"up":"dn"}" style="width:${w}%"></i></div></button></li>`; }).join(""):`<li class="table-empty">No cost drivers in this window.</li>`;
  return panel(o.title||"Why cost changed",`<div class="wl-ends"><div><div class="mut small up-l">${esc(s0?s0.label:"Start")}</div><b>${spend(start)}</b></div><div class="wl-mid"><span class="chip ${delta>=0?"chip-red":"chip-green"}">${sgn(dp,1)}</span><span class="mut small">to</span></div><div class="r"><div class="mut small up-l">${esc(s1?s1.label:"End")}</div><b>${spend(end)}</b></div></div>
    <p class="small" style="margin:10px 0 6px">${delta>=0?"Went up by ":"Came down by "}<b class="var ${delta>=0?"up":"dn"}">${spend(Math.abs(delta))}</b>. Main reasons:</p><ul class="wl-ul">${rows}</ul>
    <div class="mut small" style="margin-top:8px"><span class="var up">Red</span> = cost up · <span class="var dn">Green</span> = cost down${zeros>0?` · ${zeros} other drivers had no change (hidden)`:""}</div>`,
    {sub:o.subtitle||"Click a row to see the parts behind it",right:o.activeId?`<button class="btn btn-sm" data-act="${esc(o.clear)}">Clear</button>`:""});
}
U.walkList=walkList; U.priceChartHtml=priceChart;

/* ======================================================================
   DASHBOARD
   ====================================================================== */
U.v.outlook=function(){
  const wrap=document.createElement("div");
  wrap.appendChild(header("Forecast Dashboard","Forecast spare parts prices and plan procurement ahead of the curve — "+P.PARTS.length+" parts, "+P.NF+"-month horizon, from the forecasting POC."));
  wrap.appendChild(el(U.toolbar()));
  const ops=R.meta.ops||R.drift||R.featureSelection;
  const synth=R.provenance.skuLayer==="synthetic";
  wrap.appendChild(el(note(`<b>${esc(P.model)}</b> model · history ${U.mlong(P.MONTHS[0])} – ${U.mlong(P.MONTHS[P.NH-1])} · forecast ${U.mlong(P.FM[0])} – ${U.mlong(P.FM[P.NF-1])}. ${synth?"The macro trend is real BLS data; the <b>part-level prices are synthetic</b>, so accuracy figures describe the pipeline, not real prices. ":""}<a href="#" data-act="go:fc-validation">How reliable is this forecast?</a>`,"info")));
  const k=document.createElement("div"); k.className="grid grid-4"; k.style.marginTop="16px"; k.innerHTML=kpiCards(); wrap.appendChild(k);
  const bb=buyerBrief(); if(bb){ const d=el(`<div style="margin-top:16px">${bb}</div>`); wrap.appendChild(d); }
  const g=document.createElement("div"); g.className="fc-main"; g.style.marginTop="16px";
  g.innerHTML=`<div class="col">${priceChart(state.dash.view)}${walkList(P.walkSteps(P.PARTS,"sop_to_fc"),{title:"Why the forecast moved",subtitle:"SOP to the forecast month. Click a reason to see those parts.",actFor:s=>"mat:sop_to_fc|"+s.id,clear:"set:material.bridge=null"})}</div><div class="col">${donutPanel()}${horizonChart()}</div>`;
  wrap.appendChild(g);
  wrap.appendChild(el(`<div style="margin-top:16px">${topParts(7)}</div>`));
  wrap.appendChild(el(`<div style="margin-top:16px">${riskStrip()}</div>`));
  wrap.appendChild(el(`<div style="margin-top:16px">${U.alertsStrip(true)}</div>`));
  wrap.appendChild(el(`<div class="mut small" style="margin-top:14px">Part prices are illustrative piece prices in INR. Cost per vehicle = piece price × quantity per vehicle, summed over the tracked parts in scope and averaged across projects. Forecast shapes come from the forecasting POC. <a href="#" data-act="goadmin:fc-data">Data sources</a> · <a href="#" data-act="go:fc-faq">Technical FAQ</a></div>`));
  wire(wrap); return wrap;
};

/* ======================================================================
   FORECAST DETAIL: price forecast + horizon + donut + model comparison
   ====================================================================== */
const MCOL={sarima:"#d1495b",xgboost:"#2274a5",seasonal_naive:"#8d99ae"};
function modelComparison(){
  const sorted=R.modelComparison.slice().sort((a,b)=>a.mape-b.mape), bs=R.backtestSummary;
  const f3=v=>v==null?"--":(+v).toFixed(3);
  const bars=C.vbars({items:sorted.map(m=>({label:m.model,value:m.mape,color:MCOL[m.model]||C.C.faint})),height:230,mLeft:46,yFmt:v=>v.toFixed(1)+"%"});
  return panel("Model Comparison — Synthetic Panel",bars+U.table(["Model",{t:"MAE",r:1},{t:"RMSE",r:1},{t:"MAPE",r:1}],sorted.map(r=>`<tr><td><b>${esc(r.model)}</b></td><td class="r">${f3(r.mae)}</td><td class="r">${f3(r.rmse)}</td><td class="r"><b>${f3(r.mape)}%</b></td></tr>`).join("")),
    {sub:"Common part set, all models scored on identical parts · lower is better",right:'<span class="pill amber">synthetic</span>'})+
   (bs.length?panel("Backtest Stability",U.table(["Model",{t:"MAE",r:1},{t:"RMSE",r:1},{t:"MAPE",r:1}],bs.map(r=>`<tr><td><b>${esc(r.model)}</b></td><td class="r">${f3(r.mae_mean)} <small class="mut">±${f3(r.mae_std)}</small></td><td class="r">${f3(r.rmse_mean)} <small class="mut">±${f3(r.rmse_std)}</small></td><td class="r">${f3(r.mape_mean)}% <small class="mut">±${f3(r.mape_std)}</small></td></tr>`).join("")),
    {noPad:true,style:"margin-top:16px",sub:"Mean ± std across rolling origins · a low spread means the accuracy is not a one-off lucky split"}):"");
}
U.modelComparisonHtml=modelComparison;
U.v.forecast=function(){
  const wrap=document.createElement("div");
  wrap.appendChild(header("Forecast Detail","Model comparison, backtest stability, and the forward projection."));
  wrap.appendChild(el(U.toolbar()));
  wrap.appendChild(el(`<div style="margin-top:16px">${priceChart(state.dash.view)}</div>`));
  const g=document.createElement("div"); g.className="fc-cols"; g.style.marginTop="16px"; g.innerHTML=horizonChart()+donutPanel(); wrap.appendChild(g);
  wrap.appendChild(el(`<div style="margin-top:16px">${modelComparison()}</div>`));
  wire(wrap); return wrap;
};
})();
