import { useState } from "react";
import { PAWN_STYLES, PawnStyle } from "../../game/types";
import { KILLER_COLORS, KillerColor } from "../../game/killer/types";
import KillerPawn from "./KillerPawn";

const NAME_MAX = 14;

type Props = {
  onBack: () => void;
  onSubmit: (data: {
    roomId: string;
    name: string;
    style: PawnStyle;
    color: KillerColor;
  }) => void;
  busy?: boolean;
};

export default function KillerJoinRoom({ onBack, onSubmit, busy }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("Player");
  const [style, setStyle] = useState<PawnStyle>("round");
  const [color, setColor] = useState<KillerColor>("pink");

  function submit() {
    const roomId = code.trim().toUpperCase();
    if (roomId.length !== 5) return;
    onSubmit({ roomId, name: name.trim() || "Player", style, color });
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <h2>Join a killer room</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <label className="field">
          <span className="field__label">Room code</span>
          <input
            className="field__input code-input"
            maxLength={5}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDE"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      </section>

      <section className="setup__section">
        <h3>You</h3>
        <div className="setup-player setup-player--killer-B">
          <div className="setup-player__head">
            <KillerPawn slot="B" style={style} color={color} size={48} onBoard={false} />
            <div className="setup-player__title">Your pawn</div>
          </div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player"
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
                  <KillerPawn slot="B" style={s} color={color} size={36} onBoard={false} />
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

      <div className="setup__actions">
        <button
          className="btn btn--primary btn--lg"
          disabled={busy || code.trim().length !== 5}
          onClick={submit}
        >
          {busy ? "Joining…" : "Join →"}
        </button>
      </div>
    </div>
  );
}
