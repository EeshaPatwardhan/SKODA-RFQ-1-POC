# (exec'd by build_e7.py with rep() in scope) — route every approval through the Flow module (src/e7_workflow.js)

# ----------------------------------------------------------------------------- expose the closure helpers Flow needs
rep(r'''let CF_TAB = "prices"; // prices | approvals | risk''',
    r'''let CF_TAB = "prices"; // prices | approvals | risk
window.__setCfTab = function(v){ CF_TAB = v; };''')
rep(r'''function openCRReview(cr, canApprove){''',
    r'''window.__applyCR = applyCR;
function openCRReview(cr, canApprove){''')
rep(r'''function buildCommodityForex(){''',
    r'''window.__applyCommodity = applyCommodityApproval;
function buildCommodityForex(){''')
rep(r'''// Build the enriched task centre from the existing seed + extra events,''',
    r'''TASK_TYPES["approval-result"] = {label:"Approval result", icon:"\u{1F4EC}"};
window.TASK_TYPES = TASK_TYPES;
// Build the enriched task centre from the existing seed + extra events,''')

# ----------------------------------------------------------------------------- change requests
rep(r'''      DATA.tasks.unshift({icon:"\u2705", title:`Approve change request \u2014 ${subject}`, meta:`Change Requests \u2022 ${type}`, role:"approver", due:"Due in 1d", wf});
      Notif.updateBadge();
      Store.audit("Change Request","initiated",`${wf} \u2022 ${type} \u2022 ${subject}`);
      setTimeout(()=>Router.render(),40);
      Toast.show(`${wf} created \u2014 routed to ${highValue?'Approver \u2192 Management':'Approver'}.`,"success");''',
    r'''      Store.audit("Change Request","initiated",`${wf} \u2022 ${type} \u2022 ${subject}`);
      Flow.startCR(cr);
      setTimeout(()=>Router.render(),40);''')
rep(r'''if(b) openCRReview(rows.find(r=>r.id===b.dataset.cr), canApprove);''',
    r'''if(b) Flow.reviewCR(rows.find(r=>r.id===b.dataset.cr));''')

# ----------------------------------------------------------------------------- commodity / FX changes
rep(r'''      DATA.tasks.unshift({icon:"\u2705", title:`Approve ${isC?'commodity':'FX'} change \u2014 ${label}`, meta:`Commodity & Forex \u2022 ${newVal} eff ${ap.effectiveFrom}`, role:"approver", due:"Due today", wf});
      Notif.updateBadge();
      Store.audit(isC?"Commodity":"Exchange Rate","change submitted for approval",`${label} \u2192 ${newVal} (${wf})`);
      CF_TAB="approvals";
      setTimeout(()=>Router.render(),40);
      Toast.show(`Change ${wf} submitted${highValue?" \u2014 high move, routed via Management":""}.`,"success");''',
    r'''      Store.audit(isC?"Commodity":"Exchange Rate","change submitted for approval",`${label} \u2192 ${newVal} (${wf})`);
      Flow.startCommodity(ap);
      CF_TAB="approvals";
      setTimeout(()=>Router.render(),40);''')
rep(r'''else if(CF_TAB==="approvals") wrap.appendChild(cfApprovalsView(canApprove));''',
    r'''else if(CF_TAB==="approvals") wrap.appendChild(Flow.commodityView());''')

# ----------------------------------------------------------------------------- task centre + approvals screen
rep(r'''panel.querySelectorAll("[data-open]").forEach(b=> b.onclick=()=>Router.go("approvals"));''',
    r'''panel.querySelectorAll("[data-open]").forEach(b=> b.onclick=()=>Flow.openByWf(b.dataset.open));''')
rep(r'''  const canAct = RBAC.role==="approver"||RBAC.role==="admin"||RBAC.role==="pm";
  ApprovalEngine.flows.forEach(f=>{''',
    r'''  Flow.sortedFlows().forEach(f=>{''')
rep(r'''      if(canAct && (cur.role===RBAC.role||RBAC.role==="admin"||RBAC.role==="pm")){''',
    r'''      if(Flow.canAct(f)){''')
rep('''        act.innerHTML = `<span class="chip chip-amber"><span class="chip-dot"></span>Awaiting ${ROLES.find(r=>r.id===cur.role)?.label||cur.role} \u2014 switch role to act</span>`;'''.replace("\\u2014","\u2014"),
    r'''        act.innerHTML = Flow.awaitingHtml(f);''')

# ----------------------------------------------------------------------------- change request form: current price comes from the record; Price History is read-only (prices change through a change request)
rep(r'''      document.getElementById("cr-free-row").style.display = partEl.value==="__other"?"block":"none";
    };
    typeEl.onchange=sync; partEl.onchange=sync; sync();''',
    r'''      document.getElementById("cr-free-row").style.display = partEl.value==="__other"?"block":"none";
      Flow.prefillCurrent(partEl.value);
    };
    typeEl.onchange=sync; partEl.onchange=sync; sync();''')
rep(r'''  if(canWrite){ const b=document.createElement("button"); b.className="btn btn-primary"; b.textContent="+ Record price change"; b.onclick=()=>openPriceDrawer(PRICE_ACTIVE); bar.appendChild(b); }
''', '')
