# E7 / V8 — SKODA AIS prototype with the forecasting POC (E7) and the SRM dashboards (V8)

> **Status: archive only (from 27 Oct 2026).** `SAVWIPL_prototype_V8.html` is now the **master** and is edited directly (it is what Vercel serves).
> This folder is kept as history and as the record of how V8 was assembled. **Do not run `build_e7.py`**: it regenerates V8 from `src/` and would erase every edit made in the HTML since (sidebar, chatbot, later work). The script now refuses to run unless you pass `--force`.
> `src/` no longer matches V8 exactly; read the HTML for the current behaviour. The notes below describe the original build workflow and the design decisions, which are still useful context.

`SAVWIPL_prototype_E7.html` (one file, opens by double-click) = the E6 prototype + the forecasting POC.
The POC is the **master data** for programmes, vendors, categories, parts, prices, FX and forecasts; every E6 workflow
(sourcing import, CBD, price history, commodity/FX approvals, change requests, POs, tasks, approvals, reports) runs on
those parts. Every POC dashboard view has a counterpart in E7 with the same data and the same charts, restyled for the
prototype. "Ask AIS" is the POC's **Radar** assistant, working on every screen.

## Prices, wording and which build to change (latest)

**Work in V8.** `python build_e7.py` rebuilds E7 and V8 from the shared `src/`; **V9 is kept aside** (`SAVWIPL_prototype_V9.html` is not rebuilt unless you run `python build_e7.py --v9`).

**Vocabulary (one word per thing, every screen):** *project* (not programme) · *vertical* (not category; Powertrain, Electrical, …) · *piece price* (one part) · *cost per vehicle* (tracked parts, see below; replaces “basket price”) · *annual spend* (cost × planned annual volume, used in the hierarchy). Source text is changed in `src/*.js`; the POC's own prose is converted when `PocCore` loads (`poc_core.js`, “prototype vocabulary”). Alert categories (conflict, tariff, …) are a different concept and keep the word.

**Price model (illustrative, in `poc_core.js`):** the POC panel's part prices are synthetic and not tied to part names. Each part is re-priced from `PRICE_REF[name] = [reference piece price ₹, quantity per vehicle]`, keeps its spread inside its vertical (0.8–1.3× of the vertical median) and every project is calibrated to `PROJECT_COST` (KUS 7.2 L, SLV 7.0 L, KYL 5.45 L, TGN 7.55 L, VRT 7.35 L, KDQ 9.6 L per vehicle). One factor per part multiplies its 36-month history, forecast, interval and bridges, so growth rates, forecast moves and rankings are exactly the POC's — only the rupee level changed. Rupee-valued model metrics (MAE/RMSE) are scaled with the average factor; MAPE is untouched. Check: annual spend on the tracked parts ≈ ₹14,700 Cr (`tests/test_core.js`).

**Cost per vehicle** = Σ piece price × quantity per vehicle over the parts in scope ÷ number of projects in scope (one project → that car; portfolio → the average car; vendor / vertical → its content in the average car). `PocCore.cost(list, fn)`, `rollup`, `riskConcentration`, `costWalk`, `meanTrack`, `impact` all use it; Forecast-dashboard KPIs, price series and vertical donut are rebuilt from the parts on load. FAQ entry “What is cost per vehicle…” (Admin → FAQ) explains it for the audience.

**SRM Overview (V8):** SRM now slices by the platform's ten **verticals** (it used to group them into five "part families"; filter, charts, tables and Ask-AIS answers all say vertical). Overview = KPIs · Milestone status by vertical (100% bars, not clickable) · Supplier readiness (stage flow with drop-offs) · Suppliers by readiness (suppliers need 5+ started parts to be ranked, same rule as the KPI and the insights) · AI insights (Ask-AIS button only) · Open actions (one row per part, status + priority together) · part drawer (summary cards, one highlighted next action, details, R/Y/G tiles, milestones). The Project timeline and Risk heat-map are no longer on the Overview (the timeline stays on Status Tracking). KPI cards that link somewhere no longer show a "View …" caption on hover (`e7_ui.css`). Styles: `src/v8_srm_ui.css`.

**SRM Overview layout (V8):** compact board — header with the "Illustrative data" chip and data-as-of date on the right, one-row filter strip (Project · Supplier · Brand · Vertical · SOP year, a subtle Reset at the end), six equal flat KPI cards (no icons or week-on-week chips; counts neutral, readiness / risk / actions coloured by the existing bands), then three rows of panels. "Milestone health by project" (car tile, 100 % stacked bar whose labels add up to 100, Delayed-share pill, parts), "Supplier readiness" (7 per page, 3 pages) and "Readiness by stage" follow the supplied references. "Top risks" and "Open actions" now keep the top 20 and page 5 at a time; "Key insights" pages 3 at a time (`ovPaginate()` in `src/v8_srm.js`; styles in `src/v8_srm_ui.css`). The footnote strip under the page was removed. Six KPI cards / three panels per row from 1200 px up; below that they wrap.

