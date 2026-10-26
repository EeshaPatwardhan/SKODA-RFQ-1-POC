# Procurement Dashboard — what each number and chart tells

Prototype: `SAVWIPL_prototype_V8.html` → Procurement → **Procurement Dashboard**.
Purpose: give management one screen on where procurement cost and procurement decisions stand **today**. It shows history and actuals only; what is expected next is on the **Forecast Dashboard** (Procurement → Forecast & risk).

Figures quoted below are what the prototype shows with all filters off (480 parts, 20 suppliers, 6 projects). They change when you filter.

## Filters (top of the page)
**Project**, **Vertical**, **Supplier**. They narrow the prices, supplier and cost-vs-target figures. “Decisions pending” is platform-wide and ignores them. Clicking a vertical or supplier row also sets the matching filter.

## The five headline numbers

| Number | What it tells | How it is calculated | Example |
|---|---|---|---|
| **Cost per vehicle** | What one vehicle's tracked bought-out parts cost today, and whether that is more than a year ago. | Piece price (June 2026) × quantity fitted per vehicle, summed over the parts in the selection; with several projects selected, the average car. The arrow compares it with the same figure 12 months earlier. | ₹7.4 L, ▲ 5.1% vs 12 months ago |
| **Since nomination** | How far prices have drifted from what was originally nominated. | Same cost per vehicle against the first month of the price history (July 2023, the nominated-price proxy). | +13.0% (₹6.5 L → ₹7.4 L) |
| **Cost vs target** | Whether parts are being bought above their cost target. | Average of (latest recorded price ÷ Target − 1) over the parts that have a cost breakdown and recorded price versions (8 parts). The line below counts parts more than 5% over target. | +19.4%, 7 of 8 parts over target |
| **Top-4 supplier share** | How concentrated the cost is. | Share of cost per vehicle held by the four largest suppliers; the largest is named. | 41%, largest Endurance Technologies 12% |
| **Decisions pending** | How many approvals are open and how many have escalated. | Approval workflows (change request, commodity price, technical change, milestone amendment) with an open step. "Escalated" = four or more reminders, or an overdue milestone. | 4 open, 2 escalated |

## Terms used on the page
The page carries these definitions itself (the collapsed “Terms used on this page” bar under the numbers, plus a one-line meaning under each number).

| Term | Meaning |
|---|---|
| **Project** | One vehicle line: Kushaq, Slavia, Kylaq, Taigun, Virtus or Kodiaq. |
| **Vertical** | A family of parts bought together: Powertrain, Electrical, Braking, Interior Trim and so on. |
| **Tracked parts** | The 480 bought-out parts the page adds up (about 80 per project). |
| **Piece price** | What one part costs today, in ₹, as bought from its supplier. |
| **Cost per vehicle** | The tracked parts of one car at today's piece prices (piece price × quantity per car); with several projects selected, the average car. |
| **Nomination price** | The price agreed at nomination; July 2023 stands in for it in this prototype. |
| **Cost target** | The price the plan expects for a part; only parts with a cost breakdown have one. |
| **Over target** | Today's piece price is above its cost target; more than 5% over counts as a problem. |
| **Share of cost** | A supplier's slice of the cost per vehicle. |

## The visuals

**Where prices rose** — price change by vertical over the last 12 months, ranked.
Three summary tiles first: what the 12 months added to one vehicle in ₹, the average rise, and the vertical that rose most. Each row then shows the vertical, a bar for its 12-month rise (darker = bigger; the dashed line marks the average of all verticals), the percentage and the ₹ it adds to one vehicle. Click a row to filter the whole page to that vertical.

**Largest suppliers** — who holds the cost per vehicle.
A concentration bar shows how much the four largest suppliers hold against everyone else. Below it the six largest suppliers are ranked with their share of cost, ₹ per vehicle, 12-month price change and a 12-month trend line. Click a row to filter the whole page to that supplier.

**Parts furthest over target** — the five priced parts with the biggest gap to target.
One bar per part: grey up to the target, red for the amount above it, a tick marking the target, then price, target and the gap as a percentage. Only parts with a cost breakdown and price versions can appear here. Clicking a row opens that part's Price History.

