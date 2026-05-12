import { useState } from "react";
import {
  KILLER_COLORS,
  KILLER_MOVE_CAP_OPTIONS,
  KILLER_SIZE_OPTIONS,
  KillerColor,
  KillerGameConfig,
  KillerPlayerConfig,
} from "../../game/killer/types";
import { PAWN_STYLES, PawnStyle } from "../../game/types";
import KillerPawn from "./KillerPawn";

type Props = {
  initial: KillerGameConfig;
  onBack: () => void;
  onStart: (config: KillerGameConfig) => void;
};

const NAME_MAX = 14;
const SLOT_IDS = ["A", "B", "C", "D"] as const;

export default function KillerSetup({ initial, onBack, onStart }: Props) {
  const [config, setConfig] = useState<KillerGameConfig>(initial);

  function setPlayer(idx: number, patch: Partial<KillerPlayerConfig>) {
    setConfig((c) => ({
      ...c,
      players: c.players.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }

  function setSize(size: number) {
    setConfig((c) => ({ ...c, size }));
  }

  function setMoveCap(moveCap: number) {
    setConfig((c) => ({ ...c, moveCap }));
  }

  function setZonesEnabled(zonesEnabled: boolean) {
    setConfig((c) => ({ ...c, zonesEnabled }));
  }

  function start() {
    const safe: KillerGameConfig = {
      ...config,
      players: config.players.map((p, i) => ({
        ...p,
        name: p.name.trim() || `Player ${i + 1}`,
      })),
    };
    onStart(safe);
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Killer mode setup</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <h3>Players</h3>
        <p className="endcard__sub" style={{ margin: 0 }}>
          The Killer is picked at random when the game starts. The other three
          play as Runners on the same team.
        </p>
        <div className="killer-players">
          {config.players.map((p, idx) => (
            <KillerPlayerCard
              key={idx}
              slot={SLOT_IDS[idx]}
              label={`Player ${idx + 1}`}
              name={p.name}
              style={p.style}
              color={p.color}
              onName={(name) => setPlayer(idx, { name })}
              onStyle={(style) => setPlayer(idx, { style })}
              onColor={(color) => setPlayer(idx, { color })}
            />
          ))}
        </div>
      </section>

      <section className="setup__section">
        <h3>Board</h3>
        <OptionRow
          label="Grid size"
          options={KILLER_SIZE_OPTIONS.map((s) => ({ value: s, label: `${s} × ${s}` }))}
          value={config.size}
          onChange={setSize}
        />
        <Stepper
          label="Game length"
          value={config.moveCap}
          min={KILLER_MOVE_CAP_OPTIONS[0]}
          max={KILLER_MOVE_CAP_OPTIONS[KILLER_MOVE_CAP_OPTIONS.length - 1]}
          step={5}
          suffix="moves"
          onChange={setMoveCap}
        />
        <div className="option-row">
          <div className="option-row__label">Zones</div>
          <div className="option-row__chips">
            <button
              type="button"
              className={`chip${config.zonesEnabled ? " chip--active" : ""}`}
              onClick={() => setZonesEnabled(true)}
            >
              On
            </button>
            <button
              type="button"
              className={`chip${!config.zonesEnabled ? " chip--active" : ""}`}
              onClick={() => setZonesEnabled(false)}
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

function KillerPlayerCard({
  slot,
  label,
  name,
  style,
  color,
  onName,
  onStyle,
  onColor,
}: {
  slot: "A" | "B" | "C" | "D";
  label: string;
  name: string;
  style: PawnStyle;
  color: KillerColor;
  onName: (name: string) => void;
  onStyle: (style: PawnStyle) => void;
  onColor: (color: KillerColor) => void;
}) {
  return (
    <div className={`setup-player setup-player--killer-${slot}`}>
      <div className="setup-player__head">
        <KillerPawn slot={slot} style={style} color={color} size={48} onBoard={false} />
        <div className="setup-player__title">{label}</div>
      </div>

      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="field__input"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={label}
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
              <KillerPawn slot={slot} style={s} color={color} size={36} onBoard={false} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Color</span>
        <ColorPicker value={color} onChange={onColor} />
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: KillerColor;
  onChange: (color: KillerColor) => void;
}) {
  return (
    <div className="color-grid">
      {KILLER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`color-swatch color-swatch--${c}${value === c ? " color-swatch--active" : ""}`}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          title={c}
        />
      ))}
    </div>
  );
}

/**
 * The 4-player setup uses KillerPawn for the previews so each slot has its
 * own color (blue / pink / teal / gold).
 */

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

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className="option-row">
      <div className="option-row__label">{label}</div>
      <div className="stepper">
        <div className="stepper__value">
          <div className="stepper__number">{value}</div>
          {suffix && <div className="stepper__suffix">{suffix}</div>}
        </div>
        <div className="stepper__buttons">
          <button
            type="button"
            className="stepper__btn"
            onClick={dec}
            disabled={value <= min}
            aria-label="Decrease"
          >
            −
          </button>
          <button
            type="button"
            className="stepper__btn"
            onClick={inc}
            disabled={value >= max}
            aria-label="Increase"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
