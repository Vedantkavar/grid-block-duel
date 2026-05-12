import { useState } from "react";
import {
  GameConfig,
  PAWN_STYLES,
  PawnStyle,
  SIZE_OPTIONS,
  WALL2_OPTIONS,
  WALL3_OPTIONS,
} from "../game/types";
import Pawn from "./Pawn";

const NAME_MAX = 14;

type Props = {
  onBack: () => void;
  onSubmit: (data: { name: string; style: PawnStyle; config: GameConfig }) => void;
  busy?: boolean;
};

export default function CreateRoom({ onBack, onSubmit, busy }: Props) {
  const [name, setName] = useState("Blue");
  const [style, setStyle] = useState<PawnStyle>("ghost");
  const [size, setSize] = useState<number>(9);
  const [len2, setLen2] = useState<number>(4);
  const [len3, setLen3] = useState<number>(2);
  const [abilitiesEnabled, setAbilitiesEnabled] = useState<boolean>(true);

  function submit() {
    const config: GameConfig = {
      size,
      walls: { len2, len3 },
      abilitiesEnabled,
      // The B side gets overwritten on the server when someone joins.
      players: {
        A: { name: name.trim() || "Blue", style },
        B: { name: "Friend", style: "round" },
      },
    };
    onSubmit({ name: name.trim() || "Blue", style, config });
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <h2>Create a room</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <h3>You</h3>
        <div className="setup-player setup-player--A">
          <div className="setup-player__head">
            <Pawn player="A" style={style} size={56} onBoard={false} />
            <div className="setup-player__title">Player 1 (host)</div>
          </div>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Blue"
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
                  <Pawn player="A" style={s} size={42} onBoard={false} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="setup__section">
        <h3>Board</h3>
        <OptionRow
          label="Grid size"
          options={SIZE_OPTIONS.map((s) => ({ value: s, label: `${s} × ${s}` }))}
          value={size}
          onChange={setSize}
        />
      </section>

      <section className="setup__section">
        <h3>Walls per player</h3>
        <OptionRow
          label="Length-2 walls"
          options={WALL2_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={len2}
          onChange={setLen2}
        />
        <OptionRow
          label="Length-3 walls"
          options={WALL3_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={len3}
          onChange={setLen3}
        />
        <div className="option-row">
          <div className="option-row__label">Abilities</div>
          <div className="option-row__chips">
            <button
              type="button"
              className={`chip${abilitiesEnabled ? " chip--active" : ""}`}
              onClick={() => setAbilitiesEnabled(true)}
            >
              On
            </button>
            <button
              type="button"
              className={`chip${!abilitiesEnabled ? " chip--active" : ""}`}
              onClick={() => setAbilitiesEnabled(false)}
            >
              Off
            </button>
          </div>
        </div>
      </section>

      <div className="setup__actions">
        <button className="btn btn--primary btn--lg" disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Create room →"}
        </button>
      </div>
    </div>
  );
}

function OptionRow<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="option-row">
      <div className="option-row__label">{label}</div>
      <div className="option-row__chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip${value === o.value ? " chip--active" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
