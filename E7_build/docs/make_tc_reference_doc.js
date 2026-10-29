const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  AlignmentType, HeadingLevel, LevelFormat, Footer, Header, PageNumber, PageBreak, TabStopType, VerticalAlign,
} = require("docx");

const BRAND = "0A6A4E", INK = "0F2C24", MUTED = "5A6B65", LINE = "C9D3CE", SOFT = "E8F1EC", ZEBRA = "F6F9F7", AMBER = "FBEFD6";
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134, CONTENT = PAGE_W - 2 * MARGIN; // 9638
const FONT = "Calibri";

/* ---------- inline markup: **bold**  _italic_ ---------- */
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: t.slice(2, -2), italics: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}
const P = (text, o = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...o, children: runs(text, { size: o.size || 21, color: o.color }) });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: t, font: FONT })] });
const H1n = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })] });
const H2p = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun({ text: t, font: FONT })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONT })] });
const bullet = (t, level = 0) => new Paragraph({ numbering: { reference: "bul", level }, spacing: { after: 70, line: 264 }, children: runs(t, { size: 21 }) });
const note = (t) => new Paragraph({
  spacing: { before: 60, after: 160, line: 264 },
  shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: BRAND, space: 8 } },
  indent: { left: 140 },
  children: runs(t, { size: 20, color: INK }),
});

/* ---------- tables ---------- */
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, w, o = {}) {
  const paras = (Array.isArray(text) ? text : [text]).map((t, i, a) => new Paragraph({
    spacing: { after: i < a.length - 1 ? 50 : 0, line: 252 },
    alignment: o.align,
    children: runs(String(t), { size: o.size || 18, color: o.color, bold: o.bold }),
  }));
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 }, children: paras,
  });
}
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], { fill: BRAND, color: "FFFFFF", bold: true })) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: false, children: r.map((c, i) => cell(c, widths[i], { fill: ri % 2 ? ZEBRA : undefined, bold: i === 0 })) })),
    ],
  });
}
const gap = () => new Paragraph({ spacing: { after: 140 }, children: [] });

/* ================== CONTENT ================== */
const body = [];

/* ---- cover ---- */
body.push(new Paragraph({ spacing: { before: 2600, after: 120 }, children: [new TextRun({ text: "SKODA AIS  ·  Technical Change module", font: FONT, size: 24, color: BRAND, bold: true })] }));
body.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Technical Change Management Dashboards", font: FONT, size: 60, bold: true, color: INK })] }));
body.push(new Paragraph({ spacing: { after: 500 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 10 } }, children: [new TextRun({ text: "Glossary, business rules, KPI cards and visuals — reference document", font: FONT, size: 30, color: MUTED })] }));
body.push(table(["Item", "Detail"], [
  ["Application", "SKODA AIS prototype V8 (SAVWIPL_prototype_V8.html) — Technical Change → Dashboards"],
  ["Dashboards covered", "Overview · Change Impact · Implementation · Change Register · Change detail"],
  ["Data status", "**Illustrative prototype data.** 65 changes: 5 from the live Technical Change workflow, 60 generated register records. Reference (data) date: 29 July 2026."],
  ["Version", "1.9 — 29 October 2026 (revision history in Appendix D)"],
  ["Audience", "Management, product owners, reviewers and anyone who needs to explain a figure on these pages"],
], [2400, 7238]));
body.push(gap());
body.push(note("**How to use this document.** Section 2 explains where the numbers come from. Section 3 is the glossary. Section 4 lists every business rule and threshold in one place. Section 5 walks through each dashboard: every KPI card and every visual, with what it shows, how it is calculated and how it behaves. Section 6 lists known limitations."));

/* ---- contents ---- */
body.push(H1("Contents"));
[
  ["1", "Purpose and scope"], ["2", "Data foundation, filters and navigation"], ["3", "Glossary"], ["4", "Business rules and thresholds"],
  ["5", "Dashboard reference"], ["5.1", "Overview"], ["5.2", "Change Impact"], ["5.3", "Implementation"],
  ["5.4", "Change Register"], ["5.5", "Change detail page"], ["6", "Limitations and what is not available"],
  ["A", "Appendix A — Worked example of an annualised impact"], ["B", "Appendix B — Colours and status legend"], ["C", "Appendix C — Approval steps and approver roles"], ["D", "Appendix D — Revision history"],
].forEach(([n, t]) => body.push(new Paragraph({ spacing: { after: 70 }, indent: { left: n.includes(".") ? 500 : 0 }, children: [new TextRun({ text: n + "   ", bold: true, color: BRAND, font: FONT, size: 22 }), new TextRun({ text: t, font: FONT, size: 22, bold: !n.includes(".") })] })));

/* ---- 1 purpose ---- */
body.push(H1("1  Purpose and scope"));
body.push(P("The Technical Change dashboards give management one place to see the value, the risk, the decisions and the implementation status of engineering changes. They answer four questions:"));
body.push(bullet("**Value** — how much does the change portfolio save or cost per year, and how much of that is already in effect?"));
body.push(bullet("**Decisions** — which changes are waiting for approval, where do they wait, and which step is the bottleneck?"));
body.push(bullet("**Implementation** — which approved changes are on track, at risk or delayed, and how do they sit against each project's start of production (SOP)?"));
body.push(bullet("**Risk** — which active changes could threaten production, quality, supplier readiness or an upcoming SOP?"));
body.push(P("This document describes the dashboards as built. It covers the four dashboard pages under **Technical Change → Dashboards** and the **Change detail** page that opens when a change is clicked. The per-change workflow screens (Create Change, AI Extraction, Evaluation Sheet, Validation, Supplier Offers, MOD Sheet, Impact Sheet, Approval Chain, Implementation Tasks, Change History) are outside this document."));
body.push(note("Every dashboard page carries the chip **Illustrative prototype data** and a **Data as of 29 Jul 2026** label. Figures are not actual SKODA results."));

