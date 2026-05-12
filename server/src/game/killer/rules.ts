// Killer mode rules. Pure functions; no side effects.

import {
  CAGE_DURATION_ROUNDS,
  Coord,
  KILLER_IDS,
  killRangeFor,
  killerStepFor,
  KillerAction,
  KillerActionResult,
  KillerGameConfig,
  KillerGameState,
  KillerPlayerId,
  KillerPlayerState,
  NO_WALLS,
  PlacedWall,
  PlacedZone,
  RUNNER_MAX_HP,
  RUNNER_STEP,
  STARTING_WALLS,
  STRIKE_DAMAGE,
  SUPERCHARGE_COOLDOWN,
  WallEdge,
  WallShape,
  ZONE_DURATION_ROUNDS,
  ZONE_KINDS,
  ZONE_SIZE,
  ZONE_SPAWN_INTERVAL,
  ZoneKind,
} from "./types.js";

// ----- Setup --------------------------------------------------------------

export function createKillerInitialState(
  config: KillerGameConfig,
  rng: () => number = Math.random,
): KillerGameState {
  const { size } = config;
  if (config.players.length !== 4) {
    throw new Error("Killer mode needs exactly 4 players");
  }

  const killerIdx = Math.floor(rng() * 4);

  const corners: Coord[] = [
    { r: 0, c: 0 },
    { r: 0, c: size - 1 },
    { r: size - 1, c: 0 },
    { r: size - 1, c: size - 1 },
  ];
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corners[i], corners[j]] = [corners[j], corners[i]];
  }

  const players: KillerPlayerState[] = config.players.map((cfg, i) => {
    const isKiller = i === killerIdx;
    return {
      id: KILLER_IDS[i],
      name: cfg.name,
      style: cfg.style,
      color: cfg.color,
      role: isKiller ? "killer" : "runner",
      pos: corners[i],
      hp: isKiller ? Number.POSITIVE_INFINITY : RUNNER_MAX_HP,
      hpMax: isKiller ? Number.POSITIVE_INFINITY : RUNNER_MAX_HP,
      alive: true,
      walls: isKiller ? { ...NO_WALLS } : { ...STARTING_WALLS },
      // Killer starts with Supercharge ready. Runners' fields are inert.
      superchargeReady: isKiller,
      superchargeProgress: 0,
    };
  });

  return {
    size,
    players,
    turnIdx: 0,
    moveCount: 0,
    moveCap: config.moveCap,
    zonesEnabled: config.zonesEnabled,
    roundCount: 0,
    status: "playing",
    winner: undefined,
    walls: [],
    zones: [],
    lastStrike: null,
  };
}

// ----- Helpers ------------------------------------------------------------

export function getPlayer(state: KillerGameState, id: KillerPlayerId): KillerPlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`No player ${id}`);
  return p;
}

export function activePlayer(state: KillerGameState): KillerPlayerState {
  return state.players[state.turnIdx];
}

export function getKiller(state: KillerGameState): KillerPlayerState {
  return state.players.find((p) => p.role === "killer")!;
}

export function getRunners(state: KillerGameState): KillerPlayerState[] {
  return state.players.filter((p) => p.role === "runner");
}

export function inBounds(size: number, c: Coord): boolean {
  return c.r >= 0 && c.r < size && c.c >= 0 && c.c < size;
}