**All SRM screens share the Overview format (V8):** `page()` in `src/v8_srm.js` now builds the Procurement-style header (data-as-of + "Illustrative data" chip) and the five-filter bar for Overview, Part Readiness, Status Tracking, Supplier Performance, Part Assignment, Tool Readiness, Milestone Tracking, Readiness (R/Y/G) and Alerts & Escalations. Each screen has exactly five KPI cards in one row, built with `scard(icon,label,value,sub,{tone})` / `skpis(w,cards)` (also exported as `V8Srm.scard` / `V8Srm.skpis`). `kcard` / `kpiRow` are kept only for the Technical Change screens. The Tooling readiness panel now lives on Tool Readiness (`V8Srm.toolingBody`). Dropped cards: Part Readiness "Not started"; Status Tracking "Projects"; Supplier Performance "Delayed parts"; Part Assignment "Fakum / colour variants"; Tool Readiness "Trials in 60 days"; Milestone Tracking "Amendments approved"; R/Y/G "Parts assessed"; Alerts "Within 6 weeks".

**SRM Part Readiness (V8):** the Scope overview and Parts-by-vertical panels ignore the Vertical filter (project and supplier filters still apply); the Scope overview is a plain table (rows do not filter the page); the Supplier-readiness stage panel is not on this page (it stays on the Overview). "Parts by vertical" now shows *why* parts are in SRM scope (project facelift / model-year change / AEKO running change). "Tools by stage" counts **tools** (a part can need 1–4; it used to count parts), coloured against plan; the KPIs say "parts with tooling · tools". The At-risk parts table is `FTable` (`src/v8_ftable.js`): pagination (10/25/50) and a value filter on every column heading (options follow the other filters, search for long lists). The part drawer explains itself: why the status (the milestone that sets it, in days), stage vs plan, supplier scorecard, price outlook, how the R/Y/G score is built, past milestones shown as Met / Met late / Overdue. Styles: `src/v8_srm_parts.css`.

**Procurement Dashboard layout (V8):** rebuilt from the reference image (`src/v8_proc.js`, `src/v8_proc_dash.css`) on the existing data: header + data-as-of + "Illustrative data" chip · filter bar (Vehicle / Project is a single select with no "All" option, default Kushaq; Vertical; Supplier; Reset filters) · five KPI cards · six panels (Cost per vehicle by vertical — ignores the Vertical filter, click a row to filter the others; Top parts by cost per vehicle; Supplier spend concentration; Parts with highest price increase; Cost vs target — top parts over target; Pending procurement decisions, platform-wide). Panels run three across when the page area is 1180 px or wider, then two, then one. No new data: every figure is `PocCore.cost()` / price-version / approval records. Not in the reference's data: Program Phase and Time Period filters, and value / days-pending of a decision. "Spend above target" = Σ (price − target) × quantity per vehicle × the project's planned annual volume, over parts that have a cost breakdown and target (Kushaq ₹8.76 Cr; Slavia, Kylaq and Virtus have no priced parts, so "—").

**Home / My Tasks (V8 only):** `src/v8_home.js` + `src/v8_home.css` replace Home in V8 (E7 keeps the E6 list; the old list stays reachable as Task & Notification Centre, which `e7_integration.js` now wraps from `SCREENS[m]["task-centre"]`). Greeting + one-line summary + Task centre / Ask AIS buttons · five clickable KPI cards (open, overdue, due in 3 days, waiting for approval, alerts & escalations) · "My work": tabs (All / Approvals / To fill in / Alerts & escalations / Reminders & FYI), search, tasks grouped Overdue / Today & tomorrow / Next 7 days / Later with a due chip, a primary action and a mark-done tick (first 12 shown, "Show all" for more) · side panels: workload by due date, approvals waiting for you (same tasks the KPI counts, with flow steps), Monday reminder list · "Across the platform" (only for modules the role may see): price outlook (`PocCore.kpis`, top price movers), SRM part readiness (`SrmData` summary, alerts, pending amendments), technical-change pipeline (`DATA.changes`) · data freshness · recent activity (`DATA.auditLog`; empty until something is done in the session) · jump-to links. Tasks that carry no link of their own open the matching screen by workflow prefix (`target()` in `v8_home.js`). Nothing is generated.

