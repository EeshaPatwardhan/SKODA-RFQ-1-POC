/* =====================================================================
   V8  ·  SrmData.ops — data behind the SRM operational screens
   Part assignment · tool register · milestone amendments · R/Y/G readiness · alert cadence & escalation
   Same rules as v8_srm_data.js: deterministic, derived from the part's own slip, flagged as generated in the UI.
   ===================================================================== */
(function(){
"use strict";
const S=(typeof SrmData!=="undefined")?SrmData:require("./v8_srm_data.js");
const DAY=S.DAY, h=S.hash, MS=S.MS;
const pick=(a,k)=>a[h(k)%a.length];
const NAMES={ktm:["Dr. M. Kulkarni","S. Deshpande","A. Joshi","N. Bhosale","R. Patil","V. Gokhale"],qe:["T. Menon","L. D'Souza","H. Qureshi","P. Shetty","G. Rao"],buyer:["A. Krishnan","D. Fernandes","M. Singh","S. Gupta"],log:["B. Thakur","C. Pillai","J. Mathew"],tool:["R. Iyer","K. Bhat","S. Dutta"],supervisor:"Head of SRM — S. Kapoor",mgmt:"Management — R. Banerjee"};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- part assignment (F-080..086, F-141) — in-session edits live in OV */
const OV={assign:{},monitor:{},am:{},alert:{}};
function people(m,e){
  const pt=e.pt, o=OV.assign[pt.id]||{}, v=m.vend[pt.vendor];
  const gap=(k,p)=>(h(k+"|"+pt.id)%100)<p;
  return {ktm:pick(NAMES.ktm,"ktm|"+pt.prog),buyer:pick(NAMES.buyer,"by|"+pt.vendor),srm:o.srm||v.owner,
    qe:o.qe||(gap("qg",7)?null:pick(NAMES.qe,"qe|"+pt.id)),log:o.log||(gap("lg",9)?null:pick(NAMES.log,"lo|"+pt.id)),
    tool:pt.toolReq?(o.tool||(gap("tg",6)?null:pick(NAMES.tool,"to|"+pt.id))):"n/a"};
}
const ROLES=[["ktm","KTM expert"],["buyer","Buyer"],["srm","SRM engineer"],["qe","QE"],["log","Logistics"],["tool","Tool owner"]];
const missing=p=>ROLES.filter(r=>p[r[0]]===null).map(r=>r[1]);
function monitoring(e){ return !!(e.started||OV.monitor[e.pt.id]); }
function baseOf(m,e){ if(e.pt.tier!=="C") return null; const b=m.parts.find(p=>p.tier!=="C"&&p.prog===e.pt.prog&&p.category===e.pt.category); return b?b.name:null; }

/* ---------- tool register (F-093..100) */
const TOOL_TYPE={"Fasteners":"Progressive die","Body Stampings":"Press tool (draw)","Chassis":"Forging die","Interior Trim":"Injection mould","Braking":"Casting die","Powertrain":"Casting die","HVAC":"Injection mould","Electrical":"Injection mould","Lighting":"Injection mould","Sensors":"Assembly fixture"};
const MAKERS=["In-house tool shop","Tata Toolings","Sundaram Tool Shop","Mahindra Tooling","Precision Dies Pune","Elgi Moulds"];
const toolP=x=>x>=380?0:x<=151?1:(380-x)/(380-151);
function toolRecords(m,e){
  const pt=e.pt; if(!pt.toolReq) return [];
  const out=[];
  for(let k=0;k<pt.tools;k++){
    const dT=pt.dTool+((h("tk"+k+"|"+pt.id)%15)-7), x=e.x, plan=toolP(x), act=toolP(x+dT), started=plan>0;
    const st=!started?"notstarted":act>=1?"done":dT>S.TH.delayed?"delayed":dT>S.TH.risk?"risk":"ok";
    const cap=(15+(h("cx"+k+"|"+pt.id)%45))*(1+pt.cavities/8)*({A:1.4,B:1,C:.6}[pt.tier]||1);   // lakh INR
    out.push({part:e,no:"TL-"+pt.prog+"-"+String(1000+h("tn"+k+"|"+pt.id)%9000)+(pt.tools>1?"-"+(k+1):""),type:TOOL_TYPE[pt.category]||"Tool",maker:pick(MAKERS,"mk|"+pt.id),cavities:pt.cavities,
      kickoff:pt.sop-380*DAY+(h("ko"+k+"|"+pt.id)%12)*DAY,trial:pt.sop-151*DAY+dT*DAY,pct:Math.round(clamp(act,0,1)*100),st,dT,
      location:!started?"Not yet released":act<.25?"Toolmaker — design":act<.65?"Toolmaker — build":act<1?"Supplier plant — trial":"Series plant",
      shipment:act>=1?"Shipped to series site":act>=.65?"Trial in progress":"Not due",firstParts:act>=1?"Approved":act>=.9?"Pending":"—",
      capexL:Math.round(cap*10)/10,spentL:Math.round(cap*clamp(act,0,1)*10)/10});
  }
  return out;
}

/* ---------- milestone amendments (F-142) */
function amendments(m,ev){
  const out=[];
  ev.forEach(e=>{ if(!e.started) return;
    e.milestones.forEach((k,mi)=>{ if(!k.future||k.dm<=8||(h("am"+mi+"|"+e.pt.id)%100)>=20) return;
      const key=e.pt.id+"|"+mi, o=OV.am[key]||{}, firstSlip=Math.max(0,k.dm-(6+h("as"+mi+"|"+e.pt.id)%20));
      out.push({key,e,mi,ms:MS[mi],oldT:k.R+firstSlip*DAY,newT:k.C,by:m.vend[e.pt.vendor].owner,approver:h("ap"+mi+"|"+e.pt.id)%2?"Supervisor":"Commodity Lead",
        requested:m.today-(1+h("ar"+mi+"|"+e.pt.id)%21)*DAY,status:o.status||((h("ast"+mi+"|"+e.pt.id)%100)<35?"pending":"approved"),decidedBy:o.by||null}); }); });
  return out;
}

/* ---------- R / Y / G readiness (F-105..112) */
const DIMS=[{id:"eng",label:"Engineering"},{id:"qual",label:"Quality"},{id:"tool",label:"Tooling"},{id:"cap",label:"Capacity"},{id:"mat",label:"Material"},{id:"log",label:"Logistics"},{id:"prod",label:"Production"}];
function ryg(m,e){
  if(!e.started) return null;
  const pt=e.pt, v=m.vend[pt.vendor], dn=e.next?e.next.dm:pt.d;
  const bias={eng:0,qual:(85-v.quality)*0.5,tool:0,cap:(1-v.rel)*10-3,mat:(h("mb|"+pt.category)%7)-3,log:v.origin==="international"?4:0,prod:2};
  const dims=DIMS.map(d=>{
    const noise=(h(d.id+"|"+pt.id)%17)-8; let late=dn+bias[d.id]+noise;
    if(d.id==="tool") late=pt.toolReq?pt.dTool:dn-10+noise/2;
    const score=Math.round(clamp(100-2.5*Math.max(0,late),0,100)); return {id:d.id,label:d.label,score,c:score>=75?"G":score>=25?"Y":"R"}; });
  const reds=dims.filter(d=>d.c==="R").length, ys=dims.filter(d=>d.c==="Y").length;
  const overall=reds>=1?"R":ys>=3?"Y":"G";                     // any red dimension turns the part red; three or more yellows turn it yellow
  return {dims,overall,score:Math.round(dims.reduce((s,d)=>s+d.score,0)/dims.length),reds,ys};
}

/* ---------- alerts: 6W / 4W / 2W / overdue (F-113) and the escalation ladder (F-114) */
function alerts(m,ev){
  const out=[];
  ev.forEach(e=>{ if(!e.started) return;
    e.milestones.forEach((k,mi)=>{
      const days=Math.round((k.R-m.today)/DAY); let level=null;
      if(k.R<m.today){ if(e.fAct<MS[mi].p) level="overdue"; }
      else if(days<=42&&k.st!=="ok") level=days<=14?"2W":days<=28?"4W":"6W";
      if(!level) return;
      const key=e.pt.id+"|"+mi, o=OV.alert[key]||{}, hh=h("rm"+mi+"|"+e.pt.id);
      let rem=level==="overdue"?3+hh%7:level==="2W"?1+hh%3:level==="4W"?hh%3:hh%2; if(o.reminders!=null) rem=o.reminders;
      let esc=o.esc||null; if(!esc){ if(level==="overdue"&&rem>=6) esc="Management"; else if(level==="overdue"&&rem>=3) esc="Supervisor"; else if(rem>=4) esc="Head of SRM"; }
      out.push({key,e,mi,ms:MS[mi],level,days,R:k.R,reminders:rem,esc,owner:m.vend[e.pt.vendor].owner}); }); });
  const rank={overdue:0,"2W":1,"4W":2,"6W":3};
  return out.sort((a,b)=>rank[a.level]-rank[b.level]||b.reminders-a.reminders||a.days-b.days);
}
const ESC_TEXT={Supervisor:"Supervisor",Management:"Supervisor → Management","Head of SRM":"Head of SRM"};

S.ops={OV,NAMES,ROLES,DIMS,people,missing,monitoring,baseOf,toolRecords,amendments,ryg,alerts,ESC_TEXT};
if(typeof module!=="undefined") module.exports=S.ops;
})();
