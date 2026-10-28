/* =====================================================================
   V8 · "Back" link on every page header: returns to the page you came from.
   Router.go remembers the page it leaves (a short history); Router.render adds one subtle link above the breadcrumb
   of every page that has a page header (not the Home hero). Clicking it goes back one step without adding to the history.
   ===================================================================== */
(function(){
  if(typeof Router==="undefined"||Router.__back) return; Router.__back=true;
  const HIST=[]; let skip=false;
  const same=(a,b)=>a&&b&&a.m===b.m&&a.s===b.s;
  const goOrig=Router.go.bind(Router), renderOrig=Router.render.bind(Router);
  Router.go=function(screen,module){
    const from={m:this.module,s:this.screen}, to={m:module||this.module,s:screen};
    if(!skip&&!same(from,to)&&from.s){ if(!same(HIST[HIST.length-1],from)) HIST.push(from); if(HIST.length>40) HIST.shift(); }
    skip=false; return goOrig(screen,module);
  };
  const target=()=>{ const cur={m:Router.module,s:Router.screen}; for(let i=HIST.length-1;i>=0;i--){ if(!same(HIST[i],cur)) return i; } return -1; };
  const lab=t=>{ let l=t.s; try{ l=navLabel(t.m,t.s); }catch(e){} if(t.s==="home") l="Home"; const mod=(typeof MODULES!=="undefined"&&MODULES.find(x=>x.id===t.m)||{}).label; return t.m!==Router.module&&mod&&t.s!=="home"?mod+" › "+l:l; };
  function addBack(){
    const c=document.getElementById("content"); if(!c) return; const hd=c.querySelector(".page-header:not(.hero)"); if(!hd||hd.querySelector(".v8-back")) return;
    const i=target(); if(i<0) return; const t=HIST[i], inner=hd.firstElementChild; if(!inner) return;
    const b=document.createElement("button"); b.type="button"; b.className="v8-back"; b.title="Back to the page you came from";
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Back to '+String(lab(t)).replace(/[<>&]/g,"")+"</span>";
    b.addEventListener("click",()=>{ const j=target(); if(j<0) return; const x=HIST[j]; HIST.length=j; skip=true; Router.go(x.s,x.m); });
    inner.insertBefore(b,inner.firstChild);
  }
  Router.render=function(){ const r=renderOrig.apply(this,arguments); try{ addBack(); }catch(e){ console.warn("back link",e); } return r; };
})();