**Procurement drill-downs (V8):** `src/v8_proc_detail.js` + `src/v8_proc_detail.css` add three screens under Procurement → Procurement dashboard (menu: Overview · Part Details · Supplier Details · Price Analysis). Navigation (existing `U.actions`/`Router`): part rows in Top parts / Parts with highest price increase / Cost vs target → `ppart:<id>` · supplier ring segment or legend → `psup:<name>` · "Since nomination" KPI and the two "View all …" links → `pprice:` (Price Analysis, carrying the overview's vertical/supplier filter) · "Back to Procurement Overview" on every page. The project is the single shared `V8Proc.PF.project` (single select everywhere); a part's project becomes the context when it is opened. Context lives in `V8Detail.CTX`; invalid or missing selections fall back to the project's top part / first supplier with a notice. No new data: figures come from `PocCore` (cost per vehicle = piece price × quantity), `DATA.priceVersions`, `DATA.cbds`, `DATA.changeRequests`, `DATA.changes`, `DATA.suppliers` and the SRM model (delivery / quality / phase / status, which are prototype scores). Fields without data show an unavailable state (no target, no cost breakdown, no linked decision).

## V9 — photographic sign-in and Home

`python build_e7.py` also writes `SAVWIPL_prototype_V9.html` (= V8 + `v9_brand.js`, `v9.css`). E7 and V8 are unchanged.
Deliberately limited to two places, with no animation, so the working screens stay calm on a laptop: the **sign-in** screen and the **Home** banner.

| File | Role |
|---|---|
| `assets/src_login.png`, `assets/src_home.png` | the two reference images supplied by the client (small mock-ups with UI drawn over the photos) |
| `make_hero_images.py` | crops the clean photographic regions, upscales (4–5×), light grade + film grain → `assets/login_hero.jpg`, `assets/home_hero.jpg`. **For real quality, drop the original full-resolution photographs (no UI on top) into `assets/` under those two names, delete the crop calls in the script, and rebuild** |
| `src/v9_brand.js` | sign-in: photo fading into a blurred copy of itself + glass card, same simulated 3-step SSO (shown on first load, remembered per browser tab via `sessionStorage["v9-in"]`, shown again after Logout); Home: greeting banner with the photo on the right, KPI tiles lifted over its lower edge. `build_e7.py` embeds the JPEGs as data URIs, so the HTML stays a single file |
| `src/v9.css` | the styles; responsive down to phone width |

## V8 — SRM dashboards

`python build_e7.py` writes **both** `SAVWIPL_prototype_E7.html` (unchanged by V8) and `SAVWIPL_prototype_V8.html` (= E7 + the SRM dashboards).
SRM → Dashboards: **Overview**, **Part Readiness**, **Status Tracking**, **Supplier Performance** (filters: project, part family, supplier).
Built from the three shared reference dashboards, reduced to what SRM owns (RFQ: "Tooling and Part Readiness" + "Status Tracking");
the mock-ups' material-cost and commodity panels already exist in Procurement → Forecast & risk.

| File | Role |
|---|---|
| `src/v8_srm_data.js` | `SrmData` — deterministic, date-parametric readiness model over the 480 POC parts, 6 programmes (SOP dates), 20 suppliers; `tests/test_srm.js` checks it |
| `src/v8_charts.js` | stacked bars, programme timeline (gantt), funnel, heat-map, gauge, ring, scatter |
| `src/v8_srm.js`, `src/v8_srm.css` | the four screens, SRM part drawer, navigation, Ask AIS answers for SRM questions |
| `src/e7_btn_icons.js`, `src/e7_ui.css` | `BtnIcons` — gives every `.btn` a matching line icon chosen from its wording (approve ✓, reject ✕, save, export ↓, send, add +, back/next arrows…), including buttons created later by drawers and notifications. Skips tabs, segmented filters, chips and buttons that already have an icon; add `data-no-icon` to opt a button out. Wording → icon rules are the `RULES` list in the module |
| `src/e7_pickers.js` | `PartPick` — Car / Supplier / Part as separate, cascading filters wherever a part is chosen (Price History, CBD Tree, Change Request, Investment drawer, Technical Change intake) + real filters on every master table |
| `src/e7_workflow.js` + `patches_approvals.py` | **Flow** — one routing model for every approval (E7 and V8): role-owned steps, task + notification + e-mail-log per step, apply on the last step, rework task on rejection; see `../Approval_Workflow_Guide.md` |
| `src/v8_tcm.js`, `src/v8_tcm.css` | **Technical Change management dashboards** (Overview, Change Impact, Approval Workflow, Implementation, Change Register) on one register — see "Technical Change management dashboards (V8)" below |
| `src/v8_tc.js`, `src/v8_tc.css` | **Technical Change** module (ported from `Requirements/SAVWIPL_prototype_E4.html`, rebuilt on the current UI and platform data): Change Dashboard, Create Change, AI Extraction, Evaluation Sheet (22 TUL fields), Validation & Assignment, Supplier Offers, MOD Sheet, Impact Analysis, Approval Workflow (6-stage chain), Implementation, Change History |
| `src/v8_proc.js` | **Procurement Dashboard** (Procurement → first group, next to the Forecast Dashboard) — board view: 5 KPIs, 4 visuals, 1 decision list; explained in `../Procurement_Dashboard_Guide.md` |
| `src/v8_srm_ops_data.js`, `src/v8_srm_ops.js` | SRM operational screens on the same model: **Part Assignment** (stakeholders, gaps, start monitoring), **Tool Readiness** (tool register, trials, CAPEX vs spend), **Milestone Tracking** (part tracker + amendment approval with struck-through history), **Readiness (R/Y/G)** (7 dimensions → traffic light), **Alerts & Escalations** (6W / 4W / 2W / overdue, reminders, escalation ladder, Monday digest); `tests/test_srm_ops.js` |

**Generated, not from a source system (flagged in the UI):** the milestone chain (B-Release −198 d, VFF −151, PVS −86, 0-Series −40, SOP, offsets from each
programme's SOP — TGN matches the existing milestone master), part change type (35% facelift with the programme SOP; 40% model-year change and 25% AEKO running
change with their own part-level SOP — the RFQ allows part-level dates), each part's supplier-commitment slip, tool requirement / cavities, supplier
delivery and quality scores, SRM owner names, stakeholder assignments and gaps, tool numbers / makers / CAPEX, milestone amendments, R/Y/G dimension scores, alert reminder counts. Real: parts, programmes, suppliers, SOP dates, forecast price moves.
**Definitions:** status = worst upcoming milestone (on track ≤10 d late, at risk 11–30, delayed >30); readiness = 100% when the commitment is on / ahead of date, 0% at 40+ days late;
funnel = parts that reached each stage on the plan curve; part families map POC categories (Electrical ← Electrical, Lighting, Sensors; Interior ← Interior Trim, HVAC;
Powertrain; Exterior ← Body Stampings; Metal & Chassis ← Chassis, Braking, Fasteners).

## Rebuild

```bash
cd E7_build
python make_poc_data.py     # only when the POC pipeline output changes → poc_data.json (reads POC/dashboard/api/_data; ~1–2 min)
python build_e7.py          # E6 html + poc_data.json + src/*           → ../SAVWIPL_prototype_E7.html
node tests/test_core.js && node tests/test_extras.js   # data layer reconciles with the POC's own KPIs, walk, mean-price series
```

`build_e7.py` asserts every text patch it applies to the E6 source matches exactly once, so drift fails loudly.
Never read or embed `dashboard/.env` — the OpenAI key stays in the POC server only.

## POC view → E7 screen

| POC view | E7 screen (Procurement → Forecast & risk unless noted) |
|---|---|
| Dashboard (KPIs, buyer brief, price forecast, why the forecast moved, category donut, horizon bars, largest moves, spend at risk, alerts) | **Forecast Dashboard** |
| Forecast Detail (price forecast, horizon, donut, model comparison, backtest stability) | **Forecast Detail** |
| Material Cost Dashboard (hierarchy filters, KPIs, price movement tracker, cost walk, part drill-down, part drawer) | **Material Cost Forecast** (+ part drawer everywhere) |
| Hierarchy Drill-down (project → vendor → category → part → material tree with reorderable levels, confidence filter, "Why?") + roll-up | **Hierarchy Drill-down** |
| Forecasting & Cost Impact (presets, FX/commodity what-if, vehicle impact, bridge, category drill-down) | **Cost Impact** |
| FX Impact | **FX Impact** |
| Geopolitical Risk (analyst review queue, drivers, signals, framework, mediation, event studies, counterfactuals, mediators) | **Geo Risk** (confirm / dismiss writes audit + tasks) |
| Parts | **Parts** (search, filters, CSV) |
| Alerts | **Alerts** |
| Real-Data Validation (+ BLS macro chart) | Admin → Forecast model → **Real-Data Validation** |
| Simulated-Future Test | Admin → Forecast model → **Simulated-Future Test** |
| Data Source (+ run environment) and Forecasting Parameters | Admin → Forecast model → **Data Sources** (+ Parameters button on every forecast screen) |
| Technical FAQ | Admin → Forecast model → **Technical FAQ** |
| Date range, parts count, Parameters, Export | toolbar on the Dashboard, Forecast Detail, Validation and Data screens |
| Ask Radar chat (panel, history, settings, report mode, charts, sources) | **Ask AIS** — the POC's chat panel, ported 1:1, opens from the top-bar button and every “Ask AIS / Why?” shortcut |

The Validation, Future-Test, Data and FAQ screens are also reachable from the Dashboard for every role.
Other integrations: Home (price outlook, alerts for review, forecast tasks), Material Cost dashboard ("Model forecast (POC)"
mode), Commodity & Forex ("Market & Forecast" tab), global search (480 parts),
Admin → AI Model Settings (Radar server URL).

## Files

| File | Role |
|---|---|
| `make_poc_data.py` | exports the POC artefacts (480 parts × 36 months, forecasts, intervals, confidence, per-part reasons, FX, mediator series, analyses) to one JSON |
| `src/poc_core.js` | `PocCore` — data layer: parts, friendly names, rollups, spend-at-risk, KPIs, cost impact, cost walk (3 periods, 7 drivers), mean-price tracker, sample BOM, market context |
| `src/e7_seed.js` | `PocSeed` — builds E6 masters/seeds from the POC |
| `src/poc_charts.js` | dependency-free SVG charts (line with bands/markers/labels, whisker bars, combo, grouped bars, waterfall, donut, sparkline) |
| `src/e7_screens.js` | core: helpers, state, generic actions, part drawer, Parts, Alerts, parameters modal |
| `src/e7_views_dash.js` · `e7_views_material.js` · `e7_views_analysis.js` | Dashboard + Forecast Detail · Material Cost + Hierarchy · Cost Impact + FX + Geo |
| `src/e7_admin.js` | Validation · Future test · Data sources · FAQ |
| `src/e7_radar.js` | Radar answer engine (offline): the POC's tools run in-page + the platform's records |
| `src/e7_price.js` | Price-version helpers (timeline, price walk, stats) reused by Procurement › Price Analysis. The standalone Price History screen was removed. |
| `src/e7_cbd.js`, `src/e7_cbd.css` | CBD Tree: Car / Supplier / Part filters (cascading) over E6's screen; "All parts" shows a rolled-up scope view |
| `src/e7_chat.js`, `src/e7_chat.css` | the POC's Radar chat UI in vanilla JS (ChatWidget, open screen, history, settings, report mode, chart / source / export cards); same storage keys (`radar-chat-history-v1`, `radar-settings-v1`, `radar-briefing-cache-v1`) |
| `src/e7_integration.js` | navigation, Home block, workflow hooks, tasks & audit for alerts, search, AI settings |
| `src/e7.css`, `src/e7_poc.css` · `patches_workflow.py` · `radar_cors_proxy.mjs` · `tests/` | styles · text patches into E6 · optional CORS proxy · Node tests / mock server |

## Radar chat

The panel is the POC's ChatWidget translated component by component (layout, copy, icons, colours, interactions). Differences:
- **Impact news** (`/api/briefing`), **token figures** (`/api/usage`) and **Excel/Word export cards** (`/api/export`) need the Radar server; offline the news row says so and the token chips read “not measured yet”.
- **Report mode** is a scripted demo in the POC too; its sample deck / document (POC `public/reports`) are embedded into the page at build time.
- Offline answers carry small action chips (open screen, follow-up question, confirm / dismiss alert) and a one-line basis caption — additions to fit the prototype.
- Chart colours follow the POC (blue / slate; bar tones green = up, red = down).

## Radar modes

- **Offline (default)** — the POC's tools run in the page on the embedded data (part prediction and "why" with the POC's reasons and
  confidence, movers, KPIs, rollups, spend at risk, cost walk, FX / geo scenarios, event studies, validation, provenance, exposure,
  confirm/dismiss alerts) plus the platform's records (price versions, CBDs, approvals, tasks, POs, tooling, benchmarks).
