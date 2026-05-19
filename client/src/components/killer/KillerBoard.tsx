import { useMemo, useRef, useState } from "react";
import {
  Coord,
  KillerGameState,
  KillerPlayerState,
  PlacedWall,
  PlacedZone,
  WallEdge,
  WallShape,
} from "../../game/killer/types";
import {
  activePlayer,
  edgesForShape,
  effectiveStepFor,
  getKiller,
  isInZoneKind,
  killStrikeRadius,
  reachableCells,
  validateWallPlacement,
} from "../../game/killer/rules";
import KillerPawn from "./KillerPawn";

type Props = {
  state: KillerGameState;
  cell: number;
  gap: number;
  killerStepHistory: Coord[];
  /** Wall placement mode: which shape the active Runner is about to drop. */
  wallShape: WallShape | null;
  /** Orientation for the in-progress wall (frame2 / frame3). */
  wallOrientation: "h" | "v";
  /** True when the Killer is choosing an edge to Supercharge break. */
  superchargeMode: boolean;
  onCellClick: (cell: Coord) => void;
  /** Place a stick wall (frame2/frame3) with anchor + orientation. */
  onPlaceWall: (anchor: Coord, orientation: "h" | "v") => void;
  /** Place an O-cage at this cell (must be the Killer's cell). */
  onPlaceCage: (cell: Coord) => void;
  /** Killer chose an edge to break with Supercharge. */
  onBreakEdge: (wallIndex: number, edgeIndex: number) => void;
  /** Killer clicked a Runner inside their kill radius. */
  onStrikeRunner: (target: import("../../game/killer/types").KillerPlayerId) => void;
  /**
   * In online mode, the local viewer's slot. Used to hide legal-move
   * highlights when it isn't your turn (so opponents can't see your
   * planned path).
   */
  localPlayer?: import("../../game/killer/types").KillerPlayerId;
};

