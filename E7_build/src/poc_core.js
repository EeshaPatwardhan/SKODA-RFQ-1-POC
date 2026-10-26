/* =====================================================================
   E7  ·  PocCore — forecasting-POC data layer (no DOM, Node-testable)
   Source of truth for every forecast, price history, project, vendor
   and vertical in the prototype.  Data is the embedded POC export
   (E7_build/make_poc_data.py → <script id="poc-json">).
   ===================================================================== */
const PocCore = (function(){
"use strict";
const RAW = (typeof document!=="undefined" && document.getElementById("poc-json"))
  ? JSON.parse(document.getElementById("poc-json").textContent)
  : (typeof globalThis!=="undefined" ? globalThis.__POC__ : null);
if(!RAW) throw new Error("PocCore: POC data not found");

/* prototype vocabulary: the POC's prose says programme / category / unit sum; this prototype says project / vertical / cost per vehicle */
(function(){
  const rep=[[/\bProgrammes\b/g,"Projects"],[/\bprogrammes\b/g,"projects"],[/\bProgramme\b/g,"Project"],[/\bprogramme\b/g,"project"],
    [/\bCategories\b/g,"Verticals"],[/\bcategories\b/g,"verticals"],[/\bCategory\b/g,"Vertical"],[/\bcategory\b/g,"vertical"],
    [/Spend is unit sum\.?\s*/g,""]];
  const fix=t=>{ if(t.length<14||t.indexOf(" ")<0) return t; let o=t; for(const [rx,v] of rep) o=o.replace(rx,v); return o; };
  const walk=o=>{ if(Array.isArray(o)){ for(let i=0;i<o.length;i++){ const x=o[i]; if(typeof x==="string") o[i]=fix(x); else if(x&&typeof x==="object") walk(x); } }
    else if(o&&typeof o==="object"){ for(const k of Object.keys(o)){ const x=o[k]; if(typeof x==="string") o[k]=fix(x); else if(x&&typeof x==="object") walk(x); } } };
  walk(RAW);
})();

const MONTHS = RAW.months, FM = RAW.fMonths, NH = MONTHS.length, NF = FM.length;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthLabel = m => MON[+m.slice(5,7)-1]+" "+m.slice(0,4);
const r2 = v => Math.round(v*100)/100;
const sum = (a,f) => a.reduce((s,x)=>s+(f?f(x):x),0);

/* ---------- display layer ported from the POC (friendlyParts.ts) ---------- */
const PART_NAMES = {
  "Electrical":["Wiring Harness","Alternator","Starter Motor","Battery Terminal Set","Fuse Box","Ignition Coil","Relay Module","Horn Assembly","Wiper Motor","Power Window Motor"],
  "Lighting":["Headlamp Assembly","Tail Lamp Assembly","Fog Lamp","DRL Light Strip","Indicator Lamp","Brake Light Unit","Interior Dome Lamp","Number Plate Lamp"],
  "Fasteners":["Wheel Nut","Engine Mounting Bolt","Body Clip Set","Door Hinge Screw","Rivet Pack","Washer Kit","Panel Retainer Clip","Exhaust Stud"],
  "Interior Trim":["Dashboard Panel","Door Trim Panel","Seat Fabric Cover","Centre Console","Headliner","Gear Knob Cover","Floor Carpet Set","Glove Box Assembly"],
  "HVAC":["AC Compressor","Condenser Unit","Blower Motor","Evaporator Core","Cabin Air Filter","Heater Core","AC Control Panel","Expansion Valve"],
  "Braking":["Front Brake Pad Set","Brake Disc","Brake Caliper","Master Cylinder","Brake Hose","Rear Brake Shoe Set","ABS Pump Unit","Handbrake Cable"],
  "Body Stampings":["Front Door Panel","Bonnet Panel","Roof Panel","Boot Lid","Front Fender","Quarter Panel","Floor Pan","A-Pillar Reinforcement"],
  "Sensors":["Oxygen Sensor","Crankshaft Position Sensor","Parking Sensor","Wheel Speed Sensor","Coolant Temperature Sensor","Tyre Pressure Sensor","MAP Sensor","Rain Sensor"],
  "Powertrain":["Clutch Plate Set","Fuel Injector","Turbocharger","Timing Chain Kit","Gearbox Housing","Engine Oil Pump","Flywheel","Drive Shaft"],
  "Chassis":["Front Shock Absorber","Control Arm","Stabiliser Bar","Steering Rack","Wheel Hub Bearing","Rear Axle Beam","Coil Spring","Tie Rod End"],
};
function hash(t){ let h=2166136261; for(let i=0;i<t.length;i++){ h^=t.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function friendlyName(category, seedId, slot, fallback){
  const n = PART_NAMES[category];
  if(!n) return fallback.replace(/\s+[A-Z]\d+\b/,"").replace(/\s+-\s+.*$/,"");
  return n[(hash(seedId)+slot)%n.length];
}

/* ---------- masters ---------- */
const PROGS = RAW.programmes.map((p,i)=>({ix:i, code:p.code, name:p.name, oem:p.oem, segment:p.segment, volume:p.volume, localisation:p.localisation}));
const VENDS = RAW.vendors.map((v,i)=>({ix:i, code:v.code, name:v.name, origin:v.origin, importDep:v.importDep, repriceMonths:v.repriceMonths}));
const CATS  = RAW.catMaster.map((c,i)=>({ix:i, code:c.code, name:c.name, material:c.material}));

/* ---------- realistic price model ----------
   The POC panel's prices are synthetic and not tied to the part names the prototype shows (a "Horn Assembly" could cost ₹3,200).
   Each part is therefore re-priced from a reference piece price for its NAME (₹, compact-SUV level, OEM piece price from a tier-1) and the
   quantity fitted per vehicle.  The POC's own shape is kept: every part's 36-month history, forecast and interval are multiplied by ONE factor,
   so growth rates, forecast moves, bridges and rankings are unchanged — only the rupee level moves.  Part-to-part spread inside a vertical comes
   from the POC price relative to its vertical's median (clipped to 0.8–1.3×).  Each project is then calibrated so that the cost per vehicle of its
   tracked parts matches a realistic bought-out material cost for that car (PROJECT_COST).  All figures are illustrative. */
const PRICE_REF = {   // name: [piece price ₹, quantity per vehicle]
  "Wiring Harness":[11500,1],"Alternator":[8800,1],"Starter Motor":[5600,1],"Battery Terminal Set":[220,1],"Fuse Box":[3600,1],"Ignition Coil":[1500,4],"Relay Module":[700,4],"Horn Assembly":[480,2],"Wiper Motor":[2100,2],"Power Window Motor":[2300,4],
  "Headlamp Assembly":[10500,2],"Tail Lamp Assembly":[4600,2],"Fog Lamp":[1600,2],"DRL Light Strip":[2600,2],"Indicator Lamp":[520,4],"Brake Light Unit":[1250,1],"Interior Dome Lamp":[420,2],"Number Plate Lamp":[170,2],
  "Wheel Nut":[32,20],"Engine Mounting Bolt":[72,12],"Body Clip Set":[140,8],"Door Hinge Screw":[20,16],"Rivet Pack":[95,6],"Washer Kit":[60,5],"Panel Retainer Clip":[14,60],"Exhaust Stud":[40,8],
  "Dashboard Panel":[16500,1],"Door Trim Panel":[4000,4],"Seat Fabric Cover":[5400,1],"Centre Console":[4300,1],"Headliner":[4400,1],"Gear Knob Cover":[520,1],"Floor Carpet Set":[4000,1],"Glove Box Assembly":[1700,1],
  "AC Compressor":[15500,1],"Condenser Unit":[4200,1],"Blower Motor":[2700,1],"Evaporator Core":[3800,1],"Cabin Air Filter":[320,1],"Heater Core":[2400,1],"AC Control Panel":[4300,1],"Expansion Valve":[950,1],
  "Front Brake Pad Set":[1400,2],"Brake Disc":[1900,3],"Brake Caliper":[4000,4],"Master Cylinder":[3600,1],"Brake Hose":[500,4],"Rear Brake Shoe Set":[1300,1],"ABS Pump Unit":[20000,1],"Handbrake Cable":[720,2],
  "Front Door Panel":[7000,2],"Bonnet Panel":[6200,1],"Roof Panel":[7800,1],"Boot Lid":[6400,1],"Front Fender":[3300,2],"Quarter Panel":[8800,2],"Floor Pan":[10800,1],"A-Pillar Reinforcement":[3200,2],
  "Oxygen Sensor":[2900,2],"Crankshaft Position Sensor":[1500,1],"Parking Sensor":[1100,4],"Wheel Speed Sensor":[1400,4],"Coolant Temperature Sensor":[540,1],"Tyre Pressure Sensor":[2100,4],"MAP Sensor":[1650,1],"Rain Sensor":[1900,1],
  "Clutch Plate Set":[8800,1],"Fuel Injector":[4300,4],"Turbocharger":[41000,1],"Timing Chain Kit":[7400,1],"Gearbox Housing":[15800,1],"Engine Oil Pump":[4800,1],"Flywheel":[9600,1],"Drive Shaft":[10800,2],
  "Front Shock Absorber":[3900,4],"Control Arm":[3200,2],"Stabiliser Bar":[2200,2],"Steering Rack":[16500,1],"Wheel Hub Bearing":[2600,4],"Rear Axle Beam":[9800,1],"Coil Spring":[1700,4],"Tie Rod End":[750,2],
};
/* bought-out material cost of the tracked parts per vehicle, ₹ (illustrative; compact SUVs ≈ 60-65% of the ex-factory price, Kodiaq is CKD so only its local content is tracked) */
const PROJECT_COST = {KUS:720000, SLV:700000, KYL:545000, TGN:755000, VRT:735000, KDQ:960000};
const REL_LO=.8, REL_HI=1.3;

/* ---------- parts ---------- */
const BK = RAW.bridgeKeys; // fx, commodity, freight, vendorReprice, mix, seasonality, unexplained
const slotCount = {}, slotSeed = {};
const PRE = RAW.parts.map((r)=>{
  const prog=PROGS[r[2]], vend=VENDS[r[3]], cat=CATS[r[4]];
  const key = prog.code+"|"+vend.code+"|"+cat.code;
  if(slotCount[key]===undefined){ slotCount[key]=0; slotSeed[key]=r[0]; }
  const slot = slotCount[key]++;
  return {slot, fname:friendlyName(cat.name, slotSeed[key], slot, r[1]), cat:cat.name};
});
const MEDIAN = {};
(function(){ const by={}; RAW.parts.forEach((r,i)=>{ (by[PRE[i].cat]=by[PRE[i].cat]||[]).push(r[9][NH-1]); });
  Object.keys(by).forEach(c=>{ const a=by[c].slice().sort((x,y)=>x-y); MEDIAN[c]=a[a.length>>1]; }); })();
RAW.parts.forEach((r,i)=>{ const q=PRE[i], ref=PRICE_REF[q.fname]||[MEDIAN[q.cat],1], cur=r[9][NH-1];
  q.qty=ref[1]; q.base=ref[0]*Math.min(REL_HI,Math.max(REL_LO,cur/MEDIAN[q.cat])); q.cur0=cur; });
(function(){ const S={}; RAW.parts.forEach((r,i)=>{ const c=PROGS[r[2]].code; S[c]=(S[c]||0)+PRE[i].qty*PRE[i].base; });
  RAW.parts.forEach((r,i)=>{ const c=PROGS[r[2]].code, k=(PROJECT_COST[c]||S[c])/S[c]; PRE[i].sf=PRE[i].base*k/PRE[i].cur0; }); })();
const sc = (a,k)=> a.map(v=>v==null?v:Math.round(v*k*100)/100);
let _sumOld=0,_sumNew=0;
const PARTS = RAW.parts.map((r,ix)=>{
  const prog=PROGS[r[2]], vend=VENDS[r[3]], cat=CATS[r[4]], pre=PRE[ix], sf=pre.sf, slot=pre.slot, fname=pre.fname;
  _sumOld+=pre.cur0; _sumNew+=pre.cur0*sf;
  const h=sc(r[9],sf), f=sc(r[10],sf), lo=sc(r[11],sf), hi=sc(r[12],sf), cur=h[NH-1], nom=h[0], fcEnd=f[NF-1], fc1=f[0];
  r=r.slice(); if(r[13]) r[13]=sc(r[13],sf); if(r[16]) r[16]=[r[16][0]].concat(sc(r[16].slice(1),sf));
  const pct = (a,b)=> b? (a/b-1)*100 : 0;
  // cost-walk bridges: FX / commodity / freight as exported; vendor reprice is the residual that closes each leg
  let br=null;
  if(r[13]){
    const b=r[13], z=v=>v==null?0:v;
    const leg=(from,to,o)=>{
      const o2={fx:z(b[o]),commodity:z(b[o+1]),freight:z(b[o+2]),mix:0,seasonality:0,unexplained:0};
      o2.vendorReprice = (to-from)-(o2.fx+o2.commodity+o2.freight);
      return o2;
    };
    br={n2s:leg(nom,cur,3), s2f:leg(cur,fcEnd,10)};
    br.b2f={}; BK.forEach(k=>{ br.b2f[k]=(br.n2s[k]||0)+(br.s2f[k]||0); });
  }
  const cf=r[14], rs=r[15], mt=r[16];
  const conf = cf? {level:cf[0],ratio:cf[1],errPct:cf[2]} : {level:"low",ratio:0,errPct:0};
  const reason = rs? {summary:rs[0].split(r[1]).join(fname),story:rs[1].split(r[1]).join(fname),tip:(RAW.reasonTips||[])[rs[2]]||"",causalityNote:RAW.reasonCausality||"",
    drivers:(rs[3]||[]).map(d=>({id:d[0],label:d[1],direction:d[2],magnitude:d[3],source:d[4],isReal:!!d[5],
      evidence:d[6]||(d[1]+" is "+(d[2]==="up"?"pushing the price up":"pulling the price down")+". Source: "+(d[5]?"checked against a live/cached feed":"from an offline backup series")+" ("+d[4]+")"+(d[5]?"":" — verify before acting")+".")}))} : null;
  const mat = mt? {name:mt[0],fx:mt[1],commodity:mt[2],freight:mt[3],other:mt[4]} : null;
  return {
    ix, id:r[0], rawName:r[1], name:fname, slot, qty:pre.qty,
    prog, vendor:vend, cat, progCode:prog.code, progName:prog.name, vendorName:vend.name, vendorOrigin:vend.origin,
    category:cat.name, material:cat.material, tier:r[5], kg:r[6], volume:r[7], anomaly:r[8]||"",
    h, f, lo, hi, cur, nom, fc1, fcEnd,
    chg1:pct(fc1,cur), chgH:pct(fcEnd,cur), chgHist:pct(cur,nom), bridges:br,
    loEnd:lo[NF-1], hiEnd:hi[NF-1], conf, reason, mat,
  };
});
const BY_ID = {}; PARTS.forEach(p=>BY_ID[p.id.toLowerCase()]=p);
const part = id => id? BY_ID[String(id).toLowerCase()] : null;

/* absolute-error metrics (MAE / RMSE) are in rupees: scale them with the average price level; MAPE and the other percentages are untouched */
(function(){ const k=_sumNew/_sumOld, ABS=/^(mae|rmse|mae_mean|mae_std|rmse_mean|rmse_std)$/, LVL=/^(actual|revealed|pred_.*)$/;
  const deep=(o,lvl)=>{ if(Array.isArray(o)){ o.forEach(x=>{ if(x&&typeof x==="object") deep(x,lvl); }); return; }
    if(!o||typeof o!=="object") return;
    Object.keys(o).forEach(key=>{ const v=o[key];
      if(typeof v==="number"&&(ABS.test(key)||(lvl&&LVL.test(key)))) o[key]=Math.round(v*k*1000)/1000;
      else if(v&&typeof v==="object") deep(v,lvl||key==="series"); }); };
  deep(RAW.modelComparison); deep(RAW.backtestSummary); deep(RAW.futureTest);
  RAW.priceScale=k; })();

/* ---------- aggregates ----------
   Cost per vehicle = Σ (piece price × quantity per vehicle) over the parts in scope, divided by the number of projects in scope (so a single
   project gives exactly that car's cost, the whole portfolio gives the average car, a vendor or vertical gives its content per average car). */
const projCount = list => Math.max(1,new Set((list||PARTS).map(p=>p.progCode)).size);
const cost = (list,fn,n) => sum(list,p=>p.qty*fn(p))/(n||projCount(list));
/* what the tracked parts add up to over a year at planned volumes, ₹ */
const annualSpend = (list,fn) => sum(list||PARTS,p=>p.qty*(fn?fn(p):p.cur)*p.prog.volume);
const basketAt = i => cost(PARTS,p=>p.h[i]);
const forecastBasketAt = j => cost(PARTS,p=>p.f[j]);
const forecastBand = () => FM.map((m,j)=>({month:m,label:monthLabel(m),value:forecastBasketAt(j),lower:cost(PARTS,p=>p.lo[j]),upper:cost(PARTS,p=>p.hi[j])}));

function rollup(dim, list){
  const rows = {}, np = dim==="project"? 1 : projCount(list);   // a project row is that car's own cost per vehicle
  (list||PARTS).forEach(p=>{
    const n = dim==="project"? p.progName : dim==="vendor"? p.vendorName : p.category;
    const r = rows[n] || (rows[n]={name:n,parts:0,currentSpend:0,forecastSpend:0});
    r.parts++; r.currentSpend+=p.qty*p.cur/np; r.forecastSpend+=p.qty*p.fcEnd/np;
  });
  return Object.values(rows).map(r=>({...r, changeAbs:r.forecastSpend-r.currentSpend, changePct:r.currentSpend? (r.forecastSpend/r.currentSpend-1)*100:0}))
    .sort((a,b)=>b.changePct-a.changePct);
}

function riskConcentration(thresholdPct=5){
  const at = PARTS.filter(p=>p.chgH>thresholdPct);
  const total = cost(at,p=>p.cur,projCount(PARTS));
  const by = dim=>{
    const o={};
    at.forEach(p=>{ const n=dim==="project"?p.progName:dim==="vendor"?p.vendorName:p.category;
      const r=o[n]||(o[n]={name:n,spendAtRisk:0,parts:0,inc:0}); r.spendAtRisk+=p.qty*p.cur/(dim==="project"?1:projCount(PARTS)); r.parts++; r.inc+=p.chgH; });
    const den=dim==="project"? sum(Object.values(o),r=>r.spendAtRisk) : total;
    return Object.values(o).map(r=>({name:r.name,spendAtRisk:r.spendAtRisk,shareOfRisk:den? r.spendAtRisk/den*100:0,parts:r.parts,avgIncreasePct:r.inc/r.parts}))
      .sort((a,b)=>b.spendAtRisk-a.spendAtRisk);
  };
  const vend=by("vendor");
  return {thresholdPct,totalSpendAtRisk:total,partsAtRisk:at.length,sharePct:basketAt(NH-1)? total/basketAt(NH-1)*100:0,
    top4VendorSharePct:sum(vend.slice(0,4),v=>v.shareOfRisk), vendor:vend, category:by("category"), project:by("project"), parts:at};
}

function kpis(){
  const cur=basketAt(NH-1), prev=basketAt(NH-2), fcE=forecastBasketAt(NF-1);
  const rc=riskConcentration(5), mc=RAW.modelComparison[0];
  return {
    basket:{value:cur, change:(cur/prev-1)*100, label:"Cost per vehicle (tracked parts)"},
    forecast:{value:fcE, change:(fcE/cur-1)*100, label:"Forecast cost per vehicle (+"+NF+" mo)", to:monthLabel(FM[NF-1])},
    accuracy:{value:100-mc.mape, mape:mc.mape, model:mc.model, label:"Best-model accuracy"},
    atrisk:{value:rc.totalSpendAtRisk, parts:rc.partsAtRisk, sharePct:rc.sharePct, label:"Cost at risk (>5% rise)"},
  };
}

function movers(dir, n, basis){
  const k = basis==="horizon"? "chgH":"chg1";
  const a = PARTS.slice().sort((x,y)=> dir==="up"? y[k]-x[k] : x[k]-y[k]);
  return a.slice(0,n||10);
}

function search(q, f){
  q=(q||"").toLowerCase().trim(); f=f||{};
  const eq=(a,b)=>!b||String(a).toLowerCase()===String(b).toLowerCase();
  return PARTS.filter(p=>{
    if(q && !(p.id.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||p.rawName.toLowerCase().includes(q)||p.vendorName.toLowerCase().includes(q))) return false;
    return eq(p.category,f.category)&&eq(p.vendorName,f.vendor)&&(eq(p.progName,f.project)||eq(p.progCode,f.project));
  });
}

/* ---------- alerts (POC rule, horizon-end move) ---------- */
const ALERTS = RAW.alerts.map(a=>({...a, part:part(a.partId)}));

/* ---------- FX / commodity cost impact (port of costImpact.ts) ---------- */
const MATERIAL_ASSUMPTIONS = {
  "Aluminium":{share:.5,passThrough:.7},"Copper":{share:.55,passThrough:.75},"Steel":{share:.45,passThrough:.65},
  "Cast iron":{share:.4,passThrough:.7},"Polymer":{share:.35,passThrough:.7},"Polycarbonate":{share:.35,passThrough:.7},"Silicon":{share:.3,passThrough:.65},
};
const CURRENCY_WEIGHT = {both:1,USDINR:.5,EURINR:.5};
function interpolate(points,x){
  if(!points.length) return 0;
  const s=points.slice().sort((a,b)=>a[0]-b[0]);
  if(x<=s[0][0]) return s[0][1];
  const l=s[s.length-1]; if(x>=l[0]) return l[1];
  for(let i=1;i<s.length;i++){ const [x1,y1]=s[i]; if(x<=x1){ const [x0,y0]=s[i-1]; return x1===x0? y1 : y0+((y1-y0)*(x-x0))/(x1-x0); } }
  return l[1];
}
function categoryFxPct(cat, shock){
  const pts=[[0,0]];
  (RAW.fxAnalysis.scenarios||[]).forEach(s=>{ const r=(s.byLevel&&s.byLevel.category||[]).find(x=>x.name===cat); if(r) pts.push([s.shockPct,r.changePct]); });
  return interpolate(pts,shock);
}
function commodityPassPct(mat, shock){ const a=MATERIAL_ASSUMPTIONS[mat]||{share:.35,passThrough:.7}; return shock*a.share*a.passThrough; }
function impact(o){
  o=Object.assign({car:"all",material:"all",currency:"both",commodityPct:0,fxPct:0},o||{});
  const w=CURRENCY_WEIGHT[o.currency]; const cats={};
  const npj=o.car==="all"? projCount(PARTS) : 1;
  PARTS.forEach(p=>{
    if(o.car!=="all" && p.progName!==o.car && p.progCode!==o.car) return;
    const base=p.fcEnd*p.qty/npj;
    const fx=base*categoryFxPct(p.category,o.fxPct)*w/100;
    const cm=(o.material==="all"||p.material===o.material)? base*commodityPassPct(p.material,o.commodityPct)/100 : 0;
    const c=cats[p.category]||(cats[p.category]={name:p.category,base:0,fx:0,commodity:0,parts:[]});
    c.base+=base; c.fx+=fx; c.commodity+=cm; c.parts.push({part:p,base,fx,commodity:cm,delta:fx+cm});
  });
  const cl=Object.values(cats).map(c=>({...c,delta:c.fx+c.commodity,deltaPct:c.base?(c.fx+c.commodity)/c.base*100:0,parts:c.parts.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))}))
    .sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  const base=sum(cl,c=>c.base), fx=sum(cl,c=>c.fx), cm=sum(cl,c=>c.commodity), delta=fx+cm;
  return {base,fx,commodity:cm,scenario:base+delta,delta,deltaPct:base?delta/base*100:0,categories:cl};
}
function impactTrend(base, delta){
  const hz=forecastBand(), last=hz[hz.length-1].value;
  return hz.map((h,i)=>{ const b=base*(h.value/last); return {label:h.label,base:b,scenario:b+delta*(i+1)/hz.length}; });
}

/* ---------- Nomination → SOP → Forecast cost walk (port of deriveMaterialCostView) ---------- */
function costWalk(list){
  list=list||PARTS;
  const acc={fx:0,commodity:0,freight:0,vendorReprice:0,mix:0,seasonality:0,unexplained:0};
  const acc2={...acc};
  let bg=0,sop=0,fc=0;
  const np=projCount(list);
  list.forEach(p=>{
    const w=p.qty/np;
    bg+=p.nom*w; sop+=p.cur*w; fc+=p.fcEnd*w;
    if(p.bridges){ BK.forEach(k=>{ acc[k]+=(p.bridges.n2s[k]||0)*w; acc2[k]+=(p.bridges.s2f[k]||0)*w; }); }
  });
  return {bg,sop,fc,n2s:acc,s2f:acc2,varianceAbs:fc-bg,variancePct:bg?(fc/bg-1)*100:0,nParts:list.length};
}

const WALK = {
  bg_to_fc:{label:"Full period",title:"Why cost changed",subtitle:"Budget to forecast — click a reason to see those parts",pool:"b2f",start:"nom",end:"fcEnd",startId:"budget",endId:"forecast",startLabel:"Budget (BG)",endLabel:"Forecast (FC)"},
  nom_to_sop:{label:"History",title:"Why cost changed (history)",subtitle:"From nomination to today’s production price",pool:"n2s",start:"nom",end:"cur",startId:"budget",endId:"sop",startLabel:"Budget (BG)",endLabel:"SOP / current"},
  sop_to_fc:{label:"Forecast",title:"Why cost may change next",subtitle:"From today to the forecast horizon",pool:"s2f",start:"cur",end:"fcEnd",startId:"sop",endId:"forecast",startLabel:"SOP / current",endLabel:"Forecast (FC)"},
};
const BRIDGE_LABEL = {fx:"Currency",commodity:"Materials",freight:"Shipping",vendorReprice:"Vendor reprice",mix:"Mix",seasonality:"Seasonality",unexplained:"Unexplained"};
const BRIDGE_PLAIN = {fx:"Currency",commodity:"Materials",freight:"Shipping",vendorReprice:"Vendor price changes",mix:"Part mix",seasonality:"Seasonality",unexplained:"Other changes"};
const BRIDGE_HELP = {fx:"FX rate moves passed into piece price",commodity:"Steel / aluminium / copper / energy",freight:"Shipping cost vs import-heavy suppliers",vendorReprice:"Supplier reprice not explained by FX / materials / shipping",mix:"Some parts moved differently from the average",seasonality:"Normal ups and downs through the year",unexplained:"Everything else that closes the walk"};
function walkSteps(list, walk){
  const W=WALK[walk||"bg_to_fc"], start=cost(list,p=>p[W.start]), end=cost(list,p=>p[W.end]);
  const v={}; BK.forEach(k=>{ v[k]=cost(list,p=>p.bridges?(p.bridges[W.pool][k]||0):0); });
  v.unexplained = end-start-BK.filter(k=>k!=="unexplained").reduce((s,k)=>s+v[k],0);
  return [{id:W.startId,label:W.startLabel,kind:"total",value:start}].concat(BK.map(k=>({id:k,label:BRIDGE_LABEL[k],kind:"bridge",value:v[k]})),[{id:W.endId,label:W.endLabel,kind:"total",value:end}]);
}
/* parts where a bridge is a material driver of the move (POC filterPartsByBridge) */
function partsByBridge(list, id, pool){
  pool=pool||"b2f";
  const sc=list.map(p=>({p,v:Math.abs(p.bridges?(p.bridges[pool][id]||0):0)})).filter(x=>x.v>1e-9);
  if(!sc.length) return [];
  const poolAbs=sum(sc,x=>x.v), keep=new Set();
  sc.forEach(({p,v})=>{ const mv=Math.max(Math.abs(p.fcEnd-p.nom),1); if(v/mv>=0.1){ keep.add(p.id); return; } if(v<1) return;
    const mo=Math.max(0,...BK.filter(k=>k!==id).map(k=>Math.abs(p.bridges[pool][k]||0))); if(v>=mo) keep.add(p.id); });
  let cum=0; sc.slice().sort((a,b)=>b.v-a.v).some(x=>{ keep.add(x.p.id); cum+=x.v; return poolAbs>0&&cum/poolAbs>=0.85; });
  return sc.filter(x=>keep.has(x.p.id)).sort((a,b)=>b.v-a.v).map(x=>x.p);
}
/* cost per vehicle of a part set per history month / forecast month (POC "price movement tracker", now on the cost-per-vehicle basis) */
function meanTrack(list){
  const np=projCount(list);
  const hist=MONTHS.map((m,i)=>({month:m,label:monthLabel(m),actual:cost(list,p=>p.h[i],np),forecast:null,lower:null,upper:null}));
  const fut=FM.map((m,j)=>({month:m,label:monthLabel(m),actual:null,forecast:cost(list,p=>p.f[j],np),lower:cost(list,p=>p.lo[j],np),upper:cost(list,p=>p.hi[j],np)}));
  return hist.concat(fut);
}

/* ---------- sample bill of materials (port of sampleMaterials; illustrative, flagged isSample) ---------- */
const BOM = {
  "Lighting":[["","kg",260,.16,1],["ABS housing","kg",190,.14],["Aluminium reflector","kg",330,.1],["LED module / bulb","pc",0,.22,1],["Copper wiring & connector","kg",820,.09],["Rubber gasket & seals","pc",0,.04],["Fasteners & clips","set",0,.03],["Assembly & testing","job",0,.12,1],["Packing","job",0,.03]],
  "Electrical":[["","kg",820,.24,1],["PVC insulation","kg",140,.08],["Brass terminals","kg",560,.1],["Nylon connector housing","kg",290,.08],["Fuse / relay unit","pc",0,.14],["Rubber grommets","pc",0,.04],["Steel fasteners","set",0,.04],["Assembly & testing","job",0,.12,1],["Packing","job",0,.03]],
  "Fasteners":[["","kg",72,.4,1],["Zinc plating","kg",260,.08],["Nylon washers","kg",240,.05],["Thread-lock coating","kg",900,.04],["Heat treatment","job",0,.15,1],["Inspection","job",0,.08],["Packing","job",0,.05]],
  "Interior Trim":[["","kg",115,.22,1],["Fabric / vinyl skin","kg",380,.16],["Foam padding","kg",210,.1],["ABS substrate","kg",190,.12],["Adhesive","kg",520,.05],["Clips & fasteners","set",0,.04],["Assembly","job",0,.14,1],["Packing","job",0,.03]],
  "HVAC":[["","kg",260,.22,1],["Copper tubing","kg",820,.14],["Rubber seals","pc",0,.05],["Blower motor","pc",0,.18,1],["Steel brackets","kg",72,.07],["Electronic controller","pc",0,.1],["Assembly & testing","job",0,.12,1],["Packing","job",0,.03]],
  "Braking":[["","kg",78,.26,1],["Friction material","kg",340,.16,1],["Steel backing plate","kg",72,.12],["Rubber seals","pc",0,.05],["Shims & hardware","set",0,.05],["Anti-corrosion coating","kg",600,.04],["Machining","job",0,.16],["Testing","job",0,.08,1],["Packing","job",0,.03]],
  "Body Stampings":[["","kg",72,.45,1],["Zinc coating","kg",260,.06],["Weld consumables","kg",350,.05],["Sealant","kg",480,.04],["Stamping","job",0,.18,1],["E-coat / painting","job",0,.14,1],["Packing","job",0,.03]],
  "Sensors":[["","pc",0,.22,1],["PCB board","pc",0,.12],["Copper wiring","kg",820,.08],["Plastic housing","kg",240,.1],["Epoxy potting","kg",640,.05],["Connector","pc",0,.08],["Calibration & testing","job",0,.2,1],["Assembly","job",0,.12,1],["Packing","job",0,.03]],
  "Powertrain":[["","kg",260,.24,1],["Alloy steel","kg",110,.2,1],["Bearings","pc",0,.1],["Seals & gaskets","pc",0,.06],["Lubricant","kg",480,.03],["Machining","job",0,.18],["Heat treatment","job",0,.08],["Assembly & testing","job",0,.09,1],["Packing","job",0,.02]],
  "Chassis":[["","kg",72,.36,1],["Rubber bushings","pc",0,.08],["Forged alloy steel","kg",110,.14],["Spring steel","kg",95,.08],["Powder coating","job",0,.06],["Fasteners","set",0,.05],["Welding & machining","job",0,.14,1],["Assembly & testing","job",0,.07,1],["Packing","job",0,.02]],
};
const PRIMARY_MATERIAL = {"Steel":"Steel","Aluminium":"Aluminium","Copper":"Copper wire / strip","Polymer":"Polymer resin","Polycarbonate":"Polycarbonate","Cast iron":"Cast iron","Silicon":"Silicon / semiconductor"};
function mulberry32(seed){ let a=seed; return ()=>{ a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function bomOf(p){
  const bom=BOM[p.category]; if(!bom||p.nom<=0||p.fcEnd<=0) return null;
  const bgT=p.nom, fcT=p.fcEnd, rand=mulberry32(hash(p.id+":bom"));
  const target=5+Math.floor(rand()*4);
  const picked=bom.filter(b=>b[4]);
  const opt=bom.filter(b=>!b[4]).map(b=>({b,r:rand()})).sort((x,y)=>x.r-y.r);
  for(const o of opt) if(picked.length<Math.min(target,bom.length)) picked.push(o.b);
  picked.sort((x,y)=>bom.indexOf(x)-bom.indexOf(y));
  const rawW=picked.map(b=>b[3]*(.8+.4*rand())), wS=sum(rawW);
  const growth=fcT/bgT;
  const bgRaw=rawW.map(w=>w/wS*bgT);
  const fcRaw=bgRaw.map(v=>v*growth*(.92+.16*rand()));
  const fcScale=fcT/sum(fcRaw);
  const bg=bgRaw.map(r2), fc=fcRaw.map(v=>r2(v*fcScale));
  const big=bg.indexOf(Math.max(...bg));
  bg[big]=r2(bg[big]+(bgT-sum(bg))); fc[big]=r2(fc[big]+(fcT-sum(fc)));
  return picked.map(([name,unit,price],i)=>{
    let qty,unitPrice;
    if(unit==="kg"){ unitPrice=r2(price*(.94+.12*rand())); qty=Math.round(fc[i]/unitPrice*1000)/1000; }
    else { qty=unit==="pc"? 1+Math.floor(rand()*3):1; unitPrice=r2(fc[i]/qty); }
    return {name:i===0? (PRIMARY_MATERIAL[p.material]||p.material):name, unit, quantity:qty, unitPrice, bg:bg[i], fc:fc[i], primary:i===0, isSample:true};
  });
}

/* ---------- market context (port of marketFactors.ts) ---------- */
const GENERAL = [
  "Currency: a weaker rupee vs USD/EUR raises imported content (chips, resins, tooling).",
  "Energy and crude: crude-linked feedstock, diesel and power tariffs feed resin, casting, forging and logistics costs with a quarter lag.",
  "Freight: container rates, Red Sea rerouting and port congestion raise landed cost.",
  "Supplier resets: quarterly or annual contract revisions pass earlier raw-material moves on in steps.",
  "Labour and overheads: wage settlements and plant costs pass on at the next revision.",
  "Demand and capacity: festive and launch volumes tighten supplier capacity and support prices.",
  "Policy: customs duty, GST and new safety or emission norms add cost.",
  "Geopolitics: conflicts and sanctions disrupt metals, chips and shipping.",
];
const BY_CAT = {
  "Lighting":["Polycarbonate and ABS resin follow crude-linked benzene and BPA; moulders reprice within a quarter.","LED modules depend on chip supply and imported-chip currency cost.","Aluminium (reflectors) follows LME plus Indian power costs; copper wiring follows LME copper."],
  "Electrical":["Copper follows the LME benchmark and harness suppliers use index-linked clauses.","PVC and nylon insulation follow the petrochemical cycle.","Brass terminals follow copper and zinc; EV content tightens harness capacity."],
  "Fasteners":["Steel wire rod follows domestic mill rounds, iron-ore and coking-coal costs.","Zinc plating and energy-heavy heat treatment add processing cost.","Steel safeguard duties and import competition shape mill pricing."],
  "Interior Trim":["Polypropylene and ABS follow the petrochemical cycle and are repriced within a quarter.","Foam chemicals (polyol, TDI), textile, vinyl and adhesives follow crude and chemical utilisation.","Model-refresh tooling and grain changes add one-off cost."],
  "HVAC":["Aluminium (condensers) follows LME plus power; copper tubing follows LME copper.","Refrigerant shifts (for example R-1234yf) carry a premium.","Blower motors and controllers use imported electronics, so currency and chips matter."],
  "Braking":["Cast iron follows pig iron, scrap and foundry power, which are firm.","Friction material follows phenolic resin, steel fibre and copper-free formulations.","Safety-critical parts carry strict testing, so supplier pass-through is rarely negotiated down."],
  "Body Stampings":["Steel coil follows domestic mill rounds, iron-ore, coking coal and safeguard duty.","Zinc for galvanising and e-coat chemicals add processed cost.","Press-shop energy and scrap-offset terms change net steel cost."],
  "Sensors":["Semiconductors and sensor elements stay tight; imported chips tie cost to USD/EUR.","PCBs, copper laminate and rare-earth magnets follow electronics and metals markets.","Rising ADAS content raises demand and calibration effort."],
  "Powertrain":["Aluminium and alloy steel follow LME and mill prices; casting and forging are energy-heavy.","Bearings, seals and fuel parts carry imported content, so currency and freight matter.","Emission-norm changes (BS-VI) add components and validation cost."],
  "Chassis":["Steel plate, forged alloy and spring steel follow mill rounds and forging energy.","Natural and synthetic rubber for bushings follow crop supply and crude.","Heavy forging and welding capacity is tight at OEM volume peaks."],
};
function marketContext(p){
  const intl = p.vendorOrigin==="international";
  return {
    part:`${p.category} part for ${p.progName}, supplied by ${p.vendorName} (${intl?"international: currency and freight matter more":"domestic: local metal, resin and power costs matter more"}).`,
    specific:BY_CAT[p.category]||[], general:GENERAL,
    direction:p.chgH>=0?"up":"down",
  };
}

/* ---------- exposure (assumed commodity → vertical mapping shipped with the POC) ---------- */
function exposure(driver){
  const e=RAW.exposure[driver]; if(!e) return null;
  const ps=PARTS.filter(p=>e.categories.includes(p.category));
  const base=cost(ps,p=>p.cur,projCount(PARTS)), fc=cost(ps,p=>p.fcEnd,projCount(PARTS));
  return {driver, categories:e.categories, note:e.note, parts:ps.length, currentSpend:base, forecastSpend:fc, changePct:base?(fc/base-1)*100:0,
    top:ps.slice().sort((a,b)=>b.chgH-a.chgH).slice(0,5)};
}

/* ---------- picking helpers used by the reseed ---------- */
function pick(fn, rank){ const a=PARTS.filter(fn); if(rank) a.sort(rank); return a[0]||null; }

/* the POC exported these blocks on its unit-sum basis: rebuild them on the cost-per-vehicle basis so every screen agrees */
(function(){
  const k=kpis(), rc=riskConcentration(5), old=RAW.kpis||[], np=projCount(PARTS);
  RAW.kpis=[
    {id:"basket",label:k.basket.label,value:k.basket.value,format:"currency",change:k.basket.change,changeLabel:"vs previous month",direction:"up",icon:"trending"},
    {id:"forecast",label:k.forecast.label,value:k.forecast.value,format:"currency",change:k.forecast.change,changeLabel:"projected to "+k.forecast.to,direction:"up",icon:"package"},
    old.find(x=>x.id==="accuracy"),
    {id:"atrisk",label:k.atrisk.label,value:k.atrisk.value,format:"currency",change:k.atrisk.sharePct,changeLabel:"of cost per vehicle, across "+rc.partsAtRisk+" of "+PARTS.length+" parts",direction:"up",icon:"alert"},
  ].filter(Boolean);
  RAW.priceSeries=(RAW.priceSeries||[]).map(r=>{
    const i=MONTHS.indexOf(r.month), j=FM.indexOf(r.month), o={...r};
    if(i>=0){ const a=cost(PARTS,p=>p.h[i],np); o.fitted=r.fitted!=null&&r.actual? a*r.fitted/r.actual : r.fitted; o.actual=a; }
    if(j>=0){ o.forecast=cost(PARTS,p=>p.f[j],np); o.lower=cost(PARTS,p=>p.lo[j],np); o.upper=cost(PARTS,p=>p.hi[j],np); }
    return o; });
  const by={}; PARTS.forEach(p=>{ (by[p.category]=by[p.category]||[]).push(p); });
  const tot=cost(PARTS,p=>p.cur,np);
  RAW.categories=Object.keys(by).map(c=>{ const l=by[c], v=cost(l,p=>p.cur,np), f=cost(l,p=>p.fcEnd,np);
    return {category:c,value:v,share:tot?v/tot*100:0,forecastChange:v?(f/v-1)*100:0,parts:l.length}; }).sort((a,b)=>b.value-a.value);
})();

return {
  RAW, MONTHS, FM, NH, NF, monthLabel, PROGS, VENDS, CATS, PARTS, part, search,
  basketAt, forecastBasketAt, forecastBand, cost, projCount, annualSpend, PRICE_REF, PROJECT_COST, rollup, riskConcentration, kpis, movers, ALERTS,
  impact, impactTrend, categoryFxPct, commodityPassPct, MATERIAL_ASSUMPTIONS, CURRENCY_WEIGHT,
  costWalk, walkSteps, partsByBridge, meanTrack, WALK, BRIDGE_LABEL, BRIDGE_PLAIN, BRIDGE_HELP, BK, bomOf, marketContext, exposure, pick, friendlyName, hash, mulberry32, r2, sum,
  model:RAW.model, meta:RAW.meta, provenance:RAW.provenance, macro:RAW.macro,
};
})();