/* ---- 2 data ---- */
body.push(H1("2  Data foundation, filters and navigation"));
body.push(H2("2.1  One register feeds every page"));
body.push(P("All six pages read the same change register, so every count, rupee figure and chart reconciles to the same rows. The register holds 65 changes:"));
body.push(table(["Source", "Count", "What it is"], [
  ["Live workflow changes", "5", "The five seeded changes of the Technical Change workflow (AEKO-2026-0041, AWE-2026-0018, AEA-2026-0009, AEKO-2026-0052, AWE-2026-0021). Their status and stage are read live from the workflow, so moving a change forward there is reflected on the dashboards at once."],
  ["Generated register records", "60", "Deterministic, generated records across the six projects so the dashboards have enough volume to show timelines, bottlenecks and overdue items. They have no workflow behind them."],
], [2400, 900, 6338]));
body.push(gap());
body.push(H2("2.2  What is real and what is generated"));
body.push(table(["Data element", "Source"], [
  ["Project, part, part number, supplier, vertical", "Platform data (the 480-part panel and project master)."],
  ["Piece price, quantity per car", "Platform part data (piece price level is itself illustrative in the prototype)."],
  ["Annual volume", "Car-volume master: the volume of the project for the year of the data date (2026)."],
  ["Project SOP dates", "Project master: Taigun 1 Mar 2027 · Kushaq 15 Jun 2027 · Kodiaq 1 Sep 2027 · Slavia 20 Nov 2027 · Kylaq 10 Jan 2028 · Virtus 5 Mar 2028."],
  ["Risk inputs (supplier rating, next milestone, supplier commitment)", "The module's own risk rule and the supplier-readiness model."],
  ["Approval chain and approver roles", "The module's approval engine (seven steps, role per step)."],
  ["Change category, reason, request form", "**Generated** for the 60 records; assigned from the seeded reasons for the 5 live changes."],
  ["Dates (raised, in current stage since, due, planned implementation, implemented)", "**Generated**, date-parametric from the data date."],
  ["Piece-price change % and one-time tooling cost", "**Generated** for the 60 records; calculated from the MOD sheet for the live changes that have one."],
  ["Owner names", "Platform users per role."],
], [4300, 5338]));
body.push(gap());
body.push(H2("2.3  Filters shared by all pages"));
body.push(P("Every dashboard page opens with the same filter bar (the same pattern as the Procurement dashboard): a project picture, four filters and an icon-only reset button. The filters are shared, so a selection made on one page stays when you move to another dashboard page."));
body.push(table(["Filter", "Options", "Effect"], [
  ["Project", "Taigun, Kushaq, Kodiaq, Slavia, Kylaq, Virtus (and All)", "Keeps only changes of that project. The picture changes to that car."],
  ["Change type", "Cost Reduction, Design Change, Supplier Change, Quality Improvement, Regulatory, Other", "Keeps only changes of that category."],
  ["Status", "Open, Pending approval, Approved, Implemented, Rejected, Returned for rework", "Keeps only changes with that status."],
  ["Implementation year", "Years present in the data (2026, 2027, …)", "Keeps changes whose implementation year is that year: the implemented date for implemented changes, otherwise the planned date. Rejected changes have no planned date and drop out when a year is chosen."],
  ["Reset", "—", "Clears all four filters."],
], [1700, 3700, 4238]));
body.push(P("Every KPI card, chart, table and insight on the page follows the filters. When a selection leaves nothing to show, the panel shows an empty-state message instead of a chart.", { spacing: { before: 120, after: 120 } }));

body.push(H2("2.4  Navigation: back link and breadcrumb"));
body.push(P("Every page with a page header carries one subtle link above the breadcrumb: **‹ Back to <previous page>**. It is the same on all dashboards (Technical Change, Procurement, Forecast, SRM). It returns to the page you came from, whether you arrived by a click on a row, a KPI card or the menu, and each click steps one page further back. When the previous page belongs to another module the link names the module (for example 'Back to Technical Change › Overview'). The Home page and the first page of a session have no back link."));
body.push(P("On the Change detail page the breadcrumb also shows the path, for example Technical Change › Overview › AEKO-2026-0169 — Wheel Nut; its middle part is a link to the page you came from."));

