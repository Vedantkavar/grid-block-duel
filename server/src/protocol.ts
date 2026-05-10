// NOTE: This file is duplicated between client/src/net/protocol.ts and
// server/src/protocol.ts. Keep them in sync.

import type { Action, GameConfig, GameState, PawnStyle, PlayerId } from "./game/types.js";

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
  config: GameConfig; // host's chosen size + walls; their own player slot used for A
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
}

export interface ServerToClientEvents {
  roomState: (snapshot: RoomSnapshot) => void;
  roomClosed: (reason: string) => void;
  serverError: (message: string) => void;
}

export type SocketData = {
  roomId?: string;
  player?: PlayerId;
};
