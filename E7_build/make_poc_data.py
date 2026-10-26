"""Exports the forecasting POC's shipped artefacts into ONE compact JSON that E7 embeds.

Reads (read-only):  <POC>/dashboard/api/_data/{dashboard.json, parts_prices.csv, forecasts.csv, exposure.json}
                    + the POC's own deterministic mediator generators (commodity / freight / GPR monthly series)
Writes:             E7_build/poc_data.json

Re-run after the POC pipeline is re-exported:   python make_poc_data.py [--poc "<path to SKODA-forecasting-POC>"]
"""
import argparse, csv, json, os, sys, collections
sys.stdout.reconfigure(encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("--poc", default=r"D:\SKODA\RFQ 1\SKODA AIS APP\SKODA-forecasting-POC")
args = ap.parse_args()
POC = args.poc
DATA = os.path.join(POC, "dashboard", "api", "_data")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "poc_data.json")

dash = json.load(open(os.path.join(DATA, "dashboard.json"), encoding="utf-8"))
exposure = json.load(open(os.path.join(DATA, "exposure.json"), encoding="utf-8"))

# ------------------------------------------------------------------ price panel
rows = list(csv.DictReader(open(os.path.join(DATA, "parts_prices.csv"), encoding="utf-8")))
months = sorted({r["month"][:7] for r in rows})
mi = {m: i for i, m in enumerate(months)}
progs, vends, cats = {}, {}, {}
parts = collections.OrderedDict()
macro = {m: {} for m in months}
for r in rows:
    m = r["month"][:7]
    if r["project_code"] not in progs:
        progs[r["project_code"]] = dict(code=r["project_code"], name=r["project"], oem=r["oem"], segment=r["segment"],
            volume=int(float(r["project_volume"])), localisation=float(r["project_localisation"]))
    if r["vendor_code"] not in vends:
        vends[r["vendor_code"]] = dict(code=r["vendor_code"], name=r["vendor"], origin=r["vendor_origin"],
            importDep=float(r["vendor_import_dependency"]), repriceMonths=int(float(r["vendor_reprice_months"])))
    if r["category_code"] not in cats:
        cats[r["category_code"]] = dict(code=r["category_code"], name=r["category"], material=r["material"])
    pid = r["part_id"]
    if pid not in parts:
        parts[pid] = dict(id=pid, name=r["part_name"], p=r["project_code"], v=r["vendor_code"], c=r["category_code"],
            tier=r["complexity_tier"], kg=round(float(r["weight_kg"]), 3), vol=int(float(r["annual_part_volume"])),
            an=(r["anomaly_type"] if r["is_anomaly_part"] == "True" else ""), h=[None] * len(months))
    parts[pid]["h"][mi[m]] = round(float(r["price"]), 2) if r["price"] != "" else None
    macro[m]["eurinr"] = round(float(r["fx_eurinr"]), 4)
    macro[m]["usdinr"] = round(float(r["fx_usdinr"]), 4)

# the raw panel has ~1% blank prices (the POC's preprocessing treats them as missing): fill by linear interpolation
gaps = 0
for p in parts.values():
    h = p["h"]
    for i, v in enumerate(h):
        if v is None:
            gaps += 1
            l = next((j for j in range(i - 1, -1, -1) if h[j] is not None), None)
            r_ = next((j for j in range(i + 1, len(h)) if h[j] is not None), None)
            if l is not None and r_ is not None:
                h[i] = round(h[l] + (h[r_] - h[l]) * (i - l) / (r_ - l), 2)
            else:
                h[i] = h[l] if l is not None else h[r_]
print("gaps interpolated:", gaps)
prog_list = list(progs.values()); prog_ix = {p["code"]: i for i, p in enumerate(prog_list)}
vend_list = list(vends.values()); vend_ix = {v["code"]: i for i, v in enumerate(vend_list)}
cat_list = list(cats.values()); cat_ix = {c["code"]: i for i, c in enumerate(cat_list)}

# ------------------------------------------------------------------ forecasts (best model)
best = dash["modelComparison"][0]["model"] if dash.get("modelComparison") else "xgboost"
fc = collections.defaultdict(dict)
fmonths = set()
for r in csv.DictReader(open(os.path.join(DATA, "forecasts.csv"), encoding="utf-8")):
    if r["model"] != best:
        continue
    m = r["target_month"][:7]; fmonths.add(m)
    fc[r["part_id"]][m] = (round(float(r["prediction"]), 2), round(float(r["lower"]), 2), round(float(r["upper"]), 2))
fmonths = sorted(fmonths)

# ------------------------------------------------------------------ cost-walk bridges per part (from dashboard materialCost)
mcparts = {p["partId"]: p for p in dash["materialCost"]["parts"]}
BR = ["fx", "commodity", "freight", "vendorReprice", "mix", "seasonality", "unexplained"]

# per-part confidence, reason and primary-material attribution from the POC's hierarchy tree
tree_part = {}
for pr in dash["tree"]:
    for v in pr["vendors"]:
        for c in v["categories"]:
            for tp in c["parts"]:
                tree_part[tp["partId"]] = tp
tips, tip_ix = [], {}
def tip_id(s):
    if s not in tip_ix:
        tip_ix[s] = len(tips); tips.append(s)
    return tip_ix[s]
DIR = {"up": "pushing the price up", "down": "pulling the price down"}
def evidence_ok(dr):
    ev = f"{dr['label']} is {DIR.get(dr['direction'], 'not moving the price')}. Source: " + ("checked against a live/cached feed" if dr["isReal"] else "from an offline backup series") + f" ({dr['source']})" + ("" if dr["isReal"] else " — verify before acting") + "."
    return ev == dr["evidence"]
