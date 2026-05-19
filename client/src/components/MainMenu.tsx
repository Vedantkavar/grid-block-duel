import { useState } from "react";
import HowToPlay from "./HowToPlay";

type Props = {
  onPlayDuel: () => void;
  onPlayKiller: () => void;
};

export default function MainMenu({ onPlayDuel, onPlayKiller }: Props) {
  const [showHowTo, setShowHowTo] = useState(false);

  return (
    <div className="menu">
      <header className="menu__header">
        <h1>Grid Block Duel</h1>
        <p>Race to the other side. Walls slow your rival down.</p>
        <button
          type="button"
          className="menu__how-to"
          onClick={() => setShowHowTo(true)}
        >
          <span aria-hidden>?</span> How to play
        </button>
      </header>

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onPlayDuel}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__plug">⇄</span>
            <span className="menu-card__pawn menu-card__pawn--B" />
          </div>
          <div className="menu-card__title">Duels</div>
          <div className="menu-card__desc">
            Two players. Play here, host a room, or join a friend.
          </div>
        </button>

        <button className="menu-card menu-card--primary" onClick={onPlayKiller}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__pawn menu-card__pawn--B" />
            <span className="menu-card__pawn menu-card__pawn--C" />
            <span className="menu-card__pawn menu-card__pawn--D" />
          </div>
          <div className="menu-card__title">Killer Is Near</div>
          <div className="menu-card__desc">
            Up to 4 players, one is the Killer. Survive or hunt — new mode.
          </div>
        </button>
      </div>

      <footer className="menu__footer">v0.3 — duel + killer mode</footer>

      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
