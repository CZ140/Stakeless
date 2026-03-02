import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';

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

  // Cookie parsing (needed for refresh token httpOnly cookies)
  app.use(cookieParser());

  // Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/wallet', walletRouter);

  return app;
}
