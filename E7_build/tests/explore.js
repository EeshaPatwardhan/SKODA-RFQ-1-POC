const fs=require("fs"), vm=require("vm");
globalThis.__POC__=JSON.parse(fs.readFileSync(__dirname+"/../poc_data.json","utf8"));
vm.runInThisContext(fs.readFileSync(__dirname+"/../src/poc_core.js","utf8")+"\n;globalThis.PocCore=PocCore;");
const P=PocCore;
for(const prog of ["TGN","KUS","KDQ","KYL"]){
  console.log("=== "+prog);
  for(const cat of ["Body Stampings","Chassis","Electrical","Fasteners","Interior Trim","Powertrain","HVAC"]){
    const a=P.PARTS.filter(p=>p.progCode===prog&&p.category===cat);
    console.log(cat, a.length, a.slice(0,6).map(p=>p.id+":"+p.name+"|"+p.vendorName.split(" ")[0]+"|"+p.cur.toFixed(0)+"|"+p.chgH.toFixed(1)).join("  ;  "));
  }
}
