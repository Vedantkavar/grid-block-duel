import { useMemo, useState } from "react";
import {
  ABILITY_INFO,
  AbilityId,
  Coord,
  GameState,
  PawnStyle,
  PlayerId,
  Wall,
  WallLength,
  WallOrientation,
} from "../game/types";
import {
  dashFirstTargets,
  dashSecondTargets,
  legalDiagonalTargets,
  legalJumpWallTargets,
  legalMovesFor,
  trapWallTargets,
  validateWallPlacement,
} from "../game/rules";
import Pawn from "./Pawn";

type WallDraft = { orientation: WallOrientation; length: WallLength };

export type AbilityMode =
  | { kind: "none" }
  | { kind: "jumpWall"; slot: 0 | 1 }
  | { kind: "dash"; slot: 0 | 1; first: Coord | null }
  | { kind: "diagonalStep"; slot: 0 | 1 }
  | { kind: "breakWall"; slot: 0 | 1 }
  | { kind: "trapWall"; slot: 0 | 1 };

type Props = {
  state: GameState;
  mode: "move" | "wall";
  wallDraft: WallDraft;
  cell: number;
  gap: number;
  viewAs?: PlayerId;
  controllingPlayer?: PlayerId;
  abilityMode: AbilityMode;
  onMove: (to: Coord) => void;
  onPlaceWall: (wall: Omit<Wall, "owner">) => void;
  onAbilityCell: (cell: Coord) => void;
  onAbilityWall: (index: number) => void;
  onAbilityDashFirst: (cell: Coord) => void;
};

