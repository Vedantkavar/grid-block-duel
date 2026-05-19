import { useEffect, useState } from "react";

type Tab = "duel" | "killer";

type Props = {
  onClose: () => void;
};

export default function HowToPlay({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("duel");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop" aria-hidden onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="How to play">
        <div className="endcard endcard--enter htp">
          <h2>How to play</h2>

          <div className="htp__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "duel"}
              className={`htp__tab ${tab === "duel" ? "htp__tab--active" : ""}`}
              onClick={() => setTab("duel")}
            >
              Duel (2P)
            </button>
            <button
              role="tab"
              aria-selected={tab === "killer"}
              className={`htp__tab ${tab === "killer" ? "htp__tab--active" : ""}`}
              onClick={() => setTab("killer")}
            >
              Killer (4P)
            </button>
          </div>

          <div className="htp__body">
            {tab === "duel" ? <DuelGuide /> : <KillerGuide />}
          </div>

          <div className="endcard__actions">
            <button className="btn btn--primary" onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- DUEL --------------------------------------------------------------

function DuelGuide() {
  return (
    <>
      <Section title="Goal">
        <p>
          Be the first to move your pawn onto any cell of your opponent's
          starting row. You start on opposite sides of a square grid.
        </p>
        <Figure caption="Blue starts at the bottom. Pink at the top. Highlighted rows are each player's goal.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[
              { r: 4, c: 2, color: "#4ea3ff" },
              { r: 0, c: 2, color: "#ff6b9a" },
            ]}
            goalRows={[
              { row: 0, color: "#4ea3ff" },
              { row: 4, color: "#ff6b9a" },
            ]}
          />
        </Figure>
      </Section>

      <Section title="Your turn">
        <ul>
          <li>
            <strong>Move</strong> your pawn one cell up, down, left or right.
          </li>
          <li>
            <strong>Place a wall</strong> of length 2 or 3 between cells to
            block your opponent. Costs one wall from your inventory.
          </li>
          <li>
            <strong>Path rule:</strong> a wall is only legal if both players
            still have at least one route to their goal row.
          </li>
        </ul>
        <Figure caption="Legal moves from the blue pawn — one orthogonal step.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[{ r: 2, c: 2, color: "#4ea3ff" }]}
            highlights={[
              { r: 1, c: 2, fill: "#4ea3ff", opacity: 0.35 },
              { r: 3, c: 2, fill: "#4ea3ff", opacity: 0.35 },
              { r: 2, c: 1, fill: "#4ea3ff", opacity: 0.35 },
              { r: 2, c: 3, fill: "#4ea3ff", opacity: 0.35 },
            ]}
          />
        </Figure>
      </Section>

      <Section title="Walls">
        <ul>
          <li>Pick orientation (horizontal / vertical) and length (2 or 3).</li>
          <li>Hover the board to preview, click to commit.</li>
          <li>Your inventory is shown in the toolbar.</li>
        </ul>
        <Figure caption="A length-2 horizontal wall blocks the pawn from stepping down.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[
              { r: 1, c: 2, color: "#4ea3ff" },
              { r: 3, c: 2, color: "#ff6b9a" },
            ]}
            walls={[{ orient: "h", r: 1, c: 1, length: 2 }]}
          />
        </Figure>
      </Section>

      <Section title="Abilities (loot boxes)">
        <p>
          If abilities are enabled, glowing crates spawn on the board. Walk
          onto a crate to grab the ability inside. You can hold up to 2 at a
          time; using one costs your turn.
        </p>
        <Figure caption="A loot crate on the board. Walk onto it to pick up.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[
              { r: 4, c: 2, color: "#4ea3ff" },
              { r: 0, c: 2, color: "#ff6b9a" },
            ]}
            crates={[{ r: 2, c: 2 }]}
          />
        </Figure>
        <div className="htp__chips">
          <AbilityChip name="Jump Wall" desc="Step 1 cell through any wall." category="move" />
          <AbilityChip name="Dash" desc="Take 2 orthogonal steps in one turn." category="move" />
          <AbilityChip name="Diagonal Step" desc="Slip diagonally past a corner." category="move" />
          <AbilityChip name="Break Wall" desc="Remove any one placed wall." category="wall" />
          <AbilityChip name="Trap Wall" desc="Drop a 1×1 trap on a cell." category="wall" />
          <AbilityChip name="Scramble" desc="Opponent's next wall is shortened by 1." category="effect" />
        </div>
      </Section>

      <Section title="Keyboard shortcuts">
        <div className="htp__keys">
          <Kbd k="M" label="Move mode" />
          <Kbd k="W" label="Wall mode" />
          <Kbd k="R" label="Rotate wall" />
          <Kbd k="2" label="Length 2" />
          <Kbd k="3" label="Length 3" />
          <Kbd k="I" label="Info" />
          <Kbd k="Esc" label="Cancel" />
        </div>
      </Section>

      <Section title="Winning">
        <p>
          First player to step onto any cell of the opponent's starting row
          wins. There are no draws — the path rule guarantees the race always
          finishes.
        </p>
      </Section>
    </>
  );
}

