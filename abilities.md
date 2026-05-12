# Abilities (loot-box system) — v1 spec

## Concept

During a game, **loot boxes** spawn on random empty cells. A player who walks
onto a loot-box cell picks it up and gains an **ability charge** — a one-shot
power they can use on a later turn instead of moving or placing a regular
wall.

This adds risk/reward, a reason to detour, and asymmetric power-ups without
breaking the core race-to-the-other-side game.

---

## Spawn rules

- **At most one box on the board at a time.**
- A new box spawns **only after** the existing box is picked up (or at game
  start, after a small delay — see below).
- The new box appears at an empty cell that is **at least `MIN_SPAWN_DIST`
  cells away** from where the previous box was picked up (Manhattan
  distance). Default: `MIN_SPAWN_DIST = 3`. Falls back to "anywhere empty"
  if no cell satisfies the constraint.
- Never spawns on a player's pawn, on the opponent's goal row (would be too
  punishing as a forced detour), or on a cell occupied by a placed wall's
  endpoint.
- The ability inside is **hidden** from both players until pickup. The "i"
  info button on the header reveals what's in the *current* box (see UI).
- **Game start**: the first box appears after **3 turns have been played**
  (so neither player can grab one immediately off spawn).

> Tunable knobs: `MIN_SPAWN_DIST`, "first-box delay", whether the contents
> are revealed by the i-button or kept fully secret. Defaults above.

---

## Inventory

- Each player can hold **up to 2 abilities at a time**.
- Walking onto a loot box while you already have 2 charges:
  - The pickup pauses the turn at "ability acquired".
  - A modal appears: **"Replace which ability?"** with three buttons —
    your two existing abilities and the new one. Picking one of your old
    ones swaps it out; picking the new one discards it.
  - You **don't lose your turn** to this — the pickup is part of the move.
- Held abilities are visible to *you* but **face-down** to the opponent
  (they just see "?" markers).

---

## Abilities to implement (v1)

### 1. Jump Wall
Move one cell in any of the 4 orthogonal directions, *through* any wall in
the way. Cannot land on the opponent's cell. Cannot leave the board.

### 2. Dash
Take **two** orthogonal steps in a single turn. The two steps can be in any
direction (including a 90° turn). Both steps respect normal wall blocking.
Cannot pass through the opponent (intermediate or final cell).

### 3. Diagonal Step
Move a single cell diagonally. Blocked **only** if **both** orthogonal edges
that make up that diagonal are walled (otherwise you can "slip" past the
corner). Cannot land on the opponent.

