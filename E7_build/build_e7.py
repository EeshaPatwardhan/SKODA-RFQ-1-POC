"""Builds D:\\SKODA\\RFQ 1\\SAVWIPL_prototype_E7.html from the E6 prototype + the forecasting-POC data layer.

    python make_poc_data.py      # (re)export the POC artefacts -> poc_data.json   (only when the POC changes)
    python build_e7.py           # E6 html + poc_data.json + src/*  ->  SAVWIPL_prototype_E7.html

Every patch asserts that the text it replaces exists exactly once, so a drift in the E6 source fails loudly.
"""
import os, re, sys, json
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_HTML = os.path.join(ROOT, "SAVWIPL_prototype_E6.html")
OUT_HTML = os.path.join(ROOT, "SAVWIPL_prototype_E7.html")
rd = lambda *p: open(os.path.join(HERE, *p), encoding="utf-8").read()

s = open(SRC_HTML, encoding="utf-8").read()
log = []

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f"expected {count} match(es), found {n}: {old[:90]!r}"
    s = s.replace(old, new)

def cut(start, end, new, end_inclusive=False):
    """replace s[start .. end) (or through end) by `new`; markers must be unique"""
    global s
    assert s.count(start) == 1, f"start marker not unique ({s.count(start)}): {start[:80]!r}"
    a = s.index(start)
    assert s.count(end, a) >= 1, f"end marker missing: {end[:80]!r}"
    b = s.index(end, a) + (len(end) if end_inclusive else 0)
    s = s[:a] + new + s[b:]

# ----------------------------------------------------------------------------- labels
rep("SAVWIPL Procurement Digitalisation — E6</title>", "SAVWIPL Procurement Digitalisation — E7</title>")
rep('" · SKODA AIS — E6"', '" · SKODA AIS — E7"')
rep("DESIGN SYSTEM (E6)", "DESIGN SYSTEM (E7)")

# Home: no Data Freshness Snapshot / Across the platform panels
rep("  if(home){\n    // ---- data freshness + platform snapshot (from the original Home)", "  if(false){   // removed from Home\n    // ---- data freshness + platform snapshot (from the original Home)")

# vocabulary: project, not programme (E6 left two programme labels in the import / seed code)
rep('name:r.project+" programme"', 'name:r.project+" project"')

# ----------------------------------------------------------------------------- embedded POC data + libraries (before the main script)
poc_json = open(os.path.join(HERE, "poc_data.json"), encoding="utf-8").read()
poc_json = poc_json.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
libs = "\n".join([rd("src", "poc_core.js"), rd("src", "e7_seed.js"), rd("src", "poc_charts.js")])
MAIN_MARK = "<script>\n/* =============================================================\n   SAVWIPL PROTOTYPE — GLOBAL BUILD"
# the POC's Report-mode sample files (a scripted demo in the POC too), embedded so the Radar panel's download works offline
import base64
rep_dir = os.path.join(ROOT, "SKODA AIS APP", "SKODA-forecasting-POC", "dashboard", "public", "reports")
rep_json = {}
for k, fn in {"ppt": "Auto_Parts_Price_Outlook.pptx", "doc": "Auto_Parts_Price_Outlook.docx"}.items():
    fp = os.path.join(rep_dir, fn)
    if os.path.exists(fp): rep_json[k] = base64.b64encode(open(fp, "rb").read()).decode("ascii")
    else: log.append("report sample missing, Report-mode download disabled: " + fn)
reports_tag = '<script id="rc-reports" type="application/json">' + json.dumps(rep_json) + "</script>\n"
rep(MAIN_MARK, reports_tag + '<script id="poc-json" type="application/json">' + poc_json + "</script>\n<script>\n" + libs + "\n</script>\n" + MAIN_MARK)

# ----------------------------------------------------------------------------- masters: DATA literal
cut("  projects: [\n    {id:\"P1\"", "  srmAssignments: 18,",
    "  projects: PocSeed.projects(),   // E7: the 6 POC programmes\n  parts: [],                       // seeded below from the POC part panel\n"
    "  suppliers: PocSeed.suppliers(), // E7: the 20 POC vendors\n  changes: PocSeed.changes(),\n")
