# 4-Player Mode — "Killer" (working title)

## Concept

A 4-player round on a shared grid. One player is randomly chosen as the
**Killer** at game start. The other **three are Runners**, playing on the
same team. Roles are public from the start — everyone knows who the
Killer is.

Walls let Runners slow the Killer down. The Killer has a much bigger reach
than any Runner, plus a special ability that breaks through walls on a
cooldown. This isn't a race — it's a hunt on a maze that the Runners build
as they run.

---

## Vocabulary

- **Move** = one player's turn (the standard term in this doc).
- **Round** = all four players have taken one Move each. Effect lifetimes
  in this doc are measured in *rounds* unless explicitly stated otherwise.

## Roles

### Runner (×3, same team)

- Pawn that moves **1 cell at a time** (orthogonal, normal rules).
- Starts with **1 heart** (i.e. 2 half-hearts of health).
- Killer attacks deal **½ heart** of damage. A Runner is eliminated after
  taking 2 hits, or 1 hit if already at ½ heart.
- Has a **small wall inventory** to slow the Killer (see balance).
- Wins if **at least one Runner is alive** when the move cap is reached.
- Pawns are visually team-colored (e.g. teal). Each Runner has a small
  heart indicator showing full / half / empty.

### Killer (×1)

- Pawn moves up to **N cells per Move** in any orthogonal path (no
  diagonals; walls still block each step). N depends on grid size:
  **9×9 → 2**, **11×11 / 13×13 → 3**. Can move fewer or stand still.
- Has a **kill range** measured by shortest in-bounds path length
  through unblocked edges: **3** on 9×9, **4** on 11×11 / 13×13. Walls
  block the strike the same way they block movement.
- **Strikes are manual.** On the Killer's Move, any Runner inside the
  kill radius pulses red — the Killer clicks one to strike. A successful
  strike deals **½ heart** of damage and **consumes the entire Move**
  (no step that turn). Runners die at 0 hearts.
- Has **no wall inventory** — can't build walls. Instead has the
  **Supercharge** ability.
- Wins if all 3 Runners are eliminated.
- Visually distinct from the Runners (red pawn / threat aura). Identity
  is public from the start; everyone sees who the Killer is.

#### Supercharge (Killer-only ability)

- Starts the game **ready**. After use, recharges over the Killer's
  **next 3 Moves** (i.e. available again on the Killer's 4th Move after
  using it).
- Effect: **break any one wall edge** on the board (placed by any
  Runner). Other edges of the same wall stay intact.
- **Free action** — doesn't consume the Move. Can be used in the same
  Move as a step or a strike.
- Charge indicator visible to everyone ("ready" / "(0/3)" / "(1/3)" /
  "(2/3)").

---

## Setup

- **Grid size**: 11×11 by default (configurable: 9×9 / 11×11 / 13×13).
- **Starting positions**:
  - **Killer** spawns in a random cell. To give Runners a chance,
    the spawn is constrained: at least **5 cells (Manhattan) away** from
    the nearest Runner spawn.
  - **3 Runners** spawn in cells far from the Killer. Easiest version:
    the 3 Runners take 3 of the 4 board corners; the Killer takes the
    one farthest from any Runner (or a random cell satisfying the
    distance rule).
- **Wall inventory** (per Runner):
  - **Length-2 wall** — a straight 2-segment stick, same edge-encoding
    as the 2-player game. Placeable anywhere on the board (no
    "must-leave-a-path" rule in this mode). **1 per Runner.**
  - **Length-3 wall** — a straight 3-segment stick. **1 per Runner.**
  - **O-Cage** — a 1×1 ring of edges placed **on the Killer's cell**.
    Adds whichever of the 4 surrounding edges are still missing
    (off-board or already-walled sides are skipped). Lasts **2 rounds**
    then dissolves. **1 per Runner.**
  - Total per Runner = 3 items, 9 total team-wide.
- **Killer wall inventory**: **0**. Killer relies on movement +
  Supercharge.
