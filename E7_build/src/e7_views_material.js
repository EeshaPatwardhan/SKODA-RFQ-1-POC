/* =====================================================================
   E7  ·  Material Cost dashboard + Hierarchy drill-down
   (ports of the POC's material-cost/* and DrillDownTree / HierarchyPanel)
   ===================================================================== */
(function(){
"use strict";
const U=PocUI, P=PocCore, C=PocCharts, R=P.RAW, esc=C.esc, nf=C.nf;
const {spend,cur,sgn,ml,panel,note,el,wire,header,state,varCell,arrow,axisCur,pill}=U;
const MS=R.materialCost.milestones;
const uniq=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y));

/* =============================== MATERIAL COST =============================== */
function matFilter(f){
  const q=f.q.trim().toLowerCase();
  return P.PARTS.filter(p=>(f.project==="all"||p.progName===f.project)&&(f.vendor==="all"||p.vendorName===f.vendor)&&(f.category==="all"||p.category===f.category)&&(f.material==="all"||p.material===f.material)&&
    (!q||(p.id+" "+p.name+" "+p.rawName+" "+p.vendorName+" "+p.category+" "+p.material).toLowerCase().includes(q)));
}
function hierOptions(f){
  const all=P.PARTS, a1=f.project==="all"?all:all.filter(p=>p.progName===f.project), a2=f.vendor==="all"?a1:a1.filter(p=>p.vendorName===f.vendor), a3=f.category==="all"?a2:a2.filter(p=>p.category===f.category);
  return {projects:uniq(all.map(p=>p.progName)),vendors:uniq(a1.map(p=>p.vendorName)),categories:uniq(a2.map(p=>p.category)),materials:uniq(a3.map(p=>p.material))};
}
function filterBar(f,matching){
  const o=hierOptions(f), active=f.project!=="all"||f.vendor!=="all"||f.category!=="all"||f.material!=="all"||f.q.trim();
  const sel=(label,key,opts,all,reset)=>`<label class="fb-f"><span>${label}</span><select data-set="material.${key}" data-reset="material.bridge=null,material.limit=12${reset?","+reset:""}" class="${f[key]!=="all"?"act":""}" ${opts.length?"":"disabled"}><option value="all">${all}</option>${opts.map(x=>`<option ${x===f[key]?"selected":""}>${esc(x)}</option>`).join("")}</select></label>`;
  return panel("Hierarchy filters",`<div class="fb-grid">${sel("Project","project",o.projects,"All projects","material.vendor=all,material.category=all,material.material=all")}${sel("Vendor","vendor",o.vendors,"All vendors","material.category=all,material.material=all")}${sel("Vertical","category",o.categories,"All verticals","material.material=all")}${sel("Material","material",o.materials,"All materials")}
    <label class="fb-f"><span>Part search</span><input type="search" data-set="material.q" data-reset="material.bridge=null,material.limit=12" placeholder="ID or name…" value="${esc(f.q)}"></label></div>`,
    {sub:"Project → Vendor → Vertical → Material — KPIs and charts update live",right:`<div class="fb-r"><span class="pill ${active?"blue":""}">${matching===P.PARTS.length?matching+" parts":matching+" of "+P.PARTS.length+" parts"}</span>${active?`<button class="btn btn-sm" id="mat-clear">Clear all</button>`:""}</div>`});
}
const lakh=v=>v==null||isNaN(v)?"--":"₹"+(v/1e5).toFixed(2)+" L";
const TIP={budget:"Cost per vehicle at nomination-month piece prices: piece price × quantity per vehicle, summed over the parts in scope (average car when several projects are in scope).",sop:"Cost per vehicle at SOP-month (current) piece prices, same basis as above.",forecast:"Cost per vehicle at the primary-model forecast piece prices — matches the Forecast Dashboard.",variance:"How much total cost moved from Budget to Forecast. Red means cost up; green means cost down."};
function mkpi(label,tip,value,hint,tone){ return `<div class="kpi-card" title="${esc(tip)}"><div class="kpi-label"><span style="text-decoration:underline dotted;text-underline-offset:3px;cursor:help">${label}</span>${Icons.svg("info")}</div><div class="kpi-value ${tone||""}" style="font-size:24px">${value}</div>${hint?`<div class="kpi-note" style="background:none;padding:0">${hint}</div>`:""}</div>`; }

