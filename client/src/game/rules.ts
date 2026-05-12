// Pure game rules. Shared with the server (kept in sync).

import {
  ABILITY_CAP,
  Action,
  ActionResult,
  ALL_ABILITIES,
  AbilityCharge,
  AbilityId,
  Coord,
  DEFAULT_CONFIG,
  FIRST_BOX_DELAY_TURNS,
  GameConfig,
  GameState,
  LootBox,
  MAX_BOXES,
  MIN_SPAWN_DIST,
  PendingPickup,
  PlayerId,
  TRAP_HITS,
  TRAP_TURNS,
  Trap,
  Wall,
  WallLength,
} from "./types";

// ----- Setup ---------------------------------------------------------------

export function createInitialState(
  config: GameConfig = DEFAULT_CONFIG,
  rng: () => number = Math.random,
): GameState {
  const { size } = config;
  const mid = Math.floor(size / 2);
  const base: GameState = {
    size,
    players: {
      A: {
        pos: { r: size - 1, c: mid },
        walls: { ...config.walls },
        goalRow: 0,
        name: config.players.A.name,
        style: config.players.A.style,
        abilities: [],
      },
      B: {
        pos: { r: 0, c: mid },
        walls: { ...config.walls },
        goalRow: size - 1,
        name: config.players.B.name,
        style: config.players.B.style,
        abilities: [],
      },
    },
    walls: [],
    turn: "A",
    status: "playing",
    abilitiesEnabled: config.abilitiesEnabled,
    turnCount: 0,
    lootBoxes: [],
    lastPickupPos: null,
    lastPickupTurn: null,
    traps: [],
    scramblePending: null,
    pendingPickup: null,
  };
  // Game starts with two loot boxes on the board (only if abilities enabled).
  if (!config.abilitiesEnabled) {
    return base;
  }
  let state = base;
  for (let i = 0; i < MAX_BOXES; i++) {
    const pos = pickSpawnCell(state, rng);
    if (!pos) break;
    // Avoid duplicate abilities across the starting boxes.
    const taken = state.lootBoxes.map((b) => b.ability);
    const ability = pickRandomAbility(rng, taken);
    state = {
      ...state,
      lootBoxes: [...state.lootBoxes, { pos, ability, spawnedTurn: 0 }],
    };
  }
  return state;
}

export function other(p: PlayerId): PlayerId {
  return p === "A" ? "B" : "A";
}

// ----- Edges + walls -------------------------------------------------------

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

export function inBounds(size: number, c: Coord): boolean {
  return c.r >= 0 && c.r < size && c.c >= 0 && c.c < size;
}

function eq(a: Coord, b: Coord) {
  return a.r === b.r && a.c === b.c;
}

function manhattan(a: Coord, b: Coord) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
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
  return neighbors(state, me.pos, blocked).filter((n) => !eq(n, opp.pos));
}

// ----- Path validation -----------------------------------------------------

