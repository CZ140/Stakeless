import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  getBoard,
  spawnBall,
  stepBall,
  startXForBucket,
  ballDrawPos,
  sinkWidth,
  sinkHeight,
  BALL_RADIUS,
  OBSTACLE_RADIUS,
  type Ball,
  type Board,
} from '../../game/plinko/engine';

export interface PlinkoBoardHandle {
  /** Drop a real-physics ball that lands in `bucket`; `onSettle` fires when it lands. */
  drop: (bucket: number, onSettle?: () => void) => void;
}

interface Props {
  rows: number;
  multipliers: number[]; // length rows + 1
}

interface LiveBall {
  ball: Ball;
  bucket: number;
  landed: boolean;
  landedAt: number;
  onSettle?: () => void;
}

const REST_MS = 900;

// Sink colour is driven by POSITION (distance from centre), not multiplier
// magnitude — a clean green→red gradient that reads correctly at any risk.
function sinkColor(index: number, rows: number): string {
  const t = rows === 0 ? 0 : Math.abs(index - rows / 2) / (rows / 2);
  if (t < 0.18) return '#00E082'; // emerald (centre)
  if (t < 0.38) return '#8FD64F'; // lime
  if (t < 0.58) return '#F6C24A'; // gold
  if (t < 0.78) return '#F2884B'; // orange
  return '#F0445A'; // red (edges)
}
function sinkTextColor(index: number, rows: number): string {
  const t = rows === 0 ? 0 : Math.abs(index - rows / 2) / (rows / 2);
  return t < 0.78 ? '#06130b' : '#fff';
}

export const PlinkoBoard = forwardRef<PlinkoBoardHandle, Props>(function PlinkoBoard({ rows, multipliers }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const startXMapRef = useRef<Map<number, number[]> | null>(null);
  const ballsRef = useRef<LiveBall[]>([]);
  const highlightRef = useRef<{ bucket: number; at: number } | null>(null);
  const multsRef = useRef<number[]>(multipliers);
  multsRef.current = multipliers;

  useImperativeHandle(ref, () => ({
    drop(bucket: number, onSettle?: () => void) {
      const map = startXMapRef.current;
      if (!map) return;
      const startX = startXForBucket(map, bucket);
      ballsRef.current.push({ ball: spawnBall(startX), bucket, landed: false, landedAt: 0, onSettle });
    },
  }), []);

  // (Re)build board + presim when row count changes, and size the canvas.
  useEffect(() => {
    const { board, startXMap } = getBoard(rows);
    boardRef.current = board;
    startXMapRef.current = startXMap;
    ballsRef.current = [];
    highlightRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(board.width * dpr);
      canvas.height = Math.round(board.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [rows]);

  // Animation loop.
  useEffect(() => {
    let raf = 0;
    const render = () => {
      const canvas = canvasRef.current;
      const board = boardRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && board && ctx) {
        ctx.clearRect(0, 0, board.width, board.height);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (const p of board.pegsDraw) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, OBSTACLE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }

        const hl = highlightRef.current;
        const now = performance.now();
        ctx.font = '600 11px "Geist Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < board.sinkXs.length; i++) {
          const color = sinkColor(i, board.rows);
          const x = board.sinkXs[i]! - (sinkWidth - 4) / 2;
          const y = board.sinkTopY;
          const active = hl && hl.bucket === i && now - hl.at < REST_MS;
          ctx.save();
          if (active) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = color;
          }
          ctx.fillStyle = color;
          ctx.globalAlpha = active ? 1 : 0.92;
          roundRect(ctx, x, y, sinkWidth - 4, sinkHeight, 5);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = sinkTextColor(i, board.rows);
          ctx.fillText(formatMult(multsRef.current[i] ?? 0), board.sinkXs[i]!, y + sinkHeight / 2 + 0.5);
        }

        const survivors: LiveBall[] = [];
        for (const lb of ballsRef.current) {
          if (!lb.landed) {
            const idx = stepBall(lb.ball, board);
            if (idx !== null) {
              lb.landed = true;
              lb.landedAt = now;
              lb.ball.vx = 0;
              lb.ball.vy = 0;
              highlightRef.current = { bucket: lb.bucket, at: now };
              lb.onSettle?.();
            }
          }
          if (!lb.landed || now - lb.landedAt < REST_MS) {
            const { x, y } = ballDrawPos(lb.ball);
            ctx.beginPath();
            ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#00E082';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00E082';
            ctx.fill();
            ctx.shadowBlur = 0;
            survivors.push(lb);
          }
        }
        ballsRef.current = survivors;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const board = boardRef.current ?? getBoard(rows).board;
  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: board.width,
        aspectRatio: `${board.width} / ${board.height}`,
        display: 'block',
        margin: '0 auto',
      }}
    />
  );
});

function formatMult(m: number): string {
  return (Number.isInteger(m) ? String(m) : m.toFixed(1)) + '×';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
