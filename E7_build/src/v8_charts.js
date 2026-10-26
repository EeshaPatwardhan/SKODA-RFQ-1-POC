/* =====================================================================
   V8  ·  V8Charts — dependency-free SVG / HTML visuals for the SRM dashboards
   stacked bars · project timeline (gantt) · funnel · heat-map · gauge · ring · scatter
   Colours come from the prototype's theme tokens so light / dark both work.
   ===================================================================== */
const V8Charts = (function(){
"use strict";
const esc=PocCharts.esc, nf=PocCharts.nf;
const COL={ok:"var(--ok)",risk:"var(--c-amber)",delayed:"var(--red)",notstarted:"var(--faint)",brand:"var(--brand)",info:"var(--info)",line:"var(--line)",ink:"var(--ink)",muted:"var(--muted)"};
const LABEL={ok:"On track",risk:"At risk",delayed:"Delayed",notstarted:"Not started"};
const band=v=>v>=80?COL.ok:v>=60?COL.risk:COL.delayed;
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate=t=>{ const d=new Date(t); return d.getUTCDate()+" "+MON[d.getUTCMonth()]+" "+d.getUTCFullYear(); };
const monY=t=>{ const d=new Date(t); return MON[d.getUTCMonth()]+" "+String(d.getUTCFullYear()).slice(2); };

/* legend chips for the four statuses */
const legend=(keys)=>`<div class="v8-legend">${(keys||["ok","risk","delayed","notstarted"]).map(k=>`<span><i style="background:${COL[k]}"></i>${LABEL[k]}</span>`).join("")}</div>`;

/* horizontal stacked bars. rows:[{label,counts:{ok,risk,delayed,notstarted},onclick}] */
function stacked(rows,o){
  o=o||{}; const keys=o.keys||["ok","risk","delayed","notstarted"];
  const max=Math.max(1,...rows.map(r=>keys.reduce((s,k)=>s+(r.counts[k]||0),0)));
  return `<div class="v8-stk">${rows.map(r=>{ const tot=keys.reduce((s,k)=>s+(r.counts[k]||0),0);
    return `<div class="v8-stk-r${r.onclick?" click":""}" ${r.onclick?`data-act="${esc(r.onclick)}" role="button" tabindex="0"`:""}><div class="lb" title="${esc(r.label)}">${esc(r.label)}</div><div class="bar" style="width:${tot/max*100}%">${keys.map(k=>{ const n=r.counts[k]||0; return n?`<span style="flex:${n};background:${COL[k]}" title="${LABEL[k]}: ${n}">${n/tot>=0.1?n:""}</span>`:""; }).join("")}</div><div class="tt">${tot}</div></div>`; }).join("")}</div>${o.legend===false?"":legend(keys)}`;
}

/* funnel: items [{label,value}] — widths follow the value, first item = 100% */
function funnel(items,o){
  o=o||{}; const W=o.width||520, rowH=o.rowH||44, H=items.length*rowH+4, cx=W*0.5, maxW=W*0.5, minW=W*0.09;
  const first=Math.max(1,items[0].value), cols=o.colors||["#2b6cb0","#2f84c4","#2a9d9a","#3fae7a","#8cc34a","#c7d63f"];
  const w=i=>Math.max(minW,maxW*(items[i].value/first));
  let g=`<svg class="v8-funnel" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria||"Readiness funnel")}">`;
  items.forEach((it,i)=>{
    const top=w(i), bot=i<items.length-1?w(i+1):Math.max(minW*0.7,top*0.7), y=i*rowH+2, h=rowH-6;
    g+=`<polygon points="${cx-top/2},${y} ${cx+top/2},${y} ${cx+bot/2},${y+h} ${cx-bot/2},${y+h}" fill="${cols[i%cols.length]}" opacity=".92"><title>${esc(it.label)}: ${it.value}</title></polygon>`;
    g+=`<text x="4" y="${y+h/2+4}" class="v8-t" font-size="12">${esc(it.label)}</text>`;
    g+=`<text x="${W-4}" y="${y+h/2+4}" text-anchor="end" class="v8-t" font-size="12" font-weight="700">${it.value} <tspan font-weight="500" fill="${COL.muted}">(${Math.round(it.value/first*100)}%)</tspan></text>`;
  });
  return g+"</svg>";
}

/* heat-map table. rows/cols: labels; cell(r,c) -> {pct,text,title} | null */
function heat(rows,cols,cell,o){
  o=o||{}; const lo=o.lo==null?35:o.lo, hi=o.hi==null?50:o.hi;
  const shade=p=>p==null?"background:var(--line2)":p<lo?"background:rgba(46,158,107,.55)":p<hi?"background:rgba(240,160,48,.62)":"background:rgba(217,72,59,.62)";
  return `<table class="v8-heat"><thead><tr><th></th>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><th>${esc(r)}</th>${cols.map(c=>{ const x=cell(r,c); return `<td style="${shade(x?x.pct:null)}" title="${x?esc(x.title||""):"No started parts"}">${x&&x.text!=null?esc(x.text):""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>
  <div class="v8-legend">${o.legend||`<span><i style="background:rgba(46,158,107,.55)"></i>Low (&lt;${lo}% late)</span><span><i style="background:rgba(240,160,48,.62)"></i>Medium</span><span><i style="background:rgba(217,72,59,.62)"></i>High (&ge;${hi}%)</span>`}<span><i style="background:var(--line2)"></i>Not started</span></div>`;
}

/* half-circle gauge */
function gauge(pct,o){
  o=o||{}; const v=Math.max(0,Math.min(100,pct==null?0:pct)), L=Math.PI*90;
  return `<svg class="v8-gauge" viewBox="0 0 220 140" role="img" aria-label="${esc(o.aria||"gauge")}"><path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="var(--line2)" stroke-width="16" stroke-linecap="round"/>
    <path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="${band(v)}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${L*v/100} ${L}"/>
    <text x="110" y="100" text-anchor="middle" class="v8-t" font-size="30" font-weight="700">${pct==null?"—":Math.round(v)+"%"}</text><text x="110" y="124" text-anchor="middle" class="v8-t" font-size="12" fill="${COL.muted}">${esc(o.sub||"")}</text></svg>`;
}

/* KPI ring */
function ring(pct,o){
  const v=Math.max(0,Math.min(100,pct==null?0:pct)), r=22, c=2*Math.PI*r;
  return `<svg class="v8-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--line2)" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="${(o&&o.color)||band(v)}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c*v/100} ${c}" transform="rotate(-90 28 28)"/></svg>`;
}

/* project timeline. rows:[{label,sub,start,end,today,ms:[{id,t,st,fc,title}]}]  (all times in ms) */
function gantt(rows,o){
  o=o||{}; const W=o.width||900, LW=104, T=34, RH=o.rowH||46, H=T+rows.length*RH+16, today=o.today;
  const t0=Math.min(...rows.map(r=>r.start)), t1=Math.max(...rows.map(r=>r.end))+20*864e5;
  const X=t=>LW+(t-t0)/(t1-t0)*(W-LW-14);
  let g=`<svg class="v8-gantt" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria||"Project timeline")}">`;
  const d0=new Date(t0); let y=d0.getUTCFullYear(), m=Math.floor(d0.getUTCMonth()/3)*3;
  for(;;){ const t=Date.UTC(y,m,1); if(t>t1) break; if(t>=t0){ const x=X(t); g+=`<line x1="${x}" x2="${x}" y1="${T-6}" y2="${H-14}" stroke="${COL.line}" stroke-dasharray="2 4"/><text x="${x+3}" y="${T-12}" class="v8-t" font-size="10" fill="${COL.muted}">${MON[m]} ${String(y).slice(2)}</text>`; } m+=3; if(m>=12){ m=0; y++; } }
  rows.forEach((r,i)=>{
    const cy=T+i*RH+RH/2, x0=X(r.start), x1=X(r.end), xt=today!=null?X(Math.max(r.start,Math.min(today,r.end))):x0;
    g+=`<text x="4" y="${cy-1}" class="v8-t" font-size="12" font-weight="650">${esc(r.label)}</text>${r.sub?`<text x="4" y="${cy+12}" class="v8-t" font-size="10" fill="${COL.muted}">${esc(r.sub)}</text>`:""}`;
    g+=`<rect x="${x0}" y="${cy-6}" width="${Math.max(2,x1-x0)}" height="12" rx="6" fill="var(--line2)"/>`;
    if(today!=null&&today>r.start) g+=`<rect x="${x0}" y="${cy-6}" width="${Math.max(2,xt-x0)}" height="12" rx="6" fill="${COL.info}" opacity=".85"/>`;
    r.ms.forEach((m,j)=>{
      const x=X(m.t), up=j%2===0, col=COL[m.st]||COL.ok;
      if(o.forecast&&m.fc!=null&&Math.abs(m.fc-m.t)>2*864e5){ const xf=X(m.fc); g+=`<line x1="${x}" x2="${xf}" y1="${cy}" y2="${cy}" stroke="${col}" stroke-width="2" stroke-dasharray="3 2"/><path d="M${xf} ${cy-6}L${xf+6} ${cy}L${xf} ${cy+6}L${xf-6} ${cy}Z" fill="var(--panel)" stroke="${col}" stroke-width="2"><title>${esc(m.id)} forecast ${fmtDate(m.fc)}</title></path>`; }
      g+=`<path d="M${x} ${cy-8}L${x+8} ${cy}L${x} ${cy+8}L${x-8} ${cy}Z" fill="${col}" stroke="var(--panel)" stroke-width="1.5"><title>${esc(m.title||m.id+" · "+fmtDate(m.t))}</title></path>`;
      g+=`<text x="${x}" y="${up?cy-13:cy+23}" text-anchor="middle" class="v8-t" font-size="10" font-weight="650">${esc(m.id)}</text>`;
    });
  });
  if(today!=null){ const xt=X(today); g+=`<line x1="${xt}" x2="${xt}" y1="${T-6}" y2="${H-14}" stroke="${COL.delayed}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${xt}" y="${H-3}" text-anchor="middle" class="v8-t" font-size="10" font-weight="700" fill="${COL.delayed}">Today ${fmtDate(today)}</text>`; }
  return `<div class="v8-gantt-wrap">${g}</svg></div>`;
}

/* bubble scatter. points:[{x,y,r,color,label,title,click}] */
function scatter(points,o){
  o=o||{}; const W=o.width||560, H=o.height=o.height||320, m={l:48,r:14,t:12,b:40};
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
  const x0=Math.floor(Math.min(...xs)/5)*5-2, x1=Math.ceil(Math.max(...xs)/5)*5+2, y0=Math.floor(Math.min(...ys)/5)*5-2, y1=Math.ceil(Math.max(...ys)/5)*5+2;
  const X=v=>m.l+(v-x0)/(x1-x0)*(W-m.l-m.r), Y=v=>m.t+(1-(v-y0)/(y1-y0))*(H-m.t-m.b);
  const rMax=Math.max(...points.map(p=>p.r));
  let g=`<svg class="v8-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria||"scatter")}">`;
  for(let v=Math.ceil(y0/10)*10;v<=y1;v+=10) g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.line}" stroke-dasharray="2 4"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end" class="v8-t" font-size="10" fill="${COL.muted}">${v}</text>`;
  for(let v=Math.ceil(x0/10)*10;v<=x1;v+=10) g+=`<line y1="${m.t}" y2="${H-m.b}" x1="${X(v)}" x2="${X(v)}" stroke="${COL.line}" stroke-dasharray="2 4"/><text x="${X(v)}" y="${H-m.b+14}" text-anchor="middle" class="v8-t" font-size="10" fill="${COL.muted}">${v}</text>`;
  g+=`<text x="${(m.l+W-m.r)/2}" y="${H-6}" text-anchor="middle" class="v8-t" font-size="11" fill="${COL.muted}">${esc(o.xLabel||"")}</text><text transform="translate(12 ${(m.t+H-m.b)/2}) rotate(-90)" text-anchor="middle" class="v8-t" font-size="11" fill="${COL.muted}">${esc(o.yLabel||"")}</text>`;
  points.slice().sort((a,b)=>b.r-a.r).forEach(p=>{ const r=6+p.r/rMax*9;
    g+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${r}" fill="${p.color}" fill-opacity=".72" stroke="${p.color}" stroke-width="1.5" ${p.click?`data-act="${esc(p.click)}" style="cursor:pointer"`:""}><title>${esc(p.title||p.label)}</title></circle>`;
    if(p.showLabel) g+=`<text x="${X(p.x)+r+3}" y="${Y(p.y)+3}" class="v8-t" font-size="10">${esc(p.label)}</text>`; });
  return `<div class="v8-scatter-wrap">${g}</svg></div>`;
}

return {COL,LABEL,band,legend,stacked,funnel,heat,gauge,ring,gantt,scatter,fmtDate,monY};
})();
