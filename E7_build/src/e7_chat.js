/* =====================================================================
   E7  ·  RadarChat — the forecasting POC's Radar chat panel, ported 1:1 to vanilla JS
   Source of truth: SKODA-forecasting-POC/dashboard/src/components/ChatWidget.tsx (+ ChatOpenScreen, ChatHistoryPanel,
   RadarSettings, ReportMode, ExportCard, SourceList, ChartCard, chatMarkdown) and src/lib/{chatHistory,radarSettings,
   snapshot,thinkingWords,tokenLabels,briefing}.ts.
   Opens from the "Ask AIS" button (AI.open) and every "Ask AIS / Why?" shortcut (Radar.open / AI.ask).
   Answers: the in-page Radar engine (e7_radar.js, offline) or — when Admin → AI Model Settings has a server URL —
   the POC's /api/chat (NDJSON), /api/briefing, /api/usage and /api/export. Same storage keys as the POC.
   ===================================================================== */
const RadarChat = (function(){
"use strict";
const P=PocCore, C=PocCharts, U=PocUI, esc=C.esc, nf=C.nf;
const HKEY="radar-chat-history-v1", SKEY="radar-settings-v1", BKEY="radar-briefing-cache-v1";
const MAX_CONV=50, MAX_TITLE=80;
const store={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

/* ------------------------------------------------------------ icons (Icons.tsx, same paths) */
const svg=(inner,cls,extra)=>`<svg class="rc-i ${cls||""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${extra||""} aria-hidden="true">${inner}</svg>`;
const RND='stroke-linejoin="round" stroke-linecap="round"';
const IC={
  gear:c=>svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16.11 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1.51H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',c),
  report:c=>svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 17v-3M12 17v-5M15 17v-2"/>',c,RND),
  history:c=>svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',c,RND),
  newchat:c=>svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',c),
  close:c=>svg('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',c),
  send:c=>svg('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',c),
  stop:c=>`<svg class="rc-i ${c||""}" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>`,
  copy:c=>svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',c),
  check:c=>svg('<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',c),
  edit:c=>svg('<path d="M12 20h9"/><path d="M16.4 3.6a1 1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.85.5l-2.9.84a.5.5 0 0 1-.62-.62l.84-2.9a2 2 0 0 1 .5-.85z"/>',c,RND),
  refresh:c=>svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',c,RND),
  globe:c=>svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',c),
  chev:c=>svg('<path d="m9 18 6-6-6-6"/>',c),
  pin:c=>svg('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',c,RND),
  trash:c=>svg('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-.87 13.14A2 2 0 0 1 16.14 21H7.86a2 2 0 0 1-1.99-1.86L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',c),
};

/* ------------------------------------------------------------ lib/chatHistory.ts */
const createId=()=>{ const c=window.crypto; return c&&typeof c.randomUUID==="function"?c.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10); };
function deriveTitle(msgs){ const f=msgs.find(m=>m.role==="user"); const t=f&&String(f.content).replace(/\s+/g," ").trim(); if(!t) return "New chat"; return t.length>MAX_TITLE?t.slice(0,MAX_TITLE-1).trimEnd()+"…":t; }
function cap(list){ if(list.length<=MAX_CONV) return list; const drop=new Set(list.filter(c=>!c.pinned).sort((a,b)=>a.updatedAt-b.updatedAt).slice(0,list.length-MAX_CONV).map(c=>c.id)); return list.filter(c=>!drop.has(c.id)); }
function upsert(list,u,deleted){
  if(!u.messages.length||(deleted&&deleted.has(u.id))) return list;
  const now=Date.now(), title=deriveTitle(u.messages);
  return cap(list.some(c=>c.id===u.id)?list.map(c=>c.id===u.id?Object.assign({},c,{title,messages:u.messages,updatedAt:now}):c):[{id:u.id,title,messages:u.messages,pinned:false,createdAt:now,updatedAt:now}].concat(list));
}
function splitFor(list){ const s=[...list].sort((a,b)=>b.updatedAt-a.updatedAt); return {pinned:s.filter(c=>c.pinned),recent:s.filter(c=>!c.pinned)}; }
function relTime(ts,now){
  now=now||Date.now(); const m=Math.floor((now-ts)/60000); if(m<1) return "Just now"; if(m<60) return m+"m ago";
  const h=Math.floor(m/60); if(h<24) return h+"h ago";
  const d=new Date(ts), n=new Date(now), y=new Date(n.getFullYear(),n.getMonth(),n.getDate()-1);
  if(d.getFullYear()===y.getFullYear()&&d.getMonth()===y.getMonth()&&d.getDate()===y.getDate()) return "Yesterday";
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
const truncForRegen=(ms,i)=>(i<1||i>=ms.length||ms[i].role!=="assistant"||ms[i-1].role!=="user")?null:ms.slice(0,i);
const truncForEdit=(ms,i,text)=>{ if(i<0||i>=ms.length||ms[i].role!=="user") return null; const t=String(text).trim(); if(!t) return null; const e={role:"user",content:t}; return ms.slice(0,i).concat([e]); };
const toApi=ms=>ms.map(m=>({role:m.role,content:m.prompt||m.content}));
function loadHistory(){ try{ const a=JSON.parse(store.get(HKEY)||"[]"); return Array.isArray(a)?a.filter(c=>c&&typeof c.id==="string"&&Array.isArray(c.messages)&&c.messages.length).map(c=>({id:c.id,title:typeof c.title==="string"?c.title:deriveTitle(c.messages),messages:c.messages,pinned:c.pinned===true,createdAt:+c.createdAt||Date.now(),updatedAt:+c.updatedAt||Date.now()})):[]; }catch(e){ return []; } }
const DEFAULTS={snapshot:true,news:true,situations:true,liveNews:true};
function loadSettings(){ const o=Object.assign({},DEFAULTS); try{ const p=JSON.parse(store.get(SKEY)||"null"); if(p&&typeof p==="object") Object.keys(DEFAULTS).forEach(k=>{ if(typeof p[k]==="boolean") o[k]=p[k]; }); }catch(e){} return o; }

/* ------------------------------------------------------------ lib/situations.ts, thinkingWords.ts */
const SITUATIONS=Radar.SUGG.slice(0,6);
const THINK=["Pondering","Crunching numbers","Scanning forecasts","Checking alerts","Connecting the dots","Weighing scenarios","Reading the data","Tracing price moves","Cross-checking","Digging in"];
const pickWord=prev=>{ const pool=THINK.filter(w=>w!==prev); return pool[Math.min(pool.length-1,Math.floor(Math.random()*pool.length))]; };

/* ------------------------------------------------------------ state */
const S={ open:false, conversations:loadHistory(), activeId:createId(), messages:[], input:"", loading:false, loadingMode:null, error:null,
  copied:null, editing:null, history:false, settings:false, report:false, cfg:loadSettings(), req:0, abort:null, deleted:new Set(), ctx:{}, word:pickWord(null),
  briefing:{kind:"idle"}, usage:null, srcOpen:{} };
let root=null, els={}, wordTimer=null, copyTimer=null, briefTimer=null, briefCtl=null;

/* ------------------------------------------------------------ markdown (chatMarkdown.tsx) */
function pmd(t){
  const inl=s=>esc(s).replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g,"$1<em>$2</em>").replace(/(^|[\s(])_([^_]+?)_(?=[\s).,;:!?]|$)/g,"$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const L=String(t||"").split(/\r?\n/); let h="", list=null, tbl=null, code=null;
  const flush=()=>{ if(list){ h+="</"+list+">"; list=null; } if(tbl){ h+=`<div class="rc-tbl"><table><thead><tr>${tbl[0].map(c=>`<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${tbl.slice(1).map(r=>`<tr>${r.map(c=>`<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; tbl=null; } };
  for(const l of L){
    if(code!==null){ if(/^\s*```/.test(l)){ h+=`<pre><code>${esc(code.join("\n"))}</code></pre>`; code=null; } else code.push(l); continue; }
    if(/^\s*```/.test(l)){ flush(); code=[]; continue; }
    if(/^\s*\|.*\|\s*$/.test(l)){ if(!tbl){ flush(); tbl=[]; } if(/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue; tbl.push(l.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim())); continue; }
    if(tbl) flush();
    let m;
    if((m=l.match(/^(#{1,6})\s+(.*)/))){ flush(); const n=Math.min(3,m[1].length); h+=`<h${n}>${inl(m[2])}</h${n}>`; }
    else if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){ flush(); h+="<hr>"; }
    else if((m=l.match(/^\s*>\s?(.*)/))){ flush(); h+=`<blockquote>${inl(m[1])}</blockquote>`; }
    else if((m=l.match(/^\s*[-*•]\s+(.*)/))){ if(list!=="ul"){ flush(); h+="<ul>"; list="ul"; } h+=`<li>${inl(m[1])}</li>`; }
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){ if(list!=="ol"){ flush(); h+="<ol>"; list="ol"; } h+=`<li>${inl(m[1])}</li>`; }
    else if(!l.trim()) flush();
    else { flush(); h+=`<p>${inl(l)}</p>`; }
  }
  if(code!==null) h+=`<pre><code>${esc(code.join("\n"))}</code></pre>`;
  flush(); return h;
}
const wrapTables=h=>String(h||"").replace(/<table class="rd-table">/g,'<div class="rc-tbl"><table>').replace(/<\/table>/g,"</table></div>");
function textOf(html){ const d=document.createElement("div"); d.innerHTML=String(html||"").replace(/<\/(p|li|h\d|tr|div|ul|ol)>/gi,"$&\n").replace(/<br\s*\/?>/gi,"\n").replace(/<\/t[dh]>/gi," | "); return (d.textContent||"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim(); }

/* ------------------------------------------------------------ ChartCard (POC palette: blue #2563eb / slate #94a3b8, tones #059669 / #dc2626 / #64748b) */
const LINE_COLORS=["#2563eb","#94a3b8"], DONUT_COLORS=["#3b82f6","#10b981","#8b5cf6","#f59e0b","#06b6d4","#ef4444","#ec4899","#94a3b8"];
const toneColor=t=>t==="up"?"#059669":t==="down"?"#dc2626":"#64748b";
function chartCard(s){
  const fmt=v=>s.unit==="pct"?U.sgn(v,1):s.unit==="currency"?(s.currencySymbol||"₹")+nf(v,0):nf(v,2);
  let body="";
  try{
    if(s.kind==="line"){
      body=C.line({labels:s.points.map(p=>p.x),height:190,mLeft:56,maxX:6,yFmt:fmt,aria:s.title,
        series:s.series.map((se,i)=>({name:se.label,data:s.points.map(p=>p[se.key]==null?null:p[se.key]),color:LINE_COLORS[i%LINE_COLORS.length],dash:se.style==="dashed"?"5 4":null})),
        band:s.band?{lo:s.points.map(p=>p[s.band.lowerKey]==null?null:p[s.band.lowerKey]),hi:s.points.map(p=>p[s.band.upperKey]==null?null:p[s.band.upperKey]),name:s.band.label,color:"#2563eb"}:null,split:s.splitAt});
    } else if(s.kind==="bar"){
      if(s.series.length<=1){
        const k=s.series[0].key;
        body=C.bars({signed:s.unit==="pct"||s.rows.some(r=>r.values[k]<0),fmt,items:s.rows.map(r=>({label:r.label,value:r.values[k],color:toneColor(r.tone)}))});
      } else {
        const cols=["#2563eb","#94a3b8","#10b981","#f59e0b"];
        const mx=Math.max(...s.rows.flatMap(r=>s.series.map(se=>Math.abs(r.values[se.key]||0))),1e-9);
        body=`<div class="rd-gb">${s.rows.map(r=>`<div class="rd-gr"><div class="lb">${esc(r.label)}</div><div class="bs">${s.series.map((se,i)=>`<div class="b" title="${esc(se.label)}: ${esc(fmt(r.values[se.key]))}"><i style="width:${Math.abs(r.values[se.key]||0)/mx*100}%;background:${cols[i%cols.length]}"></i><span>${esc(fmt(r.values[se.key]))}</span></div>`).join("")}</div></div>`).join("")}</div><div class="pc-legend">${s.series.map((se,i)=>`<span><i style="background:${cols[i%cols.length]}"></i>${esc(se.label)}</span>`).join("")}</div>`;
      }
    } else if(s.kind==="donut"){
      body=C.donut(s.slices.map((x,i)=>({label:x.label,value:x.value,color:DONUT_COLORS[i%DONUT_COLORS.length]})),{aria:s.title});
    } else return "";
  }catch(e){ console.warn("chart",e); return ""; }
  return `<figure class="rc-chart"><figcaption class="rc-ct">${esc(s.title)}</figcaption>${body}<p class="rc-cs">${esc(s.source||"")}</p></figure>`;
}
function goodChart(c){ return c&&typeof c==="object"&&((c.kind==="line"&&Array.isArray(c.points)&&c.points.length&&Array.isArray(c.series)&&c.series.length)||(c.kind==="bar"&&Array.isArray(c.rows)&&c.rows.length&&Array.isArray(c.series)&&c.series.length)||(c.kind==="donut"&&Array.isArray(c.slices)&&c.slices.length)); }
const goodSource=s=>s&&typeof s.url==="string"&&/^https?:/i.test(s.url)&&typeof s.title==="string"&&typeof s.domain==="string";
function goodExport(o){ return o&&(o.format==="xlsx"||o.format==="docx")&&typeof o.label==="string"&&o.label.trim()&&!(o.format==="xlsx"&&!o.dataRef); }

/* ------------------------------------------------------------ message pieces */
const actBtn=(label,act,icon,dis)=>`<button type="button" class="rc-act" data-rc="${act}" aria-label="${label}" title="${label}"${dis?" disabled":""}>${icon}</button>`;
function sourcesHtml(m,i){
  if(m.usedWeb!==true) return "";
  const src=m.sources||[], n=src.length;
  if(!n) return `<p class="rc-srcnote">${IC.globe("rc-i14 rc-brand")}Searched the web</p>`;
  const open=!!S.srcOpen[i];
  return `<div class="rc-src"><button type="button" class="rc-srcbtn" data-rc="src:${i}" aria-expanded="${open}">${IC.globe("rc-i14 rc-brand")}Searched the web · ${n} source${n===1?"":"s"}${IC.chev("rc-i12 rc-chev"+(open?" open":""))}</button>${open?`<ul class="rc-srclist">${src.map((s,j)=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}"><span class="n">${j+1}</span><span class="d">${esc(s.domain)}</span><span class="t">${esc(s.title)}</span></a></li>`).join("")}</ul>`:""}</div>`;
}
function exportsHtml(m,i){ return (m.exports||[]).map((o,j)=>{ const sec=o.format==="xlsx"?"docx":"xlsx", allowed=sec==="docx"||o.dataRef; const k=i+"."+j, st=S.exp&&S.exp[k]||{}; const L={xlsx:"Excel",docx:"Word"};
  return `<div class="rc-exp"><p>${esc(o.label)}</p><div class="r"><button type="button" class="rc-expbtn${st.busy?" busy":""}" data-rc="export:${i}:${j}:${o.format}"${st.busy?" disabled":""}>${st.busy===o.format?"Preparing…":st.done?"Downloaded":L[o.format]}</button>${allowed?`<button type="button" class="rc-explink" data-rc="export:${i}:${j}:${sec}"${st.busy?" disabled":""}>${st.busy===sec?"Preparing…":L[sec]}</button>`:""}</div>${st.error?`<p class="err">${esc(st.error)}</p>`:""}</div>`; }).join(""); }
function rowHtml(m,i,isLast){
  const user=m.role==="user", busy=S.loading;
  if(user&&S.editing===i) return `<div class="rc-edit"><textarea rows="1" aria-label="Edit your message" id="rc-edit-ta">${esc(m.content)}</textarea><div class="b"><button type="button" class="rc-rbtn" data-rc="edit-cancel" aria-label="Cancel edit" title="Cancel">${IC.close("rc-i16")}</button><button type="button" class="rc-sbtn s32" data-rc="edit-send" aria-label="Send edited message" title="Send">${IC.send("rc-i16")}</button></div></div>`;
  let bubble;
  if(user) bubble=`<p class="rc-ubub" aria-label="You">${esc(m.content)}</p>`;
  else {
    const body=m.html?`<div class="rc-prose">${m.html}</div>`:`<div class="rc-prose">${pmd(m.content)}</div>`;
    const acts=(m.actions&&m.actions.length)?`<div class="rc-acts">${m.actions.map(a=>`<button type="button" data-rd="${esc(a.a)}">${esc(a.l)}</button>`).join("")}</div>`:"";
    bubble=`<div class="rc-abub" aria-label="Radar">${body}${(m.charts||[]).slice(0,2).map(chartCard).join("")}${exportsHtml(m,i)}${sourcesHtml(m,i)}${acts}${m.basis?`<p class="rc-basis">${esc(m.basis)}</p>`:""}</div>`;
  }
  const tools=`<div class="rc-tools${user?" hov":""}">${actBtn(S.copied===i?"Copied":"Copy",`copy:${i}`,S.copied===i?IC.check("rc-i16"):IC.copy("rc-i16"))}${user?actBtn("Edit",`edit:${i}`,IC.edit("rc-i16"),busy):""}${(!user&&isLast)?actBtn("Regenerate",`regen:${i}`,IC.refresh("rc-i16"),busy):""}</div>`;
  return `<div class="rc-row ${user?"u":"a"}"><div class="rc-g ${user?"u":"a"}">${bubble}${tools}</div></div>`;
}

/* ------------------------------------------------------------ open screen (ChatOpenScreen.tsx) */
function snapshotTiles(){
  const k=P.kpis(), tiles=[];
  try{ tiles.push({label:"Cost per vehicle",value:U.cr(k.basket.value),note:`${U.sgn(k.forecast.change,1)} forecast`,tone:k.forecast.change>0.05?"up":k.forecast.change<-0.05?"down":"neutral"}); }catch(e){}
  try{ tiles.push({label:"Model accuracy",value:nf(k.accuracy.value,1)+"%",note:"MAPE "+nf(k.accuracy.mape,1)+"% · "+k.accuracy.model}); }catch(e){}
  let pend=null; try{ pend=PocHitl.pending().length; }catch(e){}
  tiles.push({label:"Pending alerts",value:pend===null?"–":String(pend),note:"need a decision"});
  tiles.push({label:"Parts flagged",value:String(P.ALERTS.length),note:"to review"});
  return tiles;
}
const todayLabel=()=>{ const n=new Date(); return `Today · ${n.toLocaleDateString("en-US",{weekday:"short"})} ${n.getDate()} ${n.toLocaleDateString("en-US",{month:"short"})}`; };
const fmtItemDate=d=>{ const [y,m,dd]=String(d).split("-").map(Number); if(!isFinite(y)||!isFinite(m)||!isFinite(dd)) return String(d); try{ return new Date(y,m-1,dd).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch(e){ return String(d); } };
const fmtUpdated=iso=>{ try{ return new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}); }catch(e){ return ""; } };
const IMPACT={cost_up:["rose","Cost up"],watch:["amber","Watch"],cost_down:["emerald","Cost down"]};
function newsBody(){
  const b=S.briefing;
  if(b.kind==="loading"||b.kind==="pending") return `<div class="rc-skel">${[0,1,2].map(()=>`<div><i class="a"></i><i class="b"></i></div>`).join("")}</div>`;
  if(b.kind==="pending-exhausted") return `<p class="rc-faint">Today's impact news is still being prepared.</p>`;
  if(b.kind==="offline") return `<p class="rc-faint">Impact news needs the Radar server. <a href="#" data-rc="goto-settings">Connect it in Admin → AI Model Settings.</a></p>`;
  if(b.kind==="error") return `<p class="rc-faint">Today's impact news isn't available right now.</p>`;
  if(b.kind!=="ready") return "";
  return `<ul class="rc-news">${b.briefing.items.map(it=>{ const m=IMPACT[it.impact]||IMPACT.watch; return `<li><span class="dot ${m[0]}"><span class="sr">${m[1]}</span></span><div><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.headline)}</a><p>${esc(it.why)} · ${esc(it.outlet)} · ${esc(fmtItemDate(it.date))}</p></div></li>`; }).join("")}</ul>`;
}
function openScreen(){
  const st=S.cfg, showNews=st.news&&S.briefing.kind!=="disabled";
  if(!st.snapshot&&!st.news&&!st.situations) return `<section class="rc-empty" aria-label="Ask Radar">Ask Radar about your forecast, alerts or the news.</section>`;
  let h=`<section class="rc-open" aria-label="Open screen">`;
  if(st.snapshot){ const t=snapshotTiles(); if(t.length) h+=`<div class="rc-sec"><p class="rc-lbl">${todayLabel()}</p><div class="rc-tiles">${t.map(x=>`<div class="rc-tile"><p class="l">${esc(x.label)}</p><p class="v">${esc(x.value)}</p>${x.note?`<p class="n ${x.tone||""}">${esc(x.note)}</p>`:""}</div>`).join("")}</div></div>`; }
  if(showNews) h+=`<div class="rc-sec"><p class="rc-lbl">Impact news${S.briefing.kind==="ready"?` · Updated ${fmtUpdated(S.briefing.briefing.generatedAt)}`:""}</p>${newsBody()}</div>`;
  if(st.situations) h+=`<div class="rc-sec tight"><p class="rc-lbl">Try a situation</p><div class="rc-sit">${SITUATIONS.map((s,i)=>`<button type="button" data-rc="pick:${i}"${S.loading?" disabled":""}><span class="a">${esc(s.label)}</span><span class="b">${esc(s.q)}</span></button>`).join("")}</div></div>`;
  return h+`</section>`;
}

/* ------------------------------------------------------------ daily briefing (server mode only) */
const dayKey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function cachedBriefing(){
  try{ const b=JSON.parse(store.get(BKEY)||"null"); if(!b||!Array.isArray(b.items)||!b.items.length) return null;
    const now=new Date(), y=new Date(now.getTime()-864e5); if(b.date!==dayKey(now)&&b.date!==dayKey(y)) return null;
    const age=now.getTime()-new Date(b.generatedAt).getTime(); return (age>=0&&age<20*36e5)?b:null; }catch(e){ return null; }
}
function loadBriefing(){
  if(briefTimer){ clearTimeout(briefTimer); briefTimer=null; } if(briefCtl){ briefCtl.abort(); briefCtl=null; }
  if(!S.cfg.news){ S.briefing={kind:"idle"}; return; }
  if(!RadarCfg.server()){ S.briefing={kind:"offline"}; return; }
  const c=cachedBriefing(); if(c){ S.briefing={kind:"ready",briefing:c}; return; }
  const base=RadarCfg.get().url.replace(/\/+$/,""); let n=0; const ctl=new AbortController(); briefCtl=ctl;
  const poll=async()=>{
    n++;
    try{
      const r=await fetch(base+"/api/briefing",{signal:ctl.signal}); let b=null; try{ b=await r.json(); }catch(e){}
      if(ctl.signal.aborted) return;
      if(r.status===200&&b&&b.status==="ready"&&b.briefing&&Array.isArray(b.briefing.items)&&b.briefing.items.length){ S.briefing={kind:"ready",briefing:b.briefing}; store.set(BKEY,JSON.stringify(b.briefing)); }
      else if(r.status===200&&b&&b.status==="disabled") S.briefing={kind:"disabled"};
      else if(r.status===202&&b&&b.status==="pending"){ if(n>=8) S.briefing={kind:"pending-exhausted"}; else { S.briefing={kind:"pending"}; briefTimer=setTimeout(poll,4000); } }
      else S.briefing={kind:"error"};
    }catch(e){ if(!ctl.signal.aborted) S.briefing={kind:"error"}; }
    renderLog();
  };
  S.briefing={kind:"loading"}; poll();
}

/* ------------------------------------------------------------ rendering */
function renderHead(){ els.newBtn.hidden=!S.messages.length; }
function renderLog(keepScroll){
  const prev=els.log.scrollTop;
  let h="";
  if(!S.messages.length) h+=openScreen();
  h+=S.messages.map((m,i)=>rowHtml(m,i,i===S.messages.length-1)).join("");
  if(S.loading) h+=thinkingHtml();
  if(S.error) h+=`<div class="rc-err">${esc(S.error)}</div>`;
  els.log.innerHTML=h;
  renderHead(); renderInput();
  if(S.editing!==null){ const ta=els.log.querySelector("#rc-edit-ta"); if(ta){ autosize(ta); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); } }
  if(keepScroll) els.log.scrollTop=prev;
  else if(!S.messages.length) els.log.scrollTo({top:0});
  else els.log.scrollTo({top:els.log.scrollHeight,behavior:"smooth"});
  syncWordTimer();
}
function thinkingHtml(){ const web=S.loadingMode==="web"; return `<div class="rc-row a"><div class="rc-think" aria-label="Radar is thinking">${web?IC.globe("rc-i14"):""}<span class="sr">${web?"Radar is searching the web":"Radar is thinking"}</span><span class="rc-shimmer" aria-hidden="true">${web?"Searching the web":esc(S.word)}…</span></div></div>`; }
function syncWordTimer(){
  const need=S.loading&&S.loadingMode!=="web";
  if(need&&!wordTimer) wordTimer=setInterval(()=>{ S.word=pickWord(S.word); const el=els.log.querySelector(".rc-shimmer"); if(el) el.textContent=S.word+"…"; },1800);
  if(!need&&wordTimer){ clearInterval(wordTimer); wordTimer=null; }
}
function renderInput(){
  els.input.disabled=S.loading; els.input.value=S.input;
  els.send.hidden=S.loading; els.stop.hidden=!S.loading; els.send.disabled=!S.input.trim();
}
const autosize=ta=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; };

/* history overlay */
function renderHistory(){
  const {pinned,recent}=splitFor(S.conversations);
  const row=c=>`<div class="rc-hrow${c.id===S.activeId?" on":""}" data-id="${esc(c.id)}"><button type="button" class="m" data-rc="hsel:${esc(c.id)}"><div class="mq"><span>${esc(c.title)}</span></div><span class="t">${esc(relTime(c.updatedAt))}</span></button><div class="x"><button type="button" class="p${c.pinned?" on":""}" data-rc="hpin:${esc(c.id)}" aria-label="${c.pinned?"Unpin conversation":"Pin conversation"}" aria-pressed="${c.pinned}" title="${c.pinned?"Unpin":"Pin"}">${IC.pin("rc-i14"+(c.pinned?" fill":""))}</button><button type="button" class="d" data-rc="hdel:${esc(c.id)}" aria-label="Delete conversation" title="Delete">${IC.trash("rc-i14")}</button></div></div>`;
  els.history.innerHTML=`<div class="rc-ovh"><p>History</p><button type="button" class="rc-x" data-rc="hclose" aria-label="Close history" title="Close history">${IC.close("rc-i16")}</button></div><div class="rc-ovb scrollbar-hidden">${pinned.length?`<div class="rc-hsec"><h3>Pinned</h3><div class="l">${pinned.map(row).join("")}</div></div>`:""}<div class="rc-hsec"><h3>Recent</h3>${recent.length?`<div class="l">${recent.map(row).join("")}</div>`:`<p class="rc-faint2">${pinned.length?"No other conversations.":"No conversations yet. Your chats will show up here."}</p>`}</div></div>`;
  requestAnimationFrame(()=>els.history.querySelectorAll(".mq").forEach(mq=>{ const sp=mq.firstChild, ov=Math.max(0,sp.offsetWidth-mq.clientWidth); mq.dataset.ov=ov; mq.classList.toggle("fade",ov>0); }));
}
function marquee(row,on){ const mq=row.querySelector(".mq"); if(!mq) return; const ov=+mq.dataset.ov||0, sp=mq.firstChild; mq.classList.toggle("fade",ov>0&&!on); sp.style.transition=on?`transform ${Math.max(.6,ov/60)}s linear`:"transform .25s ease-out"; sp.style.transform=`translateX(-${on?ov:0}px)`; }

/* settings overlay */
const TOKEN_ROWS=[
  ["snapshot","Today's snapshot","Four key numbers from your dashboard data."],
  ["news","Impact news of the day","Fetched once a day on first open and stored, so everyone reads the same brief."],
  ["situations","Situation questions","Real business scenarios to start a chat."],
  ["liveNews","Live news in answers","Searches trusted sources only when a question needs current information."],
];
function fmtTokens(n){ if(n==null||!isFinite(n)) return "not measured yet"; if(n===0) return "0 tokens"; if(n<1000) return "≈ "+n+" tokens"; if(n<10000) return "≈ "+(n/1000).toFixed(1).replace(/\.0$/,"")+"k tokens"; return "≈ "+Math.round(n/1000)+"k tokens"; }
function tokenLabel(k){ const u=S.usage; if(k==="snapshot"||k==="situations") return "0 tokens"; if(k==="news") return u&&u.briefing?fmtTokens(u.briefing.totalTokens)+" per day":"not measured yet"; return u&&u.webAnswer?fmtTokens(u.webAnswer.avgTokens)+" per news answer":"not measured yet"; }
function renderSettings(){
  els.settings.innerHTML=`<div class="rc-ovh line"><p>Radar settings</p><button type="button" class="rc-x" data-rc="sclose" aria-label="Close settings" title="Close settings">${IC.close("rc-i16")}</button></div><div class="rc-ovb scrollbar-hidden pad"><div class="rc-srows">${TOKEN_ROWS.map(r=>`<div class="rc-srow"><div><p class="n">${r[1]}</p><p class="d">${r[2]}</p><span class="tk">${tokenLabel(r[0])}</span></div><button type="button" role="switch" aria-checked="${S.cfg[r[0]]}" aria-label="${r[1]}" class="rc-sw${S.cfg[r[0]]?" on":""}" data-rc="toggle:${r[0]}"><span></span></button></div>`).join("")}</div></div><p class="rc-sfoot">Token figures are approximate and come from real usage. Settings are saved in this browser.</p>`;
}
function loadUsage(){ if(!RadarCfg.server()) return; fetch(RadarCfg.get().url.replace(/\/+$/,"")+"/api/usage").then(r=>r.ok?r.json():null).then(b=>{ if(b&&typeof b==="object"&&"briefing" in b&&"webAnswer" in b){ S.usage=b; if(S.settings) renderSettings(); } }).catch(()=>{}); }

/* ------------------------------------------------------------ report mode (ReportMode.tsx — scripted, no request leaves the page) */
const RFILES={ppt:{name:"Auto_Parts_Price_Outlook.pptx",label:"presentation",meta:"10 slides · 5 charts · 518 KB · 4 sources cited",mime:"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
              doc:{name:"Auto_Parts_Price_Outlook.docx",label:"document",meta:"6 sections · 4 figures · 110 KB · 4 sources cited",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}};
const REX={ppt:["Q4 price outlook for leadership, with vendor risks","Vertical-wise cost movement for the next 6 months","Supplier risk summary for the sourcing review"],doc:["Detailed price outlook report for the sourcing review","Written summary of vertical cost movement with charts","Supplier risk memo for the procurement head"]};
const RSRC=["Pricing Models","Vertical Cost Reports","Supplier Master","Market Intelligence"];
const RCOMMON=[{l:"Understanding your request",d:"Audience: leadership. Scope: 6-month price outlook, vendor risk.",ms:1200},{l:"Searching the knowledge base",d:"14 documents matched across 4 connected sources.",ms:1900},{l:"Reading and ranking passages",d:"62 passages read, 23 kept as most relevant.",ms:1800},{l:"Extracting figures and tables",d:"Cost per vehicle forecast, vertical changes, vendor risk shares.",ms:1700}];
const RFMT={ppt:[{l:"Drafting the slide outline",d:"10 slides: summary, forecast, verticals, cost mix, drivers, FX, vendors, next steps.",ms:1600},{l:"Building slides and charts",d:"5 charts, 1 table, 4 stat cards.",ms:2200},{l:"Applying template and formatting",d:"Corporate theme, source notes on every slide.",ms:1300},{l:"Final quality check",d:"Figures cross-checked against source documents.",ms:1200}],
            doc:[{l:"Drafting the document outline",d:"6 sections: summary, forecast, verticals, drivers, supplier risk, next steps.",ms:1600},{l:"Writing sections and figures",d:"4 charts, 1 table, 12 cited statements.",ms:2200},{l:"Applying styles and page layout",d:"Headings, captions, page numbers, A4 layout.",ms:1300},{l:"Final quality check",d:"Figures cross-checked against source documents.",ms:1200}]};
const rsteps=f=>RCOMMON.concat(RFMT[f]);
const R={phase:"ask",format:"ppt",prompt:"",submitted:"",cur:0,downloaded:false}; let rTimer=null;
function renderReport(){
  const f=R.format, steps=rsteps(f), file=RFILES[f];
  let body="";
  if(R.phase==="ask"){
    body=`<div class="rc-rcol"><div><h2>What report do you need?</h2><p class="sub">Ask in plain language. Radar builds a ready presentation or document from your connected knowledge base.</p></div>
    <div class="rc-rbox"><textarea id="rc-rprompt" rows="3" placeholder="${f==="ppt"?"e.g. Make a PPT on the next 6 months price outlook for leadership":"e.g. Write a report on the next 6 months price outlook with charts"}">${esc(R.prompt)}</textarea>
      <div class="r"><div class="rc-seg" role="group" aria-label="Report format">${["ppt","doc"].map(x=>`<button type="button" data-rc="rfmt:${x}" aria-pressed="${f===x}" class="${f===x?"on":""}">${x==="ppt"?"PPT":"Document"}</button>`).join("")}</div><button type="button" class="rc-sbtn s36" id="rc-rgo" data-rc="rstart" aria-label="Create report"${R.prompt.trim()?"":" disabled"}>${IC.send("rc-i16")}</button></div></div>
    <div><p class="rc-lbl2">Try one of these</p><div class="rc-rex">${REX[f].map((x,i)=>`<button type="button" data-rc="rex:${i}">${esc(x)}</button>`).join("")}</div></div>
    <div><p class="rc-lbl2">Connected knowledge base</p><div class="rc-rsrc">${RSRC.map(s=>`<span><i></i>${s}</span>`).join("")}</div></div></div>`;
  } else {
    const total=steps.reduce((n,s)=>n+s.ms,0), done=steps.slice(0,R.cur).reduce((n,s)=>n+s.ms,0), pct=R.phase==="done"?100:Math.round(done/total*100);
    body=`<div class="rc-rcol"><div class="rc-rq">${esc(R.submitted)}</div>
    <div><div class="rc-rprog"><span>${R.phase==="done"?"Report ready":"Creating your report"}</span><span>${pct}%</span></div><div class="rc-bar"><div style="width:${pct}%"></div></div></div>
    <ol class="rc-steps">${steps.map((s,i)=>{ const st=i<R.cur?"done":i===R.cur?"active":"todo"; return `<li class="${st}"><span class="ic">${st==="done"?IC.check("rc-i20 ok"):st==="active"?`<span class="spin"></span>`:`<span class="dot"></span>`}</span><div><p class="t">${s.l}</p>${st!=="todo"?`<p class="d">${s.d}</p>`:""}${i===1&&st!=="todo"?`<div class="rc-chips">${RSRC.map(x=>`<span>${x}</span>`).join("")}</div>`:""}</div></li>`; }).join("")}</ol>
    ${R.phase==="done"?`<div class="rc-rdone"><p class="h">Your ${file.label} is ready</p><div class="w">${f==="ppt"?`<div class="rc-deck"><p class="a">Auto Parts Price Outlook</p><p class="b">Next 6 months: what moves, why, and who to call</p></div>`:`<div class="rc-docth"><p>Auto Parts Price Outlook</p><i></i><i class="s"></i><b></b><i></i></div>`}<div class="m"><p class="fn">${file.name}</p><p class="fm">${file.meta}</p><button type="button" class="rc-dl" data-rc="rdl">${f==="ppt"?"Download PPT":"Download Word document"}</button></div></div>${R.downloaded?`<p class="rc-dled">Downloaded. Check your Downloads folder.</p>`:""}<button type="button" class="rc-again" data-rc="rreset">Create another report</button></div>`:""}</div>`;
  }
  els.report.innerHTML=`<div class="rc-ovh line"><button type="button" class="rc-back" data-rc="rback">← Back to chat</button><span class="rc-pill">Report mode</span></div><div class="rc-ovb scrollbar-hidden rbody">${body}</div>`;
  if(R.phase==="ask"){ const ta=els.report.querySelector("#rc-rprompt"); ta.addEventListener("input",()=>{ R.prompt=ta.value; els.report.querySelector("#rc-rgo").disabled=!R.prompt.trim(); }); ta.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); rStart(R.prompt); } }); }
}
function rTick(){ clearTimeout(rTimer); if(R.phase!=="working") return; const steps=rsteps(R.format); if(R.cur>=steps.length){ R.phase="done"; renderReport(); return; } rTimer=setTimeout(()=>{ R.cur++; renderReport(); rTick(); },steps[R.cur].ms); }
function rStart(t){ const v=String(t).trim(); if(!v) return; R.submitted=v; R.cur=0; R.downloaded=false; R.phase="working"; renderReport(); rTick(); }
function rDownload(){
  const f=R.format, file=RFILES[f]; let b64=null;
  try{ const el=document.getElementById("rc-reports"); b64=el?JSON.parse(el.textContent)[f]:null; }catch(e){}
  if(!b64) return Toast.show("The sample report file is not embedded in this build.","warn");
  const bin=atob(b64), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([u8],{type:file.mime})), a=document.createElement("a"); a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  R.downloaded=true; renderReport();
}

/* ------------------------------------------------------------ answering: Radar server (POC /api/chat) or the in-page engine */
const sleep=(ms,sig)=>new Promise((res,rej)=>{ const t=setTimeout(res,ms); sig.addEventListener("abort",()=>{ clearTimeout(t); rej(new DOMException("aborted","AbortError")); },{once:true}); });
async function serverReply(base,sig,onMode){
  const cfg=RadarCfg.get(), url=cfg.url.replace(/\/+$/,"")+"/api/chat";
  const guard=new AbortController(), to=setTimeout(()=>guard.abort(),65000); sig.addEventListener("abort",()=>guard.abort(),{once:true});
  try{
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:guard.signal,body:JSON.stringify({messages:toApi(base),webEnabled:S.cfg.liveNews&&cfg.web!==false,stream:true})});
    let result=null, err=null;
    if(res.body&&(res.headers.get("content-type")||"").includes("application/x-ndjson")){
      const rd=res.body.getReader(), dec=new TextDecoder(); let buf="";
      for(;;){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); let i;
        while((i=buf.indexOf("\n"))>=0){ const ln=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(!ln) continue; let ev=null; try{ ev=JSON.parse(ln); }catch(e){ continue; }
          if(ev.type==="mode") onMode&&onMode(ev.mode); else if(ev.type==="result") result=ev; else if(ev.type==="error") err=ev.error; } }
    } else { const b=await res.json(); if(!res.ok) err=b.error; else result=b; }
    if(!result||typeof result.reply!=="string") throw new Error(err||"chat unavailable, try again");
    const e={role:"assistant",content:result.reply};
    if(result.usedWeb===true){ e.usedWeb=true; e.sources=(Array.isArray(result.sources)?result.sources:[]).filter(goodSource).slice(0,10); }
    const ch=(Array.isArray(result.charts)?result.charts:[]).filter(goodChart).slice(0,2); if(ch.length) e.charts=ch;
    const ex=(Array.isArray(result.exports)?result.exports:[]).filter(goodExport).slice(0,1); if(ex.length) e.exports=ex;
    return e;
  } finally { clearTimeout(to); }
}
async function localReply(base,sig,note){
  await sleep(480,sig);
  const q=base[base.length-1];
  let r; try{ r=Radar.local(String(q.prompt||q.content),S.ctx); }catch(e){ console.error(e); r={html:`<p>Sorry — I hit a problem answering that (${esc(e.message)}).</p>`,charts:[],actions:[]}; }
  const html=wrapTables((note?`<p class="rd-m">${esc(note)}</p>`:"")+(r.html||""));
  const e={role:"assistant",content:textOf(html),html};
  const ch=(r.charts||[]).filter(goodChart).slice(0,2); if(ch.length) e.charts=ch;
  if(r.actions&&r.actions.length) e.actions=r.actions;
  if(r.basis) e.basis=r.basis;
  return e;
}

