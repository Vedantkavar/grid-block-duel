// 4-player "Killer" mode — pure types. No React, no DOM.
// Lives separately from the duel/ module so neither game touches the other.

import type { PawnStyle } from "../types.js";

export type KillerPlayerId = "A" | "B" | "C" | "D";

export const KILLER_IDS: KillerPlayerId[] = ["A", "B", "C", "D"];

export type Coord = { r: number; c: number };
export type Role = "runner" | "killer";

export type KillerPlayerState = {
  id: KillerPlayerId;
  name: string;
  style: PawnStyle;
  color: KillerColor;
  role: Role;
  pos: Coord;
  /** Half-hearts. Runners start at 2 (= 1 full heart). Killer ignores hp. */
  hp: number;
  hpMax: number;
  alive: boolean;
  /** Wall items remaining (Runners only). Killer always 0/0/0. */
  walls: RunnerWallInventory;
  /**
   * Killer's Supercharge state. For Runners both fields are 0/false.
   * `superchargeReady`: true if the Killer can use it this Move.
   * `superchargeProgress`: 0..SUPERCHARGE_COOLDOWN; ticks up at the end of
   * each Killer Move while the ability is on cooldown.
   */
  superchargeReady: boolean;
  superchargeProgress: number;
};

// ----- Walls --------------------------------------------------------------

export type WallEdge = {
  orientation: "h" | "v";
  r: number;
  c: number;
};

export type WallShape = "frame2" | "frame3" | "cage";

export type PlacedWall = {
  shape: WallShape;
  owner: KillerPlayerId;
  edges: WallEdge[];
  /** Round on which this wall disappears. Undefined = permanent. */
  expiresOnRound?: number;
};

export type RunnerWallInventory = {
  frame2: number;
  frame3: number;
  cage: number;
};

export const STARTING_WALLS: RunnerWallInventory = {
  frame2: 1,
  frame3: 1,
  cage: 1,
};

export const NO_WALLS: RunnerWallInventory = { frame2: 0, frame3: 0, cage: 0 };

export type KillerGameState = {
  size: number;
  players: KillerPlayerState[]; // exactly 4 entries
  turnIdx: number; // index into players for whose Move it is
  moveCount: number; // total Moves taken across all players
  moveCap: number; // game ends in Runners' favor when moveCount reaches this
  zonesEnabled: boolean; // if false, zones never auto-spawn
  roundCount: number; // increments after every 4 Moves
  status: "playing" | "finished";
  winner?: "runners" | "killer";
  /** All currently placed walls. */
  walls: PlacedWall[];
  /** Currently active zones (auto-spawned every ZONE_SPAWN_INTERVAL Moves). */
  zones: PlacedZone[];
  /** Most recent strike, for animation/log. */
  lastStrike?: { killer: KillerPlayerId; victims: KillerPlayerId[] } | null;
};

// ----- Zones --------------------------------------------------------------

export type ZoneKind = "fast" | "slow" | "killer" | "snipe" | "heal";

export type PlacedZone = {
  kind: ZoneKind;
  /** Top-left cell of the footprint. */
  anchor: Coord;
  /** Square footprint side length. */
  size: number;
  /** Round on which this zone disappears. */
  expiresOnRound: number;
  /** moveCount value when this zone was spawned (used to hide label after 1 Move). */
  spawnedOnMove: number;
};

export const ZONE_KINDS: ZoneKind[] = ["fast", "slow", "killer", "snipe", "heal"];

export const ZONE_SIZE: Record<ZoneKind, number> = {
  fast: 5,
  slow: 5,
  killer: 4,
  snipe: 3,
  heal: 4,
};

export const ZONE_DURATION_ROUNDS: Record<ZoneKind, number> = {
  fast: 3,
  slow: 3,
  killer: 2,
  snipe: 2,
  heal: 3,
};

export const ZONE_INFO: Record<ZoneKind, { name: string; desc: string }> = {
  fast: {
    name: "Fast Zone",
    desc: "A Runner inside can step 2 cells on their Move (instead of 1).",
  },
  slow: {
    name: "Slow Zone",
    desc: "The Killer's step count drops by 1 for each Slow Zone they're standing in.",
  },
  killer: {
    name: "Killer Zone",
    desc: "While the Killer stands inside, their strike ignores walls (still capped by kill range).",
  },
  snipe: {
    name: "Snipe Zone",
    desc: "While the Killer stands inside, they may click any Runner anywhere to deal ½ heart (consumes the Move).",
  },
  heal: {
    name: "Heal Zone",
    desc: "Each Runner inside heals ½ heart at the end of every round.",
  },
};

export const ZONE_SPAWN_INTERVAL = 5; // spawn a zone every N Moves

export type KillerStepAction = {
  type: "step";
  player: KillerPlayerId;
  /**
   * One cell at a time for Runners, up to KILLER_STEP for Killer. The path
   * is implied by sequential cells from current pos to destination, so we
   * model multi-step moves as a single "step" with an explicit path.
   */
  path: Coord[]; // cells visited in order (excluding current)
};

