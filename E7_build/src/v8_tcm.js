/* =====================================================================
   V8  ·  Technical Change management dashboard — Overview · Change Impact · Approval Workflow · Implementation · Change Register
   One change register feeds every page, so each count, ₹ figure and chart reconciles to the same rows.
   Register = the 5 live workflow changes (DATA.changes, read from the module so a stage change shows here at once)
            + 60 generated records (v8_tcm.js, deterministic, labelled "Illustrative prototype data" in the UI).
   Generated: every record's category, dates, owner, piece-price change and tooling cost. Real inputs: project, part, supplier, annual volume, quantity per car,
   piece price (POC part panel), project SOP dates, the risk rule of the module (riskCalc: cost / milestone / supplier) and the approval chain of the module.
   ===================================================================== */
(function(){
"use strict";
const T=window.V8TC; if(!T) return;
const P=PocCore, C=PocCharts, U=PocUI, S=SrmData, K=V8Srm, esc=C.esc, h=S.hash;
const {T0,STAGES,CD,riskCalc,totals,projOf,carName,sopOf,fmtDate,addDays,dayDiff}=T;

/* ------------------------------------------------------------ vocabulary and rules */
const LIFE=["Open","Pending approval","Approved","Implemented","Rejected","Returned for rework"];
const LCOL={"Open":"var(--info)","Pending approval":"var(--c-amber)","Approved":"var(--ok)","Implemented":"var(--c-anchor)","Rejected":"var(--red)","Returned for rework":"var(--faint)"};
const ACTIVE=["Open","Pending approval","Approved","Returned for rework"];
const CATS=["Cost Reduction","Design Change","Supplier Change","Quality Improvement","Regulatory","Other"];
const REAL_CAT=["Design Change","Cost Reduction","Supplier Change","Other","Quality Improvement"];
const AP=["Engineering","Quality","SRM","Finance","Commodity","Management","Final confirmation"];
const AP_ROLE={Engineering:"aeko",Quality:"approver",SRM:"srm",Finance:"finance",Commodity:"commodity",Management:"pm","Final confirmation":"aeko"};
const AP_SLA=3, RETURN_SLA=5, SOP_BUFFER=60, STAGE_SLA=[5,3,10,7,5,7,7], STAGE_ROLE_OPEN=["aeko","aeko","aeko","buyer","buyer","buyer","buyer"];
const nf0=v=>Math.round(v).toLocaleString("en-IN");
const money=v=>U.cr(Math.abs(v)), sg=v=>(v>0?"+":v<0?"−":"")+U.cr(Math.abs(v));
const pc=(a,b)=>b?Math.round(a/b*100):0;
const shortP=code=>K.short(carName(code));
const roleLabel=r=>(ROLES.find(x=>x.id===r)||{}).label||r;
const people=role=>DATA.users.filter(u=>u.role===role).map(u=>u.name);
const F={project:"",type:"",status:"",year:""}, UI={sel:null,od:false,tab:"all"};

/* ------------------------------------------------------------ the register */
const volFor=code=>{ const y=+T0.slice(0,4), v=DATA.carVolumes.filter(x=>x.project===code); return (v.find(x=>x.year===y)||v.slice().sort((a,b)=>b.year-a.year)[0]||{volume:0}).volume; };
const shuffled=(list,key)=>list.map((v,i)=>[h(key+"|"+i),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
const expand=pairs=>pairs.flatMap(([v,n])=>Array(n).fill(v));
const DESC={"Cost Reduction":["Lightweight material alternative","Supplier VA/VE cost-down","Process optimisation","Design simplification — fewer pieces"],
  "Design Change":["Geometry revision for packaging","Connector and fitment revision","Design revision — cavity re-profiling","Mounting point relocation"],
  "Supplier Change":["Second-source qualification","Supplier transfer to a localised source","Sub-supplier change at the same price basis"],
  "Quality Improvement":["Tolerance correction","Corrosion protection upgrade","Process-control improvement"],
  "Regulatory":["Regulatory compliance update","Homologation requirement update"],"Other":["BOM and documentation correction","Packaging change"]};

function schedule(r,rnd){
  const L=r.life; let since;
  if(L==="Open") since=[0,0,1,1,2,2,3,3,4,5,6,8,12][rnd("sn",13)];
  else if(L==="Pending approval") since=[0,0,1,1,1,2,2,3,3,4,5,6,8][rnd("sn",13)];
  else if(L==="Approved") since=2+rnd("sn",70);
  else if(L==="Implemented") since=4+rnd("sn",140);
  else if(L==="Rejected") since=6+rnd("sn",60);
  else since=[1,2,3,5,7,9,12][rnd("sn",7)];
  r.stageSince=addDays(T0,-since); r.raised=addDays(T0,-(since+4+rnd("rs",45)));
  const pi=rnd("pi",1000)/1000;
  if(L==="Open") r.plannedImpl=addDays(T0,20+Math.floor(pi*260));
  else if(L==="Pending approval") r.plannedImpl=addDays(T0,15+Math.floor(pi*200));
  else if(L==="Approved") r.plannedImpl=addDays(T0,-30+Math.floor(pi*150));
  else if(L==="Implemented"){ r.implementedOn=r.stageSince; r.plannedImpl=addDays(r.implementedOn,-6+Math.floor(pi*16)); }
  else if(L==="Returned for rework") r.plannedImpl=addDays(T0,30+Math.floor(pi*200));
  else r.plannedImpl=null;
}
const apIndex=s=>{ const l=String(s.label||""), k=AP.findIndex((a,i)=>i<6&&l.indexOf(a)===0); return k>=0?k:(/AEKO Coordinator|final/i.test(l)?6:0); };
const stageLabel=r=>r.life==="Open"?STAGES[r.stageIdx]:r.life==="Pending approval"?"Approval · "+AP[r.apStep]:r.life==="Approved"?"Implementation":r.life==="Implemented"?"Closed":r.life==="Rejected"?"Rejected at "+AP[r.apStep]:"Rework · "+AP[r.apStep];
function ownerOf(r,rnd){
  const role=r.life==="Open"?STAGE_ROLE_OPEN[r.stageIdx]:(r.life==="Pending approval"||r.life==="Rejected")?AP_ROLE[AP[r.apStep]]:r.life==="Returned for rework"?"aeko":"buyer";
  const l=people(role); r.ownerRole=role; r.owner=l.length?l[rnd("ow",l.length)]:roleLabel(role);
}
function finish(r){
  r.active=ACTIVE.includes(r.life); r.stage=stageLabel(r);
  r.due=r.life==="Open"?addDays(r.stageSince,STAGE_SLA[r.stageIdx]):r.life==="Pending approval"?addDays(r.stageSince,AP_SLA):r.life==="Returned for rework"?addDays(r.stageSince,RETURN_SLA):r.life==="Approved"?r.plannedImpl:null;
  r.kind=r.life==="Open"?STAGES[r.stageIdx]:r.life==="Pending approval"?AP[r.apStep]+" approval":r.life==="Returned for rework"?"Rework":"Implementation";
  const dd=r.due&&r.active?dayDiff(r.due,T0):0; r.overdue=dd>0?dd:0;
  r.sop=sopOf(r.project); r.sopCrit=!!(r.active&&r.sop&&r.sop>T0&&r.plannedImpl&&r.plannedImpl>=addDays(r.sop,-SOP_BUFFER));
  r.impl=implOf(r);
  const fx=r.risk.factors.concat([{k:"SOP",hit:r.sopCrit,txt:r.sopCrit?"Planned inside the "+SOP_BUFFER+"-day window before the project's SOP, or later":"Not inside the pre-SOP window"},{k:"Overdue",hit:r.overdue>7,txt:r.overdue>7?r.overdue+" days past the due date":"Not more than 7 days overdue"}]), hits=fx.filter(f=>f.hit).length;
  r.rk={level:!r.active?"—":hits>=2?"High":hits===1?"Medium":"Low",hits,factors:fx};
  const a=Math.abs(r.ann||0), sc=(r.rk.level==="High"?2:r.rk.level==="Medium"?1:0)+(a>=2e7?2:a>=5e6?1:0);
  r.score=sc; r.priority=!r.active?"—":sc>=3?"High":sc>=2?"Medium":"Low";
  r.year=(r.implementedOn||r.plannedImpl||"").slice(0,4);
  return r;
}
function implOf(r){
  if(r.life==="Rejected"||!r.plannedImpl) return null;
  if(r.life==="Implemented"){ const late=dayDiff(r.plannedImpl,r.implementedOn); return {s:"Implemented",d:late}; }
  const dd=dayDiff(T0,r.plannedImpl);
  if(dd<0) return {s:"Delayed",d:-dd};
  const risk=r.sopCrit||(dd<=45&&r.life!=="Approved")||(dd<=60&&r.deps.tooling);
  return {s:risk?"At risk":"On track",d:dd};
}
let SYN=null;
function genSyn(){
  const byProj={}; DATA.parts.forEach(p=>{ if(p.poc&&p.poc.cur&&p.poc.prog) (byProj[p.project]||(byProj[p.project]=[])).push(p); });
  Object.values(byProj).forEach(a=>a.sort((x,y)=>x.number<y.number?-1:1));
  const used=new Set(DATA.changes.map(c=>c.partNo));
  const pick=(code,i)=>{ const a=byProj[code]||[], k=h("pt|"+i)%a.length; for(let n=0;n<a.length;n++){ const p=a[(k+n)%a.length]; if(!used.has(p.number)){ used.add(p.number); return p; } } return a[k]; };
  const lives=shuffled(expand([["Open",20],["Pending approval",13],["Approved",11],["Implemented",12],["Rejected",2],["Returned for rework",2]]),"lf");
  const cats=shuffled(expand([["Cost Reduction",16],["Design Change",13],["Supplier Change",10],["Quality Improvement",8],["Regulatory",8],["Other",5]]),"ct");
  const projs=shuffled(expand([["KUS",14],["TGN",12],["KYL",12],["SLV",8],["VRT",8],["KDQ",6]]),"pj");
  const AP_POOL=[0,0,1,1,2,2,3,3,3,4,4,4,4,5,5,6];
  return lives.map((life,i)=>{
    const rnd=(k,n)=>h(k+"|"+i)%n, cat=cats[i], code=projs[i], p=pick(code,i);
    const form=cat==="Regulatory"?"AEKO":["AEKO","AEKO","AEKO","AEKO","AEKO","AEKO","AWE","AWE","AWE","AeA"][rnd("fm",10)];
    const no=100+i*2+rnd("wn",2), wf=(form==="AeA"?"AEA":form)+"-2026-"+String(no).padStart(4,"0");
    const r={id:"R"+String(i+1).padStart(2,"0"),live:null,wf,form,category:cat,project:code,part:p.designation,partNo:p.number,supplier:p.supplier,vertical:p.poc.category,life};
    r.desc=DESC[cat][rnd("ds",DESC[cat].length)];
    r.stageIdx=life==="Open"?rnd("st",7):life==="Approved"?8:life==="Implemented"?9:7;
    r.apStep=life==="Pending approval"?AP_POOL[rnd("ap",AP_POOL.length)]:life==="Rejected"?rnd("rj",6):life==="Returned for rework"?rnd("rt",6):null;
    schedule(r,rnd);
    const x=rnd("pc",1000)/1000; let pct=cat==="Cost Reduction"?-(2+x*8):cat==="Supplier Change"?(rnd("sg",10)<3?0.5+x*3:-(1.5+x*5)):cat==="Design Change"?-1+x*6:cat==="Quality Improvement"?x*4:cat==="Regulatory"?0.5+x*5.5:-1.5+x*3.5;
    r.pct=Math.round(pct*10)/10; r.priced=life!=="Open"||r.stageIdx>=5;
    r.ann=r.priced?Math.round(r.pct/100*p.poc.cur*p.poc.qty*volFor(code)):null; if(!r.priced) r.pct=null;
    r.oneTime=rnd("tl",100)<35?(4+rnd("tv",46))*1e5:0;
    r.risk=riskCalc(r.pct||0,r.supplier,r.partNo);
    r.deps={validation:life==="Open"&&r.stageIdx===3,supplier:life==="Open"&&r.stageIdx===4,tooling:r.oneTime>0&&(life==="Pending approval"||life==="Approved"||life==="Returned for rework")};
    ownerOf(r,rnd); r.tasks=null;
    return finish(r);
  });
}
function liveRec(c,i){
  const d=CD[c.id], t=totals(d), vq=T.volumeOf(d), rnd=(k,n)=>h(k+"|"+c.id)%n, priced=t.neu!==t.cur, fl=d.flow;
  const rej=fl&&fl.steps.some(s=>s.status==="rejected"), cur=fl&&fl.steps.find(s=>s.status==="current");
  const life=d.stageIdx>=9?"Implemented":d.stageIdx===8?"Approved":d.stageIdx===7?(rej?"Returned for rework":"Pending approval"):"Open";
  const r={id:c.id,live:c.id,wf:c.wf,form:c.type,category:REAL_CAT[i%5],project:c.project,part:c.part,partNo:c.partNo,supplier:c.supplier,vertical:(DATA.parts.find(p=>p.number===c.partNo)||{poc:{}}).poc.category||"—",life,desc:d.reason,
    stageIdx:Math.min(d.stageIdx,9),apStep:life==="Pending approval"||life==="Returned for rework"?(cur?apIndex(cur):0):null};
  schedule(r,rnd);
  if(d.createdOn&&r.raised>d.createdOn) r.raised=d.createdOn; if(r.stageSince<r.raised) r.stageSince=r.raised;
  if(life==="Open"&&d.stageIdx===4&&d.supplier.distributedOn) r.stageSince=d.supplier.distributedOn;   // the module's own date: package sent to the supplier
  if(life==="Implemented") r.implementedOn=r.stageSince;
  r.priced=priced; r.pct=priced?Math.round(t.pct*10)/10:null; r.ann=priced?Math.round(t.delta*vq.qty*volFor(c.project)):null;
  const m=/₹([\d.]+) L/.exec(d.supplier.investment||""); r.oneTime=m&&d.stageIdx>=4?Math.round(+m[1]*1e5):0;
  r.risk=T.riskOf(d);
  r.deps={validation:life==="Open"&&d.stageIdx===3,supplier:life==="Open"&&d.stageIdx===4&&!d.supplier.locked,tooling:r.oneTime>0&&(life==="Pending approval"||life==="Approved"||life==="Returned for rework")};
  ownerOf(r,rnd); r.tasks={done:d.implementation.filter(x=>x.done).length,total:d.implementation.length};
  return finish(r);
}
function register(){ if(!SYN) SYN=genSyn(); return DATA.changes.map(liveRec).concat(SYN); }
const inView=r=>(!F.project||r.project===F.project)&&(!F.type||r.category===F.type)&&(!F.status||r.life===F.status)&&(!F.year||r.year===F.year);
const view=()=>{ const all=register(); return {all,rows:all.filter(inView)}; };
const cnt=(rows,l)=>rows.filter(r=>r.life===l).length;

/* ------------------------------------------------------------ calculations (one definition each) */
function fin(rows){
  const o={sav:0,cost:0,savI:0,costI:0,savA:0,costA:0,n:0,nI:0,nA:0,unpriced:0,oneTime:0,pipe:{sav:0,cost:0,n:0},pipeUnpriced:0};
  rows.forEach(r=>{
    if(r.life==="Approved"||r.life==="Implemented"){
      if(r.ann==null){ o.unpriced++; return; }
      const s=r.ann<0?-r.ann:0, c=r.ann>0?r.ann:0; o.n++; o.sav+=s; o.cost+=c; o.oneTime+=r.oneTime;
      if(r.life==="Implemented"){ o.nI++; o.savI+=s; o.costI+=c; } else { o.nA++; o.savA+=s; o.costA+=c; }
    } else if(r.life!=="Rejected"){
      if(r.ann==null){ o.pipeUnpriced++; return; }
      o.pipe.n++; if(r.ann<0) o.pipe.sav-=r.ann; else o.pipe.cost+=r.ann;
    }
  });
  o.net=o.sav-o.cost; o.pipe.net=o.pipe.sav-o.pipe.cost; return o;
}
function approvalStats(rows){
  const pend=rows.filter(r=>r.life==="Pending approval");
  return AP.map((a,i)=>{ const l=pend.filter(r=>r.apStep===i), w=l.map(r=>dayDiff(r.stageSince,T0)), passed=rows.filter(r=>r.life==="Approved"||r.life==="Implemented"||((r.life==="Pending approval"||r.life==="Rejected"||r.life==="Returned for rework")&&r.apStep>i)).length;
    return {a,i,role:AP_ROLE[a],n:l.length,avg:l.length?w.reduce((x,y)=>x+y,0)/l.length:0,max:w.length?Math.max(...w):0,over:l.filter(r=>r.overdue>0).length,passed,esc:l.filter(r=>r.live&&CD[r.live].flow&&ApprovalEngine.escalationFor(CD[r.live].flow)).length}; });
}
const bottleneck=st=>st.filter(s=>s.n>=2).sort((a,b)=>b.over-a.over||b.avg-a.avg)[0]||null;
const nextSop=()=>DATA.projects.filter(p=>p.sop&&p.sop>T0).sort((a,b)=>a.sop<b.sop?-1:1)[0]||null;
const prodOf=rows=>{ const proj=DATA.projects.filter(p=>p.sop&&p.sop<=T0).map(p=>p.code); return rows.filter(r=>r.active&&proj.includes(r.project)); };
const impactNote="Annualised recurring change in piece cost = piece-price change × quantity per car × annual volume of the project. One-time tooling cost is kept apart and is not part of the net figure.";

/* ------------------------------------------------------------ shared markup */
const kpi=o=>`<div class="pd-kpi${o.act?" kpi-link":""}"${o.act?` data-act="${o.act}" role="button" tabindex="0"`:""} title="${esc(o.tip||"")}"><div class="top"><span class="ic ${o.ict||""}">${Icons.svg(o.icon)}</span><span class="lb">${o.label}</span></div><div class="mid"><span class="vl ${o.tone||""}">${o.value}</span></div><div class="sb ${o.stone||""}" title="${esc(String(o.sub||"").replace(/<[^>]*>/g,""))}">${o.sub||""}</div></div>`;
const tip=t=>`<span class="pd-i" title="${esc(t)}">${Icons.svg("info")}</span>`;
const panel=(title,t,body,o)=>U.panel(`${title}${t?tip(t):""}`,body,o);
const empty=t=>`<div class="pd-empty">${t}</div>`;
const link=(act,label)=>`<div class="pd-more"><a href="#" data-act="${act}">${label}${Icons.svg("chevron-right")}</a></div>`;
const stChip=l=>`<span class="tcm-st" style="--c:${LCOL[l]}"><i></i>${esc(l)}</span>`;
const LV={High:"var(--red)",Medium:"var(--c-amber)",Low:"var(--ok)","—":"var(--faint)"};
const rkChip=(l,x)=>`<span class="tcm-st" style="--c:${LV[l]}"><i></i>${l==="—"?"closed":esc(l)+(x||"")}</span>`;
const prChip=(p,x)=>p==="—"?`<span class="tcm-mute">—</span>`:`<span class="chip ${p==="High"?"chip-red":p==="Medium"?"chip-amber":"chip-gray"}"><span class="chip-dot"></span>${p}${x||""}</span>`;
const IMPLC={"On track":"var(--ok)","At risk":"var(--c-amber)","Delayed":"var(--red)","Implemented":"var(--faint)"};
const prodText=r=>{ const hit=r.rk.factors.filter(f=>f.hit).map(f=>f.txt); if(r.deps.tooling) hit.push("tooling not released"); return hit.length?hit.slice(0,2).join(" · ")+(hit.length>2?" · +"+(hit.length-2)+" more":""):"No risk factor flagged"; };
const pctTxt=v=>v==null?"—":(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(1)+"%";

function shell(title,sub){
  const w=document.createElement("div"); w.className="v8-page v8-board tc-page tcd tcm";
  const hd=U.header(title,sub), all=register();
  const opt=(arr,cur,all0,fmt)=>`<option value="">${all0}</option>`+arr.map(v=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(fmt?fmt(v):v)}</option>`).join("");
  const years=[...new Set(all.map(r=>r.year).filter(Boolean))].sort(), codes=[...new Set(DATA.projects.map(p=>p.code))];
  const sel=(k,label,ic,html)=>`<label class="pd-f"><span>${label}</span><span class="pd-sel">${Icons.svg(ic)}<select data-f="${k}">${html}</select></span></label>`;
  const hr=document.createElement("div"); hr.className="tcd-hr tcm-hr";
  hr.innerHTML=sel("project","Project","car",opt(codes,F.project,"All projects",carName))+sel("type","Change type","layers",opt(CATS.filter(c=>all.some(r=>r.category===c)),F.type,"All types"))+sel("status","Status","flag",opt(LIFE,F.status,"All statuses"))+sel("year","Implementation year","calendar",opt(years,F.year,"All years"))+
    `<button type="button" class="pd-reset" data-act="tcm:reset" title="Clear all filters">${Icons.svg("refresh")}Reset</button>
    <div class="tcd-meta"><span>Data as of <b>${esc(fmtDate(T0))}</b></span><span class="pd-ill">Illustrative prototype data</span></div>`;
  hr.addEventListener("change",e=>{ const k=e.target.dataset&&e.target.dataset.f; if(k){ F[k]=e.target.value; Router.render(); } });
  hd.appendChild(hr); w.appendChild(hd); return w;
}
const add=(w,html)=>{ const e=U.el(html); w.appendChild(e); return e; };
function grid(w,cls,panels){ const g=add(w,`<div class="tcm-g ${cls}"></div>`); panels.forEach(p=>{ if(typeof p==="string") g.appendChild(U.el(p)); else g.appendChild(p); }); return g; }
const foot=(w,all)=>add(w,`<div class="tcm-foot"><b>Prototype data.</b> ${all.length} changes: ${DATA.changes.length} come from the live Technical Change workflow (status follows the workflow), ${all.length-DATA.changes.length} are generated register records. Dates, owners, categories, piece-price changes and tooling costs are illustrative; parts, suppliers, volumes, prices and SOP dates come from the platform. ${esc(impactNote)}</div>`);

/* ------------------------------------------------------------ charts */
function statusCols(rows){
  const order=["Open","Pending approval","Approved","Implemented"], v=order.map(l=>cnt(rows,l)), mx=Math.max(1,...v), W=300,H=214,base=160,top=30,bw=52,gap=(W-4*bw)/5;
  return `<svg class="tcm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Changes by status: ${order.map((l,i)=>l+" "+v[i]).join(", ")}"><line x1="8" x2="${W-8}" y1="${base}" y2="${base}" stroke="var(--line)"/>${order.map((l,i)=>{ const x=gap+i*(bw+gap), hh=v[i]?Math.max(4,v[i]/mx*(base-top)):0, y=base-hh, words=l.split(" ");
    return `<g class="tcm-col" data-act="tcm:life=${esc(l)}" role="button" tabindex="0"><title>${esc(l)}: ${v[i]} (${pc(v[i],rows.length)}% of ${rows.length}) — click to filter</title><rect x="${x}" y="${y}" width="${bw}" height="${hh}" rx="4" fill="${LCOL[l]}"/><text x="${x+bw/2}" y="${y-7}" text-anchor="middle" class="tcm-n">${v[i]}</text>${words.map((wd,k)=>`<text x="${x+bw/2}" y="${base+17+k*14}" text-anchor="middle" class="tcm-l">${esc(wd)}</text>`).join("")}</g>`; }).join("")}</svg>`;
}
function waterfall(f){
  const W=320,H=218,base=176,top=34,bw=64,x0=[26,128,230], sav=f.sav, cost=f.cost, net=f.net, mx=Math.max(sav,cost,Math.abs(net),1), k=(base-top)/mx;
  const y=v=>base-v*k, lab=(x,yy,t,c)=>`<text x="${x+bw/2}" y="${yy}" text-anchor="middle" class="tcm-n" style="fill:${c}">${esc(t)}</text>`;
  const netY=net>=0?[y(net),net*k]:[base,-net*k];
  return `<svg class="tcm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Annualised financial impact: savings ${money(sav)}, additional cost ${money(cost)}, net ${sg(net)}">
    <line x1="8" x2="${W-8}" y1="${base}" y2="${base}" stroke="var(--line)"/>
    <rect x="${x0[0]}" y="${y(sav)}" width="${bw}" height="${sav*k}" rx="4" fill="var(--ok)"/>${lab(x0[0],y(sav)-7,money(sav),"var(--ok)")}
    <line x1="${x0[0]+bw}" x2="${x0[1]}" y1="${y(sav)}" y2="${y(sav)}" stroke="var(--faint)" stroke-dasharray="3 3"/>
    <rect x="${x0[1]}" y="${y(sav)}" width="${bw}" height="${Math.max(cost*k,cost?3:0)}" rx="4" fill="var(--red)"/>${lab(x0[1],y(sav)-7,"−"+money(cost),"var(--red)")}
    <line x1="${x0[1]+bw}" x2="${x0[2]}" y1="${y(sav-cost)}" y2="${y(sav-cost)}" stroke="var(--faint)" stroke-dasharray="3 3"/>
    <rect x="${x0[2]}" y="${netY[0]}" width="${bw}" height="${Math.max(netY[1],3)}" rx="4" fill="${net>=0?"var(--c-anchor)":"var(--red)"}"/>${lab(x0[2],(net>=0?netY[0]-7:netY[0]+netY[1]+15),sg(net),net>=0?"var(--c-anchor)":"var(--red)")}
    ${["Savings","Additional cost","Net impact"].map((t,i)=>`<text x="${x0[i]+bw/2}" y="${base+17}" text-anchor="middle" class="tcm-l">${t}</text>`).join("")}${["approved + implemented","approved + implemented","savings − cost"].map((t,i)=>`<text x="${x0[i]+bw/2}" y="${base+30}" text-anchor="middle" class="tcm-l s">${t}</text>`).join("")}</svg>`;
}
function typeBars(rows){
  const mx=Math.max(1,...CATS.map(c=>cnt2(rows,c))), list=CATS.map(c=>({c,n:cnt2(rows,c)})).filter(x=>x.n||!F.type).sort((a,b)=>b.n-a.n);
  return `<div class="tcd-bars tcm-bars">${list.map((x,i)=>`<div class="r${F.type===x.c?" on":""}" data-act="tcm:type=${esc(x.c)}" role="button" tabindex="0" title="${esc(x.c)}: ${x.n} — click to filter"><span class="lb">${esc(x.c)}</span><span class="tr"><i style="width:${x.n?Math.max(3,x.n/mx*100):0}%;background:color-mix(in srgb,var(--brand) ${Math.max(35,100-i*13)}%,var(--panel))"></i></span><b class="n">${x.n}</b><span class="p">${pc(x.n,rows.length)}%</span></div>`).join("")}</div>`;
}
const cnt2=(rows,c)=>rows.filter(r=>r.category===c).length;
function projectStack(rows){
  const codes=[...new Set(rows.map(r=>r.project))], list=codes.map(c=>{ const l=rows.filter(r=>r.project===c); return {c,l,n:l.length}; }).sort((a,b)=>b.n-a.n), mx=Math.max(1,...list.map(x=>x.n));
  const order=["Implemented","Approved","Pending approval","Open","Returned for rework","Rejected"];
  return `<div class="tcm-stk">${list.map(x=>`<div class="r${F.project===x.c?" on":""}" data-act="tcm:proj=${esc(x.c)}" role="button" tabindex="0" title="${esc(carName(x.c))}: ${x.n} — click to filter"><span class="lb">${esc(shortP(x.c))}</span><span class="bar" style="width:${x.n/mx*100}%">${order.map(l=>{ const n=x.l.filter(r=>r.life===l).length; return n?`<i style="flex:${n};background:${LCOL[l]}" title="${l}: ${n}">${n/x.n>=.1?n:""}</i>`:""; }).join("")}</span><b class="t">${x.n}</b></div>`).join("")}</div>
    <div class="tcm-lg">${order.map(l=>`<span><i style="background:${LCOL[l]}"></i>${l}</span>`).join("")}</div>`;
}
/* Gantt-style timeline: one row per project, one diamond per planned implementation date */
function gantt(rows,months,o){
  o=o||{}; const items=rows.filter(r=>r.plannedImpl&&r.life!=="Rejected"&&(o.all||r.life!=="Implemented"));
  const t0=Date.parse(T0+"T00:00:00Z"), sd=new Date(t0); sd.setUTCDate(1); sd.setUTCMonth(sd.getUTCMonth()-1); const ed=new Date(sd); ed.setUTCMonth(ed.getUTCMonth()+months);
  const inWin=r=>Date.parse(r.plannedImpl+"T00:00:00Z")<ed, shown=items.filter(inWin), later=items.length-shown.length;
  if(!shown.length) return empty("No planned implementation date falls in the next "+months+" months for this selection.")+(later?`<div class="tcd-note">${later} later than the window.</div>`:"");
  const codes=[...new Set(shown.map(r=>r.project))].sort((a,b)=>String(sopOf(a)).localeCompare(String(sopOf(b)))), W=1000,LW=150,RW=18,top=34,rh=o.rh||44,H=top+codes.length*rh+8;
  const X=ms=>LW+(Math.min(Math.max(ms,sd.getTime()),ed.getTime())-sd.getTime())/(ed.getTime()-sd.getTime())*(W-LW-RW);
  const ms=[]; for(let d=new Date(sd);d<ed;d.setUTCMonth(d.getUTCMonth()+1)) ms.push(new Date(d));
  const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let g=`<svg class="tcm-svg tcm-gantt" viewBox="0 0 ${W} ${H}" role="img" aria-label="Implementation timeline by project">`;
  ms.forEach((d,i)=>{ const x=X(d.getTime()), x2=X(i+1<ms.length?ms[i+1].getTime():ed.getTime()); g+=`<line x1="${x}" x2="${x}" y1="${top-8}" y2="${H-6}" stroke="var(--line2)"/><text x="${(x+x2)/2}" y="${top-14}" text-anchor="middle" class="tcm-l">${MON[d.getUTCMonth()]}${d.getUTCMonth()===0||i===0?" "+String(d.getUTCFullYear()).slice(2):""}</text>`; });
  codes.forEach((code,ri)=>{ const cy=top+ri*rh+rh/2, l=shown.filter(r=>r.project===code), xs=l.map(r=>X(Date.parse(r.plannedImpl+"T00:00:00Z")));
    g+=`<line x1="8" x2="${W-RW}" y1="${top+ri*rh}" y2="${top+ri*rh}" stroke="var(--line2)"/><text x="8" y="${cy-2}" class="tcm-pl">${esc(shortP(code))}</text><text x="8" y="${cy+12}" class="tcm-l s">${l.length} change${l.length===1?"":"s"}${sopOf(code)?" · SOP "+esc(fmtDate(sopOf(code)).replace(/ 20(\d\d)$/," $1")):""}</text>`;
    if(l.length>1) g+=`<rect x="${Math.min(...xs)}" y="${cy-7}" width="${Math.max(...xs)-Math.min(...xs)}" height="14" rx="7" fill="color-mix(in srgb,var(--brand) 16%,var(--panel))"/>`;
    const sop=sopOf(code); if(sop&&Date.parse(sop+"T00:00:00Z")<ed){ const sx=X(Date.parse(sop+"T00:00:00Z")); g+=`<line x1="${sx}" x2="${sx}" y1="${cy-15}" y2="${cy+15}" stroke="var(--ink)" stroke-width="2"/><text x="${sx+4}" y="${cy-8}" class="tcm-l s">SOP</text>`; }
    l.slice().sort((a,b)=>a.plannedImpl<b.plannedImpl?-1:1).forEach(r=>{ const x=X(Date.parse(r.plannedImpl+"T00:00:00Z")), s=r.impl.s, c=IMPLC[s];
      g+=`<g class="tcm-dm" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><title>${esc(r.wf)} · ${esc(r.part)} · planned ${esc(fmtDate(r.plannedImpl))} · ${esc(s)}${r.impl.s==="Delayed"?" ("+r.impl.d+" days late)":""}</title><path d="M${x} ${cy-8}L${x+8} ${cy}L${x} ${cy+8}L${x-8} ${cy}Z" fill="${c}" stroke="var(--panel)" stroke-width="1.5"/></g>`; });
  });
  const tx=X(t0); g+=`<line x1="${tx}" x2="${tx}" y1="${top-6}" y2="${H-6}" stroke="var(--c-anchor)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${tx+4}" y="${H-10}" class="tcm-l s" style="fill:var(--c-anchor)">Today</text></svg>`;
  return g+`<div class="tcm-lg">${["On track","At risk","Delayed"].concat(o.all?["Implemented"]:[]).map(s=>`<span><i class="dm" style="background:${IMPLC[s]}"></i>${s}</span>`).join("")}<span class="m">Planned implementation date per change · dark bar = project SOP${later?` · ${later} later than ${months} months`:""}</span></div>`;
}
function approvalFlow(st,rows,big){
  const bn=bottleneck(st), total=rows.filter(r=>r.life==="Pending approval").length;
  return `<div class="tcm-flow${big?" big":""}">${st.map((s,i)=>`<div class="stg${bn&&bn.i===s.i?" bn":""}${s.n?"":" zero"}" title="${esc(s.a)} — waiting now ${s.n}, average ${s.avg.toFixed(1)} days, ${s.over} past the ${AP_SLA}-day target"><div class="nm">${esc(s.a)}</div><div class="ct">${s.n}</div><div class="av">${s.n?"avg "+s.avg.toFixed(1)+" d":"—"}</div>${s.over?`<div class="ov">${s.over} overdue</div>`:`<div class="ov ok">${s.n?"on time":""}</div>`}</div>`).join("")}</div>
    <div class="tcm-flow-sum"><span><b>${total}</b> waiting for a decision · counted once, at the step they are waiting on</span>${bn?`<span class="bn">Bottleneck: <b>${esc(bn.a)}</b> — ${bn.n} waiting, ${bn.over} past the ${AP_SLA}-day target</span>`:`<span>No approval step has two or more changes waiting.</span>`}</div>
    <div class="tcm-out"><span>${stChip("Approved")} <b>${cnt(rows,"Approved")+cnt(rows,"Implemented")}</b> through all steps</span><span>${stChip("Rejected")} <b>${cnt(rows,"Rejected")}</b></span><span>${stChip("Returned for rework")} <b>${cnt(rows,"Returned for rework")}</b></span></div>`;
}

/* ------------------------------------------------------------ rule-based insights */
function insights(rows){
  const out=[], st=approvalStats(rows), f=fin(rows), sl=st.filter(s=>s.n>=2).sort((a,b)=>b.avg-a.avg)[0];
  if(sl) out.push({k:"Approval",issue:`${sl.a} approval is the slowest step: ${sl.n} changes waiting, ${sl.avg.toFixed(1)} days on average against a ${AP_SLA}-day target (${sl.over} overdue).`,why:"A change cannot be implemented, and its saving cannot start, until every approval step has cleared. This step holds the longest queue.",act:`Ask ${roleLabel(sl.role)} to clear the queue first, or agree a delegate for this step.`,go:"tcm:go=tc-approval",lab:"Approval Workflow"});
  const awaiting=rows.filter(r=>(r.life==="Pending approval"||r.life==="Returned for rework")&&r.ann!=null&&r.ann<0).sort((a,b)=>a.ann-b.ann);
  if(awaiting.length) out.push({k:"Decisions",issue:`${awaiting.length} change${awaiting.length===1?"":"s"} with ${money(awaiting.reduce((s,r)=>s-r.ann,0))}/yr of savings ${awaiting.length===1?"is":"are"} waiting for a decision; ${awaiting.filter(r=>r.overdue>0).length} past the target date.`,why:"Savings only start after approval and implementation, so each day of waiting is a day of savings not realised.",act:`Decide ${awaiting.slice(0,2).map(r=>r.wf).join(" and ")} first — the largest savings waiting.`,go:"tcm:go=tc-approval",lab:"Approval Workflow"});
  const late=rows.filter(r=>r.life==="Approved"&&r.impl&&r.impl.s==="Delayed");
  if(late.length) out.push({k:"Implementation",issue:`${late.length} approved change${late.length===1?" is":"s are"} past the planned implementation date ${late.reduce((s,r)=>s+(r.ann<0?-r.ann:0),0)?` (${money(late.reduce((s,r)=>s+(r.ann<0?-r.ann:0),0))}/yr of savings not yet in effect)`:""}.`,why:"Approval alone does not change the price paid: price, BOM, purchase order and drawing must be updated.",act:"Confirm tooling, purchase-order and drawing release with the buyer and SRM; re-plan the dates that cannot be met.",go:"tcm:go=tc-impl",lab:"Implementation"});
  const ns=nextSop(); if(ns){ const l=rows.filter(r=>r.active&&r.project===ns.code), m=l.filter(r=>r.sopCrit);
    if(l.length) out.push({k:"SOP",issue:`${ns.name} SOP is in ${dayDiff(T0,ns.sop)} days (${fmtDate(ns.sop)}): ${l.length} change${l.length===1?" is":"s are"} still open, ${m.length} planned inside the ${SOP_BUFFER}-day window before SOP or later.`,why:"A change that lands next to SOP risks tooling, supplier-readiness and validation problems on the first vehicles.",act:m.length?`Bring forward or drop the ${m.length} late-planned change${m.length===1?"":"s"}, or freeze scope for this SOP.`:"No change is planned inside the pre-SOP window; keep the dates under review.",go:"tcm:go=change-register",lab:"Change Register"}); }
  if(f.n) out.push({k:"Value",issue:`Approved and implemented changes give ${money(f.sav)}/yr savings against ${money(f.cost)}/yr additional cost: net ${sg(f.net)}/yr. ${sg(f.savI-f.costI)}/yr is in effect (implemented), ${sg(f.savA-f.costA)}/yr awaits implementation.`,why:"Approved benefits are only realised once implemented. Realised savings are not measured in the prototype.",act:"Track each implemented change against purchase-order prices to confirm the saving.",go:"tcm:go=tc-impact",lab:"Change Impact"});
  const dep=rows.filter(r=>r.active&&(r.deps.supplier||r.deps.validation||r.deps.tooling));
  if(dep.length){ const tl=rows.filter(r=>r.active&&r.deps.tooling).reduce((s,r)=>s+r.oneTime,0);
    out.push({k:"Dependencies",issue:`${dep.length} active change${dep.length===1?" has":"s have"} unresolved dependencies: supplier offer ${dep.filter(r=>r.deps.supplier).length}, validation ${dep.filter(r=>r.deps.validation).length}, tooling ${dep.filter(r=>r.deps.tooling).length}${tl?` (${U.cr(tl)} one-time tooling not yet released)`:""}.`,why:"Open supplier, validation or tooling items are the usual reason an approved change misses its implementation date.",act:"Coordinate supplier, SRM and plant on the changes with a tooling dependency first.",go:"tcm:go=change-register",lab:"Change Register"}); }
  return out;
}

/* ------------------------------------------------------------ tables */
const D=d=>d?fmtDate(d).replace(/ 20(\d\d)$/," $1"):"—";
function highImpact(rows,n){
  const l=rows.filter(r=>r.active&&r.ann!=null).sort((a,b)=>b.score-a.score||Math.abs(b.ann)-Math.abs(a.ann)).slice(0,n);
  if(!l.length) return empty("No active change in this selection has a priced impact yet.");
  return `<div class="pd-t tcm-hi"><div class="h"><span>#</span><span>Change</span><span>Project</span><span>Type</span><span class="ra">Impact / yr</span><span>Production &amp; quality</span><span class="ra">Status</span></div>${l.map((r,i)=>`<div class="r" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0" title="Open ${esc(r.wf)}"><span class="k">${i+1}</span><span class="n"><b>${esc(r.part)} — ${esc(r.desc)}</b><small>${esc(r.wf)}</small></span><span class="s">${esc(shortP(r.project))}</span><span class="s">${esc(r.category)}</span><span class="v ${r.ann>0?"bad":"good"}">${sg(-r.ann)}</span><span class="pq">${rkChip(r.rk.level)}<small>${esc(prodText(r))}</small></span><span class="ra">${stChip(r.life)}</span></div>`).join("")}</div>`;
}
const overdueList=rows=>rows.filter(r=>r.overdue>0).sort((a,b)=>({High:0,Medium:1,Low:2}[a.priority]-{High:0,Medium:1,Low:2}[b.priority])||b.overdue-a.overdue);
function overdueTable(rows,n){
  const all=overdueList(rows), l=n?all.slice(0,n):all;
  if(!all.length) return empty("No change is past its due date. A change is only marked overdue when its due date is known.");
  return `<div class="pd-t tcm-od"><div class="h"><span>#</span><span>Change</span><span>Project</span><span>Current stage</span><span class="ra">Days overdue</span><span>Owner</span><span class="ra">Priority</span></div>${l.map((r,i)=>`<div class="r" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n"><b>${esc(r.wf)}</b><small>${esc(r.part)}</small></span><span class="s">${esc(shortP(r.project))}</span><span class="s">${esc(r.kind)}</span><span class="v bad">${r.overdue}</span><span class="s">${esc(r.owner)}</span><span class="ra">${prChip(r.priority)}</span></div>`).join("")}</div>`;
}

/* ------------------------------------------------------------ 1 · Overview */
function buildOverview(){
  const {all,rows}=view(), n=rows.length, w=shell("Technical Change Management","Driving value through engineered changes while ensuring quality, cost efficiency and production readiness.");
  const f=fin(rows), st=approvalStats(rows), pend=cnt(rows,"Pending approval"), od=rows.filter(r=>r.life==="Pending approval"&&r.overdue>0).length, prj=new Set(rows.map(r=>r.project)).size, live=rows.filter(r=>r.live).length;
  const none="—", noFin=!f.n;
  add(w,`<div class="pd-kw"><div class="pd-kpis k8">${[
    kpi({icon:"file",label:"Total changes",value:n,sub:n?`${prj} project${prj===1?"":"s"} · ${live} in the live workflow`:"no change matches the filters",act:"tcm:go=change-register",tip:"Every change in the register that matches the filters."}),
    kpi({icon:"clipboard",label:"Open changes",value:cnt(rows,"Open"),ict:"info",sub:pc(cnt(rows,"Open"),n)+"% of total",act:"tcm:kpi=Open",tip:"Created and being evaluated, validated, priced or analysed — not yet submitted for approval."}),
    kpi({icon:"clock",label:"Pending approvals",value:pend,ict:"warn",sub:od?`${od} past the ${AP_SLA}-day target`:pc(pend,n)+"% of total",stone:od?"bad":"",act:"tcm:go=tc-approval",tip:`Submitted and waiting at one approval step. Each is counted once. Target: ${AP_SLA} days per step.`}),
    kpi({icon:"check-circle",label:"Approved changes",value:cnt(rows,"Approved"),ict:"ok",sub:pc(cnt(rows,"Approved"),n)+"% of total · not yet implemented",act:"tcm:kpi=Approved",tip:"Approved and waiting for implementation. Implemented changes are counted separately."}),
    kpi({icon:"settings",label:"Implemented",value:cnt(rows,"Implemented"),sub:pc(cnt(rows,"Implemented"),n)+"% of total",act:"tcm:go=tc-impl",tip:"Implementation finished and the change is closed."}),
    kpi({icon:"trend-down",label:"Annualized savings",value:noFin?none:money(f.sav),tone:noFin?"":"good",sub:noFin?"no priced approved change":`from ${f.n} approved + implemented`,act:"tcm:go=tc-impact",tip:"Annualised recurring saving of approved and implemented changes that lower the piece price. "+impactNote}),
    kpi({icon:"trend-up",label:"Annualized additional cost",value:noFin?none:money(f.cost),tone:noFin?"":"bad",sub:noFin?"no priced approved change":(f.oneTime?`+ ${U.cr(f.oneTime)} one-time tooling, not included`:"no one-time tooling"),act:"tcm:go=tc-impact",tip:"Annualised recurring cost of approved and implemented changes that raise the piece price."}),
    kpi({icon:"coins",label:"Net financial impact",value:noFin?none:sg(f.net),tone:noFin?"":f.net>=0?"good":"bad",sub:noFin?"unavailable":`savings − additional cost · ${U.cr(f.savI-f.costI)} in effect`,act:"tcm:go=tc-impact",tip:"Savings minus additional cost: same scope (approved + implemented), same basis (annualised recurring, ₹). In effect = implemented only."})].join("")}</div></div>`);

  const pn=pend+cnt(rows,"Returned for rework")+cnt(rows,"Rejected");
  const stBody=n?`<div class="tcm-chart">${statusCols(rows)}</div><div class="tcd-note">Each change has exactly one status. Not shown: ${cnt(rows,"Rejected")} rejected · ${cnt(rows,"Returned for rework")} returned for rework. Total ${n}.</div>`:empty("No change matches the filters.");
  const finBody=noFin?empty("No approved or implemented change has a priced impact yet, so there is no financial impact to show."):`<div class="tcm-chart">${waterfall(f)}</div><div class="tcm-facts s"><div><span>In effect (implemented)</span><b>${sg(f.savI-f.costI)}</b></div><div><span>Approved, not yet implemented</span><b>${sg(f.savA-f.costA)}</b></div><div><span>Forecast, awaiting decision</span><b>${f.pipe.n?sg(f.pipe.net):"—"}</b></div></div><div class="tcd-note">₹ per year, recurring. Savings and cost are summed per change (a change that raises the price counts as cost). Forecast = open and pending changes with a priced MOD sheet; it is not part of the headline.</div>`;
  grid(w,"g4",[
    panel("Changes by status","Open, pending approval, approved and implemented are mutually exclusive: every change is in exactly one.",stBody),
    panel("Changes by type","Change categories present in the register. Click a bar to filter the page.",n?typeBars(rows):empty("No change matches the filters.")),
    panel("Financial impact overview","Approved and implemented changes only. "+impactNote,finBody),
    panel("Changes by project","Status of every change per project. Click a project to filter the page.",n?projectStack(rows):empty("No change matches the filters."))]);

  /* production impact */
  const act=rows.filter(r=>r.active), lv=l=>act.filter(r=>r.rk.level===l).length, ns=nextSop(), prodN=prodOf(rows).length, anyProd=DATA.projects.some(p=>p.sop&&p.sop<=T0);
  const nsRows=ns?act.filter(r=>r.project===ns.code):[], dep=act.filter(r=>r.deps.supplier||r.deps.validation||r.deps.tooling);
  const rb=act.length?`<div class="tcm-rbar">${["High","Medium","Low"].map(l=>lv(l)?`<i style="flex:${lv(l)};background:${LV[l]}" title="${l} risk: ${lv(l)}">${lv(l)}</i>`:"").join("")}</div><div class="tcm-lg"><span><i style="background:var(--red)"></i>High ${lv("High")}</span><span><i style="background:var(--c-amber)"></i>Medium ${lv("Medium")}</span><span><i style="background:var(--ok)"></i>Low ${lv("Low")}</span><span class="m">active changes</span></div>`:"";
  const prodBody=act.length?rb+`<div class="tcm-facts"><div><span>High-risk changes</span><b class="${lv("High")?"bad":""}">${lv("High")}</b><em>${pc(lv("High"),act.length)}% of ${act.length} active</em></div>
    <div><span>Affecting in-production vehicles</span><b>${anyProd?prodN:"0"}</b><em>${anyProd?"projects past SOP":ns?`no project is in production yet · first SOP ${esc(shortP(ns.code))} ${esc(D(ns.sop))}`:"none recorded"}</em></div>
    <div><span>Need implementation before ${ns?esc(shortP(ns.code))+" SOP":"next SOP"}</span><b class="${nsRows.filter(r=>r.sopCrit).length?"bad":""}">${nsRows.length}</b><em>${nsRows.filter(r=>r.sopCrit).length} planned inside the ${SOP_BUFFER}-day window or later</em></div>
    <div><span>Unresolved supplier / validation / tooling</span><b class="${dep.length?"warn":""}">${dep.length}</b><em>${dep.filter(r=>r.deps.supplier).length} offer · ${dep.filter(r=>r.deps.validation).length} validation · ${dep.filter(r=>r.deps.tooling).length} tooling</em></div></div>`:empty("No active change in this selection.");
  const stAp=approvalFlow(st,rows,false);
  grid(w,"g12",[panel("Production impact","Risk is counted from indicators (price up, late milestone, high-risk supplier, inside the pre-SOP window, more than 7 days overdue): High = two or more, Medium = one. Never from the open status alone. In-production = project SOP date reached. Pre-SOP window = "+SOP_BUFFER+" days before the project's SOP.",prodBody),
    panel("Approval workflow status","The module's approval chain. Counts are changes waiting at each step now (each counted once); average = days waiting so far; target "+AP_SLA+" days per step.",n?stAp:empty("No change matches the filters."))]);
  add(w,panel("Implementation timeline","Planned implementation date of every approved or still-open change, per project (next 6 months). Delayed = planned date passed and not implemented; at risk = within 45 days and not yet approved, inside the pre-SOP window, or tooling due within 60 days.",gantt(rows,6),{style:"margin-bottom:16px"}));

  grid(w,"g75",[panel("High-impact changes","Active changes ranked by an explicit score: production risk (High 2, Medium 1) + financial materiality (≥ ₹2 Cr/yr 2, ≥ ₹50 L/yr 1), maximum 4; ties by size of impact. Impact: + saving, − additional cost.",highImpact(rows,6)+link("tcm:go=change-register","View all in Change Register")),
    panel("Overdue changes",`Past the due date of the current step: ${AP_SLA} days per approval step, evaluation stages 2–7 days, ${RETURN_SLA} days for rework, planned date for implementation. No date → not overdue.`,overdueTable(rows,6)+(overdueList(rows).length>6?link("tcm:od=1",`View all ${overdueList(rows).length} overdue`):""))]);
  const ins=insights(rows);
  add(w,panel("Key insights & recommendations","Rule-based insights calculated from the register — no AI model. Each shows the issue, why it matters and what management could do.",ins.length?`<div class="tcm-ins">${ins.map((x,i)=>`<div class="it"><div class="hd"><span class="no">${i+1}</span><b>${esc(x.k)}</b></div><p class="is">${esc(x.issue)}</p><p><em>Why it matters</em> ${esc(x.why)}</p><p><em>Consider</em> ${esc(x.act)}</p><a href="#" data-act="${x.go}">${esc(x.lab)}${Icons.svg("chevron-right")}</a></div>`).join("")}</div>`:empty("Nothing needs management attention in this selection."),{style:"margin-bottom:16px"}));
  foot(w,all); U.wire(w); return w;
}

/* ------------------------------------------------------------ 2 · Change Impact */
function buildImpact(){
  const {all,rows}=view(), w=shell("Change Impact","Financial effect of technical changes: approved savings and additional cost, what is already in effect, and what is still forecast."), f=fin(rows), noFin=!f.n;
  add(w,`<div class="pd-kw"><div class="pd-kpis k6">${[
    kpi({icon:"trend-down",label:"Annualized savings",value:noFin?"—":money(f.sav),tone:noFin?"":"good",sub:`${f.n} approved + implemented`,tip:impactNote}),
    kpi({icon:"trend-up",label:"Annualized additional cost",value:noFin?"—":money(f.cost),tone:noFin?"":"bad",sub:"recurring, per year"}),
    kpi({icon:"coins",label:"Net financial impact",value:noFin?"—":sg(f.net),tone:noFin?"":f.net>=0?"good":"bad",sub:"savings − additional cost"}),
    kpi({icon:"settings",label:"In effect (implemented)",value:f.nI?sg(f.savI-f.costI):"—",tone:f.nI&&f.savI>=f.costI?"good":"",sub:`${f.nI} implemented change${f.nI===1?"":"s"}`,tip:"Run-rate of implemented changes. Realised-to-date savings need purchase-order actuals, which the prototype does not hold."}),
    kpi({icon:"wrench",label:"One-time tooling",value:f.oneTime?U.cr(f.oneTime):"—",sub:"approved + implemented, not in net",tip:"Supplier tooling modification cost quoted for approved and implemented changes. One-time, so kept apart from the annualised figures."}),
    kpi({icon:"activity",label:"Forecast, not yet approved",value:f.pipe.n?sg(f.pipe.net):"—",sub:`${f.pipe.n} priced · ${f.pipeUnpriced} not yet priced`,tip:"Net annualised saving (+) or cost (−) of open, pending and returned changes that already have a priced MOD sheet. Not part of the headline."})].join("")}</div></div>`);
  const byP=[...new Set(rows.map(r=>r.project))].map(c=>({c,f:fin(rows.filter(r=>r.project===c))})).filter(x=>x.f.n||x.f.pipe.n).sort((a,b)=>b.f.net-a.f.net);
  const mx=Math.max(1,...byP.map(x=>Math.max(x.f.sav,x.f.cost)));
  const div=byP.length?`<div class="tcm-div">${byP.map(x=>`<div class="r"><span class="lb">${esc(shortP(x.c))}</span><span class="l"><i style="width:${x.f.cost/mx*100}%"></i></span><span class="rt"><i style="width:${x.f.sav/mx*100}%"></i></span><b class="${x.f.net>=0?"good":"bad"}">${sg(x.f.net)}</b></div>`).join("")}</div><div class="tcm-lg"><span><i style="background:var(--red)"></i>Additional cost</span><span><i style="background:var(--ok)"></i>Savings</span><span class="m">approved + implemented · net on the right</span></div>`:empty("No approved or implemented change with a priced impact for this selection.");
  grid(w,"g2",[panel("Financial impact overview","Approved and implemented changes. "+impactNote,noFin?empty("No priced approved or implemented change."):`<div class="tcm-chart">${waterfall(f)}</div>`),
    panel("Net impact by project","Savings and additional cost per project for approved and implemented changes.",div)]);
  const bucket=[["Implemented — in effect",f.savI,f.costI,f.nI,"Implemented","actual run-rate (implemented, not measured)"],["Approved — awaiting implementation",f.savA,f.costA,f.nA,"Approved","approved, not yet in effect"],["Forecast — open, pending, returned",f.pipe.sav,f.pipe.cost,f.pipe.n,"","forecast, awaiting decision; not in the headline"]];
  const cat=CATS.map(c=>({c,f:fin(rows.filter(r=>r.category===c))})).filter(x=>x.f.n||x.f.pipe.n);
  const tb=(head,body)=>`<div class="pd-t tcm-fin"><div class="h">${head.map((x,i)=>`<span${i?' class="ra"':""}>${x}</span>`).join("")}</div>${body}</div>`;
  grid(w,"g2",[panel("Where the value stands","Approved benefit is not realised benefit: only implemented changes are in effect.",tb(["Basis","Changes","Savings / yr","Add. cost / yr","Net / yr"],bucket.map(b=>`<div class="r"><span class="n"><b>${b[0]}</b><small>${b[5]}</small></span><span class="v">${b[3]}</span><span class="v good">${b[1]?money(b[1]):"—"}</span><span class="v bad">${b[2]?money(b[2]):"—"}</span><span class="v ${b[1]>=b[2]?"good":"bad"}">${b[3]?sg(b[1]-b[2]):"—"}</span></div>`).join(""))+`<div class="tcd-note">${f.unpriced?`${f.unpriced} approved or implemented change${f.unpriced===1?" has":"s have"} no priced MOD sheet and ${f.unpriced===1?"is":"are"} not counted. `:""}Rejected changes carry no financial effect.</div>`),
    panel("Impact by change type","Approved and implemented changes per category.",cat.length?tb(["Type","Changes","Savings / yr","Add. cost / yr","Net / yr"],cat.map(x=>`<div class="r"><span class="n"><b>${esc(x.c)}</b></span><span class="v">${x.f.n}</span><span class="v good">${x.f.sav?money(x.f.sav):"—"}</span><span class="v bad">${x.f.cost?money(x.f.cost):"—"}</span><span class="v ${x.f.net>=0?"good":"bad"}">${x.f.n?sg(x.f.net):"—"}</span></div>`).join("")):empty("No priced change."))]);
  const top=rows.filter(r=>r.ann!=null&&r.life!=="Rejected").sort((a,b)=>Math.abs(b.ann)-Math.abs(a.ann)).slice(0,10);
  add(w,panel("Largest financial impacts","Ten largest priced changes (any status except rejected), by absolute annualised impact. Click a row for the change detail.",top.length?`<div class="pd-t tcm-top"><div class="h"><span>#</span><span>Change</span><span>Project</span><span>Type</span><span class="ra">Piece price</span><span class="ra">Impact / yr</span><span class="ra">One-time tooling</span><span class="ra">Status</span></div>${top.map((r,i)=>`<div class="r" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><span class="k">${i+1}</span><span class="n"><b>${esc(r.part)} — ${esc(r.desc)}</b><small>${esc(r.wf)}</small></span><span class="s">${esc(shortP(r.project))}</span><span class="s">${esc(r.category)}</span><span class="v ${r.pct>0?"bad":"good"}">${pctTxt(r.pct)}</span><span class="v ${r.ann>0?"bad":"good"}">${sg(-r.ann)}</span><span class="s">${r.oneTime?U.cr(r.oneTime):"—"}</span><span class="ra">${stChip(r.life)}</span></div>`).join("")}</div>`:empty("No priced change in this selection."),{style:"margin-bottom:16px"}));
  const lv=all.find(r=>r.live&&CD[r.live].stageIdx>=6);
  if(lv) add(w,`<div class="tcm-go"><span>The detailed, per-change impact sheet (MOD sheet comparison, risk factors and similar changes) stays in the workflow.</span><button type="button" class="btn btn-sm" data-act="tcm:sheet=${esc(lv.live)}">Open impact sheet · ${esc(lv.wf)}</button></div>`);
  foot(w,all); U.wire(w); return w;
}

/* ------------------------------------------------------------ 3 · Approval Workflow */
function buildApproval(){
  const {all,rows}=view(), w=shell("Approval Workflow","Where changes wait for a decision, how long they have waited, and which step is the bottleneck."), st=approvalStats(rows), pend=rows.filter(r=>r.life==="Pending approval"), bn=bottleneck(st);
  const waits=pend.map(r=>dayDiff(r.stageSince,T0)), avg=waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:0, ov=pend.filter(r=>r.overdue>0).length;
  add(w,`<div class="pd-kw"><div class="pd-kpis k6">${[
    kpi({icon:"clock",label:"Waiting for a decision",value:pend.length,ict:"warn",sub:"each counted once, at its current step"}),
    kpi({icon:"alert",label:`Past the ${AP_SLA}-day target`,value:ov,tone:ov?"bad":"",sub:pend.length?pc(ov,pend.length)+"% of waiting":"none waiting"}),
    kpi({icon:"gauge",label:"Average wait so far",value:pend.length?avg.toFixed(1)+" d":"—",sub:pend.length?`longest ${Math.max(...waits)} days`:"none waiting",tip:"Days since the change arrived at its current approval step. Completed decisions are not timed in the prototype."}),
    kpi({icon:"flag",label:"Bottleneck step",value:bn?esc(bn.a):"—",sub:bn?`${bn.n} waiting · ${bn.over} overdue`:"no step has 2+ waiting",tip:"Step with the most overdue changes, then the longest average wait (at least two waiting)."}),
    kpi({icon:"check-circle",label:"Approved",value:cnt(rows,"Approved")+cnt(rows,"Implemented"),ict:"ok",sub:"through all steps"}),
    kpi({icon:"x-circle",label:"Rejected / returned",value:cnt(rows,"Rejected")+cnt(rows,"Returned for rework"),tone:cnt(rows,"Rejected")+cnt(rows,"Returned for rework")?"bad":"",sub:`${cnt(rows,"Rejected")} rejected · ${cnt(rows,"Returned for rework")} returned for rework`})].join("")}</div></div>`);
  add(w,panel("Approval workflow status","The module's approval chain: Engineering → Quality → SRM → Finance → Commodity → Management → final confirmation by the AEKO Coordinator.",rows.length?approvalFlow(st,rows,true):empty("No change matches the filters."),{style:"margin-bottom:16px"}));
  const tb=`<div class="pd-t tcm-aps"><div class="h"><span>Step</span><span>Approver role</span><span class="ra">Waiting now</span><span class="ra">Avg wait</span><span class="ra">Longest</span><span class="ra">Overdue</span><span class="ra">Passed this step</span></div>${st.map(s=>`<div class="r${bn&&bn.i===s.i?" bn":""}"><span class="n"><b>${esc(s.a)}</b></span><span class="s">${esc(roleLabel(s.role))}</span><span class="v">${s.n}</span><span class="v">${s.n?s.avg.toFixed(1)+" d":"—"}</span><span class="v">${s.n?s.max+" d":"—"}</span><span class="v ${s.over?"bad":""}">${s.over||"—"}</span><span class="v">${s.passed}</span></div>`).join("")}</div><div class="tcd-note">“Passed this step” counts changes that were approved at this step: those now at a later step, approved, implemented, or rejected / returned at a later step. A change appears under “waiting now” once only.</div>`;
  const list=pend.slice().sort((a,b)=>b.overdue-a.overdue||dayDiff(b.stageSince,T0)-dayDiff(a.stageSince,T0));
  grid(w,"g2",[panel("Steps and bottlenecks","Waiting time is measured from the day the change reached the step.",tb),
    panel("Decisions waiting",`Every change waiting for an approval decision, longest wait first. Click a row for the change detail.`,list.length?`<div class="pd-t tcm-pend"><div class="h"><span>Change</span><span>Step</span><span>Approver</span><span class="ra">Waiting</span><span class="ra">Impact / yr</span></div>${list.slice(0,12).map(r=>`<div class="r${r.overdue?" od":""}" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><span class="n"><b>${esc(r.part)}</b><small>${esc(r.wf)} · ${esc(shortP(r.project))}</small></span><span class="s">${esc(AP[r.apStep])}</span><span class="s">${esc(r.owner)}</span><span class="v ${r.overdue?"bad":""}">${dayDiff(r.stageSince,T0)} d${r.overdue?`<small>${r.overdue} over</small>`:""}</span><span class="v ${r.ann>0?"bad":"good"}">${r.ann==null?"—":sg(-r.ann)}</span></div>`).join("")}</div>${list.length>12?`<div class="tcd-note">${list.length-12} more — see the Change Register (status: Pending approval).</div>`:""}`:empty("No change is waiting for an approval decision in this selection."))]);
  const back=rows.filter(r=>r.life==="Rejected"||r.life==="Returned for rework");
  if(back.length) add(w,panel("Rejected and returned for rework","Changes that left the approval chain without approval.",`<div class="pd-t tcm-back"><div class="h"><span>Change</span><span>Outcome</span><span>Stopped at</span><span class="ra">Since</span><span>Owner</span></div>${back.map(r=>`<div class="r" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><span class="n"><b>${esc(r.part)}</b><small>${esc(r.wf)} · ${esc(shortP(r.project))}</small></span><span>${stChip(r.life)}</span><span class="s">${esc(AP[r.apStep])}</span><span class="v">${esc(D(r.stageSince))}</span><span class="s">${esc(r.owner)}</span></div>`).join("")}</div>`,{style:"margin-bottom:16px"}));
  const lv=all.filter(r=>r.live&&CD[r.live].stageIdx>=7);
  if(lv.length) add(w,`<div class="tcm-go"><span>Sign-off, reminders and escalation for a live change happen in its approval chain.</span>${lv.map(r=>`<button type="button" class="btn btn-sm" data-act="tcm:chain=${esc(r.live)}">Approval chain · ${esc(r.wf)}</button>`).join("")}</div>`);
  foot(w,all); U.wire(w); return w;
}

/* ------------------------------------------------------------ 4 · Implementation */
function buildImpl(){
  const {all,rows}=view(), w=shell("Implementation","Planned implementation dates, what is late or at risk, and what has been implemented."), act=rows.filter(r=>r.impl&&r.life!=="Implemented"&&r.life!=="Rejected"), s=x=>act.filter(r=>r.impl.s===x).length;
  const approved=rows.filter(r=>r.life==="Approved"), due30=act.filter(r=>r.impl.s!=="Delayed"&&r.impl.d<=30).length, done=rows.filter(r=>r.life==="Implemented"), lateDone=done.filter(r=>r.impl&&r.impl.d>0).length;
  add(w,`<div class="pd-kw"><div class="pd-kpis k6">${[
    kpi({icon:"check-circle",label:"Approved, awaiting implementation",value:approved.length,ict:"ok",sub:"price, BOM, PO and drawing to update"}),
    kpi({icon:"alert",label:"Delayed",value:s("Delayed"),tone:s("Delayed")?"bad":"",sub:"planned date passed, not implemented",tip:"Any change not yet implemented whose planned implementation date is earlier than today."}),
    kpi({icon:"flag",label:"At risk",value:s("At risk"),ict:"warn",sub:"see the rule on the timeline",tip:"Planned within 45 days and not yet approved, or inside the "+SOP_BUFFER+"-day window before the project's SOP, or tooling due within 60 days."}),
    kpi({icon:"calendar",label:"Due in the next 30 days",value:due30,sub:"planned dates, not delayed"}),
    kpi({icon:"settings",label:"Implemented",value:done.length,sub:lateDone?`${lateDone} after the planned date`:"on or before the planned date"}),
    kpi({icon:"wrench",label:"Tooling not yet released",value:rows.filter(r=>r.active&&r.deps.tooling).length,sub:"one-time tooling modification pending"})].join("")}</div></div>`);
  add(w,panel("Implementation timeline","Planned implementation date per change, next 12 months, with each project's SOP. Implemented changes in the window are shown in grey.",gantt(rows,12,{all:true,rh:48}),{style:"margin-bottom:16px"}));
  const lst=act.slice().sort((a,b)=>(a.impl.s==="Delayed"?-1:0)-(b.impl.s==="Delayed"?-1:0)||(a.plannedImpl<b.plannedImpl?-1:1));
  add(w,panel(`Implementation register <span class="count-pill">${lst.length}</span>`,"Changes with a planned implementation date that are not yet implemented: delayed first, then by date.",lst.length?`<div class="pd-t tcm-impl"><div class="h"><span>Change</span><span>Project</span><span>Status</span><span class="ra">Planned</span><span class="ra">Days</span><span class="ra">Project SOP</span><span>Open dependencies</span><span class="ra">Stage</span></div>${lst.slice(0,14).map(r=>`<div class="r" data-act="tcm:open=${esc(r.id)}" role="button" tabindex="0"><span class="n"><b>${esc(r.part)} — ${esc(r.desc)}</b><small>${esc(r.wf)}</small></span><span class="s">${esc(shortP(r.project))}</span><span><span class="tcm-st" style="--c:${IMPLC[r.impl.s]}"><i></i>${r.impl.s}</span></span><span class="v">${esc(D(r.plannedImpl))}</span><span class="v ${r.impl.s==="Delayed"?"bad":""}">${r.impl.s==="Delayed"?r.impl.d+" late":r.impl.d+" to go"}</span><span class="s">${esc(D(r.sop))}</span><span class="s">${[r.deps.supplier&&"supplier offer",r.deps.validation&&"validation",r.deps.tooling&&"tooling"].filter(Boolean).join(", ")||"none"}</span><span class="ra">${stChip(r.life)}</span></div>`).join("")}</div>${lst.length>14?`<div class="tcd-note">${lst.length-14} more in the Change Register.</div>`:""}`:empty("No change with a planned implementation date is waiting to be implemented."),{noPad:false,style:"margin-bottom:16px"}));
  const live=all.filter(r=>r.live&&CD[r.live].stageIdx>=8);
  if(live.length) add(w,`<div class="tcm-go"><span>The task list of a live change (price history, BOM at SOP, purchase order, drawing, tooling, notification) is worked in its implementation screen.</span>${live.map(r=>`<button type="button" class="btn btn-sm" data-act="tcm:impl=${esc(r.live)}">Implementation tasks · ${esc(r.wf)} (${r.tasks.done}/${r.tasks.total})</button>`).join("")}</div>`);
  foot(w,all); U.wire(w); return w;
}

/* ------------------------------------------------------------ 5 · Change Register (+ detail) */
function buildRegister(){
  const {all,rows}=view(), w=shell("Change Register","Every technical change with its status, stage, risk, financial impact and dates. Click a row for the change detail.");
  const list=UI.od?rows.filter(r=>r.overdue>0):rows;
  const ft=FTable.create({id:"tcm-reg",pageSize:10,sortable:true,rows:list,rowAct:r=>"tcm:open="+r.id,empty:"No change matches these filters.",columns:[
    {key:"id",label:"Change ID",get:r=>r.wf,html:r=>`<b>${esc(r.wf)}</b><small class="v8-sm">${esc(r.form)}${r.live?" · live workflow":""}</small>`},
    {key:"proj",label:"Project",get:r=>shortP(r.project)},
    {key:"desc",label:"Description",get:r=>r.part+" — "+r.desc,html:r=>`<b>${esc(r.part)}</b><small class="v8-sm">${esc(r.desc)}</small>`},
    {key:"cat",label:"Type",get:r=>r.category},
    {key:"st",label:"Status",get:r=>r.life,order:r=>LIFE.indexOf(r.life),html:r=>stChip(r.life)},
    {key:"stage",label:"Current stage",get:r=>r.stage},
    {key:"risk",label:"Risk",get:r=>r.rk.level,order:r=>({High:0,Medium:1,Low:2,"—":3}[r.rk.level]),html:r=>rkChip(r.rk.level)},
    {key:"pri",label:"Priority",get:r=>r.priority,order:r=>({High:0,Medium:1,Low:2,"—":3}[r.priority]),html:r=>prChip(r.priority)},
    {key:"imp",label:"Impact / yr",get:r=>r.ann==null?"not priced":r.ann<0?"saving":"cost",order:r=>r.ann==null?1e12:r.ann,align:"r",html:r=>r.ann==null?'<span class="tcm-mute">not priced</span>':`<span class="${r.ann>0?"v8-bad":"v8-good"}">${sg(-r.ann)}</span>`},
    {key:"plan",label:"Planned impl.",get:r=>r.plannedImpl?fmtDate(r.plannedImpl):"—",order:r=>r.plannedImpl||"9999",html:r=>esc(D(r.plannedImpl))},
    {key:"od",label:"Days overdue",get:r=>r.overdue?"overdue":"—",order:r=>-r.overdue,align:"r",html:r=>r.overdue?`<b class="v8-bad">${r.overdue}</b>`:"—"},
    {key:"own",label:"Owner",get:r=>r.owner}]});
  const p=U.el(U.panel(`Change register <span class="count-pill">${list.length}</span>`,"",{noPad:true,sub:"Page filters above apply · sort or filter any column from its heading · impact = annualised recurring change in piece cost, + saving, − additional cost",right:`<div class="fc-segs tight"><button type="button" class="fc-seg ${UI.od?"":"on"}" data-act="tcm:od=0">All</button><button type="button" class="fc-seg ${UI.od?"on":""}" data-act="tcm:od=1">Overdue only</button></div>`}));
  p.querySelector(".panel-body").appendChild(ft); w.appendChild(p); add(w,`<div class="tcd-note" style="margin:10px 2px 16px">Priority score = production risk (High 2, Medium 1) + materiality (≥ ₹2 Cr/yr 2, ≥ ₹50 L/yr 1): 3–4 High, 2 Medium, 0–1 Low. Impact sign: + saving, − additional cost.</div>`);
  foot(w,all); U.wire(w); return w;
}
function buildDetail(){
  const all=register(), r=all.find(x=>x.id===UI.sel)||all[0], w=document.createElement("div"); w.className="v8-page v8-board tc-page tcd tcm";
  w.appendChild(U.header(r.wf+" — "+r.part,r.desc+" · "+carName(r.project)));
  const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  add(w,`<div class="tcm-dh"><button type="button" class="btn btn-sm" data-act="tcm:go=change-register">${Icons.svg("undo")}Back to Change Register</button><span>${stChip(r.life)} ${rkChip(r.rk.level," risk")} ${prChip(r.priority," priority")} <span class="chip chip-gray"><span class="chip-dot"></span>${esc(r.category)}</span></span>${r.live?`<button type="button" class="btn btn-primary btn-sm" data-act="tc:open=${esc(r.live)}">Open in the change workflow</button>`:`<span class="tcm-mute">Generated register record — no workflow behind it</span>`}</div>`);
  const steps=AP.map((a,i)=>{ const done=r.life==="Approved"||r.life==="Implemented"||(r.apStep!=null&&i<r.apStep)||(r.life==="Open"?false:false), cur=(r.life==="Pending approval"||r.life==="Returned for rework"||r.life==="Rejected")&&r.apStep===i; return `<div class="stg ${done?"done":cur?(r.life==="Rejected"?"rej":"cur"):""}"><div class="nm">${esc(a)}</div><div class="ct">${done?"✓":cur?(r.life==="Rejected"?"✕":"●"):"·"}</div><div class="av">${esc(roleLabel(AP_ROLE[a]))}</div></div>`; }).join("");
  const a=r.ann;
  grid(w,"g3",[
    panel("Change","",`<div class="tcm-kv">${kv("Request",esc(r.form))}${kv("Type",esc(r.category))}${kv("Project",esc(carName(r.project)))}${kv("Part",esc(r.part)+" · "+esc(r.partNo))}${kv("Vertical",esc(r.vertical))}${kv("Supplier",esc(r.supplier))}${kv("Current stage",esc(r.stage))}${kv("Owner",esc(r.owner)+" · "+esc(roleLabel(r.ownerRole)))}</div>`),
    panel("Financial impact","Annualised recurring change in piece cost. One-time cost is separate.",`<div class="tcm-kv">${kv("Piece price",pctTxt(r.pct))}${kv("Annualised impact",a==null?"not yet priced":`<span class="${a>0?"v8-bad":"v8-good"}">${money(a)}${a<0?" saving":" additional cost"} / yr</span>`)}${kv("One-time tooling",r.oneTime?U.cr(r.oneTime):"none")}${kv("Basis",r.life==="Implemented"?"in effect (implemented)":r.life==="Approved"?"approved, not yet in effect":r.life==="Rejected"?"rejected — no effect":"forecast, not approved")}</div><div class="tcd-note">${esc(impactNote)}</div>`),
    panel("Dates","Due date = when the current step should be finished.",`<div class="tcm-kv">${kv("Raised",esc(fmtDate(r.raised)))}${kv("In current stage since",esc(fmtDate(r.stageSince)))}${kv("Due",r.due?esc(fmtDate(r.due))+(r.overdue?` <span class="v8-bad">· ${r.overdue} days overdue</span>`:""):"no date")}${kv("Planned implementation",r.plannedImpl?esc(fmtDate(r.plannedImpl))+(r.impl?` · ${esc(r.impl.s)}`:""):"none")}${r.implementedOn?kv("Implemented",esc(fmtDate(r.implementedOn))):""}${kv("Project SOP",r.sop?esc(fmtDate(r.sop))+(r.sop>T0?` · in ${dayDiff(T0,r.sop)} days`:" · in production"):"—")}</div>`)]);
  grid(w,"g2",[panel("Risk and dependencies","Production risk: High = two or more of the five indicators below, Medium = one, Low = none. The first three are the module's own risk rule (price up more than 3%, milestone within 90 days with a late supplier commitment, high-risk supplier).",`<ul class="tcm-ul">${r.rk.factors.map(f=>`<li class="${f.hit?"hit":""}"><i></i>${esc(f.txt)}</li>`).join("")}<li class="${r.deps.supplier?"hit":""}"><i></i>Supplier offer ${r.deps.supplier?"outstanding":"not outstanding"}</li><li class="${r.deps.validation?"hit":""}"><i></i>Validation ${r.deps.validation?"not complete":"not an open item"}</li><li class="${r.deps.tooling?"hit":""}"><i></i>Tooling modification ${r.deps.tooling?"not yet released"+(r.oneTime?" ("+U.cr(r.oneTime)+")":""):(r.oneTime?"released":"not required")}</li></ul>`),
    panel("Approval progress","Engineering → Quality → SRM → Finance → Commodity → Management → final confirmation.",`<div class="tcm-flow detail">${steps}</div>${r.tasks?`<div class="tcd-note">Implementation tasks: ${r.tasks.done} of ${r.tasks.total} done.</div>`:""}`)]);
  foot(w,all); U.wire(w); return w;
}

/* ------------------------------------------------------------ wiring */
const go=(id)=>Router.go(id,"techchange");
Object.assign(U.actions,{tcm:v=>{ const i=v.indexOf("="), k=v.slice(0,i), a=v.slice(i+1);
  if(v==="reset"){ F.project=F.type=F.status=F.year=""; UI.od=false; Router.render(); }
  else if(k==="go") go(a);
  else if(k==="life"){ F.status=F.status===a?"":a; Router.render(); }
  else if(k==="type"){ F.type=F.type===a?"":a; Router.render(); }
  else if(k==="proj"){ F.project=F.project===a?"":a; Router.render(); }
  else if(k==="kpi"){ F.status=a; go("change-register"); }
  else if(k==="od"){ UI.od=a==="1"; if(Router.screen!=="change-register") go("change-register"); else Router.render(); }
  else if(k==="open"){ UI.sel=a; go("tc-change"); }
  else if(k==="sheet"){ T.ctx.activeId=a; go("impact-analysis"); }
  else if(k==="chain"){ T.ctx.activeId=a; go("approval-workflow"); }
  else if(k==="impl"){ T.ctx.activeId=a; go("implementation"); } }});
const NEW=[["tc-impact","Change Impact","bar-chart",buildImpact],["tc-approval","Approval Workflow","check-circle",buildApproval],["tc-impl","Implementation","flag",buildImpl],["change-register","Change Register","list",buildRegister],["tc-change","Change detail","file",buildDetail]];
const at=NAV.techchange.findIndex(x=>x.id==="change-dashboard");
NEW.forEach(([id,label,ic,fn],i)=>{ NAV.techchange.splice(at+1+i,0,{id,label,icon:"📊"}); NAV_ICONS[id]=ic; NAV_SHORT[id]=label; SCREENS.techchange[id]=fn; });
NAV_HIDDEN.add("tc-change"); SCREENS.techchange["change-dashboard"]=buildOverview;
const LAB={"change-dashboard":"Overview","tc-impact":"Change Impact","tc-approval":"Approval Workflow","tc-impl":"Implementation","change-register":"Change Register","tc-change":"Change detail","impact-analysis":"Impact Sheet","approval-workflow":"Approval Chain","implementation":"Implementation Tasks"};
NAV.techchange.forEach(i=>{ if(LAB[i.id]) i.label=LAB[i.id]; }); Object.assign(NAV_SHORT,LAB);
Object.assign(NAV_ICONS,{"change-dashboard":"layout"});
const _nl=navLabel; navLabel=function(m,s){ return (m==="techchange"&&LAB[s])||_nl(m,s); };
MODULE_TREE.techchange.splice(0,MODULE_TREE.techchange.length,
  ["Dashboards",["change-dashboard","tc-impact","tc-approval","tc-impl","change-register"]],
  ["Change workflow",["intake","doc-upload","eval-sheet","validation","supplier-offers","mod-sheet","impact-analysis","approval-workflow","implementation","change-history"]],
  ["Approvals & reports",["approvals","reports-tc"]]);
/* Ask AIS: portfolio questions about technical changes are answered from the register (single-change questions stay with the workflow answer in v8_tc.js) */
(function(){
  if(typeof Radar==="undefined") return;
  const base=Radar.local, R=Radar.R, RE=/(technical change|change register|change management|\baeko\b|\bawe\b|\baea\b)/i, RE2=/(saving|additional cost|net impact|overdue|bottleneck|pending|implemented|how many|total|approved|status|financial|financial impact)/i;
  Radar.local=function(q,c2){
    if(!(RE.test(q)&&RE2.test(q))||/mod sheet/i.test(q)) return base(q,c2);
    const all=register(), f=fin(all), c=l=>cnt(all,l), st=approvalStats(all), bn=bottleneck(st), od=all.filter(r=>r.overdue>0).length;
    const html=`<p><b>${all.length}</b> technical changes in the register: <b>${c("Open")}</b> open, <b>${c("Pending approval")}</b> pending approval, <b>${c("Approved")}</b> approved, <b>${c("Implemented")}</b> implemented, <b>${c("Rejected")}</b> rejected, <b>${c("Returned for rework")}</b> returned for rework.</p>
      <p>Approved + implemented changes: savings <b>${money(f.sav)}</b>/yr, additional cost <b>${money(f.cost)}</b>/yr, net <b>${sg(f.net)}</b>/yr (annualised, recurring; ${money(f.savI-f.costI)} of it implemented). One-time tooling ${U.cr(f.oneTime)} is not included.</p>
      <p>${od} change${od===1?" is":"s are"} past a due date${bn?`; the approval bottleneck is <b>${esc(bn.a)}</b> (${bn.n} waiting, ${bn.over} overdue)`:""}.</p>`;
    return R(html,{charts:[{kind:"bar",title:"Changes by status",unit:"currency",currencySymbol:"",source:"Technical Change register",orientation:"horizontal",series:[{key:"v",label:"Changes"}],rows:LIFE.map(l=>({label:l,values:{v:c(l)},tone:"neutral"}))}],
      actions:[{l:"Overview",a:"goto:techchange/change-dashboard"},{l:"Approval Workflow",a:"goto:techchange/tc-approval"},{l:"Change Register",a:"goto:techchange/change-register"}],basis:"Technical Change register (5 live workflow changes + 60 illustrative records) · computed in this page"});
  };
})();
window.V8TCM={register,fin,F,view};
})();
