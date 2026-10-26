/* =====================================================================
   E7  ·  PocSeed — builds the E6 master data / seed records from the POC
   Everything the POC provides (projects, vendors, parts, prices, FX,
   mediator series) is used as-is.  Fields the POC does not have (DUNS,
   plant, SOP/facelift dates, EKL targets, tooling capex ...) are generated
   deterministically from the part/vendor id and are flagged "generated" in
   the README — they carry no commercial meaning.
   ===================================================================== */
const PocSeed = (function(){
"use strict";
const P = PocCore, L = P.NH-1, M = P.macro;
const pad = (n,w)=>String(n).padStart(w,"0");
const hsh = s=>P.hash(String(s));
const r1 = v=>Math.round(v*10)/10, r2 = P.r2;

/* hero parts: the handful of parts the E6 workflows (CBD, price versions, change requests, POs, tooling...) are anchored to */
const HERO_IDS = [
  ["bracket","TGN-CHS-00255"],["bumper","TGN-BDY-00129"],["seat","KUS-CHS-00072"],["harness","TGN-ELC-00105"],
  ["fastener","KUS-FST-00120"],["rail","KDQ-BDY-00011"],["fuse","KUS-ELC-00042"],["terminal","KUS-ELC-00102"],
  ["window","KYL-ELC-00284"],["evap","KDQ-HVC-00281"],["chain","TGN-PWT-00033"],["condenser","KYL-HVC-00098"],["glove","KDQ-ITR-00203"],
];
const HERO = {}, HEROES = [];
HERO_IDS.forEach(([k,id])=>{ const p = P.part(id); if(!p) throw new Error("hero part missing: "+id); HERO[k]=p; HEROES.push(p); });
const H = {}; Object.keys(HERO).forEach(k=>H[k]=HERO[k].name);
const HEROSET = new Set(HEROES.map(p=>p.id));

const PROJ_ORDER = ["TGN","KUS","KDQ","KYL","SLV","VRT"];
const progOf = c=>P.PROGS.find(p=>p.code===c);
const FACELIFT = {TGN:"2027-03-01",KUS:"2027-06-15",KDQ:"2027-09-01",KYL:"2028-01-10",SLV:"2027-11-20",VRT:"2028-03-05"};
const E6COMM = {"Steel":"Steel","Cast iron":"Steel","Aluminium":"Aluminium","Copper":"Copper","Polymer":"Polymer","Polycarbonate":"Polymer","Silicon":"Electronics"};
const commodityOf = p=> p.category==="Fasteners" ? "Fastener" : (E6COMM[p.material]||"Steel");
const TIER_TYPE = {A:"Assembly",B:"Single part",C:"Fakum/Colour"};

const eur = ()=>M.eurinr[L], usd = ()=>M.usdinr[L];
const ym = i=>P.MONTHS[i]+"-01";
const kgInr = (usdPerT,i)=>usdPerT*M.usdinr[i]/1000;

function projects(){
  return PROJ_ORDER.map((c,i)=>{ const g=progOf(c);
    return {id:"P"+(i+1), code:c, brand:g.oem==="SKODA"?"Skoda":"VW", status:"Active", sop:FACELIFT[c], name:g.name, oem:g.oem,
      segment:g.segment, volume:g.volume, localisation:g.localisation, sourcingNos:(i%2?"G IN ":"F IN ")+(20+i), lastUpdated:"2026-07-1"+(1+(i%9))};
  });
}

const PLACES = ["Pune","Chennai","Gurgaon","Halol","Aurangabad","Manesar","Bengaluru","Nashik","Chakan","Sanand"];
function suppliers(){
  const roll = {}; P.rollup("vendor").forEach(r=>roll[r.name]=r);
  return P.VENDS.map((v,i)=>{
    const mats = {}; P.PARTS.filter(p=>p.vendor===v).forEach(p=>{ const c=commodityOf(p); mats[c]=(mats[c]||0)+1; });
    const dom = Object.keys(mats).sort((a,b)=>mats[b]-mats[a])[0]||"Steel";
    const ch = roll[v.name]?roll[v.name].changePct:0;
    return {id:"S"+(i+1), duns:"43"+pad(1100000+i*37919,7), name:v.name, country:"India", origin:v.origin==="international"?"International group":"Domestic",
      place:PLACES[hsh(v.code)%PLACES.length], plant:"PL-"+(100+i), commodity:dom,
      businessShare:(25+hsh(v.code+"bs")%56)+"%", riskRating: ch>=4?"High":ch>=2.5?"Medium":"Low",
      importDep:v.importDep, repriceMonths:v.repriceMonths, lastUpdated:"2026-07-"+pad(3+(i%25),2)};
  });
}

function partStatus(p){ const h=hsh(p.id+"st")%100; return h<6?"Overdue":h<20?"Due":"Fresh"; }
function parts(){
  const order = HEROES.concat(P.PARTS.filter(p=>!HEROSET.has(p.id)));
  return order.map((p,i)=>({id:"PT"+(i+1), number:p.id, designation:p.name, type:TIER_TYPE[p.tier]||"Single part", project:p.progCode,
    commodity:commodityOf(p), supplier:p.vendorName, uoQ:"PCE", status:partStatus(p), lastUpdated:"2026-07-"+pad(5+(hsh(p.id)%22),2), poc:p}));
}

function tasks(){
  const steel = kgInr(M.steel[L],L);
  return [
    {icon:"📥", title:"Fill CBD weights — "+H.bracket, meta:"Sourcing • "+HERO.bracket.progCode, role:"buyer", due:"Overdue by 3d", wf:"SRC-2026-0114"},
    {icon:"✅", title:"Approve commodity price change — Steel HRC", meta:"Commodity • Effective 01-Aug", role:"approver", due:"Due today", wf:"CMD-2026-0033"},
    {icon:"🛠", title:"Update tooling readiness — "+H.seat, meta:"SRM • Trial phase", role:"srm", due:"Due in 2d", wf:"SRM-2026-0201"},
    {icon:"📝", title:"Verify AI-extracted evaluation sheet — "+H.harness, meta:"Technical Change • AEKO-2026-0052", role:"aeko", due:"Due in 1d", wf:"AEKO-2026-0052"},
    {icon:"💰", title:"Review investment benchmarking — "+HERO.evap.progCode, meta:"Finance • Quarterly", role:"finance", due:"Due in 5d", wf:"INV-2026-0077"},
    {icon:"📌", title:"Register new project milestones — KYL", meta:"Project Mgr • Kick-off", role:"pm", due:"Due in 3d", wf:"PRJ-2026-0004"},
    {icon:"⚠️", title:"Escalation: milestone overdue 4x — "+H.bumper, meta:"SRM • Escalated to Head", role:"srm", due:"Overdue by 9d", wf:"SRM-2026-0189"},
    {icon:"📥", title:"Fill your details — new part "+H.fastener, meta:"Sourcing import • auto-generated", role:"buyer", due:"Due in 2d", wf:"SRC-2026-0121"},
    {icon:"✅", title:"Sign-off MOD sheet — "+H.bracket, meta:"Technical Change • Approval stage 3/5", role:"approver", due:"Due tomorrow", wf:"AEKO-2026-0041"},
    {icon:"🔧", title:"Admin: review RBAC matrix change request", meta:"Admin • Governance", role:"admin", due:"Due in 4d", wf:"ADM-2026-0006"},
  ];
}
function changes(){
  return [
    {id:"TC1", type:"AEKO", wf:"AEKO-2026-0041", part:H.bracket, status:"Pending", stage:"Impact Analysis"},
    {id:"TC2", type:"AWE", wf:"AWE-2026-0018", part:H.bumper, status:"Approved", stage:"Implementation"},
    {id:"TC3", type:"AeA", wf:"AEA-2026-0009", part:H.fastener, status:"Open", stage:"Intake"},
    {id:"TC4", type:"AEKO", wf:"AEKO-2026-0052", part:H.harness, status:"Pending", stage:"Supplier Offers"},
    {id:"TC5", type:"AWE", wf:"AWE-2026-0021", part:H.seat, status:"Approved", stage:"Approval Workflow"},
  ];
}
function freshness(){
  return [
    {name:"Sourcing Records — TGN", cadence:"Monthly", daysOverdue:14},
    {name:"Commodity Price — Steel HRC", cadence:"Defined interval", daysOverdue:6},
    {name:"SRM Milestones — "+H.bumper, cadence:"Weekly", daysOverdue:9},
    {name:"CBD Weights — "+H.bracket, cadence:"Monthly", daysOverdue:0},
    {name:"Forecast price panel — POC export", cadence:"Monthly", daysOverdue:0},
    {name:"Geopolitical alerts — analyst review", cadence:"Weekly", daysOverdue:3},
  ];
}

/* effective-dated masters, anchored to the POC macro series */
const SAMPLE_IDX = [24,27,30,33,35];   // Jul-25, Oct-25, Jan-26, Apr-26, Jun-26
function histFrom(series, conv, src){
  return SAMPLE_IDX.map(i=>({effectiveFrom:ym(i), value:r2(conv(series[i],i)), source:src}));
}
function commodities(){
  const SRC = "POC mediator series (offline fallback — synthetic)";
  return [
    {id:"C1", code:"STEEL-HRC", name:"Steel Hot-Rolled Coil", uom:"INR/kg", history:histFrom(M.steel,(v,i)=>kgInr(v,i),SRC), lastUpdated:ym(35)},
    {id:"C2", code:"ALU-ING", name:"Aluminium Ingot", uom:"INR/kg", history:histFrom(M.aluminium,(v,i)=>kgInr(v,i),SRC), lastUpdated:ym(35)},
    {id:"C3", code:"COPPER", name:"Copper Cathode", uom:"INR/kg", history:histFrom(M.copper,(v,i)=>kgInr(v,i),SRC), lastUpdated:ym(35)},
    {id:"C4", code:"LEAD", name:"Lead", uom:"INR/kg", history:[{effectiveFrom:"2026-01-01",value:178,source:"Reference (not in POC)"}], lastUpdated:"2026-01-01"},
    {id:"C5", code:"PRECIOUS-AG", name:"Silver (precious)", uom:"INR/g", history:[{effectiveFrom:"2026-02-01",value:92,source:"Reference (not in POC)"},{effectiveFrom:"2026-07-01",value:101,source:"Reference (not in POC)"}], lastUpdated:"2026-07-01"},
    {id:"C6", code:"ENERGY-CRUDE", name:"Energy / crude index", uom:"USD/bbl", history:histFrom(M.energy,v=>v,SRC), lastUpdated:ym(35)},
    {id:"C7", code:"FREIGHT-IDX", name:"Container freight index", uom:"index pts", history:histFrom(M.freight,v=>v,SRC), lastUpdated:ym(35)},
  ];
}
function fx(){
  const SRC = "ECB reference rate (POC)";
  const eurH = histFrom(M.eurinr,v=>v,SRC), usdH = histFrom(M.usdinr,v=>v,SRC);
  const rec = (id,project,no,cur,h)=>({id,project,sourcingNo:no,currency:cur,history:h.map(x=>({...x})),lastUpdated:h[h.length-1].effectiveFrom});
  return [
    rec("FX1","TGN","F IN 20","EUR",eurH), rec("FX2","TGN","G IN 31","USD",usdH),
    rec("FX3","KUS","F IN 21","EUR",eurH), rec("FX4","KDQ","G IN 33","EUR",eurH),
    rec("FX5","KYL","F IN 23","USD",usdH),
  ];
}
function milestones(){
  return [
    {id:"M1",project:"TGN",name:"B-Release",planDate:"2026-08-15",lastUpdated:"2026-07-10"},
    {id:"M2",project:"TGN",name:"VFF",planDate:"2026-10-01",lastUpdated:"2026-07-10"},
    {id:"M3",project:"TGN",name:"PVS",planDate:"2026-12-05",lastUpdated:"2026-07-10"},
    {id:"M4",project:"TGN",name:"0-Series",planDate:"2027-01-20",lastUpdated:"2026-07-10"},
    {id:"M5",project:"KUS",name:"PPAP",planDate:"2027-04-10",lastUpdated:"2026-06-18"},
    {id:"M6",project:"KUS",name:"Facelift SOP",planDate:"2027-06-15",lastUpdated:"2026-06-18"},
    {id:"M7",project:"KDQ",name:"P-Frei",planDate:"2027-02-28",lastUpdated:"2026-05-30"},
    {id:"M8",project:"KDQ",name:"Facelift SOP",planDate:"2027-09-01",lastUpdated:"2026-05-30"},
  ];
}
function carVolumes(){
  const out=[]; let n=1;
  PROJ_ORDER.forEach((c,i)=>{ const g=progOf(c);
    out.push({id:"V"+(n++),project:c,model:c,year:2026,volume:g.volume,uploadedBy:i%2?"Z":"B",effectiveFrom:"2026-07-01",lastUpdated:"2026-07-01"});
  });
  [["TGN",1.08],["KUS",1.05]].forEach(([c,k])=>out.push({id:"V"+(n++),project:c,model:c,year:2027,volume:Math.round(progOf(c).volume*k/100)*100,uploadedBy:"B",effectiveFrom:"2026-07-01",lastUpdated:"2026-07-01"}));
  return out;
}
function eklTargets(){
  const mk=(id,p,i)=>({id,project:p.progCode,part:p.name,uom:"INR",lastUpdated:ym(35),
    history:[{effectiveFrom:"2026-01-01",value:Math.round(p.h[30]*0.99),source:"Business plan"},{effectiveFrom:"2026-06-01",value:Math.round(p.h[34]*0.985),source:"Revised BP"}]});
  return [mk("E1",HERO.bracket),mk("E2",HERO.bumper),mk("E3",HERO.seat)];
}

/* cost-breakdown spec for a hero part (weights from the POC part weight; import content from vendor import dependency) */
const MIX = {   // share of net weight by commodity bucket
  "Fasteners":{steel:1}, "Body Stampings":{steel:1}, "Chassis":{steel:.9,aluminium:.1}, "Braking":{steel:1},
  "Powertrain":{steel:.35,aluminium:.65}, "HVAC":{aluminium:.6,copper:.25,steel:.15}, "Electrical":{copper:.6,steel:.15},
  "Lighting":{aluminium:.25}, "Interior Trim":{steel:.1}, "Sensors":{copper:.2},
};
function cbdSpec(p,i){
  const mix = MIX[p.category]||{steel:1}, gross = Math.max(0.05,p.kg), net = gross*.9;
  const w = {steel:{grade:"",supplier:p.vendorName,gross:0,net:0},aluminium:{gross:0,net:0},copper:{gross:0,net:0},lead:{gross:0,net:0},precious:{gross:0,net:0}};
  // the POC panel's weight_kg is synthetic: keep raw material to <=45% of the unit price so the CBD stays plausible
  const px = {steel:kgInr(M.steel[L],L), aluminium:kgInr(M.aluminium[L],L), copper:kgInr(M.copper[L],L)};
  const rawAtFull = Object.keys(mix).reduce((s,k)=>s+net*mix[k]*(px[k]||0),0);
  const k0 = rawAtFull>p.cur*.45 ? p.cur*.45/rawAtFull : 1;
  Object.keys(mix).forEach(k=>{ w[k].gross=r2(gross*mix[k]*k0); w[k].net=r2(net*mix[k]*k0); });
  if(w.steel.net>0) w.steel.grade = ["DX54D+Z","HC340LA","S355MC","SAE 1020"][i%4];
  const capex = ({"Body Stampings":4200000,"Chassis":2800000,"Electrical":1600000,"Fasteners":600000,"Powertrain":6000000,"HVAC":2400000,"Interior Trim":1900000,"Lighting":3100000,"Braking":2200000,"Sensors":1300000})[p.category]||2000000;
  const vol = progOf(p.progCode).volume*4;
  return {
    qtyPerCar:p.qty, weights:w,
    importContent:{value:r2(p.vendor.importDep*p.cur*0.4/eur()), fxRate:eur(), currency:"EUR", origin:p.vendorOrigin==="international"?"Germany":"India"},
    vsiOriginal:Math.round(p.nom), targetOriginal:Math.round(p.nom*.97),
    dd:{amortPerCar:r1(capex/vol), volume:vol}, capex,
  };
}
function priceVersions(p){
  const base=[
    {i:0,src:"Nomination",cr:null},{i:12,src:"Vendor re-price",cr:null},{i:24,src:"Commodity re-price",cr:"CMD-2026-0033"},{i:35,src:"Current production price",cr:null},
  ];
  return base.map(b=>({price:Math.round(p.h[b.i]),effectiveFrom:ym(b.i),source:b.src,changeReq:b.cr}));
}

/* live facts for the report-centre previews (computed when a report is generated) */
function reportFacts(){
  const cr=v=>"₹"+(Math.abs(v)>=1e5?(v/1e5).toFixed(2)+" L":Math.round(v).toLocaleString("en-IN"));
  const cb=Object.keys(DATA.priceVersions).map(n=>{ const v=DATA.priceVersions[n], l=v[v.length-1]; return l.target?(l.price/l.target-1)*100:0; });
  const avg=cb.reduce((a,b)=>a+b,0)/Math.max(1,cb.length), over=cb.filter(x=>x>5).length;
  const m={}; P.PARTS.forEach(p=>{ m[p.material]=(m[p.material]||0)+p.cur*p.qty; }); const tot=Object.values(m).reduce((a,b)=>a+b,0);
  const split=Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+" "+Math.round(v/tot*100)+"%").join(" · ");
  const k=P.kpis(), im=P.impact({fxPct:5}), pend=(window.ApprovalEngine?ApprovalEngine.flows.filter(f=>f.steps.some(s=>s.status==="current")).length:0);
  return {
    costVsTarget:cb.length+" CBD parts: avg "+(avg>=0?"+":"")+avg.toFixed(1)+"% vs target; "+over+" above +5%",
    split:"By material, share of cost per vehicle: "+split,
    movement:"Forecast "+(k.forecast.change>=0?"+":"")+k.forecast.change.toFixed(2)+"% to "+k.forecast.to+" (POC model)",
    portfolio:DATA.projects.length+" projects · "+P.PARTS.length+" tracked parts · cost per vehicle "+cr(k.basket.value)+" · "+TaskCentre.tasks.filter(t=>t.state==="open").length+" open tasks",
    risk:cr(k.atrisk.value)+" cost at risk per vehicle (>5% rise) · a +5% rupee move adds about "+cr(im.delta)+" (illustrative)",
    change:DATA.changes.length+" technical changes in flight · "+pend+" approvals pending",
  };
}

return {reportFacts, HERO, HEROES, H, HEROSET, PROJ_ORDER, commodityOf, projects, suppliers, parts, tasks, changes, freshness, commodities, fx, milestones,
  carVolumes, eklTargets, cbdSpec, priceVersions, eur, usd, kgInr};
})();
