/* Supplier Readiness Management (SRM) reference document — glossary, business rules, every KPI card and visual of the nine SRM screens.
   Generated: node make_srm_reference_doc.js out.docx  ->  python fix_docx_package.py out.docx ../SRM_Dashboards_Reference.docx
   Same helpers and styling as make_tc_reference_doc.js. Keep Appendix D up to date when an SRM screen, KPI card, visual or rule changes. */
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
body.push(new Paragraph({ spacing: { before: 2600, after: 120 }, children: [new TextRun({ text: "SKODA AIS  ·  SRM module", font: FONT, size: 24, color: BRAND, bold: true })] }));
body.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Supplier Readiness Management Dashboards", font: FONT, size: 60, bold: true, color: INK })] }));
body.push(new Paragraph({ spacing: { after: 500 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 10 } }, children: [new TextRun({ text: "Glossary, business rules, KPI cards and visuals — reference document", font: FONT, size: 30, color: MUTED })] }));
body.push(table(["Item", "Detail"], [
  ["Application", "SKODA AIS prototype V8 (SAVWIPL_prototype_V8.html) — SRM → Dashboards & reports · Parts, tools & milestones · Alerts & approvals"],
  ["Screens covered", "Overview · Part Readiness · Status Tracking · Supplier Performance · Part Assignment · Tool Readiness · Milestone Tracking · Readiness (R / Y / G) · Alerts & Escalations · Part drawer"],
  ["Data status", "**Illustrative prototype data.** 480 parts, 6 projects, 20 suppliers, 10 verticals. Milestone dates, supplier commitments, tool plans, owners and scores are generated; parts, projects, suppliers and SOP dates are platform data. Reference (data) date: 29 July 2026."],
  ["Version", "1.0 — 29 October 2026 (revision history in Appendix D)"],
  ["Audience", "Management, product owners, SRM engineers, reviewers and anyone who needs to explain a figure on these screens"],
], [2400, 7238]));
body.push(gap());
body.push(note("**How to use this document.** Section 2 explains where the numbers come from and how the filters and clicks behave. Section 3 is the glossary. Section 4 lists every business rule and threshold in one place. Section 5 walks through each screen: every KPI card and every visual, with what it shows, how it is calculated and how it behaves when clicked. Section 6 lists the limitations. Terms in **bold** inside a definition have their own entry."));

/* ---- contents ---- */
body.push(H1("Contents"));
[
  ["1", "Purpose and scope"], ["2", "Data foundation, filters and navigation"], ["3", "Glossary"], ["4", "Business rules and thresholds"],
  ["5", "Screen reference"], ["5.1", "Overview"], ["5.2", "Part Readiness"], ["5.3", "Status Tracking"], ["5.4", "Supplier Performance"],
  ["5.5", "Part Assignment"], ["5.6", "Tool Readiness"], ["5.7", "Milestone Tracking"], ["5.8", "Readiness (R / Y / G)"], ["5.9", "Alerts & Escalations"], ["5.10", "Part drawer (shared)"],
  ["6", "Limitations and what is not available"],
  ["A", "Appendix A — Worked example: required date, slip, status and readiness"], ["B", "Appendix B — Colours and status legend"], ["C", "Appendix C — Roles, approvals and escalation levels"], ["D", "Appendix D — Revision history"],
].forEach(([n, t]) => body.push(new Paragraph({ spacing: { after: 70 }, indent: { left: n.includes(".") ? 500 : 0 }, children: [new TextRun({ text: n + "   ", bold: true, color: BRAND, font: FONT, size: 22 }), new TextRun({ text: t, font: FONT, size: 22, bold: !n.includes(".") })] })));

/* ---- 1 purpose ---- */
body.push(H1("1  Purpose and scope"));
body.push(P("Supplier Readiness Management (SRM) answers one question for every project: **will our suppliers and their tools be ready on the dates the project needs them, before start of production (SOP)?** The SRM module follows each part through five milestones, compares the date the project **requires** with the date the supplier has **committed to**, and turns the gap into a status, a readiness percentage, a next action and an owner."));
body.push(P("The module has nine screens. Four are dashboards for reading and comparing; five are operational screens where SRM engineers assign people, watch tools, track milestone dates, review the traffic light and act on alerts. All nine share the same filter bar, the same header and the same row of five KPI cards."));
body.push(table(["Screen", "Group in the menu", "The question it answers"], [
  ["Overview", "Dashboards & reports", "Where do we stand overall, and what needs attention first?"],
  ["Part Readiness", "Dashboards & reports", "How ready are the parts and tools, by vertical and by stage, and which parts are at risk?"],
  ["Status Tracking", "Dashboards & reports", "Where does each project stand against its milestone chain, and which milestones are slipping?"],
  ["Supplier Performance", "Dashboards & reports (menu label “Performance”)", "Which suppliers are on track, and which need a conversation?"],
  ["Part Assignment", "Parts, tools & milestones", "Who is responsible for each part, and where is a role still open?"],
  ["Tool Readiness", "Parts, tools & milestones", "How far has each tool got, when is its trial, and how much of the investment is spent?"],
  ["Milestone Tracking", "Parts, tools & milestones", "For each part and milestone: required date versus supplier commitment, and which date amendments await approval?"],
  ["Readiness (R / Y / G)", "Parts, tools & milestones", "Which of seven readiness dimensions is weak, and which parts are red, yellow or green?"],
  ["Alerts & Escalations", "Alerts & approvals", "Which milestones are about to be missed, who has been reminded, and who has it been escalated to?"],
], [2300, 2900, 4438]));
body.push(P("**Not covered here:** the Reports screens, the shared Approvals inbox, the Technical Change module and the Procurement module. Material-cost and commodity views live in Procurement → Forecast & risk.", { spacing: { before: 120, after: 120 } }));