function tracker(list,scoped){
  const mode=state.material.track, all=P.meanTrack(list), N=P.NH;
  const rows=mode==="history"?all.filter(r=>r.actual!=null):all;
  const mx=Math.max(...rows.map(r=>Math.max(r.actual||0,r.forecast||0,r.upper||0)),1);
  const ni=rows.findIndex(r=>r.month===MS.nomination.month), si=rows.findIndex(r=>r.month===MS.sop.month);
  const fl=rows.map((r,i)=>r.forecast!=null?r.forecast:(mode==="full"&&i===N-1?r.actual:null));
  const lastA=[...rows].reverse().find(r=>r.actual!=null), lastF=[...rows].reverse().find(r=>r.forecast!=null);
  const chart=C.line({labels:rows.map(r=>ml(r.month)),height:280,mLeft:60,maxX:9,aria:"Price movement tracker",yFmt:v=>axisCur(v,mx),
    shade:ni>=0&&si>=0?[{from:ni,to:si,color:"#6366f1",opacity:.1,label:"Nomination → SOP",textColor:"#4f46e5"}]:[],
    marks:[ni>=0?{i:ni,label:"",color:"#2563eb",dash:"4 4"}:null,si>=0?{i:si,label:"",color:"#7c3aed",dash:"4 4"}:null].filter(Boolean),
    series:[{name:"Actual",data:rows.map(r=>r.actual),color:C.C.anchor,width:2,area:true}].concat(mode==="full"?[{name:"Forecast",data:fl,color:"#2563eb",dash:"6 4",width:2}]:[])});
  return panel("Price movement tracker",
    `<div class="mt-pills"><span class="pill blue">Nomination ${esc(MS.nomination.label)}</span><span class="pill violet">SOP ${esc(MS.sop.label)}</span>${mode==="full"?`<span class="pill">Forecast ${esc(MS.forecast.label)}</span>`:""}${mode==="full"&&lastF?`<span class="pill green">Latest FC ${lakh(lastF.forecast)}</span>`:""}${lastA?`<span class="pill">Latest actual ${lakh(lastA.actual)}</span>`:""}</div>${chart}
     <div class="mut small" style="border-top:1px solid var(--line2);padding-top:8px;margin-top:6px">Line is the <b>cost per vehicle</b> ${scoped?"for the current hierarchy slice (exact monthly means of the filtered parts).":"across parts. Shaded band marks Nomination → SOP history."}</div>`,
    {sub:scoped?"Cost per vehicle of the filtered parts":"Cost per vehicle across the tracked parts — Nomination → SOP, then forecast",
     right:`<div class="fc-segs tight"><button class="fc-seg ${mode==="history"?"on":""}" data-act="set:material.track=history">History only</button><button class="fc-seg ${mode==="full"?"on":""}" data-act="set:material.track=full">Full horizon</button></div>`});
}

