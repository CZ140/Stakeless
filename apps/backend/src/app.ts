import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';

export function createApp(): Express {
  const app = express();

  // Security headers first
  app.use(helmet());

  // CORS — allow requests from Vite dev server
  app.use(
    cors({
      origin: ['http://localhost:5173'],
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json());

  // Routes
  app.use('/api', healthRouter);

  return app;
}