cut("  freshness: [\n", "};\n\n// Seed 30 parts across projects", "  freshness: PocSeed.freshness(),\n")
cut("// Seed 30 parts across projects", "// Seed tasks routed across roles", "// E7: all 480 POC parts (heroes first)\nDATA.parts = PocSeed.parts();\n\n")
cut("// Seed tasks routed across roles", "/* ---------------------------------------------------------\n   2b. MASTER DATA EXTENSIONS",
    "DATA.tasks = PocSeed.tasks();\n\n")
cut("// enrich existing projects/parts/suppliers with lastUpdated + attributes", "DATA.commodities = [", "")
cut("DATA.commodities = [", "/* ---------------------------------------------------------\n   2c. STORE",
    "DATA.commodities = PocSeed.commodities();\nDATA.fx = PocSeed.fx();\nDATA.milestones = PocSeed.milestones();\nDATA.carVolumes = PocSeed.carVolumes();\nDATA.eklTargets = PocSeed.eklTargets();\n\n")

# ----------------------------------------------------------------------------- E2: cost breakdown seeds (heroes)
cut("(function seedE2(){", "/* =============================================================\n   IMPORT SOURCING REPORT",
r'''(function seedE2(){
  // E7: cost breakdowns, price versions and tooling for the hero parts, anchored to the POC part panel
  DATA.parts.slice(0,8).forEach((dp,i)=>{
    const p = dp.poc, sp = PocSeed.cbdSpec(p,i);
    const cbd = {part:dp.designation, partNumber:dp.number, project:dp.project, currency:"INR", qtyPerCar:sp.qtyPerCar, weights:sp.weights,
      importContent:sp.importContent, vsiOriginal:sp.vsiOriginal, targetOriginal:sp.targetOriginal, dd:sp.dd, lastUpdated:TODAY};
    const known = rawMaterialValue(cbd) + importValue(cbd);
    const rest = Math.max(p.cur*0.06, p.cur*0.985 - known);      // the CBD lands ~1.5% under the current piece price
    const q = v=>Math.round(v*100)/100;
    cbd.tree = [
      {id:"N"+i+"1", derived:false, level:1, name:"Machining & finishing", cost:q(rest*.55)},
      {id:"N"+i+"2", derived:false, level:1, name:"Fasteners & consumables", cost:q(rest*.25)},
      {id:"N"+i+"3", derived:false, level:2, name:"Surface treatment", cost:q(rest*.20)},
    ];
    syncDerivedNodes(cbd);
    DATA.cbds[dp.number] = cbd;
    const vers = PocSeed.priceVersions(p).map(v=>({price:v.price, vsi:cbd.vsiOriginal, target:cbd.targetOriginal, effectiveFrom:v.effectiveFrom, source:v.source, changeReq:v.changeReq}));
    vers.push({price:Math.round(cbdPartCost(cbd)), vsi:cbd.vsiOriginal, target:cbd.targetOriginal, effectiveFrom:"2026-07-01", source:"CBD recalculation", changeReq:null});
    DATA.priceVersions[dp.number] = vers;
    DATA.investments[dp.number] = {part:dp.designation, partNumber:dp.number, project:dp.project, capex:sp.capex, amortPerCar:sp.dd.amortPerCar, volume:sp.dd.volume,
      toolingRef:"SRM-TL-"+(1021+i*11), supplier:dp.supplier, status:["Ordered","Trial","Approved"][i%3], lastUpdated:TODAY};
  });
})();

''')
# a blank CBD for any other POC part is derived from the POC part (weights from part weight, import from vendor dependency)
cut("function ensureCbd(partNumber){", "function buildCbdTree(){",
r'''function ensureCbd(partNumber){
  if(DATA.cbds[partNumber]) return DATA.cbds[partNumber];
  const part = partByNumber(partNumber);
  const cbd = {
    part:part?part.designation:partNumber, partNumber, project:part?.project||"", currency:"INR", qtyPerCar:1,
    weights:{steel:{grade:"",supplier:part?.supplier||"",gross:0,net:0},aluminium:{gross:0,net:0},
      copper:{gross:0,net:0},lead:{gross:0,net:0},precious:{gross:0,net:0}},
    importContent:{value:0,fxRate:PocSeed.eur(),currency:"EUR",origin:"India"},
    vsiOriginal:0, targetOriginal:0, dd:{amortPerCar:0,volume:0}, tree:[], lastUpdated:TODAY,
  };
  if(part && part.poc){            // E7: pre-fill from the POC part (weight, vendor import dependency, nomination price)
    const sp = PocSeed.cbdSpec(part.poc, 0);
    cbd.weights = sp.weights; cbd.importContent = sp.importContent; cbd.vsiOriginal = sp.vsiOriginal; cbd.targetOriginal = sp.targetOriginal; cbd.dd = sp.dd;
  }
  syncDerivedNodes(cbd);
  DATA.cbds[partNumber]=cbd;
  return cbd;
}

''')