/* ------------------------------------------------------------ conversation actions (ChatWidget.tsx) */
function save(){ store.set(HKEY,JSON.stringify(S.conversations)); }
async function requestReply(base,convId){
  convId=convId||S.activeId;
  const token=++S.req; S.messages=base; S.conversations=upsert(S.conversations,{id:convId,messages:base}); save();
  S.error=null; S.loading=true; S.loadingMode=null; S.editing=null; renderLog();
  const ctl=new AbortController(); S.abort=ctl;
  try{
    let entry;
    if(RadarCfg.server()){
      try{ entry=await serverReply(base,ctl.signal,m=>{ if(S.req===token){ S.loadingMode=m; renderLog(true); } }); }
      catch(e){ if(ctl.signal.aborted) throw new DOMException("aborted","AbortError"); entry=await localReply(base,ctl.signal,"The Radar server could not be reached ("+(e.message||"network / CORS")+") — answered offline instead."); }
    } else entry=await localReply(base,ctl.signal);
    const withReply=base.concat([entry]);
    S.conversations=upsert(S.conversations,{id:convId,messages:withReply},S.deleted); save();
    if(S.req===token) S.messages=withReply;
  }catch(err){
    if(err&&err.name==="AbortError"){ /* user stop: no error message */ }
    else if(S.req===token) S.error="chat unavailable, try again";
  }finally{
    if(S.req===token){ S.loading=false; S.loadingMode=null; }
    if(S.abort===ctl) S.abort=null;
  }
  if(S.req===token){ renderLog(); if(S.open&&!S.history&&!S.settings&&!S.report) els.input.focus({preventScroll:true}); }
  if(S.history) renderHistory();
}
function ask(text){
  const t=String(text||"").trim(); if(!t) return;
  if(S.abort) S.abort.abort();
  S.activeId=createId(); S.ctx={}; S.input=""; S.editing=null; closeOverlays();
  requestReply([{role:"user",content:t}],S.activeId);
}
function send(override){
  const t=String(override!=null?override:S.input).trim(); if(!t||S.loading) return;
  S.input=""; requestReply(S.messages.concat([{role:"user",content:t}]));
}
function freshChat(){
  S.req++; if(S.abort){ S.abort.abort(); S.abort=null; }
  S.loading=false; S.loadingMode=null; S.activeId=createId(); S.ctx={}; S.messages=[]; S.input=""; S.error=null; S.editing=null; S.srcOpen={}; S.exp={};
  renderLog(); loadBriefing(); renderLog();
}
function selectConv(id){
  S.history=false; syncOverlays(); if(id===S.activeId) return;
  const c=S.conversations.find(x=>x.id===id); if(!c) return;
  S.req++; if(S.abort){ S.abort.abort(); S.abort=null; }
  S.loading=false; S.loadingMode=null; S.activeId=id; S.ctx={}; S.messages=c.messages; S.error=null; S.editing=null; S.srcOpen={}; S.exp={}; renderLog();
}
async function copyMsg(i){
  const m=S.messages[i]; if(!m) return;
  try{ await navigator.clipboard.writeText(m.content); S.copied=i; renderLog(true); clearTimeout(copyTimer); copyTimer=setTimeout(()=>{ if(S.copied===i){ S.copied=null; renderLog(true); } },1500); }catch(e){ /* clipboard unavailable */ }
}
async function doExport(i,j,fmt){
  const m=S.messages[i], o=m&&(m.exports||[])[j]; if(!o) return; const k=i+"."+j; S.exp=S.exp||{}; if(S.exp[k]&&S.exp[k].busy) return;
  if(!RadarCfg.server()){ S.exp[k]={error:"Export needs the Radar server."}; return renderLog(true); }
  S.exp[k]={busy:fmt}; renderLog(true);
  try{
    const r=await fetch(RadarCfg.get().url.replace(/\/+$/,"")+"/api/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({offer:o,format:fmt},fmt==="docx"?{messages:toApi(S.messages)}:{}))});
    if(!r.ok){ let p={}; try{ p=await r.json(); }catch(e){} S.exp[k]={error:p.error||"couldn't build that file"}; }
    else { const blob=await r.blob(), url=URL.createObjectURL(blob), a=document.createElement("a"), cd=r.headers.get("Content-Disposition")||"", mm=cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      a.href=url; a.download=mm?decodeURIComponent(mm[1]):"export."+fmt; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); S.exp[k]={done:true}; }
  }catch(e){ S.exp[k]={error:"couldn't build that file"}; }
  renderLog(true);
}