function eq(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function isOrthoNeighbor(a: Coord, b: Coord): boolean {
  return manhattan(a, b) === 1;
}

function isOccupiedByOther(state: KillerGameState, to: Coord, mover: KillerPlayerId): boolean {
  return state.players.some((p) => p.alive && p.id !== mover && eq(p.pos, to));
}

// ----- Zone helpers -------------------------------------------------------

export function cellInZone(c: Coord, zone: PlacedZone): boolean {
  return (
    c.r >= zone.anchor.r &&
    c.r < zone.anchor.r + zone.size &&
    c.c >= zone.anchor.c &&
    c.c < zone.anchor.c + zone.size
  );
}

export function zonesAt(state: KillerGameState, c: Coord): PlacedZone[] {
  return state.zones.filter((z) => cellInZone(c, z));
}

export function isInZoneKind(
  state: KillerGameState,
  c: Coord,
  kind: ZoneKind,
): boolean {
  return state.zones.some((z) => z.kind === kind && cellInZone(c, z));
}

export function countZoneKindAt(
  state: KillerGameState,
  c: Coord,
  kind: ZoneKind,
): number {
  let n = 0;
  for (const z of state.zones) if (z.kind === kind && cellInZone(c, z)) n++;
  return n;
}

/**
 * Step allowance for a player at the start of their Move, factoring in
 * Fast Zone (Runner +1) and Slow Zone (Killer −1, stackable, floored at 0).
 */
export function effectiveStepFor(
  state: KillerGameState,
  player: KillerPlayerState,
): number {
  if (player.role === "killer") {
    const base = killerStepFor(state.size);
    const slow = countZoneKindAt(state, player.pos, "slow");
    return Math.max(0, base - slow);
  }
  const base = RUNNER_STEP;
  const bonus = isInZoneKind(state, player.pos, "fast") ? 1 : 0;
  return base + bonus;
}

// ----- Wall edge helpers --------------------------------------------------

function edgeKey(e: WallEdge): string {
  return `${e.orientation}:${e.r}:${e.c}`;
}

export function buildBlockedSet(walls: PlacedWall[]): Set<string> {
  const s = new Set<string>();
  for (const w of walls) for (const e of w.edges) s.add(edgeKey(e));
  return s;
}

function edgeBetween(a: Coord, b: Coord): WallEdge | null {
  if (a.r === b.r && Math.abs(a.c - b.c) === 1) {
    return { orientation: "v", r: a.r, c: Math.min(a.c, b.c) };
  }
  if (a.c === b.c && Math.abs(a.r - b.r) === 1) {
    return { orientation: "h", r: Math.min(a.r, b.r), c: a.c };
  }
  return null;
}

/** True if there is a wall on the edge between two adjacent cells. */
function isBlockedBetween(blocked: Set<string>, a: Coord, b: Coord): boolean {
  const e = edgeBetween(a, b);
  if (!e) return true; // not adjacent
  return blocked.has(edgeKey(e));
}

// ----- Wall shape construction --------------------------------------------

function isEdgeInBounds(size: number, e: WallEdge): boolean {
  if (e.orientation === "h") {
    // horizontal edge sits between row e.r and row e.r+1, on column e.c
    return e.r >= 0 && e.r < size - 1 && e.c >= 0 && e.c < size;
  }
  // vertical edge sits between col e.c and col e.c+1, on row e.r
  return e.c >= 0 && e.c < size - 1 && e.r >= 0 && e.r < size;
}

/**
 * Build the edges that make up a wall shape.
 *
 * frame2 / frame3 (length-2 / length-3 stick, same as 2-player walls):
 *   anchor = the top-left cell the wall sits next to. With orientation
 *   "h" the wall lies along the bottom edge of cells (r, c..c+len-1).
 *   With orientation "v" it lies along the right edge of cells
 *   (r..r+len-1, c).
 *
 * cage (1×1 ring around `anchor`):
 *   top:    h at (anchor.r-1, anchor.c)
 *   bottom: h at (anchor.r,   anchor.c)
 *   left:   v at (anchor.r,   anchor.c-1)
 *   right:  v at (anchor.r,   anchor.c)
 */
export function edgesForShape(
  shape: WallShape,
  anchor: Coord,
  orientation: "h" | "v" = "h",
): WallEdge[] {
  const r = anchor.r;
  const c = anchor.c;
  if (shape === "cage") {
    return [
      { orientation: "h", r: r - 1, c },
      { orientation: "h", r, c },
      { orientation: "v", r, c: c - 1 },
      { orientation: "v", r, c },
    ];
  }
  const len = shape === "frame2" ? 2 : 3;
  const edges: WallEdge[] = [];
  if (orientation === "h") {
    for (let i = 0; i < len; i++) {
      edges.push({ orientation: "h", r, c: c + i });
    }
  } else {
    for (let i = 0; i < len; i++) {
      edges.push({ orientation: "v", r: r + i, c });
    }
  }
  return edges;
}

// ----- Reachable / kill BFS (now wall-aware) ------------------------------

export function reachableCells(
  state: KillerGameState,
  from: Coord,
  maxSteps: number,
  mover: KillerPlayerId,
): Coord[] {
  const blocked = buildBlockedSet(state.walls);
  const seen = new Map<string, number>();
  seen.set(`${from.r}:${from.c}`, 0);
  const out: Coord[] = [];
  const queue: Coord[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const dist = seen.get(`${cur.r}:${cur.c}`)!;
    if (dist > 0) out.push(cur);
    if (dist >= maxSteps) continue;
    const nbrs: Coord[] = [
      { r: cur.r - 1, c: cur.c },
      { r: cur.r + 1, c: cur.c },
      { r: cur.r, c: cur.c - 1 },
      { r: cur.r, c: cur.c + 1 },
    ];
    for (const n of nbrs) {
      if (!inBounds(state.size, n)) continue;
      if (isBlockedBetween(blocked, cur, n)) continue;
      if (isOccupiedByOther(state, n, mover)) continue;
      const k = `${n.r}:${n.c}`;
      if (seen.has(k)) continue;
      seen.set(k, dist + 1);
      queue.push(n);
    }
  }
  return out;
}

export function killRadius(
  state: KillerGameState,
  from: Coord,
  range: number = killRangeFor(state.size),
): Coord[] {
  const blocked = buildBlockedSet(state.walls);
  const out: Coord[] = [];
  const seen = new Map<string, number>();
  seen.set(`${from.r}:${from.c}`, 0);
  const queue: Coord[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const dist = seen.get(`${cur.r}:${cur.c}`)!;
    if (dist > 0) out.push(cur);
    if (dist >= range) continue;
    const nbrs: Coord[] = [
      { r: cur.r - 1, c: cur.c },
      { r: cur.r + 1, c: cur.c },
      { r: cur.r, c: cur.c - 1 },
      { r: cur.r, c: cur.c + 1 },
    ];
    for (const n of nbrs) {
      if (!inBounds(state.size, n)) continue;
      if (isBlockedBetween(blocked, cur, n)) continue;
      const k = `${n.r}:${n.c}`;
      if (seen.has(k)) continue;
      seen.set(k, dist + 1);
      queue.push(n);
    }
  }
  return out;
}

/**
 * Returns the cells the Killer can strike from their current position.
 * If the Killer is standing in a Killer Zone, walls are ignored (Manhattan
 * disc up to kill range). Otherwise the normal wall-aware BFS is used.
 */
export function killStrikeRadius(state: KillerGameState): Coord[] {
  const killer = getKiller(state);
  const range = killRangeFor(state.size);
  if (isInZoneKind(state, killer.pos, "killer")) {
    const out: Coord[] = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (r === killer.pos.r && c === killer.pos.c) continue;
        if (manhattan(killer.pos, { r, c }) <= range) out.push({ r, c });
      }
    }
    return out;
  }
  return killRadius(state, killer.pos, range);
}

