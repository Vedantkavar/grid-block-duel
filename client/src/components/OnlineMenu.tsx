type Props = {
  onCreate: () => void;
  onJoin: () => void;
  onBack: () => void;
};

export default function OnlineMenu({ onCreate, onJoin, onBack }: Props) {
  return (
    <div className="menu">
      <div className="setup__topbar" style={{ width: "100%", maxWidth: 760 }}>
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Play with a friend</h2>
        <span style={{ width: 60 }} />
      </div>

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onCreate}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__plug">+</span>
          </div>
          <div className="menu-card__title">Create a room</div>
          <div className="menu-card__desc">
            Pick board size and walls, then share the room code with your friend.
          </div>
        </button>

        <button className="menu-card" onClick={onJoin}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__plug">⇆</span>
            <span className="menu-card__pawn menu-card__pawn--B" />
          </div>
          <div className="menu-card__title">Join a room</div>
          <div className="menu-card__desc">
            Got a 5-letter room code from a friend? Pop it in.
          </div>
        </button>
      </div>
    </div>
  );
}
