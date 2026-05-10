// Pure game types. No React, no DOM — these are shared with the future server.

export type PlayerId = "A" | "B";
export type Coord = { r: number; c: number };

export type WallOrientation = "h" | "v"; // h = horizontal (blocks N/S), v = vertical (blocks E/W)
export type WallLength = 2 | 3;

export type Wall = {
  orientation: WallOrientation;
  r: number; // anchor row
  c: number; // anchor col
  length: WallLength;
  owner: PlayerId;
};

export type WallInventory = { len2: number; len3: number };

export type PawnStyle = "ghost" | "round" | "square" | "diamond";

export const PAWN_STYLES: PawnStyle[] = ["ghost", "round", "square", "diamond"];

export type PlayerState = {
  pos: Coord;
  walls: WallInventory;
  goalRow: number; // row the player needs to reach
  name: string;
  style: PawnStyle;
};

export type GameState = {
  size: number;
  players: Record<PlayerId, PlayerState>;
  walls: Wall[];
  turn: PlayerId;
  status: "playing" | "finished";
  winner?: PlayerId;
};

export type MoveAction = { type: "move"; player: PlayerId; to: Coord };
export type PlaceWallAction = {
  type: "placeWall";
  player: PlayerId;
  wall: Omit<Wall, "owner">;
};
export type Action = MoveAction | PlaceWallAction;

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

// Setup-time config used to build the initial GameState.
export type GameConfig = {
  size: number; // odd numbers play best (centered start)
  walls: WallInventory; // walls per player
  players: {
    A: { name: string; style: PawnStyle };
    B: { name: string; style: PawnStyle };
  };
};

export const DEFAULT_CONFIG: GameConfig = {
  size: 9,
  walls: { len2: 4, len3: 2 },
  players: {
    A: { name: "Blue", style: "ghost" },
    B: { name: "Pink", style: "round" },
  },
};

export const SIZE_OPTIONS = [7, 9, 11] as const;
export const WALL2_OPTIONS = [2, 4, 6] as const;
export const WALL3_OPTIONS = [0, 1, 2, 3] as const;
