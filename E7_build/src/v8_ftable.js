/* =====================================================================
   V8  ·  FTable — a table with pagination and a value filter on every column header.
   Click a column header → a small panel lists that column's values (with counts, search when long) → tick the ones to keep.
   The options of a column follow the filters set on the other columns, so a filter never offers a value that would give no rows.
   FTable.create({ id, columns:[{key,label,get(row)→text, html?(row)→markup, align?, order?(row)→number}], rows, pageSize?, rowAct?(row)→"action:arg", empty?, filter?:false, sortable?:true, sort?:{key,dir} }) → element
   A column may carry w (a CSS width such as "14%"); when any does, the table uses fixed column widths and the headings wrap.
   sortable:true → the heading label sorts (click again to reverse) and the funnel beside it opens the value filter.
   filter:false → no value filters; a click on a column heading sorts by that column instead (sort sets the starting order; the sort is stable).
   ===================================================================== */
window.FTable=(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const FUNNEL='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';
const ARR_U='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>', ARR_D='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
const CHEV='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
let POP=null, POP_OWNER=null;
function closePop(){ if(POP){ POP.remove(); POP=null; POP_OWNER=null; document.removeEventListener("mousedown",onDoc,true); document.removeEventListener("keydown",onKey,true); window.removeEventListener("resize",closePop); } }
function onDoc(e){ if(POP&&!POP.contains(e.target)&&!(e.target.closest&&e.target.closest(".ft-h"))) closePop(); }
function onKey(e){ if(e.key==="Escape") closePop(); }

function create(o){
  const cols=o.columns, rows=o.rows, st={f:{},page:0,size:o.pageSize||10,sort:o.sort?{key:o.sort.key,dir:o.sort.dir||"asc"}:null}, FILT=o.filter!==false;
  const root=document.createElement("div"); root.className="ft"+(cols.some(c=>c.w)?" ft-fixed":""); root.id=o.id||"";
  const val=(c,r)=>{ const v=c.get(r); return v==null||v===""?"—":String(v); };
  const passes=(r,skip)=>cols.every(c=>c.key===skip||!st.f[c.key]||st.f[c.key].has(val(c,r)));
  const sorted=a=>{ if(!st.sort) return a; const c=cols.find(x=>x.key===st.sort.key); if(!c) return a; const k=r=>c.order?c.order(r):val(c,r), d=st.sort.dir==="desc"?-1:1;
    return a.map((r,i)=>[r,i]).sort((x,y)=>{ const p=k(x[0]), q=k(y[0]); const v=(typeof p==="number"&&typeof q==="number")?p-q:String(p).localeCompare(String(q),undefined,{numeric:true}); return v*d||x[1]-y[1]; }).map(x=>x[0]); };
  const filtered=()=>sorted(rows.filter(r=>passes(r)));
  const activeN=()=>Object.keys(st.f).filter(k=>st.f[k]).length;
  function options(c){
    const m=new Map(); rows.filter(r=>passes(r,c.key)).forEach(r=>{ const v=val(c,r), e=m.get(v)||{v,n:0,o:c.order?c.order(r):null}; e.n++; if(c.order&&(e.o==null||c.order(r)<e.o)) e.o=c.order(r); m.set(v,e); });
    const a=[...m.values()]; a.sort((x,y)=>c.order?(x.o-y.o):String(x.v).localeCompare(String(y.v))); return a;
  }
  function openPop(c,btn){
    if(POP&&POP_OWNER===c.key&&POP.__root===root){ closePop(); return; } closePop();
    const opts=options(c), cur=st.f[c.key], chosen=new Set(cur?[...cur].filter(v=>opts.some(x=>x.v===v)):opts.map(x=>x.v));
    const pop=document.createElement("div"); pop.className="ft-pop"; pop.__root=root; POP=pop; POP_OWNER=c.key;
    const num=!!c.order, sdir=st.sort&&st.sort.key===c.key?st.sort.dir:"";
    const sortHtml=o.sortMenu?`<div class="ft-so"><b>Sort</b><button type="button" data-a="sort-asc" class="${sdir==="asc"?"on":""}">${num?"Low to high":"A to Z"}</button><button type="button" data-a="sort-desc" class="${sdir==="desc"?"on":""}">${num?"High to low":"Z to A"}</button></div><div class="ft-fh">Filter</div>`:"";
    pop.innerHTML=`${sortHtml}<div class="ft-pt"><b>${esc(c.label)}</b><span>${opts.length} value${opts.length===1?"":"s"}</span></div>${opts.length>7?`<input class="ft-ps" type="search" placeholder="Search ${esc(c.label.toLowerCase())}…" aria-label="Search values">`:""}
      <div class="ft-pa"><button type="button" data-a="all">Select all</button><button type="button" data-a="none">Clear</button></div><div class="ft-pl"></div>
      <div class="ft-pf"><button type="button" class="btn btn-sm" data-a="reset">Reset</button><button type="button" class="btn btn-sm btn-primary" data-a="apply">Apply</button></div>`;
    const list=pop.querySelector(".ft-pl");
    const draw=()=>{ const q=(pop.querySelector(".ft-ps")||{value:""}).value.trim().toLowerCase(); const shown=opts.filter(x=>!q||x.v.toLowerCase().includes(q));
      list.innerHTML=shown.map(x=>`<label><input type="checkbox" data-v="${esc(x.v)}" ${chosen.has(x.v)?"checked":""}><span>${esc(x.v)}</span><em>${x.n}</em></label>`).join("")||`<div class="ft-pn">No match</div>`; };
    draw();
    list.addEventListener("change",e=>{ const v=e.target.dataset.v; if(v==null) return; e.target.checked?chosen.add(v):chosen.delete(v); });
    const ps=pop.querySelector(".ft-ps"); if(ps) ps.addEventListener("input",draw);
    pop.addEventListener("click",e=>{ const a=e.target.dataset&&e.target.dataset.a; if(!a) return;
      if(a==="sort-asc"||a==="sort-desc"){ st.sort={key:c.key,dir:a==="sort-desc"?"desc":"asc"}; st.page=0; closePop(); render(); return; }
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
  const sortedOn=c=>st.sort&&st.sort.key===c.key, arrow=c=>sortedOn(c)?(st.sort.dir==="desc"?ARR_D:ARR_U):"";
  const sortBtn=c=>`<button type="button" class="ft-h ft-sb ${sortedOn(c)?"on":""}" data-sort="${esc(c.key)}" title="Sort by ${esc(c.label)}"><span>${esc(c.label)}</span>${arrow(c)}</button>`;
  const filtBtn=(c,both)=>`<button type="button" class="ft-h ${both?"ft-fb":""} ${st.f[c.key]?"on":""}" data-col="${esc(c.key)}" aria-haspopup="true" title="Filter ${esc(c.label)}">${both?"":`<span>${esc(c.label)}</span>`}${FUNNEL}${st.f[c.key]?`<i>${st.f[c.key].size}</i>`:""}</button>`;
  const menuBtn=c=>`<button type="button" class="ft-h ft-mb ${st.f[c.key]||sortedOn(c)?"on":""}" data-col="${esc(c.key)}" aria-haspopup="true" title="Sort or filter ${esc(c.label)}"><span>${esc(c.label)}</span>${arrow(c)}${CHEV}${st.f[c.key]?`<i>${st.f[c.key].size}</i>`:""}</button>`;
  const head=c=>`<th class="${c.align==="r"?"r":""}" ${c.w?`style="width:${c.w}"`:""} ${sortedOn(c)?`aria-sort="${st.sort.dir==="desc"?"descending":"ascending"}"`:""}>${!FILT?sortBtn(c):o.sortable?`<div class="ft-hd">${sortBtn(c)}${filtBtn(c,true)}</div>`:filtBtn(c,false)}</th>`;
  function render(){
    const list=filtered(), pages=Math.max(1,Math.ceil(list.length/st.size)); if(st.page>=pages) st.page=pages-1;
    const from=st.page*st.size, shown=list.slice(from,from+st.size), n=activeN();
    const chips=Object.keys(st.f).filter(k=>st.f[k]).map(k=>{ const c=cols.find(x=>x.key===k), vs=[...st.f[k]]; return `<span class="ft-chip"><b>${esc(c.label)}</b> ${esc(vs.length<=2?vs.join(", "):vs.length+" selected")}<button type="button" data-clear="${esc(k)}" aria-label="Remove filter ${esc(c.label)}">×</button></span>`; }).join("");
    root.innerHTML=`<div class="ft-bar"><span class="ft-sum"><b>${list.length}</b> of ${rows.length} rows${n?` · ${n} filter${n===1?"":"s"} on`:""}</span>${chips}${n?`<button type="button" class="ft-clr" data-clearall="1">Clear all filters</button>`:`${o.sortable?"":`<span class="ft-tip">${!FILT?"Click a column heading to sort it":"Click a column heading to filter it"}</span>`}`}</div>
      <div class="ft-sc"><table class="ft-t"><thead><tr>${cols.map(head).join("")}</tr></thead>
      <tbody>${shown.length?shown.map(r=>`<tr ${o.rowAct?`class="ft-row" data-act="${esc(o.rowAct(r))}" role="button" tabindex="0"`:""}>${cols.map(c=>`<td class="${c.align==="r"?"r":""}">${c.html?c.html(r):esc(val(c,r))}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${cols.length}"><div class="table-empty">${esc(o.empty||"No rows match these filters.")}</div></td></tr>`}</tbody></table></div>
      <div class="ft-foot"><span>${list.length?`${from+1}–${Math.min(list.length,from+st.size)} of ${list.length}`:"0 rows"}</span>${pages>1?pager(list.length,pages):""}<label class="ft-size">Rows per page <select aria-label="Rows per page">${[10,25,50].map(x=>`<option value="${x}" ${x===st.size?"selected":""}>${x}</option>`).join("")}</select></label></div>`;
  }
  root.addEventListener("click",e=>{
    const sb=e.target.closest("[data-sort]"); if(sb){ e.stopPropagation(); const k=sb.dataset.sort; st.sort=st.sort&&st.sort.key===k?{key:k,dir:st.sort.dir==="asc"?"desc":"asc"}:{key:k,dir:"asc"}; st.page=0; render(); return; }
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
