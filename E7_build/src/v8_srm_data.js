/* =====================================================================
   V8  ·  SrmData — the Supplier Readiness (SRM) data model behind the SRM dashboards
   Built from what the platform already holds (480 POC parts, 6 projects with their SOP dates, 20 vendors), plus a
   deterministic, date-parametric readiness model — the same inputs always give the same numbers and every KPI can be
   recomputed for any earlier date (that is how the week-on-week deltas and the 6-month supplier trends are produced).

   What is GENERATED (no source system behind it yet — flagged in the UI): each project's milestone chain (offsets
   from its SOP date, TGN matching the existing milestone master), each part's supplier-commitment slip, tool
   requirement / cavities, supplier quality & delivery scores and the SRM owner names. Everything else is real
   platform data (parts, projects, suppliers, SOP dates, forecast price moves).
   ===================================================================== */
const SrmData = (function(){
"use strict";
const DAY=864e5;
const MS=[{id:"B-Release",off:198,p:.30,need:"Design release"},{id:"VFF",off:151,p:.55,need:"Tools ready"},{id:"PVS",off:86,p:.75,need:"Samples approved"},{id:"0-Series",off:40,p:.92,need:"PPAP approved"},{id:"SOP",off:0,p:1,need:"Series readiness"}];
/* plan progress: days before SOP -> cumulative share of the supplier-readiness work that should be done */
const CURVE=[[500,0],[400,.10],[198,.30],[151,.55],[86,.75],[40,.92],[0,1]];
const STAGES=[{id:"nom",label:"Planning / Nomination",min:1e-6},{id:"dev",label:"Development",min:.10},{id:"tool",label:"Tooling",min:.30},{id:"smp",label:"Sample Build",min:.55},{id:"ppap",label:"PPAP",min:.75},{id:"sop",label:"SOP readiness",min:.92}];
const FAMILIES=["Powertrain","Chassis","Body Stampings","Electrical","Lighting","Sensors","HVAC","Interior Trim","Braking","Fasteners"];   // the platform verticals (SRM used to group them into five "part families")
const FAMILY={};
const OWNERS=["A. Sharma","R. Mehta","K. Iyer","P. Kumar","S. Nair","V. Rao"];
const TH={risk:10,delayed:30};                // days later than required: >10 at risk, >30 delayed
const STATUS={ok:"On track",risk:"At risk",delayed:"Delayed",notstarted:"Not started"};
const RANK={notstarted:-1,ok:0,risk:1,delayed:2};

function hash(s){ let h=2166136261; s=String(s); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
const unit=s=>hash(s)/4294967295;
const ms=d=>new Date(d+"T00:00:00Z").getTime();
const iso=t=>new Date(t).toISOString().slice(0,10);
function planP(x){ if(x>=CURVE[0][0]) return 0; if(x<=0) return 1; for(let i=1;i<CURVE.length;i++){ const [x1,p1]=CURVE[i-1],[x2,p2]=CURVE[i]; if(x<=x1&&x>=x2) return p1+(p2-p1)*(x1-x)/(x1-x2); } return 1; }
const toolP=x=>x>=380?0:x<=151?1:(380-x)/(380-151);
const classify=d=>d>TH.delayed?"delayed":d>TH.risk?"risk":"ok";
const worst=(a,b)=>RANK[b]>RANK[a]?b:a;

function build(cfg){
  const today=ms(cfg.today), prog={}; cfg.programmes.forEach(p=>{ prog[p.code]={code:p.code,name:p.name,sop:ms(p.sop)}; });
  /* suppliers: reliability drives the commitment slip and the quality / delivery scores */
  const vend={}; cfg.vendors.forEach(v=>{ const r=0.48+unit("rel|"+v.name)*0.45;
    vend[v.name]={name:v.name,origin:v.origin,rel:r,delivery:Math.max(45,Math.min(99,Math.round(52+r*45+(hash("dl|"+v.name)%9)-4))),quality:Math.max(50,Math.min(99,Math.round(58+r*38+(hash("ql|"+v.name)%9)-4))),owner:OWNERS[hash("ow|"+v.name)%OWNERS.length]}; });
  const parts=cfg.parts.map(p=>{
    const v=vend[p.vendorName], pg=prog[p.progCode], tier={A:8,B:0,C:-6}[p.tier]||0;
    /* parts reach SRM through the project facelift, a model-year change or an AEKO running change; the last two carry their own
       part-level SOP date (the RFQ allows part-level project dates), which is what spreads the parts across the milestone chain */
    const k=hash("ct|"+p.id)%100, changeType=k<35?"Facelift":k<75?"Model-year change":"AEKO running change";
    const sop=changeType==="Facelift"?pg.sop:changeType==="Model-year change"?today+(70+hash("sm|"+p.id)%250)*DAY:today+(30+hash("sa|"+p.id)%190)*DAY;
    const d=Math.round((1-v.rel)*72-25+tier+((hash("d|"+p.id)%37)-18)+(v.rel<0.66&&(hash("tl|"+p.id)%100)<32?26:0));
    const w=MS.map((m,i)=>((hash("w"+i+"|"+p.id)%11)-5));
    const toolReq=(hash("tr|"+p.id)%100)<82;
    return {id:p.id,name:p.name,prog:p.progCode,progName:p.progName,category:p.category,family:p.category,vendor:p.vendorName,tier:p.tier,cur:p.cur,chgH:p.chgH,
      changeType,sop,d,w,toolReq,tools:toolReq?({A:2+hash("tn|"+p.id)%3,B:1+hash("tn|"+p.id)%2,C:1}[p.tier]||1):0,cavities:[1,2,4,8][hash("cv|"+p.id)%4],
      dTool:d+((hash("dt|"+p.id)%21)-10)};
  });
  return {today,TODAY:cfg.today,parts,vend,prog,programmes:cfg.programmes.map(p=>prog[p.code]),memo:{}};
}

/* evaluate one part at date t */
function evalPart(pt,t){
  const x=(pt.sop-t)/DAY, fPlan=planP(x), fAct=planP(x+pt.d);
  const started=fPlan>0;
  const milestones=MS.map((m,i)=>{ const R=pt.sop-m.off*DAY, dm=pt.d+pt.w[i]; return {id:m.id,R,dm,future:R>=t,st:started?classify(dm):"notstarted",C:R+dm*DAY}; });
  let status="notstarted", next=null;
  if(started){ const fut=milestones.filter(m=>m.future); status=fut.length?fut.reduce((s,m)=>worst(s,m.st),"ok"):"ok"; next=fut[0]||null; }
  let stage=-1; STAGES.forEach((s,i)=>{ if(fAct>=s.min) stage=i; });
  /* readiness = how close the supplier's commitment is to the required date: 100% on / ahead of date, 0% when 40+ days late */
  const dNext=next?next.dm:(started?pt.d:null), readiness=started?Math.max(0,Math.min(1,1-Math.max(0,dNext)/40)):null;
  /* tooling */
  let tool=null;
  if(pt.toolReq){
    const tp=toolP(x), ta=toolP(x+pt.dTool), started2=tp>0;
    const st=!started2?"notstarted":ta>=1?"done":classify(pt.dTool);
    tool={plan:tp,act:ta,st:st==="done"?"ok":st,done:st==="done",stage:!started2?"Not started":ta>=1?"Approved":ta<.25?"Design":ta<.65?"Build":"Trial",
      attain:tp>0.01?Math.max(0,Math.min(1,1-Math.max(0,pt.dTool)/40)):null};
  }
  return {pt,x,started,fPlan,fAct,readiness,status,next,stage,milestones,tool};
}

function evaluate(model,t){ t=t==null?model.today:t; const k="t"+t; return model.memo[k]||(model.memo[k]=model.parts.map(p=>evalPart(p,t))); }

const count=(arr,f)=>arr.reduce((n,x)=>n+(f(x)?1:0),0);
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;

/* roll-up of a list of evaluated parts */
function summary(ev){
  const started=ev.filter(e=>e.started), tools=ev.filter(e=>e.tool&&e.tool.st!=="notstarted");
  const c={ok:count(ev,e=>e.status==="ok"),risk:count(ev,e=>e.status==="risk"),delayed:count(ev,e=>e.status==="delayed"),notstarted:count(ev,e=>e.status==="notstarted")};
  const rd=avg(started.map(e=>e.readiness).filter(v=>v!=null));
  return {n:ev.length,started:started.length,counts:c,suppliers:new Set(ev.map(e=>e.pt.vendor)).size,
    readiness:rd==null?null:rd*100,
    toolN:tools.length,toolSum:tools.reduce((a,e)=>a+e.pt.tools,0),toolReadiness:tools.length?avg(tools.map(e=>e.tool.attain==null?1:e.tool.attain))*100:null,
    toolCounts:{ok:count(tools,e=>e.tool.st==="ok"),risk:count(tools,e=>e.tool.st==="risk"),delayed:count(tools,e=>e.tool.st==="delayed"),notstarted:count(ev,e=>e.tool&&e.tool.st==="notstarted")},
    actions:c.risk+c.delayed};
}

/* filter {project,family,supplier} -> evaluated parts */
function scope(model,f,t){ f=f||{}; return evaluate(model,t).filter(e=>(!f.project||e.pt.prog===f.project)&&(!f.family||e.pt.family===f.family)&&(!f.supplier||e.pt.vendor===f.supplier)); }

/* project-level status of one milestone: share of its started parts that will miss it */
function milestoneStatus(ev,mi){
  const st=ev.filter(e=>e.started); if(!st.length) return {st:"notstarted",n:0,bad:0,late:0,avgSlip:null};
  const ms2=st.map(e=>e.milestones[mi]), late=count(ms2,m=>m.st==="delayed"), bad=count(ms2,m=>m.st!=="ok"), sl=avg(ms2.map(m=>m.dm));
  const st2=late/st.length>=0.2?"delayed":(bad/st.length>=0.3||late/st.length>=0.1)?"risk":"ok";
  return {st:st2,n:st.length,bad,late,avgSlip:sl,shareBad:bad/st.length};
}

const NEXT_ACTION={"B-Release":"Confirm design release and drawing freeze with supplier","VFF":"Confirm tooling availability and tool trial date","PVS":"Expedite sample build and validation","0-Series":"Review PPAP documents and quality issues","SOP":"Confirm SOP capacity and logistics readiness"};
function nextAction(e){ if(!e.next) return "No open milestone"; const base=NEXT_ACTION[e.next.id]; return e.status==="delayed"?"Escalate — recovery call: "+base.charAt(0).toLowerCase()+base.slice(1):base; }

return {MS,STAGES,FAMILIES,STATUS,TH,build,evalPart,evaluate,summary,scope,milestoneStatus,nextAction,iso,ms,DAY,planP,hash,unit,worst,RANK,OWNERS};
})();
if(typeof module!=="undefined") module.exports=SrmData;