function partsTable(ranked,all,bridge,limit){
  const shown=ranked.slice(0,limit), bl=bridge?P.BRIDGE_LABEL[bridge]:null;
  const rows=shown.map(p=>{
    let tb=bridge, bv=0;
    if(p.bridges){ const b=p.bridges.b2f; if(!tb){ tb=P.BK.slice().sort((a,c)=>Math.abs(b[c]||0)-Math.abs(b[a]||0))[0]; } bv=b[tb]||0; }
    const chg=(p.fcEnd/p.nom-1)*100;
    return `<tr class="clk" data-act="part:${esc(p.id)}"><td><b>${esc(p.name)}</b><small class="mut">${esc(p.id)} · ${esc(p.category)} · ${esc(p.vendorName)}</small></td><td>${esc(p.progName)}</td><td class="r">${p.qty}</td><td class="r">${cur(p.nom,false)}</td><td class="r">${cur(p.cur,false)}</td><td class="r">${cur(p.fcEnd,false)}</td><td class="r"><b class="var ${chg>=0?"up":"dn"}">${sgn(chg,2)}</b></td><td class="r"><b class="var ${bv>=0?"up":"dn"}">${bv>=0?"+":""}${cur(bv,false)}</b>${!bridge&&tb?`<small class="mut">${P.BRIDGE_LABEL[tb]}</small>`:""}</td></tr>`; }).join("");
  return panel("Part drill-down",U.table(["Part","Project",{t:"Qty / vehicle",r:1},{t:"BG price",r:1},{t:"SOP price",r:1},{t:"FC price",r:1},{t:"Δ",r:1},{t:bl||"Top bridge",r:1}],rows||`<tr><td colspan="8"><div class="table-empty">${bridge?`No parts have a material ${bl} contribution under the current filters.`:"No parts match the current hierarchy filters."}</div></td></tr>`)+
    (ranked.length>limit?`<div class="fc-more-row"><button class="btn btn-sm" data-act="set:material.limit=${limit+12}">Show more (${ranked.length-limit} remaining)</button></div>`:""),
    {noPad:true,sub:bridge?`Parts where ${bl} is a material driver (${ranked.length} of ${all.length}) — click a row for detail`:"Piece-price BG → FC moves, largest first — click a row for Nomination→SOP→FC detail",
     right:`<div class="fb-r">${bridge?`<button class="pill blue" data-act="set:material.bridge=null">Filter: ${bl} ×</button>`:""}<span class="mut small">${ranked.length} parts</span></div>`});
}

U.v.material=function(){
  const wrap=document.createElement("div"), s=state.material;
  wrap.appendChild(header("Material Cost Dashboard","Track part price from Nomination to SOP, and walk Budget (BG) to Forecast (FC) with drill-down."));
  const f=matFilter(s), scoped=s.project!=="all"||s.vendor!=="all"||s.category!=="all"||s.material!=="all"||s.q.trim().length>0;
  const sig=[s.project,s.vendor,s.category,s.material,s.q,s.walk,s.bridge].join("|"); if(s._sig!==sig){ s._sig=sig; s.limit=12; }
  wrap.appendChild(el(note(esc(R.materialCost.disclaimer.replace(/\(No commercial file at[^)]*\)\.?/,"").trim())+" Basis: <b>cost per vehicle</b> (piece price × quantity per vehicle).","warn")));
  const fb=el(`<div style="margin-top:14px">${filterBar(s,f.length)}</div>`); wrap.appendChild(fb);
  const bg=P.cost(f,p=>p.nom), sop=P.cost(f,p=>p.cur), fc=P.cost(f,p=>p.fcEnd), vp=bg?(fc/bg-1)*100:0, hint=l=>scoped?`${f.length} parts · ${esc(l)}`:esc(l);
  const k=document.createElement("div"); k.className="grid grid-4"; k.style.marginTop="14px";
  k.innerHTML=mkpi("Budget (BG) cost per vehicle",TIP.budget,spend(bg),hint(MS.nomination.label))+mkpi("SOP / current cost per vehicle",TIP.sop,spend(sop),hint(MS.sop.label))+mkpi("Forecast (FC) cost per vehicle",TIP.forecast,spend(fc),hint(MS.forecast.label))+
    mkpi("BG → FC variance",TIP.variance,sgn(vp,2),spend(fc-bg,true)+" per vehicle",vp>=0?"var-up":"var-dn");
  wrap.appendChild(k);
  const g=document.createElement("div"); g.className="fc-cols"; g.style.marginTop="14px";
  const W=P.WALK, wk=W[s.walk]||W.bg_to_fc;
  g.innerHTML=tracker(f,scoped)+`<div class="col"><div class="fc-segs tight" style="margin:0 0 10px"><span class="mut small" style="align-self:center;text-transform:uppercase;letter-spacing:.05em">Period</span>${Object.keys(W).map(id=>`<button class="fc-seg ${s.walk===id?"on":""}" data-act="set:material.walk=${id}" onclick="PocUI.state.material.bridge=null">${W[id].label}</button>`).join("")}</div>${U.walkList(P.walkSteps(f,s.walk),{title:wk.title,subtitle:wk.subtitle,activeId:s.bridge,actFor:(st,sel)=>"set:material.bridge="+(sel?"null":st.id),clear:"set:material.bridge=null"})}</div>`;
  wrap.appendChild(g);
  const ranked=(s.bridge?P.partsByBridge(f,s.bridge,"b2f"):f.slice().sort((a,b)=>Math.abs(b.fcEnd-b.nom)-Math.abs(a.fcEnd-a.nom)));
  wrap.appendChild(el(`<div style="margin-top:14px">${partsTable(ranked,f,s.bridge,s.limit)}</div>`));
  wire(wrap);
  const cl=wrap.querySelector("#mat-clear"); if(cl) cl.onclick=()=>{ Object.assign(s,{project:"all",vendor:"all",category:"all",material:"all",q:"",bridge:null}); Router.render(); };
  return wrap;
};

