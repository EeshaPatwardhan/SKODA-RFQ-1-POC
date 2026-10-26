/* =====================================================================
   E7  ·  Integration — wires the forecasting POC into the E6 workflow
   navigation · Home · Material Cost · Price History · Commodity & Forex ·
   tasks/audit for HITL alerts · global search · AI settings · boot
   ===================================================================== */
(function(){
"use strict";
const P = PocCore, C = PocCharts, U = PocUI, A = PocAdmin, esc = C.esc, nf = C.nf;
const pad = (n,w)=>String(n).padStart(w,"0");

/* ---------------------------------------------------------------- navigation + screens */
const FC_LABEL = {"fc-outlook":"Forecast Dashboard","fc-forecast":"Forecast Detail","fc-material":"Material Cost Forecast","fc-hierarchy":"Hierarchy Drill-down","fc-parts":"Parts","fc-impact":"Cost Impact","fc-fx":"FX Impact","fc-geo":"Geo Risk","fc-alerts":"Alerts",
  "fc-validation":"Real-Data Validation","fc-futuretest":"Simulated-Future Test","fc-data":"Data Sources","fc-faq":"Technical FAQ"};
const FC_IDS = ["fc-outlook","fc-forecast","fc-material","fc-hierarchy","fc-parts","fc-impact","fc-fx","fc-geo","fc-alerts"];
const MODEL_IDS = ["fc-validation","fc-futuretest","fc-data","fc-faq"];
const FC_ITEMS = FC_IDS.map(id=>({id,label:FC_LABEL[id],icon:"📈"}));
const MODEL_ITEMS = MODEL_IDS.map(id=>({id,label:FC_LABEL[id],icon:"🧪"}));
Object.assign(NAV_ICONS,{"fc-outlook":"trend-up","fc-forecast":"line-chart","fc-material":"coins","fc-hierarchy":"network","fc-parts":"list","fc-impact":"calculator","fc-fx":"swap","fc-geo":"globe","fc-alerts":"bell",
  "fc-validation":"check-circle","fc-futuretest":"clock","fc-data":"database","fc-faq":"book"});
Object.assign(NAV_SHORT,{"fc-outlook":"Dashboard","fc-forecast":"Forecast Detail","fc-material":"Material Cost Forecast","fc-hierarchy":"Hierarchy","fc-validation":"Real-Data Validation","fc-futuretest":"Simulated Future"});
NAV.procurement.push({sep:"Forecast & risk"},...FC_ITEMS);
NAV.admin.push({sep:"Forecast model"},...MODEL_ITEMS);
MODULE_TREE.procurement.splice(1,0,["Forecast & risk",FC_IDS]);
MODULE_TREE.admin.push(["Forecast model",MODEL_IDS]);
Shell.MOD.procurement.d = "Sourcing, cost, forecast & risk";
const _nl = navLabel; navLabel = function(m,s){ return FC_LABEL[s] || (/^ai-assistant/.test(s)?"Ask AIS":_nl(m,s)); };

const V = U.v;
const BUILD = {"fc-outlook":V.outlook,"fc-forecast":V.forecast,"fc-material":V.material,"fc-hierarchy":V.hierarchy,"fc-parts":V.parts,"fc-impact":V.impact,"fc-fx":V.fx,"fc-geo":V.geo,"fc-alerts":V.alerts,
  "fc-validation":A.buildValidation,"fc-futuretest":A.buildFuture,"fc-data":A.buildData,"fc-faq":A.buildFaq};
FC_IDS.forEach(k=>{ SCREENS.procurement[k]=BUILD[k]; });
MODEL_IDS.forEach(k=>{ SCREENS.procurement[k]=BUILD[k]; SCREENS.admin[k]=BUILD[k]; });
SCREENS.procurement["fc-model"]=BUILD["fc-validation"]; SCREENS.admin["fc-model"]=BUILD["fc-validation"];

/* The old "Dashboards & reports" group duplicated Forecast & risk. Its Material Cost screen is superseded by "Material Cost Forecast";
   Investment and Investment Benchmarking (tooling CAPEX and external benchmarks — not covered by the forecast) move next to the
   other cost screens, and Reports joins Forecast & risk. */
(function(){
  const t=MODULE_TREE.procurement, di=t.findIndex(g=>g[0]==="Dashboards & reports"); if(di>=0) t.splice(di,1);
  const fr=t.find(g=>g[0]==="Forecast & risk"); if(fr) fr[1]=fr[1].concat(["reports"]);
  const cp=t.find(g=>g[0]==="Cost & price"); if(cp) cp[1]=cp[1].concat(["investment-dash","investment-benchmark"]);
  NAV_HIDDEN.add("material-cost-dash");
})();

/* ---------------------------------------------------------------- tasks / audit for forecast work */
const PocWork = {
  seed(){
    const pend = PocHitl.alerts();
    pend.forEach((a,i)=>{
      const wf = "GEO-2026-"+pad(i+1,4);
      TaskCentre.tasks.unshift({id:"TG"+(i+1), state:"open", reminders:0, icon:"🌍", escalationTarget:null, type:"approval-pending", owner:"commodity", entity:a.headline, wf,
        due:a.severity>=5?"Due today":"Due in "+(a.severity>=4?2:4)+"d", dueDays:a.severity>=5?0:(a.severity>=4?2:4), cadence:"On event",
        title:"Review geopolitical alert — "+a.headline, meta:"Geo risk • severity "+a.severity+"/5 • "+a.regionScope, alertId:a.alertId});
      TaskCentre.emailLog.unshift({when:"2026-07-29 07:30", to:"commodity", subj:"["+wf+"] Approval pending — "+a.headline, opened:false});
    });
    const rc = P.riskConcentration(5), v0 = rc.vendor[0], m0 = P.movers("up",1,"horizon")[0];
    const add=(id,owner,type,title,meta,wf,due,days,cad)=>{
      TaskCentre.tasks.unshift({id,state:"open",reminders:0,icon:type==="reminder"?"⏰":"📈",escalationTarget:null,type,owner,entity:title,wf,due,dueDays:days,cadence:cad,title,meta});
      TaskCentre.emailLog.unshift({when:"2026-07-29 07:30",to:owner,subj:"["+wf+"] "+title,opened:false});
    };
    add("TF1","buyer","reminder","Forecast review — "+v0.name+": "+U.cr(v0.spendAtRisk)+" at risk over "+v0.parts+" parts","Forecast • vendor negotiation prep","FCT-2026-0001","Due in 3d",3,"Monthly");
    add("TF2","finance","reminder","Review forecast cost at risk per vehicle — "+U.cr(rc.totalSpendAtRisk)+" ("+rc.partsAtRisk+" parts above +5%)","Forecast • Finance","FCT-2026-0002","Due in 5d",5,"Monthly");
    add("TF3","pm","reminder","Check biggest forecast riser — "+m0.name+" ("+m0.progCode+") "+U.sgn(m0.chgH),"Forecast • project cost","FCT-2026-0003","Due in 4d",4,"Weekly");
    Notif.updateBadge();
  },
  onHitl(a,st){
    const t = TaskCentre.tasks.find(x=>x.alertId===a.alertId && x.state==="open");
    if(t){ TaskCentre.markDone(t.id); }
    if(st==="confirmed"){
      const im=a.impact||{};
      TaskCentre.tasks.unshift({id:"TG"+pad(TaskCentre.tasks.length+1,3), state:"open", reminders:0, icon:"📈", escalationTarget:null, type:"reminder", owner:"buyer", entity:a.headline,
        wf:"GEO-FUP-"+pad(TaskCentre.tasks.length+1,3), due:"Due in 5d", dueDays:5, cadence:"On event",
        title:"Follow up confirmed alert — "+a.headline+(im.available?" ("+U.sgn(im.overallPriceChangePct,2)+" est.)":""), meta:"Geo risk • confirmed by "+((DATA.users.find(x=>x.role===RBAC.role)||{}).name||"analyst")});
      TaskCentre.emailLog.unshift({when:new Date().toISOString().slice(0,16).replace("T"," "),to:"buyer",subj:"[GEO] Confirmed alert — "+a.headline,opened:false});
    }
    Notif.updateBadge();
  },
};
window.PocWork = PocWork;
PocWork.seed();

/* ---------------------------------------------------------------- Home: forecast block under the KPI row */
function homeBlock(){
  const k=P.kpis(), rc=P.riskConcentration(5), top=P.ALERTS.slice(0,5), pend=PocHitl.pending();
  const d=document.createElement("div"); d.className="fc-cols fc-home"; d.style.marginTop="16px";
  d.innerHTML=
   U.panel("Price outlook",`<div class="fc-mini3"><div><span>Cost per vehicle</span><b>${U.cr(k.basket.value)}</b><small>${U.sgn(k.basket.change,2)} MoM</small></div><div><span>Forecast ${esc(k.forecast.to)}</span><b>${U.cr(k.forecast.value)}</b><small>${U.sgn(k.forecast.change,2)}</small></div><div><span>Cost at risk (&gt;5%)</span><b>${U.cr(k.atrisk.value)}</b><small>${k.atrisk.parts} parts</small></div></div>
      <div class="fc-alerts" style="margin-top:12px">${top.map(a=>`<div class="fc-alert" data-act="part:${esc(a.partId)}" role="button" tabindex="0"><span class="sevbar ${a.severity}"></span><div><b>${esc(a.part?a.part.name:a.partId)}</b><small>${esc(a.part?a.part.progName+" · "+a.part.vendorName:a.title)}</small></div><div class="r">${U.dirChip(a.change)}</div></div>`).join("")}</div>`,
      {right:`<button class="btn btn-sm" data-act="go:fc-outlook">Open forecast dashboard</button>`})+
   U.panel("Geopolitical alerts for review"+(pend.length?` <span class="count-pill">${pend.length}</span>`:""),
     pend.length? pend.slice(0,4).map(a=>`<div class="fb-row clk" data-act="go:fc-geo"><div class="fb-icon">🌍</div><div class="fb-body"><div class="fb-name">${esc(a.headline)}</div><div class="fb-meta">${esc(a.category)} · ${esc(a.regionScope)} · severity ${a.severity}/5</div></div><span class="chip chip-amber"><span class="chip-dot"></span>review</span></div>`).join("")+`<div class="mut small" style="margin-top:8px">Impact stays hidden until an analyst confirms — nothing is applied to forecasts automatically.</div>`
        : `<div class="table-empty">All alerts reviewed.</div>`,
     {right:`<button class="btn btn-sm btn-primary" data-act="go:fc-geo">Review alerts</button>`});
  U.wire(d); return d;
}
["procurement","techchange","srm","admin"].forEach(m=>{
  const orig=SCREENS[m].home;
  const wrapped=function(){ const w=orig(); try{ const k=w.querySelector(".grid.grid-4"); if(k) k.after(homeBlock()); }catch(e){ console.error("home forecast block",e); } return w; };
  SCREENS[m]["task-centre"]=wrapped;   // Home itself no longer carries the forecast block (price outlook + geopolitical alerts)
});

/* ---------------------------------------------------------------- Material Cost: pointer to the all-parts forecast */
(function(){
  const orig=SCREENS.procurement["material-cost-dash"]; if(!orig) return;
  SCREENS.procurement["material-cost-dash"]=function(){
    const w=orig(); const k=P.kpis(), wk=P.costWalk();
    const d=document.createElement("div"); d.style.marginTop="16px";
    d.innerHTML=U.panel("Forecast — all "+P.PARTS.length+" parts (POC model)",
      `<div class="fc-sum"><span>Cost per vehicle <b>${U.cr(k.basket.value)}</b></span><span>Forecast ${esc(k.forecast.to)} <b>${U.cr(k.forecast.value)}</b> ${U.dirChip(k.forecast.change,2)}</span><span>Cost at risk <b>${U.cr(k.atrisk.value)}</b></span><span>Budget → current <b>${U.sgn((wk.sop/wk.bg-1)*100)}</b></span></div>
       <div class="mut small">The cost breakdowns above cover the parts with a built-up CBD. The Material Cost Forecast screen covers every part in the POC panel, with the same budget → current → forecast walk and drill-down.</div>
       <div class="fc-actions"><button class="btn btn-sm btn-primary" data-act="go:fc-material">Material cost forecast</button><button class="btn btn-sm" data-act="go:fc-hierarchy">Hierarchy drill-down</button><button class="btn btn-sm" data-act="go:fc-outlook">Forecast dashboard</button><button class="btn btn-sm" data-act="go:fc-impact">Cost impact</button></div>`);
    U.wire(d); w.appendChild(d); return w;
  };
})();

/* ---------------------------------------------------------------- Commodity & Forex: market + forecast exposure tab */
window.PocMarket = {
  build(){
    const m=P.macro, host=document.createElement("div");
    const series=[["EUR/INR","eurinr",true,"₹ per EUR","ECB reference (real)"],["USD/INR","usdinr",true,"₹ per USD","ECB reference (real)"],
      ["Steel","steel",false,"USD/t","POC offline fallback (synthetic)"],["Aluminium","aluminium",false,"USD/t","POC offline fallback (synthetic)"],
      ["Copper","copper",false,"USD/t","POC offline fallback (synthetic)"],["Energy / crude","energy",false,"USD/bbl","POC offline fallback (synthetic)"],
      ["Container freight","freight",false,"index","POC offline fallback (synthetic)"],["Geopolitical risk","gpr",true,"index","GPR index (real)"]];
    const cards=series.filter(s=>m[s[1]]).map(s=>{
      const v=m[s[1]], last=v[v.length-1], first=v[0], ch=(last/first-1)*100;
      return `<div class="panel"><div class="panel-header"><h3>${s[0]}</h3><span class="chip ${s[2]?"chip-green":"chip-amber"}">${s[2]?"real":"synthetic"}</span></div><div class="panel-body"><div class="fc-sum"><span><b>${nf(last,last>1000?0:2)}</b> ${s[3]}</span><span>${U.dirChip(ch)} since ${esc(U.ml(P.MONTHS[0]))}</span></div>${C.line({labels:P.MONTHS.map(U.ml),height:130,mLeft:44,maxX:5,legend:false,hover:true,yFmt:x=>nf(x,x>1000?0:1),series:[{name:s[0],data:v,color:s[2]?C.C.brand:C.C.amber,area:true}]})}<div class="mut small">${esc(s[4])}</div></div></div>`; }).join("");
    const ex=["steel","aluminium","copper","plastics","electronics"].map(d=>P.exposure(d)).filter(Boolean);
    host.innerHTML=U.note("Market series used by the forecasting POC. FX and the geopolitical-risk index are real; steel, aluminium, copper, energy and freight are the POC's offline fallbacks (synthetic) — treat them as illustrative until a live feed is connected.","info")+
      `<div class="fc-cols3" style="margin-top:16px">${cards}</div>`+
      U.panel("Forecast exposure by commodity driver",`<table class="mtable fc-table"><thead><tr><th>Driver</th><th>Verticals affected (assumed mapping)</th><th class="r">Parts</th><th class="r">Spend now</th><th class="r">Forecast move</th><th>Top rising parts</th></tr></thead><tbody>${ex.map(e=>`<tr><td><b>${esc(e.driver)}</b><small class="mut">${esc(e.note)}</small></td><td>${e.categories.map(esc).join(", ")}</td><td class="r">${e.parts}</td><td class="r">${U.cr(e.currentSpend)}</td><td class="r">${U.dirChip(e.changePct)}</td><td>${e.top.slice(0,3).map(p=>`<a href="#" data-act="part:${esc(p.id)}">${esc(p.name)}</a> ${U.sgn(p.chgH)}`).join("<br>")}</td></tr>`).join("")}</tbody></table>`,{noPad:true,style:"margin-top:16px"})+
      `<div class="fc-actions" style="margin-top:14px"><button class="btn btn-sm btn-primary" data-act="go:fc-impact">What-if: FX &amp; commodity</button><button class="btn btn-sm" data-act="go:fc-fx">FX impact</button><button class="btn btn-sm" data-act="go:fc-geo">Geo risk</button></div><div class="mut small" style="margin-top:8px">The vertical mapping is an editable assumption shipped with the POC, not derived from a bill of materials.</div>`;
    U.wire(host); return host;
  }
};

/* ---------------------------------------------------------------- global search: all 480 parts, clickable results */
Search.onInput = function(v){
  const box=document.getElementById("search-results");
  if(!v || v.trim().length<1){ box.classList.remove("show"); return; }
  const q=v.toLowerCase().trim();
  const parts=DATA.parts.filter(p=>p.designation.toLowerCase().includes(q)||p.number.toLowerCase().includes(q)||p.supplier.toLowerCase().includes(q));
  const groups=[
    {label:"Parts ("+parts.length+")", rows:parts.slice(0,5).map(p=>({t:p.designation, s:p.project+" • "+p.number+" • "+p.supplier, a:"part:"+p.number}))},
    {label:"Suppliers", rows:DATA.suppliers.filter(s=>s.name.toLowerCase().includes(q)).slice(0,4).map(s=>({t:s.name, s:"DUNS "+s.duns+" • "+s.origin, a:"filter:vendor="+s.name}))},
    {label:"Technical Changes", rows:DATA.changes.filter(c=>c.part.toLowerCase().includes(q)||c.wf.toLowerCase().includes(q)).slice(0,4).map(c=>({t:c.wf, s:c.part+" • "+c.status, a:"go:approvals"}))},
    {label:"SRM Milestones", rows:DATA.milestones.filter(m=>m.name.toLowerCase().includes(q)||m.project.toLowerCase().includes(q)).slice(0,4).map(m=>({t:m.name, s:m.project+" • plan "+m.planDate, a:"go:milestone-tracking"}))},
    {label:"Geopolitical alerts", rows:PocHitl.alerts().filter(a=>a.headline.toLowerCase().includes(q)||a.category.includes(q)||a.regionScope.toLowerCase().includes(q)).slice(0,3).map(a=>({t:a.headline, s:a.category+" • "+a.regionScope, a:"go:fc-geo"}))},
  ].filter(g=>g.rows.length);
  if(!groups.length) box.innerHTML=`<div class="table-empty">No matches. Press Enter to ask AIS.</div>`;
  else box.innerHTML=groups.map(g=>`<div class="grp">${g.label}</div>`+g.rows.map(r=>`<div class="res-row" data-act="${esc(r.a)}" role="button" tabindex="0"><span class="t">${esc(r.t)}</span><span class="s">${esc(r.s)}</span></div>`).join("")).join("");
  box.onclick=e=>{ const r=e.target.closest("[data-act]"); if(r){ box.classList.remove("show"); const a=r.dataset.act; if(a.startsWith("go:")){ const id=a.slice(3); const mod=SCREENS[Router.module][id]?Router.module:(["milestone-tracking"].includes(id)?"srm":"procurement"); Router.go(id,mod); } else U.act(a,r); } };
  box.classList.add("show");
};

/* ---------------------------------------------------------------- the task list: GEO tasks open the Geo risk screen */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-open^='GEO-']"); if(b){ e.stopPropagation(); Router.go("fc-geo","procurement"); }
},true);