/* ---- 2 data foundation ---- */
body.push(H1("2  Data foundation, filters and navigation"));
body.push(H2("2.1  One evaluated list feeds every screen"));
body.push(bullet("The prototype holds **480 parts** across **6 projects** (Kushaq, Slavia, Kylaq, Taigun, Virtus, Kodiaq), **20 suppliers** and **10 verticals** (Powertrain, Chassis, Body Stampings, Electrical, Lighting, Sensors, HVAC, Interior Trim, Braking, Fasteners)."));
body.push(bullet("Every part is evaluated once, as of the data date (29 July 2026). The evaluation gives it a status, a next milestone, a readiness percentage, a stage and — if it needs tools — a tool status. All screens read that same list, so a figure on one screen always agrees with the same figure on another."));
body.push(bullet("The model is deterministic: the same inputs always give the same numbers. It can also be evaluated for an earlier date; that is how the six-month supplier trend is produced."));
body.push(H2("2.2  What is real and what is generated"));
body.push(table(["Real platform data", "Generated for this prototype (flagged “Illustrative data” in the header)"], [
  [["Parts, project and supplier masters", "Verticals", "Project SOP dates", "Forecast price moves (used in the part drawer and Key insights)"],
   ["The milestone chain of each project (offsets from its SOP date)", "The change type of each part (35% facelift, 40% model-year change, 25% AEKO running change) and the part-level SOP date for the last two", "Each part's supplier-commitment slip", "Which parts need tools, how many (1–4) and their cavities", "Tool numbers, makers, dates and CAPEX", "Supplier delivery and quality scores and the SRM owner of each supplier", "Stakeholder names and open roles", "Date amendments and alert reminder counts", "R / Y / G dimension scores"]],
], [3800, 5838]));
body.push(H2("2.3  Filters shared by all nine screens"));
body.push(P("Every screen shows the same bar: a car picture (the selected project's car, or the model line-up when no project is chosen), five dropdown filters and a round reset button. Beside the title are the data-as-of date and an “Illustrative data” chip."));
body.push(table(["Filter", "Lists", "What it does"], [
  ["Project", "The six projects", "Limits every figure to that project's parts. The car picture changes with the choice."],
  ["Supplier", "The 20 suppliers", "Limits every figure to that supplier's parts."],
  ["Brand", "The brands on the project master", "Limits to the projects of that brand. Choosing a brand that does not contain the chosen project clears the project."],
  ["Vertical", "The 10 verticals", "Limits to one vertical."],
  ["SOP Year", "The years of the parts' SOP dates", "Limits to parts whose own SOP date falls in that year (facelift parts use the project SOP date; model-year and AEKO parts have their own date)."],
  ["Reset button", "—", "Clears all five filters."],
], [1700, 2900, 5038]));
body.push(gap());
body.push(table(["Where the filters apply", "Project, Supplier, Vertical", "Brand, SOP Year"], [
  ["Overview, Part Readiness, Status Tracking, Supplier Performance", "Yes", "Yes"],
  ["Part Assignment, Tool Readiness, Milestone Tracking, Readiness (R / Y / G), Alerts & Escalations", "Yes", "**No** — shown in the bar but not applied (see section 6)"],
], [4838, 2300, 2500]));
body.push(P("**Exception.** Part Readiness → “Readiness by vertical” always shows all verticals, so it ignores the Vertical, Brand and SOP Year filters (Project and Supplier still apply).", { spacing: { before: 100, after: 120 } }));
body.push(H2("2.4  Clicks, hover cards and tables"));
body.push(bullet("**KPI cards** with a link are marked by a pointer: Suppliers in scope opens Supplier Performance; Parts in scope and Open actions open Part Readiness; Milestones at risk opens Status Tracking."));
body.push(bullet("**Clicking a project or supplier row** on the Overview, or a bubble or row on Supplier Performance, opens the target screen **without applying any filter**. Use the filter bar on the target screen to narrow it."));
body.push(bullet("**Clicking a part row** anywhere opens the part drawer (section 5.10)."));
body.push(bullet("**Hover cards** explain a point without cluttering the screen (timeline diamonds, scatter bubbles, project rows, stage cards, open-action rows)."));
body.push(bullet("**Filterable tables** (Open actions, At-risk parts, All suppliers, Assignments, Tool register, part tracker, amendments, parts R / Y / G, alert list): the funnel beside a column heading opens a list of that column's values with counts; tick the ones to keep. The options of a column follow the filters on the other columns. Every table pages at 10, 25 or 50 rows. Where sorting is on, clicking the heading label sorts and clicking again reverses."));

