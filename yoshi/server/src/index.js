import express from 'express';
import path from 'node:path';
// Respect HTTP(S)_PROXY / NO_PROXY for outbound fetch (undici ignores them by default).
try {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici');
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) {
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
} catch { /* older Node without EnvHttpProxyAgent — direct egress */ }
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { api } from './routes/api.js';
import { startTaskEngine } from './taskEngine.js';
import { startScheduler } from './scheduler.js';
import { startMonitoring } from './monitors.js';
import { aiConfigured } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use('/api', api);

// Serve the built client (client/dist) if present.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Central error handler — every route error becomes a clean JSON response.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 'AI_NOT_CONFIGURED' ? 503 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal error' });
});

app.listen(config.port, () => {
  console.log(`Yoshi server listening on http://localhost:${config.port}`);
  console.log(`AI: ${aiConfigured() ? `configured (${config.model})` : 'NOT CONFIGURED — set ANTHROPIC_API_KEY'}`);
  startTaskEngine();
  startScheduler();
  startMonitoring();
});