- **Server** — Admin → AI Model Settings. Requests go to the POC's `/api/chat` (NDJSON); failures fall back to offline.
  Local use: `npm run dev` in the POC, then `node radar_cors_proxy.mjs`, URL `http://localhost:8787`.

## Data decisions and known limits (flagged in the UI too)

- Part-level prices are **synthetic** (anchored on real BLS + ECB FX); accuracy figures describe the pipeline, not real prices.
- Budget / SOP in the cost walk are **derived** (first / last history month); spend = unit-price sum (no volume weighting).
- The POC's Material Cost walk attributes the move to currency and vendor re-price; materials / freight are zero at part level.
  The hierarchy block carries a small commodity / freight bridge per part on its primary material — shown in the part drawer.
  E7 recomputes vendor re-price as the residual per part (the POC export puts a portfolio residual on one part; 5 parts have no SOP).
- The POC's hierarchy view rescales prices to a presentation range; E7 shows the exported prices on every screen so everything reconciles.
- The hierarchy tree's material lines are the POC's **illustrative sample** bill of materials (flagged), not data.
- The POC "Parts" view lists only its top-12 movers; E7's Parts lists all 480 with filters.
- Commodity and freight series are the POC's **offline fallbacks** (synthetic); FX and the geopolitical-risk index are real.
- 177 blank price cells in the POC panel are linearly interpolated in the export.
- The embedded export is the 6-month-horizon artefact set (`api/_data`); the POC's current `config.yaml` has `forecast_horizon: 1`.
  The code is horizon-agnostic — re-export after re-running the pipeline.
