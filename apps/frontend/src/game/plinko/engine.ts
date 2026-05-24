// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Plinko physics — adapted from code100x/plinkoo.
//
// The ball has NO per-frame randomness: gravity, friction and peg positions are
// fixed, so a trajectory is fully determined by its starting X. We exploit that:
//   1. The backend authoritatively picks the winning `bucket` (uniform 0..rows).
//   2. We presimulate a `bucket → [startX]` map for the board (memoised).
//   3. To show a result we drop a real-physics ball from a startX known to land
//      in that bucket — so the bounces are genuine, never mid-air corrected.
//
// The SAME `stepBall` runs the headless presimulation and the on-screen
// animation, so the rendered ball lands exactly where the presim said it would.
// ─────────────────────────────────────────────────────────────────────────────

const DECIMAL = 10000;
const pad = (n: number) => n * DECIMAL;
const unpad = (n: number) => Math.floor(n / DECIMAL);

// Physics constants (units are in padded space).
export const GRAVITY = pad(0.6);
export const H_FRICTION = 0.4;
// Vertical restitution after a peg hit. Lower = less bouncy (calmer drops).
export const V_FRICTION = 0.65;
// How much horizontal speed survives a side-wall bounce (walls absorb energy
// so the ball drops back in rather than trampolining).
export const WALL_RESTITUTION = 0.35;
export const BALL_RADIUS = 7;
export const OBSTACLE_RADIUS = 4;

// Board layout constants (unpadded px).
const SPACING = 36;   // horizontal gap between adjacent pegs / sinks
const ROW_GAP = 35;   // vertical gap between peg rows
const TOP_Y = 40;     // y of the first peg row
const START_Y = 8;    // y where the ball spawns
const SINK_GAP = 36;  // gap between last peg row and the sink mouths
const SINK_H = 30;    // sink box height

export interface Ball {
  x: number; // padded
  y: number; // padded
  vx: number;
  vy: number;
}

interface PegRow {
  padY: number;
  padXs: number[];
}

export interface Board {
  rows: number;
  sinkCount: number; // rows + 1
  width: number; // unpadded logical px
  height: number; // unpadded logical px
  centerX: number;
  pegRows: PegRow[]; // physics (padded), indexed by row 0..rows-1
  pegsDraw: { x: number; y: number }[]; // unpadded, for rendering
  sinkXs: number[]; // unpadded sink centre x, index 0..rows
  sinkTopY: number; // unpadded y of the sink mouth
  wallLeft: number; // unpadded inner face of the left wall
  wallRight: number; // unpadded inner face of the right wall
}

export function createBoard(rows: number): Board {
  const width = SPACING * (rows + 3);
  const centerX = width / 2;
  const pegRows: PegRow[] = [];
  const pegsDraw: { x: number; y: number }[] = [];

  for (let r = 0; r < rows; r++) {
    const count = r + 3;
    const y = TOP_Y + r * ROW_GAP;
    const padXs: number[] = [];
    for (let c = 0; c < count; c++) {
      const x = centerX + SPACING * (c - (count - 1) / 2);
      padXs.push(pad(x));
      pegsDraw.push({ x, y });
    }
    pegRows.push({ padY: pad(y), padXs });
  }

  const bottomPegY = TOP_Y + (rows - 1) * ROW_GAP;
  const sinkTopY = bottomPegY + SINK_GAP;
  const sinkXs: number[] = [];
  for (let i = 0; i <= rows; i++) sinkXs.push(centerX + SPACING * (i - rows / 2));

  // Walls sit at the outermost peg columns (== the outer edges of the end
  // sinks), so a ball can never escape past sink 0 / sink `rows`.
  const wallHalf = SPACING * ((rows + 1) / 2);

  return {
    rows,
    sinkCount: rows + 1,
    width,
    height: sinkTopY + SINK_H + 18,
    centerX,
    pegRows,
    pegsDraw,
    sinkXs,
    sinkTopY,
    wallLeft: centerX - wallHalf,
    wallRight: centerX + wallHalf,
  };
}

export const sinkWidth = SPACING;
export const sinkHeight = SINK_H;

function bucketFromX(board: Board, padX: number): number {
  const idx = Math.round((unpad(padX) - board.sinkXs[0]!) / SPACING);
  return Math.max(0, Math.min(board.rows, idx));
}

/**
 * Advance the ball one physics step. Returns the landed sink index once the
 * ball reaches the sink mouth, otherwise null. Mutates `ball`.
 */