function wallAnchorInBounds(size: number, w: Pick<Wall, "orientation" | "r" | "c" | "length">) {
  if (w.orientation === "h") {
    return w.r >= 0 && w.r < size - 1 && w.c >= 0 && w.c <= size - w.length;
  }
  return w.r >= 0 && w.r <= size - w.length && w.c >= 0 && w.c < size - 1;
}

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
    const candidates: Coord[] = [
      { r: cur.r - 1, c: cur.c },
      { r: cur.r + 1, c: cur.c },
      { r: cur.r, c: cur.c - 1 },
      { r: cur.r, c: cur.c + 1 },
    ];
    for (const n of candidates) {
      if (!inBounds(size, n)) continue;
      const e = edgeBetween(cur, n);
      if (!e || blocked.has(e)) continue;
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
  if (wall.length < 2) {
    return { ok: false, reason: "Wall must be at least length 2." };
  }
  const inv = state.players[player].walls;
  const have = wall.length === 2 ? inv.len2 : inv.len3;
  if (have <= 0) return { ok: false, reason: `No length-${wall.length} walls left.` };

  const newEdges = wallEdges(wall);
  const existing = buildBlockedSet(state.walls);
  for (const e of newEdges) {
    if (existing.has(e)) return { ok: false, reason: "Wall overlaps an existing wall." };
  }

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

// ----- Loot box helpers ----------------------------------------------------

export function hasTrapAt(state: GameState, pos: Coord): Trap | undefined {
  return state.traps.find((t) => eq(t.pos, pos));
}

export function pickRandomAbility(
  rng: () => number,
  exclude?: AbilityId | AbilityId[],
): AbilityId {
  const excludeSet = new Set<AbilityId>(
    Array.isArray(exclude) ? exclude : exclude ? [exclude] : [],
  );
  const pool = ALL_ABILITIES.filter((a) => !excludeSet.has(a));
  // Fall back to the full list if everything would be excluded.
  const final = pool.length > 0 ? pool : ALL_ABILITIES;
  const i = Math.floor(rng() * final.length);
  return final[Math.min(i, final.length - 1)];
}

/**
 * Pick a cell to spawn a new loot box on. Returns null if no valid cell.
 * Constraints:
 *  - empty cell (no pawn, no trap, no existing box, no goal row)
 *  - at least MIN_SPAWN_DIST from lastPickupPos (Manhattan)
 *
 * Falls back to ignoring the distance rule if no eligible cell satisfies it.
 */
export function pickSpawnCell(state: GameState, rng: () => number): Coord | null {
  const { size } = state;
  const occupied = new Set<string>();
  occupied.add(`${state.players.A.pos.r}:${state.players.A.pos.c}`);
  occupied.add(`${state.players.B.pos.r}:${state.players.B.pos.c}`);
  for (const t of state.traps) occupied.add(`${t.pos.r}:${t.pos.c}`);
  for (const b of state.lootBoxes) occupied.add(`${b.pos.r}:${b.pos.c}`);

  const goalRows = new Set([state.players.A.goalRow, state.players.B.goalRow]);

  const all: Coord[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (goalRows.has(r)) continue;
      if (occupied.has(`${r}:${c}`)) continue;
      all.push({ r, c });
    }
  }
  if (all.length === 0) return null;

  const far = state.lastPickupPos
    ? all.filter((p) => manhattan(p, state.lastPickupPos!) >= MIN_SPAWN_DIST)
    : all;

  const pool = far.length > 0 ? far : all;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}

function maybeSpawnLootBox(state: GameState, rng: () => number): GameState {
  if (state.status !== "playing") return state;
  if (!state.abilitiesEnabled) return state;
  if (state.lootBoxes.length >= MAX_BOXES) return state;
  if (state.pendingPickup) return state;
  // Replenishment only kicks in after FIRST_BOX_DELAY_TURNS turns of play.
  // Until then, the board has whatever was spawned at game start.
  if (state.turnCount < FIRST_BOX_DELAY_TURNS) return state;

  const pos = pickSpawnCell(state, rng);
  if (!pos) return state;
  // Avoid spawning an ability that *both* players already hold and no slot is
  // free for. Concretely: exclude abilities that are duplicates in both
  // inventories (very rare in practice — most exclusions come from the
  // pickup-time check).
  const heldByA = state.players.A.abilities.map((c) => c.id);
  const heldByB = state.players.B.abilities.map((c) => c.id);
  const blocked = ALL_ABILITIES.filter(
    (a) => heldByA.includes(a) && heldByB.includes(a),
  );
  // Also avoid ability already in another open box.
  const inBoxes = state.lootBoxes.map((b) => b.ability);
  const ability = pickRandomAbility(rng, [...blocked, ...inBoxes]);
  const lootBox: LootBox = { pos, ability, spawnedTurn: state.turnCount };
  return { ...state, lootBoxes: [...state.lootBoxes, lootBox] };
}

// ----- Apply action --------------------------------------------------------

