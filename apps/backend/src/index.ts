import './env.js'; // Must be first — crashes with clear error if env vars are missing
import { env } from './env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[backend] Running at http://localhost:${env.PORT}`);
  console.log(`[backend] Health check: http://localhost:${env.PORT}/api/health`);
});