/* engine action chips / buttons inside answers (data-rd="kind:value") */
function engineAct(b){
  const [k,...r]=b.dataset.rd.split(":"), v=r.join(":");
  if(k==="ask") send(v==="help"?"help":v);
  else if(k==="part"){ close(); U.openPart(v); }
  else if(k==="go"){ const mod=SCREENS[Router.module]&&SCREENS[Router.module][v]?Router.module:"procurement"; close(); Router.go(v,mod); }
  else if(k==="filter"){ close(); U.act("filter:"+v); }
  else if(k==="goto"){ const [mod,scr]=v.split("/"); close(); Router.go(scr,mod); }
  else if(k==="price"){ close(); __openPrice(v); }
  else if(k==="cbd"){ close(); __openCbd(v); }
  else if(k==="hitl"){
    const [id,st]=v.split("|");
    if(!PocHitl.canAct()) return Toast.show("Switch to Commodity Mgr / Buyer / PM to act on alerts.","warn");
    if(PocHitl.get(id)!=="pending") return Toast.show("Already reviewed.","info");
    PocHitl.set(id,st);
    S.messages=S.messages.map(m=>{ if(!m.html||m.html.indexOf("hitl:"+id+"|")<0) return m; const d=document.createElement("div"); d.innerHTML=m.html; d.querySelectorAll(".rd-h1").forEach(x=>{ if(x.querySelector('[data-rd^="hitl:'+id+'|"]')) x.remove(); }); const html=d.innerHTML; return Object.assign({},m,{html,content:textOf(html)}); });
    const rr=Radar.ansHitlResult(PocHitl.alerts().find(a=>a.alertId===id),st);
    const html=wrapTables(rr.html), e={role:"assistant",content:textOf(html),html}; if(rr.actions&&rr.actions.length) e.actions=rr.actions;
    S.messages=S.messages.concat([e]); S.conversations=upsert(S.conversations,{id:S.activeId,messages:S.messages},S.deleted); save(); renderLog();
  }
  else if(k==="csv") U.downloadCsv("radar_movers.csv",["part_id","name","programme","vendor","current","forecast","change_pct"],P.movers("up",25,"horizon").map(p=>[p.id,p.name,p.progName,p.vendorName,p.cur,p.fcEnd,p.chgH.toFixed(2)]));
}