/* ---------------------------------------------------------------- wide part drawer: class is removed whenever any other drawer opens or closes */
(function(){
  const o=Drawer.open.bind(Drawer), c=Drawer.close.bind(Drawer);
  Drawer.open=function(){ const d=document.getElementById("drawer"); if(d) d.classList.remove("fcwide"); return o.apply(Drawer,arguments); };
  Drawer.close=function(){ const d=document.getElementById("drawer"); if(d) d.classList.remove("fcwide"); return c.apply(Drawer,arguments); };
})();

/* ---------------------------------------------------------------- Admin → AI Model Settings: model toggle + Radar server */
(function(){
  function build(){
    const w=document.createElement("div"), cfg=RadarCfg.get();
    w.appendChild(Components.pageHeader("AI Model Settings","Where Ask AIS answers come from: the private SAVWIPL model or a vendor model, and the optional Radar server that adds LLM answers and live news. Without a server, Radar answers offline from the embedded forecast data."));
    const vend=window.__aiVendor||"SAVWIPL model";
    const p1=U.el(`<div class="panel"><div class="panel-header"><h3>Active model</h3></div><div class="panel-body"><div class="fb-row"><div class="fb-icon">🤖</div><div class="fb-body"><div class="fb-name">Active model</div><div class="fb-meta" id="ai-active">${vend==="Vendor model"?"External vendor model (API, egress enabled)":"Private SAVWIPL model (on-prem)"}</div></div></div><div style="display:flex;gap:8px;margin-top:8px;"><button class="btn ai-t" data-m="SAVWIPL model">Use SAVWIPL model</button><button class="btn ai-t" data-m="Vendor model">Use vendor model</button></div><div class="text-muted" style="font-size:12px;margin-top:10px;">Governs where RFQ queries are answered; the SAVWIPL model keeps data on-prem, a vendor model adds capability at the cost of egress.</div></div></div>`);
    p1.querySelectorAll(".ai-t").forEach(b=>b.onclick=()=>{ window.__aiVendor=b.dataset.m; p1.querySelector("#ai-active").textContent=b.dataset.m==="Vendor model"?"External vendor model (API, egress enabled)":"Private SAVWIPL model (on-prem)"; Store.audit("AI settings","model switched",b.dataset.m); Toast.show("AI model set to: "+b.dataset.m,"info"); });
    w.appendChild(p1);
    const p2=U.el(`<div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Radar (Ask AIS) <span id="rd-st" class="chip ${RadarCfg.server()?"chip-green":"chip-gray"}"><span class="chip-dot"></span>${RadarCfg.server()?"server connected":"offline engine"}</span></h3></div><div class="panel-body">
      <div class="fc-ctrls"><label>Mode<select id="rd-mode"><option value="auto" ${cfg.mode!=="offline"?"selected":""}>Auto — use the server when a URL is set, else offline</option><option value="offline" ${cfg.mode==="offline"?"selected":""}>Offline only — never leave this page</option></select></label>
      <label>Radar server URL<input type="text" id="rd-url" placeholder="https://your-radar.example.com   or   http://localhost:8787" value="${esc(cfg.url||"")}" style="height:36px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:13px"></label>
      <label>Live news<select id="rd-web"><option value="1" ${cfg.web?"selected":""}>Allow web search (server decides when)</option><option value="0" ${cfg.web?"":"selected"}>Dashboard data only</option></select></label></div>
      <div class="fc-actions"><button class="btn btn-primary btn-sm" id="rd-save">Save</button><button class="btn btn-sm" id="rd-test">Test connection</button><span class="small mut" id="rd-msg"></span></div>
      <div class="small mut" style="margin-top:12px">The server is the forecasting POC's chat API (<code>/api/chat</code>). The OpenAI key is read there from its own environment and is <b>never</b> sent to or stored in this page — only the server URL is saved, in this browser. The page must be allowed to call the server (CORS): run <code>node E7_build/radar_cors_proxy.mjs</code> next to the POC's <code>npm run dev</code>, or deploy the POC to Vercel with CORS enabled for this origin.</div></div></div>`);
    const q=s=>p2.querySelector(s), msg=m=>{ q("#rd-msg").textContent=m; };
    q("#rd-save").onclick=()=>{ RadarCfg.set({mode:q("#rd-mode").value,url:q("#rd-url").value.trim(),web:q("#rd-web").value==="1"}); Store.audit("AI settings","Radar server settings saved",RadarCfg.get().url||"offline"); Toast.show("Radar settings saved.","success"); Router.render(); };
    q("#rd-test").onclick=async()=>{
      const u=q("#rd-url").value.trim().replace(/\/+$/,""); if(!/^https?:\/\//i.test(u)) return msg("Enter an http(s) URL first.");
      msg("Testing…"); const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),8000);
      try{ const r=await fetch(u+"/api/hitl-status",{signal:ctl.signal}); const j=await r.json().catch(()=>({})); msg(r.ok?"Reachable ✓ — Radar server responded ("+Object.keys(j.statuses||{}).length+" alert statuses stored).":"Server answered HTTP "+r.status+(j.error?" — "+j.error:"")+"."); }
      catch(e){ msg("Could not reach it — "+(e.name==="AbortError"?"timed out":"network or CORS blocked")+". See the note below."); } finally{ clearTimeout(to); } };
    w.appendChild(p2);
    w.appendChild(U.el(`<div class="panel" style="margin-top:16px"><div class="panel-header"><h3>What the offline engine can do</h3></div><div class="panel-body"><div class="small">The same tools the POC's Radar calls, run in this page on the embedded data: part search and price prediction, top movers, KPIs, vertical / vendor / project rollups, spend-at-risk, FX and geopolitical scenarios, event studies, model validation, data provenance, exposure by commodity, and confirm / dismiss of geopolitical alerts — plus the platform's own records: price versions, cost breakdowns, approvals, tasks, POs, tooling and benchmarks. What it cannot do offline: read live news or write free-form analysis — that needs the server.</div></div></div>`));
    return w;
  }
  SCREENS.admin["ai-model-settings"]=build;
})();

/* ---------------------------------------------------------------- boot */
Notif.updateBadge();
Router.render();
})();