- **Zone inventory**: not yet implemented — see *Zones (planned)*
  below.

---

## Turn structure

- **Move order**: fixed clockwise around the players, decided at game
  start. The Killer's position in the rotation is random.
- **One full round** = all four players have taken one Move.
- **On your Move, you can do one of:**
  - Step (Runner: 1 cell, Killer: up to step-max cells based on grid)
  - Place a wall (Runner only; pick length-2, length-3, or O-Cage from
    your inventory)
  - Killer only: **strike** a Runner currently inside the kill radius
    (click their pawn). Consumes the whole Move.
  - Killer only: trigger **Supercharge** (free action; still take a
    step or strike afterwards)
  - **Skip** — do nothing and pass the turn
- **End of round**: when all four players have moved once, the round
  counter ticks; the O-Cage's expiry is checked.

---

## Win conditions

- **Runners win** if all of:
  - At least one Runner is alive when the game ends.
- **Killer wins** if all 3 Runners are eliminated.
- **Game ends when:**
  - All Runners are eliminated (Killer wins), OR
  - A **move cap** is reached. The cap is **configurable at setup**:
    **40 to 100 Moves in steps of 5** (default 60). If at least one Runner is
    alive when the cap hits, Runners win.
  - "Run out the clock" gives Runners a fair non-pacifist objective.

---

## Zones