/* ---- 3 glossary ---- */
body.push(H1("3  Glossary"));
body.push(P("Terms are listed alphabetically. Terms in **bold** inside a definition have their own entry."));
const gl = [
  ["Additional cost (annualised)", "The yearly recurring cost of **approved** and **implemented** changes that raise the **piece price**. Each change is netted on its own, so a change that raises the price counts as additional cost, never as negative saving."],
  ["Annual volume", "Planned cars per year of the change's project for the year of the data date. One of the three inputs of the **annualised impact**."],
  ["Annualised impact", "Yearly recurring effect of a change on cost: **piece-price change × quantity per car × annual volume**. Shown with the sign convention: + saving, − additional cost (see section 4.2)."],
  ["Approved (status)", "The change has passed all approval steps and is waiting for implementation. Counted separately from **Implemented**."],
  ["Approval step", "One of seven decision points of the approval chain: Engineering, Quality, SRM, Finance, Commodity, Management, Final confirmation. Each has an approver role (Appendix C)."],
  ["At risk (implementation)", "A change not yet implemented that is likely to miss its planned date or land too close to SOP (rule in section 4.4)."],
  ["Change", "One engineering change request tracked in the register. Identified by its **workflow number** (Change ID)."],
  ["Change type (category)", "Why the change is made: Cost Reduction, Design Change, Supplier Change, Quality Improvement, Regulatory or Other. Different from the **request form**."],
  ["Current stage", "Where the change is today: a workflow stage for open changes (Intake … Impact), the approval step for pending ones, Implementation for approved ones, Closed for implemented ones."],
  ["Data as of", "The reference date of the data (29 Jul 2026). All 'today' calculations (days overdue, days to go) use it."],
  ["Days overdue", "Days between the due date of the current step and the data date. Only counted when a due date exists (section 4.3)."],
  ["Delayed", "A change not yet implemented whose planned implementation date is earlier than the data date."],
  ["Dependency (open)", "An unresolved item that can hold a change back: supplier offer outstanding, validation not complete, or tooling modification not yet released."],
  ["Forecast (not approved)", "Net annualised effect of changes that are Open (with a priced MOD sheet), Pending approval or Returned for rework. Kept apart from the headline because nothing is approved yet. Open changes that are still too early to have a price are not counted."],
  ["High-impact change", "An active change ranked high by the **priority score** (production risk plus financial materiality)."],
  ["Illustrative prototype data", "Generated data used to demonstrate the dashboards. Not SKODA actuals."],
  ["Implemented", "Implementation tasks are complete and the change is closed. Its saving or cost is **in effect**."],
  ["Implementation status", "Delayed, At risk, On track or Implemented — see section 4.4."],
  ["In effect", "The run-rate of **implemented** changes. It is calculated, not measured: realised-to-date savings need purchase-order actuals that the prototype does not hold."],
  ["Live workflow change", "One of the 5 seeded changes that exist in the Technical Change workflow (as opposed to a generated register record)."],
  ["MOD sheet", "The pricing sheet of a change, built from the part's cost breakdown and the supplier's offer. A change is **priced** once it has a MOD sheet with new prices."],
  ["Net impact", "**Savings** minus **additional cost** over approved and implemented changes, on the same annualised recurring basis and currency (₹). Positive means a net saving."],
  ["One-time tooling", "Supplier tooling-modification cost quoted for a change. A one-off amount, therefore kept apart from the annualised figures and never part of the net impact."],
  ["On track", "Not yet implemented, planned date not passed, and none of the at-risk conditions apply."],
  ["Overdue", "The current step of a change is past its due date (section 4.3)."],
  ["Owner", "The person responsible for the current step: the stage owner for open changes, the approver for pending ones, the buyer for approved and implemented ones, the AEKO coordinator for rework."],
  ["Part / part number", "The component the change applies to, with its platform part number."],
  ["Piece price", "Price of one part. The dashboards show the **change of the piece price** in % against today's price (+ price up, − price down)."],
  ["Phase (lifecycle)", "One of the four phases of a change shown on the Change detail page: Preparation (workflow stages Intake to Impact), Approval (seven approval steps), Implementation and Closed. An approved change stays in Implementation until its implementation tasks are done."],
  ["Planned implementation date", "The date the change is planned to be in effect (price, BOM, purchase order and drawing updated)."],
  ["Pre-SOP window", "The 60 days before a project's SOP. A change planned inside this window, or after SOP, is flagged because tooling, supplier readiness and validation may not be ready."],
  ["Priced / not yet priced", "A change is priced when it has a MOD sheet with new prices. Open changes before the MOD stage are not priced and carry no rupee figure."],
  ["Priority", "High, Medium or Low from the **priority score** (section 4.6). Not shown for closed changes."],
  ["Production risk", "High, Medium or Low from five indicators (section 4.5). Never derived from the open status alone. Not shown for closed changes."],
  ["Project", "A vehicle project (Taigun, Kushaq, Kodiaq, Slavia, Kylaq, Virtus), each with its own SOP date and annual volume."],
  ["Quantity per car", "How many pieces of the part one car uses. An input of the annualised impact."],
  ["Reason", "The short description of why the change is made (for example 'Supplier transfer to a localised source')."],
  ["Register", "The list of all changes (65) behind every dashboard. Opened as the **Change Register** page."],
  ["Rejected", "The change was rejected at an approval step. It carries no financial effect and no planned date."],
  ["Request form (AEKO, AWE, AeA)", "The form in which the change was raised in the Technical Change module. Shown as a small label (Request) next to the Change ID; the dashboards do not interpret it further."],
  ["Returned for rework", "The change was sent back to its requester at an approval step and has not been approved. Counted as active; its rework step has a 5-day due date."],
  ["Savings (annualised)", "The yearly recurring saving of approved and implemented changes that lower the piece price."],
  ["SOP", "Start of production of a project."],
  ["Status (lifecycle)", "Exactly one of six mutually exclusive values: Open, Pending approval, Approved, Implemented, Rejected, Returned for rework (section 4.1)."],
  ["Supplier offer", "The supplier's price offer requested for a change. 'Outstanding' means the change is waiting at the Supplier Offers stage."],
  ["Tooling not released", "A change with a one-time tooling cost that is Pending approval, Approved or Returned for rework and whose tooling modification has not been released yet."],
  ["Validation", "The check that the change data is complete and consistent. 'Not complete' means the change is at the Validation stage."],
  ["Waiting time", "Days since the change reached its current approval step."],
  ["Workflow number (Change ID)", "The unique number of a change, for example AEKO-2026-0041."],
];
body.push(table(["Term", "Definition"], gl.map(([a, b]) => [a, b]), [2700, 6938]));

