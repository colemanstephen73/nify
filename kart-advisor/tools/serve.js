// Dependency-free static server for local use. Serves the project root; / redirects to the app.
// Usage: node tools/serve.js [port]   (default 8080, or $PORT). Listens on all interfaces so a
// phone on the same Wi-Fi can open http://<computer-ip>:8080/app/ (offline mode needs localhost or https).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.yaml': 'text/yaml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/' || url === '/app') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
  let file = path.join(root, path.normalize(url));
  if (!file.startsWith(root) || /node_modules|\/\.git/.test(file)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(port, () => console.log(`Kart setup advisor: http://localhost:${port}/app/`));