/* ---- 3 glossary ---- */
body.push(H1("3  Glossary"));
body.push(P("Terms are listed alphabetically. Terms in **bold** inside a definition have their own entry."));
body.push(table(["Term", "Definition"], [
  ["0-Series", "Fourth **milestone**: PPAP approved. Required 40 days before **SOP**."],
  ["AEKO running change", "A running engineering change on a part already in series. One of three **change types**; has its own part-level **SOP** date."],
  ["Alert", "An automatic warning for a **milestone** that is late or about to be missed: 6 weeks, 4 weeks, 2 weeks before, or overdue (section 4.9)."],
  ["Amendment (milestone)", "A request to change a part's supplier-committed date. The earlier date stays visible, struck through, until the amendment is approved (section 4.10)."],
  ["Approved (tool)", "A tool whose trial has passed and which has shipped to the series plant (completion 100%)."],
  ["At risk", "**Status**: the supplier's commitment is 11 to 30 days later than the required date."],
  ["B-Release", "First **milestone**: design release. Required 198 days before **SOP**."],
  ["Behind plan (tools)", "Tools that are At risk plus tools that are Delayed."],
  ["Brand", "The brand recorded on the project master. A filter."],
  ["CAPEX (tooling)", "The investment committed for a tool, in rupees. **Spent** = CAPEX × the tool's completion. Generated for the prototype."],
  ["Change type", "Why a part is in SRM scope: **Facelift**, **Model-year change** or **AEKO running change**."],
  ["Commitment (supplier)", "The date the supplier has committed to reach a **milestone**. Required date + **slip**."],
  ["Data as of", "The reference date for every status and figure (29 July 2026 in the prototype)."],
  ["Delayed", "**Status**: the supplier's commitment is more than 30 days later than the required date."],
  ["Delivery performance", "On-time delivery score of a supplier for the last six months (%). Generated."],
  ["Dimension (readiness)", "One of seven aspects in the **R / Y / G** view: Engineering, Quality, Tooling, Capacity, Material, Logistics, Production."],
  ["Escalation", "Passing an **alert** to a higher level: Supervisor, Head of SRM or Management (section 4.9)."],
  ["Facelift", "A **change type**: the project's facelift. The part uses the project's **SOP** date."],
  ["Gate (project milestone)", "One **milestone** of one project (for example PVS for Taigun). Its status comes from the share of that project's started facelift parts that are late (section 4.6)."],
  ["Illustrative data", "Data generated to demonstrate the screens, not SKODA actuals."],
  ["Key insight", "A rule-based recommendation card on the Overview. No AI model is involved (section 5.1)."],
  ["KTM expert / Buyer / SRM engineer / QE / Logistics / Tool owner", "The six stakeholder roles of a part (Part Assignment). KTM expert and buyer follow the project and supplier masters; the other four can be assigned. Tool owner applies only to parts that need tools."],
  ["Milestone", "One of five checkpoints on the way to **SOP**: **B-Release**, **VFF**, **PVS**, **0-Series**, SOP (section 4.1)."],
  ["Model-year change", "A **change type**: a model-year change with its own part-level **SOP** date."],
  ["Monitoring", "A part is monitored once it has **started** (or when someone starts it by hand). Reminders and alerts begin with monitoring."],
  ["Next action", "The standard next step for the part's **next milestone**. For **Delayed** parts it is prefixed “Escalate — recovery call:”. Shown as the columns Action and Next step."],
  ["Next milestone", "The earliest **milestone** of a part that is still ahead of the **data as of** date."],
  ["Not started", "The part's nomination is not yet due, so it has no **status**. Not counted in statuses or readiness."],
  ["On track", "**Status**: the supplier's commitment is no more than 10 days later than required."],
  ["Open action", "One per started part that is **At risk** or **Delayed**."],
  ["Overall supplier readiness", "The average **readiness** of all started parts in the selection (%)."],
  ["Overdue (alert)", "The **milestone** date has passed and the part has not reached the stage the plan expected by then."],
  ["Part", "One part number from the platform part master."],
  ["Part SOP", "The SOP date of a part: the project's SOP for **facelift** parts, its own date for the other two **change types**."],
  ["Plan attainment", "For tools: how close the tool's progress is to plan. 100% on or ahead of plan, 0% when 40 or more days late."],
  ["PPAP", "Production Part Approval Process. Approval of PPAP is the 0-Series **milestone**."],
  ["PVS", "Third **milestone**: samples approved. Required 86 days before **SOP**."],
  ["Quality performance", "Quality score of a supplier for the last six months (%). Generated."],
  ["R / Y / G", "Red / Yellow / Green traffic light of a part, rolled up from seven **dimensions** (section 4.8)."],
  ["Readiness (part)", "How close the supplier's commitment is to the required date: 100% when on or ahead of date, 0% when 40 or more days late (section 4.4)."],
  ["Readiness stage", "Where a part really is: Planning / Nomination, Development, Tooling, Sample Build, PPAP or SOP readiness (section 4.5)."],
  ["Required date", "The date a **milestone** must be reached: the part's **SOP** date minus the milestone's offset."],
  ["Slip", "Commitment minus required date, in days. Plus means later than required, minus means earlier."],
  ["SOP", "Start of production. The last **milestone**, with offset 0."],
  ["SOP year", "The calendar year of a part's SOP date. A filter."],
  ["Started part", "A part whose plan has begun, that is, from 500 days before its **SOP**. Only started parts have a status and a readiness (section 4.3)."],
  ["Status (part)", "On track, At risk, Delayed or Not started. The worst status among the part's upcoming **milestones** (section 4.2)."],
  ["Supplier commitment", "See **Commitment**."],
  ["Tool", "A physical tool for a part. A part can need one to four tools; tools are counted individually."],
  ["Tool stage", "How far a tool has got: Not started, Design, Build, Trial or Approved (section 4.7)."],
  ["Tooling investment", "The total **CAPEX** of the tools in the selection, with the share spent."],
  ["Tooling readiness", "The average **plan attainment** of the parts whose tools have started (%)."],
  ["VFF", "Second **milestone**: tools ready. Required 151 days before **SOP**."],
  ["Vertical", "A platform grouping of parts (Powertrain, Chassis, …). Ten verticals."],
  ["Weekly digest", "A consolidated e-mail sent every Monday to each SRM engineer listing the engineer's alerts."],
], [2600, 7038]));