// ----- Wall placement validation ------------------------------------------

export function validateWallPlacement(
  state: KillerGameState,
  player: KillerPlayerId,
  shape: WallShape,
  anchor: Coord,
  orientation: "h" | "v" = "h",
): { ok: true; edges: WallEdge[] } | { ok: false; reason: string } {
  const me = getPlayer(state, player);
  if (me.role !== "runner") return { ok: false, reason: "Only Runners place walls." };
  if ((me.walls[shape] ?? 0) <= 0) {
    return { ok: false, reason: `No ${shape} left.` };
  }

  let edges = edgesForShape(shape, anchor, orientation);

  if (shape === "cage") {
    // O-Cage must wrap the Killer.
    const killer = getKiller(state);
    if (!eq(killer.pos, anchor)) {
      return { ok: false, reason: "O-Cage must wrap the Killer." };
    }
    // Cage fills in only the *missing* sides. Drop edges that fall off the
    // board (e.g. when the Killer is in a corner) or that already have a
    // wall — we don't fight existing walls, we complete the enclosure.
    const existing = buildBlockedSet(state.walls);
    edges = edges.filter(
      (e) => isEdgeInBounds(state.size, e) && !existing.has(edgeKey(e)),
    );
    if (edges.length === 0) {
      return { ok: false, reason: "Killer is already sealed in." };
    }
    return { ok: true, edges };
  }

  // Stick walls: every edge must be in-bounds and free.
  for (const e of edges) {
    if (!isEdgeInBounds(state.size, e)) {
      return { ok: false, reason: "Wall is out of bounds." };
    }
  }
  const existing = buildBlockedSet(state.walls);
  for (const e of edges) {
    if (existing.has(edgeKey(e))) {
      return { ok: false, reason: "Wall overlaps an existing wall." };
    }
  }

  return { ok: true, edges };
}

