import { PawnStyle } from "../../game/types";
import {
  DEFAULT_COLOR_BY_SLOT,
  KILLER_COLOR_HEX,
  KillerColor,
} from "../../game/killer/types";

export type KillerSlot = "A" | "B" | "C" | "D";

type Props = {
  slot: KillerSlot;
  style: PawnStyle;
  /** Player-chosen color. Falls back to the slot's default if omitted. */
  color?: KillerColor;
  /** True if this pawn is the Killer (red glow). */
  killer?: boolean;
  /** True if it's their Move right now. */
  active?: boolean;
  size: number; // px
  onBoard?: boolean; // adds the on-board glow
};

export default function KillerPawn({
  slot,
  style,
  color,
  killer = false,
  active = false,
  size,
  onBoard = true,
}: Props) {
  const effectiveColor: KillerColor = color ?? DEFAULT_COLOR_BY_SLOT[slot];
  const hex = killer ? "#ef4444" : KILLER_COLOR_HEX[effectiveColor];
  const cls = [
    "pawn",
    `pawn--${style}`,
    onBoard ? "pawn--onboard" : "pawn--display",
    killer ? "pawn--killer" : "",
    active ? "pawn--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={{
        width: size,
        height: size,
        background: hex,
        boxShadow: onBoard
          ? `0 4px 12px ${hexAlpha(hex, 0.45)}`
          : undefined,
      }}
    >
      <Face style={style} />
    </div>
  );
}

function Face({ style }: { style: PawnStyle }) {
  if (style === "diamond") {
    return (
      <div className="pawn__face pawn__face--diamond">
        <Eyes />
      </div>
    );
  }
  return (
    <div className="pawn__face">
      <Eyes />
    </div>
  );
}

function Eyes() {
  return (
    <div className="pawn__eyes">
      <span className="pawn__eye" />
      <span className="pawn__eye" />
    </div>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return hex;
  const [r, g, b] = [
    parseInt(m[1].slice(0, 2), 16),
    parseInt(m[1].slice(2, 4), 16),
    parseInt(m[1].slice(4, 6), 16),
  ];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