export default function Board({
  state,
  mode,
  wallDraft,
  cell,
  gap,
  viewAs = "A",
  controllingPlayer,
  abilityMode,
  onMove,
  onPlaceWall,
  onAbilityCell,
  onAbilityWall,
  onAbilityDashFirst,
}: Props) {
  const { size } = state;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const flip = viewAs === "B";

  const cellPx = (i: number) => i * (cell + gap);
  const totalPx = size * cell + (size - 1) * gap;

  const fr = (r: number) => (flip ? size - 1 - r : r);
  const fc = (c: number) => (flip ? size - 1 - c : c);

  const turnOwner = state.turn;
  const canControl = state.status === "playing" && turnOwner === (controllingPlayer ?? turnOwner);
  const inAbility = abilityMode.kind !== "none";

  // Ability target highlighting
  const abilityTargets = useMemo<Coord[]>(() => {
    if (!canControl) return [];
    switch (abilityMode.kind) {
      case "jumpWall":
        return legalJumpWallTargets(state, turnOwner);
      case "diagonalStep":
        return legalDiagonalTargets(state, turnOwner);
      case "dash":
        return abilityMode.first
          ? dashSecondTargets(state, turnOwner, abilityMode.first)
          : dashFirstTargets(state, turnOwner);
      case "trapWall":
        return trapWallTargets(state);
      default:
        return [];
    }
  }, [abilityMode, state, turnOwner, canControl]);

  const targetSet = useMemo(
    () => new Set(abilityTargets.map((p) => `${p.r}:${p.c}`)),
    [abilityTargets],
  );

  const legal = useMemo(
    () =>
      mode === "move" && canControl && !inAbility ? legalMovesFor(state, turnOwner) : [],
    [state, mode, canControl, inAbility, turnOwner],
  );

  const ghost = useMemo<Omit<Wall, "owner"> | null>(() => {
    if (mode !== "wall" || !hover || !canControl || inAbility) return null;
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
  }, [mode, hover, size, wallDraft, cell, gap, flip, canControl, inAbility]);

  const ghostValid = useMemo(() => {
    if (!ghost) return false;
    const v = validateWallPlacement(state, turnOwner, ghost);
    return v.ok;
  }, [ghost, state, turnOwner]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "wall" || inAbility) return;
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
    if (mode !== "wall" || inAbility) return;
    const p = pointFromTouch(e);
    if (p) setHover(p);
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (mode !== "wall" || inAbility) return;
    const p = pointFromTouch(e);
    if (p) setHover(p);
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (mode !== "wall" || inAbility) return;
    if (ghost && ghostValid) {
      e.preventDefault();
      onPlaceWall(ghost);
    }
  }

  function handleBoardClick() {
    if (mode === "wall" && !inAbility && ghost && ghostValid) onPlaceWall(ghost);
  }

  function handleCellClick(r: number, c: number) {
    if (!canControl) return;
    const pos = { r, c };
    if (inAbility) {
      const inSet = targetSet.has(`${r}:${c}`);
      if (!inSet) return;
      switch (abilityMode.kind) {
        case "jumpWall":
        case "diagonalStep":
        case "trapWall":
          onAbilityCell(pos);
          break;
        case "dash":
          if (abilityMode.first === null) {
            onAbilityDashFirst(pos);
          } else {
            onAbilityCell(pos);
          }
          break;
      }
      return;
    }
    if (mode === "move" && legal.some((m) => m.r === r && m.c === c)) {
      onMove(pos);
    }
  }

  function handleWallClick(idx: number) {
    if (!canControl) return;
    if (abilityMode.kind === "breakWall") {
      onAbilityWall(idx);
    }
  }

  function renderWall(w: Wall | (Omit<Wall, "owner"> & { owner?: PlayerId })) {
    return wallStyle(flip ? flipWall(w, size) : w, cell, gap);
  }

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push({ r, c });

  return (
    <div
      className={`board${inAbility ? " board--ability" : ""}`}
      style={{ width: totalPx, height: totalPx, touchAction: "none" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBoardClick}
    >
      {cells.map(({ r, c }) => {
        const isLegal = legal.some((m) => m.r === r && m.c === c);
        const isAbilityTarget = targetSet.has(`${r}:${c}`);
        const isFirst =
          abilityMode.kind === "dash" &&
          abilityMode.first &&
          abilityMode.first.r === r &&
          abilityMode.first.c === c;
        return (
          <div
            key={`cell-${r}-${c}`}
            className={`cell${isLegal ? " cell--legal" : ""}${
              isAbilityTarget ? " cell--ability-target" : ""
            }${isFirst ? " cell--ability-first" : ""}`}
            style={{
              left: cellPx(fc(c)),
              top: cellPx(fr(r)),
              width: cell,
              height: cell,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(r, c);
            }}
          />
        );
      })}

      <div
        className="goal-row goal-row--A"
        style={{ left: 0, top: flip ? totalPx - 4 : 0, width: totalPx, height: 4 }}
      />
      <div
        className="goal-row goal-row--B"
        style={{ left: 0, top: flip ? 0 : totalPx - 4, width: totalPx, height: 4 }}
      />

      {state.walls.map((w, i) => {
        const breakable = abilityMode.kind === "breakWall";
        return (
          <div
            key={`wall-${i}`}
            className={`wall wall--${w.owner}${breakable ? " wall--breakable" : ""}`}
            style={renderWall(w)}
            onClick={(e) => {
              if (!breakable) return;
              e.stopPropagation();
              handleWallClick(i);
            }}
          />
        );
      })}

      {ghost && (
        <div
          className={`wall wall--ghost ${ghostValid ? "wall--ghost-ok" : "wall--ghost-bad"}`}
          style={renderWall(ghost)}
        />
      )}

      {/* Loot boxes */}
      {state.lootBoxes.map((box, i) => (
        <LootBoxOnBoard
          key={`box-${i}-${box.pos.r}-${box.pos.c}`}
          pos={box.pos}
          ability={box.ability}
          cell={cell}
          gap={gap}
          flip={flip}
          size={size}
        />
      ))}

      {/* Traps */}
      {state.traps.map((t, i) => (
        <TrapOnBoard
          key={`trap-${i}`}
          pos={t.pos}
          owner={t.owner}
          turnsLeft={t.turnsLeft}
          hitsLeft={t.hitsLeft}
          cell={cell}
          gap={gap}
          flip={flip}
          size={size}
        />
      ))}

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
      style={{ left: cellPx(dc) + pad, top: cellPx(dr) + pad }}
    >
      <Pawn player={player} style={styleName} size={cell * 0.7} active={active} onBoard />
    </div>
  );
}

