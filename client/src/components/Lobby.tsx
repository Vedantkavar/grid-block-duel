import { useState } from "react";

type Props = {
  roomId: string;
  onCancel: () => void;
};

export default function Lobby({ roomId, onCancel }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore — most browsers allow this from secure contexts only
    }
  }

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onCancel}>
          ← Cancel
        </button>
        <h2>Waiting for opponent</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section lobby">
        <p className="lobby__hint">Share this room code with your friend:</p>
        <div className="lobby__code-row">
          <div className="lobby__code">{roomId}</div>
          <button className="btn btn--primary" onClick={copy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="lobby__spinner" aria-hidden>
          <div className="lobby__dot" />
          <div className="lobby__dot" />
          <div className="lobby__dot" />
        </div>
        <p className="lobby__status">Waiting for player 2 to join…</p>
      </section>
    </div>
  );
}