# ----------------------------------------------------------------------------- E2 sourcing import sample (create/update/error rows on POC masters)
s = s.replace("VW216/2IN", "TGN").replace("SK216/2IN", "KUS").replace("AU214/1IN", "KDQ").replace("VW220/3IN", "KYL")
s = s.replace('model:"VW216"', 'model:"TGN"').replace('model:"SK216"', 'model:"KUS"').replace('model:"AU214"', 'model:"KDQ"')
rep('supplierDuns:"430011223", supplierName:"Precision Metals Pvt Ltd", country:"India", place:"Pune", plant:"05",',
    'supplierDuns:DATA.suppliers.find(x=>x.name===DATA.parts[0].supplier).duns, supplierName:DATA.parts[0].supplier, country:"India", place:"Pune", plant:"05",')
rep('quota:70, decisionDate:"2026-02-23", sopDate:"2026-03-23", aPrice:5.42, currency:"INR", commodity:DATA.parts[0].commodity}',
    'quota:70, decisionDate:"2026-02-23", sopDate:"2026-03-23", aPrice:Math.round(DATA.parts[0].poc.cur), currency:"INR", commodity:DATA.parts[0].commodity}')
# the new-part rows of the import: prices in the POC range for their category
rep('partDesignation:"FRONT CAMERA"', 'partDesignation:"FRONT CAMERA"')  # keep
for old, new in [("aPrice:96.08, currency:\"INR\", commodity:\"Polymer\"", "aPrice:1840, currency:\"INR\", commodity:\"Polymer\""),
                 ("aPrice:96.08, currency:\"INR\", commodity:\"Steel\"", "aPrice:2190, currency:\"INR\", commodity:\"Steel\""),
                 ("aPrice:24.87, currency:\"INR\", commodity:\"Aluminium\"", "aPrice:3410, currency:\"INR\", commodity:\"Aluminium\""),
                 ("aPrice:85.30, currency:\"INR\", commodity:\"Copper\"", "aPrice:4250, currency:\"INR\", commodity:\"Copper\"")]:
    rep(old, new)
# mass-upload samples
rep('{number:"8W0-900101",designation:"Grille-Panel-201",type:"Single part",project:"TGN",commodity:"Polymer",supplier:"EastPoly Moulders"}',
    '{number:"TGN-NEW-90101",designation:"Rear Parking Camera",type:"Single part",project:"TGN",commodity:"Electronics",supplier:"Bosch India"}')
rep('{number:"8W0-900102",designation:"Sill-Cover-202",type:"Assembly",project:"KUS",commodity:"Steel",supplier:"SteelCraft Forgings"}',
    '{number:"KUS-NEW-90102",designation:"Sill Reinforcement",type:"Assembly",project:"KUS",commodity:"Steel",supplier:"Bharat Forge"}')
rep('{number:"",designation:"Latch-Assembly-203",type:"Single part",project:"KDQ",commodity:"Steel",supplier:"Precision Metals Pvt Ltd",__error:"Part no. missing"}',
    '{number:"",designation:"Tailgate Latch Assembly",type:"Single part",project:"KDQ",commodity:"Steel",supplier:"JBM Auto",__error:"Part no. missing"}')
rep('{number:"8W0-900104",designation:"Roof-Rail-204",type:"Assembly",project:"TGN",commodity:"Aluminium",supplier:"Alutech Components"}',
    '{number:"TGN-NEW-90104",designation:"Roof Rail Assembly",type:"Assembly",project:"TGN",commodity:"Aluminium",supplier:"Mahle India"}')