/* ---- 4 rules ---- */
body.push(H1("4  Business rules and thresholds"));
body.push(H2("4.1  The milestone chain"));
body.push(P("Every project has the same five milestones. The required date of a milestone is the part's SOP date minus the offset. The plan share is how much of the supplier-readiness work the plan expects to be done by that date."));
body.push(table(["Milestone", "What must be true", "Days before SOP", "Plan share done"], [
  ["B-Release", "Design release", "198", "30%"],
  ["VFF", "Tools ready", "151", "55%"],
  ["PVS", "Samples approved", "86", "75%"],
  ["0-Series", "PPAP approved", "40", "92%"],
  ["SOP", "Series readiness", "0", "100%"],
], [2000, 3000, 2300, 2338]));
body.push(P("Each milestone has a standard next step (the “Next step” in Open actions): B-Release — confirm design release and drawing freeze with the supplier; VFF — confirm tooling availability and tool trial date; PVS — expedite sample build and validation; 0-Series — review PPAP documents and quality issues; SOP — confirm SOP capacity and logistics readiness.", { spacing: { before: 100, after: 120 } }));
body.push(H2("4.2  Status — one per started part"));
body.push(table(["Slip at a milestone", "Milestone status"], [
  ["10 days or less (including earlier than required)", "On track"],
  ["11 to 30 days", "At risk"],
  ["More than 30 days", "Delayed"],
], [5400, 4238]));
body.push(bullet("A part's **status** is the worst status among its **upcoming** milestones (those not yet past the data date). If no milestone is left ahead, the part is On track."));
body.push(bullet("The part's **next milestone** is the earliest upcoming one. Its slip drives the part's readiness."));
body.push(bullet("Parts that have not started have no status; they appear as “Not started”."));
body.push(H2("4.3  Started and not started"));
body.push(P("A part is **started** once the plan has begun: from 500 days before its SOP. The plan curve below gives the share of the work the plan expects to be done at each point; between points it is linear."));
body.push(table(["Days before SOP", "500", "400", "198", "151", "86", "40", "0"], [
  ["Plan share done", "0%", "10%", "30%", "55%", "75%", "92%", "100%"],
], [2038, 1100, 1100, 1100, 1100, 1100, 1000, 1100]));
body.push(H2("4.4  Readiness of a part"));
body.push(P("Readiness = 100% − (slip of the next milestone ÷ 40 days), limited to 0–100%, and counted only when the slip is positive. In words: 100% when the supplier's commitment is on or ahead of the required date, falling in a straight line to 0% when it is 40 or more days late. A part with a 10-day slip has 75%. Averages (the project, vertical, supplier or portfolio readiness) are the plain average over the **started** parts."));
body.push(H2("4.5  Readiness stage"));
body.push(P("The stage is where the part actually is, read off the plan curve at the part's real progress (its plan position moved by its slip). A part belongs to the last stage whose threshold it has reached."));
body.push(table(["Stage", "Reached at"], [
  ["Not started", "Below the first step — the plan has not begun"],
  ["Planning / Nomination", "Any progress"],
  ["Development", "10% of the work done"],
  ["Tooling", "30%"],
  ["Sample Build", "55%"],
  ["PPAP", "75%"],
  ["SOP readiness", "92%"],
], [4000, 5638]));
body.push(H2("4.6  Status of a project milestone (gate)"));
body.push(P("Only the project's **facelift** parts that have started are used (parts with their own SOP date follow their own timeline). For one milestone:"));
body.push(bullet("**Delayed** when 20% or more of those parts are Delayed on that milestone."));
body.push(bullet("**At risk** when 30% or more are not On track, or 10% or more are Delayed."));
body.push(bullet("**On track** otherwise. **Not started** when none of the project's facelift parts has started."));
body.push(P("The **Milestones at risk** card counts the milestones still ahead whose status is At risk or Delayed. **Avg slip** on a gate is the average slip of those parts."));
body.push(H2("4.7  Supplier and tooling rules"));
body.push(table(["Rule", "Definition"], [
  ["Supplier readiness", "Average readiness of the supplier's started parts."],
  ["Ranked supplier (Overview)", "A supplier needs at least **5 started parts** before it is ranked or counted as “below 60%” on the Overview. Supplier Performance lists every supplier and counts any supplier below 60%, so its figure can be higher (6 against 5 at the data date)."],
  ["Readiness bands", "80% or more green · 60–79% amber · below 60% red."],
  ["Delivery and quality", "Generated scores (45–99% and 50–99%) derived from the supplier's reliability. Not from a scorecard feed."],
  ["Six-month trend", "The supplier's readiness recomputed at each of the last six month-ends."],
  ["Tool plan", "Tools start 380 days before SOP and are planned complete by the VFF milestone (151 days before SOP)."],
  ["Tool status", "Same slip thresholds as a milestone: 10 days or less On plan, 11–30 At risk, more than 30 Delayed. **Approved** when completion is 100%. **Not yet due** before the tool plan starts."],
  ["Tool stage", "By completion: below 25% Design · below 65% Build · below 100% Trial · 100% Approved. Not started before the plan begins."],
  ["Tool location", "Toolmaker — design · Toolmaker — build · Supplier plant — trial · Series plant · Not yet released."],
  ["Tooling readiness", "Average plan attainment (100% − slip ÷ 40 days) of parts whose tools have started."],
  ["Tooling investment", "Sum of CAPEX; spent = CAPEX × completion."],
  ["Stage card colour (Part Readiness)", "Red when 20% or more of the stage's tools are Delayed, amber when any tool is behind plan, green otherwise. Approved is dark green, Not started grey."],
], [2700, 6938]));
body.push(H2("4.8  R / Y / G readiness"));
body.push(bullet("Each part has seven **dimensions**: Engineering, Quality, Tooling, Capacity, Material, Logistics, Production."));
body.push(bullet("A dimension's **score** = 100 − 2.5 × days late, limited to 0–100. Tooling uses the tool's own slip."));
body.push(table(["Score", "Dimension colour"], [["75 or more", "Green"], ["25 to 74", "Yellow"], ["Below 25", "Red"]], [4000, 5638]));
body.push(bullet("**Overall**: Red if any dimension is Red; otherwise Yellow if three or more dimensions are Yellow; otherwise Green. The part's score is the average of its seven scores."));
body.push(bullet("Dimension scores are generated from each part's slip, with small adjustments for supplier quality, reliability and origin (see section 6)."));
body.push(H2("4.9  Alerts and escalation"));
body.push(table(["Alert level", "Raised when"], [
  ["6 weeks", "A milestone is 29–42 days away and the supplier's commitment is late (status not On track)."],
  ["4 weeks", "15–28 days away and late."],
  ["2 weeks", "14 days or less away and late."],
  ["Overdue", "The milestone date has passed and the part has not reached the stage the plan expected."],
], [2200, 7438]));
body.push(gap());
body.push(table(["Escalation rule", "Result"], [
  ["Overdue alert with 3 or more reminders", "Escalated to the Supervisor."],
  ["Overdue alert with 6 or more reminders", "Escalated to Management."],
  ["Any alert reaching 4 reminders", "Escalated to the Head of SRM."],
  ["Manual “Escalate” button", "Moves the alert to the next level and writes an audit entry."],
], [4600, 5038]));
body.push(H2("4.10  Date amendments"));
body.push(bullet("A part's milestone with a supplier commitment **more than 8 days late** may carry an amendment request."));
body.push(bullet("Supervisor requests go to the **Project Manager**; Commodity Lead requests go to the **Commodity Manager**. The Admin role can decide any of them."));
body.push(bullet("The earlier date stays visible, struck through, until the amendment is approved."));
body.push(bullet("Approving or rejecting writes an audit entry; decisions live in the page session and reset on reload."));

/* ---- 5 screens ---- */
body.push(H1("5  Screen reference"));
body.push(P("Each screen starts with the header and the shared filter bar (section 2.3), then five KPI cards in one row, then the panels. The tables below follow the screen from top to bottom."));

