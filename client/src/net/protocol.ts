// NOTE: This file is duplicated between client/src/net/protocol.ts and
// server/src/protocol.ts. Keep them in sync.

import type { Action, GameConfig, GameState, PawnStyle, PlayerId } from "../game/types";
import type {
  KillerAction,
  KillerColor,
  KillerGameConfig,
  KillerGameState,
  KillerPlayerId,
} from "../game/killer/types";

export type RoomSnapshot = {
  roomId: string;
  state: GameState;
  presence: { A: boolean; B: boolean };
  hostConfig: GameConfig;
};

export type Ack<T> = (response: T) => void;

export type CreateRoomReq = {
  name: string;
  style: PawnStyle;
  config: GameConfig;
};

export type CreateRoomRes =
  | { ok: true; roomId: string; you: "A"; snapshot: RoomSnapshot }
  | { ok: false; reason: string };

export type JoinRoomReq = {
  roomId: string;
  name: string;
  style: PawnStyle;
};

export type JoinRoomRes =
  | { ok: true; you: "B"; snapshot: RoomSnapshot }
  | { ok: false; reason: string };

export type ActionRes = { ok: true } | { ok: false; reason: string };

export interface ClientToServerEvents {
  createRoom: (req: CreateRoomReq, ack: Ack<CreateRoomRes>) => void;
  joinRoom: (req: JoinRoomReq, ack: Ack<JoinRoomRes>) => void;
  action: (action: Action, ack: Ack<ActionRes>) => void;
  rematch: () => void;
  leaveRoom: () => void;

  // Killer mode (4-player)
  "killer:createRoom": (
    req: KillerCreateRoomReq,
    ack: Ack<KillerCreateRoomRes>,
  ) => void;
  "killer:joinRoom": (
    req: KillerJoinRoomReq,
    ack: Ack<KillerJoinRoomRes>,
  ) => void;
  "killer:start": (ack: Ack<ActionRes>) => void;
  "killer:action": (action: KillerAction, ack: Ack<ActionRes>) => void;
  "killer:rematch": () => void;
  "killer:leaveRoom": () => void;
}

export interface ServerToClientEvents {
  roomState: (snapshot: RoomSnapshot) => void;
  roomClosed: (reason: string) => void;
  serverError: (message: string) => void;

  // Killer mode
  "killer:roomState": (snapshot: KillerRoomSnapshot) => void;
  "killer:roomClosed": (reason: string) => void;
}

// ----- Killer-mode payloads ----------------------------------------------

export type KillerSlotPresence = {
  id: KillerPlayerId;
  name: string;
  style: PawnStyle;
  color: KillerColor;
  present: boolean;
};

export type KillerRoomSnapshot = {
  roomId: string;
  slots: KillerSlotPresence[];
  state: KillerGameState | null;
  hostConfig: KillerGameConfig;
  you: KillerPlayerId;
};

export type KillerCreateRoomReq = {
  name: string;
  style: PawnStyle;
  color: KillerColor;
  config: KillerGameConfig;
};

export type KillerCreateRoomRes =
  | { ok: true; roomId: string; you: "A"; snapshot: KillerRoomSnapshot }
  | { ok: false; reason: string };

export type KillerJoinRoomReq = {
  roomId: string;
  name: string;
  style: PawnStyle;
  color: KillerColor;
};

export type KillerJoinRoomRes =
  | { ok: true; you: KillerPlayerId; snapshot: KillerRoomSnapshot }
  | { ok: false; reason: string };

export type { PlayerId };