- Generated (not from the POC): DUNS, plants, supplier risk rating (from forecast move), facelift/SOP dates, milestones, car-volume
  years, EKL targets, tooling capex, CBD weights/import content for the 8 hero parts, tasks/PO/approval seeds.
- Geopolitical confirm/dismiss state lives in the page (reset on reload); it does not write to the POC's KV store.

### SRM operational screens — rules
- Amendments: a part's milestone with a commitment more than 8 days late may carry an amendment; approving needs Approver / Commodity / Project Mgr / Admin; the earlier date stays visible, struck through.
- R/Y/G: dimension score = 100 − 2.5 × days late (Green ≥75, Yellow 25–74, Red <25); overall = Red if any dimension is red, Yellow if three or more are yellow.
- Alerts: milestone within 6 / 4 / 2 weeks with a late commitment, or date passed with the stage not reached (overdue). Overdue → Supervisor after 3 reminders, Management after 6; any alert at 4 reminders → Head of SRM.
- Actions (assign, approve / reject, remind, escalate) change in-page state and write audit / e-mail-log entries; they reset on reload.
- The RFQ names a 19-stage milestone set; five key stages are tracked — the remaining stages need SAVWIPL's stage list. Supplier Onboarding (F-087..092) is not built.

### Procurement Dashboard (V8)
Board view, history and actuals only — what is expected next stays on the Forecast Dashboard. Five KPIs on one line, four visuals (price rise by category, largest suppliers, parts furthest over target, commodity & FX) and the open approvals. Every number and chart is explained in `Procurement_Dashboard_Guide.md` (project root).
Money views use the same unit-price basket as the forecast screens (not volume-weighted); filters: project, category, supplier. Cost vs target covers the 8 parts that have a cost breakdown and price versions; the approvals table ignores the filters.
All V8 dashboards share a tighter page top (less padding, no wrapped KPI rows).