// ----- KILLER ------------------------------------------------------------

function KillerGuide() {
  return (
    <>
      <Section title="Roles">
        <p>
          Four players. One is randomly chosen as the <strong>Killer</strong>;
          the other three are <strong>Runners</strong> (same team). Roles are
          public — everyone knows who the Killer is.
        </p>
        <Figure caption="Killer (red) hunts the Runners (blue / pink / teal).">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[
              { r: 2, c: 2, color: KILLER_RED, ring: true },
              { r: 0, c: 0, color: "#4ea3ff" },
              { r: 0, c: 4, color: "#ff6b9a" },
              { r: 4, c: 0, color: "#7be0c2" },
            ]}
          />
        </Figure>
      </Section>

      <Section title="Killer">
        <ul>
          <li>
            Moves up to <strong>2 cells</strong> on 9×9, or <strong>3 cells</strong>
            on 11×11 / 13×13, per Move (walls still block each step).
          </li>
          <li>
            <strong>Strike</strong>: click any Runner inside your kill radius
            (3 on 9×9, 4 on 11×11/13×13). Deals ½ heart and consumes the Move.
          </li>
          <li>
            <strong>Supercharge</strong>: break any one wall edge. Free
            action. Recharges over your next 3 Moves.
          </li>
          <li>Has no walls. Wins by eliminating all 3 Runners.</li>
        </ul>
        <Figure caption="Killer's kill radius — 3 unblocked steps. Any Runner inside is in danger.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[
              { r: 2, c: 2, color: KILLER_RED, ring: true },
              { r: 1, c: 0, color: "#4ea3ff" },
              { r: 4, c: 4, color: "#7be0c2" },
            ]}
            highlights={cellsInRadius(2, 2, 3, 5, 5)}
          />
        </Figure>
      </Section>

      <Section title="Runners">
        <ul>
          <li>Move 1 cell per Move, orthogonal.</li>
          <li>Start with <strong>1 heart</strong> (2 half-hearts). Two strikes = out.</li>
          <li>
            Team inventory per Runner: <strong>1× frame-2</strong>{" "}
            wall, <strong>1× frame-3</strong> wall, <strong>1× O-Cage</strong>{" "}
            (wraps the Killer's cell for 2 rounds).
          </li>
          <li>Win if at least one Runner is alive when the move cap is reached.</li>
        </ul>
        <Figure caption="An O-Cage wraps all 4 sides of the Killer's cell.">
          <MiniBoard
            rows={5}
            cols={5}
            pawns={[{ r: 2, c: 2, color: KILLER_RED, ring: true }]}
            walls={[
              { orient: "h", r: 1, c: 2, length: 1 },
              { orient: "h", r: 2, c: 2, length: 1 },
              { orient: "v", r: 2, c: 1, length: 1 },
              { orient: "v", r: 2, c: 2, length: 1 },
            ]}
          />
        </Figure>
      </Section>

      <Section title="Zones (auto-spawn every 5 Moves)">
        <div className="htp__chips">
          <ZoneChip name="Fast" color="#7be0c2" desc="Runner inside steps 2 cells." />
          <ZoneChip name="Slow" color="#ff9f43" desc="Killer inside loses 1 step." />
          <ZoneChip name="Killer" color={KILLER_RED} desc="Killer's strike ignores walls." />
          <ZoneChip name="Snipe" color="#c4b5fd" desc="Killer can strike any Runner anywhere." />
          <ZoneChip name="Heal" color="#7be0a0" desc="Runners inside heal ½ heart per round." />
        </div>
        <p className="htp__hint">
          Toggle zones off in the lobby for a pure walls + supercharge game.
        </p>
      </Section>

      <Section title="Winning">
        <ul>
          <li><strong>Killer wins</strong> if all 3 Runners are eliminated.</li>
          <li>
            <strong>Runners win</strong> if at least one is alive when the
            Move cap (40–100, default 60) is reached.
          </li>
        </ul>
      </Section>

      <Section title="Hot-seat tip">
        <p>
          In offline mode, the device passes between players each Move. A
          curtain hides each player's private info (supercharge state, exact
          walls) when the device changes hands.
        </p>
      </Section>
    </>
  );
}

// ----- Helpers -----------------------------------------------------------

const KILLER_RED = "#ef4444";

function cellsInRadius(
  cr: number,
  cc: number,
  radius: number,
  rows: number,
  cols: number,
): MBHighlight[] {
  const out: MBHighlight[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.abs(r - cr) + Math.abs(c - cc);
      if (d > 0 && d <= radius) {
        out.push({ r, c, fill: KILLER_RED, opacity: 0.18 });
      }
    }
  }
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="htp__section">
      <h3 className="htp__section-title">{title}</h3>
      {children}
    </section>
  );
}

function Figure({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="htp__figure">
      <div className="htp__figure-art">{children}</div>
      <figcaption className="htp__caption">{caption}</figcaption>
    </figure>
  );
}

