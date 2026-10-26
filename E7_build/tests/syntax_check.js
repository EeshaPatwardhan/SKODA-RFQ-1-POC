const fs=require("fs"); const f=process.argv[2]; const s=fs.readFileSync(f,"utf8");
try{ new Function(s); console.log("parse ok:",f); }catch(e){ console.log("PARSE ERROR in",f,":",e.message); process.exit(1); }