### Technical Change (V8)
Ten-stage flow per change: Intake → AI extraction → Evaluation → Validation → Supplier offers → MOD sheet → Impact → Approval → Implementation → Closed; the five seeded changes (AEKO / AWE / AeA on Coil Spring, Bonnet Panel, Body Clip Set, Wiring Harness, Stabiliser Bar) sit at different stages.
Differences from E4: part, programme, supplier come from the 480-part master; the MOD sheet starts from the part's cost breakdown; annual volume from the car-volume master; validation checks are real lookups (project, part, supplier hard checks; BOM-at-SOP, price record, revision are warnings that do not block); risk = how many of {price up >3%, milestone within 90 days with a late supplier commitment, high-risk supplier} apply (uses the SRM model).
Implementation really writes: the new price is appended to the price history, the part is added to BOM at SOP, a PO is raised / re-issued.
Generated: documents, TUL values, supplier-offer values, clarification replies, "similar historical changes", the drawing-revision mismatch on the first change.
Ask AIS answers technical-change questions (AEKO / AWE / AeA / MOD sheet / change status). E4's separate mini-chat was dropped in favour of Ask AIS.
Sidebar groups: Overview & reports · Intake & evaluation · Supplier & cost · Approval & rollout (includes the shared Approvals inbox).

### Approval routing (E7 + V8)
`patches_approvals.py` redirects the E6 change-request and commodity / FX code to `Flow` (and exposes the closure helpers it needs); `src/e7_workflow.js` is loaded in both builds. Technical Change (`v8_tc.js`) and SRM milestone amendments (`v8_srm_ops.js`) use the same `Flow` API. Legacy writers of `DATA.tasks` (sourcing import, EBON reminder) are bridged into the Task Centre. Role → person comes from `DATA.users`; Management sign-off is the Project Manager role. See `Approval_Workflow_Guide.md`.

### Pickers (E7 + V8)
A part is never chosen from one combined list any more: **Car → Supplier → Part**, each narrowing the others; the Part list shows only the part name (the part number is appended only when two names would otherwise be identical). Applied to Price History, CBD Tree, the change-request form, the investment drawer and the Technical Change intake. Project and FX pickers show car names instead of codes. `Components.masterTable` now builds real filters (car, supplier, type, status ... — up to four categorical columns) in place of the old "All" drop-down that did nothing; this covers Master Data, Change Requests, Commodity & Forex, EBON POs and the other master tables.

**Vehicle photo and part images (V8):** `src/v8_art.js` / `v8_art.css` provide `V8Art.part(name, vertical, size)` and `V8Art.car(code)`. `build_e7.py` embeds `assets/cars/<CODE>.jpg` (five from the Controlling PPT page 7, Kodiaq supplied by the team; Taigun mirrored to face right; credits in `assets/IMAGE_CREDITS.md` and `assets/cars/credits.json`) and any `assets/parts/<part-name>.jpg|png|webp` found; it prints `photos embedded: n parts, n cars`. No part photographs are included, so part rows show no image until some are added.

**SRM operational tables and panels (V8):** Part Assignment ("Assignments"), Tool Readiness ("Tool register") and Milestone Tracking ("part tracker" and "Milestone amendments") now use `FTable` (10 rows per page, 10/25/50 selectable, filter on every column heading); the quick segment buttons above each table still work. The "Workload by SRM engineer", "Unassigned roles" and "Where the tools are" panels use the shared ranked-row layout (`rank()` in `v8_srm_ops.js`, styles in `v8_srm_ops.css`); the Tool Readiness chart panels are height-balanced with `.v8-fill`. Alerts and Readiness (R/Y/G) tables still show a capped list.

