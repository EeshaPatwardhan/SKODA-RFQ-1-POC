/* ===== E7 · CBD screen — runs inside the E6 closure (replaces E6's buildCbdTree); the maths lives in CbdCore (src/e7_cbd_core.js) ===== */
let CBD_COLLAPSED = new Set();   // ids of collapsed groups / nodes (kept across renders)
const CBD_SEEN = {};             // partNumber -> part cost at the last render, so a recalculation can show what changed
const cbdEsc = s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const cbdRs = v=>"₹ "+fmt(v);
const cbdSgn = v=>(v>=0?"+":"−")+"₹ "+fmt(Math.abs(v));
const cbdPc = v=>(v>=0?"+":"−")+Math.abs(v).toFixed(1)+"%";

function buildCbdTree(){
  const wrap = document.createElement("div");
  const canWrite = RBAC.canWrite("part") || RBAC.canWrite("material-cost-dash") || RBAC.role==="buyer" || RBAC.role==="finance";
  wrap.appendChild(Components.pageHeader("Cost Breakdown (CBD)",
    "Part cost built from net weights × commodity prices, import content × FX and manually entered cost lines. Each cost counts once; any change recalculates the part and the cost per car."));

  const parts = cbdPartOptions();
  if(!CBD_ACTIVE || !parts.includes(CBD_ACTIVE)) CBD_ACTIVE = parts[0];
  const cbd = ensureCbd(CBD_ACTIVE);
  syncDerivedNodes(cbd);
  const K = window.CbdCore;

  // part picker + upload
  const bar = document.createElement("div");
  bar.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;";
  const picker = document.createElement("select");
  picker.style.cssText="padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;background:var(--panel);min-width:260px;";
  picker.innerHTML = parts.map(n=>{ const p=partByNumber(n); const lbl=p?`${p.designation} (${n})`:n; return `<option value="${n}" ${n===CBD_ACTIVE?'selected':''}>${lbl}</option>`; }).join("");
  picker.onchange=()=>{ CBD_ACTIVE=picker.value; CBD_RECALC=false; Router.render(); };
  bar.appendChild(Components.el(`<span class="text-muted" style="font-size:12px;">Part</span>`));
  bar.appendChild(picker);
  if(canWrite){
    const up = document.createElement("button"); up.className="btn"; up.textContent="⬆️ Mass-upload CBD";
    up.onclick=()=>openCbdUpload(cbd); bar.appendChild(up);
  }
  wrap.appendChild(bar);

  /* ---------- numbers ---------- */
  const total=K.partCost(cbd), q=K.qty(cbd), dd=K.num((cbd.dd||{}).amortPerCar), perCar=K.carCost(cbd);
  const raw=K.rawLines(cbd), rawTot=K.rawMaterial(cbd), impTot=K.importValue(cbd), st=K.structure(cbd), manTot=K.manualTotal(cbd);
  const cmp=K.compare(cbd), issues=K.validate(cbd), prevTotal=CBD_SEEN[cbd.partNumber];
  CBD_SEEN[cbd.partNumber]=total;
  const share=v=>total>0?Math.round(v/total*100)+"%":"—";

  // recalculation banner: says what moved
  if(CBD_RECALC){
    const moved = Number.isFinite(prevTotal)&&Math.abs(prevTotal-total)>0.005 ? ` Part cost <b>${cbdRs(prevTotal)}</b> → <b>${cbdRs(total)}</b> (${cbdSgn(total-prevTotal)}).` : ` Part cost is unchanged at <b>${cbdRs(total)}</b>.`;
    wrap.appendChild(Components.el(`<div class="panel cbd-banner"><div class="panel-body"><span class="cbd-banner-i">\u{1F504}</span><div><b>Recalculated.</b> <span class="text-muted">The change flowed through the tree, the part cost and the cost per car.${moved}</span></div></div></div>`));
  }

  /* ---------- checks ---------- */
  const nErr=issues.filter(i=>i.sev==="error").length, nWarn=issues.filter(i=>i.sev==="warn").length, nInfo=issues.filter(i=>i.sev==="info").length;
  const sevChip={error:"chip-red",warn:"chip-amber",info:"chip-blue"}, sevTxt={error:"Error",warn:"Check",info:"Note"};
  const chk=document.createElement("div"); chk.className="panel cbd-checks";
  chk.innerHTML = issues.length
    ? `<div class="panel-header"><h3>Checks <span class="count-pill">${issues.length}</span></h3><span class="text-muted" style="font-size:12px;">${nErr?nErr+" error"+(nErr>1?"s":"")+" · ":""}${nWarn?nWarn+" to check · ":""}${nInfo?nInfo+" note"+(nInfo>1?"s":""):""}</span></div>
       <div class="panel-body"><ul class="cbd-issues">${issues.map(i=>`<li><span class="chip ${sevChip[i.sev]}"><span class="chip-dot"></span>${sevTxt[i.sev]}</span><div><b>${cbdEsc(i.msg)}</b>${i.effect?`<small>${cbdEsc(i.effect)}</small>`:""}</div></li>`).join("")}</ul></div>`
    : "";
  if(issues.length) wrap.appendChild(chk);   // nothing is shown when every check passes

  /* ---------- KPIs ---------- */
  const tgtRow=cmp.rows.find(r=>r.key==="tgt");
  const kpis = document.createElement("div"); kpis.className="grid grid-4 cbd-kpis";
  kpis.appendChild(Components.kpiCard("Calculated part cost", cbdRs(total), null, "\u{1F333}"));
  kpis.appendChild(Components.kpiCard("Qty / car", q, null, "\u{1F697}"));
  kpis.appendChild(Components.kpiCard("Cost / car (incl. D&D)", cbdRs(perCar), null, "\u{1F4C8}"));
  kpis.appendChild(Components.kpiCard("Calculated vs Target", tgtRow.has?`${cbdPc(tgtRow.p)}<span class="cbd-kp-s ${tgtRow.p>0?"bad":"good"}">${tgtRow.p>0?"over target":"within target"}</span>`:"—", null, "\u{1F3AF}"));
  wrap.appendChild(kpis);

  // main grid: hierarchy | inputs + references
  const grid = document.createElement("div"); grid.className="grid grid-2 cbd-grid"; grid.style.marginTop="16px";

  /* ---------- hierarchy ---------- */
  const treePanel = document.createElement("div"); treePanel.className="panel";
  treePanel.innerHTML = `<div class="panel-header"><h3>Cost hierarchy <span class="count-pill">${st.length+raw.filter(l=>l.net>0).length+(impTot>0||K.num((cbd.importContent||{}).value)>0?1:0)}</span></h3>
    <div class="cbd-hbtn"><button class="btn btn-sm" id="cbd-collapse" title="Expand or collapse every group">Collapse all</button>${canWrite?`<button class="btn btn-sm btn-primary" id="cbd-addnode">+ Node</button>`:""}</div></div>`;
  const rows=[];     // {anc,html}
  const caret=(id,has)=>has?`<button type="button" class="cbd-car" data-tg="${id}" aria-label="Expand or collapse"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>`:`<span class="cbd-car sp"></span>`;
  const row=(o)=>rows.push(o);
  const line=(o)=>`<tr class="cbd-r ${o.cls||""}" ${o.id?`data-id="${o.id}"`:""} data-anc="${o.anc||""}"><td class="cbd-n" style="padding-left:${12+(o.depth||0)*20}px">${caret(o.id,o.has)}<span class="cbd-nm">${o.name}</span>${o.tag||""}</td><td class="cbd-b">${o.basis||""}</td><td class="cbd-v">${o.cost}</td><td class="cbd-s">${o.sh||""}</td><td class="cbd-a">${o.act||""}</td></tr>`;
  const tagDer=`<span class="cbd-tag der">calculated</span>`, tagMan=`<span class="cbd-tag man">entered</span>`;

  // material cost (derived from weights)
  const usedRaw=raw.filter(l=>l.net>0||l.value>0);
  row({html:line({id:"G-MAT",name:"Material cost",tag:tagDer,basis:"net weight × commodity price",cost:fmt(rawTot),sh:share(rawTot),has:usedRaw.length>0,cls:"grp"})});
  usedRaw.forEach(l=>row({anc:"G-MAT",html:line({anc:"G-MAT",depth:1,name:l.label,basis:`${l.net} ${l.unit} × ₹ ${fmt(l.price)}/${l.unit}`,cost:fmt(l.value),sh:share(l.value)})}));
  // import content (derived)
  const ic=cbd.importContent||{}, icv=K.num(ic.value);
  row({html:line({id:"D-IMP-V",name:"Import content",tag:tagDer,basis:icv>0?`${fmt(icv)} ${cbdEsc(ic.currency||"INR")} × ${(ic.currency||"INR")==="INR"?1:fmt(K.num(ic.fxRate))} INR/${cbdEsc(ic.currency||"INR")}`:"none entered",cost:fmt(impTot),sh:share(impTot),cls:"grp"})});
  // manual cost lines (hierarchy from the node levels)
  const chain=x=>x.parent?chain(x.parent).concat("M-"+cbdEsc(x.parent.n.id)):[];
  st.forEach(r=>{
    const anc=chain(r).join("|");
    const id="M-"+cbdEsc(r.n.id), kids=r.children.length>0, inc=r.excluded;
    const tot=r.n.mode==="total", own=K.num(r.n.cost);
    let basis = inc?`<span class="cbd-inc">included in parent</span>`: tot?`includes its sub-nodes`: kids?`own ${fmt(own)} + sub-nodes ${fmt(r.subtotal-own)}`:`entered cost`;
    const act = canWrite?`<button class="btn btn-sm" data-edit="${cbdEsc(r.n.id)}">Edit</button> <button class="btn btn-sm" data-del="${cbdEsc(r.n.id)}" aria-label="Delete">✕</button>`:"";
    row({anc,html:line({id,anc,depth:chain(r).length,has:kids,name:cbdEsc(r.n.name)+(r.orphan||r.jump?` <span class="cbd-tag warn" title="Level does not follow from the node above">level</span>`:""),
      tag:tagMan+(tot?`<span class="cbd-tag tot" title="The cost entered already includes the sub-nodes; they are not added again">total</span>`:""),basis,cost:inc?`<span class="cbd-mut">${fmt(own)}</span>`:fmt(r.subtotal),sh:inc?"":share(r.subtotal),act})});
  });
  const tbody = document.createElement("div"); tbody.className="panel-body no-pad";
  tbody.innerHTML = `<table class="mtable cbd-tree"><thead><tr><th>Cost element</th><th>Basis</th><th class="r">₹ / part</th><th class="r">Share</th><th></th></tr></thead>
    <tbody>${rows.map(r=>r.html).join("")}
    <tr class="cbd-tot"><td colspan="2">Total part cost <span class="cbd-unit">INR per piece</span></td><td class="cbd-v">${fmt(total)}</td><td class="cbd-s">${total>0?"100%":"—"}</td><td></td></tr></tbody></table>
    <div class="cbd-roll"><div><span>Part cost</span><b>${cbdRs(total)}</b></div><div><span>× Quantity per car</span><b>${q}</b></div><div><span>+ D&amp;D amortisation per car</span><b>${cbdRs(dd)}</b></div><div class="tot"><span>= Cost per car</span><b>${cbdRs(perCar)}</b></div></div>`;
  treePanel.appendChild(tbody);
  grid.appendChild(treePanel);

  /* ---------- right column: inputs + references ---------- */
  const side=document.createElement("div"); side.className="cbd-side";
  const cap = document.createElement("div"); cap.className="panel";
  cap.innerHTML = `<div class="panel-header"><h3>Cost inputs</h3>${canWrite?`<button class="btn btn-sm" id="cbd-edit-inputs">Edit inputs</button>`:""}</div>`;
  const w=cbd.weights, fxm=K.fxMaster(ic.currency||"INR");
  const kv=(k,v,t)=>`<div class="cbd-kv"><span>${k}</span><b>${v}</b>${t?`<span class="cbd-tag ${t==="entered"?"man":"der"}">${t}</span>`:""}</div>`;
  const wt=raw.filter(l=>l.net>0||l.gross>0);
  const cb=document.createElement("div"); cb.className="panel-body";
  cb.innerHTML =
    kv("Quantity per car", q, "entered")+
    (wt.length?`<table class="cbd-wt"><thead><tr><th>Material</th><th class="r">Gross</th><th class="r">Net</th><th class="r">₹ / unit</th><th class="r">Value ₹</th></tr></thead><tbody>${wt.map(l=>`<tr><td>${l.label}${l.key==="steel"&&w.steel.grade?` <span class="cbd-mut">${cbdEsc(w.steel.grade)}</span>`:""}</td><td class="r">${l.gross} ${l.unit}</td><td class="r">${l.net} ${l.unit}</td><td class="r">${fmt(l.price)}</td><td class="r">${fmt(l.value)}</td></tr>`).join("")}</tbody></table>`:kv("Material weights","none entered","entered"))+
    kv("Import content", icv>0?`${fmt(icv)} ${cbdEsc(ic.currency||"INR")} · ${cbdEsc(ic.origin||"—")}`:"none", "entered")+
    (icv>0&&(ic.currency||"INR")!=="INR"?kv("FX rate", `${fmt(K.num(ic.fxRate))} INR per ${cbdEsc(ic.currency)}${fxm?` <span class="cbd-mut">(master ${fmt(fxm)})</span>`:""}`, "entered"):"")+
    kv("D&amp;D amortisation / car", `${cbdRs(dd)} <span class="cbd-mut">@ volume ${fmt((cbd.dd||{}).volume)}</span>`, "entered")+
    `<div class="cbd-note">Priced on net weight; gross weight is recorded but not costed. Metals are priced in INR/kg, precious metal in INR/g, from the current commodity master.</div>`;
  cap.appendChild(cb);
  side.appendChild(cap);

  const cp=document.createElement("div"); cp.className="panel";
  cp.innerHTML=`<div class="panel-header"><h3>Calculated cost vs references</h3></div>
    <div class="panel-body no-pad"><table class="mtable cbd-cmp"><thead><tr><th>Value</th><th class="r">₹</th><th class="r">Calculated − value</th><th class="r">%</th></tr></thead><tbody>
    <tr class="cbd-calc"><td><b>Calculated CBD cost</b><small>from this tree</small></td><td class="r"><b>${fmt(total)}</b></td><td class="r">—</td><td class="r">—</td></tr>
    ${cmp.rows.map(r=>`<tr><td>${r.label}${r.sub?`<small>${cbdEsc(r.sub)}</small>`:""}</td><td class="r">${r.has?fmt(r.val):"not set"}</td><td class="r ${r.has?(r.d>0?"bad":r.d<0?"good":""):""}">${r.has?cbdSgn(r.d):"—"}</td><td class="r ${r.has?(r.d>0?"bad":r.d<0?"good":""):""}">${r.has?cbdPc(r.p):"—"}</td></tr>`).join("")}
    </tbody></table><div class="cbd-note" style="padding:10px 16px 14px">VSI and target are reference values and the supplier price comes from the price history; none of them is the calculated cost. Red = the calculated cost is above the reference.</div></div>`;
  side.appendChild(cp);
  grid.appendChild(side);
  wrap.appendChild(grid);

  /* ---------- collapse / expand ---------- */
  const applyCollapse=()=>{
    tbody.querySelectorAll("tr[data-anc]").forEach(tr=>{ const a=tr.dataset.anc?tr.dataset.anc.split("|"):[]; tr.hidden=a.some(id=>CBD_COLLAPSED.has(id)); });
    tbody.querySelectorAll("[data-tg]").forEach(b=>b.classList.toggle("shut",CBD_COLLAPSED.has(b.dataset.tg)));
    const shown=[...tbody.querySelectorAll("tr:not([hidden]) [data-tg]")].map(b=>b.dataset.tg), allShut=shown.length&&shown.every(id=>CBD_COLLAPSED.has(id));   // judged on the groups you can see, so the label matches what is on screen
    const cb=treePanel.querySelector("#cbd-collapse"); if(cb) cb.textContent=allShut?"Expand all":"Collapse all";
  };
  tbody.addEventListener("click",e=>{ const tg=e.target.closest("[data-tg]"); if(tg){ const id=tg.dataset.tg; CBD_COLLAPSED.has(id)?CBD_COLLAPSED.delete(id):CBD_COLLAPSED.add(id); applyCollapse(); } });
  treePanel.querySelector("#cbd-collapse").onclick=()=>{ const ids=[...tbody.querySelectorAll("[data-tg]")].map(b=>b.dataset.tg); const vis=[...tbody.querySelectorAll("tr:not([hidden]) [data-tg]")].map(b=>b.dataset.tg); const allShut=vis.length&&vis.every(id=>CBD_COLLAPSED.has(id)); ids.forEach(id=>allShut?CBD_COLLAPSED.delete(id):CBD_COLLAPSED.add(id)); applyCollapse(); };
  applyCollapse();

  // wire actions
  if(canWrite){
    treePanel.querySelector("#cbd-addnode").onclick=()=>openCbdNodeDrawer(cbd,null);
    tbody.addEventListener("click",e=>{
      const ed=e.target.closest("[data-edit]"); if(ed){ openCbdNodeDrawer(cbd, cbd.tree.find(n=>String(n.id)===ed.dataset.edit)); return; }
      const dl=e.target.closest("[data-del]"); if(dl){ cbdDeleteNode(cbd, dl.dataset.del); }
    });
    cap.querySelector("#cbd-edit-inputs").onclick=()=>openCbdInputsDrawer(cbd);
  }
  return wrap;
}
