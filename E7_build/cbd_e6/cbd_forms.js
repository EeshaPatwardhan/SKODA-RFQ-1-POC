/* ===== E7 · CBD edit forms and mass-upload — run inside the E6 closure (replace E6's drawers and its simulated upload) ===== */
function cbdCommit(cbd, action){
  syncDerivedNodes(cbd);
  Store.touch(cbd);
  // a CBD recompute appends a price version (never overwrite) — existing E6 behaviour
  const list = DATA.priceVersions[cbd.partNumber] || (DATA.priceVersions[cbd.partNumber]=[]);
  list.push({price:Math.round(cbdPartCost(cbd)), vsi:cbd.vsiOriginal, target:cbd.targetOriginal,
    effectiveFrom:TODAY, source:"CBD recalculation ("+action+")", changeReq:null});
  Store.audit("CBD", action, cbd.part);
}
function afterCbdChange(cbd, action){
  cbdCommit(cbd, action);
  CBD_RECALC = true;
  Router.render();
}
window.__cbdApi.ensure = ensureCbd; window.__cbdApi.commit = cbdCommit; window.__cbdApi.upload = openCbdUpload;

/* ---------------------------------------------------------------- cost node: add / edit / delete */
function cbdBlock(st, rec){ const i=st.indexOf(rec), b=[rec]; for(let j=i+1;j<st.length&&st[j].lvl>rec.lvl;j++) b.push(st[j]); return b; }
function openCbdNodeDrawer(cbd, node){
  const K=window.CbdCore, isNew=!node, st=K.structure(cbd), rec=node?st.find(r=>r.n===node):null;
  const block=rec?cbdBlock(st,rec):[], opts=st.filter(r=>!block.includes(r)), curParent=rec&&rec.parent?String(rec.parent.n.id):"";
  const g=(k,d="")=>node?(node[k]??d):d;
  Drawer.open((isNew?"Add ":"Edit ")+"cost node",
    `<div class="form-row"><label>Node name</label><input id="nd-name" value="${cbdEsc(g("name"))}"></div>
     <div class="form-row"><label>Parent</label><select id="nd-parent"><option value="">Part (top level)</option>${opts.map(r=>`<option value="${cbdEsc(r.n.id)}" ${String(r.n.id)===curParent?"selected":""}>${"  ".repeat(r.lvl-1)}${cbdEsc(r.n.name)}</option>`).join("")}</select></div>
     <div class="form-row"><label>Cost (₹ per part)</label><input id="nd-cost" type="number" step="0.01" min="0" value="${g("cost",0)}"></div>
     <div class="form-row"><label>Cost basis</label><select id="nd-mode"><option value="" ${g("mode")==="total"?"":"selected"}>Additive — this cost is added; any sub-nodes are added on top</option><option value="total" ${g("mode")==="total"?"selected":""}>Total — this cost already includes its sub-nodes (they are shown, not added again)</option></select></div>
     <div class="hint">Manual nodes add to the calculated material cost and import content. Do not enter material or import costs here — they are calculated from the weights and the import content.</div>
     <div id="nd-err" class="cbd-err"></div>`,
    ()=>{
      const err=m=>{ document.getElementById("nd-err").textContent=m; return false; };
      const name=document.getElementById("nd-name").value.trim(), cs=document.getElementById("nd-cost").value.trim(), pid=document.getElementById("nd-parent").value, mode=document.getElementById("nd-mode").value;
      if(!name) return err("Enter a node name.");
      if(cs===""||!Number.isFinite(+cs)) return err("Enter a cost (zero is allowed, blank is not).");
      if(+cs<0) return err("A cost cannot be negative.");
      const st2=K.structure(cbd), self=node?st2.find(r=>r.n===node):null;
      if(st2.some(r=>r.n!==node&&(r.parent?String(r.parent.n.id):"")===pid&&String(r.n.name).trim().toLowerCase()===name.toLowerCase())) return err("A node called “"+name+"” already exists under this parent.");
      const parentRec=pid?st2.find(r=>String(r.n.id)===pid):null, level=parentRec?parentRec.lvl+1:1;
      if(isNew){
        const n={id:"N"+Date.now(), derived:false, name, level, cost:+cs}; if(mode==="total") n.mode="total";
        const pb=parentRec?cbdBlock(st2,parentRec).pop().n:null;
        cbd.tree.splice(pb?cbd.tree.indexOf(pb)+1:cbd.tree.length,0,n);
      } else {
        node.name=name; node.cost=+cs; if(mode==="total") node.mode="total"; else delete node.mode;
        if(String(self.parent?self.parent.n.id:"")!==pid){          // moved: take the sub-nodes along and re-level them
          const blk=cbdBlock(st2,self), shift=level-self.lvl, moved=blk.map(r=>r.n);
          moved.forEach((n,i)=>{ n.level=blk[i].lvl+shift; });
          cbd.tree=cbd.tree.filter(n=>!moved.includes(n));
          const pb=parentRec?cbdBlock(K.structure(cbd),K.structure(cbd).find(r=>String(r.n.id)===pid)).pop().n:null;
          cbd.tree.splice(pb?cbd.tree.indexOf(pb)+1:cbd.tree.length,0,...moved);
        }
      }
      afterCbdChange(cbd, isNew?"add node":"edit node");
    });
}
function cbdDeleteNode(cbd, id){
  const K=window.CbdCore, st=K.structure(cbd), rec=st.find(r=>String(r.n.id)===String(id)); if(!rec) return;
  const blk=cbdBlock(st,rec);
  if(blk.length>1 && !confirm("Delete “"+rec.n.name+"” and its "+(blk.length-1)+" sub-node"+(blk.length>2?"s":"")+"?")) return;
  const gone=blk.map(r=>r.n); cbd.tree=cbd.tree.filter(n=>!gone.includes(n));
  afterCbdChange(cbd, "delete node");
}

