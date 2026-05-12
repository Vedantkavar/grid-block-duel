// Pure game types. Shared with the server (kept in sync).

export type PlayerId = "A" | "B";
export type Coord = { r: number; c: number };

export type WallOrientation = "h" | "v";
export type WallLength = 1 | 2 | 3; // length-1 walls only emerge from Scramble.

export type Wall = {
  orientation: WallOrientation;
  r: number;
  c: number;
  length: WallLength;
  owner: PlayerId;
};

export type WallInventory = { len2: number; len3: number };

export type PawnStyle = "ghost" | "round" | "square" | "diamond";

export const PAWN_STYLES: PawnStyle[] = ["ghost", "round", "square", "diamond"];

// ----- Abilities -----------------------------------------------------------

export type AbilityId =
  | "jumpWall"
  | "dash"
  | "diagonalStep"
  | "breakWall"
  | "trapWall"
  | "scramble";

export const ALL_ABILITIES: AbilityId[] = [
  "jumpWall",
  "dash",
  "diagonalStep",
  "breakWall",
  "trapWall",
  "scramble",
];

export const ABILITY_INFO: Record<AbilityId, { name: string; desc: string; category: "move" | "wall" | "effect" }> = {
  jumpWall: {
    name: "Jump Wall",
    desc: "Move 1 cell in any direction, ignoring walls.",
    category: "move",
  },
  dash: {
    name: "Dash",
    desc: "Take 2 orthogonal steps in one turn (walls still block).",
    category: "move",
  },
  diagonalStep: {
    name: "Diagonal Step",
    desc: "Move 1 cell diagonally. Blocked if either adjacent edge has a wall.",
    category: "move",
  },
  breakWall: {
    name: "Break Wall",
    desc: "Remove any one placed wall from the board.",
    category: "wall",
  },
  trapWall: { name: "Trap Wall", desc: "Place a 1×1 trap. Lasts 5 turns. Opponent must stomp it twice to break it.", category: "wall" },
  scramble: {
    name: "Scramble",
    desc: "Opponent's next placed wall is shortened by 1.",
    category: "effect",
  },
};

export type AbilityCharge = {
  id: AbilityId;
  acquiredTurn: number;
};

export const ABILITY_CAP = 2;

export type LootBox = {
  pos: Coord;
  ability: AbilityId;
  spawnedTurn: number;
};

export type Trap = {
  owner: PlayerId;
  pos: Coord;
  turnsLeft: number; // counts down each end-of-turn; 0 = removed
  hitsLeft: number; // decremented when opponent stomps; 0 = removed
};

export const TRAP_TURNS = 5;
export const TRAP_HITS = 2;

export type ScrambleEffect = {
  victim: PlayerId; // the player whose next wall will be shortened
};

export type PendingPickup = {
  player: PlayerId;
  ability: AbilityId;
};

// ----- Player + game state -------------------------------------------------

export type PlayerState = {
  pos: Coord;
  walls: WallInventory;
  goalRow: number;
  name: string;
  style: PawnStyle;
  abilities: AbilityCharge[];
};

export type GameState = {
  size: number;
  players: Record<PlayerId, PlayerState>;
  walls: Wall[];
  turn: PlayerId;
  status: "playing" | "finished";
  winner?: PlayerId;
  // Ability system
  abilitiesEnabled: boolean;
  turnCount: number;
  lootBoxes: LootBox[];
  lastPickupPos: Coord | null;
  lastPickupTurn: number | null;
  traps: Trap[];
  scramblePending: ScrambleEffect | null;
  pendingPickup: PendingPickup | null;
};

// ----- Actions -------------------------------------------------------------

export type MoveAction = { type: "move"; player: PlayerId; to: Coord };

export type PlaceWallAction = {
  type: "placeWall";
  player: PlayerId;
  wall: Omit<Wall, "owner">;
};

export type AbilityTarget =
  | { kind: "cell"; pos: Coord }
  | { kind: "twoCells"; first: Coord; second: Coord }
  | { kind: "wallIndex"; index: number }
  | { kind: "slotIndex"; index: 0 | 1 };

export type UseAbilityAction = {
  type: "useAbility";
  player: PlayerId;
  slot: 0 | 1;
  target?: AbilityTarget;
};

export type ResolvePickupAction = {
  type: "resolvePickup";
  player: PlayerId;
  choice: 0 | 1 | "discard";
};

export type Action =
  | MoveAction
  | PlaceWallAction
  | UseAbilityAction
  | ResolvePickupAction;

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

// ----- Setup ---------------------------------------------------------------

export type GameConfig = {
  size: number;
  walls: WallInventory;
  abilitiesEnabled: boolean;
  players: {
    A: { name: string; style: PawnStyle };
    B: { name: string; style: PawnStyle };
  };
};

export const DEFAULT_CONFIG: GameConfig = {
  size: 9,
  walls: { len2: 4, len3: 2 },
  abilitiesEnabled: true,
  players: {
    A: { name: "Blue", style: "ghost" },
    B: { name: "Pink", style: "round" },
  },
};

export const SIZE_OPTIONS = [7, 9, 11] as const;
export const WALL2_OPTIONS = [2, 4, 6] as const;
export const WALL3_OPTIONS = [0, 1, 2, 3] as const;

// ----- Spawn tuning --------------------------------------------------------

export const FIRST_BOX_DELAY_TURNS = 3;
export const MIN_SPAWN_DIST = 3; // Manhattan
export const MAX_BOXES = 2;
