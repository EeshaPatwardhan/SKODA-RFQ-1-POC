/* =====================================================================
   V8  ·  FTable — a table with pagination and a value filter on every column header.
   Click a column header → a small panel lists that column's values (with counts, search when long) → tick the ones to keep.
   The options of a column follow the filters set on the other columns, so a filter never offers a value that would give no rows.
   FTable.create({ id, columns:[{key,label,get(row)→text, html?(row)→markup, align?, order?(row)→number}], rows, pageSize?, rowAct?(row)→"action:arg", empty? }) → element
   ===================================================================== */
window.FTable=(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const FUNNEL='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';
let POP=null, POP_OWNER=null;
function closePop(){ if(POP){ POP.remove(); POP=null; POP_OWNER=null; document.removeEventListener("mousedown",onDoc,true); document.removeEventListener("keydown",onKey,true); window.removeEventListener("resize",closePop); } }
function onDoc(e){ if(POP&&!POP.contains(e.target)&&!(e.target.closest&&e.target.closest(".ft-h"))) closePop(); }
function onKey(e){ if(e.key==="Escape") closePop(); }

function create(o){
  const cols=o.columns, rows=o.rows, st={f:{},page:0,size:o.pageSize||10};
  const root=document.createElement("div"); root.className="ft"; root.id=o.id||"";
  const val=(c,r)=>{ const v=c.get(r); return v==null||v===""?"—":String(v); };
  const passes=(r,skip)=>cols.every(c=>c.key===skip||!st.f[c.key]||st.f[c.key].has(val(c,r)));
  const filtered=()=>rows.filter(r=>passes(r));
  const activeN=()=>Object.keys(st.f).filter(k=>st.f[k]).length;
  function options(c){
    const m=new Map(); rows.filter(r=>passes(r,c.key)).forEach(r=>{ const v=val(c,r), e=m.get(v)||{v,n:0,o:c.order?c.order(r):null}; e.n++; if(c.order&&(e.o==null||c.order(r)<e.o)) e.o=c.order(r); m.set(v,e); });
    const a=[...m.values()]; a.sort((x,y)=>c.order?(x.o-y.o):String(x.v).localeCompare(String(y.v))); return a;
  }
  function openPop(c,btn){
    if(POP&&POP_OWNER===c.key&&POP.__root===root){ closePop(); return; } closePop();
    const opts=options(c), cur=st.f[c.key], chosen=new Set(cur?[...cur].filter(v=>opts.some(x=>x.v===v)):opts.map(x=>x.v));
    const pop=document.createElement("div"); pop.className="ft-pop"; pop.__root=root; POP=pop; POP_OWNER=c.key;
    pop.innerHTML=`<div class="ft-pt"><b>${esc(c.label)}</b><span>${opts.length} value${opts.length===1?"":"s"}</span></div>${opts.length>7?`<input class="ft-ps" type="search" placeholder="Search ${esc(c.label.toLowerCase())}…" aria-label="Search values">`:""}
      <div class="ft-pa"><button type="button" data-a="all">Select all</button><button type="button" data-a="none">Clear</button></div><div class="ft-pl"></div>
      <div class="ft-pf"><button type="button" class="btn btn-sm" data-a="reset">Reset</button><button type="button" class="btn btn-sm btn-primary" data-a="apply">Apply</button></div>`;
    const list=pop.querySelector(".ft-pl");
    const draw=()=>{ const q=(pop.querySelector(".ft-ps")||{value:""}).value.trim().toLowerCase(); const shown=opts.filter(x=>!q||x.v.toLowerCase().includes(q));
      list.innerHTML=shown.map(x=>`<label><input type="checkbox" data-v="${esc(x.v)}" ${chosen.has(x.v)?"checked":""}><span>${esc(x.v)}</span><em>${x.n}</em></label>`).join("")||`<div class="ft-pn">No match</div>`; };
    draw();
    list.addEventListener("change",e=>{ const v=e.target.dataset.v; if(v==null) return; e.target.checked?chosen.add(v):chosen.delete(v); });
    const ps=pop.querySelector(".ft-ps"); if(ps) ps.addEventListener("input",draw);
    pop.addEventListener("click",e=>{ const a=e.target.dataset&&e.target.dataset.a; if(!a) return;
      if(a==="all"){ opts.forEach(x=>chosen.add(x.v)); draw(); } else if(a==="none"){ chosen.clear(); draw(); }
      else if(a==="reset"){ delete st.f[c.key]; st.page=0; closePop(); render(); }
      else if(a==="apply"){ if(chosen.size===opts.length) delete st.f[c.key]; else st.f[c.key]=new Set(chosen); st.page=0; closePop(); render(); } });
    document.body.appendChild(pop);
    const r=btn.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight;
    pop.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.left))+"px"; pop.style.top=Math.min(window.innerHeight-h-8,r.bottom+6)+"px";
    document.addEventListener("mousedown",onDoc,true); document.addEventListener("keydown",onKey,true); window.addEventListener("resize",closePop);
    setTimeout(()=>{ const f=pop.querySelector(".ft-ps"); if(f) f.focus(); },0);
  }
  function pager(total,pages){
    const p=st.page, nums=[]; for(let i=0;i<pages;i++) if(i===0||i===pages-1||Math.abs(i-p)<=1) nums.push(i); const out=[]; nums.forEach((n,i)=>{ if(i&&n-nums[i-1]>1) out.push("…"); out.push(n); });
    return `<div class="ft-pg"><button type="button" data-p="${p-1}" ${p<=0?"disabled":""} aria-label="Previous page">‹</button>${out.map(n=>n==="…"?`<span class="gap">…</span>`:`<button type="button" data-p="${n}" class="${n===p?"on":""}" ${n===p?'aria-current="page"':""}>${n+1}</button>`).join("")}<button type="button" data-p="${p+1}" ${p>=pages-1?"disabled":""} aria-label="Next page">›</button></div>`;
  }
  function render(){
    const list=filtered(), pages=Math.max(1,Math.ceil(list.length/st.size)); if(st.page>=pages) st.page=pages-1;
    const from=st.page*st.size, shown=list.slice(from,from+st.size), n=activeN();
    const chips=Object.keys(st.f).filter(k=>st.f[k]).map(k=>{ const c=cols.find(x=>x.key===k), vs=[...st.f[k]]; return `<span class="ft-chip"><b>${esc(c.label)}</b> ${esc(vs.length<=2?vs.join(", "):vs.length+" selected")}<button type="button" data-clear="${esc(k)}" aria-label="Remove filter ${esc(c.label)}">×</button></span>`; }).join("");
    root.innerHTML=`<div class="ft-bar"><span class="ft-sum"><b>${list.length}</b> of ${rows.length} rows${n?` · ${n} filter${n===1?"":"s"} on`:""}</span>${chips}${n?`<button type="button" class="ft-clr" data-clearall="1">Clear all filters</button>`:`<span class="ft-tip">Click a column heading to filter it</span>`}</div>
      <div class="ft-sc"><table class="ft-t"><thead><tr>${cols.map(c=>`<th class="${c.align==="r"?"r":""}"><button type="button" class="ft-h ${st.f[c.key]?"on":""}" data-col="${esc(c.key)}" aria-haspopup="true" title="Filter ${esc(c.label)}"><span>${esc(c.label)}</span>${FUNNEL}${st.f[c.key]?`<i>${st.f[c.key].size}</i>`:""}</button></th>`).join("")}</tr></thead>
      <tbody>${shown.length?shown.map(r=>`<tr ${o.rowAct?`class="ft-row" data-act="${esc(o.rowAct(r))}" role="button" tabindex="0"`:""}>${cols.map(c=>`<td class="${c.align==="r"?"r":""}">${c.html?c.html(r):esc(val(c,r))}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${cols.length}"><div class="table-empty">${esc(o.empty||"No rows match these filters.")}</div></td></tr>`}</tbody></table></div>
      <div class="ft-foot"><span>${list.length?`${from+1}–${Math.min(list.length,from+st.size)} of ${list.length}`:"0 rows"}</span>${pages>1?pager(list.length,pages):""}<label class="ft-size">Rows per page <select aria-label="Rows per page">${[10,25,50].map(x=>`<option value="${x}" ${x===st.size?"selected":""}>${x}</option>`).join("")}</select></label></div>`;
  }
  root.addEventListener("click",e=>{
    const h=e.target.closest(".ft-h"); if(h){ e.stopPropagation(); openPop(cols.find(c=>c.key===h.dataset.col),h); return; }
    const p=e.target.closest("[data-p]"); if(p&&!p.disabled){ e.stopPropagation(); st.page=+p.dataset.p; render(); return; }
    const c=e.target.closest("[data-clear]"); if(c){ e.stopPropagation(); delete st.f[c.dataset.clear]; st.page=0; render(); return; }
    if(e.target.closest("[data-clearall]")){ e.stopPropagation(); st.f={}; st.page=0; render(); }
  });
  root.addEventListener("change",e=>{ if(e.target.closest(".ft-size")){ st.size=+e.target.value; st.page=0; render(); } });
  render(); return root;
}
return {create,close:closePop};
})();