/* ------------------------------------------------------------ panel open / close / overlays */
function syncOverlays(){
  els.history.classList.toggle("show",S.history); els.history.inert=!S.history; els.history.setAttribute("aria-hidden",String(!S.history));
  els.settings.hidden=!S.settings; els.report.hidden=!S.report;
}
function closeOverlays(){ S.history=false; S.settings=false; S.report=false; clearTimeout(rTimer); syncOverlays(); }
function open(){
  if(!root) mount();
  const was=S.open; S.open=true;
  root.classList.add("open"); els.panel.inert=false; els.panel.setAttribute("aria-hidden","false"); els.backdrop.classList.add("show");
  if(!was){ if(!S.messages.length){ loadBriefing(); } renderLog(); }
  setTimeout(()=>els.input.focus({preventScroll:true}),30);
}
function close(){
  if(!root||!S.open) return;
  S.open=false; closeOverlays();
  if(briefTimer){ clearTimeout(briefTimer); briefTimer=null; } if(briefCtl){ briefCtl.abort(); briefCtl=null; }
  root.classList.remove("open"); els.panel.inert=true; els.panel.setAttribute("aria-hidden","true"); els.backdrop.classList.remove("show");
}

/* ------------------------------------------------------------ DOM */
function mount(){
  root=document.createElement("div"); root.id="rc-root";
  root.innerHTML=`<div id="rc-backdrop" aria-hidden="true"></div>
  <div id="radar-panel" role="dialog" aria-label="Radar" aria-hidden="true">
    <div class="rc-head"><p class="rc-title">Radar</p><div class="rc-hb">
      <button type="button" class="rc-hbtn" data-rc="report" aria-label="Report mode" title="Report mode">${IC.report("rc-i20")}</button>
      <button type="button" class="rc-hbtn" data-rc="settings" aria-label="Settings" title="Settings">${IC.gear("rc-i20")}</button>
      <button type="button" class="rc-hbtn" data-rc="history" aria-label="History" title="History">${IC.history("rc-i20")}</button>
      <button type="button" class="rc-hbtn" data-rc="new" id="rc-new" aria-label="New chat" title="New chat" hidden>${IC.newchat("rc-i20")}</button>
      <button type="button" class="rc-hbtn close" data-rc="close" aria-label="Close Radar" title="Close Radar">${IC.close("rc-i20")}</button></div></div>
    <div class="rc-body">
      <div class="rc-log scrollbar-hidden" id="rc-log" role="log" aria-live="polite"></div>
      <div class="rc-inwrap"><div class="rc-pill-in"><input id="rc-input" type="text" autocomplete="off" placeholder="Ask Radar about this dashboard">
        <button type="button" class="rc-stop" id="rc-stop" data-rc="stop" aria-label="Stop" title="Stop" hidden>${IC.stop("rc-i16")}</button>
        <button type="button" class="rc-sbtn s36" id="rc-send" data-rc="send" aria-label="Send message" disabled>${IC.send("rc-i16")}</button></div></div>
      <div class="rc-ov z30" id="rc-settings" hidden></div><div class="rc-ov z20" id="rc-report" hidden></div>
    </div>
    <div class="rc-ov hist" id="rc-history" aria-hidden="true"></div>
  </div>`;
  document.body.appendChild(root);
  els={backdrop:root.querySelector("#rc-backdrop"),panel:root.querySelector("#radar-panel"),log:root.querySelector("#rc-log"),input:root.querySelector("#rc-input"),send:root.querySelector("#rc-send"),stop:root.querySelector("#rc-stop"),newBtn:root.querySelector("#rc-new"),history:root.querySelector("#rc-history"),settings:root.querySelector("#rc-settings"),report:root.querySelector("#rc-report")};
  els.panel.inert=true; syncOverlays();
  els.backdrop.addEventListener("click",close);
  els.input.addEventListener("input",()=>{ S.input=els.input.value; els.send.disabled=!S.input.trim(); });
  els.input.addEventListener("keydown",e=>{ if(e.key==="Enter") send(); });
  els.history.addEventListener("mouseover",e=>{ const r=e.target.closest(".rc-hrow"); if(r&&!r.contains(e.relatedTarget)) marquee(r,true); });
  els.history.addEventListener("mouseout",e=>{ const r=e.target.closest(".rc-hrow"); if(r&&!r.contains(e.relatedTarget)) marquee(r,false); });
  root.addEventListener("click",onClick);
  window.addEventListener("keydown",e=>{
    if(!S.open||e.key!=="Escape"||S.editing!==null) return;
    if(S.report){ S.report=false; clearTimeout(rTimer); syncOverlays(); }
    else if(S.settings){ S.settings=false; syncOverlays(); }
    else if(S.history){ S.history=false; syncOverlays(); }
    else close();
  });
  els.log.addEventListener("keydown",e=>{ if(e.target.id!=="rc-edit-ta") return; if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); S.editing=null; renderLog(true); } else if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); submitEdit(); } });
  els.log.addEventListener("input",e=>{ if(e.target.id==="rc-edit-ta") autosize(e.target); });
}
function submitEdit(){
  const ta=els.log.querySelector("#rc-edit-ta"); if(!ta||S.loading) return;
  const base=truncForEdit(S.messages,S.editing,ta.value); if(!base) return;
  S.editing=null; requestReply(base);
}
function onClick(e){
  const rd=e.target.closest("[data-rd]"); if(rd&&els.log.contains(rd)){ e.preventDefault(); engineAct(rd); return; }
  const b=e.target.closest("[data-rc]"); if(!b) return; const [k,...r]=b.dataset.rc.split(":"), v=r.join(":");
  if(k==="goto-settings"){ e.preventDefault(); close(); Router.go("ai-model-settings","admin"); return; }
  switch(k){
    case "close": close(); break;
    case "report": S.report=true; S.settings=false; S.history=false; syncOverlays(); renderReport(); if(R.phase==="working") rTick(); break;
    case "rback": S.report=false; clearTimeout(rTimer); syncOverlays(); break;
    case "settings": S.settings=true; S.history=false; syncOverlays(); renderSettings(); loadUsage(); break;
    case "sclose": S.settings=false; syncOverlays(); break;
    case "history": S.history=true; S.settings=false; syncOverlays(); renderHistory(); break;
    case "hclose": S.history=false; syncOverlays(); break;
    case "new": freshChat(); break;
    case "send": send(); break;
    case "stop": if(S.abort) S.abort.abort(); break;
    case "pick": if(!S.loading) send(SITUATIONS[+v].q); break;
    case "copy": copyMsg(+v); break;
    case "edit": if(!S.loading){ S.editing=+v; renderLog(true); } break;
    case "edit-cancel": S.editing=null; renderLog(true); break;
    case "edit-send": submitEdit(); break;
    case "regen": { const base=truncForRegen(S.messages,+v); if(base&&!S.loading) requestReply(base); break; }
    case "src": S.srcOpen[+v]=!S.srcOpen[+v]; renderLog(true); break;
    case "export": { const [i,j,f]=v.split(":"); doExport(+i,+j,f); break; }
    case "hsel": selectConv(v); break;
    case "hpin": S.conversations=S.conversations.map(c=>c.id===v?Object.assign({},c,{pinned:!c.pinned}):c); save(); renderHistory(); break;
    case "hdel": S.deleted.add(v); S.conversations=S.conversations.filter(c=>c.id!==v); save(); if(v===S.activeId) freshChat(); renderHistory(); break;
    case "toggle": S.cfg[v]=!S.cfg[v]; store.set(SKEY,JSON.stringify(S.cfg)); renderSettings(); if(v==="news"){ loadBriefing(); renderLog(true); } else if(v==="snapshot"||v==="situations") renderLog(true); break;
    case "rfmt": R.format=v; renderReport(); break;
    case "rex": R.prompt=REX[R.format][+v]; renderReport(); break;
    case "rstart": rStart(R.prompt); break;
    case "rdl": rDownload(); break;
    case "rreset": R.prompt=""; R.phase="ask"; renderReport(); break;
  }
}