/* ---- 5.1 Overview ---- */
body.push(H2("5.1  Overview"));
body.push(P("**Purpose.** The management summary: how many suppliers and parts are in scope, how ready they are, which milestones are at risk, which suppliers lag and what needs action now. The other screens hold the detail."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header (title “Supplier Readiness Management (SRM)”, data-as-of, illustrative chip) and the filter bar."));
body.push(bullet("Five KPI cards."));
body.push(bullet("Milestone health by project · Supplier readiness (side by side)."));
body.push(bullet("Readiness by stage · Key insights (side by side, equal width and height)."));
body.push(bullet("Open actions — highest priority (full width)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Suppliers in scope", "Number of suppliers with parts in the selection. Second line: how many are below 60% readiness (red) or “None below 60% readiness”.", "Distinct suppliers. “Below 60%” counts only suppliers with at least 5 started parts.", "Opens Supplier Performance."],
  ["Parts in scope", "Number of parts. Second line: started and not started.", "Parts after the filters; not started = nomination not yet due.", "Opens Part Readiness."],
  ["Overall supplier readiness", "Average readiness of started parts, coloured by band. Second line: “Average of started parts”.", "Section 4.4. 100% = next commitment on or ahead of date; 0% = 40 or more days late.", "—"],
  ["Milestones at risk", "Project milestones still ahead that are delayed or at risk. Second line: delayed and at-risk counts.", "Gate status, section 4.6. On-track gates are not counted.", "Opens Status Tracking."],
  ["Open actions", "Started parts that are at risk or delayed. Second line: delayed and at-risk counts.", "One action per part.", "Opens Part Readiness."],
], [1900, 2900, 3100, 1738]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Milestone health by project", "Table of status shares", ["One row per project: share of started parts that are On track, At risk and Delayed (the three add up to 100%) and the number of started parts.", "Each started part is counted once, by its worst upcoming milestone. Sorted by highest delayed share first. Legend at the top right."], "Hover card: SOP date, parts in scope, started parts, on track, at risk, delayed, not started. Click opens Status Tracking."],
  ["Supplier readiness", "Ranked table", ["Suppliers from lowest to highest readiness: rank, supplier, started parts, readiness bar and %, at-risk and delayed part counts.", "Only suppliers with 5 or more started parts. 7 rows per page."], "Pager under the table. Click a row opens Part Readiness. “View all” opens Supplier Performance."],
  ["Readiness by stage", "Horizontal bars", "Parts at each readiness stage today: Not started plus the six stages, with count and share of parts in scope. This is where parts are now, not a cumulative funnel.", "Information only."],
  ["Key insights", "Wide cards, 3 per page", "Rule-based recommendations (table below). Each card: priority pill, headline, one line of detail, tags, a stat box and an Ask AIS button.", "Pager in the panel header. Click a card opens the related screen; the sparkle button asks AIS."],
  ["Open actions — highest priority", "Filterable table", ["Every at-risk or delayed part, one row each: Action, Next step, Part, Project, Supplier, Owner, Due (date and “in N d”), Status. Delayed first, then nearest milestone. The count sits beside the title.", "Action and Next step are the two halves of the part's next action."], "Filter and sort from any heading; 10 / 25 / 50 per page. Hover shows owner, next and late milestone, tooling and part SOP. Click a row opens the part drawer. “View all” opens Part Readiness."],
], [1700, 1500, 3938, 2500]));
body.push(gap());
body.push(H3("Key insight rules"));
body.push(table(["Insight", "Appears when", "Content and priority"], [
  ["Cluster at risk", "Some vertical has started parts that are not On track on a milestone still ahead.", "**High.** The vertical and milestone with the most such parts, the supplier with most of them and what the milestone requires. Stat: parts at risk. Opens Part Readiness."],
  ["Suppliers below 60%", "At least one supplier with 5 or more started parts is below 60% readiness.", "**Medium.** The three lowest with their readiness. Stat: number of suppliers. Opens Supplier Performance."],
  ["Tooling behind plan", "At least one tool is At risk or Delayed.", "**Medium.** Parts affected, tools in all, the supplier with most affected parts, parts more than 30 days behind. Stat: parts. Opens Part Readiness."],
  ["Project with most delays", "A project with 10 or more started parts has delayed parts.", "**High** when 20% or more of its started parts are delayed, otherwise Medium. Stat: share delayed. Opens Status Tracking."],
  ["Late and rising price", "At-risk or delayed parts have a forecast price rise above 5%.", "**Medium.** Count, average rise and the largest. Stat: parts. Opens the forecast parts view."],
], [1900, 3300, 4438]));

