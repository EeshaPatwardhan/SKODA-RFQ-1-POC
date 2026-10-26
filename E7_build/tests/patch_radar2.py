"""one-off: Radar answers use the POC's reasons / confidence / cost-walk data (result committed in src/e7_radar.js)"""
import io
p = r"D:\SKODA\RFQ 1\E7_build\src\e7_radar.js"
t = io.open(p, encoding="utf-8").read()
if "function ansWalk(" in t:
    raise SystemExit("already patched")

# 1) part answer: add the POC's reason + confidence
old = "  const mc=P.marketContext(p); b.push(`Market context (qualitative, not model inputs): ${esc(mc.specific[0])}`+(p.anomaly?` The POC flags this part as a structural-break case (${esc(p.anomaly.replace(/_/g,\" \"))}).`:\"\"));"
assert old in t
new = """  if(p.reason) b.push(`Why (model reasons): ${esc(p.reason.summary)} Confidence **${p.conf.level}** — ${esc(p.reason.tip)}`);
  const mc=P.marketContext(p); b.push(`Market context (qualitative, not model inputs): ${esc(mc.specific[0])}`+(p.anomaly?` The POC flags this part as a structural-break case (${esc(p.anomaly.replace(/_/g," "))}).`:""));"""
t = t.replace(old, new, 1)

