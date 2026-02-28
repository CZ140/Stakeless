import { Router, type IRouter } from 'express';
import type { HealthResponse } from '@gambling/shared';

export const healthRouter: IRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});