/* =============================== HIERARCHY =============================== */
const LEVELS={project:{label:"Project"},vendor:{label:"Vendor"},category:{label:"Vertical"},part:{label:"Part"},material:{label:"Material"}};
const DEFAULT_ORDER=["project","vendor","category","part","material"];
const ICON={project:"M4 4h16v16H4zM8 16v-4M12 16V8M16 16v-6",category:"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",vendor:"M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 9h3a1 1 0 0 1 1 1v11M3 21h18M9 7h2M9 11h2M9 15h2",part:"M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",material:"m21 16-9 5-9-5V8l9-5 9 5zM3 8l9 5 9-5M12 13v8"};
const lvIcon=k=>`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k]}"/></svg>`;
let RECS=null;
function recs(){
  if(RECS) return RECS; RECS=[];
  P.PARTS.forEach(p=>{
    const lines=P.bomOf(p), mats=lines&&lines.length?lines:[null];
    const mc=P.sum(mats,m=>m?m.bg:0), mf=P.sum(mats,m=>m?m.fc:0);
    mats.forEach(m=>{ RECS.push({project:p.progName,vendor:p.vendorName,origin:p.vendorOrigin,category:p.category,partId:p.id,part:p,material:m,materialName:m?m.name:"No material data",
      current:p.cur*p.qty*p.prog.volume*(m?(mc?m.bg/mc:0):1),forecast:p.fcEnd*p.qty*p.prog.volume*(m?(mf?m.fc/mf:0):1)}); });
  });
  return RECS;
}
const recValue=(r,l)=>l==="part"?r.partId:l==="material"?r.materialName:r[l];
function group(rs,order,depth,parentKey){
  const level=order[depth], m=new Map();
  rs.forEach(r=>{ const k=recValue(r,level); (m.get(k)||m.set(k,[]).get(k)).push(r); });
  return [...m.entries()].map(([name,members])=>{
    const cs=P.sum(members,r=>r.current), fs=P.sum(members,r=>r.forecast), key=parentKey+level+":"+name+"|";
    return {key,level,label:level==="part"?members[0].part.name:name,origin:members[0].origin,cs,fs,pct:cs?(fs/cs-1)*100:0,
      children:depth+1<order.length?group(members,order,depth+1,key):[],recs:members,partAbove:order.slice(0,depth).includes("part")};
  });
}
const IND=28;
const guides=d=>Array.from({length:d},(_,i)=>`<span class="ht-g" style="left:${33+i*IND}px"></span>`).join("");
const caret=(open,vis)=>`<svg class="ht-c ${open?"":"cl"} ${vis?"":"hid"}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const enc=k=>encodeURIComponent(k);
function row(n,depth,open,expandable){
  const count=expandable?n.children.length:new Set(n.recs.map(r=>r.partId)).size;
  return `<div class="ht-row ${expandable?"clk":""}" style="padding-left:${20+depth*IND}px" ${expandable?`data-act="tgl:${enc(n.key)}" role="button" tabindex="0"`:""} title="${LEVELS[n.level].label}: ${esc(n.label)}">${guides(depth)}
    <span class="ht-n">${caret(open,expandable)}<span class="ht-t t-${n.level}">${lvIcon(n.level)}</span><span class="ht-nm ${depth===0?"b":""}">${esc(n.label)}</span><span class="ht-tag">${LEVELS[n.level].label}</span>${n.level==="vendor"&&n.origin==="international"?'<span class="pill blue" title="International supplier">intl</span>':""}<span class="mut small">(${count}${expandable?"":" parts"})</span></span>
    <span class="r">${spend(n.cs)}</span><span class="r"><b>${spend(n.fs)}</b></span>${varCell(n.pct,2)}<span class="mut">–</span></div>`;
}
function partRow(n,depth,open,expandable){
  const p=n.recs[0].part, est="est. annual spend "+spend(n.cs)+" → "+spend(n.fs), nm=p.bomN||0;
  const q=`Why is ${p.name} (${p.id}) forecast ${p.chgH>=0?"up":"down"} ${Math.abs(p.chgH).toFixed(1)}%?`;
  return `<div class="ht-row part" style="padding-left:${20+depth*IND}px">${guides(depth)}
    <div class="ht-n top">${expandable?`<button type="button" class="ht-cb" data-act="tgl:${enc(n.key)}" aria-label="Toggle materials">${caret(open,true)}</button>`:'<span style="width:16px"></span>'}<span class="ht-t t-part">${lvIcon("part")}</span>
      <div class="ht-pm"><div class="ht-p1"><b class="mono">${esc(p.id)}</b><span class="ht-tag">Part</span><a href="#" class="plink mut" data-act="part:${esc(p.id)}">${esc(p.name)}</a>${p.anomaly?`<span class="pill red" title="Structural break: ${esc(p.anomaly.replace(/_/g," "))}">${Icons.svg("alert")} break</span>`:""}${expandable?`<span class="mut small">${nm===1?"1 material":(n.children.length||"")+" materials"}</span>`:""}</div>
      <div class="mut small">Interval: ${cur(p.loEnd,false)} – ${cur(p.hiEnd,false)} · ${est}</div></div></div>
    <span class="r">${cur(p.cur,false)}</span><span class="r"><b>${cur(p.fcEnd,false)}</b></span>${varCell(p.chgH,2)}
    <span class="ht-cf"><span class="conf ${p.conf.level}" title="Predicted move is ${p.conf.ratio}x the model's typical ${p.conf.errPct}% error at this horizon">${Icons.svg("shield")} ${p.conf.level}</span><button type="button" class="btn btn-sm ht-why" data-act="ask:${esc(q)}" title="Explain this part's forecast drivers">Why?</button></span></div>`;
}
function matRow(n,depth,open,expandable){
  const m=n.recs[0].material, p=n.recs[0].part, chg=m.bg?(m.fc/m.bg-1)*100:0;
  const comm=m.primary&&p.mat&&p.mat.commodity!=null?`<span class="mut small" style="display:block">Commodity bridge ${cur(p.mat.commodity,false)}</span>`:"";
  return `<div class="ht-row mat" style="padding-left:${20+depth*IND}px">${guides(depth)}<span class="ht-n">${caret(open,false)}<span class="ht-t t-material">${lvIcon("material")}</span><span class="ht-mm"><span class="ht-mn"><b>${esc(m.name)}</b><span class="ht-tag am">Material</span><span class="mut small">BG → FC</span></span><span class="mut small" style="display:block">${nf(m.quantity,m.unit==="kg"?3:0)} ${m.unit} × ${cur(m.unitPrice,false)}${m.unit==="kg"?"/kg":""} · sample · est. spend ${spend(n.cs)} → ${spend(n.fs)}</span>${comm}</span></span>
    <span class="r" title="Budget (BG)">${cur(m.bg,false)}</span><span class="r" title="Forecast (FC)"><b>${cur(m.fc,false)}</b></span>${varCell(chg,2)}<span class="mut">–</span></div>`;
}
function renderNode(n,depth,H){
  const rec=n.recs[0];
  if(n.level==="part"){ const c=rec.part.conf.level; if(!(H.minConf==="all"||(H.minConf==="high"&&c==="high")||(H.minConf==="medium"&&c!=="low"))) return ""; }
  const open=H.open.has(n.key), has=n.children.length>0;
  const body=open&&has?n.children.map(c=>renderNode(c,depth+1,H)).join(""):"";
  if(n.level==="part"){ rec.part.bomN=P.bomOf(rec.part)?P.bomOf(rec.part).length:0; return partRow(n,depth,open,has)+body; }
  if(n.level==="material"&&n.partAbove&&rec.material) return matRow(n,depth,open,has)+body;
  return row(n,depth,open,has)+body;
}
U.actions.tgl=v=>{ const k=decodeURIComponent(v), o=state.hier.open; o.has(k)?o.delete(k):o.add(k); Router.render(); };

function tree(){
  const H=state.hier, groups=group(recs(),H.order,0,"");
  const cs=P.annualSpend(P.PARTS,p=>p.cur), fs=P.annualSpend(P.PARTS,p=>p.fcEnd), pc=cs?(fs/cs-1)*100:0;
  const boxes=H.order.map((l,i)=>`${i>0?'<svg class="ht-sep" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>':""}<div class="ht-lv" draggable="true" data-i="${i}" title="Drag the box to reorder, or use the arrow to pick a level"><span class="mut">⋮⋮</span><span class="ht-t t-${l}">${lvIcon(l)}</span>${LEVELS[l].label}<select aria-label="Level ${i+1}" data-lv="${i}">${DEFAULT_ORDER.map(x=>`<option value="${x}" ${x===l?"selected":""}>${LEVELS[x].label}</option>`).join("")}</select><svg class="ht-dd" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></div>`).join("");
  return `<div class="panel"><div class="panel-body"><div class="fb-r" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px"><div class="fc-bigs" style="padding:0;gap:26px">${U.metric("Current annual spend",spend(cs))}${U.metric("Forecast annual spend (+"+P.NF+" mo)",spend(fs))}${U.metric("Projected change",sgn(pc,2),pc>=0?"red":"green")}${U.metric("Projects",String(P.PROGS.length))}</div>
      <label class="small mut">Show parts with confidence <select data-set="hier.minConf" style="margin-left:6px;height:32px;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:0 8px"><option value="all">All</option><option value="medium" ${H.minConf==="medium"?"selected":""}>Medium and above</option><option value="high" ${H.minConf==="high"?"selected":""}>High only</option></select></label></div>
      <p class="fc-note" style="margin-top:12px"><b>Confidence is a signal-to-error ratio, not a probability.</b> It compares the size of the predicted move against the model's typical error at this horizon. <b style="color:var(--ok)">High</b> means the move is at least 2× that error and the direction is worth acting on; <b>low</b> means it sits inside the noise and the sign should not be trusted.</p></div></div>
    <div class="panel" style="margin-top:14px"><div class="panel-body" style="padding-bottom:6px"><div class="ht-lvs">${boxes}<button type="button" class="btn btn-sm" id="ht-reset" style="margin-left:auto">${Icons.svg("refresh")} Reset</button></div>
      <p class="small mut" style="margin-top:10px">Explore annual spend on the tracked parts (piece price × quantity per vehicle × planned annual volume) across your hierarchy. Drag any level box, or use its menu, to regroup the tree. Spend below the project, vendor and vertical level is estimated by price share. Click a part name for its price path and forecast drivers.</p></div>
      <div class="ht-scroll"><div class="ht-in"><div class="ht-row ht-head"><span>Name</span><span class="r">Current annual spend</span><span class="r">Forecast annual spend</span><span class="r">Variance</span><span>Confidence / Drivers</span></div>${groups.map(g=>renderNode(g,0,H)).join("")}</div></div></div>`;
}

/* roll-up by project / vendor / vertical (POC HierarchyPanel) */
function rollupPanel(){
  const lv=[["project","Project","Project cost trajectory — what a vehicle line is heading toward."],["vendor","Vendor","Negotiation priority — which suppliers are driving the increase."],["category","Vertical","Hedging priority — which commodity exposures to cover."]];
  const cur_=lv.find(x=>x[0]===state.hier.level)||lv[0], rows=P.rollup(cur_[0]), cs=P.cost(P.PARTS,p=>p.cur), fs=P.cost(P.PARTS,p=>p.fcEnd), tc=cs?(fs/cs-1)*100:0;
  const items=rows.map(r=>({label:r.name,value:r.changePct,text:sgn(r.changePct,2),onclick:cur_[0]==="vendor"?"filter:vendor="+r.name:cur_[0]==="category"?"filter:cat="+r.name:""}));
  return panel("Forecast Cost per Vehicle by "+cur_[1],`<div class="fc-bigs" style="padding:0 0 12px;gap:26px">${U.metric("Current cost per vehicle",spend(cs))}${U.metric("Forecast (+"+P.NF+" mo)",spend(fs))}${U.metric("Change",sgn(tc,2),tc>=0?"red":"green")}${U.metric(cur_[1]+"s",String(rows.length))}</div>${C.bars({signed:true,items,fmt:v=>sgn(v,2)})}<p class="mut small" style="margin-top:8px">Red is a cost increase — bad for a buyer. Green is a decrease.</p>`,
      {sub:cur_[2],right:U.seg(lv.map(x=>[x[0],x[1]]),state.hier.level,"set:hier.level=%v")})+
    panel(cur_[1]+" Detail",U.table([cur_[1],{t:"Parts",r:1},{t:"Current",r:1},{t:"Forecast",r:1},{t:"Change",r:1},{t:"Abs",r:1}],rows.map(r=>`<tr class="${cur_[0]!=="project"?"clk":""}" ${cur_[0]==="vendor"?`data-act="filter:vendor=${esc(r.name)}"`:cur_[0]==="category"?`data-act="filter:cat=${esc(r.name)}"`:""}><td><b>${esc(r.name)}</b></td><td class="r">${r.parts}</td><td class="r">${spend(r.currentSpend)}</td><td class="r"><b>${spend(r.forecastSpend)}</b></td><td class="r"><b class="var ${r.changePct>=0?"up":"dn"}">${sgn(r.changePct,2)}</b></td><td class="r mut">${spend(r.changeAbs)}</td></tr>`).join("")),{noPad:true,style:"margin-top:16px"});
}

U.v.hierarchy=function(){
  const wrap=document.createElement("div"), H=state.hier;
  wrap.appendChild(header("Hierarchy Drill-down","Project → vendor → vertical → part → material. Expand any row to see current price, forecast, and how much to trust it."));
  wrap.appendChild(el(`<div style="margin-top:6px">${tree()}</div>`));
  wrap.appendChild(el(`<div style="margin-top:16px">${rollupPanel()}</div>`));
  wire(wrap);
  const move=(from,to)=>{ if(from===to) return; const n=H.order.slice(), [it]=n.splice(from,1); n.splice(to,0,it); H.order=n; H.open=new Set(); Router.render(); };
  wrap.querySelectorAll("[data-lv]").forEach(s=>s.onchange=()=>{ const i=+s.dataset.lv, to=H.order.indexOf(s.value); move(to,i); });
  let dragFrom=null;
  wrap.querySelectorAll(".ht-lv").forEach(b=>{ const i=+b.dataset.i;
    b.addEventListener("dragstart",e=>{ dragFrom=i; e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",String(i)); b.classList.add("drag"); });
    b.addEventListener("dragover",e=>{ e.preventDefault(); b.classList.add("over"); }); b.addEventListener("dragleave",()=>b.classList.remove("over"));
    b.addEventListener("drop",e=>{ e.preventDefault(); const f=+e.dataTransfer.getData("text/plain"); if(Number.isInteger(f)) move(f,i); }); b.addEventListener("dragend",()=>{ b.classList.remove("drag","over"); }); });
  const rs=wrap.querySelector("#ht-reset"); if(rs) rs.onclick=()=>{ H.order=DEFAULT_ORDER.slice(); H.open=new Set(); Router.render(); };
  return wrap;
};
})();
