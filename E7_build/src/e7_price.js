/* =====================================================================
   E7  ·  Price-version helpers (timeline / price walk / stats) reused by Procurement › Price Analysis
   Replaces E6's screen (versions list + one bar chart) and the E7 forecast add-on that sat under it. Everything here is
   history: the recorded price versions, the monthly price panel behind them and what drove each step. Forecasts live in
   Forecast & risk, not here.
   ===================================================================== */
(function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, esc=C.esc, nf=C.nf, A=()=>window.__priceApi;
const inr=(v,d)=>U.inr(v,d), sgn=(v,d)=>U.sgn(v,d==null?1:d);
const fmtDate=d=>{ try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch(e){ return String(d); } };
const monthKey=d=>String(d).slice(0,7);
const nextMonth=k=>{ let y=+k.slice(0,4), m=+k.slice(5,7)+1; if(m>12){ m=1; y++; } return y+"-"+String(m).padStart(2,"0"); };
const dayDiff=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const pct=(a,b)=>b?(a/b-1)*100:0;
let ACTIVE=null;

function stats(versions){
  const first=versions[0], last=versions[versions.length-1];
  const steps=versions.slice(1).map((v,i)=>({v,prev:versions[i],d:v.price-versions[i].price,pct:pct(v.price,versions[i].price)}));
  const gross=steps.reduce((s,x)=>s+Math.abs(x.d),0)||1;
  const big=steps.slice().sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0];
  const days=dayDiff(first.effectiveFrom,last.effectiveFrom);
  const total=pct(last.price,first.price);
  const perYear=days>=180?(Math.pow(last.price/first.price,365/days)-1)*100:null;
  return {first,last,steps,gross,big,days,total,perYear};
}

/* Price over time — one picture: the monthly price, the recorded price in force (stepping at each version, each step labelled),
   and the Target / VSI baselines with the gap to today's price shaded. */
