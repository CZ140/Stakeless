import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    req.user = { id: Number(payload.sub) };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
