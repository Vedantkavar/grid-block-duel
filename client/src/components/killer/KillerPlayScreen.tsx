import { useEffect, useMemo, useState } from "react";
import KillerBoard from "./KillerBoard";
import KillerPawn from "./KillerPawn";
import Confetti from "../Confetti";
import {
  applyKillerAction,
  activePlayer,
  effectiveStepFor,
  getKiller,
  getRunners,
  isInZoneKind,
} from "../../game/killer/rules";
import {
  Coord,
  killerStepFor,
  killRangeFor,
  KillerAction,
  KillerGameState,
  KillerPlayerId,
  KillerPlayerState,
  RUNNER_MAX_HP,
  WallShape,
  ZONE_INFO,
  ZONE_SPAWN_INTERVAL,
} from "../../game/killer/types";

type OnlineProps = {
  /** The slot this client controls. */
  me: KillerPlayerId;
  /** Send an action to the server. Resolves with reason on rejection. */
  onAction: (action: KillerAction) => Promise<{ ok: boolean; reason?: string }>;
};

type Props = {
  initialState: KillerGameState;
  online?: OnlineProps;
  onMenu: () => void;
  onRematch: () => void;
};

type Phase = "curtain" | "playing";

export default function KillerPlayScreen({
  initialState,
  online,
  onMenu,
  onRematch,
}: Props) {
  const [state, setState] = useState<KillerGameState>(initialState);
  const [phase, setPhase] = useState<Phase>("curtain");
  // For multi-step Killer Move: cells the Killer has already stepped to
  // this Move (committed visually but not yet ended).
  const [killerSteps, setKillerSteps] = useState<Coord[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Tracks which players have already seen their role reveal. After the
  // first time a player passes through the curtain, future curtains only
  // show "Pass to <name>" without re-announcing their role.
  const [rolesShown, setRolesShown] = useState<Set<string>>(new Set());
  // Wall placement mode for the active Runner (null = not placing).
  const [wallShape, setWallShape] = useState<WallShape | null>(null);
  const [wallOrientation, setWallOrientation] = useState<"h" | "v">("h");
  const [superchargeMode, setSuperchargeMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const me = online
    ? state.players.find((p) => p.id === online.me)!
    : activePlayer(state);
  const turnOwner = activePlayer(state);
  const isMyTurn = !online || me.id === turnOwner.id;
  const killer = getKiller(state);
  const runners = getRunners(state);

  const { cell, gap } = useResponsive(state.size);

  // Reset state when initialState changes (rematch / online broadcast)
  useEffect(() => {
    setState(initialState);
    setPhase(online ? "playing" : "curtain");
    setKillerSteps([]);
    setError(null);
    setRolesShown(new Set());
    setWallShape(null);
    setSuperchargeMode(false);
  }, [initialState, online]);

  // When the active player changes, show the curtain only if this player
  // hasn't already seen their role this game. After everyone has had their
  // first reveal, turn changes go straight into the play screen. In online
  // mode the curtain is skipped entirely.
  useEffect(() => {
    if (online) {
      setPhase("playing");
    } else {
      const me = state.players[state.turnIdx];
      if (rolesShown.has(me.id)) {
        setPhase("playing");
      } else {
        setPhase("curtain");
      }
    }
    setKillerSteps([]);
    setWallShape(null);
    setSuperchargeMode(false);
  }, [state.turnIdx, rolesShown, state.players, online]);

  function flashError(msg: string) {
    setError(msg);
    setTimeout(() => setError((e) => (e === msg ? null : e)), 2200);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowInfo(false);
        setWallShape(null);
        setSuperchargeMode(false);
      } else if (e.key === "i" || e.key === "I") {
        setShowInfo((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Submit an action. Offline: applies locally. Online: sends via socket,
   * server broadcasts the result and parent updates `initialState`.
   * Returns true if the action was accepted (offline) or sent (online).
   * Visual side effects like clearing the wall mode should happen on
   * accept.
   */
  function submit(action: KillerAction, onAccept?: () => void) {
    if (online) {
      online
        .onAction(action)
        .then((res) => {
          if (!res.ok) {
            flashError(res.reason || "Server rejected action.");
          } else {
            onAccept?.();
          }
        })
        .catch((err) => flashError(String(err)));
      return;
    }
    const result = applyKillerAction(state, action);
    if (!result.ok) {
      flashError(result.reason);
      return;
    }
    setState(result.state);
    onAccept?.();
  }

  function handleCellClick(target: Coord) {
    if (state.status !== "playing") return;
    if (!isMyTurn) return;

    const allowance = effectiveStepFor(state, me);
    if (allowance <= 1 && me.role === "runner") {
      // Runner with no Fast bonus: single-step immediate.
      submit({ type: "step", player: me.id, path: [target] });
      return;
    }

    // Multi-step: accumulate path, commit when full.
    const nextSteps = [...killerSteps, target];
    setKillerSteps(nextSteps);
    if (nextSteps.length >= allowance) {
      commitKillerMove(nextSteps);
    }
  }

  function commitKillerMove(steps: Coord[]) {
    submit(
      { type: "step", player: me.id, path: steps },
      () => setKillerSteps([]),
    );
  }

  function endKillerMoveEarly() {
    if (!isMyTurn) return;
    if (killerSteps.length === 0) {
      submit({ type: "skip", player: me.id });
      return;
    }
    commitKillerMove(killerSteps);
  }

  function handlePlaceStickWall(anchor: Coord, orientation: "h" | "v") {
    if (!isMyTurn) return;
    if (!wallShape || wallShape === "cage") return;
    submit(
      {
        type: "placeWall",
        player: me.id,
        shape: wallShape,
        anchor,
        orientation,
      },
      () => setWallShape(null),
    );
  }

  function handlePlaceCage(anchor: Coord) {
    if (!isMyTurn) return;
    submit(
      { type: "placeWall", player: me.id, shape: "cage", anchor },
      () => setWallShape(null),
    );
  }

  function handleBreakEdge(wallIndex: number, edgeIndex: number) {
    if (!isMyTurn) return;
    submit(
      { type: "supercharge", player: me.id, wallIndex, edgeIndex },
      () => setSuperchargeMode(false),
    );
  }

  function handleStrike(target: string) {
    if (!isMyTurn) return;
    const useSnipe = me.role === "killer" && isInZoneKind(state, me.pos, "snipe");
    submit({
      type: useSnipe ? "snipe" : "strike",
      player: me.id,
      target: target as never,
    });
  }

  // -------- Curtain --------
  if (phase === "curtain" && state.status === "playing") {
    return (
      <CurtainScreen
        player={me}
        boardSize={state.size}
        onReady={() => {
          setRolesShown((prev) => {
            const next = new Set(prev);
            next.add(me.id);
            return next;
          });
          setPhase("playing");
        }}
        onMenu={onMenu}
      />
    );
  }

  // -------- Playing --------
  const [draftSlot, setDraftSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div className="app app--play">
      <div className="play__topbar">
        <button className="btn btn--ghost" onClick={onMenu}>
          ← Menu
        </button>
        <div className="play__title">Killer mode</div>
        <div className="play__topbar-right">
          <button
            className="btn btn--icon"
            onClick={() => setShowInfo(true)}
            title="What zones are on the board?"
          >
            i
          </button>
          <button className="btn btn--ghost" onClick={onRematch}>
            Reset
          </button>
        </div>
      </div>

      {/* Active player banner */}
      <div className={`killer-banner killer-banner--${turnOwner.role}`}>
        <KillerPawn
          slot={turnOwner.id}
          style={turnOwner.style}
          color={turnOwner.color}
          size={28}
          onBoard={false}
          killer={turnOwner.role === "killer"}
        />
        <div>
          <strong>
            {online && turnOwner.id === me.id
              ? "Your turn"
              : `${turnOwner.name}'s turn`}
          </strong>{" "}
          <span className="killer-banner__role">
            {turnOwner.role === "killer" ? "— Killer" : "— Runner"}
          </span>
        </div>
        <div className="killer-banner__moves">
          Move {state.moveCount + 1} / {state.moveCap}
        </div>
      </div>

      {/* Roster: 3 runners + killer status */}
      <div className="killer-roster">
        {state.players.map((p) => (
          <RosterCard
            key={p.id}
            player={p}
            isActive={p.id === turnOwner.id}
            isYou={!!online && p.id === me.id}
          />
        ))}
      </div>

      <div className="board-wrap">
        <KillerBoard
          state={state}
          cell={cell}
          gap={gap}
          killerStepHistory={killerSteps}
          wallShape={wallShape}
          wallOrientation={wallOrientation}
          superchargeMode={superchargeMode}
          onCellClick={handleCellClick}
          onPlaceWall={handlePlaceStickWall}
          onPlaceCage={handlePlaceCage}
          onBreakEdge={handleBreakEdge}
          onStrikeRunner={handleStrike}
          localPlayer={online?.me}
          draftActionsTarget={draftSlot}
        />
      </div>

      {/* Action toolbar */}
      <div className="toolbar">
        {online && !isMyTurn ? (
          <div
            style={{
              padding: "10px 16px",
              color: "var(--muted)",
              fontSize: 14,
              textAlign: "center",
              width: "100%",
            }}
          >
            Waiting for {turnOwner.name}…
          </div>
        ) : me.role === "killer" ? (
          <>
            <button
              className="btn"
              onClick={endKillerMoveEarly}
              disabled={false}
              title={
                killerSteps.length === 0
                  ? "Skip your move"
                  : "Stop after this step"
              }
            >
              {killerSteps.length === 0
                ? "Skip"
                : `Done (${killerSteps.length}/${effectiveStepFor(state, me)})`}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setKillerSteps([])}
              disabled={killerSteps.length === 0}
            >
              Reset path
            </button>
            <button
              className={`btn${superchargeMode ? " btn--active" : ""}`}
              disabled={!me.superchargeReady || state.walls.length === 0}
              onClick={() => setSuperchargeMode((m) => !m)}
              title={
                me.superchargeReady
                  ? "Break one wall edge (free action)"
                  : `Charging… (${me.superchargeProgress}/2)`
              }
            >
              ⚡ Supercharge{" "}
              {me.superchargeReady ? "ready" : `(${me.superchargeProgress}/2)`}
            </button>
            {superchargeMode && (
              <button
                className="btn btn--cancel"
                onClick={() => setSuperchargeMode(false)}
              >
                ✕ Cancel
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn" onClick={endKillerMoveEarly}>
              {killerSteps.length === 0 ? "Skip" : `Done (${killerSteps.length}/${effectiveStepFor(state, me)})`}
            </button>
            {killerSteps.length > 0 && (
              <button
                className="btn btn--ghost"
                onClick={() => setKillerSteps([])}
              >
                Reset path
              </button>
            )}
            <WallButton
              shape="frame2"
              label="Wall ×2"
              count={me.walls.frame2}
              active={wallShape === "frame2"}
              onClick={() =>
                setWallShape((s) => (s === "frame2" ? null : "frame2"))
              }
            />
            <WallButton
              shape="frame3"
              label="Wall ×3"
              count={me.walls.frame3}
              active={wallShape === "frame3"}
              onClick={() =>
                setWallShape((s) => (s === "frame3" ? null : "frame3"))
              }
            />
            <WallButton
              shape="cage"
              label="O-Cage"
              count={me.walls.cage}
              active={wallShape === "cage"}
              onClick={() =>
                setWallShape((s) => (s === "cage" ? null : "cage"))
              }
            />
            {wallShape && wallShape !== "cage" && (
              <button
                className="btn"
                onClick={() =>
                  setWallOrientation((o) => (o === "h" ? "v" : "h"))
                }
                title="Rotate wall"
              >
                Rotate ({wallOrientation === "h" ? "→" : "↓"})
              </button>
            )}
            {wallShape && (
              <button
                className="btn btn--cancel"
                onClick={() => setWallShape(null)}
              >
                ✕ Cancel
              </button>
            )}
          </>
        )}
      </div>

      <div ref={setDraftSlot} className="board__draft-slot" />

      <p className="killer-hint">
        {superchargeMode
          ? `⚡ Supercharge: click any wall edge to break it (free action).`
          : wallShape && me.role === "runner"
          ? wallShape === "cage"
            ? `O-Cage: click the Killer's cell to wrap them for 2 rounds.`
            : `Click a highlighted cell to drop a length-${wallShape === "frame2" ? 2 : 3} wall.`
          : me.role === "killer"
          ? isInZoneKind(state, me.pos, "snipe")
            ? `Snipe Zone active — click ANY Runner to deal ½ heart (consumes your Move).`
            : `Step up to ${effectiveStepFor(state, me)} cells, or click a Runner inside your red zone to strike (½ heart, costs your Move).`
          : effectiveStepFor(state, me) > 1
          ? `Fast Zone! You can step up to ${effectiveStepFor(state, me)} cells. Click Done when finished.`
          : `Click a green cell to move 1 step. The red zone is the Killer's strike range — stay out of it.`}
      </p>

      {error && <div className="error">{error}</div>}

      {showInfo && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setShowInfo(false)}
            aria-hidden
          />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter info-card">
              <h2>Active zones</h2>
              <p className="endcard__sub" style={{ marginBottom: 12 }}>
                A random zone spawns every {ZONE_SPAWN_INTERVAL} Moves.
              </p>
              {state.zones.length === 0 ? (
                <p className="endcard__sub">
                  No zones on the board right now.
                </p>
              ) : (
                <div className="info-card__list">
                  {state.zones.map((z, i) => {
                    const info = ZONE_INFO[z.kind];
                    const remaining = Math.max(
                      0,
                      z.expiresOnRound - state.roundCount,
                    );
                    return (
                      <div key={i} className="info-card__ability">
                        <div
                          className={`zone zone--${z.kind} lootbox--display`}
                          style={{ position: "static", width: 44, height: 44 }}
                        />
                        <div className="info-card__ability-text">
                          <strong>{info.name}</strong>
                          <p>{info.desc}</p>
                          <p style={{ marginTop: 4, fontSize: 11 }}>
                            {remaining} round{remaining === 1 ? "" : "s"} left
                            · {z.size}×{z.size}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="endcard__actions">
                <button
                  className="btn btn--primary"
                  onClick={() => setShowInfo(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* End screen */}
      {state.status === "finished" && (
        <>
          <Confetti color={state.winner === "killer" ? "#ef4444" : "#7be0c2"} />
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter">
              <h2>
                {state.winner === "killer" ? `${killer.name} wins!` : "Runners survive!"}
              </h2>
              <p className="endcard__sub">
                {state.winner === "killer"
                  ? `All Runners eliminated.`
                  : `${runners.filter((r) => r.alive).length} of 3 Runners made it to the move cap.`}
              </p>
              <div className="endcard__actions">
                <button className="btn btn--primary" onClick={onRematch}>
                  Play again
                </button>
                <button className="btn" onClick={onMenu}>
                  Main menu
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// CURTAIN
// ============================================================

function WallButton({
  shape: _shape,
  label,
  count,
  active,
  onClick,
}: {
  shape: WallShape;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`btn${active ? " btn--active" : ""}`}
      disabled={count <= 0}
      onClick={onClick}
      title={`${label} wall — ${count} left`}
    >
      {label} <span className="killer-wall-count">×{count}</span>
    </button>
  );
}

function CurtainScreen({
  player,
  boardSize,
  onReady,
  onMenu,
}: {
  player: KillerPlayerState;
  boardSize: number;
  onReady: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="curtain">
      <div className="curtain__inner">
        <div className="curtain__pass">Pass the device to</div>
        <div className="curtain__name">{player.name}</div>
        <div className="curtain__pawn">
          <KillerPawn
            slot={player.id}
            style={player.style}
            color={player.color}
            size={84}
            onBoard={false}
            killer={player.role === "killer"}
          />
        </div>
        <div className={`curtain__role curtain__role--${player.role}`}>
          {player.role === "killer" ? "You are the Killer" : "You are a Runner"}
        </div>
        <p className="curtain__sub">
          {player.role === "killer"
            ? `Eliminate all Runners. Step up to ${killerStepFor(boardSize)} cells, or click a Runner within ${killRangeFor(boardSize)} cells to strike them (½ heart, costs your Move).`
            : `Survive! Move 1 cell. Stay out of the red zone — that's the Killer's reach.`}
        </p>
        <div className="curtain__actions">
          <button className="btn btn--primary btn--lg" onClick={onReady}>
            I'm ready
          </button>
          <button className="btn btn--ghost" onClick={onMenu}>
            Leave game
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ROSTER CARD
// ============================================================

function RosterCard({
  player,
  isActive,
  isYou,
}: {
  player: KillerPlayerState;
  isActive: boolean;
  isYou?: boolean;
}) {
  const isKiller = player.role === "killer";
  return (
    <div
      className={[
        "killer-roster__card",
        isActive ? "killer-roster__card--active" : "",
        !player.alive ? "killer-roster__card--dead" : "",
        isKiller ? "killer-roster__card--killer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <KillerPawn
        slot={player.id}
        style={player.style}
        color={player.color}
        size={28}
        onBoard={false}
        killer={isKiller}
      />
      <div className="killer-roster__body">
        <div className="killer-roster__name">
          {player.name}
          {isYou && <span className="badge" style={{ marginLeft: 6 }}>You</span>}
        </div>
        <div className="killer-roster__role">
          {isKiller ? "Killer" : "Runner"}
          {!player.alive && " · Dead"}
        </div>
      </div>
      {!isKiller && (
        <Hearts hp={player.hp} hpMax={RUNNER_MAX_HP} />
      )}
    </div>
  );
}

function Hearts({ hp, hpMax }: { hp: number; hpMax: number }) {
  // hp and hpMax are in half-hearts. Render as N hearts where N = hpMax/2.
  const total = Math.ceil(hpMax / 2);
  return (
    <div className="hearts" aria-label={`${hp / 2} of ${hpMax / 2} hearts`}>
      {Array.from({ length: total }).map((_, i) => {
        const halfIdx = i * 2; // bottom of this heart in the half-heart scale
        // Each heart has 2 half-hearts. Determine state:
        // - if hp > halfIdx + 1 → full
        // - if hp > halfIdx → half
        // - else → empty
        let state: "full" | "half" | "empty" = "empty";
        if (hp > halfIdx + 1) state = "full";
        else if (hp > halfIdx) state = "half";
        return <span key={i} className={`heart heart--${state}`} aria-hidden />;
      })}
    </div>
  );
}

// ============================================================
// RESPONSIVE
// ============================================================

function useResponsive(size: number) {
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerWidth,
  );
  const [vh, setVh] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  useEffect(() => {
    function onResize() {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return useMemo(() => {
    const gap = vw < 420 ? 4 : vw < 720 ? 6 : vw < 1100 ? 8 : 10;
    const verticalChrome = vw < 720 ? 360 : 400; // extra room for roster
    const heightCap = Math.max(280, vh - verticalChrome);
    const sidePad = vw < 720 ? 24 : 48;
    const widthCap = Math.min(vw - sidePad, 880);
    const available = Math.min(widthCap, heightCap);
    const cell = Math.max(20, Math.floor((available - (size - 1) * gap) / size));
    return { cell, gap };
  }, [vw, vh, size]);
}