function timelineChart(versions,p,vsi,tgt){
  if(!p) return "";
  const last=versions[versions.length-1];
  let months=P.MONTHS.slice(); const endKey=[monthKey(last.effectiveFrom),months[months.length-1]].sort().pop();
  while(months[months.length-1]<endKey) months.push(nextMonth(months[months.length-1]));
  const N=months.length, idx=v=>Math.max(0,months.indexOf(monthKey(v.effectiveFrom)));
  const panel=p.h.concat(new Array(N-p.h.length).fill(null));
  const vi=versions.map(idx), step=new Array(N).fill(null);
  for(let i=vi[0];i<N;i++){ let k=0; versions.forEach((v,j)=>{ if(vi[j]<=i) k=j; }); step[i]=versions[k].price; }
  const W=960, H=348, m={l:74,r:104,t:46,b:34}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const vals=panel.concat(step).concat(vsi?[vsi]:[],tgt?[tgt]:[]).filter(v=>v!=null);
  let lo=Math.min(...vals), hi=Math.max(...vals); const pad=(hi-lo)*.14||hi*.05; lo-=pad*.7; hi+=pad*1.1;
  const ticks=C.niceTicks(lo,hi,4); lo=Math.min(lo,ticks[0]); hi=Math.max(hi,ticks[ticks.length-1]);
  const X=i=>m.l+i/(N-1)*iw, Y=v=>m.t+(1-(v-lo)/(hi-lo))*ih, f=n=>Math.round(n*10)/10;
  const T=(x,y,t,o)=>{ o=o||{}; return `<text x="${f(x)}" y="${f(y)}" text-anchor="${o.a||"middle"}" font-size="${o.s||11}" font-weight="${o.w||400}" fill="${o.c||"var(--muted)"}"${o.halo?` stroke="var(--panel)" stroke-width="4" stroke-linejoin="round" paint-order="stroke"`:""}>${esc(t)}</text>`; };
  const pill=(x,y,t,col,anchor)=>{ const w=t.length*6.6+14, x0=anchor==="start"?x:x-w/2; return `<g><rect x="${f(x0)}" y="${f(y-10)}" width="${f(w)}" height="20" rx="10" fill="${col}"/>${T(x0+w/2,y+4,t,{c:"#fff",w:700,s:11})}</g>`; };
  let g=`<svg class="ph-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price history of ${esc(p.name)}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="ph-ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--muted)" stop-opacity=".22"/><stop offset="1" stop-color="var(--muted)" stop-opacity="0"/></linearGradient></defs>`;
  ticks.forEach(t=>{ const y=Y(t); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${f(y)}" y2="${f(y)}" stroke="var(--line)" stroke-dasharray="2 5"/>${T(m.l-10,y+4,inr(t),{a:"end"})}`; });
  months.forEach((k,i)=>{ if(+k.slice(5,7)===1||i===0){ g+=`<line x1="${f(X(i))}" x2="${f(X(i))}" y1="${m.t}" y2="${m.t+ih}" stroke="var(--line2)"/>${T(X(i),H-10,k.slice(0,4),{w:600})}`; } });
  /* nomination → today band behind everything */
  g+=`<rect x="${f(X(vi[0]))}" y="${m.t}" width="${f(X(N-1)-X(vi[0]))}" height="${ih}" fill="var(--brand-soft)" opacity=".35"/>`;
  /* gap between today's price and the target */
  if(tgt){ const xs=X(vi[vi.length-1]), xe=X(N-1), y1=Y(tgt), y2=Y(last.price), over=last.price>tgt;
    g+=`<rect x="${f(xs)}" y="${f(Math.min(y1,y2))}" width="${f(xe-xs)}" height="${f(Math.abs(y2-y1))}" fill="${over?"var(--red)":"var(--ok)"}" opacity=".13"/>`; }
  /* baselines */
  const tags=[];
  if(tgt){ g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${f(Y(tgt))}" y2="${f(Y(tgt))}" stroke="var(--ok)" stroke-width="1.6" stroke-dasharray="6 5"/>`; tags.push({y:Y(tgt),t:"Target "+inr(tgt),c:"var(--ok)"}); }
  if(vsi){ g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${f(Y(vsi))}" y2="${f(Y(vsi))}" stroke="var(--c-amber)" stroke-width="1.6" stroke-dasharray="6 5"/>`; tags.push({y:Y(vsi),t:"VSI "+inr(vsi),c:"var(--c-amber)"}); }
  tags.sort((a,b)=>a.y-b.y); for(let i=1;i<tags.length;i++) if(tags[i].y-tags[i-1].y<22) tags[i].y=tags[i-1].y+22;
  tags.forEach(t=>{ g+=pill(W-m.r+8,t.y,t.t,t.c,"start"); });
  /* monthly price: soft area + thin line */
  let d="", pen=false; panel.forEach((v,i)=>{ if(v==null){ pen=false; return; } d+=(pen?"L":"M")+f(X(i))+" "+f(Y(v)); pen=true; });
  const lastPanel=panel.map((v,i)=>v==null?-1:i).reduce((a,b)=>Math.max(a,b),-1);
  if(d) g+=`<path d="${d}L${f(X(lastPanel))} ${m.t+ih}L${f(X(0))} ${m.t+ih}Z" fill="url(#ph-ar)"/><path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-linejoin="round" opacity=".8"/>`;
  /* recorded price in force: stepped line */
  let sd=""; versions.forEach((v,j)=>{ const x=X(vi[j]), y=Y(v.price), nx=X(j<versions.length-1?vi[j+1]:N-1); sd+=(j?`L${f(x)} ${f(Y(versions[j-1].price))}`:`M${f(x)} ${f(y)}`)+`L${f(x)} ${f(y)}L${f(nx)} ${f(y)}`; });
  g+=`<path d="${sd}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  /* version markers with price + what changed; tags are placed so that neighbouring versions never sit on top of each other */
  const placed=[], hit=(a,b)=>!(a.x1<b.x0||a.x0>b.x1||a.y1<b.y0||a.y0>b.y1);
  versions.forEach((v,j)=>{ const x=X(vi[j]), y=Y(v.price), prev=j?versions[j-1].price:null, up=prev==null||v.price>=prev, isLast=j===versions.length-1;
    g+=`<circle cx="${f(x)}" cy="${f(y)}" r="${isLast?7:5.5}" fill="${isLast?"var(--brand)":"var(--panel)"}" stroke="var(--brand)" stroke-width="2.4"/>`;
    const price=inr(v.price), src=j===0?"Nomination":v.source, w=Math.max(price.length*7.8,src.length*5.7)+10, h=32;
    const cand=up?[[0,-h-12],[0,12],[-w/2-12,-h-6],[-w/2-12,10],[w/2+12,-h-6],[w/2+12,10]]:[[0,12],[0,-h-12],[-w/2-12,10],[-w/2-12,-h-6],[w/2+12,10],[w/2+12,-h-6]];
    let pick=null;
    for(const c of cand){ const cx=Math.min(W-m.r-w/2-4,Math.max(m.l+w/2+4,x+c[0])), top=y+c[1], r={x0:cx-w/2,x1:cx+w/2,y0:top,y1:top+h,cx,top};
      if(r.y0<m.t-26||r.y1>m.t+ih+4) continue; if(!placed.some(q=>hit(q,r))){ pick=r; break; } }
    if(!pick){ const c=cand[0], cx=Math.min(W-m.r-w/2-4,Math.max(m.l+w/2+4,x+c[0])), top=y+c[1]; pick={cx,top}; }
    placed.push({x0:pick.cx-w/2,x1:pick.cx+w/2,y0:pick.top,y1:pick.top+h});
    g+=T(pick.cx,pick.top+13,price,{w:800,s:12.5,c:"var(--ink)",halo:1})+T(pick.cx,pick.top+27,src,{s:10.5,c:"var(--muted)",halo:1}); });
  /* gap callout */
  if(tgt){ const dlt=last.price-tgt, mid=(Y(tgt)+Y(last.price))/2, xr=X(N-1)-8;
    if(Math.abs(Y(tgt)-Y(last.price))>16) g+=T(xr,mid+4,(dlt>=0?"+":"−")+inr(Math.abs(dlt))+" ("+sgn(pct(last.price,tgt))+")",{a:"end",w:700,s:11.5,c:dlt>0?"var(--red)":"var(--ok)",halo:1}); }
  /* hover */
  for(let i=0;i<N;i++){ const pv=panel[i], sv=step[i];
    const rows=[pv!=null?"Monthly price: "+inr(pv,0):null, sv!=null?"Recorded price in force: "+inr(sv,0):null].filter(Boolean); if(!rows.length) continue;
    g+=`<rect class="ph-hv" x="${f(X(i)-iw/N/2)}" y="${m.t}" width="${f(iw/N)}" height="${ih}"><title>${esc(U.mlong(months[i]))}\n${esc(rows.join("\n"))}</title></rect>`; }
  g+="</svg>";
  const legend=`<div class="ph-leg"><span><i class="l1"></i>Monthly price</span><span><i class="l2"></i>Recorded price in force</span>${tgt?`<span><i class="l3"></i>Target</span>`:""}${vsi?`<span><i class="l4"></i>VSI</span>`:""}${tgt?`<span><i class="l5"></i>Gap to target</span>`:""}</div>`;
  return `<div class="ph-wrap">${legend}${g}</div>`;
}

window.__priceTimeline=timelineChart;
function walkChart(st,o){ o=o||{};
  const cB=C.C.anchor, cR=C.C.red, cG=C.C.ok, sg=d=>(d>=0?"+":"−")+inr(Math.abs(d)), net=st.last.price-st.first.price;
  const steps=[{kind:"total",label:"Nomination "+U.ml(monthKey(st.first.effectiveFrom)),value:st.first.price,tip:{t:"Nomination",r:[{n:"Price",v:inr(st.first.price),c:cB},{n:"Effective",v:fmtDate(st.first.effectiveFrom),c:cB}].concat(st.first.target?[{n:"Target",v:inr(st.first.target),c:cB}]:[]),x:st.first.target?{k:"vs target",v:sgn(pct(st.first.price,st.first.target)),tone:st.first.price>st.first.target?"bad":"good"}:null}}];
  st.steps.forEach(s=>steps.push({kind:"delta",label:s.v.source,value:s.d,note:fmtDate(s.v.effectiveFrom)+" · "+sgn(s.pct),tip:{t:s.v.source,r:[{n:"Price",v:inr(s.prev.price)+" → "+inr(s.v.price),c:s.d>=0?cR:cG},{n:"Change",v:sg(s.d),c:s.d>=0?cR:cG},{n:"Effective",v:fmtDate(s.v.effectiveFrom),c:s.d>=0?cR:cG}].concat(s.v.changeReq?[{n:"Change request",v:s.v.changeReq,c:s.d>=0?cR:cG}]:[]),x:{k:"vs previous version",v:sgn(s.pct),tone:s.d>0?"bad":"good"}}}));
  steps.push({kind:"total",label:"Current",value:st.last.price,tip:{t:"Current price",r:[{n:"Price",v:inr(st.last.price),c:cB},{n:"Since",v:fmtDate(st.last.effectiveFrom),c:cB},{n:"Change vs nomination",v:sg(net),c:cB}],x:{k:"vs nomination",v:sgn(pct(st.last.price,st.first.price)),tone:net>0?"bad":"good"}}});
  const run=[st.first.price]; st.steps.forEach(x=>run.push(x.v.price)); const lo=Math.min(...run), hi=Math.max(...run);
  return C.waterfall({steps,width:o.width||520,height:o.height||270,floor:Math.max(0,lo-Math.max(hi-lo,hi*0.02)*0.6),fmt:v=>inr(v),rotate:o.rotate,ends:o.ends,tip:o.tip,aria:"Price walk from nomination to current"});
}

function versionList(versions){
  return `<ul class="timeline">${versions.map((v,i)=>{
    const cur=i===versions.length-1, prev=i?versions[i-1]:null, d=prev?v.price-prev.price:0, dp=prev?pct(v.price,prev.price):0;
    const dv=v.target?pct(v.price,v.target):0;
    return `<li class="${cur?"current":"done"}"><div class="tl-dot">${cur?"●":"✓"}</div><div class="tl-body">
      <div class="tl-title">${inr(v.price)} ${cur?`<span class="chip chip-blue" style="margin-left:6px;"><span class="chip-dot"></span>current</span>`:""}
        ${prev?`<span class="chip ${d>0?"chip-red":d<0?"chip-green":"chip-gray"}" style="margin-left:6px;"><span class="chip-dot"></span>${d>=0?"+":"−"}${inr(Math.abs(d))} · ${sgn(dp)} vs previous</span>`:`<span class="chip chip-gray" style="margin-left:6px;"><span class="chip-dot"></span>nominated price</span>`}</div>
      <div class="tl-meta">${esc(fmtDate(v.effectiveFrom))} • ${esc(v.source)}${v.changeReq?` • ${Components.wfChip(v.changeReq)}`:""}${v.target?` • ${sgn(dv)} vs Target`:""}</div></div></li>`;
  }).join("")}</ul>`;
}

window.__priceKit={timeline:timelineChart,walk:walkChart,list:versionList,stats};   // reused by the Procurement dashboard's Price Analysis
})();