function endTurn(state: GameState, rng: () => number): GameState {
  // Tick down all active traps; remove any that hit 0.
  const tickedTraps = state.traps
    .map((t) => ({ ...t, turnsLeft: t.turnsLeft - 1 }))
    .filter((t) => t.turnsLeft > 0);
  let next: GameState = {
    ...state,
    traps: tickedTraps,
    turn: other(state.turn),
    turnCount: state.turnCount + 1,
  };
  next = maybeSpawnLootBox(next, rng);
  return next;
}

export function applyAction(
  state: GameState,
  action: Action,
  rng: () => number = Math.random,
): ActionResult {
  if (state.status !== "playing") return { ok: false, reason: "Game is over." };

  // Pickup resolution must happen before any other action.
  if (state.pendingPickup) {
    if (action.type !== "resolvePickup") {
      return { ok: false, reason: "Resolve the pickup first." };
    }
    if (action.player !== state.pendingPickup.player) {
      return { ok: false, reason: "Not your pickup." };
    }
    return applyResolvePickup(state, action.choice, rng);
  }

  if (action.player !== state.turn) return { ok: false, reason: "Not your turn." };

  switch (action.type) {
    case "move":
      return applyMove(state, action.player, action.to, rng);
    case "placeWall":
      return applyPlaceWall(state, action.player, action.wall, rng);
    case "useAbility":
      return applyUseAbility(state, action.player, action.slot, action.target, rng);
    default:
      return { ok: false, reason: "Unknown action." };
  }
}

// ----- Move ----------------------------------------------------------------

function applyMove(
  state: GameState,
  player: PlayerId,
  to: Coord,
  rng: () => number,
): ActionResult {
  const me = state.players[player];
  const opp = state.players[other(player)];

  // Step-attempt onto trap: only triggers for the OPPONENT's trap.
  // Stepping on your own trap is a normal move (you walk past it freely).
  const trap = hasTrapAt(state, to);
  if (trap && trap.owner !== player) {
    // Must be adjacent (use neighbors check)
    const blocked = buildBlockedSet(state.walls);
    const adj = neighbors(state, me.pos, blocked).some((n) => eq(n, to));
    if (!adj) return { ok: false, reason: "Trap is not adjacent." };
    if (eq(to, opp.pos)) return { ok: false, reason: "Square is occupied." };

    // Opponent stomps the trap: decrement hitsLeft. Move is consumed but the
    // pawn stays put. Trap shatters when hits reach 0.
    const newHits = trap.hitsLeft - 1;
    const traps =
      newHits <= 0
        ? state.traps.filter((t) => !eq(t.pos, to))
        : state.traps.map((t) =>
            eq(t.pos, to) ? { ...t, hitsLeft: newHits } : t,
          );
    const next: GameState = { ...state, traps };
    return { ok: true, state: endTurn(next, rng) };
  }

  // Normal move
  const blocked = buildBlockedSet(state.walls);
  const ok = neighbors(state, me.pos, blocked).some((n) => eq(n, to));
  if (!ok) return { ok: false, reason: "Illegal move." };
  if (eq(to, opp.pos)) return { ok: false, reason: "Square is occupied." };

  return commitMove(state, player, to, rng);
}

/**
 * Commit a movement to a destination cell. Handles loot box pickup, win check,
 * pendingPickup case, and turn switching. Used by normal moves and movement
 * abilities.
 */
