/* =====================================================================
   E7  ·  CBD Tree — filter by Car, Supplier and Part
   E6's screen had a single "Part (ID)" dropdown over 480 parts, so identical part names across cars and suppliers were
   indistinguishable. Here Car and Supplier narrow the Part list (each also narrows the other), and the KPIs / tree /
   inputs follow the selection:
     • one part picked  → E6's part view (tree, cost inputs, KPIs) with a context line
     • "All parts"      → a scope view: KPIs rolled up over the filtered parts (only those with a CBD) + a part table
   ===================================================================== */
(function(){
"use strict";
const esc=PocCharts.esc, orig=SCREENS.procurement["cbd-tree"], A=()=>window.__cbdApi;
const partByNumber=no=>DATA.parts.find(p=>p.number===no);
const F={car:"",supplier:"",vert:"",part:undefined,seen:null};
const carOf=p=>p.poc?p.poc.progName:p.project;
const catOf=p=>p.poc?p.poc.category:"";
const uniq=a=>[...new Set(a)].sort((x,y)=>String(x).localeCompare(String(y)));
const inScope=(p,car,sup,vert)=>(!car||carOf(p)===car)&&(!sup||p.supplier===sup)&&(!vert||catOf(p)===vert);
const rupee=v=>"₹ "+A().fmt(v);

function label(p,list){
  const dup=list.filter(q=>q.designation===p.designation).length>1;
  return p.designation+(dup?" · "+p.number:"");
}
function scopeParts(){ return DATA.parts.filter(p=>inScope(p,F.car,F.supplier,F.vert)); }

/* a filter change: keep the chosen part only while it is still in scope; one part left in scope opens it */
function onFilter(k,v){
  if(k==="reset"){ F.car=""; F.supplier=""; F.vert=""; F.part=""; }
  else{
    F[k]=v;
    if(k!=="part"){
      if(F.part){ const p=partByNumber(F.part); if(!p||!inScope(p,F.car,F.supplier,F.vert)) F.part=""; }
      const l=scopeParts(); if(l.length===1) F.part=l[0].number;
    }
  }
  A().setRecalc(false); Router.render();
}

/* the Procurement dashboard's filter section (Part Details format): project picture, Project · Vertical · Supplier · Part, reset */
function filterBar(extraBtn){
  if(!(window.V8Proc&&window.V8Art&&typeof Icons!=="undefined")) return classicBar(extraBtn);
  const bar=document.createElement("div"); bar.className="pd-fbar";
  const cars=uniq(DATA.parts.filter(p=>inScope(p,"",F.supplier,F.vert)).map(carOf));
  const verts=uniq(DATA.parts.filter(p=>inScope(p,F.car,F.supplier,"")).map(catOf).filter(Boolean));
  const sups=uniq(DATA.parts.filter(p=>inScope(p,F.car,"",F.vert)).map(p=>p.supplier));
  const list=scopeParts().slice().sort((a,b)=>a.designation.localeCompare(b.designation)||carOf(a).localeCompare(carOf(b)));
  const sel=(id,name,opts,val,icon)=>`<label class="pd-f"><span>${name}</span><span class="pd-sel">${Icons.svg(icon)}<select data-f="${id}">${opts.map(o=>`<option value="${esc(o[0])}"${o[0]===val?" selected":""}>${esc(o[1])}</option>`).join("")}</select></span></label>`;
  const prog=F.car&&PocCore.PROGS.find(g=>g.name===F.car), pic=prog?V8Art.car(prog.code):"";
  bar.innerHTML=`<div class="pd-carbox solo">${pic||V8Art.lineup()||'<span class="va-car" aria-hidden="true"></span>'}</div>`+   // an empty frame of the same size keeps the filters in place when no project is picked
    sel("car","Project",[["","All projects ("+cars.length+")"]].concat(cars.map(c=>[c,c])),F.car,"car")+
    sel("vert","Vertical",[["","All verticals ("+verts.length+")"]].concat(verts.map(v=>[v,v])),F.vert,"layers")+
    sel("part","Part",[["","All parts ("+list.length+")"]].concat(list.map(p=>[p.number,label(p,list)])),F.part||"","wrench")+
    sel("supplier","Supplier",[["","All suppliers ("+sups.length+")"]].concat(sups.map(s=>[s,s])),F.supplier,"building")+
    `<button type="button" class="pd-reset" data-f="reset" title="Reset filters" aria-label="Reset filters">${Icons.svg("refresh")}</button>`;
  if(extraBtn){ extraBtn.style.marginTop="22px"; extraBtn.style.flex="none"; bar.appendChild(extraBtn); }
  bar.addEventListener("change",e=>{ const k=e.target.dataset&&e.target.dataset.f; if(k&&k!=="reset") onFilter(k,e.target.value); });
  bar.addEventListener("click",e=>{ if(e.target.closest('[data-f="reset"]')) onFilter("reset"); });
  return bar;
}

function classicBar(extraBtn){
  const bar=document.createElement("div"); bar.className="cbd-filters";
  const cars=uniq(DATA.parts.filter(p=>inScope(p,"",F.supplier)).map(carOf));
  const sups=uniq(DATA.parts.filter(p=>inScope(p,F.car,"")).map(p=>p.supplier));
  const list=scopeParts().slice().sort((a,b)=>a.designation.localeCompare(b.designation)||carOf(a).localeCompare(carOf(b)));
  const sel=(id,name,opts,val)=>`<label class="cbd-f"><span>${name}</span><select data-f="${id}">${opts.map(o=>`<option value="${esc(o[0])}"${o[0]===val?" selected":""}>${esc(o[1])}</option>`).join("")}</select></label>`;
  bar.innerHTML=
    sel("car","Car",[["","All cars ("+cars.length+")"]].concat(cars.map(c=>[c,c])),F.car)+
    sel("supplier","Supplier",[["","All suppliers ("+sups.length+")"]].concat(sups.map(s=>[s,s])),F.supplier)+
    sel("part","Part",[["","All parts ("+list.length+")"]].concat(list.map(p=>[p.number,label(p,list)])),F.part||"")+
    ((F.car||F.supplier)?`<button type="button" class="btn btn-sm" data-f="reset">Clear car / supplier</button>`:"");
  if(extraBtn) bar.appendChild(extraBtn);
  bar.addEventListener("change",e=>{
    const k=e.target.dataset&&e.target.dataset.f; if(!k) return;
    F[k]=e.target.value;
    if(k!=="part"){
      if(F.part){ const p=partByNumber(F.part); if(!p||!inScope(p,F.car,F.supplier)) F.part=""; }
      const l=scopeParts(); if(l.length===1) F.part=l[0].number;
    }
    A().setRecalc(false); Router.render();
  });
  bar.addEventListener("click",e=>{ if(e.target.closest('[data-f="reset"]')){ F.car=""; F.supplier=""; A().setRecalc(false); Router.render(); } });
  return bar;
}

/* the same Mass-upload button in the all-parts view, so the filters keep their place when a part is picked */
function uploadBtn(){
  if(typeof RBAC==="undefined"||!A().upload) return null;
  if(!(RBAC.canWrite("part")||RBAC.canWrite("material-cost-dash")||RBAC.role==="buyer"||RBAC.role==="finance")) return null;
  const b=document.createElement("button"); b.className="btn"; b.textContent="⬆️ Mass-upload CBD"; b.onclick=()=>A().upload({partNumber:F.part||""}); return b;
}

function context(){
  const d=document.createElement("div"); d.className="cbd-ctx";
  if(F.part){
    const p=partByNumber(F.part);
    d.innerHTML=`<b>${esc(p.designation)}</b><span>${esc(carOf(p))}</span><span>${esc(p.supplier)}</span><span class="m">Part no. ${esc(p.number)}</span>`;
  } else {
    const n=scopeParts().length;
    d.innerHTML=`<b>${n} part${n===1?"":"s"}</b>`+(F.car?`<span>Car: ${esc(F.car)}</span>`:"<span>All cars</span>")+(F.supplier?`<span>Supplier: ${esc(F.supplier)}</span>`:"<span>All suppliers</span>")+`<span class="m">Pick a part to open its cost tree</span>`;
  }
  return d;
}

function scopeView(wrap){
  const parts=scopeParts();
  const rows=parts.map(p=>{ const c=DATA.cbds[p.number]; if(c) A().sync(c); return {p,c,tot:c?A().partCost(c):null,car:c?A().carCost(c):null,tgt:c&&c.targetOriginal?c.targetOriginal:null}; });
  const have=rows.filter(r=>r.c);
  const carSum=have.reduce((s,r)=>s+r.car,0);
  const tgtRows=have.filter(r=>r.tgt), tot=tgtRows.reduce((s,r)=>s+r.tot,0), tgt=tgtRows.reduce((s,r)=>s+r.tgt,0);
  const vr=tgt?(tot-tgt)/tgt*100:null;
  const kp=document.createElement("div"); kp.className="grid grid-4 cbd-kpis";
  kp.appendChild(Components.kpiCard("Parts in selection",String(parts.length),null,"\u{1F4E6}"));
  kp.appendChild(Components.kpiCard("CBD captured",have.length+" of "+parts.length,null,"\u{1F333}"));
  kp.appendChild(Components.kpiCard("Material cost / car",have.length?rupee(carSum):"—",null,"\u{1F4C8}"));
  kp.appendChild(Components.kpiCard("Variance vs Target",vr==null?"—":(vr>=0?"+":"")+vr.toFixed(1)+"%"+`<span class="cbd-kp-s ${vr>0?"bad":"good"}">${vr>0?"over target":"within target"}</span>`,null,"\u{1F3AF}"));
  wrap.appendChild(kp);
  const MAX=60, shown=rows.slice().sort((a,b)=>(!!b.c-!!a.c)||carOf(a.p).localeCompare(carOf(b.p))||a.p.designation.localeCompare(b.p.designation)).slice(0,MAX);
  const panel=document.createElement("div"); panel.className="panel"; panel.style.marginTop="16px";
  panel.innerHTML=`<div class="panel-header"><h3>Parts in selection <span class="count-pill">${parts.length}</span></h3><span class="text-muted" style="font-size:12px;">${have.length?"Totals above cover the "+have.length+" part"+(have.length===1?"":"s")+" with a captured CBD.":"No part in this selection has a captured CBD yet."}</span></div>
  <div class="panel-body no-pad"><table class="mtable"><thead><tr><th>Part</th><th>Car</th><th>Supplier</th><th>Qty / car</th><th>Tree total</th><th>Cost / car</th><th>vs target</th><th>CBD</th></tr></thead><tbody>${
    shown.map(r=>{ const v=r.tgt?(r.tot-r.tgt)/r.tgt*100:null;
      return `<tr class="cbd-row" data-pn="${esc(r.p.number)}" tabindex="0" style="cursor:pointer;"><td data-label="Part"><b>${esc(r.p.designation)}</b></td><td data-label="Car">${esc(carOf(r.p))}</td><td data-label="Supplier">${esc(r.p.supplier)}</td>
      <td data-label="Qty / car">${r.c?r.c.qtyPerCar:"—"}</td><td data-label="Tree total">${r.c?rupee(r.tot):"—"}</td><td data-label="Cost / car">${r.c?rupee(r.car):"—"}</td>
      <td data-label="vs target">${v==null?"—":`<span class="chip ${v>0?"chip-red":"chip-green"}"><span class="chip-dot"></span>${v>=0?"+":""}${v.toFixed(1)}%</span>`}</td>
      <td data-label="CBD">${r.c?`<span class="chip chip-green"><span class="chip-dot"></span>captured</span>`:`<span class="chip chip-gray"><span class="chip-dot"></span>not captured</span>`}</td></tr>`; }).join("")
  }</tbody></table></div>${parts.length>MAX?`<div class="panel-body text-muted" style="font-size:12px;">Showing ${MAX} of ${parts.length} parts — narrow by car or supplier to see the rest.</div>`:""}`;
  const open=e=>{ const tr=e.target.closest("[data-pn]"); if(!tr) return; F.part=tr.dataset.pn; A().setRecalc(false); Router.render(); };
  panel.addEventListener("click",open); panel.addEventListener("keydown",e=>{ if(e.key==="Enter") open(e); });
  wrap.appendChild(panel);
}

SCREENS.procurement["cbd-tree"]=function(){
  const options=A().options(), active=A().active();
  if(F.part===undefined) F.part=(active&&options.includes(active))?active:options[0];
  /* opened from elsewhere on a specific part (part drawer, price history, Radar): follow it, clear car / supplier */
  if(active&&active!==F.seen&&options.includes(active)){ F.part=active; F.car=""; F.supplier=""; }
  if(F.part&&!partByNumber(F.part)&&!DATA.cbds[F.part]) F.part="";
  if(F.part){
    A().setActive(F.part); F.seen=F.part;
    const node=orig();
    const bar=node.children[1], btn=bar&&[...bar.querySelectorAll("button")].find(b=>/Mass-upload/.test(b.textContent));
    if(bar) bar.replaceWith(filterBar(btn)); else node.insertBefore(filterBar(null),node.children[1]||null);
    node.insertBefore(context(),node.children[2]||null);
    return node;
  }
  F.seen=active;
  const wrap=document.createElement("div");
  wrap.appendChild(Components.pageHeader("Cost Breakdown (CBD)","Filter by car, supplier and part. The KPIs and the cost tree below always describe exactly what is selected; pick a part to edit its cost tree."));
  wrap.appendChild(filterBar(uploadBtn())); wrap.appendChild(context());
  scopeView(wrap);
  return wrap;
};
})();