/* ---- 4 rules ---- */
body.push(H1("4  Business rules and thresholds"));
body.push(P("These are the rules the dashboards apply. They are the same on every page."));
body.push(H2("4.1  Status — exactly one per change"));
body.push(table(["Status", "Meaning", "Derived from"], [
  ["Open", "Created and being evaluated, validated, priced or analysed. Not yet submitted for approval.", "Workflow stage Intake, AI Extraction, Evaluation, Validation, Supplier Offers, MOD Sheet or Impact."],
  ["Pending approval", "Submitted and waiting at exactly one of the seven approval steps.", "Workflow stage Approval, with a current approval step."],
  ["Approved", "All approval steps passed; waiting for implementation.", "Workflow stage Implementation."],
  ["Implemented", "Implementation complete; change closed.", "Workflow stage Closed."],
  ["Rejected", "Rejected at an approval step.", "A rejected approval step."],
  ["Returned for rework", "Sent back to the requester at an approval step.", "A returned approval step."],
], [1900, 4300, 3438]));
body.push(P("Because the six statuses are mutually exclusive, the status counts always add up to the number of changes. The first four are the main lifecycle; Rejected and Returned for rework are shown separately so the total always reconciles.", { spacing: { before: 120, after: 120 } }));
body.push(H2("4.2  Financial rules"));
body.push(table(["Rule", "Definition"], [
  ["Annualised impact of one change", "Change of the piece price (%) × today's piece price × quantity per car × annual volume of the project. Unit: ₹ per year, recurring."],
  ["Sign convention", "In tables and charts: **+ saving** (green) and **− additional cost** (red). The piece-price change itself keeps the price direction (+ price up, − price down)."],
  ["Savings", "Sum of the annualised impacts of approved and implemented changes that lower the piece price."],
  ["Additional cost", "Sum of the annualised impacts of approved and implemented changes that raise the piece price."],
  ["Net impact", "Savings − additional cost. Same scope (approved + implemented), same basis (annualised recurring) and same currency (₹), so the subtraction is valid."],
  ["In effect", "The part of the net impact that belongs to implemented changes (run-rate, not measured actuals)."],
  ["Approved, awaiting implementation", "The part that belongs to approved changes not yet implemented."],
  ["Forecast", "Open (priced), Pending approval and Returned for rework changes. Never part of the headline figures."],
  ["One-time tooling", "Kept apart; never added to savings, cost or net."],
  ["Not priced", "Open changes before the MOD stage have no rupee figure and are excluded from every financial total (the number is shown where relevant, for example '18 not yet priced')."],
  ["Rejected", "No financial effect."],
  ["Units", "₹ throughout: ₹ Cr (crore) for large values, ₹ L (lakh) for smaller ones."],
], [2700, 6938]));
body.push(gap());
body.push(H2("4.3  Overdue rules"));
body.push(P("A change is overdue when the due date of its current step is earlier than the data date. If a step has no due date, the change is never marked overdue. Closed changes (Implemented, Rejected) are never overdue."));
body.push(table(["Where the change is", ["Four lifecycle phases as chevrons: **Preparation** (Intake to Impact), **Approval** (seven steps), **Implementation** and **Closed**. Each shows done (green), current (amber), late (red, for an approved change past its planned date), not reached, or not applicable (rejected changes).", "A second row shows the detail of the phase: the seven preparation stages while the change is Open, otherwise the seven approval steps.", "A sentence states where the change is, for example 'Approved on 18 Jul 26, now in Implementation — planned 28 Jul 26, 1 day late · A. Krishnan (Buyer)', with the due or planned date and days overdue."], "Status, approval step, implementation status and dates of the change (sections 4.1, 4.3 and 4.4)."], [
  ["Open — Intake", "Date it entered the stage + 5 days", "5 days"],
  ["Open — AI Extraction", "+ 3 days", "3 days"],
  ["Open — Evaluation", "+ 10 days", "10 days"],
  ["Open — Validation", "+ 7 days", "7 days"],
  ["Open — Supplier Offers", "+ 5 days (the module's own rule: reminders to the buyer start on day 5)", "5 days"],
  ["Open — MOD Sheet", "+ 7 days", "7 days"],
  ["Open — Impact", "+ 7 days", "7 days"],
  ["Pending approval — any approval step", "Date it reached the step + 3 days", "3 days per step"],
  ["Returned for rework", "Date it was returned + 5 days", "5 days"],
  ["Approved", "The planned implementation date", "—"],
], [3500, 4338, 1800]));
body.push(gap());
body.push(H2("4.4  Implementation status"));
body.push(table(["Status", "Rule"], [
  ["Implemented", "The change is closed. Its implementation date is compared with the plan (on time, N days late or N days early)."],
  ["Delayed", "Not implemented and the planned implementation date is earlier than the data date."],
  ["At risk", "Not implemented, not delayed, and at least one of: (a) planned within 45 days while the change is not yet approved; (b) planned inside the 60-day window before the project's SOP, or after it; (c) a tooling modification is not released and the planned date is within 60 days."],
  ["On track", "None of the above."],
], [1900, 7738]));
body.push(P("Changes without a planned date (rejected changes) have no implementation status.", { spacing: { before: 120, after: 120 } }));
body.push(H2("4.5  Production risk"));
body.push(P("Production risk counts how many of five indicators apply to an **active** change (Open, Pending approval, Approved, Returned for rework). Closed changes carry no risk."));
body.push(table(["#", "Indicator", "Flagged when"], [
  ["1", "Price up", "The piece price rises by more than 3%."],
  ["2", "Milestone at risk", "The part's next milestone is within 90 days and the supplier's commitment is not on track."],
  ["3", "Supplier risk", "The supplier's risk rating is High."],
  ["4", "Pre-SOP window", "Planned inside the 60 days before the project's SOP, or after the SOP."],
  ["5", "Overdue", "More than 7 days past the due date."],
], [600, 2400, 6638]));
body.push(table(["Production risk", "Rule"], [
  ["High", "Two or more indicators"], ["Medium", "One indicator"], ["Low", "No indicator"],
], [2400, 7238]));
body.push(P("Indicators 1–3 are the module's own risk rule (on its Impact Sheet a change is High only when all three apply). The dashboards add indicators 4 and 5 and use a lower threshold, so a change can read **Medium on its Impact Sheet and High on the dashboards**. The status Open on its own never creates risk.", { spacing: { before: 120, after: 120 } }));
body.push(H2("4.6  Priority score"));
body.push(table(["Component", "Points"], [
  ["Production risk — High", "2"], ["Production risk — Medium", "1"],
  ["Financial materiality — annualised impact of ₹2 Cr or more (absolute)", "2"],
  ["Financial materiality — ₹50 L or more", "1"],
], [7000, 2638]));
body.push(P("Score 3–4 = **High** priority, 2 = **Medium**, 0–1 = **Low**. Closed changes show no priority. The High-impact tab ranks active, priced changes by this score and then by the size of the impact.", { spacing: { before: 120, after: 120 } }));
body.push(H2("4.7  Dependencies"));
body.push(table(["Dependency", "Open when"], [
  ["Supplier offer outstanding", "The change is at the Supplier Offers stage and the offer is not locked."],
  ["Validation not complete", "The change is at the Validation stage."],
  ["Tooling not released", "The change has a one-time tooling cost and is Pending approval, Approved or Returned for rework."],
], [3300, 6338]));
body.push(gap());
body.push(H2("4.8  SOP window"));
body.push(P("The pre-SOP window is the 60 days before a project's SOP. The 'next SOP' is the earliest project SOP after the data date (Taigun, 1 Mar 2027). No project has reached its SOP at the data date, so the number of changes affecting vehicles already in production is 0."));