# ----------------------------------------------------------------------------- E3 seeds
rep('subject:DATA.parts[1]?DATA.parts[1].designation:"Bumper-Beam-227", partNumber:DATA.parts[1]?DATA.parts[1].number:"", supplier:DATA.parts[1]?DATA.parts[1].supplier:"Alutech Components",\n     value:1225, newValue:1290,',
    'subject:DATA.parts[1].designation, partNumber:DATA.parts[1].number, supplier:DATA.parts[1].supplier,\n     value:Math.round(DATA.parts[1].poc.cur), newValue:Math.round(DATA.parts[1].poc.cur*1.045),')
rep('subject:"Re-source Wire-Harness-C3", partNumber:"", supplier:"Copperline Industries",',
    'subject:"Re-source "+DATA.parts[3].designation, partNumber:"", supplier:"Aptiv India",')
cut("(function seedPO(){", "function buildEbonPo(){",
r'''(function seedPO(){
  const src=DATA.parts.slice(0,4);
  src.forEach((p,i)=>DATA.ebonPOs.push({id:"PO"+(i+1), poNo:"4500"+(12000+i), part:p.designation, partNumber:p.number,
    supplier:p.supplier, qty:[1200,800,4000,600][i], price:Math.round(p.poc.cur*[1.0,1.0,0.99,1.01][i]*100)/100,
    status:["Open","Sent","Confirmed","Open"][i], lastUpdated:TODAY}));
})();

''')
rep('''      {poNo:"450012000",partNumber:DATA.parts[0].number,qty:1200,price:5.18},
      {poNo:"450012001",partNumber:DATA.parts[1].number,qty:800,price:93.40},
      {poNo:"450012004",partNumber:DATA.parts[2].number,qty:4000,price:24.10},
      {poNo:"",partNumber:DATA.parts[3].number,qty:600,price:82.00,__error:"PO no. missing \\u2014 required key"},''',
    '''      {poNo:"450012000",partNumber:DATA.parts[0].number,qty:1200,price:Math.round(DATA.parts[0].poc.cur*0.985)},
      {poNo:"450012001",partNumber:DATA.parts[1].number,qty:800,price:Math.round(DATA.parts[1].poc.cur*0.99)},
      {poNo:"450012004",partNumber:DATA.parts[2].number,qty:4000,price:Math.round(DATA.parts[2].poc.cur*0.98)},
      {poNo:"",partNumber:DATA.parts[3].number,qty:600,price:Math.round(DATA.parts[3].poc.cur*0.97),__error:"PO no. missing \\u2014 required key"},''')
rep('designation:"Imported ECU module", block:1420,', 'designation:"Imported ECU module", block:Math.round(6200/PocSeed.eur()*10)*10,')
rep('designation:"Imported sensor cluster", block:640,', 'designation:"Imported sensor cluster", block:Math.round(2900/PocSeed.eur()*10)*10,')
rep('Math.round(ip.block*91.4)', 'Math.round(ip.block*PocSeed.eur())')
rep('{id:"BM1", ref:"Ref A \\u2014 competitor bracket", commodity:"Steel", benchPrice:398, note:"External teardown"}',
    '{id:"BM1", ref:"Ref A \\u2014 competitor "+DATA.parts[0].designation.toLowerCase(), commodity:"Steel", benchPrice:Math.round(DATA.parts[0].poc.cur*0.93), note:"External teardown"}')
rep('{id:"BM2", ref:"Ref B \\u2014 sister plant beam", commodity:"Aluminium", benchPrice:1120, note:"Internal reference"}',
    '{id:"BM2", ref:"Ref B \\u2014 sister plant "+DATA.parts[1].designation.toLowerCase(), commodity:"Aluminium", benchPrice:Math.round(DATA.parts[1].poc.cur*0.97), note:"Internal reference"}')

# ----------------------------------------------------------------------------- E5 task / approval seeds
rep('"Steel HRC → ₹71.2/kg eff 01-Aug"', '"Steel HRC → ₹"+(Math.round(PocSeed.kgInr(PocCore.macro.steel[PocCore.NH-1],PocCore.NH-1)*103)/100)+"/kg eff 01-Aug"')

