# (exec'd by build_e7.py with rep() in scope) — boot: draw the page once (no flash of the old E6 Home); the sidebar starts collapsed

rep("const Router = {\n  module: \"procurement\",",
    "window.__bootHold=true;   // nothing is drawn until every module has loaded, so the E6 Home never flashes before the real one\n"
    "document.addEventListener(\"DOMContentLoaded\",()=>setTimeout(()=>{ if(window.__bootHold){ window.__bootHold=false; Router.render(); } },0));   // safety net\n"
    "const Router = {\n  module: \"procurement\",")
rep("  render(){\n    // keep the top-bar module tabs in sync",
    "  render(){\n    if(window.__bootHold) return;\n    // keep the top-bar module tabs in sync")
rep('if(this.load("ais-rail")==="1") document.getElementById("app-shell").classList.add("rail");',
    'if(this.load("ais-rail-v2")!=="0") document.getElementById("app-shell").classList.add("rail");   // collapsed by default; a stored "0" means the user expanded it (older saved values are ignored)')
rep('this.store("ais-rail",on?"1":"0");', 'this.store("ais-rail-v2",on?"1":"0");')
