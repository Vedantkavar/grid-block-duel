import { useMemo, useState } from "react";
import {
  Coord,
  GameState,
  PawnStyle,
  PlayerId,
  Wall,
  WallLength,
  WallOrientation,
} from "../game/types";
import { legalMovesFor, validateWallPlacement } from "../game/rules";
import Pawn from "./Pawn";

type WallDraft = { orientation: WallOrientation; length: WallLength };

type Props = {
  state: GameState;
  mode: "move" | "wall";
  wallDraft: WallDraft;
  cell: number;
  gap: number;
  /**
   * Whose perspective the board is rendered from. The player set here
   * appears at the bottom; the opponent at the top.
   */
  viewAs?: PlayerId;
  /**
   * The player this client is allowed to control. Defaults to state.turn
   * (i.e. local hot-seat). For online play, set to "A" or "B".
   */
  controllingPlayer?: PlayerId;
  onMove: (to: Coord) => void;
  onPlaceWall: (wall: Omit<Wall, "owner">) => void;
};

export default function Board({
  state,
  mode,
  wallDraft,
  cell,
  gap,
  viewAs = "A",
  controllingPlayer,
  onMove,
  onPlaceWall,
}: Props) {
  const { size } = state;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const flip = viewAs === "B";

  const cellPx = (i: number) => i * (cell + gap);
  const totalPx = size * cell + (size - 1) * gap;

  const fr = (r: number) => (flip ? size - 1 - r : r);
  const fc = (c: number) => (flip ? size - 1 - c : c);

  const canControl =
    state.status === "playing" &&
    state.turn === (controllingPlayer ?? state.turn);

  const legal = useMemo(
    () =>
      mode === "move" && canControl
        ? legalMovesFor(state, state.turn)
        : [],
    [state, mode, canControl],
  );

  // For wall preview: take pointer position in displayed coords, convert to
  // an actual board wall, validate, draw.
  const ghost = useMemo<Omit<Wall, "owner"> | null>(() => {
    if (mode !== "wall" || !hover || !canControl) return null;

    const draftDisplay = pointToWallAnchorDisplay(
      hover.x,
      hover.y,
      size,
      wallDraft,
      cell,
      gap,
    );

    if (!draftDisplay) return null;

    return flip ? unflipWall(draftDisplay, size) : draftDisplay;
  }, [mode, hover, size, wallDraft, cell, gap, flip, canControl]);

  const ghostValid = useMemo(() => {
    if (!ghost) return false;

    const v = validateWallPlacement(state, state.turn, ghost);

    return v.ok;
  }, [ghost, state]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "wall") return;

    const rect = e.currentTarget.getBoundingClientRect();

    setHover({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function pointFromTouch(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0] ?? e.changedTouches[0];

    if (!t) return null;

    const rect = e.currentTarget.getBoundingClientRect();

    return {
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
    };
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (mode !== "wall") return;

    const p = pointFromTouch(e);

    if (p) setHover(p);
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (mode !== "wall") return;

    const p = pointFromTouch(e);

    if (p) setHover(p);
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (mode !== "wall") return;

    if (ghost && ghostValid) {
      // Prevent the synthetic click that follows touchend so we don't
      // double-place / interact with cells underneath.
      e.preventDefault();

      onPlaceWall(ghost);
    }

    // Keep hover for a moment so the user sees what they placed; the next
    // mouseleave/mousemove resets it.
  }

  function handleBoardClick() {
    if (mode === "wall" && ghost && ghostValid) {
      onPlaceWall(ghost);
    }
  }

  // Render walls in display coords (flip if needed)
  function renderWall(
    w: Wall | (Omit<Wall, "owner"> & { owner?: PlayerId }),
  ) {
    return wallStyle(flip ? flipWall(w, size) : w, cell, gap);
  }

  const cells: { r: number; c: number }[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells.push({ r, c });
    }
  }

  return (
    <div
      className="board"
      style={{ width: totalPx, height: totalPx }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBoardClick}
    >
      {cells.map(({ r, c }) => {
        const isLegal = legal.some((m) => m.r === r && m.c === c);

        return (
          <div
            key={`cell-${r}-${c}`}
            className={`cell${isLegal ? " cell--legal" : ""}`}
            style={{
              left: cellPx(fc(c)),
              top: cellPx(fr(r)),
              width: cell,
              height: cell,
            }}
            onClick={(e) => {
              e.stopPropagation();

              if (mode === "move" && isLegal) {
                onMove({ r, c });
              }
            }}
          />
        );
      })}

      {/*
        Goal lines mark the OUTER edge of each player's goal row.
        Player A's goal is row 0 (top of the actual board).
        Player B's goal is row size-1 (bottom of the actual board).
        When the view is flipped, those edges swap.
      */}

      <div
        className="goal-row goal-row--A"
        style={{
          left: 0,
          top: flip ? totalPx - 4 : 0,
          width: totalPx,
          height: 4,
        }}
      />

      <div
        className="goal-row goal-row--B"
        style={{
          left: 0,
          top: flip ? 0 : totalPx - 4,
          width: totalPx,
          height: 4,
        }}
      />

      {state.walls.map((w, i) => (
        <div
          key={`wall-${i}`}
          className={`wall wall--${w.owner}`}
          style={renderWall(w)}
        />
      ))}

      {ghost && (
        <div
          className={`wall wall--ghost ${
            ghostValid ? "wall--ghost-ok" : "wall--ghost-bad"
          }`}
          style={renderWall(ghost)}
        />
      )}

      <PawnOnBoard
        player="A"
        cell={cell}
        gap={gap}
        pos={state.players.A.pos}
        styleName={state.players.A.style}
        active={state.turn === "A" && state.status === "playing"}
        winner={state.status === "finished" && state.winner === "A"}
        flip={flip}
        size={size}
      />

      <PawnOnBoard
        player="B"
        cell={cell}
        gap={gap}
        pos={state.players.B.pos}
        styleName={state.players.B.style}
        active={state.turn === "B" && state.status === "playing"}
        winner={state.status === "finished" && state.winner === "B"}
        flip={flip}
        size={size}
      />
    </div>
  );
}