export default function KillerBoard({
  state,
  cell,
  gap,
  killerStepHistory,
  wallShape,
  wallOrientation,
  superchargeMode,
  onCellClick,
  onPlaceWall,
  onPlaceCage,
  onBreakEdge,
  onStrikeRunner,
  localPlayer,
}: Props) {
  const { size } = state;
  const totalPx = size * cell + (size - 1) * gap;
  const cellPx = (i: number) => i * (cell + gap);

  const me = activePlayer(state);
  const killer = getKiller(state);
  const placingStick =
    wallShape === "frame2" || wallShape === "frame3";
  const placingCage = wallShape === "cage";

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const touchActiveRef = useRef(false);

  const radius = useMemo(() => killStrikeRadius(state), [state]);
  const radiusSet = useMemo(
    () => new Set(radius.map((c) => `${c.r}:${c.c}`)),
    [radius],
  );

  const killerInSnipe = useMemo(
    () => isInZoneKind(state, killer.pos, "snipe"),
    [state, killer.pos],
  );

  // Killer-only: Runner ids that are currently strikeable.
  //   - In snipe zone: every alive Runner anywhere.
  //   - Otherwise: Runners inside the strike radius.
  const strikeTargetSet = useMemo<Set<string>>(() => {
    if (me.role !== "killer" || state.status !== "playing") return new Set();
    if (wallShape || superchargeMode) return new Set();
    const out = new Set<string>();
    for (const p of state.players) {
      if (p.role !== "runner" || !p.alive) continue;
      if (killerInSnipe || radiusSet.has(`${p.pos.r}:${p.pos.c}`)) out.add(p.id);
    }
    return out;
  }, [state, me.role, wallShape, superchargeMode, radiusSet, killerInSnipe]);

  // Legal step cells (only when not in wall placement mode)
  const legal = useMemo<Coord[]>(() => {
    if (state.status !== "playing" || wallShape) return [];
    // Online: only show legal-move highlights to the active player on
    // their own device. Offline (localPlayer undefined): always show.
    if (localPlayer && me.role === "runner" && localPlayer !== me.id) {
      return [];
    }
    if (me.role === "killer") {
      const maxSteps = effectiveStepFor(state, me);
      const stepsTaken = killerStepHistory.length;
      const stepsRemaining = maxSteps - stepsTaken;
      if (stepsRemaining <= 0) return [];
      const from =
        killerStepHistory.length > 0
          ? killerStepHistory[killerStepHistory.length - 1]
          : me.pos;
      const tempState: KillerGameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === me.id ? { ...p, pos: from } : p,
        ),
      };
      return reachableCells(tempState, from, stepsRemaining, me.id);
    }
    const maxSteps = effectiveStepFor(state, me);
    const stepsTaken = killerStepHistory.length;
    const stepsRemaining = maxSteps - stepsTaken;
    if (stepsRemaining <= 0) return [];
    const from =
      killerStepHistory.length > 0
        ? killerStepHistory[killerStepHistory.length - 1]
        : me.pos;
    const tempState: KillerGameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === me.id ? { ...p, pos: from } : p,
      ),
    };
    return reachableCells(tempState, from, stepsRemaining, me.id);
  }, [state, me, killerStepHistory, wallShape]);

  const legalSet = useMemo(
    () => new Set(legal.map((c) => `${c.r}:${c.c}`)),
    [legal],
  );

  // Compute ghost wall (stick) from cursor position. Same algorithm as duel.
  const ghost = useMemo<{
    anchor: Coord;
    edges: WallEdge[];
    valid: boolean;
  } | null>(() => {
    if (!placingStick || !hover) return null;
    const length = wallShape === "frame2" ? 2 : 3;
    const draft = pointToWallAnchor(
      hover.x,
      hover.y,
      size,
      wallOrientation,
      length,
      cell,
      gap,
    );
    if (!draft) return null;
    const v = validateWallPlacement(state, me.id, wallShape!, draft, wallOrientation);
    return { anchor: draft, edges: edgesForShape(wallShape!, draft, wallOrientation), valid: v.ok };
  }, [placingStick, hover, wallShape, wallOrientation, size, cell, gap, state, me.id]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (touchActiveRef.current) return;
    if (isTouch) setIsTouch(false);
    if (!placingStick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function pointFromTouch(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchActiveRef.current = true;
    if (!isTouch) setIsTouch(true);
    if (!placingStick) return;
    const p = pointFromTouch(e);
    if (p) setHover(p);
  }
  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!placingStick) return;
    const p = pointFromTouch(e);
    if (p) setHover(p);
  }
  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    // Suppress the synthesized click that would auto-commit the wall.
    if (placingStick && ghost) {
      e.preventDefault();
    }
    setTimeout(() => {
      touchActiveRef.current = false;
    }, 350);
  }

  function handleBoardClick() {
    if (!placingStick) return;
    if (isTouch || touchActiveRef.current) return;
    if (ghost && ghost.valid) {
      onPlaceWall(ghost.anchor, wallOrientation);
    }
  }

  function confirmGhost() {
    if (!placingStick || !ghost || !ghost.valid) return;
    onPlaceWall(ghost.anchor, wallOrientation);
  }

  function cancelGhost() {
    setHover(null);
  }

  function handleCellClickInternal(r: number, c: number) {
    const k = `${r}:${c}`;
    if (placingCage) {
      // O-cage only valid on the Killer's cell.
      if (killer.pos.r === r && killer.pos.c === c) onPlaceCage({ r, c });
      return;
    }
    if (placingStick) {
      // Click handled at the board level via the ghost wall.
      return;
    }
    if (legalSet.has(k)) onCellClick({ r, c });
  }

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push({ r, c });

  return (
    <div
      className="board"
      style={{ width: totalPx, height: totalPx, touchAction: "none" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBoardClick}
    >
      {cells.map(({ r, c }) => {
        const k = `${r}:${c}`;
        const inRadius = radiusSet.has(k);
        const isLegal = legalSet.has(k);
        const isCageTarget =
          placingCage && killer.pos.r === r && killer.pos.c === c;
        return (
          <div
            key={k}
            className={[
              "cell",
              inRadius ? "cell--kill-radius" : "",
              isLegal ? "cell--legal" : "",
              isCageTarget ? "cell--wall-anchor" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: cellPx(c),
              top: cellPx(r),
              width: cell,
              height: cell,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleCellClickInternal(r, c);
            }}
          />
        );
      })}

      {/* Killer's planned step path */}
      {killerStepHistory.map((step, i) => (
        <div
          key={`step-${i}`}
          className="killer-step-marker"
          style={{
            left: cellPx(step.c) + cell * 0.35,
            top: cellPx(step.r) + cell * 0.35,
            width: cell * 0.3,
            height: cell * 0.3,
          }}
        >
          {i + 1}
        </div>
      ))}

      {/* Zones (rendered under walls and pawns) */}
      {state.zones.map((zone, i) => (
        <ZoneOverlay
          key={`zone-${i}`}
          zone={zone}
          roundCount={state.roundCount}
          moveCount={state.moveCount}
          cell={cell}
          gap={gap}
        />
      ))}

      {/* Placed walls */}
      {state.walls.map((w, i) => (
        <PlacedWallEdges
          key={`wall-${i}`}
          wall={w}
          wallIndex={i}
          cell={cell}
          gap={gap}
          breakable={superchargeMode}
          onBreakEdge={onBreakEdge}
        />
      ))}

      {/* Ghost stick wall preview */}
      {ghost &&
        ghost.edges.map((e, i) => (
          <div
            key={`ghost-${i}`}
            className={`killer-wall killer-wall--ghost killer-wall--${ghost.valid ? "ghost-ok" : "ghost-bad"}`}
            style={edgeStyle(e, cell, gap)}
          />
        ))}

      {isTouch && placingStick && ghost && (
        <div
          className="board__draft-actions"
          onMouseMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="board__draft-btn board__draft-btn--cancel"
            onClick={(e) => {
              e.stopPropagation();
              cancelGhost();
            }}
          >
            ✕ Cancel
          </button>
          <button
            type="button"
            className="board__draft-btn board__draft-btn--confirm"
            disabled={!ghost.valid}
            onClick={(e) => {
              e.stopPropagation();
              confirmGhost();
            }}
          >
            ✓ Place wall
          </button>
        </div>
      )}

      {/* Pawns */}
      {state.players.map((p) => (
        <PawnOnBoard
          key={p.id}
          player={p}
          isActive={p.id === me.id && state.status === "playing"}
          strikeable={strikeTargetSet.has(p.id)}
          cell={cell}
          gap={gap}
          onStrike={() => onStrikeRunner(p.id)}
        />
      ))}
    </div>
  );
}

