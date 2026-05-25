import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { FriendDTO, FriendRequestDTO, GroupInviteDTO } from '@gambling/shared';
import { attachAuthMiddleware } from './authMiddleware.js';
import { startLeaderboardBroadcast } from './leaderboardBroadcast.js';

interface LeaderboardRow {
  id: number;
  username: string;
  value: number;
  tierLevel: number;
  avatarColor: string | null;
}

interface LeaderboardSnapshot {
  byBalance: LeaderboardRow[];
  byWagered: LeaderboardRow[];
  byProfit: LeaderboardRow[];
}

interface TierUpEvent {
  level: number;
  name: string;
  reward: number;
  dailyBonus: number;
}

interface ServerToClientEvents {
  'leaderboard:update': (data: LeaderboardSnapshot) => void;
  'balance:update': (data: { balance: number }) => void;
  'tier:up': (data: TierUpEvent) => void;
  // Crash round resolution, pushed to the player's room by the crash scheduler.
  'crash:bust': (data: { sessionId: number; crashPoint: number }) => void;
  'crash:cashout': (data: {
    sessionId: number;
    multiplier: number;
    payout: number;
    newBalance: number;
    auto: boolean;
  }) => void;
  // Social: pushed to the target's user:<id> room.
  'friend:request': (data: { request: FriendRequestDTO }) => void;
  'friend:accepted': (data: { friend: FriendDTO }) => void;
  'group:invite': (data: { invite: GroupInviteDTO }) => void;
}

interface ClientToServerEvents {
  // Clients do not send custom events yet (group:subscribe added in the Groups phase)
}

interface SocketData {
  userId?: number;
}

export let io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function createSocketServer(server: HttpServer): void {
  io = new Server(server, {
    cors: {
      // Socket.IO CORS is separate from Express cors middleware — both must be configured
      origin: ['http://localhost:5173'],
      credentials: true,
    },
  });

  attachAuthMiddleware(io);

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (userId !== undefined) {
      void socket.join(`user:${userId}`);
    }
    // All sockets (auth and guest) receive leaderboard:update via io.emit
  });

  startLeaderboardBroadcast(io);
}
