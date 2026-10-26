/* =====================================================================
   V9  ·  Brand moments — a photographic sign-in screen and Home banner.  Nothing else in the app is touched: the working screens stay plain on purpose.
   · Sign-in   photograph on the left fading into a dark blurred copy of itself, glass card on the right, the same three-step simulated SSO as before
   · Home      greeting banner with the photograph on its right, KPI tiles lifted over the banner's lower edge
   The photographs are embedded by build_e7.py from assets/login_hero.jpg and assets/home_hero.jpg (placeholders below).  No animation.
   ===================================================================== */
(function(){
"use strict";
const $=(s,r)=>(r||document).querySelector(s);
const IMG={login:"__V9_LOGIN__",home:"__V9_HOME__"};
const ICON={
  user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.4-6.4 7.5-6.4s7.5 2.4 7.5 6.4"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.1-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  win:'<svg viewBox="0 0 24 24" class="fill"><path d="M3 5.5 11 4.4v7H3zM12 4.3 21 3v8.4h-9zM3 12.6h8v7L3 18.5zM12 12.6h9V21l-9-1.3z"/></svg>'
};
const logoSrc=()=>{ const i=$("#sidebar .sb-brand .mark img"); return i?i.getAttribute("src"):""; };

/* ----------------------------------------------------------------- sign-in */
function buildLogin(){
  const si=$("#signin"); if(!si||si.classList.contains("v9")) return;
  const right=$("#si-right"); si.classList.add("v9");
  const left=$(".si-left",si); if(left) left.remove();
  const wrap=document.createElement("div"); wrap.className="v9-login";
  wrap.innerHTML=
    '<div class="v9-bg" style="background-image:url('+IMG.login+')"></div><div class="v9-photo" style="background-image:url('+IMG.login+')"></div><div class="v9-shade"></div>'+
    '<div class="v9-lg-brand"><div class="v9-wm"><img alt="" src="'+logoSrc()+'"><span>ŠKODA</span></div><i class="v9-dash"></i><div class="v9-tag">PEOPLE<br>PLANET<br>PROGRESS</div></div>'+
    '<div class="v9-lg-foot">DRIVEN BY<br>A SMARTER TOMORROW</div>'+
    '<p class="v9-lg-fine">Škoda Auto Volkswagen India Private Limited · Prototype environment — sign-in is simulated and no data leaves this browser.</p>';
  wrap.appendChild(right); si.appendChild(wrap);
}
function loginForm(){
  return '<div class="si-card v9-card">'+
    '<div class="v9-card-head"><span class="v9-welcome">Welcome to</span><h1>SKODA <b>AIS</b></h1><p>Procurement Digitalisation<br>with AI</p></div>'+
    '<label class="v9-f"><span class="ic">'+ICON.user+'</span><input type="text" id="v9-user" placeholder="Username or Email" autocomplete="off" spellcheck="false"></label>'+
    '<label class="v9-f"><span class="ic">'+ICON.lock+'</span><input type="password" id="v9-pass" placeholder="Password" autocomplete="off"><button type="button" class="eye" id="v9-eye" aria-label="Show password" data-no-icon>'+ICON.eye+'</button></label>'+
    '<div class="v9-row"><label class="v9-chk"><input type="checkbox" checked><i></i>Remember me</label><a href="#" class="v9-forgot" onclick="return false">Forgot password?</a></div>'+
    '<button type="button" class="v9-go" data-s="2"><span>Sign in</span>'+ICON.arrow+'</button>'+
    '<div class="v9-or"><span>or continue with</span></div>'+
    '<button type="button" class="v9-sso" data-s="2">'+ICON.win+'<span>Sign in with SSO</span></button>'+
    '<p class="v9-note">Prototype: any entry signs in — you will pick one of the role personas next.</p></div>';
}
function wireLogin(box){
  const eye=$("#v9-eye",box), pw=$("#v9-pass",box);
  if(eye&&pw) eye.addEventListener("click",()=>{ const show=pw.type==="password"; pw.type=show?"text":"password"; eye.innerHTML=show?ICON.eyeOff:ICON.eye; eye.setAttribute("aria-label",show?"Hide password":"Show password"); });
  box.querySelectorAll("input").forEach(i=>i.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); const g=$(".v9-go",box); if(g) g.click(); } }));
}
function patchAuth(){
  if(typeof Auth==="undefined") return;
  const orig=Auth.step.bind(Auth);
  Auth.step=function(n,role){
    const box=$("#si-right");
    if(n===1&&box){ box.innerHTML=loginForm(); wireLogin(box); return; }
    orig(n,role);
    const c=box&&box.firstElementChild; if(c) c.classList.add("v9-card");
    if(n===3){ try{ sessionStorage.setItem("v9-in","1"); }catch(e){} }
  };
}

/* ----------------------------------------------------------------- Home banner */
function patchHero(){
  if(typeof Components==="undefined") return;
  const orig=Components.pageHeader.bind(Components);
  Components.pageHeader=function(title,sub){
    if(!/^Home/.test(title)) return orig(title,sub);
    const mod=MODULES.find(m=>m.id===Router.module).label;
    const u=(DATA.users||[]).find(x=>x.role===RBAC.role);
    const name=u?u.name:((ROLES.find(r=>r.id===RBAC.role)||{}).label||"");
    const h=new Date().getHours(), g=h<12?"Good morning":h<17?"Good afternoon":"Good evening";
    const d=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    return this.el('<div class="page-header hero v9-hero"><div class="v9-hero-bg" style="background-image:url('+IMG.home+')"></div><div class="v9-hero-photo" style="background-image:url('+IMG.home+')"></div><div class="v9-hero-shade"></div>'+
      '<div class="v9-hero-txt"><div class="breadcrumb">'+mod+' <b>›</b> Home</div><span class="hi">'+d+'</span><h1>'+g+', '+name+'</h1><p class="v9-tagline">Driving smarter procurement for a sustainable tomorrow</p></div>'+
      '<div class="v9-hero-motto">PEOPLE<br>PLANET<br>PROGRESS</div></div>');
  };
}

/* ----------------------------------------------------------------- boot */
function init(){
  buildLogin(); patchAuth(); patchHero();
  if(typeof Router!=="undefined"&&Router.screen==="home") Router.render();      // the app booted before the banner was patched in
  let seen=false; try{ seen=sessionStorage.getItem("v9-in")==="1"; }catch(e){}
  if(typeof Auth==="undefined") return;
  if(!seen){ const si=$("#signin"); if(si){ si.hidden=false; Auth.step(1); } } else Auth.step(1);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0)); else setTimeout(init,0);
})();