export type KillerSkipAction = {
  type: "skip";
  player: KillerPlayerId;
};

export type KillerPlaceWallAction = {
  type: "placeWall";
  player: KillerPlayerId;
  shape: WallShape;
  /**
   * Anchor coord interpretation:
   *   frame2 / frame3: the cell in the top-left corner of the wall.
   *                    With orientation "h", the wall sits BELOW that
   *                    cell, extending right (length 2 or 3).
   *                    With orientation "v", the wall sits to the RIGHT
   *                    of that cell, extending down.
   *   cage:            the cell to wrap (must be the Killer's cell).
   */
  anchor: Coord;
  /** Required for frame2 / frame3. Ignored for cage. */
  orientation?: "h" | "v";
};

/**
 * Killer's Supercharge: break a single wall edge. Identifies the target by
 * (wallIndex, edgeIndex) inside that wall. The Killer can use this once it's
 * recharged. Free action: doesn't end the Move (the Killer can still step).
 */
export type KillerSuperchargeAction = {
  type: "supercharge";
  player: KillerPlayerId;
  wallIndex: number;
  edgeIndex: number;
};

/**
 * Killer strikes a specific Runner. Costs the Killer their entire Move.
 * The target must be alive and within the Killer's kill radius right now.
 */
export type KillerStrikeAction = {
  type: "strike";
  player: KillerPlayerId;
  target: KillerPlayerId;
};

/**
 * Killer snipes a specific Runner from anywhere on the board. Requires the
 * Killer to be inside a Snipe Zone. Costs the entire Move. Ignores walls.
 */
export type KillerSnipeAction = {
  type: "snipe";
  player: KillerPlayerId;
  target: KillerPlayerId;
};

export type KillerAction =
  | KillerStepAction
  | KillerSkipAction
  | KillerPlaceWallAction
  | KillerSuperchargeAction
  | KillerStrikeAction
  | KillerSnipeAction;

export type KillerActionResult =
  | { ok: true; state: KillerGameState }
  | { ok: false; reason: string };

// ----- Setup config -------------------------------------------------------

export type KillerPlayerConfig = {
  name: string;
  style: PawnStyle;
  color: KillerColor;
};

export type KillerColor =
  | "blue"
  | "pink"
  | "teal"
  | "gold"
  | "purple"
  | "orange";

export const KILLER_COLORS: KillerColor[] = [
  "blue",
  "pink",
  "teal",
  "gold",
  "purple",
  "orange",
];

export const KILLER_COLOR_HEX: Record<KillerColor, string> = {
  blue: "#4ea3ff",
  pink: "#ff6b9a",
  teal: "#7be0c2",
  gold: "#ffd166",
  purple: "#c4b5fd",
  orange: "#ff9f43",
};

/** Default color for a slot when none is chosen. */
export const DEFAULT_COLOR_BY_SLOT: Record<KillerPlayerId, KillerColor> = {
  A: "blue",
  B: "pink",
  C: "teal",
  D: "gold",
};

export type KillerGameConfig = {
  size: number;
  players: KillerPlayerConfig[]; // 4 entries, in board slot order A B C D
  moveCap: number;
  zonesEnabled: boolean;
};

export const KILLER_SIZE_OPTIONS = [9, 11, 13] as const;
export const KILLER_MOVE_CAP_OPTIONS = [
  40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;

// ----- Constants ----------------------------------------------------------

export const KILLER_STEP = 2;        // cells per Killer Move (small grid default)
export const RUNNER_STEP = 1;        // cells per Runner Move
export const KILL_RANGE = 3;         // strike reaches this many cells (small grid default)

/**
 * Killer step / kill-range scale with grid size:
 *   9×9  → step 2, range 3
 *   11×11, 13×13 → step 3, range 4
 */
export function killerStepFor(size: number): number {
  return size >= 11 ? 3 : 2;
}

export function killRangeFor(size: number): number {
  return size >= 11 ? 4 : 3;
}
export const STRIKE_DAMAGE = 1;      // half-hearts
export const RUNNER_MAX_HP = 2;      // 2 half-hearts = 1 full heart
export const MOVE_CAP = 60;          // total Moves before Runners win by timeout
export const CAGE_DURATION_ROUNDS = 2; // O-cage lasts this many rounds
export const SUPERCHARGE_COOLDOWN = 3; // Killer turns between Supercharge uses

export const DEFAULT_KILLER_CONFIG: KillerGameConfig = {
  size: 11,
  players: [
    { name: "Player 1", style: "ghost", color: "blue" },
    { name: "Player 2", style: "round", color: "pink" },
    { name: "Player 3", style: "square", color: "teal" },
    { name: "Player 4", style: "diamond", color: "gold" },
  ],
  moveCap: 60,
  zonesEnabled: true,
};