function LootBoxOnBoard({
  pos,
  ability,
  cell,
  gap,
  flip,
  size,
}: {
  pos: Coord;
  ability: AbilityId;
  cell: number;
  gap: number;
  flip: boolean;
  size: number;
}) {
  const cellPx = (i: number) => i * (cell + gap);
  const dr = flip ? size - 1 - pos.r : pos.r;
  const dc = flip ? size - 1 - pos.c : pos.c;
  const pad = cell * 0.16;
  const sz = cell - pad * 2;
  const info = ABILITY_INFO[ability];
  return (
    <div
      className={`lootbox lootbox--${info.category}`}
      style={{
        left: cellPx(dc) + pad,
        top: cellPx(dr) + pad,
        width: sz,
        height: sz,
        fontSize: Math.round(sz * 0.55),
      }}
      title={`${info.name} — ${info.desc}`}
    >
      <span className="lootbox__glyph">{abilityGlyph(ability)}</span>
    </div>
  );
}

function abilityGlyph(id: AbilityId): string {
  switch (id) {
    case "jumpWall":
      return "↟";
    case "dash":
      return "»";
    case "diagonalStep":
      return "⤢";
    case "breakWall":
      return "✕";
    case "trapWall":
      return "◈";
    case "scramble":
      return "≈";
  }
}

function TrapOnBoard({
  pos,
  owner,
  turnsLeft,
  hitsLeft,
  cell,
  gap,
  flip,
  size,
}: {
  pos: Coord;
  owner: "A" | "B";
  turnsLeft: number;
  hitsLeft: number;
  cell: number;
  gap: number;
  flip: boolean;
  size: number;
}) {
  const cellPx = (i: number) => i * (cell + gap);
  const dr = flip ? size - 1 - pos.r : pos.r;
  const dc = flip ? size - 1 - pos.c : pos.c;
  const pad = cell * 0.1;
  const sz = cell - pad * 2;
  // Pulse when on the brink (1 turn or 1 hit left).
  const nearBreak = turnsLeft <= 1 || hitsLeft <= 1;
  return (
    <div
      className={`trap trap--${owner}${nearBreak ? " trap--near-break" : ""}`}
      style={{ left: cellPx(dc) + pad, top: cellPx(dr) + pad, width: sz, height: sz }}
      title={`Trap — ${turnsLeft} turn(s) and ${hitsLeft} hit(s) left`}
    >
      <span className="trap__count">{turnsLeft}</span>
      <span className="trap__hits" aria-hidden>
        {Array.from({ length: hitsLeft }).map((_, i) => (
          <span key={i} className="trap__hit-dot" />
        ))}
      </span>
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
    const halfWidth = (draft.length * cell + (draft.length - 1) * gap) / 2;
    let cAnchor = Math.round((x - halfWidth) / step);
    cAnchor = Math.max(0, Math.min(size - draft.length, cAnchor));
    return { orientation: "h", r: bestR, c: cAnchor, length: draft.length };
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
  const halfHeight = (draft.length * cell + (draft.length - 1) * gap) / 2;
  let rAnchor = Math.round((y - halfHeight) / step);
  rAnchor = Math.max(0, Math.min(size - draft.length, rAnchor));
  return { orientation: "v", r: rAnchor, c: bestC, length: draft.length };
}

function flipWall<T extends Pick<Wall, "orientation" | "r" | "c" | "length">>(
  w: T,
  size: number,
): T {
  if (w.orientation === "h") {
    return { ...w, r: size - 2 - w.r, c: size - w.c - w.length };
  }
  return { ...w, r: size - w.r - w.length, c: size - 2 - w.c };
}

function unflipWall<T extends Pick<Wall, "orientation" | "r" | "c" | "length">>(
  w: T,
  size: number,
): T {
  return flipWall(w, size);
}
