// Radar CORS proxy — lets the E7 prototype (opened from a file or any local origin) call the forecasting POC's chat API.
//
//   1. start the POC as usual:     cd "SKODA AIS APP/SKODA-forecasting-POC/dashboard" && npm run dev     (API on :3001)
//   2. start this proxy:           node E7_build/radar_cors_proxy.mjs                                      (listens on :8787)
//   3. in E7: Admin → AI Model Settings → Radar server URL = http://localhost:8787 → Save → Test connection
//
// It only adds CORS headers and streams every /api/* request through unchanged. It never reads, logs or stores the
// OpenAI key — that stays in the POC server's own environment. Local development use only.
import http from "node:http";

const LISTEN = +process.env.PROXY_PORT || 8787;
const TARGET = process.env.RADAR_TARGET || "http://localhost:3001";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (!req.url.startsWith("/api/")) { res.writeHead(404, CORS); return res.end("{}"); }
  const t = new URL(req.url, TARGET);
  const up = http.request({ hostname: t.hostname, port: t.port, path: t.pathname + t.search, method: req.method,
    headers: { "content-type": req.headers["content-type"] || "application/json" } }, (r) => {
    res.writeHead(r.statusCode || 502, { ...r.headers, ...CORS });
    r.pipe(res);
  });
  up.on("error", () => { res.writeHead(502, { ...CORS, "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "POC API not reachable on " + TARGET })); });
  req.pipe(up);
}).listen(LISTEN, () => console.log(`Radar CORS proxy: http://localhost:${LISTEN}  →  ${TARGET}`));
