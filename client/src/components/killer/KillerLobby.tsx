import KillerPawn from "./KillerPawn";
import type {
  KillerRoomSnapshot,
  KillerSlotPresence,
} from "../../net/protocol";

type Props = {
  snapshot: KillerRoomSnapshot;
  busy?: boolean;
  onStart: () => void;
  onLeave: () => void;
};

export default function KillerLobby({ snapshot, busy, onStart, onLeave }: Props) {
  const isHost = snapshot.you === "A";
  const allPresent = snapshot.slots.every((s) => s.present);

  return (
    <div className="setup">
      <div className="setup__topbar">
        <button className="btn btn--ghost" onClick={onLeave} disabled={busy}>
          ← Leave
        </button>
        <h2>Killer lobby</h2>
        <span style={{ width: 60 }} />
      </div>

      <section className="setup__section">
        <div className="room-code-card">
          <div className="room-code-card__label">Room code</div>
          <div className="room-code-card__value">{snapshot.roomId}</div>
          <div className="room-code-card__hint">
            Share this code with your friends
          </div>
        </div>
      </section>

      <section className="setup__section">
        <h3>Players ({snapshot.slots.filter((s) => s.present).length} / 4)</h3>
        <div className="killer-players">
          {snapshot.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isYou={slot.id === snapshot.you}
            />
          ))}
        </div>
      </section>

      <section className="setup__section">
        <div className="endcard__sub" style={{ textAlign: "center" }}>
          Grid {snapshot.hostConfig.size} × {snapshot.hostConfig.size} ·{" "}
          {snapshot.hostConfig.moveCap} moves · Zones{" "}
          {snapshot.hostConfig.zonesEnabled ? "On" : "Off"}
        </div>
      </section>

      <div className="setup__actions">
        {isHost ? (
          <button
            className="btn btn--primary btn--lg"
            disabled={busy || !allPresent}
            onClick={onStart}
          >
            {allPresent ? "Start game →" : "Waiting for players…"}
          </button>
        ) : (
          <div className="endcard__sub">
            Waiting for host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  isYou,
}: {
  slot: KillerSlotPresence;
  isYou: boolean;
}) {
  return (
    <div
      className={[
        "setup-player",
        `setup-player--killer-${slot.id}`,
        !slot.present ? "setup-player--empty" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="setup-player__head">
        <KillerPawn slot={slot.id} style={slot.style} color={slot.color} size={44} onBoard={false} />
        <div className="setup-player__title">
          Slot {slot.id}
          {isYou && <span className="badge" style={{ marginLeft: 8 }}>You</span>}
        </div>
      </div>
      <div className="field">
        <span className="field__label">{slot.present ? slot.name : "Empty"}</span>
      </div>
    </div>
  );
}
