import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api/client';

// In dev the backend is on :3000; in production the API + socket are served from
// the same origin as the SPA (single-origin deploy), so default to that. Set
// VITE_SOCKET_URL only when splitting the frontend and backend onto separate hosts.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

// Singleton — created once at module level, shared across the app
// autoConnect: false — connect manually after auth state is confirmed (in AuthContext)
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => {
    // Callback form: called fresh on every reconnect — picks up latest token after JWT refresh
    cb({ token: getAccessToken() ?? '' });
  },
});