function commitMove(
  state: GameState,
  player: PlayerId,
  to: Coord,
  rng: () => number,
): ActionResult {
  const me = state.players[player];
  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...me, pos: to },
    },
  };

  // Loot box pickup
  const grabbedIdx = next.lootBoxes.findIndex((b) => eq(b.pos, to));
  if (grabbedIdx >= 0) {
    const grabbed = next.lootBoxes[grabbedIdx];
    const myAbilsBefore = next.players[player].abilities;
    const alreadyHave = myAbilsBefore.some((c) => c.id === grabbed.ability);
    // Always consume the box on pickup (the ability is silently lost if the
    // player already holds it). lastPickup* update so the next spawn respects
    // the distance / timing rules.
    next = {
      ...next,
      lootBoxes: next.lootBoxes.filter((_, i) => i !== grabbedIdx),
      lastPickupPos: { ...to },
      lastPickupTurn: next.turnCount,
    };
    if (!alreadyHave) {
      const myAbils = next.players[player].abilities;
      if (myAbils.length < ABILITY_CAP) {
        const newAbils: AbilityCharge[] = [
          ...myAbils,
          { id: grabbed.ability, acquiredTurn: next.turnCount },
        ];
        next = {
          ...next,
          players: {
            ...next.players,
            [player]: { ...next.players[player], abilities: newAbils },
          },
        };
      } else {
        // Full inventory — start a pendingPickup. Don't end turn yet.
        const pickup: PendingPickup = { player, ability: grabbed.ability };
        next = { ...next, pendingPickup: pickup };
        // Win check still applies even before resolving pickup
        if (to.r === me.goalRow) {
          next = { ...next, status: "finished", winner: player, pendingPickup: null };
        }
        return { ok: true, state: next };
      }
    }
  }

  // Win check
  if (to.r === me.goalRow) {
    next = { ...next, status: "finished", winner: player };
    return { ok: true, state: next };
  }

  return { ok: true, state: endTurn(next, rng) };
}

// ----- Place wall ----------------------------------------------------------

function applyPlaceWall(
  state: GameState,
  player: PlayerId,
  wallSpec: Pick<Wall, "orientation" | "r" | "c" | "length">,
  rng: () => number,
): ActionResult {
  // Apply Scramble effect: shorten by 1 if this player is the victim.
  let effective = wallSpec;
  let consumeScramble = false;
  if (state.scramblePending && state.scramblePending.victim === player) {
    const newLen = (wallSpec.length - 1) as WallLength;
    if (newLen <= 0) {
      return { ok: false, reason: "Scrambled length-1 wall would have no segments." };
    }
    effective = { ...wallSpec, length: newLen };
    consumeScramble = true;
  }

  // Inventory: deduct from the player's *original* requested length.
  const inv = state.players[player].walls;
  const have = wallSpec.length === 2 ? inv.len2 : inv.len3;
  if (have <= 0) {
    return { ok: false, reason: `No length-${wallSpec.length} walls left.` };
  }

  // Validate the *effective* wall placement. Length-1 has its own check
  // (skip validateWallPlacement's "length must be >= 2" rule).
  if (effective.length === 1) {
    if (!wallAnchorInBoundsAny(state.size, effective)) {
      return { ok: false, reason: "Wall is out of bounds." };
    }
    const newEdges = wallEdges(effective);
    const existing = buildBlockedSet(state.walls);
    for (const e of newEdges) {
      if (existing.has(e)) return { ok: false, reason: "Wall overlaps an existing wall." };
    }
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
  } else {
    const v = validateWallPlacement(state, player, effective);
    if (!v.ok) return { ok: false, reason: v.reason };
  }

  const me = state.players[player];
  const newInv = {
    len2: me.walls.len2 - (wallSpec.length === 2 ? 1 : 0),
    len3: me.walls.len3 - (wallSpec.length === 3 ? 1 : 0),
  };
  const newWall: Wall = { ...effective, owner: player };
  const next: GameState = {
    ...state,
    walls: [...state.walls, newWall],
    players: {
      ...state.players,
      [player]: { ...me, walls: newInv },
    },
    scramblePending: consumeScramble ? null : state.scramblePending,
  };
  return { ok: true, state: endTurn(next, rng) };
}

function wallAnchorInBoundsAny(
  size: number,
  w: Pick<Wall, "orientation" | "r" | "c" | "length">,
) {
  if (w.orientation === "h") {
    return w.r >= 0 && w.r < size - 1 && w.c >= 0 && w.c <= size - w.length;
  }
  return w.r >= 0 && w.r <= size - w.length && w.c >= 0 && w.c < size - 1;
}

