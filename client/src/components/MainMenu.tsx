type Props = {
  onPlayLocal: () => void;
  onPlayOnline: () => void;
};

export default function MainMenu({ onPlayLocal, onPlayOnline }: Props) {
  return (
    <div className="menu">
      <header className="menu__header">
        <h1>Grid Block Duel</h1>
        <p>Race to the other side. Walls slow your rival down.</p>
      </header>

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onPlayLocal}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__pawn menu-card__pawn--B" />
          </div>
          <div className="menu-card__title">Play here</div>
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
          <div className="menu-card__title">Play with friend</div>
          <div className="menu-card__desc">
            Share a room link and play live from two browsers.
          </div>
        </button>
      </div>

      <footer className="menu__footer">v0.2 — local + online play</footer>
    </div>
  );
}
