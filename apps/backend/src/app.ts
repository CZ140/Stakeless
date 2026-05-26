import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';
import { gamesRouter } from './routes/games.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { profileRouter } from './routes/profile.js';
import { adminRouter } from './routes/admin.js';
import { friendsRouter } from './routes/friends.js';
import { groupsRouter } from './routes/groups.js';
import { pokerRouter } from './routes/poker.js';
import { devRouter } from './routes/dev.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export function createApp(): Express {
  const app = express();

  // Behind a platform TLS proxy (Render/Fly/etc.), trust the first hop so `secure`
  // cookies are set and express-rate-limit sees the real client IP.
  app.set('trust proxy', 1);

  // Security headers. Helmet's default CSP is strict (script-src 'self'), which
  // blocks the Google Identity Services "Sign in with Google" widget. Extend three
  // directives so GSI can load its client script, render its button iframe, and
  // call its endpoints; every other directive keeps helmet's secure defaults.
  // These only permit specific accounts.google.com GSI paths, so they're harmless
  // when Google sign-in is disabled.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
          connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
          frameSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        },
      },
    })
  );

  // CORS — driven by FRONTEND_URL (comma-separated for multiple origins). Defaults
  // to the Vite dev server. Moot under a single-origin deploy (no cross-origin
  // requests) but keeps dev working and supports a split frontend/backend host.
  app.use(
    cors({
      origin: env.FRONTEND_URL.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );

  // Body parsing — limit raised above the 100kb default so client-resized avatar
  // data URLs (capped at ~342kb in the profile route) aren't rejected with a 413.
  app.use(express.json({ limit: '512kb' }));

  // Cookie parsing (needed for refresh token httpOnly cookies)
  app.use(cookieParser());

  // Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/poker', pokerRouter);

  // Dev-only routes — never registered in production
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/dev', devRouter);
  }

  // Production: serve the built SPA from the same origin as the API. The Vite build
  // (apps/frontend/dist) is copied to apps/backend/public at deploy time. Registered
  // AFTER all /api routes; the catch-all returns index.html so client-side routes
  // (e.g. /games/crash) resolve on a hard refresh. API paths are excluded so an
  // unknown /api/* still gets a JSON 404 rather than the HTML shell.
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.resolve(__dirname, '../public');
    app.use(express.static(clientDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  // JSON 404 for anything unmatched. In production the SPA catch-all above has
  // already served non-API GETs, so this only fires for unknown /api/* paths and
  // non-GET misses; in dev/test it catches every unmatched request.
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Central error handler — must be LAST and take 4 args for Express to treat it
  // as an error handler. Without it, an escaped throw hits Express's default
  // handler, which leaks a stack trace as HTML. We log the full error server-side
  // and return a minimal JSON body, never exposing internals to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    if (res.headersSent) return;
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Request failed' });
  });

  return app;
}