// ----- Resolve pickup ------------------------------------------------------

function applyResolvePickup(
  state: GameState,
  choice: 0 | 1 | "discard",
  rng: () => number,
): ActionResult {
  if (!state.pendingPickup) return { ok: false, reason: "Nothing to resolve." };
  const { player, ability } = state.pendingPickup;
  const me = state.players[player];
  let newAbilities = me.abilities;
  if (choice === "discard") {
    // keep existing two
  } else {
    if (choice !== 0 && choice !== 1) {
      return { ok: false, reason: "Invalid slot." };
    }
    if (!newAbilities[choice]) {
      return { ok: false, reason: "Empty slot." };
    }
    // Don't allow replacing one of your existing abilities with a duplicate of
    // your *other* slot's ability.
    const otherSlot = choice === 0 ? 1 : 0;
    const otherAb = newAbilities[otherSlot];
    if (otherAb && otherAb.id === ability) {
      return { ok: false, reason: "You already hold that ability." };
    }
    newAbilities = newAbilities.map((a, i) =>
      i === choice ? { id: ability, acquiredTurn: state.turnCount } : a,
    );
  }
  const next: GameState = {
    ...state,
    pendingPickup: null,
    players: {
      ...state.players,
      [player]: { ...me, abilities: newAbilities },
    },
  };
  return { ok: true, state: endTurn(next, rng) };
}

// ----- Use ability ---------------------------------------------------------

function applyUseAbility(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: unknown,
  rng: () => number,
): ActionResult {
  const me = state.players[player];
  const charge = me.abilities[slot];
  if (!charge) return { ok: false, reason: "No ability in that slot." };

  switch (charge.id) {
    case "jumpWall":
      return useJumpWall(state, player, slot, target, rng);
    case "dash":
      return useDash(state, player, slot, target, rng);
    case "diagonalStep":
      return useDiagonalStep(state, player, slot, target, rng);
    case "breakWall":
      return useBreakWall(state, player, slot, target, rng);
    case "trapWall":
      return useTrapWall(state, player, slot, target, rng);
    case "scramble":
      return useScramble(state, player, slot, rng);
  }
}

function consumeAbility(state: GameState, player: PlayerId, slot: 0 | 1): GameState {
  const me = state.players[player];
  const newAbilities = me.abilities.filter((_, i) => i !== slot);
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { ...me, abilities: newAbilities },
    },
  };
}

// ---- ability: jumpWall ---

function useJumpWall(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: any,
  rng: () => number,
): ActionResult {
  if (!target || target.kind !== "cell") return { ok: false, reason: "Pick a target cell." };
  const to = target.pos as Coord;
  const me = state.players[player];
  const opp = state.players[other(player)];
  // Must be one orthogonal step away
  const dr = to.r - me.pos.r;
  const dc = to.c - me.pos.c;
  const isOrthoOne =
    (Math.abs(dr) === 1 && dc === 0) || (Math.abs(dc) === 1 && dr === 0);
  if (!isOrthoOne) return { ok: false, reason: "Jump must be 1 orthogonal step." };
  if (!inBounds(state.size, to)) return { ok: false, reason: "Out of bounds." };
  if (eq(to, opp.pos)) return { ok: false, reason: "Square is occupied." };
  const trap = hasTrapAt(state, to);
  if (trap && trap.owner !== player) {
    // Jumping onto opponent's trap counts as one stomp.
    const newHits = trap.hitsLeft - 1;
    const traps =
      newHits <= 0
        ? state.traps.filter((t) => !eq(t.pos, to))
        : state.traps.map((t) =>
            eq(t.pos, to) ? { ...t, hitsLeft: newHits } : t,
          );
    let next: GameState = { ...state, traps };
    next = consumeAbility(next, player, slot);
    return { ok: true, state: endTurn(next, rng) };
  }
  let next = consumeAbility(state, player, slot);
  // Now move pawn (loot box pickup possible). If the cell has the player's
  // OWN trap, treat it as a normal move (own trap doesn't break).
  return commitMove(next, player, to, rng);
}