// ----- Apply action -------------------------------------------------------

export function applyKillerAction(
  state: KillerGameState,
  action: KillerAction,
): KillerActionResult {
  if (state.status !== "playing") return { ok: false, reason: "Game is over." };

  const me = activePlayer(state);
  if (action.player !== me.id) return { ok: false, reason: "Not your Move." };
  if (!me.alive) return { ok: false, reason: "Dead players can't act." };

  if (action.type === "skip") {
    return { ok: true, state: endMove(state) };
  }

  if (action.type === "supercharge") {
    return applySupercharge(state, me, action.wallIndex, action.edgeIndex);
  }

  if (action.type === "strike") {
    return applyStrike(state, me, action.target);
  }

  if (action.type === "snipe") {
    return applySnipe(state, me, action.target);
  }

  if (action.type === "placeWall") {
    return applyPlaceWall(state, me, action.shape, action.anchor, action.orientation ?? "h");
  }

  // step
  const maxSteps = effectiveStepFor(state, me);
  if (maxSteps <= 0) {
    return { ok: false, reason: "You can't step this Move." };
  }
  if (action.path.length === 0) {
    return { ok: false, reason: "Empty path." };
  }
  if (action.path.length > maxSteps) {
    return { ok: false, reason: `Too many steps (max ${maxSteps}).` };
  }

  const blocked = buildBlockedSet(state.walls);
  let cursor = me.pos;
  for (const cell of action.path) {
    if (!inBounds(state.size, cell)) return { ok: false, reason: "Out of bounds." };
    if (!isOrthoNeighbor(cursor, cell)) {
      return { ok: false, reason: "Steps must be orthogonal neighbors." };
    }
    if (isBlockedBetween(blocked, cursor, cell)) {
      return { ok: false, reason: "Blocked by a wall." };
    }
    if (isOccupiedByOther(state, cell, me.id)) {
      return { ok: false, reason: "Square is occupied." };
    }
    cursor = cell;
  }

  const finalPos = action.path[action.path.length - 1];
  let next: KillerGameState = {
    ...state,
    players: state.players.map((p) => (p.id === me.id ? { ...p, pos: finalPos } : p)),
  };

  // Stepping does NOT automatically strike. The Killer must explicitly use a
  // strike action on their turn (which costs the whole Move).

  return { ok: true, state: endMove(next) };
}

