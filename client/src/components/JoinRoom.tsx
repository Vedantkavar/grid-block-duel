import { useState } from "react";
import { PAWN_STYLES, PawnStyle } from "../game/types";
import Pawn from "./Pawn";

const NAME_MAX = 14;

type Props = {
  onBack: () => void;
  onSubmit: (data: { roomId: string; name: string; style: PawnStyle }) => void;
  busy?: boolean;
  error?: string | null;
  prefillRoomId?: string;
};

export default function JoinRoom({ onBack, onSubmit, busy, error, prefillRoomId }: Props) {
  const [roomId, setRoomId] = useState(prefillRoomId ?? "");
  const [name, setName] = useState("Pink");
  const [style, setStyle] = useState<PawnStyle>("round");

  function submit() {
    const code = roomId.trim().toUpperCase();
    if (code.length === 0) return;
    onSubmit({ roomId: code, name: name.trim() || "Pink", style });
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <h2>Join a room</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <h3>Room code</h3>
        <input
          className="field__input field__input--code"
          maxLength={5}
          value={roomId}
          autoFocus
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          placeholder="ABCDE"
        />
      </section>

      <section className="setup__section">
        <h3>You</h3>
        <div className="setup-player setup-player--B">
          <div className="setup-player__head">
            <Pawn player="B" style={style} size={56} onBoard={false} />
            <div className="setup-player__title">Player 2</div>
          </div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pink"
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
                  <Pawn player="B" style={s} size={42} onBoard={false} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <div className="setup__actions">
        <button
          className="btn btn--primary btn--lg"
          disabled={busy || roomId.trim().length === 0}
          onClick={submit}
        >
          {busy ? "Joining…" : "Join →"}
        </button>
      </div>
    </div>
  );
}
