# Approval workflows — how routing, notifications and actions work

Applies to `SAVWIPL_prototype_V8.html` and `SAVWIPL_prototype_E7.html` (V8 adds the Technical Change chain and the SRM milestone amendments).

## The idea
Every approval is a workflow with **ordered steps, each owned by a role**. Creating the item does three things at once:
1. a **pop-up** tells you who it was sent to (name and role);
2. that role gets a **task** (🔔 bell panel, Home → My Tasks, Task Centre) and an **e-mail-log entry**; the sidebar **Approvals** badge counts it;
3. an **audit entry** is written.

To act as the next person, switch role in the top bar. Approving closes your task and creates the next one; the last step applies the change and notifies the initiator. A rejection closes the open task, logs it, and gives the initiator a rework task.

## Who gets what

| Workflow | Where you start it | Steps (role) | When the last step clears |
|---|---|---|---|
| **Change request** | Procurement → Change Requests → + Initiate | Approver → *Management sign-off (Project Mgr), only for high-value / business-share* → system | New price version, CBD re-roll, Approval Note issued; initiator notified |
| **Commodity price / FX rate** | Commodity & Forex → Submit change | Approver → *Management sign-off (Project Mgr), if the move is 5% or more* → system | New value effective-dated, every dependent CBD recalculated; submitter notified |
| **Technical change** (V8) | Technical Change → Impact Analysis → Submit to approval | Engineering (AEKO Coord.) → Quality (Approver) → SRM → Finance → Commodity → Management (Project Mgr) → AEKO confirmation | Buyer and SRM get implementation tasks; implementation then updates price history, BOM and PO |
| **Milestone amendment** (V8) | SRM → Milestone Tracking | Supervisor amendments → Project Mgr; Commodity Lead amendments → Commodity Mgr | The earlier date stays struck through; the SRM engineer is notified |
| Seeded examples | Approvals screen | as listed there | — |

Admin can act on any step (for demos). Everyone else can only act on a step owned by their role; other roles see "Awaiting <name> (<role>) — switch role to act".

## Try it (about two minutes)
1. Role **Buyer** → Change Requests → **+ Initiate change request** (price, e.g. 2,121 → 2,300) → Save. The pop-up names the Approver and Management.
2. Switch to **Approver** → the 🔔 badge went up → **Review** on the new task → *Approve (→ Project Mgr)*.
3. Switch to **Project Mgr** → Approvals (waiting items first) → **Approve & apply**.
4. Switch back to **Buyer** → a "Change request approved" notification; Procurement › Price Analysis (and Part Details) shows the new version.
5. Repeat with **Reject** at either step to see the rework task on the initiator.

## Also fixed
- "Fill your details" tasks from the sourcing import and the yearly EBON reminder were written to a list the notification centre never read; they now appear for their role.
- The 🔔 panel's **Open** button used to show a toast; it now opens the item (review drawer, approvals tab or approval chain).
- Role switch refreshes the badge and tells you how many approvals are waiting.
- After reviewing an item, the next "+ Initiate / Submit" drawer used to keep the review buttons (Approve / Reject) instead of Cancel / Save, so pressing "Save" hit the old workflow and said it was already closed. Every drawer now starts with the standard Cancel / Save footer; a click on a finished workflow now says who closed it and how.
- The change-request form now fills the **current price** from the part's latest price version (read-only), so the new price is always compared with what is on record — after an approved change, the next request starts from the new price. Price History no longer has "Record price change": prices change only through an approved change request.
