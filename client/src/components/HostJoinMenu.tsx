type Props = {
  title: string;
  onHost: () => void;
  onJoin: () => void;
  onBack: () => void;
  /**
   * Optional helper text shown under the title. Defaults to nothing.
   */
  hint?: string;
  /** Friend count for the host card copy. Defaults to "your friend". */
  hostFriends?: string;
};

export default function HostJoinMenu({
  title,
  onHost,
  onJoin,
  onBack,
  hint,
  hostFriends = "your friend",
}: Props) {
  return (
    <div className="menu">
      <div className="setup__topbar" style={{ width: "100%", maxWidth: 760 }}>
        <button className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>{title}</h2>
        <span style={{ width: 60 }} />
      </div>

      {hint && <p className="menu__hint">{hint}</p>}

      <div className="menu__cards">
        <button className="menu-card menu-card--primary" onClick={onHost}>
          <div className="menu-card__icon" aria-hidden>
            <span className="menu-card__pawn menu-card__pawn--A" />
            <span className="menu-card__plug">+</span>
          </div>
          <div className="menu-card__title">Host a room</div>
          <div className="menu-card__desc">
            Create an online room and share the code with {hostFriends}.
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