/* ================== 5 DASHBOARDS ================== */
body.push(H1("5  Dashboard reference"));
body.push(P("Each dashboard section lists its layout, then every KPI card and every visual. Interaction notes use these words: **click** (opens or filters), **hover** (tooltip or detail card), **drill-down** (navigates to another page)."));

/* ---- 5.1 Overview ---- */
body.push(H2("5.1  Overview"));
body.push(P("**Purpose.** The executive summary: how many changes there are, where they stand, where the risk is, what needs attention now and what management should consider. Detailed analysis lives on the other pages."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header (title, subtitle, data-as-of, illustrative chip) and the filter bar."));
body.push(bullet("Five KPI cards."));
body.push(bullet("A row of four panels: Changes by status · Changes by type · Changes by project · Production impact."));
body.push(bullet("Changes needing attention (one table, two tabs)."));
body.push(bullet("Key insights & recommendations (six cards)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Total changes", "Number of changes in the selection; second line gives the number of projects and how many are in the live workflow.", "Count of register rows after filters.", "Opens the Change Register."],
  ["Open changes", "Changes still being evaluated, validated, priced or analysed. Second line: % of total.", "Status = Open.", "Change Register filtered to Open."],
  ["Pending approvals", "Changes waiting for a decision. Second line: how many are past the 3-day target (red), otherwise % of total.", "Status = Pending approval; overdue = waiting longer than 3 days at the current step.", "Change Register filtered to Pending approval."],
  ["Approved changes", "Approved, waiting for implementation. Second line: % of total.", "Status = Approved (implemented changes are counted separately).", "Change Register filtered to Approved."],
  ["Implemented", "Closed changes. Second line: % of total.", "Status = Implemented.", "Opens Implementation."],
], [1700, 3000, 3200, 1738]));
body.push(P("The Overview shows no rupee KPI cards by design; the financial figures are on Change Impact.", { spacing: { before: 100, after: 120 } }));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Changes by status", "Donut with legend", "Share of changes per status. Centre shows the total. The legend lists all six statuses with count and % so the slices add up to the total.", "Click a slice or legend row to filter the page by that status (click again to clear)."],
  ["Changes by type", "Horizontal bars", "Number and % of changes per category (Cost Reduction, Design Change, Supplier Change, Quality Improvement, Regulatory, Other), largest first. Only categories present in the data appear.", "Click a bar to filter by that type."],
  ["Changes by project", "Stacked horizontal bars", "One bar per project, split by status (Implemented, Approved, Pending approval, Open, Returned for rework, Rejected). The number at the right is the project total; segment labels appear when the segment is wide enough.", "Click a project row to filter by project."],
  ["Production impact", "Risk bar plus four facts", ["Bar: active changes split High / Medium / Low production risk. **Risk here means production risk (section 4.5)**: how many of five warning signs apply to a change that is still active — price up more than 3%, a late milestone with a supplier commitment at risk, a High-risk supplier, planned inside the 60 days before SOP (or after), more than 7 days overdue. High = two or more signs, Medium = one, Low = none.", "Facts: (1) High-risk changes and their share of active changes; (2) changes affecting in-production vehicles — 0 because no project has reached SOP, with the first SOP date; (3) changes that still need implementation before the next SOP, and how many are planned inside the 60-day window or later; (4) changes with unresolved supplier offer, validation or tooling, with the split."], "Hover the info icon beside the title for a card that lists the five warning signs, how many active changes show each one, and the High / Medium / Low counts. No drill-down."],
  ["Changes needing attention", "Table with two tabs", ["Tab **High-impact changes**: active, priced changes ranked by the priority score, then by the size of the impact; top 6.", "Tab **Overdue changes**: changes past a due date, ordered by priority then days overdue; top 6.", "Both tabs use the same columns: Change (part and ID), Project, Type, Current stage (with status), Impact / yr, Production risk, Days overdue, Owner, Priority."], ["Click a tab to switch. Click a row to open the Change detail page.", "Hover the production-risk label for a card listing the five indicators, which are flagged and any open dependencies.", "Links: 'View all in Change Register' and 'View all N overdue'."]],
  ["Key insights & recommendations", "Six tinted cards", ["Rule-based insights (no AI model). Each card shows a number badge, an icon, up to two headline figures and a one-line action:", "1 Approval — slowest approval step (most waiting, longest average wait).", "2 Decisions — savings waiting for a decision.", "3 Implementation — approved changes past their planned date.", "4 SOP — changes still open against the nearest SOP.", "5 Value — savings, additional cost and net benefit of approved and implemented changes.", "6 Dependencies — changes with open supplier, validation or tooling items."], ["Click a card to open a pop-up: headline figures, what the data shows, why it matters, what management could do, the changes behind it (up to 8) and a button to the related page.", "Close with ×, Close, Esc or the backdrop."]],
], [1700, 1500, 3938, 2500]));
body.push(gap());
body.push(H3("Insight rules"));
body.push(table(["Insight", "Appears when", "Content"], [
  ["Approval", "At least one approval step has two or more changes waiting.", "The step with the longest average wait; number waiting, average wait against the 3-day target, overdue count; action: ask the approver role to clear the queue or delegate."],
  ["Decisions", "Pending or returned changes with a saving exist.", "Number, total yearly saving waiting, how many are past target; action: decide the two largest first."],
  ["Implementation", "Approved changes are Delayed.", "Number delayed and the saving not yet in effect; action: confirm tooling, PO and drawing release; re-plan."],
  ["SOP", "Active changes exist for the project with the nearest SOP.", "Days to SOP, active changes, those inside the 60-day window; action: bring forward or drop late-planned changes, or freeze scope."],
  ["Value", "Approved or implemented priced changes exist.", "Savings, additional cost, net, in effect versus awaiting implementation; action: track implemented changes against purchase-order prices."],
  ["Dependencies", "Active changes have open dependencies.", "Count by supplier offer, validation and tooling, with the one-time tooling not yet released; action: coordinate supplier, SRM and plant."],
], [1700, 3300, 4638]));