function PlacedWallEdges({
  wall,
  wallIndex,
  cell,
  gap,
  breakable,
  onBreakEdge,
}: {
  wall: PlacedWall;
  wallIndex: number;
  cell: number;
  gap: number;
  breakable: boolean;
  onBreakEdge: (wallIndex: number, edgeIndex: number) => void;
}) {
  return (
    <>
      {wall.edges.map((e, i) => (
        <div
          key={i}
          className={`killer-wall killer-wall--${wall.shape}${breakable ? " killer-wall--breakable" : ""}`}
          style={{
            ...edgeStyle(e, cell, gap),
            pointerEvents: breakable ? "auto" : "none",
            cursor: breakable ? "pointer" : undefined,
          }}
          onClick={(ev) => {
            if (!breakable) return;
            ev.stopPropagation();
            onBreakEdge(wallIndex, i);
          }}
        />
      ))}
    </>
  );
}

function edgeStyle(e: WallEdge, cell: number, gap: number): React.CSSProperties {
  const cellPx = (i: number) => i * (cell + gap);
  if (e.orientation === "h") {
    return {
      left: cellPx(e.c),
      top: cellPx(e.r) + cell,
      width: cell,
      height: gap,
    };
  }
  return {
    left: cellPx(e.c) + cell,
    top: cellPx(e.r),
    width: gap,
    height: cell,
  };
}