function applySupercharge(
  state: KillerGameState,
  me: KillerPlayerState,
  wallIndex: number,
  edgeIndex: number,
): KillerActionResult {
  if (me.role !== "killer") {
    return { ok: false, reason: "Only the Killer has Supercharge." };
  }
  if (!me.superchargeReady) {
    return {
      ok: false,
      reason: `Supercharge not ready (${me.superchargeProgress}/${SUPERCHARGE_COOLDOWN}).`,
    };
  }
  if (wallIndex < 0 || wallIndex >= state.walls.length) {
    return { ok: false, reason: "Wall not found." };
  }
  const wall = state.walls[wallIndex];
  if (edgeIndex < 0 || edgeIndex >= wall.edges.length) {
    return { ok: false, reason: "Wall edge not found." };
  }

  const newEdges = wall.edges.filter((_, i) => i !== edgeIndex);
  const newWalls =
    newEdges.length === 0
      ? state.walls.filter((_, i) => i !== wallIndex)
      : state.walls.map((w, i) => (i === wallIndex ? { ...w, edges: newEdges } : w));

  const players = state.players.map((p) =>
    p.id === me.id
      ? { ...p, superchargeReady: false, superchargeProgress: 0 }
      : p,
  );

  // Free action: don't end the Move.
  return { ok: true, state: { ...state, walls: newWalls, players } };
}

function applyPlaceWall(
  state: KillerGameState,
  me: KillerPlayerState,
  shape: WallShape,
  anchor: Coord,
  orientation: "h" | "v",
): KillerActionResult {
  const v = validateWallPlacement(state, me.id, shape, anchor, orientation);
  if (!v.ok) return { ok: false, reason: v.reason };

  const wall: PlacedWall = {
    shape,
    owner: me.id,
    edges: v.edges,
    expiresOnRound:
      shape === "cage" ? state.roundCount + CAGE_DURATION_ROUNDS : undefined,
  };

  const players = state.players.map((p) =>
    p.id === me.id
      ? {
          ...p,
          walls: { ...p.walls, [shape]: (p.walls[shape] ?? 0) - 1 },
        }
      : p,
  );

  const next: KillerGameState = {
    ...state,
    players,
    walls: [...state.walls, wall],
  };
  return { ok: true, state: endMove(next) };
}

function applyStrike(
  state: KillerGameState,
  me: KillerPlayerState,
  targetId: KillerPlayerId,
): KillerActionResult {
  if (me.role !== "killer") {
    return { ok: false, reason: "Only the Killer can strike." };
  }
  const target = state.players.find((p) => p.id === targetId);
  if (!target) return { ok: false, reason: "Target not found." };
  if (target.role !== "runner") {
    return { ok: false, reason: "Target must be a Runner." };
  }
  if (!target.alive) return { ok: false, reason: "Target is already dead." };

  // The target must be inside the Killer's strike radius right now.
  const radius = killStrikeRadius(state);
  const inRange = radius.some(
    (c) => c.r === target.pos.r && c.c === target.pos.c,
  );
  if (!inRange) return { ok: false, reason: "Target is out of range." };

  const newHp = Math.max(0, target.hp - STRIKE_DAMAGE);
  const players = state.players.map((p) =>
    p.id === target.id ? { ...p, hp: newHp, alive: newHp > 0 } : p,
  );

  let next: KillerGameState = {
    ...state,
    players,
    lastStrike: { killer: me.id, victims: [target.id] },
  };

  // Killer-wins condition?
  if (getRunners(next).every((r) => !r.alive)) {
    return {
      ok: true,
      state: { ...next, status: "finished", winner: "killer" },
    };
  }

  // The strike consumes the entire Move.
  return { ok: true, state: endMove(next) };
}

function applySnipe(
  state: KillerGameState,
  me: KillerPlayerState,
  targetId: KillerPlayerId,
): KillerActionResult {
  if (me.role !== "killer") {
    return { ok: false, reason: "Only the Killer can snipe." };
  }
  if (!isInZoneKind(state, me.pos, "snipe")) {
    return { ok: false, reason: "You must stand inside a Snipe Zone." };
  }
  const target = state.players.find((p) => p.id === targetId);
  if (!target) return { ok: false, reason: "Target not found." };
  if (target.role !== "runner") {
    return { ok: false, reason: "Target must be a Runner." };
  }
  if (!target.alive) return { ok: false, reason: "Target is already dead." };

  const newHp = Math.max(0, target.hp - STRIKE_DAMAGE);
  const players = state.players.map((p) =>
    p.id === target.id ? { ...p, hp: newHp, alive: newHp > 0 } : p,
  );

  let next: KillerGameState = {
    ...state,
    players,
    lastStrike: { killer: me.id, victims: [target.id] },
  };

  if (getRunners(next).every((r) => !r.alive)) {
    return {
      ok: true,
      state: { ...next, status: "finished", winner: "killer" },
    };
  }

  return { ok: true, state: endMove(next) };
}

