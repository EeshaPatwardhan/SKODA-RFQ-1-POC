/* =====================================================================
   E7 / V8  ·  Pickers — Car, Supplier and Part are separate filters everywhere a part is chosen
   Before, a part was picked from one long list labelled "Coil Spring (TGN-CHS-00255)" or "Coil Spring — VW Taigun · Sona BLW".
   Now: Car → Supplier → Part (each narrows the others); the Part list shows only the part name (the part number is added only when two
   names would otherwise look identical).  Also: generic master tables get real filters in place of the dead "All" drop-down.
   ===================================================================== */
const PartPick=(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const carOf=p=>p.poc?p.poc.progName:((DATA.projects.find(x=>x.code===p.project)||{}).name||p.project);
const uniq=a=>[...new Set(a)].sort((x,y)=>String(x).localeCompare(String(y)));
const byNo=n=>DATA.parts.find(p=>p.number===n);
const projName=code=>{ const p=DATA.projects.find(x=>x.code===code); return p?p.name:code; };
function label(p,list){ const dup=list.filter(q=>q.designation===p.designation).length>1; return p.designation+(dup?" · "+p.number:""); }
const optHtml=(arr,val)=>arr.map(o=>`<option value="${esc(o[0])}"${String(o[0])===String(val)?" selected":""}>${esc(o[1])}</option>`).join("");
const STATE={};   // remembered Car / Supplier per screen

/* a Car / Supplier / Part bar for screens that always have one part selected */
function bar(o){
  const all=o.numbers.map(byNo).filter(Boolean), st=STATE[o.key]||(STATE[o.key]={car:"",sup:""});
  const cur0=byNo(o.value); if(cur0&&((st.car&&carOf(cur0)!==st.car)||(st.sup&&cur0.supplier!==st.sup))){ st.car=""; st.sup=""; }   // arrived on a specific part from elsewhere
  let cur=o.value; const el=document.createElement("div"); el.className="cbd-filters pp-bar";
  function paint(){
    const cars=uniq(all.filter(p=>!st.sup||p.supplier===st.sup).map(carOf)), sups=uniq(all.filter(p=>!st.car||carOf(p)===st.car).map(p=>p.supplier));
    const list=all.filter(p=>(!st.car||carOf(p)===st.car)&&(!st.sup||p.supplier===st.sup)).sort((a,b)=>a.designation.localeCompare(b.designation));
    const keep=list.some(p=>p.number===cur); if(!keep) cur=(list[0]||{}).number;
    const sel=(k,name,arr,val)=>`<label class="cbd-f"><span>${name}</span><select data-pp="${k}">${optHtml(arr,val)}</select></label>`;
    el.innerHTML=sel("car","Car",[["","All cars ("+cars.length+")"]].concat(cars.map(c=>[c,c])),st.car)+sel("sup","Supplier",[["","All suppliers ("+sups.length+")"]].concat(sups.map(s=>[s,s])),st.sup)+sel("part","Part",list.map(p=>[p.number,label(p,list)]),cur);
    el.querySelectorAll("select").forEach(s=>{ s.onchange=()=>{ const k=s.dataset.pp, prev=cur; if(k==="car") st.car=s.value; else if(k==="sup") st.sup=s.value; else cur=s.value; paint(); if(cur!==prev) o.onPick(cur); }; });
  }
  paint(); if(cur!==o.value) setTimeout(()=>o.onPick(cur),0);
  return el;
}

/* turn an existing "part" <select> (values = part numbers) into Car → Supplier → Part */
function split(sel,o){
  o=o||{}; if(!sel||sel.dataset.pp||sel.disabled) return; sel.dataset.pp="1";
  const other=[...sel.options].find(x=>x.value==="__other"), all=[...sel.options].filter(x=>x.value!=="__other").map(x=>byNo(x.value)).filter(Boolean);
  const row=sel.closest(".form-row"); if(!row) return;
  let car="",sup="";
  const mk=(k,name)=>{ const d=document.createElement("div"); d.className="form-row"; d.innerHTML=`<label>${name}</label><select></select>`; row.parentNode.insertBefore(d,row); return d.querySelector("select"); };
  const carSel=mk("car","Car"), supSel=mk("sup","Supplier");
  const lab=row.querySelector("label"); if(lab&&!/part/i.test(lab.textContent)) lab.textContent="Part"; else if(lab) lab.textContent=o.label||"Part";
  const fill=(fire)=>{
    const cars=uniq(all.filter(p=>!sup||p.supplier===sup).map(carOf)), sups=uniq(all.filter(p=>!car||carOf(p)===car).map(p=>p.supplier));
    carSel.innerHTML=optHtml([["","All cars ("+cars.length+")"]].concat(cars.map(c=>[c,c])),car); supSel.innerHTML=optHtml([["","All suppliers ("+sups.length+")"]].concat(sups.map(s=>[s,s])),sup);
    const list=all.filter(p=>(!car||carOf(p)===car)&&(!sup||p.supplier===sup)).sort((a,b)=>a.designation.localeCompare(b.designation)), prev=sel.value;
    sel.innerHTML=list.map(p=>`<option value="${esc(p.number)}">${esc(label(p,list))}</option>`).join("")+(other?`<option value="__other">${esc(other.textContent)}</option>`:"");
    if([...sel.options].some(x=>x.value===prev)) sel.value=prev;
    if(fire) sel.dispatchEvent(new Event("change"));
  };
  carSel.onchange=()=>{ car=carSel.value; fill(true); }; supSel.onchange=()=>{ sup=supSel.value; fill(true); };
  const cur=byNo(sel.value); fill(false);
}

/* master tables: real filters for the categorical columns (replaces the "All" drop-down that did nothing) */
const SKIP=/^(id|wf|number|partNumber|designation|subject|name|part|docs|duns|lastUpdated|effectiveFrom|dummyNo|actualNo|poNo|toolingRef|sourcingNo|title|reason|note|email|racf|history|aeko)$/i;
function masterTable(cfg){
  const columns=cfg.columns, rows=cfg.rows, emptyText=cfg.emptyText;
  const wrap=document.createElement("div"); let sortState={col:null,dir:1}, text="", picks={};
  const cand=columns.filter(c=>c.key&&!/^__/.test(c.key)&&!SKIP.test(c.key)).map(c=>{ const vals=rows.map(r=>r[c.key]); if(!vals.length||vals.some(v=>v!=null&&typeof v==="object")) return null;
    const set=uniq(vals.filter(v=>v!=null&&v!=="").map(String)); if(set.length<2||set.length>24||set.some(v=>v.length>30)||set.every(v=>/^[\d.,\s-]+$/.test(v))) return null; return {c,set}; }).filter(Boolean);
  const pri=k=>/^(project|model)$/i.test(k)?0:/supplier/i.test(k)?1:2;
  const filters=cand.sort((a,b)=>pri(a.c.key)-pri(b.c.key)).slice(0,4);
  const shown=(c,v)=>/^(project|model)$/i.test(c.key)?projName(v):v;
  function renderRows(){
    const tbody=wrap.querySelector("tbody"), q=text.toLowerCase();
    let data=rows.filter(r=>filters.every(f=>!picks[f.c.key]||String(r[f.c.key])===picks[f.c.key])&&(!q||columns.some(c=>String(r[c.key]||"").toLowerCase().includes(q))));
    if(sortState.col) data=data.slice().sort((a,b)=>{ const av=a[sortState.col], bv=b[sortState.col]; return av>bv?sortState.dir:av<bv?-sortState.dir:0; });
    tbody.innerHTML="";
    if(!data.length){ const tr=document.createElement("tr"); tr.innerHTML=`<td colspan="${columns.length}"><div class="table-empty">${emptyText||"No records found."}</div></td>`; tbody.appendChild(tr); }
    else data.forEach(r=>{ const tr=document.createElement("tr"); tr.innerHTML=columns.map(c=>`<td data-label="${c.label}">${c.render?c.render(r):(r[c.key]??"")}</td>`).join(""); tbody.appendChild(tr); });
    wrap.querySelector(".table-footer .count").textContent=data.length+" of "+rows.length+" records";
  }
  wrap.className="panel";
  wrap.innerHTML=`<div class="table-toolbar"><input type="text" placeholder="Search…">${filters.map(f=>{ const isP=/^(project|model)$/i.test(f.c.key), allLbl=isP?"All cars":/supplier/i.test(f.c.key)?"All suppliers":"All "+String(f.c.label).toLowerCase();
      return `<select data-fk="${esc(f.c.key)}" title="${esc(f.c.label)}"><option value="">${esc(allLbl)}</option>${f.set.sort((a,b)=>String(shown(f.c,a)).localeCompare(String(shown(f.c,b)))).map(v=>`<option value="${esc(v)}">${esc(shown(f.c,v))}</option>`).join("")}</select>`; }).join("")}</div>
    <div class="panel-body no-pad"><table class="mtable"><thead><tr>${columns.map(c=>`<th data-key="${c.key}">${c.label}</th>`).join("")}</tr></thead><tbody></tbody></table></div>
    <div class="table-footer"><span class="count"></span><span>Page 1 of 1</span></div>`;
  wrap.querySelector("input[type=text]").addEventListener("input",e=>{ text=e.target.value; renderRows(); });
  wrap.querySelectorAll("select[data-fk]").forEach(s=>s.addEventListener("change",()=>{ picks[s.dataset.fk]=s.value; renderRows(); }));
  wrap.querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{ const k=th.dataset.key; sortState.dir=sortState.col===k?-sortState.dir:1; sortState.col=k; renderRows(); }));
  renderRows(); return wrap;
}
Components.masterTable=masterTable;

/* drawers that pick a part / a project */
(function(){
  const o=Drawer.open;
  Drawer.open=function(){
    const r=o.apply(Drawer,arguments);
    try{
      split(document.getElementById("cr-part"),{label:"Subject / part"});
      split(document.getElementById("iv-pn"),{label:"Part"});
      const ip=document.getElementById("ip-prj"); if(ip&&!ip.dataset.pp){ ip.dataset.pp="1"; [...ip.options].forEach(x=>{ const code=x.value||x.textContent; x.value=code; x.textContent=projName(code); }); }
      const cc=document.getElementById("cc-target"); if(cc&&!cc.dataset.pp){ cc.dataset.pp="1"; [...cc.options].forEach(x=>{ x.textContent=x.textContent.replace(/—\s*([A-Z]{2,4})$/,(m,code)=>"— "+projName(code)); }); }
    }catch(e){ console.error(e); }
    return r;
  };
})();

return {bar,split,carOf,label,projName,uniq};
})();
