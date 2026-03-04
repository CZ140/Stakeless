import './env.js'; // Must be first — crashes with clear error if env vars are missing
import { createServer } from 'node:http';
import { env } from './env.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';

const app = createApp();
const server = createServer(app);
createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`[backend] Running at http://localhost:${env.PORT}`);
  console.log(`[backend] Health check: http://localhost:${env.PORT}/api/health`);
});
