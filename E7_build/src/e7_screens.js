/* =====================================================================
   E7  ·  PocUI core — helpers, state, generic actions, part drawer,
   Parts and Alerts screens.  Views live in e7_views_*.js and register
   themselves on PocUI.v.   Everything mirrors the forecasting POC's
   dashboard views (same data, same charts), restyled for the prototype.
   ===================================================================== */
const PocUI = (function(){
"use strict";
const P = PocCore, C = PocCharts, nf = C.nf, esc = C.esc, R = P.RAW;
const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ml = m=>MON3[+m.slice(5,7)-1]+" "+m.slice(2,4);
const mlong = m=>MON3[+m.slice(5,7)-1]+" "+m.slice(0,4);
/* number formats = the POC's lib/format.ts */
const spend = (v,signed)=>{ if(v==null||isNaN(v)) return "--"; const sg=signed?(v>0?"+":v<0?"−":""):"", a=Math.abs(v);
  if(a>=1e7){ const c=a/1e7; return sg+"₹"+(c>=100?Math.round(c).toLocaleString("en-IN"):c.toFixed(c>=10?1:2))+" Cr"; }
  if(a>=1e5){ const l=a/1e5; return sg+"₹"+l.toFixed(l>=100?0:1)+" L"; }
  return sg+"₹"+Math.round(a).toLocaleString("en-IN"); };
const cr = spend;
const cur = (v,compact)=> v==null||isNaN(v)?"--":(compact===false? "₹"+nf(v,2) : spend(v));
const inr = (v,d=0)=>"₹"+nf(v,d);
const axisCur = (v,max)=> max>=1e7?"₹"+(v/1e7).toFixed(1)+" Cr": max>=1e5?"₹"+(v/1e5).toFixed(1)+" L": (max>=1000&&max<1e5)?"₹"+(v/1000).toFixed(1)+"K":"₹"+Math.round(v);
const sgn = (v,d=1)=> v==null||isNaN(v)?"--":(v>=0?"+":"−")+Math.abs(v).toFixed(d)+"%";
const dirChip = (v,d=1)=>`<span class="chip ${Math.abs(v)<0.05?"chip-gray":v>0?"chip-red":"chip-green"}"><span class="chip-dot"></span>${sgn(v,d)}</span>`;
const arrow = (up)=>`<svg class="arr" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${up?"M12 19V5M6 11l6-6 6 6":"M12 5v14M6 13l6 6 6-6"}"/></svg>`;
const varCell = (v,d=2)=>`<span class="var ${v>=0?"up":"dn"}">${arrow(v>=0)}${Math.abs(v).toFixed(d)}%</span>`;
const sevDots = n=>`<span class="sev" title="Severity ${n} of 5">${[1,2,3,4,5].map(i=>`<i class="${i<=n?"on s"+n:""}"></i>`).join("")}</span>`;
const pill = (t,tone)=>`<span class="pill ${tone||""}">${t}</span>`;
const IC = {"🧺":"package","📈":"trend-up","🎯":"target","⚠️":"alert","🧪":"activity","💸":"coins","⚖️":"scale","📐":"gauge","💱":"swap","📊":"bar-chart","🙈":"shield","〰️":"activity","📏":"gauge","🔁":"refresh","🧩":"puzzle","🔌":"database","🛣️":"flag","🏆":"target","📉":"trend-down","🔩":"wrench","✅":"check-circle"};
const kicon = i=>IC[i]?Icons.svg(IC[i]):(i||"");
const panel = (title,body,o)=>{ o=o||{}; return `<div class="panel ${o.cls||""}" ${o.id?`id="${o.id}"`:""} style="${o.style||""}"><div class="panel-header"><div class="ph-t"><h3>${title}</h3>${o.sub?`<div class="ph-s">${o.sub}</div>`:""}</div>${o.right||""}</div><div class="panel-body ${o.noPad?"no-pad":""}">${body}</div></div>`; };
const kpi = (label,value,sub,o)=>{ o=o||{}; return `<div class="kpi-card ${o.act?"kpi-link":""}" ${o.act?`data-act="${o.act}" role="button" tabindex="0"`:""} ${o.tip?`title="${esc(o.tip)}"`:""}><div class="kpi-label">${label}<span class="kpi-icon">${kicon(o.icon)}</span></div><div class="kpi-value" style="${o.valStyle||""}">${value}</div><div class="kpi-trend ${o.tone||""}" ${o.tone?"":'style="color:var(--muted)"'}>${sub||""}</div>${o.note?`<div class="kpi-note">${o.note}</div>`:""}</div>`; };
const note = (html,kind)=>`<div class="fc-note ${kind||""}">${html}</div>`;
const seg = (items,cur,act)=>`<div class="fc-segs tight">${items.map(([id,l])=>`<button type="button" class="fc-seg ${cur===id?"on":""}" data-act="${act.replace("%v",esc(id))}">${l}</button>`).join("")}</div>`;
const metric = (label,value,tone)=>`<div class="mt"><div class="mt-l">${label}</div><div class="mt-v ${tone||""}">${value}</div></div>`;

/* ------------ state (survives re-renders) ------------ */
const state = {
  parts:{q:"",prog:"",vendor:"",cat:"",dir:"",sort:"chgH",page:0},
  impact:{car:"all",material:"Copper",currency:"both",fxPct:5,commodityPct:10,share:55,openCat:null},
  fx:{level:"category"}, geo:{family:"all",level:"category",study:null},
  dash:{view:"focus",dim:"vendor"}, range:{start:null,end:null},
  material:{project:"all",vendor:"all",category:"all",material:"all",q:"",walk:"bg_to_fc",bridge:null,limit:12,track:"full"},
  hier:{order:["project","vendor","category","part","material"],open:new Set(),minConf:"all",level:"project"},
  model:{tab:"cmp"}, data:{tab:"src"}, faq:{tag:"All",open:new Set([0])}, val:{},
};
function setPath(path,val){ const [ns,k]=path.split("."); const o=state[ns]; if(o) o[k]=val; }
function parseVal(s){ if(s==="null") return null; if(s==="true") return true; if(s==="false") return false; if(s!==""&&!isNaN(+s)&&/^-?\d+(\.\d+)?$/.test(s)) return +s; return s; }

/* ------------ plumbing ------------ */
function el(html){ const d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstElementChild; }
const actions = {};      // name -> fn(value,node)
function act(a,node){ const i=a.indexOf(":"), k=i<0?a:a.slice(0,i), v=i<0?"":a.slice(i+1); const f=actions[k]; if(f) f(v,node); }
function wire(root){
  if(root.__wired) return; root.__wired=true;
  root.addEventListener("click",e=>{ const a=e.target.closest("[data-act]"); if(a&&root.contains(a)){ if(a.tagName==="A") e.preventDefault(); act(a.dataset.act,a); } });
  root.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-act][role=button]")){ e.preventDefault(); act(e.target.dataset.act,e.target); } });
  root.addEventListener("change",e=>{ const n=e.target.closest("[data-set]"); if(n&&n.tagName!=="INPUT"||(n&&/range|checkbox|number/.test(n.type))){ setPath(n.dataset.set,n.type==="checkbox"?n.checked:parseVal(n.value)); if(n.dataset.reset) n.dataset.reset.split(",").forEach(r=>{ const [p,val]=r.split("="); setPath(p,parseVal(val)); }); Router.render(); } });
  root.addEventListener("input",e=>{ const n=e.target.closest("[data-set]"); if(n&&/text|search/.test(n.type)){ setPath(n.dataset.set,n.value); if(n.dataset.reset) n.dataset.reset.split(",").forEach(r=>{ const [p,val]=r.split("="); setPath(p,parseVal(val)); });
      clearTimeout(wire._t); wire._t=setTimeout(()=>{ const pos=n.selectionStart; Router.render(); const nn=document.querySelector(`[data-set="${n.dataset.set}"]`); if(nn){ nn.focus(); try{ nn.setSelectionRange(pos,pos); }catch(_){} } },180); } });
}
function go(screen,mod){ Router.go(screen,mod||"procurement"); }
Object.assign(actions,{
  go:v=>{ go(v); }, goadmin:v=>{ go(v,"admin"); },
  part:v=>openPart(v),
  filter:v=>{ const [f,val]=v.split("="); Object.assign(state.parts,{q:"",prog:"",vendor:"",cat:"",dir:"",page:0}); state.parts[f]=val; go("fc-parts"); },
  ask:v=>{ Radar.open(v); },
  set:v=>{ const [p,val]=v.split("="); setPath(p,parseVal(val)); Router.render(); },
  hitl:v=>{ const [id,st]=v.split("|"); PocHitl.set(id,st); },
  mat:v=>{ const [w,b]=v.split("|"); Object.assign(state.material,{walk:w,bridge:b||null,limit:12}); go("fc-material"); },
});
function table(head,rowsHtml,cls){ return `<table class="mtable fc-table ${cls||""}"><thead><tr>${head.map(h=>typeof h==="string"?`<th>${h}</th>`:`<th class="${h.r?"r":""}">${h.t}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>`; }
function downloadCsv(name,head,rows){
  const q=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v;
  const txt=[head.join(",")].concat(rows.map(r=>r.map(q).join(","))).join("\n");
  try{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv"})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); Toast.show("Downloaded "+name+" ("+rows.length+" rows).","success"); }
  catch(e){ Toast.show("Download not available in this browser context.","warn"); }
}
function downloadJson(name,obj){ try{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,1)],{type:"application/json"})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); Toast.show("Downloaded "+name,"success"); }catch(e){ Toast.show("Download not available in this browser context.","warn"); } }
const header = (t,s)=>Components.pageHeader(t,s);
const tabBar = (tabs,curId,onPick)=>{ const d=document.createElement("div"); d.className="fc-tabs"; tabs.forEach(t=>{ const b=document.createElement("button"); b.type="button"; b.className="fc-tab"+(t.id===curId?" on":""); b.innerHTML=t.label; b.onclick=()=>onPick(t.id); d.appendChild(b); }); return d; };

/* ------------ date range (POC DateRangeControl) ------------ */
const ALLM = P.MONTHS.concat(P.FM);
function rangeOf(){ return {start:state.range.start||ALLM[0], end:state.range.end||ALLM[ALLM.length-1]}; }
const inRange = m=>{ const r=rangeOf(); return m>=r.start&&m<=r.end; };
function rangeControl(){
  const r=rangeOf(), opt=(cur)=>ALLM.map(m=>`<option value="${m}" ${m===cur?"selected":""}>${mlong(m)}</option>`).join("");
  const full=(r.start===ALLM[0]&&r.end===ALLM[ALLM.length-1]);
  return `<div class="fc-range" title="Limit the charts to a window of months"><svg class="i" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
    <select data-set="range.start" aria-label="From">${opt(r.start)}</select><span>–</span><select data-set="range.end" aria-label="To">${opt(r.end)}</select>${full?"":`<button type="button" class="btn btn-sm btn-ghost" data-act="set:range.start=null" onclick="PocUI.state.range.end=null">Reset</button>`}</div>`;
}
function toolbar(){
  return `<div class="fc-toolbar">${rangeControl()}<span class="fc-chipbox">${P.PARTS.length} parts</span>
    <button type="button" class="btn btn-sm" data-act="params:open">${Icons.svg("layers")} Parameters <span class="count-pill">${R.parameterCatalogue.total}</span></button>
    <button type="button" class="btn btn-sm" data-act="export:all">${Icons.svg("download")} Export</button></div>`;
}
actions.export=()=>{
  downloadCsv("forecast_all_parts.csv",["part_id","part","programme","vendor","category","material","current_price","forecast_price","lower","upper","change_pct","next_month_pct","confidence"],
    P.PARTS.map(p=>[p.id,p.name,p.progName,p.vendorName,p.category,p.material,p.cur,p.fcEnd,p.loEnd,p.hiEnd,p.chgH.toFixed(3),p.chg1.toFixed(3),p.conf.level]));
};

/* ------------ forecasting-parameters modal (POC ParametersModal) ------------ */
actions.params=()=>{
  const cat=R.parameterCatalogue, st={group:"All",status:"all",open:new Set(),groups:new Set()};
  const DOT={implemented:"var(--ok)",available:"var(--info)",roadmap:"var(--faint)"}, LBL={implemented:"Live",available:"Available",roadmap:"Roadmap"};
  const bk=document.createElement("div"); bk.className="fc-modal-bk"; document.body.appendChild(bk);
  const close=()=>{ bk.remove(); document.removeEventListener("keydown",esck); };
  const esck=e=>{ if(e.key==="Escape") close(); }; document.addEventListener("keydown",esck);
  bk.onclick=e=>{ if(e.target===bk) close(); };
  const draw=()=>{
    const vis=cat.drivers.filter(d=>(st.group==="All"||d.group===st.group)&&(st.status==="all"||d.status===st.status));
    const map=new Map(); vis.forEach(d=>{ if(!map.has(d.group)) map.set(d.group,[]); map.get(d.group).push(d); });
    bk.innerHTML=`<div class="fc-modal" role="dialog" aria-modal="true" aria-label="Forecasting parameters"><div class="fm-h"><h2>${Icons.svg("layers")} Forecasting Parameters</h2><button class="drawer-close" data-c="1" aria-label="Close">✕</button></div>
      <p class="small mut" style="padding:0 20px"><b>${cat.total} drivers</b> catalogued. Monthly relevance gate keeps <b style="color:var(--ok)">${(cat.selection&&cat.selection.nSelected)||cat.counts.implemented} in this month's model</b>${cat.selection&&cat.selection.nRejected?` (rejected ${cat.selection.nRejected} engineered columns)`:""}. The rest define the extension path.</p>
      <div class="fm-f"><select data-g="1"><option value="All">All groups</option>${cat.groups.map(g=>`<option ${st.group===g?"selected":""}>${esc(g)}</option>`).join("")}</select>
        ${[["all","All"],["implemented","Live "+cat.counts.implemented],["available","Available "+cat.counts.available],["roadmap","Roadmap "+cat.counts.roadmap]].map(([id,l])=>`<button type="button" class="fc-seg ${st.status===id?"on":""}" data-s="${id}">${l}</button>`).join("")}</div>
      <div class="fm-b">${[...map.entries()].map(([g,ds])=>{ const o=st.groups.has(g); return `<div class="fm-g"><button type="button" class="fm-gh" data-gh="${esc(g)}"><span class="chev ${o?"o":""}">›</span><b>${esc(g)}</b><span class="count-pill">${ds.length}</span><span class="fm-dots">${ds.map(d=>`<i style="background:${DOT[d.status]}"></i>`).join("")}</span></button>${o?ds.map(d=>`<div class="fm-r"><button type="button" class="fm-rh" data-d="${esc(d.id)}"><i style="background:${DOT[d.status]}"></i><span>${esc(d.name)}</span><small class="e-${d.effort}">${esc(d.effort)}</small><span class="chip chip-gray">${LBL[d.status]}</span></button>${st.open.has(d.id)?`<div class="fm-d"><p>${esc(d.description)}</p><p><b>How it reaches price:</b> ${esc(d.impact_channel)}</p><p><b>Direction:</b> ${esc(d.direction)}</p>${d.example?`<p><b>Example:</b> ${esc(d.example)}</p>`:""}${d.sources?`<p class="mut"><b>Sources:</b> ${esc(Array.isArray(d.sources)?d.sources.join(", "):d.sources)}</p>`:""}</div>`:""}</div>`).join(""):""}</div>`; }).join("")||`<div class="table-empty">No drivers match.</div>`}</div>
      <div class="fm-n small mut">${esc(cat.note||"")}</div></div>`;
    bk.querySelector("[data-c]").onclick=close;
    bk.querySelector("[data-g]").onchange=e=>{ st.group=e.target.value; draw(); };
    bk.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{ st.status=b.dataset.s; draw(); });
    bk.querySelectorAll("[data-gh]").forEach(b=>b.onclick=()=>{ const g=b.dataset.gh; st.groups.has(g)?st.groups.delete(g):st.groups.add(g); draw(); });
    bk.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{ const d=b.dataset.d; st.open.has(d)?st.open.delete(d):st.open.add(d); draw(); });
  };
  draw();
};

/* ======================================================================
   PART DETAIL DRAWER  (POC Material-cost PartDetailDrawer + hierarchy "reason" + E6 workflow facts)
   ====================================================================== */
const DRV_ORDER = ["fx","commodity","freight","vendorReprice","mix","seasonality","unexplained"];
function openPart(id){
  const p=P.part(id); if(!p) return Toast.show("Part not found: "+id,"warn");
  const labels=P.MONTHS.map(ml).concat(P.FM.map(ml));
  const chart=C.line({labels, aria:"Price path for "+p.name, split:P.NH, height:240, mLeft:58,
    series:[{name:"History",data:p.h.concat(new Array(P.NF).fill(null)),color:C.C.anchor,area:true},{name:"Forecast",data:new Array(P.NH-1).fill(null).concat([p.cur]).concat(p.f),color:C.C.info,dash:"5 4",dots:(i)=>i>=P.NH}],
    band:{lo:new Array(P.NH).fill(null).concat(p.lo),hi:new Array(P.NH).fill(null).concat(p.hi),name:"Forecast interval",color:C.C.info}, yFmt:v=>axisCur(v,p.hiEnd*1.1)});
  const b2f=p.bridges?p.bridges.b2f:{}, drivers=DRV_ORDER.map(k=>({k,v:b2f[k]||0})).filter(d=>Math.abs(d.v)>0.005);
  const walkMini=(t,br)=>{ const s=DRV_ORDER.reduce((a,k)=>a+((br&&br[k])||0),0); return `<div><div class="mut small">${t}</div><div class="wm ${s>=0?"up":"dn"}">${s>=0?"+":""}${cur(s,false)}</div></div>`; };
  const bom=P.bomOf(p), mc=P.marketContext(p), rs=p.reason;
  const bomHtml=bom? table(["Material / process","Unit",{t:"Qty",r:1},{t:"Budget",r:1},{t:"Forecast",r:1},{t:"Δ",r:1}],bom.map(b=>`<tr><td>${esc(b.name)}${b.primary?' <span class="chip chip-blue">primary</span>':""}</td><td>${b.unit}</td><td class="r">${nf(b.quantity,b.unit==="kg"?3:0)}</td><td class="r">${inr(b.bg,2)}</td><td class="r">${inr(b.fc,2)}</td><td class="r">${dirChip((b.fc/b.bg-1)*100)}</td></tr>`).join("")):"<div class='mut'>No bill-of-materials template for this vertical.</div>";
  const cbd=DATA.cbds[p.id], vers=DATA.priceVersions[p.id], inv=DATA.investments[p.id], ekl=DATA.eklTargets.find(e=>e.part===p.name&&e.project===p.progCode), po=DATA.ebonPOs.find(x=>x.partNumber===p.id);
  const facts=[];
  if(cbd){ let c=0; try{ c=window.__cbdCost(cbd); }catch(e){} facts.push(`<div class="fc-fact"><span>Cost breakdown</span><b>${inr(c)}</b><small>${c>p.cur?"above":"below"} the ${inr(p.cur)} piece price by ${Math.abs((c/p.cur-1)*100).toFixed(1)}%</small></div>`); }
  if(vers) facts.push(`<div class="fc-fact"><span>Price versions</span><b>${vers.length}</b><small>latest ${inr(vers[vers.length-1].price)} (${esc(vers[vers.length-1].source)})</small></div>`);
  if(ekl){ const t=Store.currentValue(ekl); facts.push(`<div class="fc-fact"><span>EKL target</span><b>${inr(t)}</b><small>price ${((p.cur/t-1)*100).toFixed(1)}% vs target; forecast ${((p.fcEnd/t-1)*100).toFixed(1)}%</small></div>`); }
  if(inv) facts.push(`<div class="fc-fact"><span>Tooling</span><b>${esc(inv.status)}</b><small>${esc(inv.toolingRef)} · capex ${cr(inv.capex)}</small></div>`);
  if(po) facts.push(`<div class="fc-fact"><span>Purchase order</span><b>${esc(po.poNo)}</b><small>${esc(po.status)} · ${inr(po.price,2)} × ${nf(po.qty)}</small></div>`);
  const reasonHtml = rs? `<div class="fc-reason"><div class="mut small">Radar</div><p class="r1">${esc(rs.summary)}</p>${rs.tip?`<p class="r2">${esc(rs.tip)}</p>`:""}
      <div class="fc-meta"><span class="conf ${p.conf.level}" title="Predicted move is ${p.conf.ratio}x the model's typical ${p.conf.errPct}% error at this horizon">${Icons.svg("shield")} ${p.conf.level} confidence</span>${p.anomaly?`<span class="chip chip-red" title="Structural break">${esc(p.anomaly.replace(/_/g," "))}</span>`:""}</div>
      <details class="fc-more"><summary>Story &amp; drivers</summary><p class="small">${esc(rs.story)}</p><ul class="fc-list">${rs.drivers.map(d=>`<li><b>${esc(d.label)}</b> — ${d.direction==="up"?"pushing up":"pulling down"} <span class="chip ${d.isReal?"chip-blue":"chip-amber"}">${d.isReal?esc(d.source):"offline"}</span><div class="mut small">${esc(d.evidence)}</div></li>`).join("")}</ul><div class="mut small">${esc(rs.causalityNote)}</div></details>
      <button class="btn btn-sm" data-act="ask:Explain the forecast for ${esc(p.name)} (${esc(p.id)}) and what we should do about it.">Ask why</button></div>`:"";
  const body=`<div class="fc-drawer">
    ${reasonHtml}
    <div class="fc-meta" style="margin-top:14px"><span class="chip chip-gray">${esc(p.id)}</span><span class="chip chip-blue">${esc(p.progName)}</span><span class="chip chip-gray">${esc(p.vendorName)}${p.vendorOrigin==="international"?" · intl":""}</span><span class="chip chip-gray">${esc(p.category)}</span><span class="chip chip-gray">${esc(p.material)}</span><span class="chip chip-gray" title="No commercial file in the POC: budget / SOP are derived from the panel">Derived baseline</span></div>
    <div class="fc-trio3"><div><span>Nomination · ${ml(P.MONTHS[0])}</span><b>${cur(p.nom,false)}</b><small>${cur(p.nom,false)} piece price</small></div><div><span>SOP · ${ml(P.MONTHS[P.NH-1])}</span><b>${cur(p.cur,false)}</b><small>${cur(p.cur,false)} piece price</small></div><div><span>Forecast · ${ml(P.FM[P.NF-1])}</span><b>${cur(p.fcEnd,false)}</b><small>${cur(p.loEnd,false)} – ${cur(p.hiEnd,false)} interval</small></div></div>
    <div class="fc-meta"><span class="chip chip-gray">${p.qty} per vehicle</span><span class="chip ${p.chgH>=0?"chip-red":"chip-green"}">${sgn((p.fcEnd/p.nom-1)*100,2)} ${p.fcEnd-p.nom>=0?"+":""}${cur(p.fcEnd-p.nom,false)} vs budget</span><span class="chip ${p.chgH>=0?"chip-red":"chip-green"}">${sgn(p.chgH,2)} to forecast</span></div>
    <h4>Price path</h4>${chart}
    <h4>Price change <span class="mut small">nomination to forecast</span></h4>
    ${drivers.length?`<ul class="fc-drv">${drivers.map(d=>`<li><span>${P.BRIDGE_LABEL[d.k]}</span><b class="${d.v>=0?"up":"dn"}">${d.v>=0?"+":""}${cur(d.v,false)}</b></li>`).join("")}</ul>`:'<div class="mut small">No driver movement on this part.</div>'}
    ${p.bridges?`<div class="fc-two">${walkMini("Nomination to SOP",p.bridges.n2s)}${walkMini("SOP to forecast",p.bridges.s2f)}</div>`:""}
    ${p.mat?`<div class="mut small" style="margin-top:8px">Model attribution on the primary material (${esc(p.mat.name)}, hierarchy block): currency ${cur(p.mat.fx||0,false)}, commodity ${cur(p.mat.commodity||0,false)}, freight ${cur(p.mat.freight||0,false)}, other ${cur(p.mat.other||0,false)}.</div>`:""}
    ${facts.length?`<h4>In your workflows</h4><div class="fc-facts">${facts.join("")}</div><div class="fc-actions">${cbd?`<button class="btn btn-sm" onclick="Drawer.close();__openCbd('${p.id}')">Open cost breakdown</button>`:""}${vers&&actions.pprice?`<button class="btn btn-sm" onclick="Drawer.close();__openPrice('${p.id}')">Open price analysis</button>`:""}</div>`:""}
    <h4>What may be driving it</h4><div class="small">${esc(mc.part)}</div><ul class="fc-list">${mc.specific.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="mut small">Market context is qualitative (not model inputs).</div>
    <h4>Cost build-up <span class="chip chip-amber">illustrative sample</span></h4>${bomHtml}
    <div class="fc-actions"><button class="btn btn-primary btn-sm" data-act="ask:Why is ${esc(p.name)} (${esc(p.id)}) forecast to move ${sgn(p.chgH)}?">${Icons.svg("sparkles")} Ask AIS about this part</button><button class="btn btn-sm" data-act="filter:vendor=${esc(p.vendorName)}">More from ${esc(p.vendorName)}</button></div></div>`;
  Drawer.open(p.name,"",null);
  const b=document.getElementById("drawer-body"); b.innerHTML=body; wire(b);
  document.querySelector("#drawer .drawer-footer").style.display="none";
  document.getElementById("drawer").classList.add("fcwide");
  const t=document.getElementById("drawer-title"); if(t) t.textContent=p.name+" · "+p.progName;
}

/* ======================================================================
   PARTS (POC "Parts" view: every part ranked by forecast movement) with filters
   ====================================================================== */
const PAGE=20;
function filteredParts(){
  const s=state.parts; let a=P.search(s.q,{category:s.cat,vendor:s.vendor,project:s.prog});
  if(s.dir==="up") a=a.filter(p=>p.chgH>0.5); else if(s.dir==="down") a=a.filter(p=>p.chgH<-0.5); else if(s.dir==="risk") a=a.filter(p=>p.chgH>5);
  else if(s.dir==="high") a=a.filter(p=>p.conf.level==="high");
  const key={chgH:p=>-Math.abs(p.chgH),chgHup:p=>-p.chgH,chgHdown:p=>p.chgH,price:p=>-p.cur,name:p=>p.name}[s.sort]||(p=>-Math.abs(p.chgH));
  return a.slice().sort((x,y)=>{ const kx=key(x), ky=key(y); return typeof kx==="string"? kx.localeCompare(ky) : kx-ky; });
}
function sparkFor(p){ return C.spark(p.h.slice(-12).concat(p.f),{color:p.chgH>=0?C.C.red:C.C.ok}); }
function partCell(p){ return `<a href="#" class="plink" data-act="part:${esc(p.id)}"><b>${esc(p.name)}</b></a>${p.anomaly?` <span class="chip chip-red" title="Structural break: ${esc(p.anomaly.replace(/_/g," "))}">break</span>`:""}`; }
function vendorCell(p){ return `${esc(p.vendorName)}${p.vendorOrigin==="international"?' <span class="chip chip-blue" title="International supplier — higher direct FX exposure">intl</span>':""}`; }
function partRow(p){ return `<tr class="clk" data-act="part:${esc(p.id)}"><td data-label="Part">${partCell(p)}</td><td data-label="Part No." class="mono">${esc(p.id)}</td><td data-label="Project">${esc(p.progName)}</td><td data-label="Vendor">${vendorCell(p)}</td><td data-label="Vertical">${esc(p.category)}</td><td class="r" data-label="Current">${cur(p.cur,false)}</td><td class="r" data-label="Forecast"><b>${cur(p.fcEnd,false)}</b><small class="mut">${cur(p.loEnd,false)}–${cur(p.hiEnd,false)}</small></td><td class="r" data-label="Change">${varCell(p.chgH,2)}</td><td data-label="Confidence"><span class="conf ${p.conf.level}" title="Signal-to-error ${p.conf.ratio}x">${p.conf.level}</span></td><td data-label="Trend">${sparkFor(p)}</td></tr>`; }
const PARTS_HEAD=["Part","Part No.","Project","Vendor","Vertical",{t:"Current",r:1},{t:"Forecast",r:1},{t:"Change",r:1},"Confidence","Trend"];

function buildParts(){
  const wrap=document.createElement("div");
  wrap.appendChild(header("Parts","Every part ranked by forecast price movement — search all "+P.PARTS.length+" parts, filter by project, vendor or vertical, and click a row for the price path, cost walk and drivers."));
  const s=state.parts;
  const opt=(arr,cur,all)=>`<option value="">${all}</option>`+arr.map(a=>`<option ${a===cur?"selected":""}>${esc(a)}</option>`).join("");
  const bar=el(`<div class="panel"><div class="table-toolbar fc-filters">
    <input type="text" id="fp-q" placeholder="Search part, id or vendor…" value="${esc(s.q)}">
    <select id="fp-prog"><option value="">All projects</option>${P.PROGS.map(p=>`<option value="${p.code}" ${p.code===s.prog?"selected":""}>${esc(p.name)}</option>`).join("")}</select>
    <select id="fp-vendor">${opt(P.VENDS.map(v=>v.name).sort(),s.vendor,"All vendors")}</select>
    <select id="fp-cat">${opt(P.CATS.map(c=>c.name).sort(),s.cat,"All verticals")}</select>
    <select id="fp-dir"><option value="">Any direction</option><option value="up" ${s.dir==="up"?"selected":""}>Rising</option><option value="risk" ${s.dir==="risk"?"selected":""}>Rising >5%</option><option value="down" ${s.dir==="down"?"selected":""}>Easing</option><option value="high" ${s.dir==="high"?"selected":""}>High confidence</option></select>
    <select id="fp-sort"><option value="chgH" ${s.sort==="chgH"?"selected":""}>Largest move first</option><option value="chgHup" ${s.sort==="chgHup"?"selected":""}>Biggest rise first</option><option value="chgHdown" ${s.sort==="chgHdown"?"selected":""}>Biggest fall first</option><option value="price" ${s.sort==="price"?"selected":""}>Highest price</option><option value="name" ${s.sort==="name"?"selected":""}>Name A–Z</option></select>
    <button class="btn btn-sm" id="fp-reset">Reset</button><button class="btn btn-sm" id="fp-csv" title="Download the filtered list">⬇ CSV</button></div><div id="fp-out"></div></div>`);
  wrap.appendChild(bar);
  const out=bar.querySelector("#fp-out");
  const draw=()=>{
    const list=filteredParts(), pages=Math.max(1,Math.ceil(list.length/PAGE)); if(s.page>=pages) s.page=pages-1;
    const rows=list.slice(s.page*PAGE,(s.page+1)*PAGE), sp=P.cost(list,p=>p.cur), fs=P.cost(list,p=>p.fcEnd);
    out.innerHTML=`<div class="fc-sum"><span><b>${list.length}</b> parts</span><span>Cost per vehicle now <b>${cr(sp)}</b></span><span>Forecast <b>${cr(fs)}</b></span><span>${sp?dirChip((fs/sp-1)*100):""}</span><span class="mut small">Ranked by absolute change over the forecast horizon · click a row for the price path</span></div>
      <div class="panel-body no-pad">${table(PARTS_HEAD,rows.map(partRow).join("")||`<tr><td colspan="10"><div class="table-empty">No parts match these filters.</div></td></tr>`)}</div>
      <div class="table-footer"><span>${list.length?(s.page*PAGE+1)+"–"+Math.min(list.length,(s.page+1)*PAGE):0} of ${list.length}</span><span><button class="btn btn-sm" id="fp-prev" ${s.page<=0?"disabled":""}>‹ Prev</button> Page ${s.page+1} of ${pages} <button class="btn btn-sm" id="fp-next" ${s.page>=pages-1?"disabled":""}>Next ›</button></span></div>`;
    out.querySelector("#fp-prev").onclick=()=>{ s.page--; draw(); }; out.querySelector("#fp-next").onclick=()=>{ s.page++; draw(); };
  };
  const bind=(id,key)=>{ const n=bar.querySelector(id); n.addEventListener(n.tagName==="INPUT"?"input":"change",e=>{ s[key]=e.target.value; s.page=0; draw(); }); };
  bind("#fp-q","q"); bind("#fp-prog","prog"); bind("#fp-vendor","vendor"); bind("#fp-cat","cat"); bind("#fp-dir","dir"); bind("#fp-sort","sort");
  bar.querySelector("#fp-reset").onclick=()=>{ Object.assign(s,{q:"",prog:"",vendor:"",cat:"",dir:"",sort:"chgH",page:0}); Router.render(); };
  bar.querySelector("#fp-csv").onclick=()=>downloadCsv("parts_outlook.csv",["part_id","name","programme","vendor","category","current_price","forecast_price","lower","upper","change_pct","confidence"],
    filteredParts().map(p=>[p.id,p.name,p.progName,p.vendorName,p.category,p.cur,p.fcEnd,p.loEnd,p.hiEnd,p.chgH.toFixed(2),p.conf.level]));
  draw(); wire(wrap);
  return wrap;
}

/* ======================================================================
   ALERTS & NOTIFICATIONS  (POC AlertsStrip)
   ====================================================================== */
const SEVICON={high:"var(--red-soft);color:var(--red)",medium:"var(--amber-soft);color:var(--amber)",low:"var(--amber-soft);color:var(--amber)"};
const advice = ch=> ch==null?"Review":ch>=5?"Negotiate":ch>0?"Watch":"No action";
function alertCell(a){ const p=a.part; return `<div class="fc-ac" data-act="part:${esc(a.partId)}" role="button" tabindex="0"><span class="aci" style="background:${SEVICON[a.severity]||SEVICON.low}">${Icons.svg("alert")}</span><div class="acb"><b>${esc(p?p.name+" · "+p.vendorName:a.title)}</b><p><span class="mut">Radar · ${advice(a.change)} · </span>${esc(a.message)}</p></div><span class="btnlink">View</span></div>`; }
function alertsStrip(preview){
  const al=P.ALERTS, vis=preview?al.slice(0,3):al, rem=Math.max(0,al.length-3);
  if(!al.length) return panel("Alerts &amp; Notifications",'<div class="mut">No parts exceed the movement threshold this cycle.</div>');
  return `<div class="panel"><div class="panel-header"><div class="ph-t"><h3>Alerts &amp; Notifications</h3></div></div><div class="fc-acs ${preview?"row":""}">${vis.map(alertCell).join("")}${preview&&rem>0?`<div class="fc-ac more"><span class="aci" style="background:var(--info-soft);color:var(--info)">${Icons.svg("info")}</span><div class="acb"><b>${rem} more alert${rem===1?"":"s"}</b><p><a href="#" data-act="go:fc-alerts">View all alerts →</a></p></div></div>`:""}</div></div>`;
}
function buildAlerts(){
  const wrap=document.createElement("div");
  wrap.appendChild(header("Alerts","Parts whose forecast movement warrants a procurement review."));
  wrap.appendChild(el(alertsStrip(false))); wire(wrap); return wrap;
}

const PocHitl = {
  status:{},
  alerts(){ return R.geoAnalysis.hitl.alerts; },
  get(id){ return (this.status[id]||{}).status||"pending"; },
  pending(){ return this.alerts().filter(a=>this.get(a.alertId)==="pending"); },
  canAct(){ return ["commodity","buyer","pm","admin"].includes(RBAC.role); },
  set(id,st){
    if(!this.canAct()) return Toast.show("Switch to Commodity Mgr / Buyer / PM to act on alerts.","warn");
    const a=this.alerts().find(x=>x.alertId===id); if(!a) return;
    const u=(DATA.users.find(x=>x.role===RBAC.role)||{}).name||"User";
    this.status[id]={status:st,by:u,at:new Date().toISOString().slice(0,16).replace("T"," ")};
    Store.audit("Geopolitical alert",st==="confirmed"?"confirmed — impact revealed":"dismissed",id+" · "+a.headline);
    if(window.PocWork) PocWork.onHitl(a,st);
    Notif.updateBadge();
    Toast.show(st==="confirmed"?"Alert confirmed — estimated impact revealed.":"Alert dismissed — no impact applied.",st==="confirmed"?"success":"info");
    Router.render();
  },
};

const v = {parts:buildParts, alerts:buildAlerts};
return {P,C,state,v,actions,act,el,wire,go,header,tabBar,panel,kpi,note,seg,metric,pill,table,downloadCsv,downloadJson,
  spend,cr,cur,inr,sgn,dirChip,varCell,arrow,axisCur,sevDots,ml,mlong,rangeControl,toolbar,rangeOf,inRange,ALLM,openPart,
  partCell,vendorCell,partRow,PARTS_HEAD,sparkFor,alertsStrip,PocHitl,esc,nf,setPath,parseVal,filteredParts};
})();
const PocHitl = PocUI.PocHitl;
