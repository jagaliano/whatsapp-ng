// Synthetic HTTP server only: no models, providers or WhatsApp traffic.
import http from 'node:http';
import { appendFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
const [port, backend, model, mode = 'normal', metrics] = process.argv.slice(2);
const record = event => { if (metrics) appendFileSync(metrics, JSON.stringify({ event, pid: process.pid, explicitEnv: process.env.WA_EXPLICIT_TEST === 'yes', leakedEnv: Boolean(process.env.WA_FORBIDDEN_TEST) }) + '\n'); };
record('spawn');
if (mode === 'exit') process.exit(7);
let healthRequests = 0; let modelRequests = 0;
const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
        const first = healthRequests++ === 0;
        if (existsSync(metrics + '.probe')) { unlinkSync(metrics + '.probe'); res.statusCode = 503; res.end('{}'); return; }
        if (mode === 'health-slow-once' && first) { setTimeout(() => res.end(JSON.stringify({ status: 'ok', backend })), 1500); return; }
        res.statusCode = mode === 'loading' ? 503 : 200;
        res.end(JSON.stringify({ status: mode === 'loading' ? 'loading' : 'ok', backend: mode === 'wrong-backend' ? 'wrong' : backend }));
    } else if (req.url === '/v1/models') {
        record('model-probe');
        if (mode === 'warm-models' && modelRequests++ === 0) { res.statusCode = 503; res.end('{}'); return; }
        if (req.headers.authorization !== 'Bearer synthetic-key') { res.statusCode = 401; res.end('{}'); return; }
        const loaded = mode === 'mutable' && existsSync(metrics + '.model') ? readFileSync(metrics + '.model', 'utf8') : mode === 'wrong-model' ? 'wrong' : model;
        res.end(JSON.stringify({ data: [{ id: loaded, backend, owned_by: 'crispasr' }] }));
    }
    else { res.statusCode = 404; res.end('{}'); }
});
server.on('error', () => { record('bind-failed'); process.exit(8); });
server.listen(Number(port), '127.0.0.1', () => record('listening'));
process.on('SIGTERM', () => { record('term'); if (mode !== 'ignore-term') server.close(() => process.exit(0)); });
