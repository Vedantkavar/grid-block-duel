import { useState } from "react";
import {
  KILLER_COLORS,
  KILLER_MOVE_CAP_OPTIONS,
  KILLER_SIZE_OPTIONS,
  KillerColor,
  KillerGameConfig,
} from "../../game/killer/types";
import { PAWN_STYLES, PawnStyle } from "../../game/types";
import KillerPawn from "./KillerPawn";

const NAME_MAX = 14;

type Props = {
  onBack: () => void;
  onSubmit: (data: {
    name: string;
    style: PawnStyle;
    color: KillerColor;
    config: KillerGameConfig;
  }) => void;
  busy?: boolean;
};

export default function KillerCreateRoom({ onBack, onSubmit, busy }: Props) {
  const [name, setName] = useState("Player 1");
  const [style, setStyle] = useState<PawnStyle>("ghost");
  const [color, setColor] = useState<KillerColor>("blue");
  const [size, setSize] = useState<number>(11);
  const [moveCap, setMoveCap] = useState<number>(60);
  const [zonesEnabled, setZonesEnabled] = useState<boolean>(true);

  function submit() {
    const config: KillerGameConfig = {
      size,
      moveCap,
      zonesEnabled,
      // Placeholders; server rebuilds from slot occupants on start.
      players: [
        { name: name.trim() || "Player 1", style, color },
        { name: "Player 2", style: "round", color: "pink" },
        { name: "Player 3", style: "square", color: "teal" },
        { name: "Player 4", style: "diamond", color: "gold" },
      ],
    };
    onSubmit({ name: name.trim() || "Player 1", style, color, config });
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <h2>Create a killer room</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <h3>You (host)</h3>
        <div className="setup-player setup-player--killer-A">
          <div className="setup-player__head">
            <KillerPawn slot="A" style={style} color={color} size={48} onBoard={false} />
            <div className="setup-player__title">Slot A (host)</div>
          </div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player 1"
            />
          </label>
          <div className="field">
            <span className="field__label">Pawn style</span>
            <div className="style-grid">
              {PAWN_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`style-tile${style === s ? " style-tile--active" : ""}`}
                  onClick={() => setStyle(s)}
                  aria-label={`Style ${s}`}
                >
                  <KillerPawn slot="A" style={s} color={color} size={36} onBoard={false} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label">Color</span>
            <div className="color-grid">
              {KILLER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch color-swatch--${c}${color === c ? " color-swatch--active" : ""}`}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="setup__section">
        <h3>Game</h3>
        <div className="option-row">
          <div className="option-row__label">Grid size</div>
          <div className="option-row__chips">
            {KILLER_SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${size === s ? " chip--active" : ""}`}
                onClick={() => setSize(s)}
              >
                {s} × {s}
              </button>
            ))}
          </div>
        </div>
        <div className="option-row">
          <div className="option-row__label">Game length</div>
          <div className="stepper">
            <div className="stepper__value">
              <div className="stepper__number">{moveCap}</div>
              <div className="stepper__suffix">moves</div>
            </div>
            <div className="stepper__buttons">
              <button
                type="button"
                className="stepper__btn"
                onClick={() =>
                  setMoveCap((v) => Math.max(KILLER_MOVE_CAP_OPTIONS[0], v - 5))
                }
                disabled={moveCap <= KILLER_MOVE_CAP_OPTIONS[0]}
              >
                −
              </button>
              <button
                type="button"
                className="stepper__btn"
                onClick={() =>
                  setMoveCap((v) =>
                    Math.min(
                      KILLER_MOVE_CAP_OPTIONS[KILLER_MOVE_CAP_OPTIONS.length - 1],
                      v + 5,
                    ),
                  )
                }
                disabled={
                  moveCap >=
                  KILLER_MOVE_CAP_OPTIONS[KILLER_MOVE_CAP_OPTIONS.length - 1]
                }
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div className="option-row">
          <div className="option-row__label">Zones</div>
          <div className="option-row__chips">
            <button
              type="button"
              className={`chip${zonesEnabled ? " chip--active" : ""}`}
              onClick={() => setZonesEnabled(true)}
            >
              On
            </button>
            <button
              type="button"
              className={`chip${!zonesEnabled ? " chip--active" : ""}`}
              onClick={() => setZonesEnabled(false)}
            >
              Off
            </button>
          </div>
        </div>
      </section>

      <div className="setup__actions">
        <button
          className="btn btn--primary btn--lg"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Creating…" : "Create room →"}
        </button>
      </div>
    </div>
  );
}