/* ---------------------------------------------------------------- cost inputs */
function openCbdInputsDrawer(cbd){
  const K=window.CbdCore, w=cbd.weights, ic=cbd.importContent, cur=ic.currency||"EUR";
  const cur_opts=["INR"].concat((DATA.fx||[]).map(f=>f.currency)).filter((c,i,a)=>a.indexOf(c)===i);
  const row=(l,id,v,type="number",step="0.01")=>`<div class="form-row"><label>${l}</label><input id="ci-${id}" type="${type}" ${type==='number'?`step="${step}" min="0"`:""} value="${cbdEsc(v??"")}"></div>`;
  const pair=(label,k,unit)=>`<div class="cbd-pair"><span>${label}</span>${row("Gross ("+unit+")",k+"_g",w[k]?w[k].gross:0)}${row("Net ("+unit+")",k+"_n",w[k]?w[k].net:0)}</div>`;
  const hd=t=>`<div style="font-weight:700;color:var(--gray-600);font-size:12px;margin:10px 0 6px;">${t}</div>`;
  const m=K.fxMaster(cur);
  Drawer.open("Edit cost inputs",
    row("Quantity per car (pieces)","qty",cbd.qtyPerCar,"number","1")+
    hd("Material weights — priced on net weight")+
    row("Steel grade","s_grade",w.steel.grade,"text")+row("Steel supplier","s_sup",w.steel.supplier,"text")+
    pair("Steel","steel","kg")+pair("Aluminium","aluminium","kg")+pair("Copper","copper","kg")+pair("Lead","lead","kg")+pair("Precious metal","precious","g")+
    hd("Import content &amp; FX")+
    row("Import value (in the import currency)","ic_v",ic.value)+
    `<div class="form-row"><label>Import currency</label><select id="ci-ic_c">${cur_opts.map(c=>`<option ${c===cur?"selected":""}>${c}</option>`).join("")}</select></div>`+
    row("FX rate (INR per 1 unit of the currency)","ic_fx",ic.fxRate)+
    `<div class="hint" id="ci-fxhint">${m?`Current master rate for ${cbdEsc(cur)}: ${m} INR. `:""}Not used when the currency is INR.</div>`+
    row("Origin country","ic_o",ic.origin,"text")+
    hd("Reference values &amp; D&amp;D")+
    row("VSI (original, ₹ per part)","vsi",cbd.vsiOriginal)+row("Target (original, ₹ per part)","tgt",cbd.targetOriginal)+
    row("D&D amortisation per car (₹)","dd_a",cbd.dd.amortPerCar)+row("D&D volume (cars)","dd_v",cbd.dd.volume,"number","1")+
    `<div id="ci-err" class="cbd-err"></div>`,
    ()=>{
      const el=id=>document.getElementById("ci-"+id), val=id=>el(id).value.trim();
      const err=msg=>{ document.getElementById("ci-err").textContent=msg; return false; };
      const bad=(id,label)=>{ const v=val(id); if(v==="") return null; if(!Number.isFinite(+v)) return label+" is not a number."; if(+v<0) return label+" cannot be negative."; return null; };
      const labels={qty:"Quantity per car",ic_v:"Import value",ic_fx:"FX rate",vsi:"VSI",tgt:"Target",dd_a:"D&D amortisation",dd_v:"D&D volume"};
      ["steel","aluminium","copper","lead","precious"].forEach(k=>{ labels[k+"_g"]=k+" gross weight"; labels[k+"_n"]=k+" net weight"; });
      for(const id of Object.keys(labels)){ const e=bad(id,labels[id]); if(e) return err(e); }
      if(val("qty")===""||!(+val("qty")>0)) return err("Quantity per car must be above 0.");
      const n=id=>val(id)===""?0:+val(id);
      for(const k of ["steel","aluminium","copper","lead","precious"]) if(n(k+"_g")>0&&n(k+"_n")>n(k+"_g")) return err("Net weight of "+k+" cannot be above its gross weight.");
      const c=el("ic_c").value;
      if(n("ic_v")>0&&c!=="INR"){
        if(!(n("ic_fx")>0)) return err("An import value needs an FX rate above 0 (INR per 1 "+c+").");
        const mm=K.fxMaster(c); if(mm&&(n("ic_fx")/mm<0.2||n("ic_fx")/mm>5)) return err("FX rate "+n("ic_fx")+" looks inverted or in the wrong unit — the master rate is "+mm+" INR per 1 "+c+".");
      }
      cbd.qtyPerCar=n("qty");
      w.steel.grade=val("s_grade"); w.steel.supplier=val("s_sup");
      ["steel","aluminium","copper","lead","precious"].forEach(k=>{ w[k]=w[k]||{gross:0,net:0}; w[k].gross=n(k+"_g"); w[k].net=n(k+"_n"); });
      ic.value=n("ic_v"); ic.currency=c; ic.fxRate=n("ic_fx"); ic.origin=val("ic_o");
      cbd.vsiOriginal=n("vsi"); cbd.targetOriginal=n("tgt"); cbd.dd.amortPerCar=n("dd_a"); cbd.dd.volume=n("dd_v");
      afterCbdChange(cbd, "edit inputs (weights/FX)");
    });
}

