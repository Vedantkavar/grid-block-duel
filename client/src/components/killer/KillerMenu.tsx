type Props = {
  onPlayLocal: () => void;
  onHostOnline: () => void;
  onJoinOnline: () => void;
  onBack: () => void;
};

export default function KillerMenu({
  onPlayLocal,
  onHostOnline,
  onJoinOnline,
  onBack,
}: Props) {
  return (
    <div className="menu">
      <div className="setup__topbar" style={{ width: "100%", maxWidth: 760 }}>
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Play with friends</h2>
        <span style={{ width: 60 }} />
      </div>

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onPlayLocal}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__pawn menu-card__pawn--B" />
            <span className="menu-card__pawn menu-card__pawn--C" />
            <span className="menu-card__pawn menu-card__pawn--D" />
          </div>
          <div className="menu-card__title">Play here</div>
          <div className="menu-card__desc">
            Four players, one screen. Pass the device on each Move.
          </div>
        </button>

        <button className="menu-card" onClick={onHostOnline}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__plug">⇄</span>
            <span className="menu-card__pawn menu-card__pawn--C" />
          </div>
          <div className="menu-card__title">Host a room</div>
          <div className="menu-card__desc">
            Create an online room and share the code with 3 friends.
          </div>
        </button>

        <button className="menu-card" onClick={onJoinOnline}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--B" />
            <span className="menu-card__plug">→</span>
            <span className="menu-card__pawn menu-card__pawn--D" />
          </div>
          <div className="menu-card__title">Join a room</div>
          <div className="menu-card__desc">
            Got a code from a friend? Jump in.
          </div>
        </button>
      </div>
    </div>
  );
}