// ---- ability: dash ---

function useDash(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: any,
  rng: () => number,
): ActionResult {
  if (!target || target.kind !== "twoCells") {
    return { ok: false, reason: "Pick two cells." };
  }
  const first = target.first as Coord;
  const second = target.second as Coord;
  const me = state.players[player];
  const opp = state.players[other(player)];
  const blocked = buildBlockedSet(state.walls);

  if (!neighbors(state, me.pos, blocked).some((n) => eq(n, first))) {
    return { ok: false, reason: "First step illegal." };
  }
  if (eq(first, opp.pos)) return { ok: false, reason: "Can't pass through opponent." };

  // Don't allow stepping onto a trap on the first step (can't continue from a trap).
  if (hasTrapAt(state, first)) {
    return { ok: false, reason: "Can't dash onto a trap." };
  }

  // Second step is computed from the first hypothetical position.
  const tempState: GameState = {
    ...state,
    players: {
      ...state.players,
      [player]: { ...me, pos: first },
    },
  };
  if (!neighbors(tempState, first, blocked).some((n) => eq(n, second))) {
    return { ok: false, reason: "Second step illegal." };
  }
  if (eq(second, me.pos)) return { ok: false, reason: "Dash must end on a new cell." };
  if (eq(second, opp.pos)) return { ok: false, reason: "Dash can't end on opponent." };

  let next = consumeAbility(state, player, slot);
  // First step (no pickup, no goal check — only the final cell counts)
  next = {
    ...next,
    players: {
      ...next.players,
      [player]: { ...next.players[player], pos: first },
    },
  };
  // Final step — handle pickup + goal as usual
  return commitMove(next, player, second, rng);
}

// ---- ability: diagonalStep ---

function useDiagonalStep(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: any,
  rng: () => number,
): ActionResult {
  if (!target || target.kind !== "cell") return { ok: false, reason: "Pick a target cell." };
  const to = target.pos as Coord;
  const me = state.players[player];
  const opp = state.players[other(player)];
  const dr = to.r - me.pos.r;
  const dc = to.c - me.pos.c;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) {
    return { ok: false, reason: "Diagonal step must be exactly 1 cell diagonally." };
  }
  if (!inBounds(state.size, to)) return { ok: false, reason: "Out of bounds." };
  if (eq(to, opp.pos)) return { ok: false, reason: "Square is occupied." };

  const blocked = buildBlockedSet(state.walls);
  const e1 = edgeBetween(me.pos, { r: to.r, c: me.pos.c });
  const e2 = edgeBetween(me.pos, { r: me.pos.r, c: to.c });
  const blocked1 = !!e1 && blocked.has(e1);
  const blocked2 = !!e2 && blocked.has(e2);
  if (blocked1 || blocked2) {
    return { ok: false, reason: "Diagonal can't pass through a wall." };
  }

  let next = consumeAbility(state, player, slot);
  return commitMove(next, player, to, rng);
}

// ---- ability: breakWall ---

function useBreakWall(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: any,
  rng: () => number,
): ActionResult {
  if (!target || target.kind !== "wallIndex") {
    return { ok: false, reason: "Pick a wall to break." };
  }
  const idx = target.index as number;
  if (idx < 0 || idx >= state.walls.length) {
    return { ok: false, reason: "Wall does not exist." };
  }
  const newWalls = state.walls.filter((_, i) => i !== idx);
  let next: GameState = { ...state, walls: newWalls };
  next = consumeAbility(next, player, slot);
  return { ok: true, state: endTurn(next, rng) };
}

// ---- ability: trapWall ---