/* ---------------------------------------------------------------- mass-upload (real CSV parsing; nothing is written until the file passes validation and you apply it) */
function openCbdUpload(cbd){
  const K=window.CbdCore, S={fmt:"long",text:"",res:null,mode:"replace",src:""};
  const bk=document.createElement("div"); bk.className="fc-modal-bk"; document.body.appendChild(bk);
  const close=()=>{ bk.remove(); document.removeEventListener("keydown",esck); }; const esck=e=>{ if(e.key==="Escape") close(); };
  document.addEventListener("keydown",esck); bk.onclick=e=>{ if(e.target===bk) close(); };
  const draw=()=>{
    const r=S.res, nOk=r?r.plans.length:0, hasErr=r&&r.errors.length>0;
    bk.innerHTML=`<div class="fc-modal cbd-up" role="dialog" aria-modal="true" aria-label="Mass-upload CBD"><div class="fm-h"><h2>Mass-upload CBD</h2><button class="drawer-close" data-c="1" aria-label="Close">✕</button></div>
      <div class="cbd-up-b">
        <p class="small mut">Upload a CSV, or paste its text. The file is read and checked first; the cost breakdown changes only when you apply a file that passed every check.</p>
        <div class="cbd-up-row"><label>Layout<select id="up-fmt"><option value="long" ${S.fmt==="long"?"selected":""}>B — long: one row per cost node (hierarchy by parent_id or level)</option><option value="wide" ${S.fmt==="wide"?"selected":""}>A — wide: one row per part (weights, import, FX, VSI / target, node:… columns)</option></select></label></div>
        <div class="cbd-up-cols"><b>Columns:</b> ${cbdEsc(K.FORMATS[S.fmt].cols)}</div>
        <div class="cbd-up-row"><input type="file" id="up-file" accept=".csv,.tsv,.txt"><button class="btn btn-sm" id="up-tpl">Download template</button><button class="btn btn-sm" id="up-sample">Load sample text</button></div>
        <textarea id="up-text" class="cbd-up-ta" spellcheck="false" placeholder="Paste CSV text here, or choose a file above.">${cbdEsc(S.text)}</textarea>
        <div class="small mut">Excel (.xlsx) files are not read by this prototype — save the sheet as CSV. The sample text only illustrates the layout; it is not a file from your system.</div>
        <div class="cbd-up-row"><button class="btn btn-primary btn-sm" id="up-check">Check file</button></div>
        ${r?`<div class="cbd-up-res">
          ${hasErr?`<div class="cbd-up-h bad">${r.errors.length} error${r.errors.length>1?"s":""} — nothing can be applied until they are fixed</div><ul class="cbd-issues">${r.errors.slice(0,40).map(e=>`<li><span class="chip chip-red"><span class="chip-dot"></span>${e.row?"Row "+e.row:"File"}</span><div><b>${cbdEsc(e.msg)}</b></div></li>`).join("")}</ul>${r.errors.length>40?`<div class="small mut">…and ${r.errors.length-40} more.</div>`:""}`:`<div class="cbd-up-h ok">File passed validation — ${nOk} part${nOk===1?"":"s"} ready</div>`}
          ${r.warnings.length?`<ul class="cbd-issues">${r.warnings.slice(0,10).map(e=>`<li><span class="chip chip-amber"><span class="chip-dot"></span>${e.row?"Row "+e.row:"File"}</span><div><b>${cbdEsc(e.msg)}</b></div></li>`).join("")}</ul>`:""}
          ${nOk?`<table class="mtable cbd-up-t"><thead><tr><th>Part</th><th class="r">Manual nodes</th><th class="r">Part cost now</th><th class="r">After upload</th></tr></thead><tbody>${r.plans.map(p=>{ const dp=partByNumber(p.pn), o=(p.old||[]).length;
            return `<tr><td>${cbdEsc(dp?dp.designation:p.pn)} <span class="cbd-mut">${cbdEsc(p.pn)}</span></td><td class="r">${p.nodes.length?(S.mode==="replace"?`${o} → ${p.nodes.length}`:`${o} + ${p.nodes.length}`):`${o} (unchanged)`}</td><td class="r">${p.before==null?"new":fmt(p.before)}</td><td class="r"><b>${(()=>{ const a=S.mode==="append"?p.afterAppend:p.afterReplace; return a==null?"—":fmt(a); })()}</b></td></tr>`; }).join("")}</tbody></table>
            ${r.plans.some(p=>p.nodes.length&&(p.old||[]).length)?`<div class="cbd-up-row"><label>Parts that already have manual nodes<select id="up-mode"><option value="replace" ${S.mode==="replace"?"selected":""}>Replace their manual nodes with the uploaded ones</option><option value="append" ${S.mode==="append"?"selected":""}>Keep them and add the uploaded nodes</option></select></label></div>`:""}`:""}
        </div>`:""}
      </div>
      <div class="cbd-up-f"><button class="btn" data-c="1">Cancel</button><button class="btn btn-primary" id="up-apply" ${(!r||hasErr||!nOk)?"disabled":""}>Apply to ${nOk||0} part${nOk===1?"":"s"}</button></div></div>`;
    bk.querySelectorAll("[data-c]").forEach(b=>b.onclick=close);
    const ta=bk.querySelector("#up-text"); ta.oninput=()=>{ S.text=ta.value; S.res=null; };
    bk.querySelector("#up-fmt").onchange=e=>{ S.fmt=e.target.value; S.res=null; draw(); };
    bk.querySelector("#up-file").onchange=e=>{ const f=e.target.files[0]; if(!f) return; if(/\.xlsx?$/i.test(f.name)){ S.res={errors:[{row:0,msg:"Excel files are not read by this prototype — save the sheet as CSV and upload that."}],warnings:[],plans:[]}; draw(); return; }
      const fr=new FileReader(); fr.onload=()=>{ S.text=String(fr.result||""); S.res=null; draw(); bk.querySelector("#up-check").click(); }; fr.readAsText(f); };
    bk.querySelector("#up-tpl").onclick=()=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([K.template(S.fmt,cbd.partNumber)],{type:"text/csv"})); a.download="cbd_"+S.fmt+"_template.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); };
    bk.querySelector("#up-sample").onclick=()=>{ S.text=K.template(S.fmt,cbd.partNumber); S.res=null; draw(); };
    bk.querySelector("#up-check").onclick=()=>{ S.text=bk.querySelector("#up-text").value; S.res=K.planUpload(S.fmt,S.text,cbd.partNumber); draw(); };
    const md=bk.querySelector("#up-mode"); if(md) md.onchange=e=>{ S.mode=e.target.value; draw(); };
    const ap=bk.querySelector("#up-apply"); if(ap) ap.onclick=()=>{
      const plans=S.res.plans, label="mass-upload ("+(S.fmt==="wide"?"wide":"long")+")";
      plans.forEach(p=>{ const c=ensureCbd(p.pn); K.apply(p,c,{mode:S.mode}); cbdCommit(c,label); });
      close(); CBD_RECALC=true;
      if(plans.length&&!plans.some(p=>p.pn===CBD_ACTIVE)){ CBD_ACTIVE=plans[0].pn; }
      Toast.show("CBD upload applied to "+plans.length+" part"+(plans.length===1?"":"s")+" — recalculated.", "success"); Router.render();
    };
  };
  draw();
}