ev_all_ok = all(evidence_ok(d) for tp in tree_part.values() for d in (tp.get("reason") or {}).get("drivers", []))
print("driver evidence reproducible from fields:", ev_all_ok)
causality = next((tp["reason"].get("causalityNote") for tp in tree_part.values() if tp.get("reason", {}).get("causalityNote")), "")

out_parts = []
for pid, p in parts.items():
    f = fc.get(pid, {})
    mc = mcparts.get(pid)
    rec = [pid, p["name"], prog_ix[p["p"]], vend_ix[p["v"]], cat_ix[p["c"]], p["tier"], p["kg"], p["vol"], p["an"], p["h"],
           [f[m][0] if m in f else None for m in fmonths],
           [f[m][1] if m in f else None for m in fmonths],
           [f[m][2] if m in f else None for m in fmonths]]
    if mc:
        rec.append([mc["bgPrice"], mc["sopPrice"], mc["fcPrice"]]
                   + [mc["bridgesNomToSop"].get(k, 0) for k in BR] + [mc["bridgesSopToFc"].get(k, 0) for k in BR])
    else:
        rec.append(None)
    tp = tree_part.get(pid)
    if tp:
        cf = tp["confidence"]; rs = tp.get("reason") or {}
        rec.append([cf["level"], cf["signalToErrorRatio"], cf["expectedErrorPct"]])
        rec.append([rs.get("summary", ""), rs.get("story", ""), tip_id(rs.get("tip", "")),
                    [[d["id"], d["label"], d["direction"], round(d["magnitude"], 4), d["source"], 1 if d["isReal"] else 0] + ([] if ev_all_ok else [d["evidence"]]) for d in rs.get("drivers", [])]] if rs.get("available") else None)
        m0 = (tp.get("materials") or [{}])[0]; mb = m0.get("bridges") or {}
        rec.append([m0.get("name", ""), mb.get("fx"), mb.get("commodity"), mb.get("freight"), mb.get("other")])
    else:
        rec += [None, None, None]
    out_parts.append(rec)

# ------------------------------------------------------------------ monthly macro / mediator series (POC's deterministic generators)
sys.path.insert(0, os.path.join(POC, "src"))
try:
    import pandas as pd
    from price_forecasting import geopolitical as G
    idx = pd.DatetimeIndex([m + "-01" for m in months])
    starts = [("steel", 700.0), ("aluminium", 2200.0), ("copper", 8500.0), ("energy", 80.0)]
    seed = dash["meta"]["randomSeed"]
    med = {name: G._offline_commodity(idx, name, st, seed + i) for i, (name, st) in enumerate(starts)}
    med["freight"] = G._offline_freight(idx, seed)
    series = {k: [round(float(v), 3) for v in s.values] for k, s in med.items()}
    # check against the POC's own provenance so we never silently diverge
    prov = {m["name"]: m for m in dash["geoAnalysis"]["provenance"]["mediators"]}
    checks = {}
    for k in ["steel", "aluminium", "copper", "freight"]:
        if k in prov:
            checks[k] = (abs(series[k][0] - prov[k]["first"]) < 0.01 and abs(series[k][-1] - prov[k]["last"]) < 0.01)
    print("mediator reproduction check:", checks)
    gpr_path = os.path.join(POC, "data", "raw", "gpr_export.xls")
    try:
        gp = G._parse_gpr_xls(open(gpr_path, "rb").read(), idx)
        series["gpr"] = [round(float(v), 2) for v in gp["overall"].values]
    except Exception as e:
        print("gpr parse skipped:", e)
except Exception as e:
    print("mediator series skipped:", e)
    series = {}

macro_series = {"months": months, "eurinr": [macro[m]["eurinr"] for m in months], "usdinr": [macro[m]["usdinr"] for m in months],
                "bls": [x["value"] for x in dash["macroSeries"]][: len(months)], "blsIsReal": [x.get("isReal", False) for x in dash["macroSeries"]][: len(months)],
                **series}

# ------------------------------------------------------------------ dashboard blocks (strip the heavy / duplicated bits)
mc = dash["materialCost"]
mc_slim = {k: v for k, v in mc.items() if k not in ("parts",)}
blocks = {k: dash[k] for k in ["meta", "provenance", "kpis", "categories", "horizon", "alerts", "insight", "modelComparison",
    "backtestSummary", "validation", "futureTest", "fxAnalysis", "geoAnalysis", "hierarchy", "riskConcentration",
    "dataSources", "parameterCatalogue", "priceSeries"]}
blocks["materialCost"] = mc_slim

blocks["meta"] = dict(blocks["meta"], gapsFilled=gaps)
for k in ("drift", "featureSelection"):
    if k in dash: blocks[k] = dash[k]
blocks["topPartIds"] = [x["partId"] for x in dash["topParts"]]
blocks["reasonTips"] = tips
blocks["reasonCausality"] = causality
blocks["reasonEvidenceDerived"] = ev_all_ok
data = dict(months=months, fMonths=fmonths, model=best, bridgeKeys=BR, programmes=prog_list, vendors=vend_list, catMaster=cat_list,
            parts=out_parts, macro=macro_series, exposure=exposure, **blocks)
txt = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
open(OUT, "w", encoding="utf-8").write(txt)
print("wrote", OUT, round(len(txt) / 1024), "KB;", len(out_parts), "parts;", len(months), "months;", len(fmonths), "forecast months; model", best)
