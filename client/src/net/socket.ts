import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./protocol";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ||
  "http://localhost:3001";

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