function Kbd({ k, label }: { k: string; label: string }) {
  return (
    <span className="htp__kbd-row">
      <kbd className="htp__kbd">{k}</kbd>
      <span>{label}</span>
    </span>
  );
}

const CATEGORY_COLOR: Record<"move" | "wall" | "effect", string> = {
  move: "#4ea3ff",
  wall: "#ff9f43",
  effect: "#c4b5fd",
};

function AbilityChip({
  name,
  desc,
  category,
}: {
  name: string;
  desc: string;
  category: "move" | "wall" | "effect";
}) {
  const color = CATEGORY_COLOR[category];
  return (
    <div className="htp__chip">
      <span
        className="htp__chip-swatch"
        style={{ background: color, color: "#0a0c16" }}
        aria-hidden
      >
        {category === "move" ? "→" : category === "wall" ? "▮" : "✦"}
      </span>
      <div className="htp__chip-body">
        <strong>{name}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}

function ZoneChip({
  name,
  desc,
  color,
}: {
  name: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="htp__chip">
      <span
        className="htp__chip-swatch htp__chip-swatch--square"
        style={{ background: color, opacity: 0.85 }}
        aria-hidden
      />
      <div className="htp__chip-body">
        <strong style={{ color }}>{name}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}

// ----- MiniBoard SVG -----------------------------------------------------

type MBPawn = { r: number; c: number; color: string; ring?: boolean };
type MBWall = { orient: "h" | "v"; r: number; c: number; length: number };
type MBHighlight = { r: number; c: number; fill: string; opacity?: number };
type MBGoalRow = { row: number; color: string };
type MBCrate = { r: number; c: number };

function MiniBoard({
  rows,
  cols,
  pawns = [],
  walls = [],
  highlights = [],
  goalRows = [],
  crates = [],
  cell = 30,
  pad = 6,
}: {
  rows: number;
  cols: number;
  pawns?: MBPawn[];
  walls?: MBWall[];
  highlights?: MBHighlight[];
  goalRows?: MBGoalRow[];
  crates?: MBCrate[];
  cell?: number;
  pad?: number;
}) {
  const W = cols * cell + pad * 2;
  const H = rows * cell + pad * 2;
  const px = (c: number) => pad + c * cell;
  const py = (r: number) => pad + r * cell;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="htp-svg"
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x={pad}
        y={pad}
        width={cols * cell}
        height={rows * cell}
        fill="rgba(255,255,255,0.03)"
        rx={4}
      />

      {goalRows.map((g, i) => (
        <rect
          key={`goal-${i}`}
          x={pad}
          y={py(g.row)}
          width={cols * cell}
          height={cell}
          fill={g.color}
          fillOpacity={0.14}
        />
      ))}

      {highlights.map((h, i) => (
        <rect
          key={`hl-${i}`}
          x={px(h.c)}
          y={py(h.r)}
          width={cell}
          height={cell}
          fill={h.fill}
          fillOpacity={h.opacity ?? 0.28}
        />
      ))}

      {Array.from({ length: rows + 1 }, (_, r) => (
        <line
          key={`gh-${r}`}
          x1={pad}
          y1={py(r)}
          x2={pad + cols * cell}
          y2={py(r)}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: cols + 1 }, (_, c) => (
        <line
          key={`gv-${c}`}
          x1={px(c)}
          y1={pad}
          x2={px(c)}
          y2={pad + rows * cell}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}

      {walls.map((w, i) =>
        w.orient === "h" ? (
          <line
            key={`w-${i}`}
            x1={px(w.c)}
            y1={py(w.r + 1)}
            x2={px(w.c + w.length)}
            y2={py(w.r + 1)}
            stroke="#ffd166"
            strokeWidth={4}
            strokeLinecap="round"
          />
        ) : (
          <line
            key={`w-${i}`}
            x1={px(w.c + 1)}
            y1={py(w.r)}
            x2={px(w.c + 1)}
            y2={py(w.r + w.length)}
            stroke="#ffd166"
            strokeWidth={4}
            strokeLinecap="round"
          />
        ),
      )}

      {crates.map((cr, i) => {
        const cx = px(cr.c) + cell / 2;
        const cy = py(cr.r) + cell / 2;
        const s = cell * 0.5;
        return (
          <g key={`cr-${i}`}>
            <rect
              x={cx - s / 2}
              y={cy - s / 2}
              width={s}
              height={s}
              rx={3}
              fill="#a78bfa"
              fillOpacity={0.9}
              stroke="#c4b5fd"
              strokeWidth={1}
            />
            <text
              x={cx}
              y={cy + 1}
              fontSize={cell * 0.36}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0a0c16"
              fontWeight={700}
            >
              ?
            </text>
          </g>
        );
      })}

      {pawns.map((p, i) => {
        const cx = px(p.c) + cell / 2;
        const cy = py(p.r) + cell / 2;
        const r = cell * 0.32;
        return (
          <g key={`p-${i}`}>
            {p.ring && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 3}
                fill="none"
                stroke={p.color}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={p.color}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
