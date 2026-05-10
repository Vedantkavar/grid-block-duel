import {
  Action,
  ActionResult,
  Coord,
  DEFAULT_CONFIG,
  GameConfig,
  GameState,
  PlayerId,
  Wall,
  WallLength,
} from "./types";

export const DEFAULT_BOARD_SIZE = 9;

export const DEFAULT_WALLS = { len2: 4, len3: 2 };

export function createInitialState(config: GameConfig = DEFAULT_CONFIG): GameState {
  const { size } = config;
  const mid = Math.floor(size / 2);
  return {
    size,
    players: {
      // Player A starts at the bottom, goal is row 0 (top)
      A: {
        pos: { r: size - 1, c: mid },
        walls: { ...config.walls },
        goalRow: 0,
        name: config.players.A.name,
        style: config.players.A.style,
      },
      // Player B starts at the top, goal is the bottom row
      B: {
        pos: { r: 0, c: mid },
        walls: { ...config.walls },
        goalRow: size - 1,
        name: config.players.B.name,
        style: config.players.B.style,
      },
    },
    walls: [],
    turn: "A",
    status: "playing",
  };
}

export function other(p: PlayerId): PlayerId {
  return p === "A" ? "B" : "A";
}

// --- Edge encoding ---------------------------------------------------------
// We model walls as a set of blocked edges between adjacent cells.
// "h:r:c"  -> blocks edge between (r, c) and (r+1, c)   (a horizontal cut)
// "v:r:c"  -> blocks edge between (r, c) and (r, c+1)   (a vertical cut)

export function wallEdges(w: Pick<Wall, "orientation" | "r" | "c" | "length">): string[] {
  const edges: string[] = [];
  if (w.orientation === "h") {
    for (let i = 0; i < w.length; i++) edges.push(`h:${w.r}:${w.c + i}`);
  } else {
    for (let i = 0; i < w.length; i++) edges.push(`v:${w.r + i}:${w.c}`);
  }
  return edges;
}

export function buildBlockedSet(walls: Wall[]): Set<string> {
  const s = new Set<string>();
  for (const w of walls) for (const e of wallEdges(w)) s.add(e);
  return s;
}

function edgeBetween(a: Coord, b: Coord): string | null {
  if (a.r === b.r && Math.abs(a.c - b.c) === 1) {
    const c = Math.min(a.c, b.c);
    return `v:${a.r}:${c}`;
  }
  if (a.c === b.c && Math.abs(a.r - b.r) === 1) {
    const r = Math.min(a.r, b.r);
    return `h:${r}:${a.c}`;
  }
  return null;
}

// --- Move validation -------------------------------------------------------

export function inBounds(size: number, c: Coord): boolean {
  return c.r >= 0 && c.r < size && c.c >= 0 && c.c < size;
}

export function neighbors(state: GameState, from: Coord, blocked: Set<string>): Coord[] {
  const { size } = state;
  const candidates: Coord[] = [
    { r: from.r - 1, c: from.c },
    { r: from.r + 1, c: from.c },
    { r: from.r, c: from.c - 1 },
    { r: from.r, c: from.c + 1 },
  ];
  return candidates.filter((to) => {
    if (!inBounds(size, to)) return false;
    const e = edgeBetween(from, to);
    if (!e || blocked.has(e)) return false;
    return true;
  });
}

export function legalMovesFor(state: GameState, p: PlayerId): Coord[] {
  const blocked = buildBlockedSet(state.walls);
  const me = state.players[p];
  const opp = state.players[other(p)];
  return neighbors(state, me.pos, blocked).filter(
    (n) => !(n.r === opp.pos.r && n.c === opp.pos.c),
  );
}

// --- Wall validation -------------------------------------------------------

function wallAnchorInBounds(size: number, w: Pick<Wall, "orientation" | "r" | "c" | "length">) {
  if (w.orientation === "h") {
    return w.r >= 0 && w.r < size - 1 && w.c >= 0 && w.c <= size - w.length;
  }
  return w.r >= 0 && w.r <= size - w.length && w.c >= 0 && w.c < size - 1;
}

// BFS: can `from` reach any cell with row === goalRow?
function canReachRow(
  size: number,
  from: Coord,
  goalRow: number,
  blocked: Set<string>,
): boolean {
  const seen = new Set<string>();
  const queue: Coord[] = [from];
  seen.add(`${from.r}:${from.c}`);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.r === goalRow) return true;
    const dummyState = { size } as unknown as GameState;
    for (const n of neighbors(dummyState, cur, blocked)) {
      const k = `${n.r}:${n.c}`;
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return false;
}

export function validateWallPlacement(
  state: GameState,
  player: PlayerId,
  wall: Pick<Wall, "orientation" | "r" | "c" | "length">,
): { ok: true } | { ok: false; reason: string } {
  if (!wallAnchorInBounds(state.size, wall)) {
    return { ok: false, reason: "Wall is out of bounds." };
  }

  const inv = state.players[player].walls;
  const have = wall.length === 2 ? inv.len2 : inv.len3;
  if (have <= 0) return { ok: false, reason: `No length-${wall.length} walls left.` };

  const newEdges = wallEdges(wall);
  const existing = buildBlockedSet(state.walls);
  for (const e of newEdges) {
    if (existing.has(e)) return { ok: false, reason: "Wall overlaps an existing wall." };
  }

  // Path-existence rule: both players must still have a path to their goal.
  const blockedAfter = new Set(existing);
  for (const e of newEdges) blockedAfter.add(e);
  const a = state.players.A;
  const b = state.players.B;
  if (!canReachRow(state.size, a.pos, a.goalRow, blockedAfter)) {
    return { ok: false, reason: "Wall would seal off Player A." };
  }
  if (!canReachRow(state.size, b.pos, b.goalRow, blockedAfter)) {
    return { ok: false, reason: "Wall would seal off Player B." };
  }
  return { ok: true };
}

// --- Apply action ---------------------------------------------------------

export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status !== "playing") return { ok: false, reason: "Game is over." };
  if (action.player !== state.turn) return { ok: false, reason: "Not your turn." };

  if (action.type === "move") {
    const me = state.players[action.player];
    const opp = state.players[other(action.player)];
    const blocked = buildBlockedSet(state.walls);
    const ok = neighbors(state, me.pos, blocked).some(
      (n) => n.r === action.to.r && n.c === action.to.c,
    );
    if (!ok) return { ok: false, reason: "Illegal move." };
    if (action.to.r === opp.pos.r && action.to.c === opp.pos.c) {
      return { ok: false, reason: "Square is occupied." };
    }
    const next: GameState = {
      ...state,
      players: {
        ...state.players,
        [action.player]: { ...me, pos: action.to },
      },
      turn: other(action.player),
    };
    if (action.to.r === me.goalRow) {
      next.status = "finished";
      next.winner = action.player;
    }
    return { ok: true, state: next };
  }

  // place wall
  const v = validateWallPlacement(state, action.player, action.wall);
  if (!v.ok) return { ok: false, reason: v.reason };
  const len = action.wall.length as WallLength;
  const me = state.players[action.player];
  const newInv = {
    len2: me.walls.len2 - (len === 2 ? 1 : 0),
    len3: me.walls.len3 - (len === 3 ? 1 : 0),
  };
  const newWall: Wall = { ...action.wall, owner: action.player };
  return {
    ok: true,
    state: {
      ...state,
      walls: [...state.walls, newWall],
      players: {
        ...state.players,
        [action.player]: { ...me, walls: newInv },
      },
      turn: other(action.player),
    },
  };
}