/* ---- 5.2 Part Readiness ---- */
body.push(H2p("5.2  Part Readiness"));
body.push(P("**Purpose.** How ready the parts and tools are, by vertical and by stage, and which parts are at risk."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header, filter bar and five KPI cards."));
body.push(bullet("Readiness by vertical (full width, with Total strip)."));
body.push(bullet("Tools by stage (full width)."));
body.push(bullet("At-risk parts (filterable table)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Parts in scope", "Number of parts. Second line: suppliers and not-started parts.", "Parts after the filters.", "—"],
  ["On track", "Started parts that are On track. Second line: % of started parts.", "Status, section 4.2.", "—"],
  ["At risk", "Started parts that are At risk. Second line: “10–30 days late”.", "Status, section 4.2. Amber when above zero.", "—"],
  ["Delayed", "Started parts that are Delayed. Second line: “more than 30 days late”.", "Status, section 4.2. Red when above zero.", "—"],
  ["Tooling readiness", "Average plan attainment of tools that have started. Second line: parts with tooling and number of tools.", "Section 4.7. Coloured by band.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Readiness by vertical", "Two tables side by side (or one)", ["Per vertical: parts, on track, at risk, delayed, not started and readiness as a coloured percentage (green 80% or more, amber 60–79%, red below 60%). 5 verticals on the left, 5 on the right. Each vertical has a round icon.", "Header: legend and a “2 columns / 1 column” switch.", "**Total strip** under the tables: total parts and each status, and an overall readiness bar."], "Click a vertical opens a popup (below). Ignores the Vertical, Brand and SOP Year filters."],
  ["Popup: vertical by change type", "Modal window", ["Header: icon, vertical name, number of parts.", "**Scope breakdown:** a bar and three blocks for Facelift, Model-year change and AEKO running change with parts and % of total; a Parts / Percentage switch changes the bar labels.", "**Readiness by change type:** per change type, a one-line reason for being in scope and parts, on track, at risk, delayed, not started and readiness."], "Close with ✕, Esc or a click outside. Scrolls on short windows."],
  ["Tools by stage", "Stage track and five cards", ["Header: tools on parts, % approved (count) and tools behind plan.", "A numbered track of five stages: Not started, Design, Build, Trial, Approved. Each stage card shows the number of tools and two lines: **On plan** (Not yet due for the first stage) and **Behind plan**.", "Stage colour by the rule in section 4.7."], "Hover card: tools by status (on plan, at risk, delayed, not yet due) and the parts at that stage by status."],
  ["At-risk parts", "Filterable table", ["Started parts that are at risk or delayed: Part, Project, Vertical, Supplier, Next milestone, Required by, Supplier commitment (slip and date), Status, Suggested next action, Owner.", "Delayed first, then at risk, nearest milestone first."], "Filter every column; 10 / 25 / 50 per page. Click a row opens the part drawer."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.3 Status Tracking ---- */
body.push(H2p("5.3  Status Tracking"));
body.push(P("**Purpose.** Where each project stands against its milestone chain, using the project's facelift parts."));
body.push(H3("Layout, top to bottom"));
body.push(bullet("Header, filter bar and five KPI cards."));
body.push(bullet("Project timeline."));
body.push(bullet("Upcoming milestones."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Milestones ahead", "Project milestones still ahead of the data date. Second line: the next one (milestone, project, date).", "Count of milestones with a required date on or after the data date, over the projects in scope.", "—"],
  ["On track", "Of those, how many are On track. Second line: “supplier commitments in time”.", "Gate status, section 4.6.", "—"],
  ["At risk", "Gates At risk. Second line: “some parts forecast late”.", "Gate status, section 4.6.", "—"],
  ["Delayed", "Gates Delayed. Second line: “20%+ of parts late”.", "Gate status, section 4.6.", "—"],
  ["Avg slip at next milestone", "Average slip of started parts at their next milestone, in days, with sign. Second line: number of started parts.", "Mean of each started part's next-milestone slip.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Project timeline", "Timeline (one row per project)", ["Each row runs from 500 days before the project's SOP to the SOP, with the part already elapsed shaded. Five diamonds mark the milestones, coloured by gate status (green, amber, red, grey). A dashed red “Today” line shows the data date. Only milestones are drawn; no forecast is shown.", "Month ticks every quarter."], "Hover a diamond: milestone and project, what it requires, status, required date (and how far away), supplier commitment, parts late, average slip. **Click a diamond opens the milestone drawer.**"],
  ["Milestone drawer", "Panel opening on the right", ["For the project and milestone clicked: header with status; three cards (Required by, Parts late, Average slip with commitment date); **Status by vertical** (bars per vertical and a summary of on track / at risk / delayed); **Average slip by supplier** (bars, up to 8 suppliers, in days; amber and red past the thresholds).", "Uses that project's facelift parts only. Parts whose date has passed count as met. If no part has started it says so."], "Close from the drawer's close button."],
  ["Upcoming milestones", "Table", "The next 8 milestones ahead across the projects, earliest first: Project, Milestone (with what it requires), Required, In (days), Status, Parts late (“n of N”).", "Information only."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.4 Supplier Performance ---- */
body.push(H2p("5.4  Supplier Performance"));
body.push(P("**Purpose.** Readiness, delivery and quality per supplier: who is on track and who needs a conversation."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Suppliers", "Suppliers with parts in the selection. Second line: how many are international.", "Distinct suppliers (origin from the supplier master).", "—"],
  ["Avg readiness", "Average of the suppliers' readiness. Second line: suppliers at 80% or more.", "Average over suppliers that have started parts.", "—"],
  ["Avg delivery", "Average on-time delivery, last six months.", "Mean of the suppliers' delivery scores (generated).", "—"],
  ["Avg quality", "Average quality performance, last six months.", "Mean of the suppliers' quality scores (generated).", "—"],
  ["Below 60% readiness", "Suppliers below 60% readiness; the second line names the first two.", "No minimum number of parts (unlike the Overview).", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Delivery vs quality", "Bubble chart, full width", ["One bubble per supplier: delivery % across, quality % up. Bubble size = number of parts; colour = readiness band (green 80%+, amber 60–79%, red below 60%). The five lowest suppliers are labelled."], "Hover card: supplier, origin, parts, readiness badge, delivery, quality, on track / at risk / delayed, SRM owner. Click opens Part Readiness (no filter applied)."],
  ["All suppliers", "Filterable table", ["One row per supplier: Supplier (with origin), Parts, On track, At risk, Delayed, Readiness bar, 6-month trend (small line), Delivery, Quality, SRM owner. Sorted by readiness, highest first. The count sits beside the title.", "Delivery and quality filter by band (90%+, 80–89%, below 80%); readiness by band; trend as Improving, Steady or Declining (change of 2 points or more over six months)."], "Filter every heading; 10 per page. Click a row opens Part Readiness."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.5 Part Assignment ---- */
body.push(H2p("5.5  Part Assignment"));
body.push(P("**Purpose.** Who is responsible for each part's readiness, and where a stakeholder role is still open."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Parts tracked", "Number of parts. Second line: number of projects.", "Parts after the filters.", "—"],
  ["Monitoring active", "Parts under monitoring. Second line: parts not yet started.", "Started parts plus parts started by hand in this session.", "—"],
  ["Fully staffed", "Parts with every role assigned. Second line: % of parts.", "No open role among the six.", "—"],
  ["With gaps", "Parts with at least one open role. Second line: “a role is unassigned”.", "Roles QE, Logistics or Tool owner can be open.", "—"],
  ["SRM engineers", "Number of SRM engineers in the selection. Second line: average parts each.", "Distinct SRM owners over the parts.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Workload by SRM engineer", "Ranked rows", "Per engineer (initials and name): share of the parts and number of parts. A marker shows engineers more than 15% above the average. The sentence on top gives the average.", "Information only."],
  ["Unassigned roles", "Ranked rows", "For QE, Logistics and Tool owner: parts with that role open and % of parts. The sentence on top gives the total parts with a gap.", "Click a role lists the parts with that gap."],
  ["Assignments", "Filterable table", ["One row per part: Part, Supplier, KTM expert, Buyer, SRM engineer, QE, Logistics, Tool owner, Monitoring. Quick buttons: All parts, Gaps only, Not monitored."], "Click a row opens **Assign stakeholders**: choose the SRM engineer, QE, logistics and tool owner and tick “Start monitoring”. Allowed for the SRM, Project Manager and Admin roles; saving writes an audit entry."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.6 Tool Readiness ---- */
body.push(H2p("5.6  Tool Readiness"));
body.push(P("**Purpose.** Tool register: kick-off, trial, completion and investment for every tool."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Tools tracked", "Number of tools. Second line: parts that need tooling.", "Each tool counted individually; a part has 1–4.", "—"],
  ["Avg completion", "Average completion of tools in progress.", "Mean completion % over tools that have started.", "—"],
  ["Approved", "Tools whose trial has passed. Second line: “trial passed, shipped”.", "Tools with completion 100%.", "—"],
  ["At risk / delayed", "Tools behind plan. Second line: at-risk and delayed counts.", "Section 4.7.", "—"],
  ["Tooling investment", "Total CAPEX in ₹ crore. Second line: % spent and the amount.", "Sum of CAPEX; spent = CAPEX × completion.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Tooling readiness", "Big % with bar", "Plan attainment of tools that have started, tools in progress and parts started, and rows for parts On track, At risk, Delayed and Not yet due.", "Information only."],
  ["Tool status by project", "Stacked bars", "Per project: tools On track (approved tools count as on track), At risk, Delayed and Not started.", "Information only."],
  ["Tooling investment — committed vs spent", "Bars per project", "Per project: amount spent out of the amount committed (₹ crore). Generated CAPEX.", "Information only."],
  ["Where the tools are", "Ranked bars", "Five locations (toolmaker design, toolmaker build, supplier plant trial, series plant, not yet released) with count and % of tools.", "Information only."],
  ["Trials in the next 60 days", "Table", "The five nearest tool trials: Tool, Part (with project), Trial date. A note gives how many more are in the register.", "Click a row opens the part drawer."],
  ["Tool register", "Filterable table", "One row per tool: Tool, Part, Supplier, Type, Tool maker, Cavities, Kick-off, Trial, Completion, Status, Location, First parts. Quick buttons: All, At risk, Delayed, Approved.", "Filter every heading; click a row opens the part drawer."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.7 Milestone Tracking ---- */
body.push(H2p("5.7  Milestone Tracking"));
body.push(P("**Purpose.** Required date versus supplier commitment for every started part and milestone; amended dates stay visible until approved."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Parts tracked", "Started parts. Second line: parts not started.", "Parts with a status.", "—"],
  ["Milestone dates due in 30 days", "Milestone dates falling in the next 30 days. Second line: “across all parts”.", "Count of started parts' milestones with a required date within 30 days.", "—"],
  ["Amendments awaiting approval", "Date amendments with no decision. Second line: the approvers.", "Amendments in status Pending.", "—"],
  ["<Milestone> — avg slip", "Average slip of the milestone chosen in the tracker, in days. Second line: parts with it still ahead.", "Mean slip over started parts that have that milestone ahead.", "—"],
  ["<Milestone> — parts late", "Parts that are not On track on the chosen milestone. Second line: “of N”.", "Status At risk or Delayed on that milestone.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Part tracker", "Filterable table with milestone switch", "Choose one of the five milestones. Rows: Part, Supplier, Required, Supplier commitment, Slip, Status, Amendment. An amended date shows the old date struck through.", "Filter every heading; click a row opens the part drawer."],
  ["Milestone amendments", "Filterable table", "Part, Milestone, Date change (old → new and days), Requested (date and who), Approver, Status, Decision. Approver rule in section 4.10.", "Approve / Reject buttons appear for the role allowed to decide; a decision writes an audit entry."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.8 R/Y/G ---- */
body.push(H2p("5.8  Readiness (R / Y / G)"));
body.push(P("**Purpose.** Seven readiness dimensions per part, rolled up to one traffic light (rules in section 4.8)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Green", "Parts that are Green. Second line: % of the parts assessed.", "Overall Green, section 4.8. Only started parts are assessed.", "—"],
  ["Yellow", "Parts that are Yellow. Second line: “3 or more yellow dimensions”.", "Overall Yellow.", "—"],
  ["Red", "Parts that are Red. Second line: “at least one red dimension”.", "Overall Red.", "—"],
  ["Avg readiness score", "Average score of the parts. Second line: “mean of the 7 dimensions”.", "Mean of each part's seven dimension scores.", "—"],
  ["Weakest dimension", "The dimension with the lowest average score. Second line: that score.", "Lowest of the seven dimension averages.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Status by dimension", "Stacked bars", "For each of the seven dimensions: parts Green, Yellow and Red, and the total.", "Information only."],
  ["Vertical × dimension", "Heat map", "Average score (100 = on or ahead of date) for each vertical and dimension, coloured by band.", "Information only."],
  ["Weakest suppliers × dimension", "Heat map", "The ten suppliers with the lowest average score, with the seven dimension averages.", "Information only."],
  ["Parts — lowest readiness first", "Filterable table", "Part, Supplier, the seven dimension scores (coloured), Overall (Red / Yellow / Green) and Score. Dimension scores are generated from each part's slip; the tooling score uses the tool's own slip.", "Filter every heading; click a row opens the part drawer."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.9 Alerts ---- */
body.push(H2p("5.9  Alerts & Escalations"));
body.push(P("**Purpose.** Automatic alerts 6, 4 and 2 weeks before a milestone and when it is overdue, with the escalation ladder (rules in section 4.9)."));
body.push(H3("KPI cards"));
body.push(table(["Card", "What it shows", "How it is calculated", "Click"], [
  ["Open alerts", "All open alerts. Second line: parts concerned.", "Alerts over started parts' milestones.", "—"],
  ["Overdue", "Alerts whose milestone date has passed. Second line: “milestone date passed”.", "Alert level Overdue.", "—"],
  ["Within 2 weeks", "Alerts in the final reminder window.", "Alert level 2 weeks.", "—"],
  ["Within 4 weeks", "Alerts in the second reminder window.", "Alert level 4 weeks.", "—"],
  ["Escalated", "Alerts that have been escalated. Second line: how many are at management level.", "Alerts with an escalation level, section 4.9.", "—"],
], [1900, 3300, 3100, 1338]));
body.push(H3("Visuals"));
body.push(table(["Visual", "Type", "What it shows and how it is built", "Interaction"], [
  ["Alerts by cadence", "Bars", "Number of alerts per level: Overdue, 2 weeks, 4 weeks, 6 weeks.", "Click a bar filters the alert list."],
  ["Escalation ladder", "Ranked bars", "Alerts at each level: SRM engineer (reminders), Supervisor, Head of SRM, Management, with the escalation rule underneath.", "Information only."],
  ["Monday digest — alerts per engineer", "Ranked rows", "Number of alerts per SRM engineer.", "Click a name opens a preview of that engineer's weekly e-mail (subject, recipient and the alerts grouped by level)."],
  ["Alert list", "Filterable table", "Alert (level), Part, Supplier, Milestone, Due (with days), Reminders, Escalated to, Owner and two buttons. Quick buttons: All, Overdue, 2 weeks, 4 weeks, 6 weeks.", "“Remind” adds a reminder and “Escalate” moves the alert one level up; each writes an audit and e-mail-log entry. Both live in the page session."],
], [1700, 1500, 3938, 2500]));

/* ---- 5.10 Part drawer ---- */
body.push(H2p("5.10  Part drawer (shared)"));
body.push(P("**Purpose.** One place that explains a single part: why it has its status, where it really is against plan, what to do next and the evidence. Opened by clicking a part row on any screen."));
body.push(table(["Block", "Content"], [
  ["Header", "Part name, project, supplier, vertical, part number and the status chip."],
  ["Why this status", "In plain words: the milestone that sets the status, its required date, the supplier's committed date and how many days late, and how many upcoming milestones are late. For a not-started part, when tracking begins."],
  ["Three cards", "**Readiness** (% with a bar and the 100% / 0% definition) · **Stage reached** (stage, position in the six, and how many stages behind plan) · **Next milestone** (id, required date, how far away)."],
  ["Suggested next action", "The next action text with the SRM owner and priority (High for Delayed, Medium for At risk)."],
  ["Part details", "Change type and part SOP date · tooling (tools, cavities, build stage and status) · supplier scorecard (on-time delivery and quality, last 6 months) · price outlook (forecast over six months; a warning when a late supplier and a rising price coincide)."],
  ["Readiness (R / Y / G)", "The overall colour and the seven dimension scores, with the scoring rule."],
  ["Milestones table", "For each of the five milestones: required date, supplier commitment, slip and status. Past milestones read Met, Met late (with days) or Overdue."],
  ["Buttons", "“Price forecast & cost walk” opens the part’s price forecast and cost walk; “Ask AIS” asks about the part."],
], [2200, 7438]));

/* ---- 6 limitations ---- */
body.push(H1("6  Limitations and what is not available"));
body.push(bullet("**Generated data.** Supplier commitment dates, the milestone chain, tool requirements, delivery and quality scores, owners, stakeholders, amendments, reminder counts and R / Y / G dimension scores are generated. There is no commitment-sheet or scorecard feed yet. Parts, projects, suppliers and SOP dates are platform data."));
body.push(bullet("**Brand and SOP Year filters** are shown on the five operational screens (Part Assignment, Tool Readiness, Milestone Tracking, Readiness (R / Y / G), Alerts & Escalations) but are **not applied** there; Project, Supplier and Vertical are. They apply on the four dashboards."));
body.push(bullet("**Part Readiness → Readiness by vertical** ignores the Vertical, Brand and SOP Year filters by design."));
body.push(bullet("**Below 60% readiness** differs between Overview (suppliers with at least 5 started parts) and Supplier Performance (any supplier), so the two numbers can differ."));
body.push(bullet("**Gate status uses facelift parts only.** Model-year and AEKO parts carry their own SOP dates and are not part of the project timeline."));
body.push(bullet("**In-page actions** (assign, start monitoring, approve or reject an amendment, remind, escalate) change the page state and write audit entries, but reset when the page is reloaded."));
body.push(bullet("**Milestones.** The requirements name a 19-stage milestone set; five key milestones are tracked. The rest need SAVWIPL's stage list. Supplier onboarding is not built."));
body.push(bullet("**Not shown:** origin or country analysis (every supplier country on the master is India), a map, week-on-week change chips, and material-cost or commodity views (these are in Procurement → Forecast & risk)."));

/* ---- Appendices ---- */
body.push(H1("Appendix A — Worked example: required date, slip, status and readiness"));
body.push(P("Take a Taigun facelift part. Taigun's SOP is 1 March 2027."));
body.push(table(["Step", "Calculation", "Result"], [
  ["Required date of PVS", "1 Mar 2027 − 86 days", "5 Dec 2026"],
  ["Supplier commitment", "Supplier has committed to 6 Dec 2026", "Slip +1 day"],
  ["Milestone status", "Slip of 10 days or less", "**On track**"],
  ["Part readiness", "100% − 1 ÷ 40", "About 98%"],
  ["If the commitment were 9 Jan 2027", "Slip +35 days → more than 30", "**Delayed**; readiness 100% − 35 ÷ 40 = 12.5%"],
  ["Next action (delayed)", "Standard PVS step with the escalation prefix", "“Escalate — recovery call: expedite sample build and validation”"],
], [2700, 3900, 3038]));
body.push(P("A part's status uses the worst of its upcoming milestones, and its readiness uses the next milestone's slip. A project gate (for example Taigun PVS) is then judged from the share of the project's started facelift parts that are late on that milestone.", { spacing: { before: 100, after: 120 } }));

body.push(H1n("Appendix B — Colours and status legend"));
body.push(table(["Colour", "Meaning"], [
  ["Green", "On track; tool On plan or Approved; readiness 80% or more; R / Y / G Green (score 75+)."],
  ["Amber", "At risk; readiness 60–79%; R / Y / G Yellow (score 25–74); Medium priority."],
  ["Red", "Delayed; readiness below 60%; R / Y / G Red (score below 25); High priority; the “Today” line on the timeline."],
  ["Grey", "Not started or Not yet due."],
  ["Dark green", "Approved tools; the Facelift change type. Medium green and light green mark Model-year change and AEKO running change."],
], [2200, 7438]));

body.push(H1n("Appendix C — Roles, approvals and escalation levels"));
body.push(table(["Topic", "Rule"], [
  ["Who can assign stakeholders and start monitoring", "SRM, Project Manager and Admin roles. Other roles see the screen read-only."],
  ["Who decides an amendment", "Supervisor requests: Project Manager. Commodity Lead requests: Commodity Manager. The Admin role can decide either."],
  ["Escalation levels", "SRM engineer (reminders) → Supervisor → Head of SRM → Management. Rules in section 4.9."],
  ["Audit", "Every assignment, decision, reminder and escalation writes an audit entry (and an e-mail-log entry where a message would be sent)."],
], [3300, 6338]));

body.push(H1("Appendix D — Revision history"));
body.push(table(["Version", "Date", "Change"], [
  ["1.0", "29 Oct 2026", "First issue: glossary, business rules, and every KPI card and visual of the nine SRM screens and the part drawer."],
], [1100, 1700, 6838]));
body.push(P("Keep this table up to date: add a row each time an SRM screen, KPI card, visual, rule or glossary term changes.", { spacing: { before: 120, after: 120 } }));

const doc = new Document({
  creator: "SKODA AIS prototype team", title: "Supplier Readiness Management Dashboards — Glossary and KPI reference",
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
    headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 4 } }, tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }], children: [new TextRun({ text: "SKODA AIS · SRM", font: FONT, size: 17, color: MUTED }), new TextRun({ text: "\tGlossary and KPI reference", font: FONT, size: 17, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }], children: [new TextRun({ text: "Illustrative prototype data — not SKODA actuals", font: FONT, size: 17, color: MUTED }), new TextRun({ text: "\tPage ", font: FONT, size: 17, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: MUTED })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2], buf); console.log("written", process.argv[2], buf.length); });