/* ---- 5.2 Change Impact ---- */
body.push(H2p("5.2  Change Impact"));
body.push(P("**Purpose.** The financial view: what the approved and implemented changes save or cost per year, what is already in effect, what is still forecast, and where the value sits (project, status, type, individual change)."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header and filter bar; five KPI cards in one row."));
body.push(bullet("Row: Financial impact overview (waterfall) · Net impact by project."));
body.push(bullet("Row: Financial Impact by Status · Impact by change type."));
body.push(bullet("Largest financial impacts (table, five rows per page)."));
body.push(bullet("A link to the per-change Impact Sheet of a live change, for the detailed MOD-sheet comparison."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated"], [
  ["Annualized savings", "Yearly recurring saving of approved and implemented changes. Second line: how many changes it comes from.", "Sum of the annualised impacts of approved + implemented changes that lower the piece price."],
  ["Additional cost", "Yearly recurring cost of approved and implemented changes that raise the piece price.", "Sum of the annualised impacts of approved + implemented changes that raise the piece price."],
  ["Net impact", "Savings − additional cost, with + for a net saving.", "Savings − additional cost (same scope, same basis, ₹)."],
  ["In effect", "Net run-rate of implemented changes. Second line: number of implemented changes.", "Net of the implemented part only. Realised-to-date savings are not available (no purchase-order actuals)."],
  ["Open changes, forecasted", "Forecast of the changes that are not approved yet: the net yearly saving (+) or cost (−) of the open, pending and returned changes that already have a price. Second line: 'N priced · M not yet priced' — N changes counted, M still without a price (not counted).", "Net of Open (priced), Pending approval and Returned for rework changes. Not part of any headline."],
], [1900, 4000, 3738]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Financial impact overview", "Waterfall", "Three bars, in ₹ per year: Savings (green, from 0 up), Additional cost (red, hanging down from the savings level) and Net impact (from 0). The scale spans the lowest and highest point, so a net below zero stays inside the chart; labels sit above a bar, or below it when the bar is negative. Scope: approved + implemented.", "Hover the info icon for the scope and formula."],
  ["Net impact by project", "Diverging bars", "One row per project with priced changes: additional cost to the left (red), savings to the right (green), net at the far right (green or red).", "Hover a project row for a small card with its additional cost, savings and net impact."],
  ["Financial Impact by Status", "Table + summary card", ["Rows: Implemented (in effect), Approved (awaiting implementation), Forecast (open, pending, returned). Columns: Changes, Savings / yr, Additional cost / yr, Net / yr.", "Summary card: 'Total pipeline' (sum of the three rows' changes) and 'Total net impact / yr' — **this total includes the forecast row**, which the card states."], "Hover the info icon: approved benefit is not realised benefit."],
  ["Impact by change type", "Table + summary card", "One row per category with approved or implemented changes: Changes, Savings, Additional cost, Net. Summary card: total changes and total net of approved + implemented (equal to the Net impact card).", "None."],
  ["Largest financial impacts", "Table with column filters", ["All priced, non-rejected changes by absolute annualised impact, 5 per page. Columns: Change (part and ID), Reason, Project, Type, Piece price, Impact / yr, One-time tooling, Status."], ["Click a column heading to sort; click its funnel to filter by value (counts shown); 'Rows per page' 10 / 25 / 50; pagination.", "Click a row to open the Change detail page."]],
], [1800, 1400, 3938, 2500]));

/* ---- 5.3 Implementation ---- */
body.push(H2p("5.3  Implementation"));
body.push(P("**Purpose.** Planned implementation dates, which changes are late or at risk, and how the plan sits against each project's SOP."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header and filter bar; five KPI cards in one row."));
body.push(bullet("Implementation timeline (Gantt-style, 12 months)."));
body.push(bullet("Implementation register (table, five rows per page)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated"], [
  ["To implement", "Approved changes waiting for implementation (price, BOM, PO and drawing to update).", "Status = Approved."],
  ["Delayed", "Changes whose planned date has passed.", "Not implemented and planned date < data date."],
  ["At risk", "Changes likely to miss their date or land too close to SOP.", "Rule in section 4.4 (45 days and not approved; pre-SOP window; tooling due within 60 days)."],
  ["Due in 30 days", "Changes due soon.", "Not delayed, planned date within the next 30 days."],
  ["Implemented", "Closed changes; second line: how many finished after the planned date.", "Status = Implemented."],
], [1900, 4000, 3738]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Implementation timeline", "Gantt-style timeline", ["Window: 12 months starting one month before the data date; month labels on top; a dashed 'Today' line.", "One row per project, ordered by SOP date, with the number of changes and the SOP date. A light bar spans the first to the last planned date of the project.", "One diamond per change at its planned implementation date: green On track, amber At risk, red Delayed, grey Implemented. A black bar marks the project's SOP when it falls inside the window. Changes planned later than the window are counted in the legend note."], ["Hover a diamond: card with the change, status and timing, **why** it has that status (the exact rule that fired), project, SOP and days between plan and SOP, status and stage, owner, impact and open dependencies.", "Hover a project name: counts by implementation status, SOP, next planned change and how many fall in the pre-SOP window.", "Click a diamond to open the Change detail page."]],
  ["Implementation register", "Table with column filters", "Changes with a planned date that are not yet implemented, delayed first then by date. Columns: Change, Reason, Project, Status (Delayed / At risk / On track), Planned, Days (late or to go), Project SOP, Open dependencies, Stage.", "Sort by heading; filter by value from the funnel (counts shown); 5 rows per page with pagination and rows-per-page; click a row to open the Change detail page."],
], [1800, 1500, 3838, 2500]));