function useTrapWall(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  target: any,
  rng: () => number,
): ActionResult {
  if (!target || target.kind !== "cell") return { ok: false, reason: "Pick a cell." };
  const pos = target.pos as Coord;
  if (!inBounds(state.size, pos)) return { ok: false, reason: "Out of bounds." };
  if (eq(pos, state.players.A.pos) || eq(pos, state.players.B.pos)) {
    return { ok: false, reason: "Cell is occupied by a pawn." };
  }
  if (hasTrapAt(state, pos)) return { ok: false, reason: "Already a trap there." };
  if (state.lootBoxes.some((b) => eq(b.pos, pos))) {
    return { ok: false, reason: "Cell has a loot box." };
  }
  const myTrap = state.traps.find((t) => t.owner === player);
  if (myTrap) return { ok: false, reason: "You already have an active trap." };

  const trap: Trap = {
    owner: player,
    pos: { ...pos },
    turnsLeft: TRAP_TURNS,
    hitsLeft: TRAP_HITS,
  };
  let next: GameState = { ...state, traps: [...state.traps, trap] };
  next = consumeAbility(next, player, slot);
  return { ok: true, state: endTurn(next, rng) };
}

// ---- ability: scramble ---

function useScramble(
  state: GameState,
  player: PlayerId,
  slot: 0 | 1,
  rng: () => number,
): ActionResult {
  let next: GameState = { ...state, scramblePending: { victim: other(player) } };
  next = consumeAbility(next, player, slot);
  return { ok: true, state: endTurn(next, rng) };
}

// ----- Helpers exposed to UI -----------------------------------------------

export function legalJumpWallTargets(state: GameState, p: PlayerId): Coord[] {
  const me = state.players[p];
  const opp = state.players[other(p)];
  const out: Coord[] = [];
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    const t = { r: me.pos.r + dr, c: me.pos.c + dc };
    if (!inBounds(state.size, t)) continue;
    if (eq(t, opp.pos)) continue;
    out.push(t);
  }
  return out;
}

export function legalDiagonalTargets(state: GameState, p: PlayerId): Coord[] {
  const me = state.players[p];
  const opp = state.players[other(p)];
  const blocked = buildBlockedSet(state.walls);
  const out: Coord[] = [];
  const dirs: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    const t = { r: me.pos.r + dr, c: me.pos.c + dc };
    if (!inBounds(state.size, t)) continue;
    if (eq(t, opp.pos)) continue;
    const e1 = edgeBetween(me.pos, { r: t.r, c: me.pos.c });
    const e2 = edgeBetween(me.pos, { r: me.pos.r, c: t.c });
    const b1 = !!e1 && blocked.has(e1);
    const b2 = !!e2 && blocked.has(e2);
    if (b1 || b2) continue;
    out.push(t);
  }
  return out;
}

/** Cells a Dash can step to as a *first* step. */
export function dashFirstTargets(state: GameState, p: PlayerId): Coord[] {
  const me = state.players[p];
  const opp = state.players[other(p)];
  const blocked = buildBlockedSet(state.walls);
  return neighbors(state, me.pos, blocked).filter(
    (n) => !eq(n, opp.pos) && !hasTrapAt(state, n),
  );
}

/** Given a chosen Dash first step, list legal second-step destinations. */
export function dashSecondTargets(
  state: GameState,
  p: PlayerId,
  first: Coord,
): Coord[] {
  const me = state.players[p];
  const opp = state.players[other(p)];
  const blocked = buildBlockedSet(state.walls);
  const tempState: GameState = {
    ...state,
    players: {
      ...state.players,
      [p]: { ...me, pos: first },
    },
  };
  return neighbors(tempState, first, blocked).filter(
    (n) => !eq(n, me.pos) && !eq(n, opp.pos),
  );
}

/** Trap-wall placement candidates: any cell with no pawn / trap / loot box. */
export function trapWallTargets(state: GameState): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      const pos = { r, c };
      if (eq(pos, state.players.A.pos) || eq(pos, state.players.B.pos)) continue;
      if (hasTrapAt(state, pos)) continue;
      if (state.lootBoxes.some((b) => eq(b.pos, pos))) continue;
      out.push(pos);
    }
  }
  return out;
}
