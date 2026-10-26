/* =====================================================================
   E7  ·  PocCharts — dependency-free SVG chart helpers (return HTML strings)
   Theme-aware: colours are CSS variables, so light / dark both work.
   ===================================================================== */
const PocCharts = (function(){
"use strict";
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const C = {brand:"var(--brand)",info:"var(--info)",amber:"var(--c-amber)",red:"var(--red)",ok:"var(--ok)",muted:"var(--muted)",faint:"var(--faint)",line:"var(--line)",ink:"var(--ink)",anchor:"var(--c-anchor)"};
const nf = (v,d=0)=>(+v).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
function niceTicks(lo,hi,n){
  if(!(hi>lo)){ hi=lo+1; }
  const span=hi-lo, step0=span/n, mag=Math.pow(10,Math.floor(Math.log10(step0))), r=step0/mag;
  const step=(r<1.5?1:r<3?2:r<7?5:10)*mag;
  const a=Math.floor(lo/step)*step, b=Math.ceil(hi/step)*step, t=[];
  for(let v=a; v<=b+step*0.001; v+=step) t.push(+v.toFixed(10));
  return t;
}

/* line chart: series [{name,data,color,dash,width,dot}], labels, optional band {lo,hi,color}, split = index where the forecast begins */
function line(o){
  const W=o.width||720, Ht=o.height||260, m={l:o.mLeft||62,r:14,t:14,b:34};
  const iw=W-m.l-m.r, ih=Ht-m.t-m.b, N=o.labels.length;
  const fmt=o.yFmt||(v=>nf(v));
  let vals=[]; o.series.forEach(s=>s.data.forEach(v=>{ if(v!=null&&isFinite(v)) vals.push(v); }));
  if(o.band){ o.band.lo.forEach(v=>v!=null&&vals.push(v)); o.band.hi.forEach(v=>v!=null&&vals.push(v)); }
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(o.zero) lo=Math.min(lo,0);
  const pad=(hi-lo)*.08||1; if(!o.zero) lo-=pad; hi+=pad;
  const ticks=niceTicks(lo,hi,4); lo=Math.min(lo,ticks[0]); hi=Math.max(hi,ticks[ticks.length-1]);
  const X=i=>m.l+(N>1? i/(N-1)*iw : iw/2), Y=v=>m.t+(1-(v-lo)/(hi-lo))*ih;
  let g=`<svg class="pc-chart" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(o.aria||"chart")}" preserveAspectRatio="xMidYMid meet">`;
  ticks.forEach(t=>{ const y=Y(t); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width="1" ${t===0?'':'stroke-dasharray="2 4"'}/><text x="${m.l-8}" y="${y+4}" text-anchor="end" class="pc-t">${esc(fmt(t))}</text>`; });
  (o.shade||[]).forEach(z=>{ const x0=X(z.from), x1=X(z.to); g+=`<rect x="${Math.min(x0,x1)}" y="${m.t}" width="${Math.abs(x1-x0)}" height="${ih}" fill="${z.color||"var(--brand-soft)"}" opacity="${z.opacity||.6}"/>${z.label?`<text x="${Math.min(x0,x1)+6}" y="${m.t+12}" class="pc-t" fill="${z.textColor||"var(--brand)"}" font-weight="700">${esc(z.label)}</text>`:""}`; });
  if(o.split!=null && o.split<N){ const x0=X(o.split-.5>=0?o.split-.5:0); g+=`<rect x="${x0}" y="${m.t}" width="${W-m.r-x0}" height="${ih}" fill="var(--brand-soft)" opacity=".55"/><text x="${x0+6}" y="${m.t+12}" class="pc-t" fill="var(--brand)">${esc(o.splitLabel||"Forecast")}</text>`; }
  if(o.band){
    let up="", dn=[];
    o.band.hi.forEach((v,i)=>{ if(v==null) return; up+=(up?"L":"M")+X(i)+" "+Y(v); });
    for(let i=o.band.lo.length-1;i>=0;i--){ const v=o.band.lo[i]; if(v==null) continue; dn.push("L"+X(i)+" "+Y(v)); }
    if(up) g+=`<path d="${up}${dn.join("")}Z" fill="${o.band.color||C.brand}" opacity=".16"/>`;
  }
  // x labels
  const every=Math.max(1,Math.ceil(N/(o.maxX||8)));
  o.labels.forEach((l,i)=>{ if(i%every===0||(i===N-1&&(N-1)%every>=every/2)) g+=`<text x="${X(i)}" y="${Ht-12}" text-anchor="middle" class="pc-t">${esc(l)}</text>`; });
  (o.marks||[]).forEach(mk=>{ const x=X(mk.i); g+=`<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t+ih}" stroke="${mk.color||C.faint}" stroke-dasharray="${mk.dash||"3 3"}" stroke-width="1"/><text x="${x+(mk.dx!=null?mk.dx:4)}" y="${m.t+(mk.y||12)}" class="pc-t" ${mk.anchor?`text-anchor="${mk.anchor}"`:""}>${esc(mk.label)}</text>`; });
  o.series.forEach(s=>{
    let d="", pen=false;
    s.data.forEach((v,i)=>{ if(v==null||!isFinite(v)){ pen=false; return; } d+=(pen?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1); pen=true; });
    if(s.area && d) g+=`<path d="${d}L${X(s.data.length-1)} ${m.t+ih}L${X(0)} ${m.t+ih}Z" fill="${s.color||C.brand}" opacity=".10"/>`;
    g+=`<path d="${d}" fill="none" stroke="${s.color||C.brand}" stroke-width="${s.width||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:""} stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.dots) s.data.forEach((v,i)=>{ if(v!=null&&isFinite(v)&&(s.dots===true||s.dots(i,v))) g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="${s.dotR||3.6}" fill="${s.dotFill||"var(--panel)"}" stroke="${s.color||C.brand}" stroke-width="2"/>`; });
    if(s.labelAt) s.labelAt.forEach(i=>{ const v=s.data[i]; if(v!=null&&isFinite(v)) g+=`<text x="${X(i)}" y="${Y(v)-10}" text-anchor="middle" class="pc-t" font-weight="700" fill="${s.color||C.brand}">${esc((s.labelFmt||fmt)(v))}</text>`; });
  });
  // hover targets (native tooltip)
  if(o.hover!==false) for(let i=0;i<N;i++){
    const rows=o.series.filter(s=>s.data[i]!=null).map(s=>`${s.name}: ${fmt(s.data[i])}`);
    if(o.band&&o.band.hi[i]!=null) rows.push(`Range: ${fmt(o.band.lo[i])} – ${fmt(o.band.hi[i])}`);
    if(!rows.length) continue;
    if(o.tip){   // styled tooltip (see the tooltip block at the end of this file): date, one coloured row per series, optional extra row, guide line
      const tr=o.series.filter(s=>s.data[i]!=null).map(s=>({n:s.name,v:fmt(s.data[i]),c:s.color||C.brand,d:!!s.dash})), ex=o.tipExtra?o.tipExtra(i):null;
      g+=`<rect class="pc-hit" x="${X(i)-iw/N/2}" y="${m.t}" width="${iw/N}" height="${ih}" fill="transparent" data-cx="${X(i).toFixed(1)}" data-tip="${esc(JSON.stringify({t:o.labels[i],r:tr,x:ex}))}"/>`;
    } else
    g+=`<rect x="${X(i)-iw/N/2}" y="${m.t}" width="${iw/N}" height="${ih}" fill="transparent"><title>${esc(o.labels[i])}\n${esc(rows.join("\n"))}</title></rect>`;
  }
  if(o.tip) g+=`<line class="pc-guide" x1="0" x2="0" y1="${m.t}" y2="${m.t+ih}" style="display:none"/>`;
  g+="</svg>";
  const legend=o.legend===false?"":`<div class="pc-legend">${o.series.map(s=>`<span><i style="background:${s.color||C.brand};${s.dash?"height:0;border-top:2px dashed "+(s.color||C.brand)+";background:none;":""}"></i>${esc(s.name)}</span>`).join("")}${o.band?`<span><i style="background:${o.band.color||C.brand};opacity:.35"></i>${esc(o.band.name||"Interval")}</span>`:""}</div>`;
  return `<div class="pc-wrap">${g}${legend}</div>`;
}

/* horizontal bars: items [{label,value,color,note}]; signed => centred on zero (cost up red / down green) */
function bars(o){
  const items=o.items, fmt=o.fmt||(v=>nf(v,1)), signed=!!o.signed;
  const maxAbs=Math.max(o.max||0,...items.map(i=>Math.abs(i.value)),1e-9);
  const rows=items.map(it=>{
    const w=Math.abs(it.value)/maxAbs*100;
    const col=it.color||(signed?(it.value>0?C.red:C.ok):C.brand);
    let bar;
    if(signed){
      bar=`<div class="pc-bar signed"><div class="axis"></div><div class="fill" style="${it.value>=0?`left:50%;width:${w/2}%`:`right:50%;width:${w/2}%`};background:${col}"></div></div>`;
    } else bar=`<div class="pc-bar"><div class="fill" style="width:${w}%;background:${col}"></div></div>`;
    return `<div class="pc-row${it.onclick?" click":""}" ${it.onclick?`data-act="${esc(it.onclick)}" tabindex="0" role="button"`:""}><div class="lb" title="${esc(it.label)}">${esc(it.label)}${it.note?`<small>${esc(it.note)}</small>`:""}</div>${bar}<div class="vl" style="color:${signed?col:"inherit"}">${esc(it.text!=null?it.text:fmt(it.value))}</div></div>`;
  }).join("");
  return `<div class="pc-bars">${rows}</div>`;
}

/* waterfall: steps [{label,value,kind:'total'|'bridge'}] */
function waterfall(o){
  const steps=o.steps, W=o.width||720, Ht=o.height||280, m={l:56,r:10,t:16,b:o.rotate?92:(o.ends?34:64)};   // rotate: slanted one-line labels for narrow screens
  const iw=W-m.l-m.r, ih=Ht-m.t-m.b, fmt=o.fmt||(v=>nf(v));
  let run=0; const pts=steps.map(s=>{ let a,b; if(s.kind==="total"){ a=0; b=s.value; run=s.value; } else { a=run; b=run+s.value; run=b; } return {...s,a,b}; });
  const all=pts.flatMap(p=>[p.a,p.b]); let lo=Math.min(...all), hi=Math.max(...all);
  const floor=o.floor!=null?o.floor:Math.max(0,lo-(hi-lo)*.35); lo=floor; hi+= (hi-lo)*.06;
  const Y=v=>m.t+(1-(Math.max(v,lo)-lo)/(hi-lo))*ih, bw=iw/steps.length*.62, X=i=>m.l+iw/steps.length*(i+.5);
  let g=`<svg class="pc-chart" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(o.aria||"waterfall")}">`;
  niceTicks(lo,hi,4).forEach(t=>{ if(t<lo||t>hi) return; const y=Y(t); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-dasharray="2 4"/><text x="${m.l-6}" y="${y+4}" text-anchor="end" class="pc-t">${esc(fmt(t))}</text>`; });
  pts.forEach((p,i)=>{
    const top=Y(Math.max(p.a,p.b)), bot=Y(Math.min(p.a,p.b)), col=p.kind==="total"?C.anchor:(p.value>=0?C.red:C.ok);
    const tp=o.tip&&p.tip?` data-tip="${esc(JSON.stringify(p.tip))}"`:"";
    g+=`<rect class="${tp?"pc-wf":""}" x="${X(i)-bw/2}" y="${top}" width="${bw}" height="${Math.max(2,bot-top)}" rx="3" fill="${col}"${tp}>${tp?"":`<title>${esc(p.label)}: ${esc(fmt(p.value))}${p.note?"\n"+esc(p.note):""}</title>`}</rect>`;
    if(tp) g+=`<rect class="pc-hit" x="${X(i)-iw/steps.length/2}" y="${m.t}" width="${iw/steps.length}" height="${ih}" fill="transparent"${tp}/>`;
    g+=`<text x="${X(i)}" y="${top-5}" text-anchor="middle" class="pc-t" font-weight="700">${esc(p.kind==="total"?fmt(p.value):(p.value>=0?"+":"")+fmt(p.value))}</text>`;
    if(o.ends&&i>0&&i<pts.length-1){ if(i<pts.length-1) g+=`<line x1="${X(i)+bw/2}" x2="${X(i+1)-bw/2}" y1="${Y(p.b)}" y2="${Y(p.b)}" stroke="${C.faint}" stroke-dasharray="2 3"/>`; return; }
    const words=String(p.label).split(" "); const l1=words.slice(0,Math.ceil(words.length/2)).join(" "), l2=words.slice(Math.ceil(words.length/2)).join(" ");
    if(o.rotate){ const lb=String(p.label), sh=lb.length>26?lb.slice(0,25)+"…":lb; g+=`<text transform="translate(${X(i)+4} ${Ht-m.b+12}) rotate(-38)" text-anchor="end" class="pc-t">${esc(sh)}</text>`; }
    else g+=`<text x="${X(i)}" y="${Ht-m.b+16}" text-anchor="middle" class="pc-t">${esc(l1)}</text>${l2?`<text x="${X(i)}" y="${Ht-m.b+29}" text-anchor="middle" class="pc-t">${esc(l2)}</text>`:""}`;
    if(i<pts.length-1) g+=`<line x1="${X(i)+bw/2}" x2="${X(i+1)-bw/2}" y1="${Y(p.b)}" y2="${Y(p.b)}" stroke="${C.faint}" stroke-dasharray="2 3"/>`;
  });
  return `<div class="pc-wrap">${g}</svg></div>`;
}

/* vertical bars with optional prediction-interval whiskers: items [{label,value,lo,hi,color}] */
function vbars(o){
  const it=o.items, W=o.width||520, Ht=o.height||250, m={l:o.mLeft||58,r:12,t:20,b:30}, iw=W-m.l-m.r, ih=Ht-m.t-m.b, fmt=o.yFmt||(v=>nf(v));
  const hi=Math.max(...it.map(i=>i.hi!=null?i.hi:i.value)), lo0=Math.min(0,...it.map(i=>i.lo!=null?i.lo:i.value));
  const ticks=niceTicks(lo0,hi*1.04,4), top=Math.max(ticks[ticks.length-1],hi), bot=Math.min(ticks[0],lo0);
  const Y=v=>m.t+(1-(v-bot)/(top-bot))*ih, bw=Math.min(54,iw/it.length*.6), X=i=>m.l+iw/it.length*(i+.5);
  let g=`<svg class="pc-chart" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(o.aria||"bar chart")}">`;
  ticks.forEach(t=>{ const y=Y(t); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-dasharray="2 4"/><text x="${m.l-8}" y="${y+4}" text-anchor="end" class="pc-t">${esc(fmt(t))}</text>`; });
  it.forEach((b,i)=>{ const y=Y(Math.max(b.value,0)), y0=Y(Math.min(b.value,0)), x=X(i);
    g+=`<rect x="${x-bw/2}" y="${y}" width="${bw}" height="${Math.max(1,y0-y)}" rx="5" fill="${b.color||C.brand}"><title>${esc(b.label)}: ${esc(fmt(b.value))}${b.lo!=null?"\n"+esc(o.rangeLabel||"Range")+": "+esc(fmt(b.lo))+" to "+esc(fmt(b.hi)):""}</title></rect>`;
    if(b.lo!=null&&b.hi!=null) g+=`<g stroke="${C.muted}" stroke-width="1.3"><line x1="${x}" x2="${x}" y1="${Y(b.lo)}" y2="${Y(b.hi)}"/><line x1="${x-5}" x2="${x+5}" y1="${Y(b.lo)}" y2="${Y(b.lo)}"/><line x1="${x-5}" x2="${x+5}" y1="${Y(b.hi)}" y2="${Y(b.hi)}"/></g>`;
    g+=`<text x="${x}" y="${Ht-10}" text-anchor="middle" class="pc-t">${esc(b.label)}</text>`; });
  return `<div class="pc-wrap">${g}</svg></div>`;
}

/* bars (left axis) + optional line (right axis): items [{label,value,color,text}], line {name,data,color,fmt,dash} */
function combo(o){
  const it=o.items, W=o.width||520, Ht=o.height||240, m={l:o.mLeft||50,r:o.line?46:12,t:16,b:30}, iw=W-m.l-m.r, ih=Ht-m.t-m.b, fmt=o.yFmt||(v=>nf(v,1));
  const vs=it.map(i=>i.value), lo=Math.min(0,...vs), hi=Math.max(0,...vs)||1, ticks=niceTicks(lo,hi*1.1,4), top=Math.max(...ticks), bot=Math.min(...ticks);
  const Y=v=>m.t+(1-(v-bot)/(top-bot))*ih, bw=Math.min(48,iw/it.length*.6), X=i=>m.l+iw/it.length*(i+.5);
  let y2=null, t2=[]; if(o.line){ const lv=o.line.data.filter(v=>v!=null), l2=Math.min(0,...lv), h2=Math.max(...lv,0.0001); t2=niceTicks(l2,h2*1.1,4); const a=Math.min(...t2), b=Math.max(...t2); y2=v=>m.t+(1-(v-a)/(b-a))*ih; }
  let g=`<svg class="pc-chart" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(o.aria||"chart")}">`;
  ticks.forEach(t=>{ const y=Y(t); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-dasharray="2 4"/><text x="${m.l-8}" y="${y+4}" text-anchor="end" class="pc-t">${esc(fmt(t))}</text>`; });
  if(o.line) t2.forEach(t=>{ g+=`<text x="${W-m.r+6}" y="${y2(t)+4}" class="pc-t" fill="${o.line.color||C.amber}">${esc((o.line.fmt||(v=>nf(v,2)))(t))}</text>`; });
  g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.faint}"/>`;
  it.forEach((b,i)=>{ const x=X(i); g+=`<rect x="${x-bw/2}" y="${Y(Math.max(b.value,0))}" width="${bw}" height="${Math.max(1,Math.abs(Y(0)-Y(b.value)))}" rx="4" fill="${b.color||C.brand}"><title>${esc(b.label)}: ${esc(b.text!=null?b.text:fmt(b.value))}</title></rect><text x="${x}" y="${Ht-10}" text-anchor="middle" class="pc-t">${esc(b.label)}</text>`; });
  if(o.line){ const pts=o.line.data.map((v,i)=>v==null?null:[X(i),y2(v)]).filter(Boolean); g+=`<path d="${pts.map((p,i)=>(i?"L":"M")+p[0]+" "+p[1]).join("")}" fill="none" stroke="${o.line.color||C.amber}" stroke-width="2" ${o.line.dash?`stroke-dasharray="${o.line.dash}"`:""}/>`+pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${o.line.color||C.amber}"/>`).join(""); }
  const lg=`<div class="pc-legend"><span><i style="background:${o.barColor||C.info}"></i>${esc(o.barName||"Bars")}</span>${o.line?`<span><i style="background:${o.line.color||C.amber}"></i>${esc(o.line.name)}</span>`:""}</div>`;
  return `<div class="pc-wrap">${g}</svg>${lg}</div>`;
}

/* grouped vertical bars: groups [{label,values:[v1,v2]}], series [{name,color}] */
function gvbars(o){
  const gs=o.groups, ns=o.series.length, W=o.width||520, Ht=o.height||210, m={l:o.mLeft||42,r:8,t:12,b:30}, iw=W-m.l-m.r, ih=Ht-m.t-m.b, fmt=o.yFmt||(v=>nf(v,1));
  const hi=Math.max(...gs.flatMap(x=>x.values.filter(v=>v!=null)),0.0001), ticks=niceTicks(0,hi*1.1,4), top=Math.max(...ticks), Y=v=>m.t+(1-v/top)*ih, gw=iw/gs.length, bw=Math.min(26,gw*.7/ns);
  let g=`<svg class="pc-chart" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(o.aria||"grouped bars")}">`;
  ticks.forEach(t=>{ g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}" stroke-dasharray="2 4"/><text x="${m.l-6}" y="${Y(t)+4}" text-anchor="end" class="pc-t">${esc(fmt(t))}</text>`; });
  gs.forEach((x,i)=>{ const cx=m.l+gw*(i+.5); x.values.forEach((v,k)=>{ if(v==null) return; g+=`<rect x="${cx-ns*bw/2+k*bw}" y="${Y(v)}" width="${bw-2}" height="${Math.max(1,Y(0)-Y(v))}" rx="3" fill="${o.series[k].color}"><title>${esc(o.series[k].name)} ${esc(x.label)}: ${esc(fmt(v))}</title></rect>`; }); g+=`<text x="${cx}" y="${Ht-10}" text-anchor="middle" class="pc-t">${esc(x.label)}</text>`; });
  return `<div class="pc-wrap">${g}</svg><div class="pc-legend">${o.series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div></div>`;
}

function spark(values,o){
  o=o||{}; const w=o.w||90, h=o.h||26, lo=Math.min(...values), hi=Math.max(...values), d=(hi-lo)||1;
  const pts=values.map((v,i)=>[i/(values.length-1)*(w-2)+1,h-2-((v-lo)/d)*(h-4)]);
  const path=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join("");
  const last=pts[pts.length-1];
  return `<svg class="pc-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path}" fill="none" stroke="${o.color||C.brand}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="${o.color||C.brand}"/></svg>`;
}

function donut(items,o){
  o=o||{}; const S=o.size||150, r=S/2-S*.08-3, c=S/2, tot=items.reduce((s,i)=>s+i.value,0)||1;
  const pal=[C.brand,C.info,C.amber,C.red,"#7c5cbf","#2a9d8f","#e76f51","#8a9a93","#4d7c0f","#be185d"];
  let a0=-Math.PI/2, g=`<svg class="pc-donut" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(o.aria||"share")}">`;
  items.forEach((it,i)=>{
    const a1=a0+it.value/tot*Math.PI*2, large=a1-a0>Math.PI?1:0;
    const p=(a,rr)=>[c+rr*Math.cos(a),c+rr*Math.sin(a)];
    const [x0,y0]=p(a0,r),[x1,y1]=p(Math.min(a1,a0+Math.PI*2-.0001),r);
    g+=`<path d="M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${it.color||pal[i%pal.length]}" stroke-width="${S*.16}"><title>${esc(it.label)}: ${nf(it.value/tot*100,1)}%</title></path>`;
    a0=a1;
  });
  g+=`<text x="${c}" y="${c+(o.centerSub?0:4)}" text-anchor="middle" class="pc-t" font-weight="700" font-size="14" fill="var(--ink)">${esc(o.center||"")}</text>${o.centerSub?`<text x="${c}" y="${c+14}" text-anchor="middle" class="pc-t">${esc(o.centerSub)}</text>`:""}</svg>`;
  const lg=`<ul class="pc-dl">${items.map((it,i)=>`<li><i style="background:${it.color||pal[i%pal.length]}"></i><span>${esc(it.label)}</span><b>${nf(it.value/tot*100,1)}%</b></li>`).join("")}</ul>`;
  return `<div class="pc-donutwrap">${g}${lg}</div>`;
}

return {line,bars,vbars,combo,gvbars,waterfall,spark,donut,esc,nf,C,niceTicks};
})();

/* styled chart tooltip: charts built with { tip:true } carry data-tip on their hover bands */
(function(){
  if(typeof document==="undefined"||window.__pcTip) return; window.__pcTip=1;
  let box=null; const EH=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const get=()=>box||(box=Object.assign(document.createElement("div"),{className:"pc-tipbox"}),document.body.appendChild(box),box);
  const hit=e=>e.target&&e.target.closest&&e.target.closest("[data-tip]");
  document.addEventListener("mouseover",e=>{ const h=hit(e); if(!h) return; let d; try{ d=JSON.parse(h.getAttribute("data-tip")); }catch(x){ return; }
    const b=get(); b.innerHTML=`<div class="t">${EH(d.t)}</div>${d.r.map(r=>`<div class="r"><i style="${r.d?`border-top:2px dashed ${r.c};background:none;height:0`:`background:${r.c}`}"></i><span>${EH(r.n)}</span><b>${EH(r.v)}</b></div>`).join("")}${d.x?`<div class="x"><span>${EH(d.x.k)}</span><b class="${EH(d.x.tone||"")}">${EH(d.x.v)}</b></div>`:""}`; b.style.display="block";
    const gl=h.ownerSVGElement&&h.ownerSVGElement.querySelector(".pc-guide"); if(gl){ const cx=h.getAttribute("data-cx"); gl.setAttribute("x1",cx); gl.setAttribute("x2",cx); gl.style.display=""; } });
  document.addEventListener("mousemove",e=>{ if(!box||box.style.display==="none"||!hit(e)) return; const w=box.offsetWidth, hgt=box.offsetHeight; let x=e.clientX+16, y=e.clientY-hgt-12; if(x+w>innerWidth-8) x=e.clientX-w-16; if(y<8) y=e.clientY+18; box.style.left=x+"px"; box.style.top=y+"px"; });
  document.addEventListener("mouseout",e=>{ const h=hit(e); if(!h) return; if(e.relatedTarget&&h.contains&&h.contains(e.relatedTarget)) return; if(box) box.style.display="none"; const gl=h.ownerSVGElement&&h.ownerSVGElement.querySelector(".pc-guide"); if(gl) gl.style.display="none"; });
})();