/* ---- 5.4 Change Register ---- */
body.push(H2p("5.4  Change Register"));
body.push(P("**Purpose.** The full list of changes with only the essential columns. Everything else is one click away on the Change detail page."));
body.push(H3("Elements"));
body.push(table(["Element", "What it shows and how it works"], [
  ["Filter bar", "The four shared filters (section 2.3)."],
  ["All / Overdue only toggle", "'Overdue only' keeps the changes that are past a due date. The Overview link 'View all N overdue' opens the register in this mode."],
  ["Register table", ["Eight columns with fixed widths, so nothing shifts when filters change: Change ID (with request form and 'live workflow' for the five live changes), Project, Description (part and reason), Type, Status, Impact / yr (+ saving, − additional cost, or 'not priced'), Priority, Days overdue.", "Ten rows per page with pagination and rows-per-page (10 / 25 / 50)."]],
  ["Column filters and sorting", "Click a heading to sort; click its funnel to filter by value; applied filters appear as chips with 'Clear all filters'."],
  ["Row click", "Opens the Change detail page."],
  ["Priority note", "A line under the table repeats the priority score rule (section 4.6)."],
], [2500, 7138]));

/* ---- 5.5 Detail ---- */
body.push(H2p("5.5  Change detail page"));
body.push(P("**Purpose.** Everything about one change on one page. It opens from any table row, timeline diamond or insight pop-up."));
body.push(H3("Navigation"));
body.push(bullet("The breadcrumb shows the path you came by, for example **Technical Change › Overview › AEKO-2026-0169 — Wheel Nut**. The middle part is a link back to that page."));
body.push(bullet("The subtle **Back to …** link above the breadcrumb returns to the page you came from (see section 2.4)."));
body.push(bullet("For one of the five live changes the page offers 'Open in the change workflow'; for generated records it states that there is no workflow behind them."));
body.push(H3("Elements"));
body.push(table(["Element", "What it shows", "How it is calculated"], [
  ["Action bar chips", "Status, production risk, priority, change type and request form.", "Sections 4.1, 4.5, 4.6. Risk and priority are hidden for closed changes."],
  ["Card — Annualised impact", "Yearly saving (green) or additional cost (red).", "Section 4.2."],
  ["Card — Piece price", "Piece-price change in %; second line: one-time tooling.", "Change against today's piece price."],
  ["Card — Planned implementation", "Planned date and status with days to go or days late.", "Section 4.4."],
  ["Card — Production risk", "High / Medium / Low, with how many of the five indicators are flagged.", "Section 4.5."],
  ["Where the change is", "The seven approval steps as chevrons (done, current in amber, ahead), with a sentence such as 'Waiting for Quality approval — M. Singh since 28 Jul' and the due date or days overdue.", "Approval step and dates of the change."],
  ["Change details", "Part, part number, vertical, project, supplier, owner and role, current stage, reason.", "Register fields."],
  ["Risk and dependencies", "The five indicators (flagged items marked) and open dependencies as chips.", "Sections 4.5 and 4.7."],
  ["Schedule", "A vertical timeline of raised, in current stage since, due, planned implementation and project SOP, with a dashed 'Today' marker; overdue and at-risk dates are coloured.", "Dates of the change."],
  ["Financial impact", "Basis (in effect, approved, forecast or rejected), one-time tooling and a step-by-step build-up of the yearly figure: price today, price after the change, quantity per car, annual volume, annualised saving or cost.", "Section 4.2. For live changes, whose figures come from the MOD sheet, a general formula note is shown instead of the build-up. Appendix A has an example."],
], [2300, 4300, 3038]));

/* ================== 6 limitations ================== */
body.push(H1("6  Limitations and what is not available"));
body.push(bullet("**Illustrative data.** 60 of 65 changes are generated; dates, owners, categories, price changes and tooling costs are illustrative. Platform data (parts, suppliers, volumes, prices, SOP dates) is the prototype's own."));
body.push(bullet("**No realised savings.** 'In effect' is a calculated run-rate of implemented changes. Realised-to-date savings need purchase-order actuals."));
body.push(bullet("**No period-over-period comparison.** The dashboards show no change against a previous quarter or month: no history exists."));
body.push(bullet("**No month-by-month financial series.** Impacts are annualised run-rates."));
body.push(bullet("**Approval durations.** Only the waiting time of changes still waiting is measured; completed decisions are not timed."));
body.push(bullet("**In-production vehicles.** The count is 0 because no project has reached its SOP at the data date."));
body.push(bullet("**Risk rule differs from the Impact Sheet.** The dashboards use a five-indicator rule with High at two or more; the Impact Sheet of a live change uses only the first three indicators with High at three. A change can therefore read differently on the two screens."));
body.push(bullet("**Forecast is not approved.** The 'Total pipeline' net on Change Impact includes the forecast row; the headline KPI cards never do."));
body.push(bullet("**Unpriced changes.** Open changes before the MOD stage have no rupee figure and are not counted in financial totals."));
body.push(bullet("**No AI engine.** The insights are rule-based and say so on the page."));

