import { applyKillerAction, createKillerInitialState } from "./game/killer/rules.js";
import {
  KillerAction,
  KillerColor,
  KillerGameConfig,
  KillerGameState,
  KillerPlayerId,
  KILLER_IDS,
  DEFAULT_COLOR_BY_SLOT,
} from "./game/killer/types.js";
import type { PawnStyle } from "./game/types.js";
import {
  KillerRoomSnapshot,
  KillerSlotPresence,
} from "./protocol.js";

type SlotInfo = {
  id: KillerPlayerId;
  name: string;
  style: PawnStyle;
  color: KillerColor;
  socketId?: string;
};

type KillerRoom = {
  roomId: string;
  hostConfig: KillerGameConfig;
  /** null while still in lobby. */
  state: KillerGameState | null;
  /** Lobby slot order: A is host, B/C/D fill in join order. */
  slots: SlotInfo[];
  createdAt: number;
};
export type { KillerRoom };

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function genRoomId(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return s;
}

const PLACEHOLDER_STYLES: PawnStyle[] = ["ghost", "round", "square", "diamond"];

export class KillerRoomManager {
  private rooms = new Map<string, KillerRoom>();

  create(args: {
    name: string;
    style: PawnStyle;
    color: KillerColor;
    config: KillerGameConfig;
    socketId: string;
  }): { ok: true; room: KillerRoom } | { ok: false; reason: string } {
    const slots: SlotInfo[] = KILLER_IDS.map((id, i) => ({
      id,
      name: i === 0 ? args.name || "Player 1" : `Player ${i + 1}`,
      style: i === 0 ? args.style : PLACEHOLDER_STYLES[i],
      color: i === 0 ? args.color : DEFAULT_COLOR_BY_SLOT[id],
      socketId: i === 0 ? args.socketId : undefined,
    }));

    let id = genRoomId();
    let attempts = 0;
    while (this.rooms.has(id) && attempts < 5) {
      id = genRoomId();
      attempts++;
    }
    if (this.rooms.has(id)) {
      return { ok: false, reason: "Could not allocate room id." };
    }

    const room: KillerRoom = {
      roomId: id,
      hostConfig: args.config,
      state: null,
      slots,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return { ok: true, room };
  }

  join(args: {
    roomId: string;
    name: string;
    style: PawnStyle;
    color: KillerColor;
    socketId: string;
  }): { ok: true; room: KillerRoom; slot: KillerPlayerId } | { ok: false; reason: string } {
    const room = this.rooms.get(args.roomId.toUpperCase());
    if (!room) return { ok: false, reason: "Room not found." };
    if (room.state) return { ok: false, reason: "Game already started." };

    const free = room.slots.find((s) => !s.socketId);
    if (!free) return { ok: false, reason: "Room is full." };

    free.name = args.name || `Player ${room.slots.indexOf(free) + 1}`;
    free.style = args.style;
    free.color = args.color;
    free.socketId = args.socketId;

    return { ok: true, room, slot: free.id };
  }

  start(roomId: string, socketId: string): { ok: true; room: KillerRoom } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: "Room not found." };
    if (room.state) return { ok: false, reason: "Game already started." };
    if (room.slots[0].socketId !== socketId) {
      return { ok: false, reason: "Only the host can start the game." };
    }
    if (room.slots.some((s) => !s.socketId)) {
      return { ok: false, reason: "Need 4 players to start." };
    }
    const config: KillerGameConfig = {
      ...room.hostConfig,
      players: room.slots.map((s) => ({ name: s.name, style: s.style, color: s.color })),
    };
    room.state = createKillerInitialState(config);
    return { ok: true, room };
  }

  applyAction(
    roomId: string,
    slot: KillerPlayerId,
    action: KillerAction,
  ): { ok: true; room: KillerRoom } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: "Room not found." };
    if (!room.state) return { ok: false, reason: "Game has not started." };
    if (action.player !== slot) return { ok: false, reason: "Spoofed action." };
    const result = applyKillerAction(room.state, action);
    if (!result.ok) return { ok: false, reason: result.reason };
    room.state = result.state;
    return { ok: true, room };
  }

  rematch(roomId: string, socketId: string): KillerRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.slots[0].socketId !== socketId) return null;
    const config: KillerGameConfig = {
      ...room.hostConfig,
      players: room.slots.map((s) => ({ name: s.name, style: s.style, color: s.color })),
    };
    room.state = createKillerInitialState(config);
    return room;
  }

  /**
   * Remove a socket. If they were in a killer room, return the room + which
   * slot they vacated. If the room becomes empty, delete it.
   */
  removeSocket(socketId: string): {
    roomId: string;
    slot: KillerPlayerId;
    room: KillerRoom | null;
  } | null {
    for (const room of this.rooms.values()) {
      const slot = room.slots.find((s) => s.socketId === socketId);
      if (!slot) continue;
      slot.socketId = undefined;
      // Whether the room becomes empty.
      const empty = room.slots.every((s) => !s.socketId);
      if (empty) this.rooms.delete(room.roomId);
      return { roomId: room.roomId, slot: slot.id, room: empty ? null : room };
    }
    return null;
  }

  snapshot(room: KillerRoom, you: KillerPlayerId): KillerRoomSnapshot {
    const slots: KillerSlotPresence[] = room.slots.map((s) => ({
      id: s.id,
      name: s.name,
      style: s.style,
      color: s.color,
      present: !!s.socketId,
    }));
    return {
      roomId: room.roomId,
      slots,
      state: room.state,
      hostConfig: room.hostConfig,
      you,
    };
  }

  get(roomId: string): KillerRoom | undefined {
    return this.rooms.get(roomId);
  }
}
