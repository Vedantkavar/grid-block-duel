# Grid Block Duel

A browser-based, server-authoritative board game featuring **two distinct modes**:

- **Duels** — a 2-player Quoridor-inspired race with variable-length walls and pickup abilities.
- **Killer Is Near** — a 2–4 player asymmetric chase: survivors run for the exit while one player controls the Killer.

Play **offline** (pass-the-device on one screen) or **online** (host a room and share a 5-letter code).

## Tech stack

| Layer | Stack |
| --- | --- |
| Client | React 18 + TypeScript + Vite |
| Server | Node 18 + Express + Socket.IO |
| Transport | WebSocket (Socket.IO) |
| Hosting | Vercel (client) + Render (server) — see [DEPLOY.md](DEPLOY.md) |

The server is **authoritative**: rules are validated server-side and only legal moves are broadcast to clients.

## Quick start

You'll need Node 18+ and npm. Open two terminals.

```bash
# 1) Server
cd server
npm install
npm run dev          # starts on http://localhost:3001

# 2) Client (separate terminal)
cd client
npm install
npm run dev          # opens http://localhost:5173
```

Optional — set the WebSocket endpoint for the client (defaults to `http://localhost:3001`):

```bash
# client/.env.local
VITE_SERVER_URL=http://localhost:3001
```

## How to play

In-app **How to Play** modal on the main menu has the full visual rules for both modes. Quick summary:

### Duels
- Each player races to the opposite side of the board.
- On your turn: **Move** one step, or **Place a wall** to block the opponent.
- Walls come in short (length 2) and long (length 3); a placement is illegal if it would seal off either player's only path.
- Loot boxes scattered on the board grant single-use abilities (Jump Wall, Dash, Diagonal Step, Trap Wall, Break Wall).

### Killer Is Near
- One player is the **Killer**; the others are **Survivors**.
- Survivors win by reaching the exit row; the Killer wins by reducing the Survivor count to zero within their kill radius.
- Players place **stick walls** (frame-2 or frame-3 shapes) to redirect the chase, and the Killer can drop an **O-Cage** to trap a survivor.

## Online play

- Host: pick **Duels → Play Online → Host a room**, share the room code.
- Join: pick **Duels → Play Online → Join a room**, enter the 5-letter code.
- Same flow for **Killer Is Near**.

## Mobile / touch

Walls are placed by dragging a finger across the board to position a ghost preview. Once you lift your finger, the ghost stays put and a floating **✓ Place wall** / **✕ Cancel** bar appears, so you can reposition or back out before committing.

## Project layout

```
client/                 React + Vite app (UI)
  src/
    components/         Screens (Board, MainMenu, HowToPlay, ...)
    game/               Client-side rules + types (Duel + Killer)
    net/                Socket.IO client + shared protocol types
server/                 Node + Express + Socket.IO server
  src/
    rooms.ts            Duel room manager
    killerRooms.ts      Killer room manager
    game/               Authoritative rules (mirrors client)
DEPLOY.md               Deployment notes (Vercel + Render)
render.yaml             Render service blueprint
```

## Scripts

| In | Command | What it does |
| --- | --- | --- |
| `client/` | `npm run dev` | Vite dev server with HMR |
| `client/` | `npm run build` | Production build to `dist/` |
| `client/` | `npm run preview` | Serve the production build locally |
| `server/` | `npm run dev` | TS server with hot reload |
| `server/` | `npm run build` | Compile to `dist/` |
| `server/` | `npm start` | Run compiled server |

## Deploying

See [DEPLOY.md](DEPLOY.md) for step-by-step Vercel (client) + Render (server) deployment. The shipped [render.yaml](render.yaml) provisions the server service.

## License

This repository is provided as-is for personal / educational use.
