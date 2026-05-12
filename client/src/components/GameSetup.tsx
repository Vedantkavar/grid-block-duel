import { useState } from "react";
import {
  GameConfig,
  PAWN_STYLES,
  PawnStyle,
  PlayerId,
  SIZE_OPTIONS,
  WALL2_OPTIONS,
  WALL3_OPTIONS,
} from "../game/types";
import Pawn from "./Pawn";

type Props = {
  initial: GameConfig;
  onBack: () => void;
  onStart: (config: GameConfig) => void;
};

const NAME_MAX = 14;

export default function GameSetup({ initial, onBack, onStart }: Props) {
  const [config, setConfig] = useState<GameConfig>(initial);

  function setPlayer(id: PlayerId, patch: Partial<GameConfig["players"]["A"]>) {
    setConfig((c) => ({
      ...c,
      players: { ...c.players, [id]: { ...c.players[id], ...patch } },
    }));
  }

  function setSize(size: number) {
    setConfig((c) => ({ ...c, size }));
  }

  function setLen2(n: number) {
    setConfig((c) => ({ ...c, walls: { ...c.walls, len2: n } }));
  }

  function setLen3(n: number) {
    setConfig((c) => ({ ...c, walls: { ...c.walls, len3: n } }));
  }

  function start() {
    const safe: GameConfig = {
      ...config,
      players: {
        A: {
          ...config.players.A,
          name: config.players.A.name.trim() || "Blue",
        },
        B: {
          ...config.players.B,
          name: config.players.B.name.trim() || "Pink",
        },
      },
    };
    onStart(safe);
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Game setup</h2>
        <span style={{ width: 60 }} /> {/* spacer for symmetry */}
      </div>

      <section className="setup__section">
        <h3>Players</h3>
        <div className="setup__players">
          <PlayerCard
            id="A"
            label="Player 1"
            name={config.players.A.name}
            style={config.players.A.style}
            onName={(name) => setPlayer("A", { name })}
            onStyle={(style) => setPlayer("A", { style })}
          />
          <PlayerCard
            id="B"
            label="Player 2"
            name={config.players.B.name}
            style={config.players.B.style}
            onName={(name) => setPlayer("B", { name })}
            onStyle={(style) => setPlayer("B", { style })}
          />
        </div>
      </section>

      <section className="setup__section">
        <h3>Board</h3>
        <OptionRow
          label="Grid size"
          options={SIZE_OPTIONS.map((s) => ({ value: s, label: `${s} × ${s}` }))}
          value={config.size}
          onChange={setSize}
        />
      </section>

      <section className="setup__section">
        <h3>Walls per player</h3>
        <OptionRow
          label="Length-2 walls"
          options={WALL2_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={config.walls.len2}
          onChange={setLen2}
        />
        <OptionRow
          label="Length-3 walls"
          options={WALL3_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={config.walls.len3}
          onChange={setLen3}
        />
        <div className="option-row">
          <div className="option-row__label">Abilities</div>
          <div className="option-row__chips">
            <button
              type="button"
              className={`chip${config.abilitiesEnabled ? " chip--active" : ""}`}
              onClick={() => setConfig((c) => ({ ...c, abilitiesEnabled: true }))}
            >
              On
            </button>
            <button
              type="button"
              className={`chip${!config.abilitiesEnabled ? " chip--active" : ""}`}
              onClick={() => setConfig((c) => ({ ...c, abilitiesEnabled: false }))}
            >
              Off
            </button>
          </div>
        </div>
      </section>

      <div className="setup__actions">
        <button className="btn btn--primary btn--lg" onClick={start}>
          Start game →
        </button>
      </div>
    </div>
  );
}

function PlayerCard({
  id,
  label,
  name,
  style,
  onName,
  onStyle,
}: {
  id: PlayerId;
  label: string;
  name: string;
  style: PawnStyle;
  onName: (name: string) => void;
  onStyle: (style: PawnStyle) => void;
}) {
  return (
    <div className={`setup-player setup-player--${id}`}>
      <div className="setup-player__head">
        <Pawn player={id} style={style} size={56} onBoard={false} />
        <div className="setup-player__title">{label}</div>
      </div>

      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="field__input"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={id === "A" ? "Blue" : "Pink"}
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
              onClick={() => onStyle(s)}
              aria-label={`Style ${s}`}
            >
              <Pawn player={id} style={s} size={42} onBoard={false} />
            </button>
          ))}
        </div>
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
