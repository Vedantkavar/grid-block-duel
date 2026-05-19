type Props = {
  onPlayLocal: () => void;
  onPlayOnline: () => void;
  onBack: () => void;
};

export default function OnlineMenu({ onPlayLocal, onPlayOnline, onBack }: Props) {
  return (
    <div className="menu">
      <div className="setup__topbar" style={{ width: "100%", maxWidth: 760 }}>
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Duels</h2>
        <span style={{ width: 60 }} />
      </div>

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onPlayLocal}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__pawn menu-card__pawn--B" />
          </div>
          <div className="menu-card__title">Play Offline</div>
          <div className="menu-card__desc">
            Two players, one screen. Pass the device on each turn.
          </div>
        </button>

        <button className="menu-card menu-card--primary" onClick={onPlayOnline}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__plug">⇄</span>
            <span className="menu-card__pawn menu-card__pawn--B" />
          </div>
          <div className="menu-card__title">Play Online</div>
          <div className="menu-card__desc">
            Host a room or join with a code and play live from two browsers.
          </div>
        </button>
      </div>
    </div>
  );
}