### 4. Break Wall
Remove any one placed wall (yours or opponent's) from the board. Frees up
the wall *back into the placer's inventory* — no, on second thought: the
broken wall is **permanently removed**, no refund. (Open to debate; the
"refund to placer" version is a free wall to the opponent and gets
exploited.)

### 5. Trap Wall (auto-break)
Place a 1×1 block on any empty cell (does not need to leave a path — the
trap *is* the path).
- A trap **breaks (disappears)** after a total of **3 step-attempts** by
  any pawn against it. A "step-attempt" is when a player tries to move
  *onto* the trap cell; the move is consumed (counts as their turn) and the
  step counter increments. After 3 attempts, the trap vanishes and the
  cell is passable on subsequent turns.
- Limit: **1 active trap per player** at a time.
- Visual: pulses brighter as it nears breaking (`3/3 → 2/3 → 1/3`).

### 6. Scramble
Affects the opponent's **next placed wall**:
- The wall is placed normally by the opponent, then the server **shortens
  it by 1 segment** (length-3 → length-2; length-2 → length-1).
- A length-1 wall is allowed in this case (rendered as a single segment),
  even though normal placement doesn't allow it.
- The Scramble effect is consumed when the opponent places their next wall.
  Until then, they're "scrambled" (small icon next to their name).
- If the opponent never places another wall before the game ends, the
  effect simply expires.

### 7. Re-roll
Discard one ability in your inventory and immediately draw a new random
ability from the pool. Costs the turn. Cannot re-roll an empty slot.
The new ability is **always different** from the one you discarded
(prevents a feels-bad re-roll into the same thing).

---

## UI changes

### Header — "i" info button
A small **i** icon button in the play screen header.
- When clicked: shows a popover/modal listing every loot box currently on
  the board with:
  - Cell coordinates (or just a "highlight on the board" hover effect).
  - The **ability inside it** (its name + a one-line tooltip of what it
    does).
- Mainly useful because the game won't have many words on screen during
  play — the i-button is the always-available reference.
- Closed/dismissed by clicking outside or hitting Esc.

### Loot box on the board
- A small glowing crate sprite that gently bobs.
- Has a faint colored aura matching the *category* of ability:
  - Movement = blue
  - Wall = orange
  - Disruption = purple
- Clicking the crate (without standing on it) shows a tooltip:
  *"Walk here to pick up an ability."*

### Player ability slots
- Each player strip shows **2 slots** under their name.
  - Your slots: show the ability icon + name.
  - Opponent's slots: show "?" until they use the ability.
- Tap your slot → enter **ability targeting mode**:
  - Movement abilities: highlights the legal target cells in green.
  - Wall abilities (Break / Trap): different targeting modes per
    ability (click an existing wall, place a new cell, etc.).
  - Re-roll / Scramble: instant — just confirm.

### Replace-ability modal
Triggered when you pick up a 3rd ability:
```
┌─────────────────────────────┐
│  Replace which ability?     │
│                             │
│  [Jump Wall] [Dash] [NEW: Trap Wall] │
│                             │
│  Pick the one to discard.   │
└─────────────────────────────┘
```
Picking your old ability discards it and stores the new one.
Picking the new one discards it (you keep your two old).

---

## Design rules / guardrails

- **Each ability use costs one turn**, same as a move or wall placement.
- **Pickups happen mid-move** — you move onto the cell, the box pops, and
  the turn ends as normal (unless replace-ability modal interrupts).
- **Path rule** still applies for normal walls.
  Trap Wall is the **only** exception.
- **Abilities are face-down** until used. The i-button only reveals what
  loose boxes contain, not what's in opponent's inventory.
- **Online sync** — server is authoritative. Loot box spawn cells and
  contents are computed server-side using a seeded RNG so both clients
  agree without trusting either.
- **Determinism for replays** — store the seed + every action.
- **Ability pool** for v1 random rolls:
  ```
  jumpWall, dash, diagonalStep, breakWall, trapWall, scramble, reroll
  ```
  All seven are equally weighted to start. Tweak weights after playtesting.


---

## Data model sketch

```ts
type AbilityId =
  | "jumpWall"
  | "dash"
  | "diagonalStep"
  | "breakWall"
  | "trapWall"
  | "scramble"
  | "reroll";

type LootBox = {
  id: string;
  pos: Coord;
  ability: AbilityId;     // sent to clients (the "i"-button reveals it)
  spawnedTurn: number;
};

type AbilityCharge = {
  id: AbilityId;
  acquiredTurn: number;
};

type Trap = {
  owner: PlayerId;
  pos: Coord;
  hitsLeft: number; // starts at 3, decremented each step-attempt
};

type ScrambleEffect = {
  victim: PlayerId; // opponent of the player who used Scramble
  appliedTurn: number;
};

type PlayerState = {
  // ...existing
  abilities: AbilityCharge[]; // max length 2
};

type GameState = {
  // ...existing
  lootBox: LootBox | null;     // exactly 0 or 1 box on the board
  lastPickupPos: Coord | null; // used to enforce MIN_SPAWN_DIST
  traps: Trap[];               // active 1x1 traps
  scramblePending: ScrambleEffect | null;
  rngSeed: string;             // server-controlled
};

type Action =
  | MoveAction
  | PlaceWallAction
  | UseAbilityAction
  | ReplaceAbilityAction
  | DismissReplaceAction;

type UseAbilityAction = {
  type: "useAbility";
  player: PlayerId;
  ability: AbilityId;
  target?:
    | { kind: "cell"; pos: Coord }                     // jumpWall, diagonalStep, trapWall
    | { kind: "twoCells"; first: Coord; second: Coord } // dash
    | { kind: "wallIndex"; index: number }              // breakWall
    | { kind: "slotIndex"; index: 0 | 1 };              // reroll
};
```

---

## Implementation plan (smallest useful steps)

We'll do this in phases so each one is verifiable on its own.

**Phase A — Loot box plumbing (no abilities yet)**
1. Add `lootBox`, `lastPickupPos`, `rngSeed` to `GameState`.
2. Server-side: spawn the first box after 3 turns; respawn after pickup
   with the `MIN_SPAWN_DIST` rule.
3. On move-into-box, transfer the box ability into the mover's inventory
   (max 2; if full, switch to "replace?" prompt before the turn commits).
4. Render the crate on the board + the 2 ability slots in the player strip.
5. Header **i** button → popover listing the current box's ability.

**Phase B — Movement abilities** (Jump Wall, Dash, Diagonal Step)
- Easiest to add because they only extend "what's a legal move".
- Targeting mode: highlight cells in green as before, just with the
  ability's expanded reachability.

**Phase C — Wall abilities** (Break Wall, Trap Wall)
- Break Wall: click any placed wall to remove it.
- Trap Wall: click any cell, place a 1x1; `hitsLeft = 3` counter rendered.

**Phase D — Effect abilities** (Scramble, Re-roll)
- Scramble: store `scramblePending`; on opponent's next wall placement,
  trim its length by 1 before committing.
- Re-roll: open a tiny inline picker — click which slot to reroll.

**Phase E — Polish**
- Pickup animation, sound, log line.
- Box "aura" by ability category.
- Tooltip on the i-button popover.

Phase A unlocks every other phase, so we'll start there.

---

## Open questions before coding

1. **Should the loot-box system have a setup toggle** (off / on / weights)
   or always be on? (Current plan: always on for v1, add toggle later.)
2. **Trap Wall: `hitsLeft` decrement on stepping onto it from any side, or
   only when the *opponent* steps?** (Plan: any pawn — including the
   placer — counts. Don't make traps friendly fire-immune; it'd be too
   safe.)
3. **Scramble: if the opponent places a length-2 wall while scrambled, is
   length-1 a valid wall at all?** (Plan: yes, length-1 walls are legal
   *only* as a result of Scramble. They render as a single segment and
   can be Break-Walled like any other.)
4. **Does Re-roll cost the turn?** (Plan: yes, same as any other ability.)