function PawnOnBoard({
  player,
  pos,
  styleName,
  active,
  winner,
  cell,
  gap,
  flip,
  size,
}: {
  player: "A" | "B";
  pos: Coord;
  styleName: PawnStyle;
  active: boolean;
  winner: boolean;
  cell: number;
  gap: number;
  flip: boolean;
  size: number;
}) {
  const cellPx = (i: number) => i * (cell + gap);

  const pad = cell * 0.15;

  const dr = flip ? size - 1 - pos.r : pos.r;
  const dc = flip ? size - 1 - pos.c : pos.c;

  return (
    <div
      className={`pawn-slot${winner ? " pawn-slot--winner" : ""}`}
      style={{
        left: cellPx(dc) + pad,
        top: cellPx(dr) + pad,
      }}
    >
      <Pawn
        player={player}
        style={styleName}
        size={cell * 0.7}
        active={active}
        onBoard
      />
    </div>
  );
}

function wallStyle(
  w: Pick<Wall, "orientation" | "r" | "c" | "length">,
  cell: number,
  gap: number,
): React.CSSProperties {
  const cellPx = (i: number) => i * (cell + gap);

  if (w.orientation === "h") {
    return {
      left: cellPx(w.c),
      top: cellPx(w.r) + cell,
      width: w.length * cell + (w.length - 1) * gap,
      height: gap,
    };
  }

  return {
    left: cellPx(w.c) + cell,
    top: cellPx(w.r),
    width: gap,
    height: w.length * cell + (w.length - 1) * gap,
  };
}

/**
 * Convert pointer (x,y) inside the board to the closest valid wall anchor
 * — in display coordinates (these may be flipped vs actual board).
 */
function pointToWallAnchorDisplay(
  x: number,
  y: number,
  size: number,
  draft: WallDraft,
  cell: number,
  gap: number,
): Omit<Wall, "owner"> | null {
  const step = cell + gap;

  if (draft.orientation === "h") {
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

    const halfWidth =
      (draft.length * cell + (draft.length - 1) * gap) / 2;

    let cAnchor = Math.round((x - halfWidth) / step);

    cAnchor = Math.max(
      0,
      Math.min(size - draft.length, cAnchor),
    );

    return {
      orientation: "h",
      r: bestR,
      c: cAnchor,
      length: draft.length,
    };
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

  const halfHeight =
    (draft.length * cell + (draft.length - 1) * gap) / 2;

  let rAnchor = Math.round((y - halfHeight) / step);

  rAnchor = Math.max(
    0,
    Math.min(size - draft.length, rAnchor),
  );

  return {
    orientation: "v",
    r: rAnchor,
    c: bestC,
    length: draft.length,
  };
}

/**
 * Flip a wall between actual board coords and display coords.
 * Both directions use the same transform (180° rotation).
 *
 * Horizontal wall (r, c, len): the cut is between rows r and r+1, covering
 * columns c..c+len-1. After 180°, the cut is between rows (size-2-r) and
 * (size-1-r), at columns (size-c-len)..(size-1-c). So r' = size-2-r,
 * c' = size-c-len.
 *
 * Vertical wall (r, c, len): cut between cols c and c+1, rows r..r+len-1.
 * After 180°: r' = size-r-len, c' = size-2-c.
 */
function flipWall<
  T extends Pick<Wall, "orientation" | "r" | "c" | "length">
>(w: T, size: number): T {
  if (w.orientation === "h") {
    return {
      ...w,
      r: size - 2 - w.r,
      c: size - w.c - w.length,
    };
  }

  return {
    ...w,
    r: size - w.r - w.length,
    c: size - 2 - w.c,
  };
}

function unflipWall<
  T extends Pick<Wall, "orientation" | "r" | "c" | "length">
>(w: T, size: number): T {
  // The transform is its own inverse.
  return flipWall(w, size);
}