export function stepBall(ball: Ball, board: Board): number | null {
  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Only test pegs in the ball's current row ±1 — far pegs can never collide,
  // so this is physically identical to checking them all, just cheaper.
  const approxRow = Math.floor((unpad(ball.y) - TOP_Y) / ROW_GAP);
  const collideDist = pad(BALL_RADIUS + OBSTACLE_RADIUS);
  for (let r = approxRow - 1; r <= approxRow + 1; r++) {
    const row = board.pegRows[r];
    if (!row) continue;
    const dy = ball.y - row.padY;
    for (const px of row.padXs) {
      const dx = ball.x - px;
      const dist = Math.hypot(dx, dy);
      if (dist < collideDist) {
        const angle = Math.atan2(dy, dx);
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(angle) * speed * H_FRICTION;
        ball.vy = Math.sin(angle) * speed * V_FRICTION;
        const overlap = BALL_RADIUS + OBSTACLE_RADIUS - unpad(dist);
        ball.x += pad(Math.cos(angle) * overlap);
        ball.y += pad(Math.sin(angle) * overlap);
      }
    }
  }

  // Invisible side walls — reflect the ball inward so it can never fly out the
  // side and clamp to an end bucket.
  const padR = pad(BALL_RADIUS);
  const padWallL = pad(board.wallLeft) + padR;
  const padWallR = pad(board.wallRight) - padR;
  if (ball.x < padWallL) {
    ball.x = padWallL;
    ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
  } else if (ball.x > padWallR) {
    ball.x = padWallR;
    ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
  }

  if (unpad(ball.y) + BALL_RADIUS >= board.sinkTopY) {
    return bucketFromX(board, ball.x);
  }
  return null;
}

const MAX_STEPS = 6000;

/** Headlessly simulate a drop from `startX` (unpadded) and return its bucket. */
export function simulateLanding(board: Board, startX: number): number {
  const ball: Ball = { x: pad(startX), y: pad(START_Y), vx: 0, vy: 0 };
  for (let i = 0; i < MAX_STEPS; i++) {
    const idx = stepBall(ball, board);
    if (idx !== null) return idx;
  }
  return bucketFromX(board, ball.x);
}

export function spawnBall(startX: number): Ball {
  return { x: pad(startX), y: pad(START_Y), vx: 0, vy: 0 };
}

export function ballDrawPos(ball: Ball): { x: number; y: number } {
  return { x: unpad(ball.x), y: unpad(ball.y) };
}

function sweepWindow(board: Board, lo: number, hi: number): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let b = 0; b <= board.rows; b++) map.set(b, []);
  const samples = 800;
  for (let k = 0; k <= samples; k++) {
    const sx = lo + ((hi - lo) * k) / samples;
    map.get(simulateLanding(board, sx))!.push(sx);
  }
  return map;
}

function coversAll(map: Map<number, number[]>, rows: number): boolean {
  for (let b = 0; b <= rows; b++) if ((map.get(b)?.length ?? 0) === 0) return false;
  return true;
}

function fillGaps(map: Map<number, number[]>, board: Board): Map<number, number[]> {
  for (let b = 0; b <= board.rows; b++) {
    if ((map.get(b)?.length ?? 0) > 0) continue;
    const target = board.sinkXs[b]!;
    let found = false;
    for (let off = 0; off <= SPACING * 2 && !found; off += 0.2) {
      for (const sx of [target - off, target + off]) {
        if (simulateLanding(board, sx) === b) {
          map.get(b)!.push(sx);
          found = true;
          break;
        }
      }
    }
    if (!found) map.get(b)!.push(target);
  }
  return map;
}

/**
 * Presimulate the board to map each bucket → starting X positions that land
 * there. Real Plinko drops from the top centre, so we use the NARROWEST start
 * window around centre that still reaches every bucket (chaotic peg bounces
 * fan a tight cluster of starts out across all sinks). Falls back to a fine
 * targeted scan for any bucket a window misses.
 */
export function buildStartXMap(board: Board): Map<number, number[]> {
  const center = board.centerX;
  const fullHalf = (board.sinkXs[board.rows]! - board.sinkXs[0]!) / 2;
  const candidates = [0.6, 1, 1.5, 2, 3, 4.5, 6].map((m) => m * SPACING).filter((w) => w < fullHalf);
  candidates.push(fullHalf);
  for (const halfW of candidates) {
    const map = sweepWindow(board, center - halfW, center + halfW);
    if (coversAll(map, board.rows)) return fillGaps(map, board);
  }
  return fillGaps(sweepWindow(board, center - fullHalf, center + fullHalf), board);
}

const boardCache = new Map<number, { board: Board; startXMap: Map<number, number[]> }>();

/** Memoised board + presim per row count. */
export function getBoard(rows: number): { board: Board; startXMap: Map<number, number[]> } {
  let cached = boardCache.get(rows);
  if (!cached) {
    const board = createBoard(rows);
    cached = { board, startXMap: buildStartXMap(board) };
    boardCache.set(rows, cached);
  }
  return cached;
}

/** Pick a startX (unpadded) known to land in `bucket` for this board. */
export function startXForBucket(startXMap: Map<number, number[]>, bucket: number): number {
  const list = startXMap.get(bucket);
  if (!list || list.length === 0) return 0;
  return list[Math.floor(Math.random() * list.length)]!;
}