/* ================== Appendices ================== */
body.push(H1("Appendix A — Worked example of an annualised impact"));
body.push(P("Change **AWE-2026-0184 — Door Trim Panel** (Process optimisation, SKODA Slavia), a generated register record."));
body.push(table(["Step", "Value", "Note"], [
  ["Piece price today", "₹6,627", "Platform part price."],
  ["Change of the piece price", "−9.3%", "The change lowers the price."],
  ["Piece price after the change", "₹6,011", "₹6,627 × (1 − 0.093)."],
  ["Quantity per car", "4", "Pieces of this part per car."],
  ["Annual volume (Slavia, 2026)", "31,000 cars", "Car-volume master."],
  ["Annualised impact", "₹7.64 Cr saving per year", "(₹6,627 − ₹6,011) × 4 × 31,000 ≈ ₹7.64 Cr."],
], [3300, 2800, 3538]));
body.push(P("The change is Pending approval, so it counts in the Forecast row, not in Savings. When it is approved it moves into the headline savings; when it is implemented it counts as in effect.", { spacing: { before: 120, after: 120 } }));
body.push(H1n("Appendix B — Colours and status legend"));
body.push(table(["Colour", "Used for"], [
  ["Blue", "Open status"],
  ["Amber", "Pending approval status; At risk; Medium risk; the approval bottleneck"],
  ["Green", "Approved status; On track; savings; Low risk"],
  ["Dark green", "Implemented status; net impact"],
  ["Red", "Rejected status; Delayed; High risk; additional cost; overdue"],
  ["Grey", "Returned for rework; Implemented marker on the timeline; neutral items"],
], [2400, 7238]));
body.push(gap());
body.push(H1n("Appendix C — Approval steps and approver roles"));
body.push(table(["Step", "Approver role", "Due after reaching the step"], [
  ["1  Engineering", "AEKO Coordinator", "3 days"],
  ["2  Quality", "Approver", "3 days"],
  ["3  SRM", "SRM", "3 days"],
  ["4  Finance", "Finance", "3 days"],
  ["5  Commodity", "Commodity Manager", "3 days"],
  ["6  Management", "Project Manager", "3 days"],
  ["7  Final confirmation", "AEKO Coordinator", "3 days"],
], [3300, 3300, 3038]));

body.push(H1n("Appendix D — Revision history"));
body.push(table(["Version", "Date", "Change"], [
  ["1.0", "27 Oct 2026", "First issue: glossary, business rules, and every KPI card and visual of the five dashboards and the Change detail page."],
  ["1.1", "27 Oct 2026", "Change Impact — Net impact by project: hover card per project showing additional cost, savings and net (section 5.2). Revision history added."],
  ["1.2", "28 Oct 2026", "Change detail — 'Where the change is' now shows the full lifecycle (Preparation, Approval, Implementation, Closed) with a detail row; approved changes are shown in Implementation, so a delayed approved change no longer looks complete. Glossary: Phase (lifecycle)."],
  ["1.3", "28 Oct 2026", "Navigation: one subtle back link ('Back to …') on every page header, replacing the separate back buttons of the Procurement detail pages and the Change detail page (section 2.4)."],
  ["1.3.1", "28 Oct 2026", "Change Impact, Approval Workflow and Implementation now show five KPI cards in one row (dropped: One-time tooling, Approved, Tooling not released; sections 5.2–5.4). Approval workflow status redrawn smaller with the reference icons and connectors, no average wait, and a Bottleneck note that is no longer a link (section 5.3)."],
  ["1.4", "28 Oct 2026", "Change Impact — Forecast, not approved KPI card: clearer second line ('per year if all N priced changes are approved · M unpriced') and tooltip."],
  ["1.5", "28 Oct 2026", "Change Impact — the word 'Forecast' replaced by 'Not yet approved' (KPI card, Financial Impact by Status row, glossary and rules); card second line simplified to 'per year, from N changes not approved yet'."],
  ["1.6", "28 Oct 2026", "Change Impact — wording reverted to 'Forecast'; the KPI card is now labelled 'Open changes, forecasted' with the second line 'N priced · M not yet priced'."],
  ["1.7", "29 Oct 2026", "The Approval Workflow dashboard page is removed (menu entry, page, and its panels: approval workflow status, rejected and returned for rework, decisions waiting). Links that pointed to it now open the Change Register filtered to Pending approval (Pending approvals card, Approval and Decisions insights). Sections 5.4–5.6 renumbered 5.3–5.5; glossary: Bottleneck, Decisions waiting, Escalation removed."],
  ["1.8", "29 Oct 2026", "Overview — Production impact: the panel now explains what 'risk' means (five warning signs; High = two or more, Medium = one, Low = none) in its info text, the legend and the High-risk line (section 5.1, section 4.5)."],
  ["1.9", "29 Oct 2026", "Overview — Production impact: the info icon beside the panel title now opens a hover card (same style as the other Overview tooltips) listing the five warning signs with the number of active changes showing each one, and the High / Medium / Low counts for the current filters (section 5.1)."],
], [1100, 1700, 6838]));
body.push(P("Keep this table up to date: add a row each time a dashboard, KPI card, visual, rule or glossary term changes.", { spacing: { before: 120, after: 120 } }));

/* ================== DOCUMENT ================== */
const doc = new Document({
  creator: "SKODA AIS prototype team", title: "Technical Change Management Dashboards — Glossary and KPI reference",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: BRAND, font: FONT }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: INK, font: FONT }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: BRAND, font: FONT }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [
    { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } },
  ] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1300, right: MARGIN, bottom: 1200, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 4 } }, tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }], children: [new TextRun({ text: "SKODA AIS · Technical Change Management", font: FONT, size: 17, color: MUTED }), new TextRun({ text: "\tGlossary and KPI reference", font: FONT, size: 17, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }], children: [new TextRun({ text: "Illustrative prototype data — not SKODA actuals", font: FONT, size: 17, color: MUTED }), new TextRun({ text: "\tPage ", font: FONT, size: 17, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: MUTED })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2], buf); console.log("written", process.argv[2], buf.length); });
