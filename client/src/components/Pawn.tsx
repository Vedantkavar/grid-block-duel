import { PawnStyle, PlayerId } from "../game/types";

type Props = {
  player: PlayerId;
  style: PawnStyle;
  size: number; // pixel size of the pawn (square)
  active?: boolean;
  onBoard?: boolean; // adds drop shadow on board
};

/**
 * Visual pawn. Used both on the board and in the setup picker.
 * Color is fixed by `player` (A = blue, B = pink); shape is `style`.
 */
export default function Pawn({ player, style, size, active, onBoard = true }: Props) {
  const cls = [
    "pawn",
    `pawn--${player}`,
    `pawn--${style}`,
    active ? "pawn--active" : "",
    onBoard ? "pawn--onboard" : "pawn--display",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={{ width: size, height: size }}>
      <PawnFace style={style} />
    </div>
  );
}

function PawnFace({ style }: { style: PawnStyle }) {
  // Most styles share an "eyes" face. Diamond rotates the body, so eyes rotate back.
  if (style === "diamond") {
    return (
      <div className="pawn__face pawn__face--diamond">
        <div className="pawn__eyes">
          <span className="pawn__eye" />
          <span className="pawn__eye" />
        </div>
      </div>
    );
  }
  return (
    <div className="pawn__face">
      <div className="pawn__eyes">
        <span className="pawn__eye" />
        <span className="pawn__eye" />
      </div>
    </div>
  );
}
