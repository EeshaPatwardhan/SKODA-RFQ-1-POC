# (exec'd by build_e7.py with rep() in scope) — patches into the E6 workflow screens

# ----------------------------------------------------------------------------- hooks into E2 closure state (selected part on CBD tree / price history)
rep("let CBD_ACTIVE = null;", "let CBD_ACTIVE = null;\nwindow.__cbdCost = cbdPartCost;\nwindow.__openCbd = function(no){ CBD_ACTIVE=no; Router.go('cbd-tree','procurement'); };\nwindow.__cbdApi = {options:()=>cbdPartOptions(), active:()=>CBD_ACTIVE, setActive:v=>{CBD_ACTIVE=v;}, setRecalc:v=>{CBD_RECALC=v;}, sync:c=>syncDerivedNodes(c), partCost:c=>cbdPartCost(c), carCost:c=>cbdCarCost(c), fmt:v=>fmt(v)};")
rep("let PRICE_ACTIVE = null;", "let PRICE_ACTIVE = null;\nwindow.__openPrice = function(no){ var A=window.PocUI&&PocUI.actions; if(A&&A.pprice) A.pprice('part='+no); else if(window.PocUI&&PocUI.openPart) PocUI.openPart(no); };\nwindow.__priceApi = {options:()=>priceParts(), active:()=>PRICE_ACTIVE, setActive:v=>{PRICE_ACTIVE=v;}, drawer:n=>openPriceDrawer(n)};")
rep("onclick=\"Drawer.close();CBD_ACTIVE='${partNumber}';Router.go('cbd-tree','procurement')\">Open CBD tree", "onclick=\"Drawer.close();__openCbd('${partNumber}')\">Open CBD tree")

# ----------------------------------------------------------------------------- Material Cost dashboard: model-forecast (POC) mode
rep("let MCD_FC={commodity:false, forex:false, savings:false};", "let MCD_FC={poc:true, commodity:false, forex:false, savings:false};")
rep("function forecastFactor(){\n  let f=1;", "function forecastFactor(){\n  let f=1;\n  if(MCD_FC.poc) return 1;   // E7: per-part model forecast replaces the flat scenario factors")
rep("b.onclick=()=>{MCD_FC[key]=!MCD_FC[key];Router.render();}; return b;};",
    "b.onclick=()=>{ if(key===\"poc\"){ MCD_FC.poc=!MCD_FC.poc; if(MCD_FC.poc){ MCD_FC.commodity=MCD_FC.forex=MCD_FC.savings=false; } } else { MCD_FC[key]=!MCD_FC[key]; if(MCD_FC[key]) MCD_FC.poc=false; } Router.render(); }; return b;};")
rep('fc.appendChild(mkToggle("commodity","Commodity +5%",true));', 'fc.appendChild(mkToggle("poc","Model forecast (POC)"));\n  fc.appendChild(mkToggle("commodity","Commodity +5%",true));')
rep("const f=forecastFactor();\n  const atLevel=", "const f=forecastFactor();\n  const fp=c=>{ if(!MCD_FC.poc) return f; const dp=partByNumber(c.partNumber); return dp&&dp.poc?1+dp.poc.chgH/100:1; };\n  const atLevel=")
rep("const forecastTotal=cbds.reduce((s,c)=>s+atLevel(c)*f,0);", "const forecastTotal=cbds.reduce((s,c)=>s+atLevel(c)*fp(c),0);")
rep("render:r=>`<b>${fmt(atLevel(r)*f)}</b>`", "render:r=>`<b>${fmt(atLevel(r)*fp(r))}</b>`")
rep('    {label:"Actual vs budget",val:actualTotal-budgetTotal,type:"delta"},\n', '    {label:"Actual vs budget",val:actualTotal-budgetTotal,type:"delta"},\n    ...(MCD_FC.poc?[{label:"Model forecast (POC)",val:forecastTotal-actualTotal,type:"delta"}]:[]),\n')

