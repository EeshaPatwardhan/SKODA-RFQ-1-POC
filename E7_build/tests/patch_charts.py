"""one-off: extends src/poc_charts.js (kept for the record; the result is committed in the file itself)"""
import io
p = r"D:\SKODA\RFQ 1\E7_build\src\poc_charts.js"
t = io.open(p, encoding="utf-8").read()
if "function vbars(" in t:
    raise SystemExit("already patched")

# --- line(): shade zones, marks (vertical reference lines), point labels, dots
t = t.replace("""  if(o.split!=null && o.split<N){""", """  (o.shade||[]).forEach(z=>{ const x0=X(z.from), x1=X(z.to); g+=`<rect x="${Math.min(x0,x1)}" y="${m.t}" width="${Math.abs(x1-x0)}" height="${ih}" fill="${z.color||"var(--brand-soft)"}" opacity="${z.opacity||.6}"/>${z.label?`<text x="${Math.min(x0,x1)+6}" y="${m.t+12}" class="pc-t" fill="${z.textColor||"var(--brand)"}" font-weight="700">${esc(z.label)}</text>`:""}`; });
  if(o.split!=null && o.split<N){""", 1)
t = t.replace("""  o.series.forEach(s=>{
    let d="", pen=false;""", """  (o.marks||[]).forEach(mk=>{ const x=X(mk.i); g+=`<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t+ih}" stroke="${mk.color||C.faint}" stroke-dasharray="${mk.dash||"3 3"}" stroke-width="1"/><text x="${x+(mk.dx!=null?mk.dx:4)}" y="${m.t+(mk.y||12)}" class="pc-t" ${mk.anchor?`text-anchor="${mk.anchor}"`:""}>${esc(mk.label)}</text>`; });
  o.series.forEach(s=>{
    let d="", pen=false;""", 1)
t = t.replace("""    g+=`<path d="${d}" fill="none" stroke="${s.color||C.brand}" stroke-width="${s.width||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:""} stroke-linejoin="round" stroke-linecap="round"/>`;
  });""", """    g+=`<path d="${d}" fill="none" stroke="${s.color||C.brand}" stroke-width="${s.width||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:""} stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.dots) s.data.forEach((v,i)=>{ if(v!=null&&isFinite(v)&&(s.dots===true||s.dots(i,v))) g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="${s.dotR||3.6}" fill="${s.dotFill||"var(--panel)"}" stroke="${s.color||C.brand}" stroke-width="2"/>`; });
    if(s.labelAt) s.labelAt.forEach(i=>{ const v=s.data[i]; if(v!=null&&isFinite(v)) g+=`<text x="${X(i)}" y="${Y(v)-10}" text-anchor="middle" class="pc-t" font-weight="700" fill="${s.color||C.brand}">${esc((s.labelFmt||fmt)(v))}</text>`; });
  });""", 1)

NEW = r'''/* vertical bars with optional prediction-interval whiskers: items [{label,value,lo,hi,color}] */
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

function spark(values,o){'''
t = t.replace("function spark(values,o){", NEW, 1)
t = t.replace("return {line,bars,waterfall,spark,donut,esc,nf,C};", "return {line,bars,vbars,combo,gvbars,waterfall,spark,donut,esc,nf,C,niceTicks};")
old_center = """g+=`<text x="${c}" y="${c+4}" text-anchor="middle" class="pc-t" font-weight="700" font-size="13">${esc(o.center||"")}</text></svg>`;"""
new_center = """g+=`<text x="${c}" y="${c+(o.centerSub?0:4)}" text-anchor="middle" class="pc-t" font-weight="700" font-size="14" fill="var(--ink)">${esc(o.center||"")}</text>${o.centerSub?`<text x="${c}" y="${c+14}" text-anchor="middle" class="pc-t">${esc(o.centerSub)}</text>`:""}</svg>`;"""
assert old_center in t
t = t.replace(old_center, new_center, 1)
io.open(p, "w", encoding="utf-8").write(t)
print("patched")