function PawnOnBoard({
  player,
  isActive,
  strikeable,
  cell,
  gap,
  onStrike,
}: {
  player: KillerPlayerState;
  isActive: boolean;
  strikeable: boolean;
  cell: number;
  gap: number;
  onStrike: () => void;
}) {
  const cellPx = (i: number) => i * (cell + gap);
  const pad = cell * 0.15;
  const cls = [
    "pawn-slot",
    !player.alive ? "pawn-slot--dead" : "",
    strikeable ? "pawn-slot--strikeable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      style={{
        left: cellPx(player.pos.c) + pad,
        top: cellPx(player.pos.r) + pad,
        pointerEvents: strikeable ? "auto" : "none",
        cursor: strikeable ? "crosshair" : undefined,
      }}
      onClick={(e) => {
        if (!strikeable) return;
        e.stopPropagation();
        onStrike();
      }}
    >
      <KillerPawn
        slot={player.id}
        style={player.style}
        color={player.color}
        size={cell * 0.7}
        killer={player.role === "killer"}
        active={isActive && player.alive}
      />
    </div>
  );
}

/**
 * Convert pointer (x, y) inside the board to the closest valid wall anchor,
 * exactly like the 2-player game.
 *
 * For "h" walls: snap to the gap-row between rows r and r+1, then center the
 * stick on the cursor's column.
 * For "v" walls: snap to the gap-column between cols c and c+1, then center
 * vertically.
 */
function pointToWallAnchor(
  x: number,
  y: number,
  size: number,
  orientation: "h" | "v",
  length: number,
  cell: number,
  gap: number,
): Coord | null {
  const step = cell + gap;
  if (orientation === "h") {
    let bestR = 0;
    let bestDist = Infinity;
    for (let r = 0; r < size - 1; r++) {
      const center = r * step + cell + gap / 2;
      const d = Math.abs(y - center);
      if (d < bestDist) {
        bestDist = d;
        bestR = r;
      }
    }
    const halfWidth = (length * cell + (length - 1) * gap) / 2;
    let cAnchor = Math.round((x - halfWidth) / step);
    cAnchor = Math.max(0, Math.min(size - length, cAnchor));
    return { r: bestR, c: cAnchor };
  }
  let bestC = 0;
  let bestDist = Infinity;
  for (let c = 0; c < size - 1; c++) {
    const center = c * step + cell + gap / 2;
    const d = Math.abs(x - center);
    if (d < bestDist) {
      bestDist = d;
      bestC = c;
    }
  }
  const halfHeight = (length * cell + (length - 1) * gap) / 2;
  let rAnchor = Math.round((y - halfHeight) / step);
  rAnchor = Math.max(0, Math.min(size - length, rAnchor));
  return { r: rAnchor, c: bestC };
}

function ZoneOverlay({
  zone,
  roundCount,
  moveCount,
  cell,
  gap,
}: {
  zone: PlacedZone;
  roundCount: number;
  moveCount: number;
  cell: number;
  gap: number;
}) {
  const cellPx = (i: number) => i * (cell + gap);
  const left = cellPx(zone.anchor.c);
  const top = cellPx(zone.anchor.r);
  const w = zone.size * cell + (zone.size - 1) * gap;
  const h = w;
  const remaining = Math.max(0, zone.expiresOnRound - roundCount);
  // Show the name + rounds badge only on the Move the zone spawned in.
  // After that, only the colored tint remains visible.
  const showLabel = moveCount <= zone.spawnedOnMove;
  return (
    <div
      className={`zone zone--${zone.kind}`}
      style={{ left, top, width: w, height: h }}
    >
      {showLabel && (
        <div className="zone__label">
          <span className="zone__name">{zone.kind}</span>
          <span className="zone__rounds">{remaining}r</span>
        </div>
      )}
      <div className="zone__center">{remaining}</div>
    </div>
  );
}
