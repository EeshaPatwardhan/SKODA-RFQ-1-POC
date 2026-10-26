/* =====================================================================
   V8 · Part and vehicle photographs
   Real photographs are embedded at build time from assets/cars/<PROJECT-CODE>.jpg (five from the supplied Controlling PPT, Kodiaq from Wikimedia Commons;
   credits in assets/IMAGE_CREDITS.md) and, when supplied, assets/parts/<part-name>.jpg.  A part or project without a photograph shows no image.
   window.V8Art = { part(name, vertical, size), car(code), slug }
   ===================================================================== */
(function(){
"use strict";
const PHOTOS=/*V8_PHOTOS*/{parts:{},cars:{},credits:{}};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
/* size: "sm" (table thumbnail) or "lg" (details header) */
function part(name,vertical,size){
  const ph=PHOTOS.parts[slug(name)]; if(!ph) return "";
  return `<span class="va-part ${size==="lg"?"lg":"sm"}" role="img" aria-label="${esc(name)}"><img src="${ph}" alt="" loading="lazy"></span>`;
}
function car(code){
  const ph=PHOTOS.cars[code], prog=(typeof PocCore!=="undefined"?PocCore.PROGS:[]).find(p=>p.code===code); if(!ph||!prog) return "";
  const c=PHOTOS.credits[code];
  return `<span class="va-car" role="img" aria-label="${esc(prog.name+" — "+prog.segment)}"${c?` title="${esc(c.text)}"`:""}><img src="${ph}" alt=""></span>`;
}
/* the model line-up (assets/cars/ALL.jpg): shown where no single project is selected */
function lineup(){ const ph=PHOTOS.cars.ALL; return ph?`<span class="va-car" role="img" aria-label="SKODA model line-up"><img src="${ph}" alt=""></span>`:""; }
window.V8Art={part,car,slug,lineup};
})();
