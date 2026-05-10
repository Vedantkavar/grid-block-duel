# Game Plan — Grid Block Duel (working title)

## 1. Concept

A two-player, turn-based, grid-based strategy game playable online in the browser. Each player starts on opposite sides of a square grid. The goal is to move your pawn across the board and reach the opponent's starting row first.

On their turn, a player can either:
- **Move** their pawn one step (up / down / left / right), OR
- **Place a wall** (obstacle) of length 2 or 3 on the grid to block the opponent's path.

Each player has a limited number of walls. Walls cannot fully seal off the opponent — there must always be at least one valid path remaining (classic Quoridor-style rule).

> Inspiration: Quoridor, but with variable-length walls (2 and 3) and online multiplayer.

---

## 2. Core Rules (first draft)

- **Board size:** 9x9 cells (tweakable, start with 9x9).
- **Players:** Player A starts at the bottom-middle row, Player B at the top-middle row.
- **Win condition:** First player to reach any cell on the opponent's starting row wins.
- **Turn options:**
  1. Move pawn 1 cell (orthogonal, no diagonal in v1).
  2. Place a wall:
     - Wall of length 2 — blocks 2 edges in a straight line.
     - Wall of length 3 — blocks 3 edges in a straight line.
     - Walls sit *between* cells, not on cells.
- **Wall inventory (starting):**
  - 4 walls of length 2
  - 2 walls of length 3
  - (numbers will be balanced during playtesting)
- **Path rule:** A wall placement is only legal if both players still have at least one path to their goal.
- **Jump rule (optional, v2):** If pawns are adjacent, allow jumping over (Quoridor-style).

---

## 3. Tech Stack

Picked for: fast iteration, real-time multiplayer, free/cheap hosting, browser-only.

**Frontend**
- React + TypeScript
- Vite (dev server / build)
- HTML5 Canvas for the board (cleaner for grid rendering than DOM)
- Zustand or React Context for client state
- Socket.IO client for realtime

**Backend**
- Node.js + TypeScript
- Express (HTTP) + Socket.IO (realtime)
- In-memory game state for v1 (rooms map). Add Redis later if scaling.
- Server is the source of truth — clients send intents, server validates and broadcasts.

**Hosting (free tiers to start)**
- Frontend: Vercel or Netlify
- Backend: Render, Railway, or Fly.io (needs persistent socket connections)

**Why not Unity / Godot?**
Browser-first multiplayer with low friction (no install, just a URL). A 2D grid game doesn't need a full engine.

---

## 4. Architecture

```
[Browser A] <--socket.io--> [Node server] <--socket.io--> [Browser B]
                                  |
                          in-memory rooms
                          { roomId -> GameState }
```

- **Client** renders the board, captures input, sends actions (`move`, `placeWall`).
- **Server** holds authoritative `GameState`, validates every action, runs path-check (BFS), updates state, broadcasts to both players.
- **No client-side trust** — clients only render what the server confirms.

### Game state shape (rough)

```ts
type GameState = {
  roomId: string;
  board: { rows: number; cols: number };
  players: {
    A: { pos: [number, number]; wallsLeft: { len2: number; len3: number } };
    B: { pos: [number, number]; wallsLeft: { len2: number; len3: number } };
  };
  walls: Wall[]; // placed walls
  turn: "A" | "B";
  status: "waiting" | "playing" | "finished";
  winner?: "A" | "B";
};
```

---

## 5. Multiplayer Flow

1. Player A opens the site → clicks **Create Room** → gets a room code + shareable link.
2. Player A sends link to friend.
3. Player B opens link → joins room → game starts.
4. Server randomly picks who goes first.
5. On each turn, active player sends an action → server validates → broadcasts new state.
6. Disconnect handling: 30-second reconnect window before forfeit.

No accounts needed for v1. Add optional nicknames.

---

## 6. Milestones

### M1 — Local prototype (single browser, hot-seat)
- Render 9x9 grid + two pawns
- Move pawn with click
- Place wall (length 2) by click + drag or two-cell selection
- Turn switching
- Win detection
- Path-validity check (BFS) before allowing wall

### M2 — Online multiplayer (2 browsers, same machine)
- Node + Socket.IO server
- Create / join room flow
- Sync state across two clients
- Server-side validation of every action

### M3 — Polish & rules complete
- Length-3 walls
- Wall inventory UI
- Turn timer (optional)
- Game over screen + rematch button
- Sounds + small animations

### M4 — Public release
- Deploy frontend + backend
- Domain + simple landing page
- Share link / room code UX
- Basic analytics (just game count, no PII)

### M5 — Stretch
- Spectator mode
- Replays (record action list)
- Ranked / matchmaking
- Mobile-responsive layout
- AI opponent for solo practice

---

## 7. Key Risks & Open Questions

- **Wall placement UX** — placing length-2 / length-3 walls between cells must feel obvious. Needs prototyping early.
- **Path-check performance** — BFS on 9x9 is trivial, no concern.
- **Cheating** — server-authoritative design handles it.
- **Hosting cost for sockets** — free tiers usually have idle-shutdown; first request after idle will be slow. Acceptable for v1.
- **Balance** — number of walls per player will need playtesting.

Open questions:
- Should length-3 walls cost more "wall slots" than length-2?
- Diagonal walls? (probably no, keeps rules simple)
- Time limit per turn? (optional toggle when creating room)

---

## 8. First Concrete Steps

1. Set up a Vite + React + TS project in this folder.
2. Build the static 9x9 board with two pawns (no logic yet).
3. Add click-to-move with turn switching (hot-seat).
4. Add wall placement UI (start with length-2 only).
5. Add BFS path check.
6. Once hot-seat feels right → introduce the Node + Socket.IO server.

---

## 9. Project Structure (planned)

```
pro3/
├── plan.md
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── game/          # pure game logic (board, rules, BFS)
│   │   ├── components/    # Board, Cell, Wall, HUD
│   │   ├── net/           # socket client
│   │   └── App.tsx
│   └── package.json
├── server/                # Node + Socket.IO
│   ├── src/
│   │   ├── rooms.ts
│   │   ├── game/          # shared rule logic (mirror of client)
│   │   └── index.ts
│   └── package.json
└── shared/                # shared TS types (GameState, actions)
```

`shared/` lets client and server use the same types and ideally the same rule functions, so validation logic doesn't drift.

---

## 10. Notes for later

- Keep all game rules as **pure functions** (state + action → new state). Makes testing trivial and lets server reuse them.
- Write unit tests for rules early — wall blocking is the place bugs will hide.
- Don't optimize before M2 works end-to-end.