## What this dashboard deliberately leaves out
Forecast curves and risks (Forecast Dashboard), supplier readiness and tooling status (SRM dashboards), part-level cost walks (Material Cost Forecast), tooling investment (Investment screens), commodity and FX inputs (Commodity & FX screens), and approvals (Approvals; the “Decisions pending” number links there).

## Data basis and limits
- All money figures use **cost per vehicle** of the 480 tracked parts (piece price × quantity fitted per vehicle; for several projects, the average car). This is the same basis as the Forecast Dashboard, so the two reconcile. It replaces the earlier “basket price”, which only added up one piece price of every part.
- The tracked parts stand for each project's bought-out material cost (about ₹7 lakh per compact SUV, ₹5.5 L for the Kylaq, ₹9.6 L for the Kodiaq's local content). Individual piece prices are set from a reference price per part type (a horn assembly is a few hundred rupees, a turbocharger tens of thousands) and are illustrative.
- Price movements (history and forecast shapes) come from the forecasting POC's synthetic panel anchored on BLS indices and ECB exchange rates; the rupee level is the illustrative price model above. Treat the numbers as illustrative.
- In this data every part's price rose over the last 12 months, so no vertical or supplier shows a decrease.
- Cost vs target covers only 8 parts. It is a signal, not a portfolio-wide figure.


## Layout update (reference design)
The page now follows the reference layout: filter bar (Vehicle / Project is a single select — one project at a time; Vertical; Supplier; Reset filters), five KPI cards, then six panels: Cost per vehicle by vertical · Top parts by cost per vehicle · Supplier spend concentration · Parts with highest price increase · Cost vs target (top parts over target) · Pending procurement decisions. The numbers are the same ones described above; "Cost per vehicle" is now always for the selected project. Pending procurement decisions covers all projects (approvals are not project-specific). Program Phase and Time Period filters are not shown because the prototype has no such data.

## Drill-down dashboards (V8)

Three pages sit under Procurement → Procurement dashboard, next to the Overview: **Part Details**, **Supplier Details** and **Price Analysis**. Each has a "Back to Procurement Overview" button.

| From the overview | Opens |
|---|---|
| A part row in Top parts / Parts with highest price increase / Cost vs target | Part Details for that part |
| A supplier legend entry or donut segment | Supplier Details for that supplier |
| "Since nomination" KPI, "View all price movements", "View all parts over target" | Price Analysis (keeps the overview's vertical / supplier filter) |

The project filter is single-select and shared by all four pages. Opening a part switches the project to that part's project. A missing or invalid selection falls back to the project's top part or first supplier, with a notice.

All numbers reuse the overview's calculations, so the same part shows the same price and change everywhere. Where no data exists (target, cost breakdown, price versions, related decisions) the page shows "unavailable" instead of an invented value. Delivery and quality on Supplier Details are the SRM prototype scores and are labelled as such. Only history is shown; there are no forecasts.

Code: `E7_build/src/v8_proc_detail.js` and `v8_proc_detail.css`; actions `ppart`, `psup`, `pprice`, `pafilter`, `pdback`.

## Vehicle photo and part images (V8)

The overview shows a real picture of the selected project's vehicle next to the Vehicle / Project filter (hover for the photo credit). Kushaq, Taigun, Slavia, Virtus and Kylaq use the car images from the supplied Controlling PPT (page 7). The PPT has no Kodiaq, so that one is the image you supplied; the Taigun is mirrored so all six face the same way. Credits are in `E7_build/assets/IMAGE_CREDITS.md`.

Part images are not shown: Commons has no reliable, consistent photographs for the 82 part types, and the earlier drawn pictograms were removed. If you have photographs, drop them in as `E7_build/assets/parts/<part-name>.jpg` (for example `brake-disc.jpg`) and run `python build_e7.py`. They then appear beside the part name in the overview tables, the Supplier Details and Price Analysis tables, and in the Part Details header. A part with no photograph shows no image. Cars can be replaced the same way with `assets/cars/<CODE>.jpg`. Code: `src/v8_art.js`, `src/v8_art.css`.
