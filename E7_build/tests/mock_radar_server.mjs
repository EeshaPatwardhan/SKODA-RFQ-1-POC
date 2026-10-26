// Stand-in for the POC's /api/chat (NDJSON) so the page's server mode can be tested without any API key.
import http from "node:http";
const PORT = +process.env.PORT || 8790;
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
http.createServer((req,res)=>{
  if(req.method==="OPTIONS"){ res.writeHead(204,CORS); return res.end(); }
  if(req.url.startsWith("/api/hitl-status")){ res.writeHead(200,{...CORS,"Content-Type":"application/json"}); return res.end(JSON.stringify({statuses:{a:"confirmed"}})); }
  if(req.url.startsWith("/api/briefing")){ res.writeHead(200,{...CORS,"Content-Type":"application/json"}); const now=new Date(), d=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    return res.end(JSON.stringify({status:"ready",briefing:{date:d,generatedAt:now.toISOString(),model:"mock",items:[
      {headline:"Aluminium prices climb on supply cuts",impact:"cost_up",area:"metals",why:"Castings and housings get dearer",outlet:"Reuters",date:d,url:"https://example.com/al",domain:"example.com"},
      {headline:"Container rates ease on the Asia–Europe lane",impact:"cost_down",area:"freight",why:"Inbound freight cost falls",outlet:"FT",date:d,url:"https://example.com/fr",domain:"example.com"},
      {headline:"EU duty review due next month",impact:"watch",area:"policy",why:"Could change landed cost",outlet:"Mint",date:d,url:"https://example.com/duty",domain:"example.com"}]}})); }
  if(req.url.startsWith("/api/usage")){ res.writeHead(200,{...CORS,"Content-Type":"application/json"}); return res.end(JSON.stringify({briefing:{totalTokens:12400,date:"x",model:"mock"},webAnswer:{avgTokens:8200,samples:3},dataAnswer:null})); }
  if(req.url.startsWith("/api/export") && req.method==="POST"){ res.writeHead(200,{...CORS,"Content-Type":"text/csv","Content-Disposition":'attachment; filename="mock.csv"',"Access-Control-Expose-Headers":"Content-Disposition"}); return res.end("a,b,1,2"); }
  if(req.url.startsWith("/api/chat") && req.method==="POST"){
    let b=""; req.on("data",c=>b+=c); req.on("end",()=>{
      const q=JSON.parse(b).messages.slice(-1)[0].content;
      res.writeHead(200,{...CORS,"Content-Type":"application/x-ndjson"});
      res.write(JSON.stringify({type:"mode",mode:"web"})+"\n");
      setTimeout(()=>{
        res.write(JSON.stringify({type:"result",mode:"web",usedWeb:true,exports:[{format:"docx",label:"Download this answer",dataRef:null}],
          reply:`## Mock Radar answer\nYou asked: **${q}**\n\n- Steel and aluminium headlines point to firmer prices.\n- Our forecast shows _Powertrain_ flat and _Lighting_ up.\n\n| Category | Move |\n|---|---|\n| Lighting | +5.1% |\n| HVAC | -2.9% |`,
          sources:[{title:"Mock steel outlook",url:"https://example.com/steel",domain:"example.com"}],
          charts:[{kind:"bar",title:"Forecast move by category",unit:"pct",currencySymbol:"₹",source:"mock",orientation:"horizontal",series:[{key:"v",label:"Move"}],rows:[{label:"Lighting",values:{v:5.1},tone:"up"},{label:"HVAC",values:{v:-2.9},tone:"down"}]}]})+"\n");
        res.end();
      },600);
    }); return;
  }
  res.writeHead(404,CORS); res.end("{}");
}).listen(PORT,()=>console.log("mock radar on",PORT));
