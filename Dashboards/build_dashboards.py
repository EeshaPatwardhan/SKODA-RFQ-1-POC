"""Generates illustrative management dashboard mock-ups (HTML) for the SAVWIPL procurement platform.
All numbers are ILLUSTRATIVE sample data - not real SAVWIPL figures.
Run:  python build_dashboards.py   then render with render.ps1 (headless Edge) to PNG.
"""
import math, os, sys

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1600, 960

DARK = "#0B3B2E"; GREEN = "#4BA82E"; TEAL = "#0E8C7F"; LIME = "#A7D86E"
GOOD = "#3E9B2F"; BAD = "#D64545"; WARN = "#E8A317"; GREY = "#7A8A86"
INK = "#1D2B27"; MUTED = "#63726E"; LINE = "#DCE5E1"; BG = "#EEF3F1"
PAL = ["#0B3B2E", "#0E8C7F", "#4BA82E", "#A7D86E", "#2F6DB5", "#E8A317", "#9AA7A3"]

CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:{W}px;height:{H}px;background:{BG};font-family:'Segoe UI',Arial,sans-serif;color:{INK};overflow:hidden}}
.top{{background:{DARK};color:#fff;height:78px;padding:12px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid {GREEN}}}
.top h1{{font-size:25px;font-weight:600;letter-spacing:.2px}}
.top .sub{{font-size:13px;color:#BFD8CF;margin-top:3px}}
.chips{{display:flex;gap:8px}}
.chip{{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:5px 12px;font-size:12px}}
.chip b{{color:{LIME};font-weight:600}}
.view{{background:{GREEN};color:#fff;border-radius:14px;padding:5px 12px;font-size:12px;font-weight:600}}
.body{{padding:14px 22px 0 22px;height:{H-78-30}px}}
.grid{{display:grid;gap:12px;height:100%}}
.card{{background:#fff;border-radius:8px;border:1px solid {LINE};padding:10px 14px;overflow:hidden;display:flex;flex-direction:column;min-height:0}}
.card h3{{font-size:13px;font-weight:600;color:{DARK};margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}}
.card h3 small{{font-weight:400;color:{MUTED};font-size:11px}}
.kpi{{justify-content:center}}
.kpi .l{{font-size:11.5px;color:{MUTED};text-transform:uppercase;letter-spacing:.5px}}
.kpi .v{{font-size:30px;font-weight:700;color:{DARK};margin:2px 0}}
.kpi .d{{font-size:12px;font-weight:600}}
.good{{color:{GOOD}}} .bad{{color:{BAD}}} .warn{{color:{WARN}}}
.foot{{height:30px;font-size:11px;color:{MUTED};padding:6px 24px;display:flex;justify-content:space-between}}
table{{border-collapse:collapse;width:100%;font-size:12px}}
th{{background:{DARK};color:#fff;font-weight:600;padding:5px 7px;text-align:left;font-size:11.5px}}
td{{padding:5px 7px;border-bottom:1px solid {LINE}}}
td.n,th.n{{text-align:right}}
table.tall td{{padding:11px 8px;font-size:13px}}
table.tall th{{padding:8px;font-size:12px}}
.pill{{display:inline-block;border-radius:10px;padding:1px 9px;font-size:11px;font-weight:600;color:#fff}}
.leg{{display:flex;gap:12px;font-size:11px;color:{MUTED};margin-top:4px;flex-wrap:wrap}}
.leg i{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}}
.bar{{height:9px;background:{LINE};border-radius:5px;overflow:hidden}}
.bar span{{display:block;height:100%}}
"""


def page(title, subtitle, view, chips, body_html, fname):
    chips_html = "".join(f'<div class="chip">{k}: <b>{v}</b></div>' for k, v in chips)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><style>{CSS}</style></head><body>
<div class="top"><div><h1>{title}</h1><div class="sub">{subtitle}</div></div>
<div class="chips">{chips_html}<div class="view">{view}</div></div></div>
<div class="body">{body_html}</div>
<div class="foot"><span>Škoda Auto Volkswagen India · Procurement Transformation with AI · Dashboard concept</span>
<span>ILLUSTRATIVE SAMPLE DATA – for design discussion only</span></div></body></html>"""
    with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
        f.write(html)


# ---------- components ----------
def kpi(label, value, delta, cls="good"):
    return f'<div class="card kpi"><div class="l">{label}</div><div class="v">{value}</div><div class="d {cls}">{delta}</div></div>'


def card(title, inner, note="", style=""):
    return f'<div class="card" style="{style}"><h3>{title}<small>{note}</small></h3>{inner}</div>'


def legend(items):
    return '<div class="leg">' + "".join(f'<span><i style="background:{c}"></i>{n}</span>' for n, c in items) + "</div>"


def svg(w, h, inner):
    return f'<svg width="100%" height="100%" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" font-family="Segoe UI,Arial" font-size="11">{inner}</svg>'


def nice(v):
    return f"{v:,.0f}" if abs(v) >= 100 else (f"{v:,.1f}" if abs(v) >= 10 else f"{v:,.2f}")


def line_chart(labels, series, w=520, h=230, ymin=None, ymax=None, band=None, marks=None, fmt=nice, area=False):
    l, r, t, b = 46, 14, 10, 26
    allv = [v for s in series for v in s[2] if v is not None]
    lo = ymin if ymin is not None else min(allv)
    hi = ymax if ymax is not None else max(allv)
    n = len(labels)
    X = lambda i: l + (w - l - r) * i / (n - 1)
    Y = lambda v: t + (h - t - b) * (1 - (v - lo) / (hi - lo))
    out = []
    for k in range(5):
        v = lo + (hi - lo) * k / 4
        out.append(f'<line x1="{l}" x2="{w-r}" y1="{Y(v)}" y2="{Y(v)}" stroke="{LINE}"/><text x="{l-6}" y="{Y(v)+4}" text-anchor="end" fill="{MUTED}">{fmt(v)}</text>')
    for i, lab in enumerate(labels):
        out.append(f'<text x="{X(i)}" y="{h-8}" text-anchor="middle" fill="{MUTED}">{lab}</text>')
    if band:
        up = " ".join(f"{X(i)},{Y(v)}" for i, v in enumerate(band[0]) if v is not None)
        dn = " ".join(f"{X(i)},{Y(v)}" for i, v in reversed(list(enumerate(band[1]))) if v is not None)
        out.append(f'<polygon points="{up} {dn}" fill="{band[2]}" opacity=".18"/>')
    for name, col, vals, *dash in series:
        pts = [(X(i), Y(v)) for i, v in enumerate(vals) if v is not None]
        d = " ".join(f"{x},{y}" for x, y in pts)
        da = ' stroke-dasharray="6 4"' if dash and dash[0] else ""
        if area:
            out.append(f'<polygon points="{pts[0][0]},{Y(lo)} {d} {pts[-1][0]},{Y(lo)}" fill="{col}" opacity=".12"/>')
        out.append(f'<polyline points="{d}" fill="none" stroke="{col}" stroke-width="2.4"{da}/>')
        for x, y in pts:
            out.append(f'<circle cx="{x}" cy="{y}" r="3" fill="{col}"/>')
    if marks:
        for i, v, txt, col in marks:
            out.append(f'<circle cx="{X(i)}" cy="{Y(v)}" r="6" fill="#fff" stroke="{col}" stroke-width="2.5"/><text x="{X(i)}" y="{Y(v)-11}" text-anchor="middle" font-weight="600" fill="{col}">{txt}</text>')
    return svg(w, h, "".join(out))


def vbars(labels, series, w=520, h=230, ymax=None, stacked=False, fmt=nice, colors=None, vals=True):
    l, r, t, b = 46, 10, 14, 30
    n = len(labels)
    if stacked:
        tot = [sum(s[1][i] for s in series) for i in range(n)]
        hi = ymax or max(tot) * 1.12
    else:
        hi = ymax or max(v for s in series for v in s[1]) * 1.15
    Y = lambda v: t + (h - t - b) * (1 - v / hi)
    out = []
    for k in range(5):
        v = hi * k / 4
        out.append(f'<line x1="{l}" x2="{w-r}" y1="{Y(v)}" y2="{Y(v)}" stroke="{LINE}"/><text x="{l-6}" y="{Y(v)+4}" text-anchor="end" fill="{MUTED}">{fmt(v)}</text>')
    gw = (w - l - r) / n
    for i, lab in enumerate(labels):
        gx = l + gw * i
        out.append(f'<text x="{gx+gw/2}" y="{h-12}" text-anchor="middle" fill="{MUTED}">{lab}</text>')
        if stacked:
            base = 0
            for si, (nm, vs, col) in enumerate(series):
                y1, y0 = Y(base + vs[i]), Y(base)
                out.append(f'<rect x="{gx+gw*0.2}" y="{y1}" width="{gw*0.6}" height="{y0-y1}" fill="{col}"/>')
                base += vs[i]
            if vals:
                out.append(f'<text x="{gx+gw/2}" y="{Y(base)-4}" text-anchor="middle" font-weight="600" fill="{INK}">{fmt(base)}</text>')
        else:
            m = len(series)
            bw = gw * 0.78 / m
            for si, (nm, vs, col) in enumerate(series):
                x = gx + gw * 0.11 + bw * si
                out.append(f'<rect x="{x}" y="{Y(vs[i])}" width="{bw-2}" height="{Y(0)-Y(vs[i])}" fill="{col}" rx="2"/>')
                if vals:
                    out.append(f'<text x="{x+(bw-2)/2}" y="{Y(vs[i])-4}" text-anchor="middle" fill="{INK}" font-size="10">{fmt(vs[i])}</text>')
    return svg(w, h, "".join(out))


def hbars(items, w=520, h=230, vmax=None, fmt=nice, unit=""):
    l, r = 120, 50
    n = len(items)
    vmax = vmax or max(v for _, v, _ in items) * 1.05
    rh = h / n
    out = []
    for i, (lab, v, col) in enumerate(items):
        y = i * rh
        bw = (w - l - r) * v / vmax
        out.append(f'<text x="{l-8}" y="{y+rh/2+4}" text-anchor="end" fill="{INK}">{lab}</text>')
        out.append(f'<rect x="{l}" y="{y+rh*0.18}" width="{bw}" height="{rh*0.64}" fill="{col}" rx="3"/>')
        out.append(f'<text x="{l+bw+6}" y="{y+rh/2+4}" fill="{INK}" font-weight="600">{fmt(v)}{unit}</text>')
    return svg(w, h, "".join(out))


def donut(parts, w=260, h=230, center="", sub=""):
    cx, cy, R, r = w / 2, h / 2, min(w, h) / 2 - 8, min(w, h) / 2 - 38
    tot = sum(v for _, v, _ in parts)
    a = -math.pi / 2
    out = []
    for lab, v, col in parts:
        da = 2 * math.pi * v / tot
        x1, y1, x2, y2 = cx + R * math.cos(a), cy + R * math.sin(a), cx + R * math.cos(a + da), cy + R * math.sin(a + da)
        x3, y3, x4, y4 = cx + r * math.cos(a + da), cy + r * math.sin(a + da), cx + r * math.cos(a), cy + r * math.sin(a)
        big = 1 if da > math.pi else 0
        out.append(f'<path d="M{x1},{y1} A{R},{R} 0 {big} 1 {x2},{y2} L{x3},{y3} A{r},{r} 0 {big} 0 {x4},{y4} Z" fill="{col}" stroke="#fff" stroke-width="1.5"/>')
        if v / tot > 0.06:
            m = a + da / 2
            out.append(f'<text x="{cx+(R+r)/2*math.cos(m)}" y="{cy+(R+r)/2*math.sin(m)+4}" text-anchor="middle" fill="#fff" font-weight="600" font-size="11">{round(100*v/tot)}%</text>')
        a += da
    out.append(f'<text x="{cx}" y="{cy+2}" text-anchor="middle" font-size="24" font-weight="700" fill="{DARK}">{center}</text><text x="{cx}" y="{cy+20}" text-anchor="middle" fill="{MUTED}">{sub}</text>')
    return svg(w, h, "".join(out))


def waterfall(start_label, start, steps, end_label, w=760, h=270, base=None, top=None):
    l, r, t, b = 50, 12, 24, 34
    vals = [start]
    run = start
    for _, d in steps:
        run += d
        vals.append(run)
    lo = base if base is not None else min(vals) - (max(vals) - min(vals)) * 0.8
    hi = top if top is not None else max(vals) + (max(vals) - min(vals)) * 0.35
    Y = lambda v: t + (h - t - b) * (1 - (v - lo) / (hi - lo))
    n = len(steps) + 2
    gw = (w - l - r) / n
    out = []
    for k in range(5):
        v = lo + (hi - lo) * k / 4
        out.append(f'<line x1="{l}" x2="{w-r}" y1="{Y(v)}" y2="{Y(v)}" stroke="{LINE}"/><text x="{l-6}" y="{Y(v)+4}" text-anchor="end" fill="{MUTED}">{nice(v)}</text>')

    def col(i, label, v0, v1, c):
        x = l + gw * i + gw * 0.15
        top, bot = Y(max(v0, v1)), Y(min(v0, v1))
        out.append(f'<rect x="{x}" y="{top}" width="{gw*0.7}" height="{max(bot-top,2)}" fill="{c}" rx="2"/>')
        out.append(f'<text x="{x+gw*0.35}" y="{h-14}" text-anchor="middle" fill="{INK}" font-weight="500">{label}</text>')

    col(0, start_label, lo, start, GREY)
    out.append(f'<text x="{l+gw*0.5}" y="{Y(start)-5}" text-anchor="middle" font-weight="700">{nice(start)}</text>')
    run = start
    for i, (lab, d) in enumerate(steps, 1):
        nxt = run + d
        c = BAD if d > 0 else GOOD
        col(i, lab, run, nxt, c)
        ty = Y(max(run, nxt)) - 5
        out.append(f'<text x="{l+gw*(i+0.5)}" y="{ty}" text-anchor="middle" font-weight="600" fill="{c}">{"+" if d>0 else ""}{d:.1f}</text>')
        out.append(f'<line x1="{l+gw*i+gw*0.85}" x2="{l+gw*(i+1)+gw*0.15}" y1="{Y(nxt)}" y2="{Y(nxt)}" stroke="{GREY}" stroke-dasharray="3 3"/>')
        run = nxt
    col(n - 1, end_label, lo, run, GREY)
    out.append(f'<text x="{l+gw*(n-0.5)}" y="{Y(run)-5}" text-anchor="middle" font-weight="700">{nice(run)}</text>')
    return svg(w, h, "".join(out))


def rag(v):
    return {"G": GOOD, "A": WARN, "R": BAD}[v]


def heat(rows, cols, data, rowhdr=""):
    h = f'<table class="tall"><tr><th>{rowhdr}</th>' + "".join(f'<th style="text-align:center">{c}</th>' for c in cols) + "</tr>"
    for rname, vals in zip(rows, data):
        h += f"<tr><td><b>{rname}</b></td>" + "".join(
            f'<td style="text-align:center"><span style="display:inline-block;width:26px;height:16px;border-radius:3px;background:{rag(v)}"></span></td>' for v in vals) + "</tr>"
    return h + "</table>"


def aging(rows):
    out = '<div style="display:flex;flex-direction:column;justify-content:space-around;height:100%;padding:4px 0">'
    for lab, pct, n, c in rows:
        out += f'<div style="font-size:13px"><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>{lab}</span><b>{n}</b></div><div class="bar" style="height:14px"><span style="width:{pct}%;background:{c}"></span></div></div>'
    return out + "</div>"


def grid(cols, rows, areas_html, extra=""):
    return f'<div class="grid" style="grid-template-columns:{cols};grid-template-rows:{rows};{extra}">{areas_html}</div>'


def span(html, c="", r=""):
    st = (f"grid-column:{c};" if c else "") + (f"grid-row:{r};" if r else "")
    return html.replace('class="card', f'style="{st}" class="card', 1) if "style=" not in html.split(">")[0] else html.replace('style="', f'style="{st}', 1)


# ======================================================= 2. MATERIAL COST
def d2():
    k = "".join([
        kpi("Forecast 4+8", "€ 1,858 Mio", "Budget € 1,854 Mio", ""),
        kpi("Variance vs Budget", "+ € 4.0 Mio", "0.2% worse than BG", "bad"),
        kpi("EKL (annual price reduction)", "2.4 %", "▲ 0.4 pts vs BG 2.0%", "good"),
        kpi("Avg. material cost / car", "₹ 7.1 L", "▼ ₹ 3.2 K vs BG", "good"),
        kpi("Import content", "23 %", "▲ 1 pt vs BG", "warn"),
    ])
    wf = waterfall("Budget", 1854.2, [("Volume/Mix", -6.8), ("Ex Rate", 9.4), ("FMK", 14.2), ("PA/MY", -5.1), ("KVP/Oth", -11.6), ("P&C/FBU", 3.9)], "FC 4+8", w=760, h=265, base=1820, top=1880)
    pc = vbars(["Kushaq", "Slavia", "Taigun", "Virtus", "Kylaq"], [("Budget", [7.42, 7.88, 7.55, 8.02, 5.31], "#BFD8CF"), ("Forecast", [7.38, 7.93, 7.49, 8.07, 5.24], TEAL)], w=520, h=265, ymax=10, fmt=lambda v: f"{v:.2f}")
    sp = donut([("MQB Domestic", 58, TEAL), ("MQB Export", 18, DARK), ("P&C", 10, "#2F6DB5"), ("FBU", 6, LIME), ("A/S", 5, GREEN), ("Others", 3, GREY)], w=250, h=230, center="€ 1.86 Bn", sub="by segment")
    cu = donut([("INR", 70, DARK), ("EUR", 24, TEAL), ("CNY", 5, LIME), ("USD", 1, WARN)], w=250, h=230, center="70%", sub="INR share")
    rows = [("Kushaq", "−0.04", "−0.5%", GOOD), ("Slavia", "+0.05", "+0.6%", BAD), ("Taigun", "−0.06", "−0.8%", GOOD), ("Virtus", "+0.05", "+0.6%", BAD), ("Kylaq", "−0.07", "−1.3%", GOOD)]
    tb = "<table><tr><th>Model</th><th class='n'>Δ ₹ L / car</th><th class='n'>Δ %</th><th>Status</th></tr>" + "".join(
        f"<tr><td><b>{a}</b></td><td class='n'>{b}</td><td class='n'>{c}</td><td><span class='pill' style='background:{d}'>{'Better' if d==GOOD else 'Worse'}</span></td></tr>" for a, b, c, d in rows) + "</table>" + '<div style="margin-top:18px;border-left:4px solid #4BA82E;background:#F3F9EE;padding:10px 14px;font-size:13px;line-height:1.6"><b>AI insight:</b> Forecast is € 4.0 Mio above Budget, driven by FMK (+14.2) and exchange rate (+9.4), partly offset by KVP / cost-reduction projects (−11.6). Slavia and Virtus are the only models running above Budget per car.</div>'
    body = grid("repeat(5,1fr)", "100px 1fr 1fr", k +
                span(card("Material cost walk – FC 4+8 vs Budget", wf, "Mio €"), "1/4") +
                span(card("Material cost per car by model", pc + legend([("Budget", "#BFD8CF"), ("Forecast", TEAL)]), "₹ Lakh"), "4/6") +
                span(card("Distribution by segment", sp)) + span(card("Distribution by currency", cu)) + span(card("Deviation per car vs Budget", tb, "Procurement + Finance view"), "3/6"))
    page("Material Cost Dashboard", "Forecast vs Budget, per-car cost, segment & currency mix – one data source, two views", "Procurement + Finance",
         [("Forecast", "4+8 2026"), ("Level", "A-Price India"), ("Plant", "Pune")], body, "02_Material_Cost.html")


# ======================================================= 3. COMMODITY & FOREX
def d3():
    q = ["BG", "Q1", "Q2", "Q3", "Q4", "Q1'27"]
    steel = line_chart(q, [("Steel HRC", DARK, [100, 103, 108, 112, 115, 117])], w=344, h=430, ymin=90, ymax=130, band=([100, 103, 108, 114, 119, 123], [100, 103, 108, 110, 111, 111], GREEN), marks=[(4, 115, "+15%", BAD)])
    # trim extra element
    nonp = line_chart(q, [("Aluminium", TEAL, [100, 104, 106, 107, 109, 110]), ("Copper", "#2F6DB5", [100, 108, 110, 109, 111, 113]), ("Lead", GREY, [100, 99, 100, 101, 100, 101])], w=344, h=430, ymin=90, ymax=130)
    fx = line_chart(["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Q1'27"], [("EUR/INR actual", DARK, [89.6, 90.4, 91.2, None, None, None, None]), ("Forecast", GREEN, [None, None, 91.2, 92.0, 92.6, 93.1, 93.8], True)],
                    w=344, h=430, ymin=88, ymax=96, band=([None, None, 91.2, 93.0, 94.0, 95.0, 95.8], [None, None, 91.2, 91.0, 91.2, 91.3, 91.8], GREEN), fmt=lambda v: f"{v:.1f}")
    pm = line_chart(q, [("Palladium", "#2F6DB5", [100, 112, 106, 104, 105, 106]), ("Rhodium", BAD, [100, 130, 118, 116, 117, 118])], w=344, h=430, ymin=80, ymax=140)
    risk = """<table><tr><th>Commodity</th><th class="n">Exposure € Mio</th><th class="n">+10% price</th><th class="n">−10% price</th><th>Outlook</th></tr>
<tr><td>Steel + Rubber + Rare earth</td><td class="n">612</td><td class="n bad">+ 61.2</td><td class="n good">− 61.2</td><td><span class="pill" style="background:#D64545">▲ Rising</span></td></tr>
<tr><td>Aluminium</td><td class="n">188</td><td class="n bad">+ 18.8</td><td class="n good">− 18.8</td><td><span class="pill" style="background:#E8A317">► Stable</span></td></tr>
<tr><td>Copper</td><td class="n">96</td><td class="n bad">+ 9.6</td><td class="n good">− 9.6</td><td><span class="pill" style="background:#E8A317">► Stable</span></td></tr>
<tr><td>Precious metals (Pd, Rh)</td><td class="n">74</td><td class="n bad">+ 7.4</td><td class="n good">− 7.4</td><td><span class="pill" style="background:#3E9B2F">▼ Easing</span></td></tr>
<tr><td>Lithium / Cobalt / Nickel</td><td class="n">41</td><td class="n bad">+ 4.1</td><td class="n good">− 4.1</td><td><span class="pill" style="background:#E8A317">► Stable</span></td></tr></table>"""
    sav = """<div style="font-size:13px;line-height:1.55"><b style="color:#0B3B2E">Steel saving potential (AI estimate)</b>
<div style="font-size:30px;font-weight:700;color:#3E9B2F;margin:4px 0">€ 7.6 Mio / yr</div>
<div>• Switch 3 stamping parts to alternate grade: <b>€ 2.9 Mio</b></div><div>• Reduce gross-to-net weight (scrap) on 12 parts: <b>€ 2.4 Mio</b></div>
<div>• Renegotiate steel index clause with 4 suppliers: <b>€ 2.3 Mio</b></div></div>"""
    body = grid("repeat(4,1fr)", "1fr 290px",
                card("Steel price index with forecast band", steel + legend([("Forecast range", GREEN)]), "BG = 100") +
                card("Non-precious metals", nonp + legend([("Aluminium", TEAL), ("Copper", "#2F6DB5"), ("Lead", GREY)]), "BG = 100") +
                card("EUR/INR – actual & forecast", fx + legend([("Actual", DARK), ("Forecast + range", GREEN)]), "") +
                card("Precious metals", pm + legend([("Palladium", "#2F6DB5"), ("Rhodium", BAD)]), "BG = 100") +
                span(card("Commodity & forex risk exposure – sensitivity", risk, "€ Mio, FY 2026 forecast"), "1/4") +
                span(card("Cost-saving opportunity", sav), "4/5"))
    page("Commodity & Forex Risk Dashboard", "Price outlook, exposure and sensitivity – steel, aluminium, copper, precious metals, EUR/INR", "Procurement + Finance",
         [("Horizon", "Q4 2026 – Q1 2027"), ("Basis", "Forecast 4+8")], body, "03_Commodity_Forex_Risk.html")


# ======================================================= 4. INVESTMENT & TOOLING
def d4():
    k = "".join([
        kpi("Total investment (tooling + D&D)", "₹ 1,126 Cr", "Target ₹ 1,160 Cr", "good"),
        kpi("Variance vs target", "− ₹ 34 Cr", "2.9% under target", "good"),
        kpi("Amortisation per car", "₹ 11,400", "▲ ₹ 300 vs plan", "warn"),
        kpi("Projects over target", "2 of 9", "Kylaq, Next-Gen SUV", "bad"),
    ])
    proj = ["Kushaq", "Slavia", "Taigun", "Virtus", "Kylaq", "Next SUV", "Facelift"]
    stack = vbars(proj, [("Tooling", [210, 150, 120, 140, 165, 190, 60], DARK), ("Equipment", [60, 45, 40, 50, 55, 70, 20], TEAL), ("D&D / Dev.", [45, 30, 28, 32, 40, 55, 15], LIME)], w=620, h=260, ymax=360, fmt=lambda v: f"{v:.0f}", stacked=True)
    bench = hbars([("Kylaq", 1.18, BAD), ("Next-Gen SUV", 1.09, BAD), ("Slavia", 1.01, WARN), ("Virtus", 0.98, GOOD), ("Kushaq", 0.95, GOOD), ("Taigun", 0.93, GOOD), ("Facelift", 0.88, GOOD)], w=520, h=260, vmax=1.4, fmt=lambda v: f"{v:.2f}", unit="×")
    top = """<table><tr><th>Top tools above target</th><th>Supplier</th><th class="n">Target ₹ L</th><th class="n">Actual ₹ L</th><th class="n">Δ</th></tr>
<tr><td>Front bumper die set</td><td>Supplier A</td><td class="n">310</td><td class="n">372</td><td class="n bad">+20%</td></tr>
<tr><td>Door outer panel</td><td>Supplier B</td><td class="n">540</td><td class="n">602</td><td class="n bad">+11%</td></tr>
<tr><td>Tailgate inner</td><td>Supplier C</td><td class="n">280</td><td class="n">309</td><td class="n bad">+10%</td></tr>
<tr><td>Instrument panel mould</td><td>Supplier D</td><td class="n">420</td><td class="n">441</td><td class="n warn">+5%</td></tr>
<tr><td>Rear bumper die set</td><td>Supplier A</td><td class="n">295</td><td class="n">307</td><td class="n warn">+4%</td></tr>
<tr><td>Fender outer</td><td>Supplier E</td><td class="n">350</td><td class="n">361</td><td class="n warn">+3%</td></tr>
<tr><td>Centre console mould</td><td>Supplier F</td><td class="n">210</td><td class="n">214</td><td class="n warn">+2%</td></tr></table>""".replace("<table>", '<table class="tall">')
    trend = line_chart(["Nom.", "Q1", "Q2", "Q3", "Q4", "SOP"], [("Quoted", GREY, [100, 104, 106, 106, 105, 105]), ("Negotiated", GREEN, [100, 98, 96, 95, 95, 95])], w=520, h=230, ymin=90, ymax=110)
    body = grid("repeat(4,1fr)", "100px 1fr 1fr", k +
                span(card("Investment by project (₹ Cr)", stack + legend([("Tooling", DARK), ("Equipment", TEAL), ("D&D / Dev.", LIME)]), "stacked"), "1/3") +
                span(card("Investment benchmark index", bench, "1.00× = benchmark of comparable past projects"), "3/5") +
                span(card("Tool cost above target", top, "drill-down to part level"), "1/3") +
                span(card("Investment price movement – nomination to SOP", trend + legend([("Quoted", GREY), ("Negotiated", GREEN)]), "index, nomination = 100"), "3/5"))
    page("Investment Cost & Benchmarking", "Tooling, equipment and D&D cost against targets and against comparable projects", "Procurement + Finance",
         [("Scope", "All active projects"), ("Currency", "INR Cr")], body, "04_Investment_Benchmarking.html")


# ======================================================= 5. PRICE TRACKING
def d5():
    k = "".join([
        kpi("Parts tracked", "4,812", "across 9 projects", ""),
        kpi("Avg. price change since nomination", "− 2.1 %", "▼ better than −1.5% plan", "good"),
        kpi("Price increase requests (YTD)", "96", "63 approved · 14 pending", "warn"),
        kpi("PO price updated (annual)", "78 %", "Nov. reminder triggers", "warn"),
    ])
    part = line_chart(["Nom.", "SOP", "Y1", "Y1 Q3", "Y2", "Y2 Q3", "Y3"], [("Part price", DARK, [100, 99.2, 97.8, 98.9, 96.5, 96.9, 95.1])], w=620, h=250, ymin=90, ymax=106,
                      marks=[(3, 98.9, "Steel +1.1", BAD), (4, 96.5, "EKL −1.4", GOOD), (5, 96.9, "Aeko +0.4", WARN)], fmt=lambda v: f"{v:.0f}")
    save = hbars([("Steel parts", 41, GREEN), ("Plastics", 28, GREEN), ("Electrics / E/E", 22, GREEN), ("Aluminium", 18, GREEN), ("Rubber", 11, GREEN), ("Imports", 6, GREEN)], w=480, h=250, vmax=50, fmt=lambda v: f"{v:.0f}", unit=" Cr")
    buyer = vbars(["Buyer A", "Buyer B", "Buyer C", "Buyer D", "Buyer E"], [("Savings", [34, 29, 41, 25, 19], GREEN), ("Increases", [9, 14, 7, 11, 16], BAD)], w=520, h=230, fmt=lambda v: f"{v:.0f}")
    ch = donut([("Price ↓", 54, GOOD), ("Price ↑", 28, BAD), ("Supplier / share", 11, TEAL), ("Technical", 7, WARN)], w=250, h=230, center="96", sub="change requests")
    body = grid("repeat(4,1fr)", "100px 1fr 1fr", k +
                span(card("Price journey of a part – nomination to end of project", part + legend([("Price index (nomination = 100)", DARK)]), "event markers = approved changes"), "1/3") +
                span(card("Savings by commodity group (₹ Cr, YTD)", save), "3/5") +
                span(card("Savings vs increases by buyer", buyer + legend([("Savings ₹ Cr", GREEN), ("Increases ₹ Cr", BAD)]), "YTD"), "1/3") +
                span(card("Change requests by type", ch), "3/4") +
                card("Pending requests by age", aging([("0–2 days", 55, 8, GOOD), ("3–5 days", 30, 4, WARN), ("> 5 days", 15, 2, BAD)]), "14 pending"))
    page("Part Price & Savings Tracking", "Part price movement from nomination to end of project, savings and change requests", "Procurement View",
         [("Period", "YTD 2026"), ("Project", "All")], body, "05_Price_Tracking_Savings.html")


# ======================================================= 6. SRM TOOLING & READINESS
def d6():
    k = "".join([
        kpi("Parts monitored", "4,812", "across 6 active projects", ""),
        kpi("Overall readiness", "84 %", "▼ 3 pts vs last month", "warn"),
        kpi("Milestones due in 6 weeks", "212", "38 at risk · 11 overdue", "bad"),
        kpi("Tools completed", "71 %", "▲ 5 pts", "good"),
    ])
    cols = ["Eng.", "Quality", "Tooling", "Capacity", "Material", "Logistics", "Prod."]
    projs = ["Kushaq", "Slavia", "Taigun", "Virtus", "Kylaq", "Next SUV"]
    data = ["GGGGGGG", "GGAGGGG", "GGGGGAG", "GAGGGGG", "GARAAGA", "AAARAAR"]
    hm = heat(projs, cols, data, "Project")
    ms = ["B Release", "P-Frei", "VFF", "PVS", "0-Series", "PPAP", "SOP"]
    mst = vbars(ms, [("On time", [412, 380, 301, 250, 188, 140, 96], GOOD), ("At risk", [18, 31, 40, 38, 29, 21, 14], WARN), ("Late", [4, 9, 12, 14, 11, 8, 6], BAD)], w=700, h=260, stacked=True, fmt=lambda v: f"{v:.0f}")
    tool = hbars([("Supplier A", 96, GOOD), ("Supplier B", 88, GOOD), ("Supplier C", 74, WARN), ("Supplier D", 61, WARN), ("Supplier E", 42, BAD), ("Supplier F", 35, BAD)], w=480, h=260, vmax=110, fmt=lambda v: f"{v:.0f}", unit=" %")
    alerts = """<table><tr><th>Upcoming alerts</th><th>Part / tool</th><th>Owner</th><th class="n">Days</th></tr>
<tr><td><span class="pill" style="background:#D64545">Overdue</span></td><td>Bumper die – Kylaq</td><td>SRM-03</td><td class="n bad">−6</td></tr>
<tr><td><span class="pill" style="background:#E8A317">2 weeks</span></td><td>Door panel trial</td><td>SRM-01</td><td class="n">14</td></tr>
<tr><td><span class="pill" style="background:#E8A317">4 weeks</span></td><td>IP mould kick-off</td><td>SRM-05</td><td class="n">28</td></tr>
<tr><td><span class="pill" style="background:#0E8C7F">6 weeks</span></td><td>PPAP – wiring harness</td><td>SRM-02</td><td class="n">42</td></tr>
<tr><td><span class="pill" style="background:#D64545">Overdue</span></td><td>Tool trial – tailgate</td><td>SRM-03</td><td class="n bad">−3</td></tr>
<tr><td><span class="pill" style="background:#E8A317">4 weeks</span></td><td>P-Frei – headlamp</td><td>SRM-06</td><td class="n">30</td></tr></table>""".replace("<table>", '<table class="tall">')
    body = grid("repeat(4,1fr)", "100px 1fr 1fr", k +
                span(card("Readiness heat-map – project × dimension", hm + legend([("Ready", GOOD), ("At risk", WARN), ("Critical", BAD)]), "R / Y / G score"), "1/3") +
                span(card("Milestone status by gate", mst + legend([("On time", GOOD), ("At risk", WARN), ("Late", BAD)]), "number of parts"), "3/5") +
                span(card("Tool completion by supplier", tool, "% complete"), "1/3") +
                span(card("Alerts & escalations", alerts, "6W / 4W / 2W / overdue"), "3/5"))
    page("SRM – Tooling & Part Readiness", "Supplier readiness, tool progress and milestone tracking from B-Release to SOP", "SRM View",
         [("Projects", "6 active"), ("Updated", "Mon 06:00")], body, "06_SRM_Tooling_Readiness.html")


# ======================================================= 7. TECHNICAL CHANGE
def d7():
    k = "".join([
        kpi("Open changes", "37", "12 new this week", ""),
        kpi("Overdue supplier offers", "9", "> 5 days since sent", "bad"),
        kpi("Avg. cycle time", "28 days", "▼ 4 days vs last quarter", "good"),
        kpi("Net cost impact (approved)", "+ € 1.9 Mio", "Savings € 0.8 · Increases € 2.7", "bad"),
    ])
    fun = hbars([("Received", 52, TEAL), ("Validated", 47, TEAL), ("Supplier evaluation", 24, WARN), ("In approval", 13, WARN), ("Approved", 9, GOOD), ("Implemented (price/BOM)", 7, GOOD)], w=560, h=260, vmax=60, fmt=lambda v: f"{v:.0f}")
    typ = donut([("AEKO", 46, DARK), ("Running change", 22, TEAL), ("Model-year", 18, LIME), ("AWE / AeA", 9, WARN), ("Supplier proposal", 5, GREY)], w=250, h=230, center="52", sub="changes in 2026")
    cum = line_chart(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], [("Cumulative impact", DARK, [0.2, 0.5, 0.9, 1.3, 1.6, 1.9])], w=520, h=250, ymin=0, ymax=2.4, area=True, fmt=lambda v: f"{v:.1f}")
    tbl = """<table><tr><th>Change no.</th><th>Part group</th><th>Buyer</th><th>Stage</th><th class="n">Days open</th><th class="n">Impact € K</th></tr>
<tr><td>AEKO 2026-114</td><td>Bumper</td><td>Buyer A</td><td><span class="pill" style="background:#D64545">Offer late</span></td><td class="n bad">14</td><td class="n bad">+ 420</td></tr>
<tr><td>AEKO 2026-121</td><td>Wiring harness</td><td>Buyer C</td><td><span class="pill" style="background:#E8A317">In approval</span></td><td class="n">9</td><td class="n bad">+ 185</td></tr>
<tr><td>MY 2027-007</td><td>Trim</td><td>Buyer B</td><td><span class="pill" style="background:#0E8C7F">Evaluation</span></td><td class="n">6</td><td class="n good">− 60</td></tr>
<tr><td>RC 2026-033</td><td>Seat structure</td><td>Buyer D</td><td><span class="pill" style="background:#3E9B2F">Implemented</span></td><td class="n">3</td><td class="n good">− 25</td></tr>
<tr><td>AEKO 2026-098</td><td>Headlamp</td><td>Buyer E</td><td><span class="pill" style="background:#D64545">Offer late</span></td><td class="n bad">12</td><td class="n bad">+ 96</td></tr>
<tr><td>AWE 2026-017</td><td>Door trim</td><td>Buyer A</td><td><span class="pill" style="background:#E8A317">In approval</span></td><td class="n">8</td><td class="n bad">+ 54</td></tr></table>""".replace("<table>", '<table class="tall">')
    body = grid("repeat(4,1fr)", "100px 1fr 1fr", k +
                span(card("Change pipeline – from receipt to implementation", fun, "number of changes"), "1/3") +
                span(card("Change type split", typ), "3/4") +
                card("Open changes by age", aging([("≤ 10 days", 60, 22, GOOD), ("11–20 days", 25, 9, WARN), ("> 20 days", 15, 6, BAD)]), "37 open") +
                span(card("Open changes needing attention", tbl, "AEKO tracking · exportable"), "1/3") +
                span(card("Cumulative net cost impact (€ Mio)", cum), "3/5"))
    page("Technical Change (AEKO) Tracker", "Every design change from upload to price update – status, aging and cost impact", "Aeko Coordinator + Management",
         [("Period", "2026 YTD"), ("Scope", "All projects")], body, "07_Technical_Change.html")


# ======================================================= 8. WORKFLOW & DATA HEALTH
def d8():
    k = "".join([
        kpi("Users with open tasks", "46", "of 118 platform users", "warn"),
        kpi("Reminders sent this week", "212", "38 escalated to heads", "bad"),
        kpi("Avg. approval time", "3.2 days", "▼ 0.8 days vs Q2", "good"),
        kpi("Mass uploads (CBD) this month", "27", "all validated", "good"),
    ])
    cols = ["Qty/car", "Cost breakdown", "Steel/Alu wt.", "Import content", "VSI", "Target", "D&D cost"]
    b = ["Buyer A", "Buyer B", "Buyer C", "Buyer D", "Buyer E"]
    vals = [[98, 96, 92, 90, 95, 97, 94], [90, 82, 70, 75, 88, 90, 84], [99, 98, 97, 96, 99, 99, 98], [76, 60, 48, 55, 72, 80, 64], [94, 91, 86, 88, 93, 95, 90]]

    def cell(v):
        c = GOOD if v >= 90 else (WARN if v >= 70 else BAD)
        return f'<td style="text-align:center"><span class="pill" style="background:{c};min-width:44px">{v}%</span></td>'
    t = "<table class=\"tall\"><tr><th>Buyer</th>" + "".join(f'<th style="text-align:center">{c}</th>' for c in cols) + "</tr>" + "".join(
        f"<tr><td><b>{n}</b></td>" + "".join(cell(v) for v in row) + "</tr>" for n, row in zip(b, vals)) + "</table>"
    pend = hbars([("Commercial approval", 6, BAD), ("Commodity approval", 3, WARN), ("Finance approval", 3, WARN), ("Engineering / Quality", 2, GREEN), ("Management", 2, GREEN)], w=520, h=230, vmax=8, fmt=lambda v: f"{v:.0f}")
    trend = line_chart(["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"], [("Completeness", GREEN, [68, 72, 76, 80, 84, 87, 89, 91])], w=520, h=230, ymin=60, ymax=100, area=True, fmt=lambda v: f"{v:.0f}")
    body = grid("repeat(4,1fr)", "100px 1fr 1fr", k +
                span(card("Data completeness by buyer & required field", t + legend([("≥ 90%", GOOD), ("70–89%", WARN), ("< 70%", BAD)]), "Monday reminders until filled; escalation to head after 4 reminders"), "1/5") +
                span(card("Pending approvals by stage", pend, "count"), "1/3") +
                span(card("Overall data completeness trend", trend, "% of mandatory fields filled"), "3/5"))
    page("Workflow & Data Health", "Are users updating data on time? Where are approvals waiting? (drives the Monday reminders)", "Management + Admin",
         [("Week", "KW 41"), ("Users", "118")], body, "08_Workflow_Data_Health.html")


# ======================================================= 9. AI ASSISTANT
def d9():
    chart = line_chart(["2023", "2024", "2025", "2026", "2027 F"], [("Door panel (steel)", DARK, [100, 98.5, 97.4, 96.8, None]), ("Forecast", GREEN, [None, None, None, 96.8, 95.6], True)], w=520, h=210, ymin=92, ymax=104, fmt=lambda v: f"{v:.0f}")

    def msg(who, html, right=False):
        bg = DARK if right else "#fff"; fg = "#fff" if right else INK
        return f'<div style="display:flex;justify-content:{"flex-end" if right else "flex-start"};margin:10px 0"><div style="max-width:78%;background:{bg};color:{fg};border:1px solid {LINE};border-radius:12px;padding:10px 14px;font-size:13.5px;line-height:1.5">{html}</div></div>'
    chat = (msg("u", "How has the price of the Slavia front door outer panel moved since nomination, and how does it compare with Kushaq?", True) +
            msg("a", f'<b>Slavia door outer panel (P/N 5xx…)</b> is down <b style="color:#3E9B2F">3.2%</b> since nomination (₹ 412 → ₹ 399). Kushaq is down 2.6%. Main drivers: EKL −1.4%, steel index +1.1%, one Aeko +0.4%.<div style="height:210px;margin-top:6px">{chart}</div><div style="font-size:11px;color:#63726E">Source: price history, approved change requests #CR-2231, #CR-2307</div>') +
            msg("u", "What is our steel price risk for the next 2 quarters and what can we save?", True) +
            msg("a", "Steel exposure is <b>€ 612 Mio</b>; a +10% move adds <b style='color:#D64545'>€ 61 Mio</b>. Forecast: +6% by Q4. AI-identified savings potential: <b style='color:#3E9B2F'>€ 7.6 Mio / yr</b> (grade switch, scrap reduction, index clause). <u>Open commodity dashboard</u> · <u>Create PPT</u>") +
            msg("u", "Which tools are running late for Kylaq?", True) +
            msg("a", "<b>3 tools</b> are behind plan for Kylaq:<table style='margin-top:8px'><tr><th>Tool</th><th>Supplier</th><th>Planned</th><th>Forecast</th><th class='n'>Delay</th></tr><tr><td>Front bumper die</td><td>Supplier A</td><td>12 Oct</td><td>03 Nov</td><td class='n bad'>3 wks</td></tr><tr><td>Tailgate inner</td><td>Supplier C</td><td>20 Oct</td><td>31 Oct</td><td class='n warn'>11 d</td></tr><tr><td>IP mould</td><td>Supplier D</td><td>28 Oct</td><td>04 Nov</td><td class='n warn'>7 d</td></tr></table>"))
    side = """<div style="font-size:12.5px;line-height:1.9"><b style="color:#0B3B2E">Try asking</b>
<div>• Show tools running late for Kylaq</div><div>• Which suppliers have the highest price increases this year?</div>
<div>• Compare investment of Slavia vs Virtus</div><div>• Forecast EUR/INR for Q1 2027</div><div>• Open AEKO changes for Buyer C</div>
<div>• Create the monthly material-cost PPT</div></div>
<div style="margin-top:16px;font-size:12.5px;line-height:1.9"><b style="color:#0B3B2E">Outputs</b><div>✔ Text answer &nbsp;✔ Chart &nbsp;✔ Table</div><div>✔ Excel / PDF report</div><div>✔ PowerPoint from template or free-form</div><div>✔ Works on laptop, iPad &amp; mobile</div></div>"""
    inp = '<div style="margin-top:auto;border:1.5px solid #4BA82E;border-radius:22px;padding:9px 16px;color:#63726E;font-size:13px">Ask about prices, tooling, changes, commodities…</div>'
    body = grid("1fr 330px", "1fr", f'<div class="card" style="overflow:hidden"><h3>AI Assistant<small>answers in text + graphics, with sources</small></h3>{chat}{inp}</div>' + card("Capabilities", side))
    page("AI Assistant", "Ask in plain language – get answers, charts and reports on part price, material cost, tooling and changes", "All users",
         [("Access", "Laptop · iPad · Mobile"), ("Data", "Central database")], body, "09_AI_Assistant.html")


# fix d1 layout (3 rows: KPIs, charts, bottom)
def d1_fixed():
    k = "".join([
        kpi("Material cost FC 4+8", "€ 1,858 Mio", "▲ 4.0 Mio vs Budget (0.2%)", "bad"),
        kpi("Savings achieved YTD", "₹ 148 Cr", "▲ 12% vs plan ₹ 132 Cr", "good"),
        kpi("Tooling on track", "84 %", "▼ 3 pts vs last month", "warn"),
        kpi("Open technical changes", "37", "9 overdue > 5 days", "bad"),
        kpi("Pending approvals", "14", "Avg. wait 3.2 days", "warn"),
        kpi("Data completeness", "91 %", "▲ 4 pts since last Monday", "good"),
    ])
    wf = waterfall("Budget", 1854.2, [("Volume/Mix", -6.8), ("Ex Rate", 9.4), ("FMK", 14.2), ("PA/MY", -5.1), ("KVP/Oth", -11.6), ("P&C/FBU", 3.9)], "FC 4+8", w=760, h=265, base=1820, top=1880)
    sav = vbars(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], [("Plan", [18, 20, 22, 22, 24, 26], "#BFD8CF"), ("Actual", [20, 21, 25, 26, 27, 29], GREEN)], w=560, h=265, ymax=32, fmt=lambda v: f"{v:.0f}")
    rd = donut([("On track", 84, GOOD), ("At risk", 11, WARN), ("Delayed", 5, BAD)], w=250, h=240, center="84%", sub="parts ready")
    risks = """<table><tr><th>Top risks</th><th class="n">Impact</th><th>Owner</th></tr>
<tr><td>Steel price +6% from Q4</td><td class="n bad">€ 9.8 Mio</td><td>Lead Commodity</td></tr>
<tr><td>EUR/INR above 93.5</td><td class="n bad">€ 6.1 Mio</td><td>Controlling</td></tr>
<tr><td>Memory-chip price increase</td><td class="n bad">€ 4.4 Mio</td><td>Buyer E/E</td></tr>
<tr><td>Tool delay – Kylaq bumper</td><td class="n warn">3 weeks</td><td>SRM</td></tr>
<tr><td>AEKO 2026-114 offer late</td><td class="n warn">14 days</td><td>Buyer</td></tr></table>""".replace("<table>", '<table class="tall">')
    ap = hbars([("Commercial", 6, BAD), ("Commodity", 3, WARN), ("Finance", 3, WARN), ("Management", 2, GREEN)], w=420, h=220, vmax=8, fmt=lambda v: f"{v:.0f}")
    body = grid("repeat(6,1fr)", "100px 1fr 1fr", k +
                span(card("Material cost walk – Forecast vs Budget", wf, "Mio €, A-Price India, Pune"), "1/4") +
                span(card("Monthly savings – plan vs actual", sav + legend([("Plan", "#BFD8CF"), ("Actual", GREEN)]), "₹ Cr"), "4/7") +
                span(card("Part & tool readiness", rd), "1/3") +
                span(card("Top risks & opportunities", risks), "3/5") +
                span(card("Pending approvals by stage", ap, "count"), "5/7"))
    page("Management Control Tower", "One-page view of cost, savings, readiness, technical change and workflow health", "Management View",
         [("Year", "2026"), ("Forecast", "4+8"), ("Plant", "Pune")], body, "01_Executive_Control_Tower.html")


if __name__ == "__main__":
    for fn in (d1_fixed, d2, d3, d4, d5, d6, d7, d8, d9):
        fn()
    print("built", len([f for f in os.listdir(OUT) if f.endswith('.html')]), "html files")
