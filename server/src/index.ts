import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";
import { KillerRoomManager, type KillerRoom } from "./killerRooms.js";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./protocol.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Allowed origins — comma-separated list in CORS_ORIGINS, plus localhost dev.
// Use "*" to allow any origin (handy while testing, not recommended for prod).
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length
  ? envOrigins
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

const allowAll = envOrigins.includes("*");

const corsOrigin = allowAll ? "*" : allowedOrigins;

const app = express();
app.use(cors({ origin: corsOrigin }));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>(
  httpServer,
  {
    cors: { origin: corsOrigin, methods: ["GET", "POST"] },
  },
);

const rooms = new RoomManager();
const killerRooms = new KillerRoomManager();

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on("createRoom", (req, ack) => {
    const result = rooms.create({
      name: req.name,
      style: req.style,
      config: req.config,
      socketId: socket.id,
    });
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    socket.data.roomId = result.room.roomId;
    socket.data.player = "A";
    socket.join(result.room.roomId);
    const snapshot = rooms.snapshot(result.room);
    ack({ ok: true, roomId: result.room.roomId, you: "A", snapshot });
    io.to(result.room.roomId).emit("roomState", snapshot);
    console.log(`[room] ${result.room.roomId} created by ${socket.id}`);
  });

  socket.on("joinRoom", (req, ack) => {
    const result = rooms.join({
      roomId: req.roomId,
      name: req.name,
      style: req.style,
      socketId: socket.id,
    });
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    socket.data.roomId = result.room.roomId;
    socket.data.player = "B";
    socket.join(result.room.roomId);
    const snapshot = rooms.snapshot(result.room);
    ack({ ok: true, you: "B", snapshot });
    io.to(result.room.roomId).emit("roomState", snapshot);
    console.log(`[room] ${result.room.roomId} joined by ${socket.id}`);
  });

  socket.on("action", (action, ack) => {
    const { roomId, player } = socket.data;
    if (!roomId || !player) {
      ack({ ok: false, reason: "Not in a room." });
      return;
    }
    const result = rooms.applyAction(roomId, player, action);
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    ack({ ok: true });
    io.to(roomId).emit("roomState", rooms.snapshot(result.room));
  });

  socket.on("rematch", () => {
    const { roomId } = socket.data;
    if (!roomId) return;
    const room = rooms.rematch(roomId);
    if (room) io.to(roomId).emit("roomState", rooms.snapshot(room));
  });

  socket.on("leaveRoom", () => {
    handleLeave(socket.id);
  });

  // ===== Killer mode (4 player) =====

  function broadcastKillerRoom(room: KillerRoom) {
    for (const s of room.slots) {
      if (!s.socketId) continue;
      io.to(s.socketId).emit("killer:roomState", killerRooms.snapshot(room, s.id));
    }
  }

  socket.on("killer:createRoom", (req, ack) => {
    const result = killerRooms.create({
      name: req.name,
      style: req.style,
      color: req.color,
      config: req.config,
      socketId: socket.id,
    });
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    socket.data.killerRoomId = result.room.roomId;
    socket.data.killerSlot = "A";
    socket.join(`killer:${result.room.roomId}`);
    ack({
      ok: true,
      roomId: result.room.roomId,
      you: "A",
      snapshot: killerRooms.snapshot(result.room, "A"),
    });
    broadcastKillerRoom(result.room);
    console.log(`[killer] ${result.room.roomId} created by ${socket.id}`);
  });

  socket.on("killer:joinRoom", (req, ack) => {
    const result = killerRooms.join({
      roomId: req.roomId,
      name: req.name,
      style: req.style,
      color: req.color,
      socketId: socket.id,
    });
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    socket.data.killerRoomId = result.room.roomId;
    socket.data.killerSlot = result.slot;
    socket.join(`killer:${result.room.roomId}`);
    ack({
      ok: true,
      you: result.slot,
      snapshot: killerRooms.snapshot(result.room, result.slot),
    });
    broadcastKillerRoom(result.room);
    console.log(`[killer] ${result.room.roomId} joined by ${socket.id} as ${result.slot}`);
  });

  socket.on("killer:start", (ack) => {
    const { killerRoomId } = socket.data;
    if (!killerRoomId) {
      ack({ ok: false, reason: "Not in a killer room." });
      return;
    }
    const result = killerRooms.start(killerRoomId, socket.id);
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    ack({ ok: true });
    broadcastKillerRoom(result.room);
  });

  socket.on("killer:action", (action, ack) => {
    const { killerRoomId, killerSlot } = socket.data;
    if (!killerRoomId || !killerSlot) {
      ack({ ok: false, reason: "Not in a killer room." });
      return;
    }
    const result = killerRooms.applyAction(killerRoomId, killerSlot, action);
    if (!result.ok) {
      ack({ ok: false, reason: result.reason });
      return;
    }
    ack({ ok: true });
    broadcastKillerRoom(result.room);
  });

  socket.on("killer:rematch", () => {
    const { killerRoomId } = socket.data;
    if (!killerRoomId) return;
    const room = killerRooms.rematch(killerRoomId, socket.id);
    if (room) broadcastKillerRoom(room);
  });

  socket.on("killer:leaveRoom", () => {
    handleKillerLeave(socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    handleLeave(socket.id);
    handleKillerLeave(socket.id);
  });

  function handleLeave(socketId: string) {
    const removed = rooms.removeSocket(socketId);
    if (!removed) return;
    // Remove the leaving socket from the room channel so it doesn't
    // receive its own "X disconnected" broadcast.
    socket.leave(removed.roomId);
    socket.data.roomId = undefined;
    socket.data.player = undefined;
    if (!removed.room) {
      // Room emptied & removed
      return;
    }
    // Notify only the *remaining* sockets in the room.
    socket.to(removed.roomId).emit("roomState", rooms.snapshot(removed.room));
    socket.to(removed.roomId).emit(
      "roomClosed",
      `Player ${removed.player} disconnected.`,
    );
  }

  function handleKillerLeave(socketId: string) {
    const removed = killerRooms.removeSocket(socketId);
    if (!removed) return;
    socket.leave(`killer:${removed.roomId}`);
    socket.data.killerRoomId = undefined;
    socket.data.killerSlot = undefined;
    if (!removed.room) return;
    // Notify remaining players. If the game had started, close the room
    // for everyone since 4-player can't continue with a missing player.
    const gameStarted = !!removed.room.state;
    for (const s of removed.room.slots) {
      if (!s.socketId) continue;
      io.to(s.socketId).emit(
        "killer:roomState",
        killerRooms.snapshot(removed.room, s.id),
      );
      if (gameStarted) {
        io.to(s.socketId).emit(
          "killer:roomClosed",
          `Player ${removed.slot} disconnected.`,
        );
      }
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`grid-block-duel server listening on port ${PORT}`);
  console.log(
    `CORS: ${allowAll ? "* (all origins)" : allowedOrigins.join(", ")}`,
  );
});