Zones are **temporary area effects** that spawn automatically on the
board. Players don't carry a zone inventory — a random zone appears at a
random valid location every **5 Moves**. Anyone can step through zone
cells (zones don't block movement); the effect applies based on which
role is currently standing inside.

| Zone | Owner | Size | Lifetime | Effect |
|------|-------|------|----------|--------|
| **Fast** | Runner | 5×5 | 3 rounds | Runner inside can step **2 cells** on their Move (instead of 1). |
| **Slow** | Runner *(against Killer)* | 5×5 | 3 rounds | Killer inside has step max **−1** (stacks across multiple Slow Zones, floors at 0). |
| **Killer** | Killer | 4×4 | 2 rounds | While Killer stands inside, their strike **ignores walls** (still capped by kill range, Manhattan). |
| **Snipe** | Killer | 3×3 | 2 rounds | While Killer stands inside, they may click **any Runner anywhere** to deal ½ heart (consumes the Move, ignores walls and range). |
| **Heal** | Runner | 4×4 | 3 rounds | Each Runner inside heals **½ heart** at the end of every round. |

### Spawn rules

- A random zone (uniform pick from the 5 kinds) spawns automatically
  every **5 Moves** (`moveCount % 5 === 0` after a Move resolves).
- Anchor cell is picked uniformly at random; the footprint must fit on
  the board. Zones may overlap each other, walls, or pawns.
- No cap on concurrent zones; older ones expire on their own.

### Effect timing

- **Fast / Slow** — applied when the affected player begins their Move.
  Fast gives the Runner a 2-step path option; the toolbar's Done button
  commits the path early. Slow reduces the Killer's step count for that
  Move.
- **Killer Zone** — applied during the Killer's strike: range stays at
  the grid-scaled value but is measured by Manhattan distance instead of
  wall-aware BFS.
- **Snipe Zone** — while the Killer is inside, every alive Runner pulses
  red on the board. Clicking one fires a Snipe (½ heart, no range/wall
  check, consumes the Move).
- **Heal** — applied at end of round, just before zone expiry.

### Visibility

- All zones are visible to all players, color-coded:
  - Fast = teal
  - Slow = orange
  - Killer = red
  - Snipe = purple
  - Heal = green
- An **info button (`i`)** in the top bar opens a modal listing every
  active zone with its description and rounds-remaining. Esc / clicking
  the backdrop closes it. Pressing `i` toggles the modal.

---

## Walls + path rules

**Walls are edge-based, exactly like the 2-player game.** A wall sits on
the edges between cells; pawns can't step across walled edges.

The Runner inventory contains three wall items:

- **Length-2 wall** — straight 2-segment stick. Pick orientation
  (horizontal / vertical) and place anywhere on the board, identical UX
  to the duel game's ghost-preview placement.
- **Length-3 wall** — straight 3-segment stick. Same placement UX.
- **O-Cage** — a 1×1 frame placed on the Killer's cell. It only adds
  the edges that are still missing on each of the 4 sides (off-board or
  already-walled sides are skipped). Lasts **2 rounds**, then the edges
  it added are removed.

Placement rules:

- All edges of the placed wall must lie on the board.
- No edge may overlap an existing wall (cage is the exception — it
  silently skips already-walled sides).
- **No "must-leave-a-path" rule** in this mode — Runners can wall
  anywhere, even sealing themselves or the Killer in. The Killer's
  Supercharge is the safety valve.
- The Killer's Supercharge breaks **one edge segment** of any placed
  wall per use.
- The O-Cage auto-dissolves after 2 rounds; the original wall edges it
  overlapped (if any) remain.

No 1×1 traps in 4-player mode (might layer in later as a Runner ability).

---

## Visibility

Full board visibility for everyone — same as the 2-player game. No fog of
war in v1. The Killer pawn is rendered in a distinct color so everyone
knows who to run from.

---

## UI

### Mode picker

When the player taps the **Play with friends** card on the main menu,
they're taken to a small **Mode picker** screen with two cards:

- **Play here (offline)** — hot-seat mode. All 4 players share one
  screen, passing the device on each Move.
- **Host a room / Join a room** — online mode. Up to 4 players join via
  a 5-letter room code from any browser. Server-authoritative.

### Lobby

**Offline (hot-seat)**

- A single setup screen lets the device-holder enter all 4 player names,
  pick their **pawn shape** (4 styles) and **pawn color** (6 colors:
  blue / pink / teal / gold / purple / orange), pick the grid size (9 /
  11 / 13), and pick the game
  length (40 to 100 Moves in steps of 5).
- An optional **Zones** toggle (on by default) — turn off for a pure
  walls + supercharge game with no auto-spawning area effects.
- The Killer slot is randomly picked when the first Move starts.
- On each player's **first** Move, a curtain announces their role
  (*"You are the Killer"* or *"You are a Runner"*) before they play.
  Later turns skip the curtain and go straight into the game.

**Online**

- Host clicks **Host a room** and gets a 5-letter code. Up to 3 friends
  join via the **Join a room** screen using that code.
- Lobby shows all 4 slots filling up. Host clicks **Start** when full.
- Server picks the Killer slot randomly on start; the killer's role is
  visible to everyone (doc-confirmed — no hidden roles).
- No pass-the-device curtain online; each player sees the play screen
  on their own device. When it isn't your turn, the toolbar shows
  *"Waiting for <name>…"*.
- Disconnect handling: any player leaving while the game is running ends
  the room with a notice on all remaining clients (no reconnects in v1).
- Rematch: only the host can trigger; server creates a fresh state with
  a new random Killer pick.

### In-game

- Top bar: room code (online) **or** "Hot-seat" badge (offline) + role
  indicator
  - Killer's view: *"You are the Killer"* in red, supercharge state
  - Runner's view: *"You are a Runner — survive!"* with a Move counter
- 4 player strips showing each player's name, color, role badge, and
  *alive/dead* status. Walls + zones remaining are shown only for the
  current view's player (offline: shown for whoever's Move it is).
- Active-Move ring around whoever is currently moving.
- Killer's reach (cells reachable in 2 steps) only previewed for the
  Killer's view.
- **Kill radius** (cells within 3 unblocked steps of the Killer) is
  highlighted on the board for **everyone** — Runners need to see it to
  decide where it's safe to step. Updates live as walls are placed and
  the Killer moves.

