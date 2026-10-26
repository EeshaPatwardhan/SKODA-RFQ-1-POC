/* =====================================================================
   E7  ·  CBD core — one place for the cost-breakdown maths, the checks and the CSV upload validation
   The E6 formulas are kept exactly (same numbers for every existing part); what is added is
     • a real parent / child reading of the tree (a node may declare that its cost already includes its sub-nodes),
     • explicit handling of missing / zero / invalid inputs, and
     • checks that explain what is wrong and what it does to the total — nothing is changed silently.

   Part cost  = raw material (Σ net weight × commodity master price)
              + import content (import value × FX, INR per 1 unit of the import currency; ×1 when the currency is INR)
              + manual cost lines (each counts once; a line below a "cost includes sub-nodes" parent does not count again)
   Cost / car = part cost × quantity per car + D&D amortisation per car
   The E6 screens call these through cbdPartCost / cbdCarCost / syncDerivedNodes, so every module sees the same totals.
   ===================================================================== */
(function(){
"use strict";
const KEYS=["steel","aluminium","copper","lead","precious"];
const COMMODITY_OF={steel:"C1",aluminium:"C2",copper:"C3",lead:"C4",precious:"C5"};
const LABEL={steel:"Steel",aluminium:"Aluminium",copper:"Copper",lead:"Lead",precious:"Precious metal"};
const UNIT={steel:"kg",aluminium:"kg",copper:"kg",lead:"kg",precious:"g"};
const num=v=>{ const n=typeof v==="number"?v:parseFloat(v); return Number.isFinite(n)?n:0; };
const given=v=>v!==null&&v!==undefined&&String(v).trim()!==""&&Number.isFinite(+v);
const r2=v=>Math.round(v*100)/100;
const money=v=>"₹ "+(Math.round((+v||0)*100)/100).toLocaleString("en-IN");
const pctTxt=v=>(v>=0?"+":"")+v.toFixed(1)+"%";

/* ------------------------------------------------------------ inputs → derived costs */
const commodityRec=k=>DATA.commodities.find(c=>c.id===COMMODITY_OF[k]);
const commodityPx=k=>{ const r=commodityRec(k); return r?(Store.currentValue(r)||0):0; };
function rawLines(cbd){
  const w=cbd.weights||{};
  return KEYS.map(k=>{ const net=num(w[k]&&w[k].net), gross=num(w[k]&&w[k].gross), r=commodityRec(k), p=commodityPx(k);
    return {key:k,label:LABEL[k],unit:UNIT[k],gross,net,price:p,uom:r?r.uom:"",value:net*p}; });
}
const rawMaterial=cbd=>rawLines(cbd).reduce((s,l)=>s+l.value,0);
const fxMaster=cur=>{ const r=(DATA.fx||[]).find(f=>f.currency===cur); return r?Store.currentValue(r):null; };
function importRate(cbd){ const ic=cbd.importContent||{}, cur=ic.currency||"INR"; return cur==="INR"?1:num(ic.fxRate); }
const importValue=cbd=>num((cbd.importContent||{}).value)*importRate(cbd);

/* ------------------------------------------------------------ the manual tree, read as a hierarchy
   level 1 = directly under the part; a node's parent is the nearest node above it with a lower level. */
function structure(cbd){
  const nodes=(cbd.tree||[]).filter(n=>!n.derived), stack=[], out=[];
  nodes.forEach(n=>{
    const lvl=Math.max(1,parseInt(n.level)||1);
    while(stack.length&&stack[stack.length-1].lvl>=lvl) stack.pop();
    const parent=stack.length?stack[stack.length-1]:null;
    const rec={n,lvl,parent,children:[],jump:lvl-(parent?parent.lvl:0)>1,excluded:!!(parent&&(parent.excluded||parent.n.mode==="total"))};
    rec.orphan=lvl>=2&&!parent;
    if(parent) parent.children.push(rec);
    stack.push(rec); out.push(rec);
  });
  const sub=r=>r.n.mode==="total"?num(r.n.cost):num(r.n.cost)+r.children.reduce((s,c)=>s+(c.excluded?0:sub(c)),0);
  out.forEach(r=>{ r.contrib=r.excluded?0:num(r.n.cost); r.subtotal=sub(r); r.childSum=r.children.reduce((s,c)=>s+num(c.n.cost),0); });
  return out;
}
const manualTotal=cbd=>structure(cbd).reduce((s,r)=>s+r.contrib,0);
const partCost=cbd=>rawMaterial(cbd)+importValue(cbd)+manualTotal(cbd);
const qtyRaw=cbd=>cbd.qtyPerCar;
const qty=cbd=>(+cbd.qtyPerCar)||1;     // same fallback the other roll-ups use (0 / blank → 1); validate() flags it
const carCost=cbd=>partCost(cbd)*qty(cbd)+num((cbd.dd||{}).amortPerCar);

/* the tree nodes that really make up the total (used by charts that list the components) */
function contributing(cbd){
  const st=structure(cbd).filter(r=>r.contrib>0).map(r=>r.n);
  return (cbd.tree||[]).filter(n=>n.derived&&num(n.cost)>0).concat(st);
}

/* ------------------------------------------------------------ reference prices (kept apart from the calculated cost) */
const isCalc=v=>/recalculation|^CBD/i.test(v.source||"");
function versions(pn){ return (DATA.priceVersions[pn]||[]).slice().sort((a,b)=>new Date(a.effectiveFrom)-new Date(b.effectiveFrom)); }
function supplierPrice(pn){ const v=versions(pn).filter(x=>!isCalc(x)); return v.length?v[v.length-1]:null; }
function nominatedPrice(pn){ const v=versions(pn).filter(x=>!isCalc(x)); return v.length?(v.find(x=>/nomination/i.test(x.source))||v[0]):null; }
function compare(cbd){
  const calc=partCost(cbd), sp=supplierPrice(cbd.partNumber), nm=nominatedPrice(cbd.partNumber);
  const rows=[
    {key:"vsi",label:"VSI (original)",sub:"reference value",val:num(cbd.vsiOriginal)},
    {key:"tgt",label:"Target (original)",sub:"cost target",val:num(cbd.targetOriginal)},
    {key:"sup",label:"Supplier price (current)",sub:sp?"price version of "+sp.effectiveFrom:"",val:sp?num(sp.price):0},
    {key:"nom",label:"Nominated price",sub:nm?"price version of "+nm.effectiveFrom:"",val:nm?num(nm.price):0},
  ];
  rows.forEach(r=>{ r.has=r.val>0; r.d=r.has?calc-r.val:null; r.p=r.has?(calc-r.val)/r.val*100:null; });
  return {calc,rows};
}

/* ------------------------------------------------------------ checks */
const OVERLAP_MAT=/material|steel|alumin|copper|\blead\b|silver|precious|\braw\b/i, OVERLAP_IMP=/import|duty|customs|freight|forex|\bfx\b/i;
function validate(cbd){
  const I=[], add=(sev,code,msg,effect)=>I.push({sev,code,msg,effect:effect||""});
  const pn=cbd.partNumber, part=DATA.parts.find(p=>p.number===pn), same=DATA.parts.filter(p=>p.number===pn);
  /* relationships */
  if(!part) add("error","rel","This cost breakdown is not linked to a part in the part master.","Nothing can be rolled up to a vehicle for it.");
  else if(cbd.project&&part.project&&cbd.project!==part.project) add("error","rel","The cost breakdown is filed under project "+cbd.project+" but the part belongs to "+part.project+".","Its cost lands in the wrong vehicle roll-up.");
  if(same.length>1&&new Set(same.map(p=>p.project)).size>1) add("warn","rel","Part number "+pn+" exists in "+same.length+" projects but has one cost breakdown.","The same cost is counted for every project that uses it.");
  /* weights */
  rawLines(cbd).forEach(l=>{
    if(l.net<0||l.gross<0) add("error","neg",l.label+" weight is negative.","It reduces the raw-material cost.");
    if(l.gross>0&&l.net>l.gross+1e-9) add("error","wt",l.label+" net weight ("+l.net+" "+l.unit+") is above gross ("+l.gross+" "+l.unit+").","Net weight is what gets priced, so the material cost is overstated.");
    if(l.gross>0&&l.net===0) add("warn","wt",l.label+" has a gross weight but no net weight.","No "+l.label.toLowerCase()+" cost is included.");
    if(l.net>0&&!(l.price>0)) add("error","px","No current price in the commodity master for "+l.label.toLowerCase()+".","Its material cost is counted as ₹ 0.");
    if(l.net>0&&l.uom&&l.uom!=="INR/"+l.unit) add("error","uom",l.label+" is priced in "+l.uom+" but its weight is in "+l.unit+".","Weight × price mixes units.");
  });
  /* import content and FX */
  const ic=cbd.importContent||{}, iv=num(ic.value), cur=ic.currency||"INR";
  if(iv<0) add("error","neg","Import value is negative.","It reduces the part cost.");
  if(iv>0&&cur!=="INR"){
    const fx=num(ic.fxRate), m=fxMaster(cur);
    if(!(fx>0)) add("error","fx","Import content of "+iv+" "+cur+" has no valid FX rate.","The import cost is counted as ₹ 0.");
    else if(m&&(fx/m<0.2||fx/m>5)) add("error","fx","FX rate "+fx+" looks inverted or in the wrong unit — the master rate is "+m+" INR per 1 "+cur+".","The import cost is out by a large factor.");
    else if(m&&Math.abs(fx/m-1)>0.005) add("warn","fxstale","FX rate on this breakdown ("+fx+") differs from the current master rate ("+m+").","The import cost uses the older rate until the next approved FX change.");
  }
  if(iv>0&&cur==="INR"&&num(ic.fxRate)>1) add("info","fx","Import currency is INR, so the FX rate ("+ic.fxRate+") is ignored.","");
  /* quantity */
  const q=qtyRaw(cbd);
  if(!given(q)||+q<=0) add("error","qty","Quantity per car is missing or not above 0.","The roll-ups fall back to 1 piece per car.");
  /* tree structure */
  const st=structure(cbd), nm=r=>"“"+(r.n.name||"unnamed")+"”";
  const ids={}, sib={};
  st.forEach(r=>{
    if(r.orphan) add("error","orphan","Cost line "+nm(r)+" sits at level "+r.lvl+" with no parent above it.","Its cost is still added to the part total; its place in the hierarchy is unclear.");
    else if(r.jump) add("warn","orphan","Cost line "+nm(r)+" skips a level (level "+r.lvl+" under level "+(r.parent?r.parent.lvl:0)+").","The total is unaffected; the grouping may not be what you meant.");
    if(num(r.n.cost)<0) add("warn","neg","Cost line "+nm(r)+" is negative.","It reduces the part cost (a credit).");
    if(r.n.cost===""||r.n.cost==null||!Number.isFinite(+r.n.cost)) add("error","cost","Cost line "+nm(r)+" has no valid cost.","It is counted as ₹ 0.");
    ids[r.n.id]=(ids[r.n.id]||0)+1;
    const key=(r.parent?r.parent.n.id:"root")+"|"+String(r.n.name||"").trim().toLowerCase(); sib[key]=(sib[key]||0)+1;
    if(r.n.mode==="total"&&r.children.length){
      if(r.childSum>num(r.n.cost)+0.005) add("error","recon",nm(r)+" is set to include its sub-nodes, but they add up to "+money(r.childSum)+" — more than its own "+money(r.n.cost)+".","The parent total does not reconcile with its children.");
      else if(r.childSum<num(r.n.cost)-0.005) add("info","recon",money(num(r.n.cost)-r.childSum)+" of "+nm(r)+" is not assigned to any sub-node.","This is an incomplete breakdown, not a calculation error.");
    }
    if(OVERLAP_MAT.test(r.n.name||"")&&!r.excluded&&rawMaterial(cbd)>0) add("warn","overlap","Cost line "+nm(r)+" looks like material cost, which is already calculated from the weights.","The material may be counted twice.");
    if(OVERLAP_IMP.test(r.n.name||"")&&!r.excluded&&importValue(cbd)>0) add("warn","overlap","Cost line "+nm(r)+" looks like import cost, which is already calculated from the import content.","The import may be counted twice.");
  });
  Object.keys(ids).forEach(k=>{ if(ids[k]>1) add("error","dup","Cost-line id "+k+" appears "+ids[k]+" times.","Editing or deleting one changes the others."); });
  Object.keys(sib).forEach(k=>{ if(sib[k]>1) add("warn","dup","Two cost lines called “"+k.split("|")[1]+"” sit under the same parent.","Possible duplicate, counted twice."); });
  /* derived nodes in step with the inputs */
  const dr=(cbd.tree||[]).find(n=>n.id==="D-RAW"), di=(cbd.tree||[]).find(n=>n.id==="D-IMP");
  if((dr&&Math.abs(num(dr.cost)-rawMaterial(cbd))>0.005)||(di&&Math.abs(num(di.cost)-importValue(cbd))>0.005)) add("warn","stale","The stored raw-material / import nodes are out of date with the inputs.","The tree is re-synced when it is opened; reports reading the stored nodes show the older value until then.");
  /* D&D */
  const dd=cbd.dd||{}, inv=DATA.investments&&DATA.investments[pn];
  if(num(dd.amortPerCar)>0&&!(num(dd.volume)>0)) add("warn","dd","D&D amortisation per car is set but the volume is 0.","The amortisation cannot be traced back to the tooling investment.");
  if(inv&&num(inv.capex)>0&&num(dd.volume)>0&&num(dd.amortPerCar)>0){ const exp=inv.capex/dd.volume; if(Math.abs(exp-dd.amortPerCar)/exp>0.05) add("warn","dd","D&D amortisation ("+money(dd.amortPerCar)+") differs from tooling investment ÷ volume ("+money(exp)+").","The cost per car carries an amortisation that the investment record does not support."); }
  /* completeness and reference comparison */
  const tot=partCost(cbd);
  if(!(tot>0)) add("warn","empty","No cost input has been entered yet.","The part cost is ₹ 0 and the car-level roll-up only carries the D&D amortisation.");
  if(tot>0&&st.length===0) add("warn","incomplete","Only calculated material and import cost are in this breakdown — no manufacturing, purchased-component or other cost lines are entered.","The part cost is probably understated (an incomplete breakdown, not a calculation error).");
  const cmp=compare(cbd), sup=cmp.rows.find(r=>r.key==="sup");
  if(tot>0&&sup&&sup.has){
    if(sup.p>5) add("warn","gap","The calculated cost is "+pctTxt(sup.p)+" above the current supplier price.","A breakdown above the price it explains usually means overlapping or double-counted lines.");
    else if(sup.p<-30) add("warn","gap","The calculated cost is "+pctTxt(sup.p)+" below the current supplier price.","The breakdown is probably incomplete (a cost element is missing), not wrong.");
  }
  if(!cmp.rows.find(r=>r.key==="vsi").has||!cmp.rows.find(r=>r.key==="tgt").has) add("info","ref","VSI and / or target are not set.","The comparison against them is unavailable.");
  return I;
}

/* ------------------------------------------------------------ CSV upload: parse → validate → plan (nothing is written here) */
function parseCsv(text){
  text=String(text||"").replace(/^﻿/,"");
  const first=text.split(/\r?\n/,1)[0]||"", d=[["\t",(first.match(/\t/g)||[]).length],[";",(first.match(/;/g)||[]).length],[",",(first.match(/,/g)||[]).length]].sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true;
    else if(c===d){ row.push(cur); cur=""; }
    else if(c==="\n"||c==="\r"){ if(c==="\r"&&text[i+1]==="\n") i++; row.push(cur); cur=""; if(row.some(x=>x.trim()!=="")) rows.push(row); row=[]; }
    else cur+=c; }
  row.push(cur); if(row.some(x=>x.trim()!=="")) rows.push(row);
  return rows;
}
const norm=h=>String(h||"").trim().toLowerCase().replace(/[\s\-\.]+/g,"_");
const ALIAS={part_no:"part_number",partnumber:"part_number",part:"part_number",node:"node_name",name:"node_name",description:"node_name",cost_inr:"cost",amount:"cost",
  node_cost:"cost",qty:"qty_per_car",quantity_per_car:"qty_per_car",parent:"parent_id",parent_node:"parent_id",id:"node_id",currency:"currency",unit:"currency"};
function readTable(text){
  const rows=parseCsv(text); if(rows.length<2) return {err:"The file needs a header row and at least one data row.",header:[],data:[]};
  const rawHead=rows[0].map(h=>String(h||"").trim()), head=rawHead.map(h=>{ const n=norm(h); return /^node[:>]/i.test(h)?h:(ALIAS[n]||n); });
  return {header:head,rawHead,data:rows.slice(1).map((r,i)=>({n:i+2,v:r}))};
}
const FORMATS={
  long:{req:["node_name","cost"],cols:"part_number (optional) · node_id · parent_id or level · node_name · cost · cost_basis (additive | total)"},
  wide:{req:["part_number"],cols:"part_number · qty_per_car · steel_net_kg · steel_gross_kg … precious_net_g · import_value · import_currency · fx_rate · vsi · target · dd_amort_per_car · dd_volume · node:<Name> (use node:<Parent>><Child> for sub-nodes)"},
};
function planUpload(format,text,activePn){
  const T=readTable(text), errors=[], warnings=[], plans={};
  if(T.err){ return {errors:[{row:0,msg:T.err}],warnings,plans:[]}; }
  const col=n=>T.header.indexOf(n), E=(row,msg)=>errors.push({row,msg}), W=(row,msg)=>warnings.push({row,msg});
  const partOk=pn=>DATA.parts.some(p=>p.number===pn)||!!DATA.cbds[pn];
  FORMATS[format].req.forEach(c=>{ if(col(c)<0) E(1,"Required column “"+c+"” is missing."); });
  if(format==="long"&&col("parent_id")<0&&col("level")<0) E(1,"The hierarchy needs a “parent_id” or a “level” column.");
  if(errors.length) return {errors,warnings,plans:[]};
  const cell=(r,c)=>{ const i=col(c); return i<0?"":String(r.v[i]==null?"":r.v[i]).trim(); };
  if(format==="long"){
    const byPart={};
    T.data.forEach(r=>{
      let pn=cell(r,"part_number")||activePn;
      if(col("part_number")>=0&&!cell(r,"part_number")) { E(r.n,"part_number is empty."); return; }
      if(!pn){ E(r.n,"part_number is empty — no part is selected, so every row needs one."); return; }
      if(!partOk(pn)){ E(r.n,"Unknown part number “"+pn+"”."); return; }
      (byPart[pn]=byPart[pn]||[]).push(r);
    });
    Object.keys(byPart).forEach(pn=>{
      const nodes=[], seenId={}, seenName={}; let bad=false;
      byPart[pn].forEach(r=>{
        const name=cell(r,"node_name"), cs=cell(r,"cost"), cur=cell(r,"currency").toUpperCase(), basis=cell(r,"cost_basis").toLowerCase(), id=cell(r,"node_id"), par=cell(r,"parent_id");
        if(!name){ E(r.n,"node_name is empty."); bad=true; return; }
        if(cs===""||!Number.isFinite(+cs)){ E(r.n,"Cost for “"+name+"” is missing or not a number (“"+cs+"”)."); bad=true; return; }
        if(+cs<0) W(r.n,"Cost for “"+name+"” is negative — treated as a credit.");
        if(cur&&cur!=="INR"){ E(r.n,"Cost for “"+name+"” is in "+cur+". Node costs must be in INR; foreign-currency content belongs in the import content."); bad=true; return; }
        if(basis&&basis!=="additive"&&basis!=="total"){ E(r.n,"cost_basis “"+basis+"” is not additive or total."); bad=true; return; }
        let lvl=null;
        if(par){ const p=nodes.find(x=>(x.id&&x.id===par)||(!x.id&&x.name===par))||nodes.find(x=>x.name===par); if(!p){ E(r.n,"Parent “"+par+"” was not found above this row."); bad=true; return; } lvl=p.level+1; }
        const lv=cell(r,"level");
        if(lv!==""){ const L=parseInt(lv); if(!Number.isInteger(L)||L<1||String(L)!==String(+lv)){ E(r.n,"level “"+lv+"” must be a whole number from 1."); bad=true; return; }
          if(lvl!==null&&L!==lvl){ E(r.n,"level "+L+" does not match the parent’s level (+1 = "+lvl+")."); bad=true; return; } lvl=L; }
        if(lvl===null&&col("parent_id")>=0) lvl=1;     // an empty parent_id means "directly under the part"
        if(lvl===null){ E(r.n,"Neither parent_id nor level is given."); bad=true; return; }
        const prev=nodes[nodes.length-1]; if(lvl>(prev?prev.level:0)+1){ E(r.n,"“"+name+"” is at level "+lvl+" but the row above is at level "+(prev?prev.level:0)+" — a level was skipped."); bad=true; return; }
        if(id&&seenId[id]){ E(r.n,"node_id “"+id+"” is used twice."); bad=true; return; } if(id) seenId[id]=1;
        const parent=(()=>{ for(let i=nodes.length-1;i>=0;i--) if(nodes[i].level<lvl) return nodes[i]; return null; })();
        const k=(parent?parent.name:"")+"|"+name.toLowerCase(); if(seenName[k]){ E(r.n,"“"+name+"” appears twice under the same parent."); bad=true; return; } seenName[k]=1;
        nodes.push({id:id||"",name,level:lvl,cost:+cs,mode:basis==="total"?"total":undefined});
      });
      if(!bad){
        const st=structure({tree:nodes.map((n,i)=>({id:"x"+i,name:n.name,level:n.level,cost:n.cost,mode:n.mode,derived:false}))});
        st.forEach(s=>{ if(s.n.mode==="total"&&s.childSum>num(s.n.cost)+0.005) { E(0,"“"+s.n.name+"” (part "+pn+") is marked total but its sub-nodes add up to "+money(s.childSum)+", above its "+money(s.n.cost)+"."); bad=true; } });
      }
      if(!bad) plans[pn]={pn,nodes,fields:{}};
    });
  } else {
    const pcols={qty_per_car:"qty",import_value:"iv",import_currency:"icur",fx_rate:"fx",vsi:"vsi",target:"tgt",dd_amort_per_car:"dda",dd_volume:"ddv"};
    KEYS.forEach(k=>{ ["net","gross"].forEach(t=>{ pcols[k+"_"+t+(k==="precious"?"_g":"_kg")]=k+"."+t; }); });
    const nodeCols=[]; T.rawHead.forEach((h,i)=>{ const m=h.match(/^node[:>]\s*(.+)$/i); if(m){ const path=m[1].split(">").map(s=>s.trim()).filter(Boolean); nodeCols.push({i,path,key:path.join(">").toLowerCase()}); } });
    nodeCols.forEach(c=>{ if(c.path.length>1){ const pk=c.path.slice(0,-1).join(">").toLowerCase(); if(!nodeCols.find(x=>x.key===pk)) E(1,"Column “"+T.rawHead[c.i]+"” needs its parent column “node:"+c.path.slice(0,-1).join(">")+"”."); } });
    const known=Object.keys(pcols).concat(["part_number"]); T.header.forEach((h,i)=>{ if(!/^node[:>]/i.test(T.rawHead[i])&&known.indexOf(h)<0) W(1,"Column “"+T.rawHead[i]+"” is not recognised and is ignored."); });
    const seen={};
    if(!errors.length) T.data.forEach(r=>{
      const pn=cell(r,"part_number"); if(!pn){ E(r.n,"part_number is empty."); return; }
      if(!pn){ E(r.n,"part_number is empty — no part is selected, so every row needs one."); return; }
      if(!partOk(pn)){ E(r.n,"Unknown part number “"+pn+"”."); return; }
      if(seen[pn]){ E(r.n,"Part “"+pn+"” appears on rows "+seen[pn]+" and "+r.n+"."); return; } seen[pn]=r.n;
      const f={}, nodes=[]; let bad=false;
      Object.keys(pcols).forEach(h=>{ const v=cell(r,h); if(v==="") return;
        if(h==="import_currency"){ const c=v.toUpperCase(); if(c!=="INR"&&!(DATA.fx||[]).some(x=>x.currency===c)){ E(r.n,"import_currency “"+v+"” is not INR or a currency in the FX master."); bad=true; return; } f.icur=c; return; }
        if(!Number.isFinite(+v)){ E(r.n,h+" “"+v+"” is not a number."); bad=true; return; }
        if(+v<0&&["vsi","target","qty_per_car","dd_amort_per_car","dd_volume","import_value","fx_rate"].indexOf(h)>=0||(+v<0&&/_(net|gross)_/.test(h))){ E(r.n,h+" cannot be negative."); bad=true; return; }
        f[pcols[h]]=+v; });
      if(f.qty!==undefined&&!(f.qty>0)){ E(r.n,"qty_per_car must be above 0."); bad=true; }
      KEYS.forEach(k=>{ const n=f[k+".net"], g=f[k+".gross"]; if(n!==undefined&&g!==undefined&&n>g){ E(r.n,k+": net weight is above gross weight."); bad=true; } });
      const effIv=f.iv!==undefined?f.iv:num((DATA.cbds[pn]||{}).importContent&&DATA.cbds[pn].importContent.value), effCur=f.icur||((DATA.cbds[pn]||{}).importContent||{}).currency||"EUR", effFx=f.fx!==undefined?f.fx:num(((DATA.cbds[pn]||{}).importContent||{}).fxRate);
      if(effIv>0&&effCur!=="INR"&&!(effFx>0)){ E(r.n,"import_value is above 0 but there is no valid fx_rate."); bad=true; }
      nodeCols.forEach(c=>{ const v=String(r.v[c.i]==null?"":r.v[c.i]).trim(); if(v==="") return;
        if(!Number.isFinite(+v)){ E(r.n,"“"+T.rawHead[c.i]+"” value “"+v+"” is not a number."); bad=true; return; }
        nodes.push({name:c.path[c.path.length-1],level:c.path.length,cost:+v,key:c.key}); });
      /* a sub-node needs its parent present on this row: parents are added with a zero cost when their cell is empty */
      const out=[]; nodeCols.forEach(c=>{ const mine=nodes.find(n=>n.key===c.key); if(mine&&!out.find(o=>o.key===c.key)) { if(c.path.length>1){ const pk=c.path.slice(0,-1).join(">").toLowerCase(); if(!out.find(o=>o.key===pk)) { const pc=nodeCols.find(x=>x.key===pk); out.push({name:pc.path[pc.path.length-1],level:pc.path.length,cost:0,key:pk}); } } out.push(mine); } });
      const ordered=[]; const place=n=>{ if(ordered.includes(n)) return; ordered.push(n); out.filter(o=>o.level===n.level+1&&o.key.indexOf(n.key+">")===0).forEach(place); };
      out.filter(o=>o.level===1).forEach(place);
      if(!bad) plans[pn]={pn,nodes:ordered.map(n=>({id:"",name:n.name,level:n.level,cost:n.cost})),fields:f,nodeColsGiven:nodeCols.length>0};
    });
  }
  /* what would change, per part (nothing is written) */
  const list=Object.keys(plans).map(pn=>{ const p=plans[pn], cur=DATA.cbds[pn]; const before=cur?partCost(cur):null; const cl=()=>cur?JSON.parse(JSON.stringify(cur)):null, sr=apply(p,cl(),{mode:"replace",dry:true}), sa=apply(p,cl(),{mode:"append",dry:true}); p.before=before; p.afterReplace=sr?partCost(sr):null; p.afterAppend=sa?partCost(sa):null;
    p.old=cur?(cur.tree||[]).filter(n=>!n.derived):[]; return p; });
  return {errors,warnings,plans:list};
}

/* apply a plan to a cbd (mode: "replace" the manual nodes, or "append" to them); wide-format fields only touch the cells that were filled */
function apply(plan,cbd,opt){
  opt=opt||{};
  if(!cbd) return null;
  const f=plan.fields||{}, w=cbd.weights=cbd.weights||{};
  KEYS.forEach(k=>{ w[k]=w[k]||{gross:0,net:0}; if(f[k+".net"]!==undefined) w[k].net=f[k+".net"]; if(f[k+".gross"]!==undefined) w[k].gross=f[k+".gross"]; });
  const ic=cbd.importContent=cbd.importContent||{value:0,fxRate:0,currency:"EUR",origin:""};
  if(f.iv!==undefined) ic.value=f.iv; if(f.icur) ic.currency=f.icur; if(f.fx!==undefined) ic.fxRate=f.fx;
  if(f.qty!==undefined) cbd.qtyPerCar=f.qty; if(f.vsi!==undefined) cbd.vsiOriginal=f.vsi; if(f.tgt!==undefined) cbd.targetOriginal=f.tgt;
  cbd.dd=cbd.dd||{amortPerCar:0,volume:0}; if(f.dda!==undefined) cbd.dd.amortPerCar=f.dda; if(f.ddv!==undefined) cbd.dd.volume=f.ddv;
  const touchNodes=plan.nodes&&plan.nodes.length&&(plan.nodeColsGiven!==false);
  if(touchNodes){
    const keep=opt.mode==="append"?(cbd.tree||[]).filter(n=>!n.derived):[];
    const stamp=Date.now().toString(36);
    cbd.tree=(cbd.tree||[]).filter(n=>n.derived).concat(keep,plan.nodes.map((n,i)=>({id:"U"+stamp+i,derived:false,level:n.level,name:n.name,cost:n.cost,mode:n.mode})));
  }
  if(!opt.dry){ cbd.tree=(cbd.tree||[]); }
  return cbd;
}

/* CSV templates */
function template(format,pn){
  const p=DATA.parts.find(x=>x.number===pn)||{number:pn||"PART-001"};
  if(format==="long") return "part_number,node_id,parent_id,node_name,cost,cost_basis\n"+p.number+",A,,Casting,52,additive\n"+p.number+",B,A,Machining,33,additive\n"+p.number+",C,A,Coating,18,additive\n";
  return "part_number,qty_per_car,steel_net_kg,steel_gross_kg,import_value,import_currency,fx_rate,node:Casting,node:Casting>Machining,node:Surface treatment\n"+p.number+",2,2.9,3.4,0,EUR,,52,33,22\n";
}

window.CbdCore={rawLines,rawMaterial,importRate,importValue,structure,manualTotal,partCost,carCost,qty,contributing,supplierPrice,nominatedPrice,compare,validate,
  fxMaster,planUpload,apply,template,parseCsv,FORMATS,money,pctTxt,num,given,r2,LABEL,UNIT,KEYS};
})();
