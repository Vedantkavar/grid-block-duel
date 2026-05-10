import { applyAction, createInitialState } from "./game/rules.js";
import {
  Action,
  GameConfig,
  GameState,
  PawnStyle,
  PlayerId,
} from "./game/types.js";
import { RoomSnapshot } from "./protocol.js";

type Room = {
  roomId: string;
  hostConfig: GameConfig;
  state: GameState;
  sockets: { A?: string; B?: string };
  joinerStaged?: { name: string; style: PawnStyle };
  createdAt: number;
};

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function genRoomId(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return s;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  create(args: {
    name: string;
    style: PawnStyle;
    config: GameConfig;
    socketId: string;
  }): { ok: true; room: Room } | { ok: false; reason: string } {
    // Build the GameConfig used for the actual game. A is the host.
    const config: GameConfig = {
      ...args.config,
      players: {
        A: { name: args.name || "Player 1", style: args.style },
        // B placeholder; overwritten on join
        B: { name: "Waiting…", style: "round" },
      },
    };

    let id = genRoomId();
    let attempts = 0;
    while (this.rooms.has(id) && attempts < 5) {
      id = genRoomId();
      attempts++;
    }
    if (this.rooms.has(id)) return { ok: false, reason: "Could not allocate room id." };

    const room: Room = {
      roomId: id,
      hostConfig: config,
      state: createInitialState(config),
      sockets: { A: args.socketId },
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return { ok: true, room };
  }

  join(args: {
    roomId: string;
    name: string;
    style: PawnStyle;
    socketId: string;
  }): { ok: true; room: Room } | { ok: false; reason: string } {
    const room = this.rooms.get(args.roomId.toUpperCase());
    if (!room) return { ok: false, reason: "Room not found." };
    if (room.sockets.B) return { ok: false, reason: "Room is full." };

    // Update player B's name + style and rebuild initial state
    const newConfig: GameConfig = {
      ...room.hostConfig,
      players: {
        A: room.hostConfig.players.A,
        B: { name: args.name || "Player 2", style: args.style },
      },
    };
    room.hostConfig = newConfig;
    room.state = createInitialState(newConfig);
    room.sockets.B = args.socketId;
    return { ok: true, room };
  }

  applyAction(
    roomId: string,
    player: PlayerId,
    action: Action,
  ): { ok: true; room: Room } | { ok: false; reason: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: "Room not found." };
    if (action.player !== player) return { ok: false, reason: "Spoofed action." };
    if (!room.sockets.A || !room.sockets.B) {
      return { ok: false, reason: "Waiting for both players." };
    }
    const result = applyAction(room.state, action);
    if (!result.ok) return { ok: false, reason: result.reason };
    room.state = result.state;
    return { ok: true, room };
  }

  rematch(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.state = createInitialState(room.hostConfig);
    return room;
  }

  /**
   * Remove a socket from any room it's in. Returns the affected roomId, the
   * player slot, and whether the room is now empty (and removed).
   */
  removeSocket(socketId: string): {
    roomId: string;
    player: PlayerId;
    room: Room | null;
  } | null {
    for (const room of this.rooms.values()) {
      if (room.sockets.A === socketId) {
        delete room.sockets.A;
        const empty = !room.sockets.B;
        if (empty) this.rooms.delete(room.roomId);
        return { roomId: room.roomId, player: "A", room: empty ? null : room };
      }
      if (room.sockets.B === socketId) {
        delete room.sockets.B;
        const empty = !room.sockets.A;
        if (empty) this.rooms.delete(room.roomId);
        return { roomId: room.roomId, player: "B", room: empty ? null : room };
      }
    }
    return null;
  }

  snapshot(room: Room): RoomSnapshot {
    return {
      roomId: room.roomId,
      state: room.state,
      presence: { A: !!room.sockets.A, B: !!room.sockets.B },
      hostConfig: room.hostConfig,
    };
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
}