return {open,close,ask,send,isOpen:()=>S.open};
})();

/* ---------------------------------------------------------------- hook the prototype's entry points up to the POC chat */
(function(){
  Radar.open=function(q){ RadarChat.open(); if(q) RadarChat.ask(q); };
  Radar.ask=function(q){ RadarChat.open(); RadarChat.ask(q); };
  AI.open=function(){ RadarChat.open(); };
  AI.close=function(){ RadarChat.close(); };
  AI.ask=function(q){ RadarChat.open(); RadarChat.ask(q); };
  AI.send=function(){}; AI.onKeydown=function(){}; AI.renderIntro=function(){}; AI.renderSuggestions=function(){};
  const btn=document.getElementById("ai-btn"); if(btn) btn.title="Ask AIS — Radar assistant";
  /* the full-page "Ask AIS" screen opens the same panel */
  const page=function(){
    const wrap=document.createElement("div");
    wrap.appendChild(PocUI.header("Ask AIS","Radar answers in plain English from the forecasting data and the platform's own records — text, numbers and charts. It opens as a panel on every screen from “Ask AIS” in the top bar."));
    const c=PocUI.el(`<div class="panel" style="margin-top:14px"><div class="panel-body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span style="color:var(--muted)">Radar is open on the right. Close it with Esc and reopen it anytime from the top bar.</span><button type="button" class="btn btn-primary" id="rc-reopen">✨ Open Radar</button></div></div>`);
    c.querySelector("#rc-reopen").onclick=()=>RadarChat.open();
    wrap.appendChild(c); setTimeout(()=>RadarChat.open(),60); return wrap;
  };
  MODULES.forEach(m=>["ai-assistant","ai-assistant-tc","ai-assistant-srm"].forEach(k=>{ if(SCREENS[m.id][k]||k==="ai-assistant") SCREENS[m.id][k]=page; }));
})();