# ----------------------------------------------------------------------------- hero-name substitution inside string literals (context aware)
HERO_TOK = {"Bracket-Rear-114":"bracket","Bumper-Beam-227":"bumper","Seat-Frame-B2":"seat","Wire-Harness-C3":"harness","Fastener-Set-A":"fastener","Roof-Rail-142":"rail"}
OTHER_TOK = {"Precision Metals Pvt Ltd":'DATA.parts[0].supplier', "Copperline Industries":'"Aptiv India"', "Alutech Components":'"Mahle India"',
             "EastPoly Moulders":'"Lumax Industries"', "SteelCraft Forgings":'"Bharat Forge"'}

def string_ctx(line, pos):
    """which string delimiter encloses `pos` on this line: '"', "'", '`' or None"""
    state, i = None, 0
    while i < pos:
        c = line[i]
        if state is None:
            if c in "\"'`": state = c
        else:
            if c == "\\": i += 1
            elif c == state: state = None
        i += 1
    return state

def sub_line(line, tok, expr):
    out, start = "", 0
    while True:
        j = line.find(tok, start)
        if j < 0: break
        ctx = string_ctx(line, j)
        out += line[start:j]
        if ctx == '"': out += '"+' + expr + '+"'
        elif ctx == "'": out += "'+" + expr + "+'"
        elif ctx == "`": out += "${" + expr + "}"
        else: out += tok; log.append("hero token outside string: " + line.strip()[:100])
        start = j + len(tok)
    return out + line[start:]

lines = s.split("\n")
for k, ln in enumerate(lines):
    for tok, key in HERO_TOK.items():
        if tok in ln: ln = sub_line(ln, tok, "PocSeed.H." + key)
    for tok, expr in OTHER_TOK.items():
        if tok in ln: ln = sub_line(ln, tok, expr)
    lines[k] = ln
s = "\n".join(lines)


exec(compile(open(os.path.join(HERE, "patches_workflow.py"), encoding="utf-8").read(), "patches_workflow.py", "exec"))
exec(compile(open(os.path.join(HERE, "patches_approvals.py"), encoding="utf-8").read(), "patches_approvals.py", "exec"))
exec(compile(open(os.path.join(HERE, "patches_cbd.py"), encoding="utf-8").read(), "patches_cbd.py", "exec"))

# ----------------------------------------------------------------------------- modules (screens, radar, integration) appended before boot
E7_MODS = ["e7_screens.js", "e7_views_dash.js", "e7_views_material.js", "e7_views_analysis.js", "e7_admin.js", "e7_radar.js", "e7_chat.js", "e7_cbd_core.js", "e7_cbd.js", "e7_price.js", "e7_workflow.js", "e7_pickers.js", "e7_btn_icons.js", "e7_integration.js"]
E7_CSS = ["e7.css", "e7_poc.css", "e7_chat.css", "e7_cbd.css", "e7_ui.css"]
V8_MODS = ["v8_art.js", "v8_srm_data.js", "v8_srm_ops_data.js", "v8_charts.js", "v8_ftable.js", "v8_srm.js", "v8_srm_ops.js", "v8_proc.js", "v8_proc_detail.js", "v8_tc.js"]      # V8 = E7 + the SRM dashboards (inserted before e7_integration, which boots the app)
V8_CSS = ["v8_srm.css", "v8_tc.css", "v8_proc.css", "v8_srm_ui.css", "v8_srm_parts.css", "v8_proc_dash.css", "v8_proc_detail.css", "v8_art.css", "v8_srm_ops.css", "v8_tc_dash.css"]
V9_MODS = ["v9_brand.js"]      # V9 = V8 + brand moments (photographic sign-in and Home banner); photos come from assets/ (see make_hero_images.py)
V9_CSS = ["v9.css"]

def assemble(base, mods, csss, tag):
    out = base
    for name in mods:
        p = os.path.join(HERE, "src", name)
        if os.path.exists(p):
            block = "<script>\n/* ===== " + tag + " · " + name + " ===== */\n" + open(p, encoding="utf-8").read() + "\n</script>\n"
            out = out.replace("</body>", block + "</body>", 1)
    for css_name in csss:
        css_p = os.path.join(HERE, "src", css_name)
        if os.path.exists(css_p):
            k = out.rfind("</style>")
            out = out[:k] + "\n/* ===== " + tag + " additions: " + css_name + " ===== */\n" + open(css_p, encoding="utf-8").read() + "\n" + out[k:]
    return out

