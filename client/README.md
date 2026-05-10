# Grid Block Duel — Client (M1 hot-seat prototype)

A two-player Quoridor-style game with variable-length walls. This is the local
hot-seat version: both players take turns on the same screen.

## Run it

```powershell
cd client
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## How to play

- **Goal:** Reach the opposite side of the board.
- **Players:** Blue (A) starts at the bottom and must reach the top row. Pink
  (B) starts at the top and must reach the bottom row.
- **On your turn**, you can either:
  - **Move** one cell up / down / left / right (highlighted green squares), or
  - **Place a wall** between cells to block your opponent.
- Each player starts with **4 short walls (length 2)** and **2 long walls
  (length 3)**.
- A wall is illegal if it would seal off either player's only path to their
  goal. The game checks this with BFS before letting you place.
- Players cannot occupy the same cell.

## Controls

| Key | Action |
| --- | --- |
| `M` | Move mode |
| `2` | Wall ×2 mode |
| `3` | Wall ×3 mode |
| `R` | Rotate wall (horizontal ↔ vertical) |

In wall mode, hover over the board to see a ghost preview snapped to the
nearest valid slot. Click to place. White outline = valid, red outline =
invalid.

## What's next

See `../plan.md` for the full roadmap. The next milestone (M2) adds a
Node + Socket.IO server so two players can play from different browsers.