# ----------------------------------------------------------------------------- Commodity & Forex: market + forecast tab
rep('const tabs=[{id:"prices",label:"Prices & Rates"},{id:"approvals",label:"Approvals"},{id:"risk",label:"Commodity / Forex Risk"}];',
    'const tabs=[{id:"prices",label:"Prices & Rates"},{id:"approvals",label:"Approvals"},{id:"risk",label:"Commodity / Forex Risk"},{id:"market",label:"Market & Forecast"}];')
rep('else if(CF_TAB==="approvals") wrap.appendChild(cfApprovalsView(canApprove));\n  else wrap.appendChild(cfRiskView());',
    'else if(CF_TAB==="approvals") wrap.appendChild(cfApprovalsView(canApprove));\n  else if(CF_TAB==="market") wrap.appendChild(PocMarket.build());\n  else wrap.appendChild(cfRiskView());')

# ----------------------------------------------------------------------------- Report Centre previews: live numbers instead of seed text
rep('"material-cost":[["Cost vs Target","TGN avg −1.8% to EKL; 4 parts over tolerance"],["Commodity Split","Steel 41% · Aluminium 22% · Copper 14% · Polymer 13% · Other 10%"],["Movement","+2.1% vs plan after Jul steel recalc"]],',
    '"material-cost":(()=>{ const f=PocSeed.reportFacts(); return [["Cost vs Target",f.costVsTarget],["Commodity Split",f.split],["Movement",f.movement]]; })(),')
rep('"exec-summary":[["Portfolio KPIs","4 active programmes · ₹2.34 Cr YTD savings · 14 open tasks"],["Risk","₹1.9 Cr commodity/forex exposure at +5% move"],["Change","5 technical changes in flight · 2 pending approval"]],',
    '"exec-summary":(()=>{ const f=PocSeed.reportFacts(); return [["Portfolio KPIs",f.portfolio],["Risk",f.risk],["Change",f.change]]; })(),')

# ----------------------------------------------------------------------------- the canned E6/E5 assistant answers are replaced by Radar (e7_radar.js): drop the dead code
cut("  ask(q){\n    if(!q) return;\n    this.addUser(q);\n    const lower = q.toLowerCase();", "/* ---------------------------------------------------------\n   10. DRAWER",
    "  ask(q){ /* E7: answered by Radar (see e7_radar.js) */ }\n};\n\n")
cut("AI.ask = function(q){\n  if(!q) return;\n  this.addUser(q);\n  const l = q.toLowerCase();", "// Full-page AI Assistant screen (the slide-over remains reachable everywhere)", "")

# ----------------------------------------------------------------------------- Procurement > Cost & price > Price History: removed (Price Analysis shows the recorded price versions)
rep('    {id:"price-history", label:"Price History", icon:"📉"},\n', "")
rep('["Cost & price",["cbd-tree","price-history","investment"]]', '["Cost & price",["cbd-tree","investment"]]')
rep('"cbd-tree":"network","price-history":"line-chart","investment":"wrench",', '"cbd-tree":"network","investment":"wrench",')
rep('  "price-history": buildPriceHistory,\n', "")
rep("""      <button class="btn" onclick="Drawer.close();PRICE_ACTIVE='${partNumber}';Router.go('price-history','procurement')">Price history</button>\n""", "")

# ----------------------------------------------------------------------------- collapsed sidebar: no expanded flash on reload, scrollable flyout
rep('<div id="app-shell">', '<div id="app-shell"><script>try{ if(localStorage.getItem("ais-rail")==="1") document.getElementById("app-shell").classList.add("rail"); }catch(e){}</script>')
rep('f.style.top = Math.max(12, Math.min(r.top - 6, window.innerHeight - h - 12)) + "px";', 'const ft = Math.max(12, Math.min(r.top - 6, window.innerHeight - h - 12)); f.style.top = ft + "px"; f.style.maxHeight = (window.innerHeight - ft - 12) + "px";   // opened sub-groups scroll inside the flyout instead of running off the screen')