In **offline mode**, the same screen swaps which player is "the active
view" between Moves, with a brief *"Pass to <name>"* curtain so private
info (Killer's supercharge state, exact walls remaining) doesn't leak.

### Endgame

- Big modal: winner team.
- Stats line (optional): turns played, walls placed, kills made.

---

## Data model sketch

```ts
type Role = "runner" | "killer";

type RunnerWallInventory = {
  frame2: number; // 2×2 frames
  frame3: number; // 3×3 frames
  cage: number;   // 1×1 O-cages (4 edges around the Killer)
};

type ZoneInventory = {
  fast: number;   // Runner only
  slow: number;   // Runner only
  heal: number;   // Runner only
  killer: number; // Killer only
};

type Player = {
  id: PlayerId; // "A" | "B" | "C" | "D"
  name: string;
  style: PawnStyle;
  pos: Coord;
  alive: boolean;
  role: Role;
  // Hearts: 2 = full, 1 = half, 0 = dead. Strikes deal 1 (½ heart).
  hp: number;
  hpMax: number;
  // Inventories
  walls: RunnerWallInventory; // empty for Killer
  zones: ZoneInventory;
  // Killer-only:
  supercharge: { ready: boolean; chargeProgress: number /* 0..2 */ };
};

type WallKind = "frame2" | "frame3" | "cage";

type WallEdge = {
  orientation: "h" | "v";
  r: number;
  c: number;
}; // same encoding as the 2-player edge model

type PlacedWall = {
  kind: WallKind;
  owner: PlayerId;
  edges: WallEdge[];          // every edge segment occupied by this wall
  expiresOnRound?: number;    // only set for cage (1 round)
};

type ZoneKind = "fast" | "slow" | "killer" | "heal";

type PlacedZone = {
  kind: ZoneKind;
  owner: PlayerId;
  // Footprint described as the top-left anchor + size (size depends on
  // kind: fast=2, slow=3, killer=3, heal=4).
  anchor: Coord;
  size: number;
  expiresOnRound: number; // round index when this zone disappears
};

type GameState = {
  size: number;
  players: Player[];     // 4 entries
  walls: PlacedWall[];
  zones: PlacedZone[];
  turn: PlayerId;
  moveIndex: number;     // monotonic per-Move counter (was: turnIndex)
  roundIndex: number;    // increments after every 4 moves
  status: "playing" | "finished";
  winner?: "runners" | "killer";
  moveCap: number;
};
```

`PlayerId` becomes `"A" | "B" | "C" | "D"` in this mode. Existing 2-player
code uses just `"A" | "B"` — we'll likely keep two separate game modules
(`game/duel/` and `game/killer/`) so types don't get muddled. The server
should be agnostic about which module it loads per room.

---

## Numbers to playtest

These are first-draft balance knobs. They almost certainly need tuning.

| Knob | Default | Notes |
|------|---------|-------|
| Grid | 11×11 (9 / 11 / 13 selectable) | Smaller = Killer too strong, larger = Runners stall |
| Killer step | 2 on 9×9, **3** on 11×11 / 13×13 | Scales with grid size |
| Kill range | 3 on 9×9, **4** on 11×11 / 13×13 | Scales with grid size |
| Strike damage | ½ heart | Runners take 2 hits to die |
| Runner hearts | 1 (= 2 half-hearts) | |
| Supercharge cooldown | **3 of Killer's Moves** | Ready at game start; ~every 4th Killer Move |
| Runner walls (len-2 / len-3 / O-cage) | 1 / 1 / 1 | 9 total team-wide |
| Cage duration | **2 rounds** | Auto-dissolves |
| Move cap | **40 / 45 / 50 / … / 100** (every multiple of 5; default 60) | Runners win if anyone alive at cap |

---

## Implementation phases

We'll build this in a different game module so the existing 2-player code
stays untouched.

**Phase A — engine skeleton (done)**
1. New types: 4-player `Player[]`, role assignment, kill-range BFS.
2. Client lobby supporting 4 slots (offline).
3. Offline hot-seat play screen with first-Move role curtain.

**Phase B — core gameplay (done)**
1. Killer movement (0 to step-max cells, scales with grid).
2. Manual strike (Killer clicks Runner in radius; consumes the Move).
3. Heart tracking for Runners (1 heart, ½-heart strikes).
4. Length-2 / length-3 wall placement for Runners (duel-style ghost
   preview).
5. O-Cage (1×1, fills missing edges, lasts 2 rounds).
6. Move-cap timeout = Runners win; cap selectable 40–100 in steps of 5.

**Phase C — Supercharge (done)**
1. Killer's Supercharge ability + cooldown indicator (3-Move cooldown).
2. Click any wall edge to break it.

**Phase D — in progress**
1. Zones (Fast / Slow / Killer / Snipe / Heal) auto-spawn every 5 Moves — **done**.
2. Info button (`i`) shows active zones — **done**.
3. Online multiplayer for 4-player rooms — **done**.
4. Endgame stats screen, tutorial / tooltip pass — **not yet**.

---

## Open questions

1. **Path rule with Killer in play** — should Runners' walls be required
   to leave the Killer a path too (so they can't lock the Killer in a
   corner)? Or only required to leave *each Runner* a path? Leaning toward
   "each Runner must have a path", and the Killer can Supercharge out if
   they get sealed.

2. **Killer's path-blocked corner case** — if Runners somehow trap the
   Killer with no Supercharge ready, the game still ticks toward the turn
   cap. Is that fine, or do we need a "Killer is stuck" rule?

3. **Kill triggers** — **Resolved: manual.** The Killer clicks a Runner
   inside the kill radius; the strike consumes the entire Move.

4. **Tie-breakers** — not applicable now that strikes are manual.

5. **Dead Runners** — do they still see the board (spectator mode) or get
   kicked? Spectator mode is nicer for the social vibe.

6. **3-player fallback** — should we allow starting with 2 Runners + 1
   Killer if only 3 people are in the room, or always require exactly 4?
   Probably always 4 for v1 to keep balance simple.

7. **O-Cage targeting** — must be placed *centered on the Killer*, or
   can it be placed anywhere (and only "activates" when the Killer steps
   in)? Required-target is simpler and predictable; placement-anywhere is
   sneakier but adds branching cases.

8. **Supercharge vs. frames** — does one Supercharge break the whole
   frame, or just one edge segment? Leaning toward **one segment per
   Supercharge** — bigger frames are bigger investments to tear down.

9. **Wall placement on top of pawns** — a frame surrounds cells but
   doesn't occupy them. So it's fine to place around any pawn (including
   a Runner), as long as the edges don't overlap existing walls. Worth
   double-checking when implementing.

10. **Strikes vs. multiple Runners in range** — currently every Runner
    in range takes ½ damage on the same Killer Move. Alternative: only
    the closest one (or Killer-chosen) takes damage. Affects how much
    grouping costs Runners.

11. **Killer Zone overlap** — if two Killer Zones cover the same cell,
    is the wall-piercing effect doubled or just present? Probably just
    present (boolean: in any Killer Zone or not).

12. **Slow Zone stacking** — if two Slow Zones overlap on a Killer cell,
    does the Killer's step count drop by 2? Could be capped at 0; or
    capped at 1 zone applying. Decide before playtest.

13. **Heal Zone timing** — heals fire at end of round. If a Runner
    leaves the zone mid-round (after their Move), do they still get the
    heal? Easiest answer: only heals Runners standing inside the zone
    when the round ticks.

14. **Zone vs. inventory** — should Zones share the "place an item" Move
    slot with walls, or be a separate sub-action? Plan: same slot — your
    Move is one step OR one wall OR one zone.

---

## How this relates to the existing 2-player code

The 2-player game lives under `client/src/game/` and the server has a
mirror at `server/src/game/`. We'll create parallel folders:

- `client/src/game/killer/` and `server/src/game/killer/`
- Shared protocol gets a `mode: "duel" | "killer"` discriminator and
  separate event/action payloads.

This keeps both modes maintainable without one breaking the other.