function endMove(state: KillerGameState): KillerGameState {
  // The player whose Move is ending right now (before turnIdx advances).
  const justActed = state.players[state.turnIdx];

  let nextIdx = (state.turnIdx + 1) % state.players.length;
  let safety = 0;
  while (!state.players[nextIdx].alive && safety < state.players.length) {
    nextIdx = (nextIdx + 1) % state.players.length;
    safety++;
  }

  const moveCount = state.moveCount + 1;
  const roundCount = Math.floor(moveCount / state.players.length);
  const roundChanged = roundCount !== state.roundCount;

  // Expire walls whose lifetime is up (cages mostly).
  let walls = roundChanged
    ? state.walls.filter(
        (w) => w.expiresOnRound === undefined || w.expiresOnRound > roundCount,
      )
    : state.walls;

  // Tick the Killer's Supercharge cooldown if the Killer just finished a Move.
  let players =
    justActed.role === "killer" && !justActed.superchargeReady
      ? state.players.map((p) => {
          if (p.id !== justActed.id) return p;
          const progress = p.superchargeProgress + 1;
          if (progress >= SUPERCHARGE_COOLDOWN) {
            return { ...p, superchargeReady: true, superchargeProgress: 0 };
          }
          return { ...p, superchargeProgress: progress };
        })
      : state.players;

  let zones = state.zones;

  // End-of-round zone effects.
  if (roundChanged) {
    // Heal: each alive Runner inside any Heal Zone heals ½ heart (cap = hpMax).
    const healZones = zones.filter((z) => z.kind === "heal");
    if (healZones.length > 0) {
      players = players.map((p) => {
        if (p.role !== "runner" || !p.alive) return p;
        const inHeal = healZones.some((z) => cellInZone(p.pos, z));
        if (!inHeal) return p;
        const newHp = Math.min(p.hpMax, p.hp + 1);
        if (newHp === p.hp) return p;
        return { ...p, hp: newHp };
      });
    }

    // Expire zones.
    zones = zones.filter((z) => z.expiresOnRound > roundCount);
  }

  // Auto-spawn a random zone every ZONE_SPAWN_INTERVAL Moves.
  if (state.zonesEnabled && moveCount > 0 && moveCount % ZONE_SPAWN_INTERVAL === 0) {
    const spawned = spawnRandomZone(state.size, roundCount, moveCount);
    if (spawned) zones = [...zones, spawned];
  }

  let next: KillerGameState = {
    ...state,
    turnIdx: nextIdx,
    moveCount,
    roundCount,
    walls,
    zones,
    players,
  };

  if (moveCount >= state.moveCap) {
    const runnersAlive = getRunners(next).some((r) => r.alive);
    next = {
      ...next,
      status: "finished",
      winner: runnersAlive ? "runners" : "killer",
    };
  }

  return next;
}

function spawnRandomZone(boardSize: number, roundCount: number, moveCount: number): PlacedZone | null {
  const kind = ZONE_KINDS[Math.floor(Math.random() * ZONE_KINDS.length)];
  const zSize = ZONE_SIZE[kind];
  if (zSize > boardSize) return null;
  const maxAnchor = boardSize - zSize;
  const r = Math.floor(Math.random() * (maxAnchor + 1));
  const c = Math.floor(Math.random() * (maxAnchor + 1));
  return {
    kind,
    anchor: { r, c },
    size: zSize,
    expiresOnRound: roundCount + ZONE_DURATION_ROUNDS[kind],
    spawnedOnMove: moveCount,
  };
}
