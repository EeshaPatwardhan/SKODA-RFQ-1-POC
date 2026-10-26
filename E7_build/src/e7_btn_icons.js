/* =====================================================================
   E7 / V8  ·  Button icons — every action button gets a matching line icon
   One pass over every `.btn` (present now, and added later by any screen, drawer or notification) picks an icon from the button's wording,
   swaps the loose emoji / "+" / "→" that some labels carried for the same icon, and leaves buttons that already have an icon, icon-only
   buttons and segmented filters alone.  Nothing in the screens' own code had to change.
   ===================================================================== */
const BtnIcons=(function(){
"use strict";
const OWN={
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  "arrow-right":'<path d="M5 12h14M13 6l6 6-6 6"/>', "arrow-left":'<path d="M19 12H5M11 6l-6 6 6 6"/>', "arrow-up":'<path d="M12 19V5M5 12l7-7 7 7"/>', "arrow-up-right":'<path d="M7 17 17 7M8 7h9v9"/>',
  save:'<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  play:'<path d="m6 4 14 8-14 8z"/>', "user-plus":'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'
};
const SYS=new Set(["plus","check","check-circle","x","x-circle","download","upload","send","edit","refresh","sparkles","lock","bell","alert","undo","users","search","clipboard-check","file","history","calendar","settings","list","trend-up"]);
function svg(name){
  if(OWN[name]) return `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true">${OWN[name]}</svg>`;
  if(SYS.has(name)&&typeof Icons!=="undefined") return Icons.svg(name).replace(/class="i[^"]*"/,'class="bi"');
  return null;
}
/* wording → icon (first match wins).  `r:true` puts the icon after the label (navigation arrows). */
const RULES=[
  [/^(approve|sign\b|confirm|verify|accept|mark done|done\b|all good|yes\b|use )/,"check-circle"],
  [/^(reject|decline|deny)/,"x-circle"],
  [/^(cancel|close|dismiss|clear|remove filter|reset filter|no thanks|no,)/,"x"],
  [/^(delete|remove|discard)|^✕/,"trash"],
  [/^(save|apply\b|store)/,"save"],
  [/^(escalate)/,"arrow-up"],
  [/^(remind|notify|schedule|alert me)/,"bell"],
  [/^(lock)/,"lock"],
  [/^(export|download|print|get (csv|excel|pdf))|\b(csv|xlsx|excel|pdf)\b/,"download"],
  [/^(mass[- ]?upload|upload|import|attach|drop)/,"upload"],
  [/^(send|trigger|distribute|forward|submit|route|publish|share)/,"send"],
  [/^(ask|generate|ai\b|explain|summar|run ai|draft)/,"sparkles"],
  [/^(re-?fetch|refresh|reload|recalc|re-?run|sync|update prices)/,"refresh"],
  [/^(reset|undo|revert|return|↩)/,"undo"],
  [/^(fire|start|run|launch|begin|resume|test)/,"play"],
  [/^(parse|read|scan)/,"file"],
  [/^(assign|re-?assign|add (stakeholder|user|owner))/,"user-plus"],
  [/^(edit|modify|change|rename|amend)/,"edit"],
  [/^(review|preview|inspect|peek|show details)/,"eye"],
  [/^(\+|add|new|create|initiate|record|register|raise|open new)/,"plus"],
  [/^(back|previous|prev|←)/,"arrow-left"],
  [/^(view|open|go to|show|see|full|all |details|connect|next|continue|proceed|open in)/,"arrow-right",true],
  [/^(search|find|filter)/,"search"]
];
const LEAD=/^[\s\p{Extended_Pictographic}️‍+✓✔✍✦✕↻↩⬆⬇➤➕→←‹›]+/u;
const SKIP="#rc-root,.fc-segs,.fc-seg,.v8-stk,.tc-flow,.cbd-filters,.v8-filters,.table-toolbar,.v8-asof,.nav-item,#module-switcher,.chip,.ai-suggestion-chip,[data-no-icon]";
function pick(text){
  const t=text.toLowerCase();
  for(const r of RULES){ if(r[0].test(t)){ const n=r[1]; if(!svg(n)) continue; return {name:n,right:!!r[2]}; } }
  return null;
}
function decorate(el){
  if(el.dataset.bi) return; el.dataset.bi="1";
  if(el.closest(SKIP)||el.querySelector("svg,img,.bi")) return;
  const tn=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.trim()); if(!tn) return;
  let t=tn.textContent.replace(LEAD,"").trim(); if(!t) return;
  const trailingArrow=/\s*→\s*$/.test(t); const clean=t.replace(/\s*→\s*$/,"");
  const hit=pick(clean)||(trailingArrow||/›\s*$/.test(t)?{name:"arrow-right",right:true}:/^[+➕]/.test(tn.textContent.trim())?{name:"plus"}:null); if(!hit) return;
  const html=svg(hit.name); if(!html) return;
  const right=hit.right||trailingArrow;
  tn.textContent=right?clean+" ":" "+clean;
  const holder=document.createElement("span"); holder.innerHTML=html; const icon=holder.firstChild;
  if(right) el.appendChild(icon); else el.insertBefore(icon,tn);
  el.classList.add("has-bi");
}
function scan(root){
  if(!root||root.nodeType!==1) return;
  if(root.matches&&root.matches("button.btn,a.btn,.btn")) decorate(root);
  root.querySelectorAll&&root.querySelectorAll("button.btn,a.btn,.btn").forEach(decorate);
}
let queued=[], timer=0;
const mo=new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType===1) queued.push(n); })); if(!timer) timer=setTimeout(()=>{ timer=0; const q=queued; queued=[]; q.forEach(scan); },10); });
mo.observe(document.body,{childList:true,subtree:true});
scan(document.body);
return {scan,decorate,pick,svg};
})();
