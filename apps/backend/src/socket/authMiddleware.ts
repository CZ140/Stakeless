import type { Server } from 'socket.io';
import { verifyAccessToken } from '../services/tokenService.js';

export function attachAuthMiddleware(io: Server): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Guest — no userId set; still allowed through for public leaderboard
      return next();
    }
    try {
      const payload = await verifyAccessToken(token);
      socket.data.userId = Number(payload.sub);
      next();
    } catch {
      // Invalid/expired token — treat as guest, don't block connection
      next();
    }
  });
}