**Technical Change management dashboards (V8):** `src/v8_tcm.js` + `src/v8_tcm.css` (loaded after `v8_tc.js`, which exposes `window.V8TC` — live workflow records and the pricing / risk helpers) replace the old Change Dashboard with five pages under **Technical Change → Dashboards**: **Overview** (5 KPI cards · row of four: status donut, type bars, stacked project bars, production impact · one table with two tabs, High-impact / Overdue changes, same ten columns · six rule-based insight cards in the reference layout (numbered, tinted card with icon, headline figures and a one-line action strip); a click opens a centred pop-up (`insModal` in `src/v8_tcm.js`) with the same figures, what the data shows, why it matters, what management could do, the changes behind it (up to 8; rows open the change detail) and a button to the related page; the financial waterfall, approval flow and Gantt timeline live on Change Impact, Approval Workflow and Implementation) · **Change Impact** (waterfall, net by project, approved vs in effect vs forecast, by type, largest impacts) · **Approval Workflow** (7-step flow with waiting / average wait / overdue / passed per step, bottleneck, decisions waiting, rejected / returned) · **Implementation** (12-month Gantt, delayed / at-risk / due-soon, register) · **Change Register** (`FTable`, filter any column, overdue-only toggle, row → **Change detail**). The per-change screens (Create Change … Change History) are kept under "Change workflow"; their sidebar labels are Impact Sheet / Approval Chain / Implementation Tasks. Header, filter bar and KPI cards follow the Procurement dashboard (data-as-of + illustrative chip at the right of the title; `.pd-fbar` with project picture, four equal filters and an icon-only reset; fixed-height `.pd-kpis` cards with a two-line context slot). Filters (project, change type, status, implementation year) are shared by all five pages. The Overview shows five count cards only (total, open, pending approvals, approved, implemented); the ₹ figures are in the Financial impact panel and on Change Impact.
**One register feeds everything.** 65 changes = the 5 live workflow changes (`DATA.changes`, read live, so a stage change shows up at once) + 60 generated records (`genSyn`, deterministic, labelled "Illustrative prototype data" on every page). Real inputs: project, part, supplier, annual volume (year of the data date), quantity per car, piece price, project SOP dates, the module's risk rule (`riskCalc`) and approval chain. Generated: category, dates, owner, piece-price change, tooling cost, status mix. **Definitions:** status is mutually exclusive — Open (not yet submitted for approval) · Pending approval (waiting at exactly one of 7 steps) · Approved (awaiting implementation) · Implemented · Rejected · Returned for rework. Annualised impact = piece-price change × quantity per car × annual volume (₹/yr recurring); savings = changes that lower the price, additional cost = changes that raise it; net = savings − additional cost, over approved + implemented only; one-time tooling kept apart; forecast (open / pending / returned with a priced MOD sheet) kept apart; "in effect" = implemented, realised-to-date savings are not available (no PO actuals). Sign convention in tables: + saving, − additional cost. Overdue = current-step due date < today: approval step 3 days, evaluation stages 3–10 days, rework 5 days, implementation = planned date; no date → not overdue. Implementation status: Delayed (planned date passed) · At risk (≤45 days and not yet approved, or planned inside the 60 days before the project's SOP, or tooling due ≤60 days) · On track. Production risk (register) = count of five indicators (price up >3%, milestone ≤90 days with late supplier commitment, high-risk supplier, inside the pre-SOP window, >7 days overdue): High ≥2, Medium 1, Low 0; closed changes carry none. Priority = risk (High 2, Medium 1) + materiality (≥ ₹2 Cr/yr 2, ≥ ₹50 L/yr 1): 3–4 High, 2 Medium. No project has reached SOP in the data, so "affecting in-production vehicles" is 0 with that explanation. Not available: period-over-period deltas, actual realised savings, monthly history. Home's technical-change panel and Ask AIS portfolio answers read the same register.

**Filter-bar car box and Glossary (V8):** the car box in the Procurement overview filter bar has a fixed width (`.pd-carbox`, 340 px; the name and segment truncate), so the filters stay in the same place for every project. The "Terms used on this page" strip is gone from the page; the same definitions are under the user menu (sidebar footer) → **Glossary** (`window.V8Glossary`, wired in `v8_proc.js` by wrapping `UserMenu.render` / `UserMenu.act`).

**Fixed-size filter bar and KPI cards (Procurement overview, V8):** the filter bar is one row with a fixed 140 × 88 px car tile (`.pd-fbar .va-car`), equal-width filters and an icon-only reset button; the five KPI cards (`.pd-kpis.k5`) have a fixed height with a two-line sub-label slot. Switching project moves nothing. Rules are at the end of `src/v8_art.css`.

**Paginated overview tables (V8):** "Cost per vehicle by vertical" shows 5 rows per page with a pager; "Top parts by cost per vehicle" shows the top 5 with no pager ("View all parts" opens the full list) (`paginate()` in `src/v8_proc.js`); rank numbers continue across pages and the page resets when a filter changes.

