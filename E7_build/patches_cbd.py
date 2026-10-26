# (exec'd by build_e7.py with rep() / cut() in scope) — Cost Breakdown: real parent/child maths, checks, VSI / target / supplier-price comparison, real CSV upload.
# The calculations live in src/e7_cbd_core.js (CbdCore); the E6 functions below now delegate to it. The screen and forms run inside the E6 closure.

_STUB = '''/* ---- CBD math: delegated to CbdCore (src/e7_cbd_core.js) once it is loaded; the E6 formulas stay as the fallback for the seed that runs while the page is still loading ---- */
function rawMaterialValue(cbd){ if(window.CbdCore) return CbdCore.rawMaterial(cbd); const w=cbd.weights; return (w.steel.net*commodityPrice("Steel"))+(w.aluminium.net*commodityPrice("Aluminium"))+(w.copper.net*commodityPrice("Copper"))+(w.lead.net*commodityPrice("Lead"))+(w.precious.net*commodityPrice("Precious")); }
function importValue(cbd){ if(window.CbdCore) return CbdCore.importValue(cbd); return (cbd.importContent.value||0)*(cbd.importContent.fxRate||0); }
function manualNodesTotal(cbd){ if(window.CbdCore) return CbdCore.manualTotal(cbd); return cbd.tree.filter(n=>!n.derived).reduce((s,n)=>s+(+n.cost||0),0); }
function cbdPartCost(cbd){ return window.CbdCore?CbdCore.partCost(cbd):rawMaterialValue(cbd)+importValue(cbd)+manualNodesTotal(cbd); }
function cbdCarCost(cbd){ return window.CbdCore?CbdCore.carCost(cbd):cbdPartCost(cbd)*(cbd.qtyPerCar||1)+(cbd.dd.amortPerCar||0); }
function syncDerivedNodes(cbd){
  cbd.tree = cbd.tree.filter(n=>!n.derived);
  cbd.tree.unshift(
    {id:"D-RAW", derived:true, level:0, name:"Raw material (from weights \u00D7 commodity price)", cost:rawMaterialValue(cbd)},
    {id:"D-IMP", derived:true, level:0, name:"Import content (value \u00D7 FX)", cost:importValue(cbd)}
  );
}
'''
# the two copies of the E6 maths (first scope, and the mirrored helpers of the later scope)
cut("/* ---- CBD math (single source of truth for the rollup) ---- */", "/* ---------------------------------------------------------\n   SEED \u2014 give the screens live content on first open", _STUB + "\n")
cut("function rawMaterialValue(cbd){ const w=cbd.weights;", "function weightNet(cbd, bucket)", _STUB)

# a form's save callback may return false to keep the drawer open (used by the CBD forms to show a validation message)
rep("    if(this._onSave) this._onSave();\n    this.close();", "    if(this._onSave && this._onSave()===false) return;\n    this.close();")

# the CBD screen, drawers and upload
_ph = s.index("   PRICE HISTORY  (versioned, never overwritten)"); _end = s.rfind("/* ====", 0, _ph)
_endm = s[_end:_ph+12]
cut("function buildCbdTree(){", "function afterCbdChange(cbd, action){", open(os.path.join(HERE, "cbd_e6", "cbd_view.js"), encoding="utf-8").read() + chr(10))
cut("function afterCbdChange(cbd, action){", _endm, open(os.path.join(HERE, "cbd_e6", "cbd_forms.js"), encoding="utf-8").read())