OUT_V8 = os.path.join(ROOT, "SAVWIPL_prototype_V8.html")
e7 = assemble(s, E7_MODS, E7_CSS, "E7")
open(OUT_HTML, "w", encoding="utf-8").write(e7)
print("wrote", OUT_HTML, round(len(e7) / 1024), "KB")

i = E7_MODS.index("e7_integration.js")
v8 = assemble(s, E7_MODS[:i] + V8_MODS + E7_MODS[i:], E7_CSS + V8_CSS, "V8")
for old, new in [("SAVWIPL Procurement Digitalisation — E7</title>", "SAVWIPL Procurement Digitalisation — V8</title>"), ('" · SKODA AIS — E7"', '" · SKODA AIS — V8"'), ("DESIGN SYSTEM (E7)", "DESIGN SYSTEM (V8)")]:
    assert v8.count(old) == 1, ("V8 label not found once: " + old, v8.count(old))
    v8 = v8.replace(old, new)
# optional real photographs: assets/parts/<part-name>.jpg|png|webp and assets/cars/<PROJECT-CODE>.jpg|png|webp replace the drawn pictograms / silhouettes
import json as _json
_ph = {"parts": {}, "cars": {}, "credits": {}}
for _kind in ("parts", "cars"):
    _d = os.path.join(HERE, "assets", _kind)
    if os.path.isdir(_d):
        for _f in sorted(os.listdir(_d)):
            _n, _e = os.path.splitext(_f); _e = _e.lower().lstrip(".")
            if _e in ("jpg", "jpeg", "png", "webp"):
                _mime = "jpeg" if _e in ("jpg", "jpeg") else _e
                _ph[_kind][_n.upper() if _kind == "cars" else _n.lower()] = "data:image/" + _mime + ";base64," + base64.b64encode(open(os.path.join(_d, _f), "rb").read()).decode("ascii")
_cj = os.path.join(HERE, "assets", "cars", "credits.json")
if os.path.exists(_cj): _ph["credits"] = _json.load(open(_cj, encoding="utf-8"))
assert v8.count("/*V8_PHOTOS*/{parts:{},cars:{},credits:{}}") == 1
v8 = v8.replace("/*V8_PHOTOS*/{parts:{},cars:{},credits:{}}", _json.dumps(_ph))
print("photos embedded:", len(_ph["parts"]), "parts,", len(_ph["cars"]), "cars")
open(OUT_V8, "w", encoding="utf-8").write(v8)
print("wrote", OUT_V8, round(len(v8) / 1024), "KB")

# V9 is kept aside (frozen): it is only rebuilt on request —  python build_e7.py --v9
if "--v9" in sys.argv:
    OUT_V9 = os.path.join(ROOT, "SAVWIPL_prototype_V9.html")
    v9 = assemble(s, E7_MODS[:i] + V8_MODS + V9_MODS + E7_MODS[i:], E7_CSS + V8_CSS + V9_CSS, "V9")
    for old, new in [("SAVWIPL Procurement Digitalisation — E7</title>", "SAVWIPL Procurement Digitalisation — V9</title>"), ('" · SKODA AIS — E7"', '" · SKODA AIS — V9"'), ("DESIGN SYSTEM (E7)", "DESIGN SYSTEM (V9)")]:
        assert v9.count(old) == 1, ("V9 label not found once: " + old, v9.count(old))
        v9 = v9.replace(old, new)
    for ph, fn in {"__V9_LOGIN__": "login_hero.jpg", "__V9_HOME__": "home_hero.jpg"}.items():
        assert v9.count(ph) == 1, ("V9 image placeholder not found once: " + ph)
        v9 = v9.replace(ph, "data:image/jpeg;base64," + base64.b64encode(open(os.path.join(HERE, "assets", fn), "rb").read()).decode("ascii"))
    open(OUT_V9, "w", encoding="utf-8").write(v9)
    print("wrote", OUT_V9, round(len(v9) / 1024), "KB")
for l in log: print("NOTE:", l)