# 2) richer "why"
a = t.index("function ansWhy(ctx,q){")
b2 = t.index("/* ---- workflow data (the rest of the prototype) ---- */")
new_why = r'''function ansWhy(ctx,q){
  const p=ctx.lastPart; if(!p) return null;
  const mc=P.marketContext(p), w=P.costWalk([p]), rs=p.reason, br=p.bridges?p.bridges.b2f:{};
  const items=P.BK.map(k=>[P.BRIDGE_PLAIN[k],br[k]||0]).filter(x=>Math.abs(x[1])>0.005), tot=P.sum(items,x=>Math.abs(x[1]))||1;
  const bom=(P.bomOf(p)||[]).slice().sort((a,b)=>Math.abs(b.fc-b.bg)-Math.abs(a.fc-a.bg)).slice(0,3);
  let h=`<h5 class="rd-h">Why the price moves</h5><p><b>${esc(p.name)}</b> (${esc(p.id)}) is forecast <b>${sgn(p.chgH)}</b> (${inr(p.cur,2)} → ${inr(p.fcEnd,2)}, interval ${inr(p.loEnd)}–${inr(p.hiEnd)}). Confidence is <b>${p.conf.level}</b>: the move is ${p.conf.ratio}× the model's typical ${p.conf.errPct}% error.</p>`;
  if(rs) h+=`<p>${esc(rs.summary)}</p><p class="rd-m">${esc(rs.story)}</p>`;
  if(items.length) h+=`<p>The cost walk attributes the move (budget → forecast) to: ${items.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([n,v])=>`${esc(n.toLowerCase())} ${Math.round(Math.abs(v)/tot*100)}% (${v>=0?"pushing up":"pulling down"})`).join("; ")}.</p>`;
  h+=`<h5 class="rd-h">Real-world reasons (market context, not model-measured)</h5><ul>${mc.specific.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><p class="rd-m">${esc(mc.part)}</p>`;
  if(bom.length) h+=`<h5 class="rd-h">Material cost impact (sample build-up)</h5><ul>${bom.map(m=>`<li>${esc(m.name)}: ${inr(m.bg,2)} → ${inr(m.fc,2)} (${sgn((m.fc/m.bg-1)*100)})</li>`).join("")}</ul>`;
  h+=`<h5 class="rd-h">What to do</h5><p>${p.conf.level==="high"?"The direction is worth acting on — raise it with "+esc(p.vendorName)+" before the next re-price"+(p.vendor.repriceMonths?" (they re-price about every "+p.vendor.repriceMonths+" months)":"")+".":p.conf.level==="medium"?"Use it as a review flag and double-check the top driver's source before negotiating.":"The move sits inside the model's usual error — do not act on the direction alone; watch it next month."}</p>`;
  return R(h,{actions:[{l:"Part detail & cost walk",a:"part:"+p.id}]});
}
function ansWalk(q){
  const steps=P.walkSteps(P.PARTS,/history|so far|until now|nominat/i.test(q)?"nom_to_sop":/next|ahead|forecast move|from today/i.test(q)?"sop_to_fc":"bg_to_fc"), tot=steps.filter(s=>s.kind==="total"), br=steps.filter(s=>s.kind==="bridge").filter(s=>Math.abs(s.value)>0.5).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  const d=tot[1].value-tot[0].value, da=Math.abs(d)||1;
  return R(`<p><b>${esc(tot[0].label)} ${cr(tot[0].value)} → ${esc(tot[1].label)} ${cr(tot[1].value)}</b> (${sgn(d/tot[0].value*100,1)}, ${spendS(d)}). Main reasons:</p><ul>${br.map(s=>`<li><b>${esc(P.BRIDGE_PLAIN[s.id])}</b> ${spendS(s.value)} — ${Math.round(Math.abs(s.value)/da*100)}% of the change</li>`).join("")}</ul><p class="rd-m">Budget is a derived proxy (the first history month); spend is the unit-price sum. Materials and shipping show no part-level signal in this POC build.</p>`,
    {charts:[barSpec("Cost walk drivers (₹)",br.map(s=>({label:P.BRIDGE_PLAIN[s.id],v:s.value,tone:s.value>0?"up":"down"})),{unit:"currency"})],actions:[{l:"Open Material Cost Forecast",a:"go:fc-material"},{l:"Hierarchy drill-down",a:"go:fc-hierarchy"}]});
}
const spendS=v=>(v>=0?"+":"−")+cr(Math.abs(v)).replace("−","");
function ansConfidence(){
  const hi=P.PARTS.filter(p=>p.conf.level==="high").sort((a,b)=>Math.abs(b.chgH)-Math.abs(a.chgH)), md=P.PARTS.filter(p=>p.conf.level==="medium").length, lo=P.PARTS.filter(p=>p.conf.level==="low").length;
  return R(`<p>Confidence is a <b>signal-to-error ratio</b>, not a probability: it compares the predicted move with the model's typical error at this horizon. <b>${hi.length}</b> parts are <b>high</b> (move ≥ 2× error — worth acting on), <b>${md}</b> medium, <b>${lo}</b> low (inside the noise).</p><p>The highest-confidence big movers:</p>`+partTable(hi.slice(0,8)),{actions:[{l:"Open in Parts",a:"filter:dir=high"},{l:"Hierarchy drill-down",a:"go:fc-hierarchy"}]});
}
'''
t = t[:a] + new_why + t[b2:]

# 3) route the new intents
old_route = "  if(/(model|accura|mape|validat|back.?test|noise|reliab|trust|how good|future test)/.test(t)) return ansModel(q);"
assert old_route in t
new_route = """  if(/(why (did|has|is) (the )?(cost|spend|budget)|cost walk|what moved|budget to forecast|bridge|drivers? of (the )?cost)/.test(t)) return ansWalk(q);
  if(/(confidence|which .*trust|signal.to.error|high.confidence)/.test(t)) return ansConfidence();
  if(/(hierarch|drill.?down|tree)/.test(t)) return R(`<p>The <b>Hierarchy Drill-down</b> shows project → vendor → category → part → material (drag the level boxes to regroup), with current and forecast spend, variance and a confidence badge per part. The roll-up below it shows the same forecast by project, vendor or category.</p>`,{actions:[{l:"Open Hierarchy",a:"go:fc-hierarchy"},{l:"Material Cost Forecast",a:"go:fc-material"}]});
  if(/(model|accura|mape|validat|back.?test|noise|reliab|trust|how good|future test)/.test(t)) return ansModel(q);"""
t = t.replace(old_route, new_route, 1)
io.open(p, "w", encoding="utf-8").write(t)
print("patched")