**Supplier donut and price tables (V8):** the supplier ring is drawn at 250 px and scales to the panel (`.pd-conc2 .dn`), with a compact legend (name and share side by side). "Parts with highest price increase" and "Cost vs target" use one-line column headings (Nomination / Current / Change; Target / Current / Variance / Impact) with ₹ stated in the panel tooltip; rules at the end of `src/v8_art.css`.

**Detail-page filter bars (V8):** Part Details, Supplier Details and Price Analysis now use the same filter bar as the Procurement overview (car tile + name, equal-width filters, icon-only reset). Part Details filters are Project · Vertical · Part (part names only; a name used more than once is numbered, biggest cost first). The label "Vehicle / Project" is now "Project" everywhere (overview, detail pages, Technical Change dashboard).

**Part Details filters and strip (V8):** filters are Project · Vertical · Supplier · Part; Vertical and Supplier only offer values that still have parts for the other filter, and the Part list follows both. The detail pages' filter bar shows the car picture alone (no name beside it). The strip under the filters shows only what the filters do not: part number, program phase, SRM status, price status, last price update.

**Supplier Details (V8):** same filter bar as Part Details (Project · Vertical · Supplier · Part; each list only offers values that still have parts; Part = All parts by default and narrows the page to that part). Five KPI cards in one row (Avg price variance removed); "Spend by component category" and "Price performance over time" share a row; "Parts supplied" and "Related commercial decisions" each have their own full-width row. Price performance compares with all suppliers in the same vertical when a vertical is chosen.

**Supplier strip (V8):** under the Supplier Details filters, a "Supplier Details" panel lays out only what the filters do not show — origin, location, main commodity, risk rating, business share, import dependency, re-price cycle, SRM owner — in a 4 × 2 grid (2 columns on narrow screens).

**Price Analysis (V8):** "Parts with highest price increases" lists the top 20 and shows 5 per page with a pager. "Financial impact of price changes" now has nomination / today / net-change cards, the waterfall and a reason-by-reason table (₹ per vehicle and share of the change), and fills the same height as "Price trend — selected part".

**Price Analysis row (V8):** "Price trend — selected part" and "Financial impact of price changes" share the row equally (`.pd-row.c11`), the waterfall is height-capped and the reason table sits at the bottom, so both panels have the same height with the summary lines aligned at the bottom.

**Price Analysis variance panels (V8):** "Price variance distribution" (full-height column chart coloured by size of the rise), "by component category" and "by supplier" (top 8 each, name · bar of ₹/vehicle impact · change · ₹/vehicle, with a "Top 8 of N" note) now share one height; category rows still filter the page and supplier rows open Supplier Details.

**Price Analysis part picker (V8):** the part selector above "Price trend — selected part" is a highlighted "Choose a part to chart" box a larger dropdown (name and % change; the part number only when two top-40 parts share a name) and an icon button that opens the part in Part Details.

**Price Analysis part filter and chart tooltip (V8):** one "Part" filter (All parts by default, or one of the 40 biggest price rises) sits above the trend and financial-impact panels and drives both — trend of that part's price (or the cost per vehicle of all parts), and the nomination → today cost, waterfall and reason table for that part. `poc_charts.js` `line()` accepts `{tip:true, tipExtra(i)}` for a styled tooltip (date, coloured series rows, optional extra row, guide line); used on the Price Analysis, Part Details and Supplier Details charts. Other charts keep the native tooltip.

**Price History charts inside Price Analysis (V8):** the two screens read different records — Price History reads the recorded price versions (`DATA.priceVersions`, ending with the latest CBD-recalculated price); the Price Analysis trend and financial-impact panels read the monthly price panel and its cost-walk bridges (currency, commodity, freight, vendor re-price). Price Analysis now shows "What drove the price" and "Version history" (reused from `e7_price.js` via `window.__priceKit`) directly under the KPI cards, always: for the part chosen in the Part filter when it has recorded versions, otherwise for a part picked in the small "Recorded price history" selector (parts of the current selection that have versions; a message appears when none does). "Price trend" and "Financial impact of price changes" are unchanged below.

**CBD tree (E7/V8):** the maths is in `src/e7_cbd_core.js` (`CbdCore`: part cost, cost per car, parent/child reading of the node tree, checks, CSV upload validation); `patches_cbd.py` swaps the E6 formulas for stubs that delegate to it and replaces the E6 screen, node/input drawers and the simulated upload with `cbd_e6/cbd_view.js` and `cbd_e6/cbd_forms.js` (these run inside the E6 closure). Part cost = Σ(net weight × commodity price) + import value × FX (×1 for INR) + manual cost lines (a line below a "total" parent is not added again). Cost / car = part cost × qty + D&D amortisation per car. Calculated cost, VSI, target, supplier price (latest non-"recalculation" price version) and nominated price are shown side by side, never merged.
