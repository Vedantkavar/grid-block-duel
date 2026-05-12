import { useEffect, useMemo, useRef, useState } from "react";
import Board, { AbilityMode } from "./components/Board";
import Confetti from "./components/Confetti";
import CreateRoom from "./components/CreateRoom";
import GameSetup from "./components/GameSetup";
import JoinRoom from "./components/JoinRoom";
import Lobby from "./components/Lobby";
import MainMenu from "./components/MainMenu";
import OnlineMenu from "./components/OnlineMenu";
import KillerMenu from "./components/killer/KillerMenu";
import KillerSetup from "./components/killer/KillerSetup";
import KillerPlayScreen from "./components/killer/KillerPlayScreen";
import KillerCreateRoom from "./components/killer/KillerCreateRoom";
import KillerJoinRoom from "./components/killer/KillerJoinRoom";
import KillerLobby from "./components/killer/KillerLobby";
import {
  createKillerInitialState,
} from "./game/killer/rules";
import {
  DEFAULT_KILLER_CONFIG,
  KillerGameConfig,
  KillerGameState,
} from "./game/killer/types";
import Pawn from "./components/Pawn";
import { applyAction, createInitialState } from "./game/rules";
import {
  ABILITY_INFO,
  AbilityCharge,
  AbilityId,
  AbilityTarget,
  Action,
  Coord,
  DEFAULT_CONFIG,
  GameConfig,
  GameState,
  PawnStyle,
  PlayerId,
  Wall,
  WallLength,
  WallOrientation,
} from "./game/types";
import { disconnectSocket, getSocket } from "./net/socket";
import type { RoomSnapshot, KillerRoomSnapshot } from "./net/protocol";
import type { KillerAction, KillerPlayerId } from "./game/killer/types";

type Screen =
  | "menu"
  | "setup-local"
  | "play-local"
  | "online-menu"
  | "online-create"
  | "online-join"
  | "online-lobby"
  | "play-online"
  | "killer-menu"
  | "killer-setup"
  | "killer-play"
  | "killer-online-create"
  | "killer-online-join"
  | "killer-online-lobby"
  | "killer-online-play";

type Mode = "move" | "wall";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  const [localState, setLocalState] = useState<GameState>(() =>
    createInitialState(DEFAULT_CONFIG),
  );

  const [you, setYou] = useState<PlayerId | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("move");
  const [wallLength, setWallLength] = useState<WallLength>(2);
  const [wallOrientation, setWallOrientation] = useState<WallOrientation>("h");
  const [error, setError] = useState<string | null>(null);
  const [abilityMode, setAbilityMode] = useState<AbilityMode>({ kind: "none" });
  const [showInfo, setShowInfo] = useState(false);

  // Killer mode state
  const [killerConfig, setKillerConfig] = useState<KillerGameConfig>(DEFAULT_KILLER_CONFIG);
  const [killerState, setKillerState] = useState<KillerGameState | null>(null);

  // Killer online state
  const [killerSnapshot, setKillerSnapshot] = useState<KillerRoomSnapshot | null>(null);
  const [killerYou, setKillerYou] = useState<KillerPlayerId | null>(null);
  const [killerRoomNotice, setKillerRoomNotice] = useState<string | null>(null);

  const isOnline = screen === "play-online";
  const activeState: GameState = isOnline && snapshot ? snapshot.state : localState;
  const { cell, gap } = useResponsiveBoard(activeState.size);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  function ensureSocket() {
    if (!socketRef.current) {
      const s = getSocket();
      socketRef.current = s;
      s.on("roomState", (snap) => setSnapshot(snap));
      s.on("roomClosed", (reason) => setRoomNotice(reason));
      s.on("killer:roomState", (snap) => setKillerSnapshot(snap));
      s.on("killer:roomClosed", (reason) => setKillerRoomNotice(reason));
    }
    return socketRef.current;
  }

  // Reset ability mode on screen / turn changes
  useEffect(() => {
    setAbilityMode({ kind: "none" });
    setMode("move");
  }, [screen, activeState.turn]);

  // Reset ability mode when game finishes
  useEffect(() => {
    if (activeState.status === "finished") setAbilityMode({ kind: "none" });
  }, [activeState.status]);

  // Keyboard shortcuts
  useEffect(() => {
    if (screen !== "play-local" && screen !== "play-online") return;
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        setAbilityMode({ kind: "none" });
        setShowInfo(false);
        return;
      }
      if (abilityMode.kind !== "none") return;
      if (k === "m") setMode("move");
      else if (k === "w") setMode("wall");
      else if (k === "r") setWallOrientation((o) => (o === "h" ? "v" : "h"));
      else if (k === "2") {
        setMode("wall");
        setWallLength(2);
      } else if (k === "3") {
        setMode("wall");
        setWallLength(3);
      } else if (k === "i") {
        setShowInfo((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, abilityMode]);

  // ----- Local flow -----
  function handleStartLocal(cfg: GameConfig) {
    setConfig(cfg);
    setLocalState(createInitialState(cfg));
    setMode("move");
    setError(null);
    setRoomNotice(null);
    setAbilityMode({ kind: "none" });
    setScreen("play-local");
  }

  function applyLocal(action: Action) {
    const result = applyAction(localState, action);
    if (result.ok) {
      setLocalState(result.state);
      setError(null);
    } else {
      flashError(result.reason);
    }
  }

  function handleLocalMove(to: Coord) {
    applyLocal({ type: "move", player: localState.turn, to });
  }

  function handleLocalWall(wall: Omit<Wall, "owner">) {
    applyLocal({ type: "placeWall", player: localState.turn, wall });
  }

  function resetLocal() {
    setLocalState(createInitialState(config));
    setMode("move");
    setError(null);
    setAbilityMode({ kind: "none" });
  }

  // ----- Online flow -----
  function handleCreateRoom(data: {
    name: string;
    style: PawnStyle;
    config: GameConfig;
  }) {
    const s = ensureSocket();
    setBusy(true);
    s.emit("createRoom", { name: data.name, style: data.style, config: data.config }, (res) => {
      setBusy(false);
      if (!res.ok) {
        flashError(res.reason);
        return;
      }
      setYou("A");
      setSnapshot(res.snapshot);
      setRoomNotice(null);
      setScreen("online-lobby");
    });
  }

  function handleJoinRoom(data: { roomId: string; name: string; style: PawnStyle }) {
    const s = ensureSocket();
    setBusy(true);
    setJoinError(null);
    s.emit("joinRoom", data, (res) => {
      setBusy(false);
      if (!res.ok) {
        setJoinError(res.reason);
        return;
      }
      setYou("B");
      setSnapshot(res.snapshot);
      setMode("move");
      setError(null);
      setRoomNotice(null);
      setScreen("play-online");
    });
  }

  function emitOnlineAction(action: Action) {
    if (!socketRef.current) return;
    socketRef.current.emit("action", action, (res) => {
      if (!res.ok) flashError(res.reason);
    });
  }

  function handleOnlineMove(to: Coord) {
    if (!you) return;
    emitOnlineAction({ type: "move", player: you, to });
  }
  function handleOnlineWall(wall: Omit<Wall, "owner">) {
    if (!you) return;
    emitOnlineAction({ type: "placeWall", player: you, wall });
  }

  function leaveRoom() {
    if (socketRef.current) socketRef.current.emit("leaveRoom");
    setYou(null);
    setSnapshot(null);
    setRoomNotice(null);
  }

  function backToMenu() {
    if (
      screen === "online-lobby" ||
      screen === "play-online" ||
      screen === "online-create" ||
      screen === "online-join"
    ) {
      leaveRoom();
    }
    setScreen("menu");
    setError(null);
    setAbilityMode({ kind: "none" });
  }

  function handleOnlineRematch() {
    socketRef.current?.emit("rematch");
  }

  useEffect(() => {
    if (screen === "online-lobby" && snapshot?.presence.A && snapshot?.presence.B) {
      setMode("move");
      setError(null);
      setScreen("play-online");
    }
  }, [screen, snapshot]);

  function flashError(msg: string) {
    setError(msg);
    setTimeout(() => setError((e) => (e === msg ? null : e)), 2500);
  }

  // ----- Ability handlers -----
  const meId: PlayerId | null = isOnline ? you : activeState.turn;

  function dispatchAction(action: Action) {
    if (isOnline) emitOnlineAction(action);
    else applyLocal(action);
  }

  function activateAbility(slot: 0 | 1) {
    if (!meId) return;
    const charge = activeState.players[meId].abilities[slot];
    if (!charge) return;
    if (activeState.turn !== meId || activeState.status !== "playing") return;
    if (activeState.pendingPickup) return;

    // Tapping an already-active slot toggles ability mode off.
    if (
      abilityMode.kind !== "none" &&
      "slot" in abilityMode &&
      (abilityMode as { slot: 0 | 1 }).slot === slot
    ) {
      setAbilityMode({ kind: "none" });
      return;
    }

    switch (charge.id) {
      case "scramble":
        dispatchAction({ type: "useAbility", player: meId, slot });
        setAbilityMode({ kind: "none" });
        break;
      case "jumpWall":
        setAbilityMode({ kind: "jumpWall", slot });
        break;
      case "diagonalStep":
        setAbilityMode({ kind: "diagonalStep", slot });
        break;
      case "dash":
        setAbilityMode({ kind: "dash", slot, first: null });
        break;
      case "breakWall":
        if (activeState.walls.length === 0) {
          flashError("No walls on the board to break.");
          return;
        }
        setAbilityMode({ kind: "breakWall", slot });
        break;
      case "trapWall":
        setAbilityMode({ kind: "trapWall", slot });
        break;
    }
  }

  function handleAbilityCell(cell: Coord) {
    if (!meId) return;
    const m = abilityMode;
    let target: AbilityTarget | undefined;
    let slot: 0 | 1;
    switch (m.kind) {
      case "jumpWall":
        slot = m.slot;
        target = { kind: "cell", pos: cell };
        break;
      case "diagonalStep":
        slot = m.slot;
        target = { kind: "cell", pos: cell };
        break;
      case "trapWall":
        slot = m.slot;
        target = { kind: "cell", pos: cell };
        break;
      case "dash":
        if (m.first === null) return;
        slot = m.slot;
        target = { kind: "twoCells", first: m.first, second: cell };
        break;
      default:
        return;
    }
    dispatchAction({ type: "useAbility", player: meId, slot, target });
    setAbilityMode({ kind: "none" });
  }

  function handleAbilityWall(idx: number) {
    if (!meId) return;
    if (abilityMode.kind !== "breakWall") return;
    dispatchAction({
      type: "useAbility",
      player: meId,
      slot: abilityMode.slot,
      target: { kind: "wallIndex", index: idx },
    });
    setAbilityMode({ kind: "none" });
  }

  function handleDashFirst(first: Coord) {
    if (abilityMode.kind !== "dash") return;
    setAbilityMode({ ...abilityMode, first });
  }

  function cancelAbility() {
    setAbilityMode({ kind: "none" });
  }

  // ----- Pickup resolution -----
  function resolvePickup(choice: 0 | 1 | "discard") {
    if (!activeState.pendingPickup) return;
    const player = activeState.pendingPickup.player;
    dispatchAction({ type: "resolvePickup", player, choice });
  }

  // -------- Screen routing --------

  if (screen === "menu") {
    return (
      <MainMenu
        onPlayLocal={() => setScreen("setup-local")}
        onPlayOnline={() => setScreen("online-menu")}
        onPlayKiller={() => setScreen("killer-menu")}
      />
    );
  }
  if (screen === "setup-local") {
    return (
      <GameSetup
        initial={config}
        onBack={() => setScreen("menu")}
        onStart={handleStartLocal}
      />
    );
  }
  if (screen === "killer-menu") {
    return (
      <KillerMenu
        onBack={() => setScreen("menu")}
        onPlayLocal={() => setScreen("killer-setup")}
        onHostOnline={() => {
          setScreen("killer-online-create");
        }}
        onJoinOnline={() => {
          setScreen("killer-online-join");
        }}
      />
    );
  }
  if (screen === "killer-setup") {
    return (
      <KillerSetup
        initial={killerConfig}
        onBack={() => setScreen("killer-menu")}
        onStart={(cfg) => {
          setKillerConfig(cfg);
          setKillerState(createKillerInitialState(cfg));
          setScreen("killer-play");
        }}
      />
    );
  }
  if (screen === "killer-play" && killerState) {
    return (
      <KillerPlayScreen
        initialState={killerState}
        onMenu={() => {
          setScreen("menu");
          setKillerState(null);
        }}
        onRematch={() => {
          setKillerState(createKillerInitialState(killerConfig));
        }}
      />
    );
  }

  if (screen === "killer-online-create") {
    return (
      <KillerCreateRoom
        busy={busy}
        onBack={() => setScreen("killer-menu")}
        onSubmit={(data) => {
          const s = ensureSocket();
          setBusy(true);
          s.emit(
            "killer:createRoom",
            { name: data.name, style: data.style, color: data.color, config: data.config },
            (res) => {
              setBusy(false);
              if (!res.ok) {
                flashError(res.reason);
                return;
              }
              setKillerYou("A");
              setKillerSnapshot(res.snapshot);
              setKillerRoomNotice(null);
              setScreen("killer-online-lobby");
            },
          );
        }}
      />
    );
  }

  if (screen === "killer-online-join") {
    return (
      <KillerJoinRoom
        busy={busy}
        onBack={() => setScreen("killer-menu")}
        onSubmit={(data) => {
          const s = ensureSocket();
          setBusy(true);
          s.emit("killer:joinRoom", data, (res) => {
            setBusy(false);
            if (!res.ok) {
              flashError(res.reason);
              return;
            }
            setKillerYou(res.you);
            setKillerSnapshot(res.snapshot);
            setKillerRoomNotice(null);
            setScreen("killer-online-lobby");
          });
        }}
      />
    );
  }

  if (screen === "killer-online-lobby" && killerSnapshot) {
    // Auto-transition to play screen once the server starts the game.
    if (killerSnapshot.state) {
      setScreen("killer-online-play");
    }
    return (
      <KillerLobby
        snapshot={killerSnapshot}
        busy={busy}
        onStart={() => {
          const s = ensureSocket();
          setBusy(true);
          s.emit("killer:start", (res) => {
            setBusy(false);
            if (!res.ok) flashError(res.reason);
          });
        }}
        onLeave={() => {
          const s = ensureSocket();
          s.emit("killer:leaveRoom");
          setKillerSnapshot(null);
          setKillerYou(null);
          setScreen("killer-menu");
        }}
      />
    );
  }

  if (screen === "killer-online-play" && killerSnapshot?.state && killerYou) {
    const goMenu = () => {
      const s = ensureSocket();
      s.emit("killer:leaveRoom");
      setKillerSnapshot(null);
      setKillerYou(null);
      setKillerRoomNotice(null);
      setScreen("menu");
    };
    return (
      <>
        <KillerPlayScreen
          initialState={killerSnapshot.state}
          online={{
            me: killerYou,
            onAction: (action: KillerAction) =>
              new Promise((resolve) => {
                const s = ensureSocket();
                s.emit("killer:action", action, (res) => resolve(res));
              }),
          }}
          onMenu={goMenu}
          onRematch={() => {
            const s = ensureSocket();
            s.emit("killer:rematch");
          }}
        />
        {killerRoomNotice && killerSnapshot.state.status !== "finished" && (
          <>
            <div className="modal-backdrop" aria-hidden />
            <div className="modal" role="dialog" aria-modal="true">
              <div className="endcard endcard--enter endcard--notice">
                <div className="endcard__icon" aria-hidden>!</div>
                <h2>{killerRoomNotice}</h2>
                <p className="endcard__sub">
                  The game can&apos;t continue without all four players.
                </p>
                <div className="endcard__actions">
                  <button className="btn btn--primary" onClick={goMenu}>
                    Back to menu
                  </button>
                  <button
                    className="btn"
                    onClick={() => setKillerRoomNotice(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }
  if (screen === "online-menu") {
    return (
      <OnlineMenu
        onBack={() => setScreen("menu")}
        onCreate={() => setScreen("online-create")}
        onJoin={() => {
          setJoinError(null);
          setScreen("online-join");
        }}
      />
    );
  }
  if (screen === "online-create") {
    return (
      <CreateRoom
        onBack={() => setScreen("online-menu")}
        onSubmit={handleCreateRoom}
        busy={busy}
      />
    );
  }
  if (screen === "online-join") {
    return (
      <JoinRoom
        onBack={() => setScreen("online-menu")}
        onSubmit={handleJoinRoom}
        busy={busy}
        error={joinError}
      />
    );
  }
  if (screen === "online-lobby" && snapshot) {
    return <Lobby roomId={snapshot.roomId} onCancel={backToMenu} />;
  }

  // Play screen
  return (
    <PlayScreen
      online={isOnline}
      state={activeState}
      controllingPlayer={meId}
      mode={mode}
      wallLength={wallLength}
      wallOrientation={wallOrientation}
      cell={cell}
      gap={gap}
      error={error}
      roomNotice={roomNotice}
      abilityMode={abilityMode}
      showInfo={showInfo}
      onSetMode={setMode}
      onSetWallLength={setWallLength}
      onSetWallOrientation={setWallOrientation}
      onMove={isOnline ? handleOnlineMove : handleLocalMove}
      onPlaceWall={isOnline ? handleOnlineWall : handleLocalWall}
      onActivateAbility={activateAbility}
      onAbilityCell={handleAbilityCell}
      onAbilityWall={handleAbilityWall}
      onAbilityDashFirst={handleDashFirst}
      onCancelAbility={cancelAbility}
      onToggleInfo={() => setShowInfo((s) => !s)}
      onResolvePickup={resolvePickup}
      onDismissNotice={() => setRoomNotice(null)}
      onReset={isOnline ? handleOnlineRematch : resetLocal}
      onMenu={backToMenu}
      roomId={isOnline ? snapshot?.roomId : undefined}
    />
  );
}

// ============================================================
// PLAY SCREEN
// ============================================================

type PlayScreenProps = {
  online: boolean;
  state: GameState;
  controllingPlayer: PlayerId | null;
  mode: Mode;
  wallLength: WallLength;
  wallOrientation: WallOrientation;
  cell: number;
  gap: number;
  error: string | null;
  roomNotice: string | null;
  abilityMode: AbilityMode;
  showInfo: boolean;
  onSetMode: (m: Mode) => void;
  onSetWallLength: (n: WallLength) => void;
  onSetWallOrientation: (
    o: WallOrientation | ((o: WallOrientation) => WallOrientation),
  ) => void;
  onMove: (to: Coord) => void;
  onPlaceWall: (wall: Omit<Wall, "owner">) => void;
  onActivateAbility: (slot: 0 | 1) => void;
  onAbilityCell: (cell: Coord) => void;
  onAbilityWall: (index: number) => void;
  onAbilityDashFirst: (cell: Coord) => void;
  onCancelAbility: () => void;
  onToggleInfo: () => void;
  onResolvePickup: (choice: 0 | 1 | "discard") => void;
  onDismissNotice: () => void;
  onReset: () => void;
  onMenu: () => void;
  roomId?: string;
};

function PlayScreen(props: PlayScreenProps) {
  const {
    online,
    state,
    controllingPlayer,
    mode,
    wallLength,
    wallOrientation,
    cell,
    gap,
    error,
    roomNotice,
    abilityMode,
    showInfo,
    onSetMode,
    onSetWallLength,
    onSetWallOrientation,
    onMove,
    onPlaceWall,
    onAbilityCell,
    onAbilityWall,
    onAbilityDashFirst,
    onCancelAbility,
    onToggleInfo,
    onResolvePickup,
    onReset,
    onMenu,
    roomId,
  } = props;

  const viewAs: PlayerId = online ? controllingPlayer ?? "A" : "A";
  const meSlot = online ? controllingPlayer ?? "A" : state.turn;
  const me = state.players[meSlot];
  const isMyTurn = !online ? true : state.turn === controllingPlayer;
  const inAbility = abilityMode.kind !== "none";
  const canPickLen2 = me.walls.len2 > 0;
  const canPickLen3 = me.walls.len3 > 0;
  const isMyPickup =
    !!state.pendingPickup &&
    state.pendingPickup.player === (controllingPlayer ?? state.turn);

  const bottomId: PlayerId = viewAs;
  const topId: PlayerId = bottomId === "A" ? "B" : "A";

  return (
    <div className="app app--play">
      <div className="play__topbar">
        <button className="btn btn--ghost" onClick={onMenu}>
          ← {online ? "Leave" : "Menu"}
        </button>
        <div className="play__title">
          {online && roomId ? `Room ${roomId}` : "Grid Block Duel"}
        </div>
        <div className="play__topbar-right">
          <button
            className="btn btn--icon"
            title="What's in the loot box? (i)"
            onClick={onToggleInfo}
          >
            i
          </button>
          <button
            className="btn btn--ghost"
            onClick={onReset}
            disabled={online && state.status !== "finished"}
          >
            {online ? "Rematch" : "Reset"}
          </button>
        </div>
      </div>

      <div className="status">
        <PlayerStrip
          id={topId}
          name={state.players[topId].name}
          style={state.players[topId].style}
          walls={state.players[topId].walls}
          abilities={state.players[topId].abilities}
          showAbilities={!online || controllingPlayer === topId}
          activeSlot={
            controllingPlayer === topId && abilityMode.kind !== "none"
              ? "slot" in abilityMode
                ? (abilityMode as { slot: 0 | 1 }).slot
                : null
              : null
          }
          active={state.turn === topId && state.status === "playing"}
          side="top"
          scrambled={state.scramblePending?.victim === topId}
          onActivate={controllingPlayer === topId ? props.onActivateAbility : undefined}
        />
        <div className="turn-indicator">
          {state.status === "finished" ? (
            <strong>{state.players[state.winner!].name} wins!</strong>
          ) : online ? (
            <strong>
              {isMyTurn ? "Your turn" : `Waiting for ${state.players[state.turn].name}…`}
            </strong>
          ) : (
            <>
              Turn: <strong>{state.players[state.turn].name}</strong>
            </>
          )}
        </div>
        <PlayerStrip
          id={bottomId}
          name={state.players[bottomId].name + (online ? " (you)" : "")}
          style={state.players[bottomId].style}
          walls={state.players[bottomId].walls}
          abilities={state.players[bottomId].abilities}
          showAbilities={!online || controllingPlayer === bottomId}
          activeSlot={
            controllingPlayer === bottomId && abilityMode.kind !== "none"
              ? "slot" in abilityMode
                ? (abilityMode as { slot: 0 | 1 }).slot
                : null
              : null
          }
          active={state.turn === bottomId && state.status === "playing"}
          side="bottom"
          scrambled={state.scramblePending?.victim === bottomId}
          onActivate={controllingPlayer === bottomId ? props.onActivateAbility : undefined}
        />
      </div>

      <div className="board-wrap">
        <Board
          state={state}
          mode={mode}
          wallDraft={{ orientation: wallOrientation, length: wallLength }}
          cell={cell}
          gap={gap}
          viewAs={viewAs}
          controllingPlayer={online ? controllingPlayer ?? undefined : undefined}
          abilityMode={abilityMode}
          onMove={onMove}
          onPlaceWall={onPlaceWall}
          onAbilityCell={onAbilityCell}
          onAbilityWall={onAbilityWall}
          onAbilityDashFirst={onAbilityDashFirst}
        />
      </div>

      <div className="toolbar">
        <button
          className={mode === "move" && !inAbility ? "btn btn--active" : "btn"}
          onClick={() => {
            onCancelAbility();
            onSetMode("move");
          }}
        >
          Move <kbd>M</kbd>
        </button>
        <button
          className={mode === "wall" && wallLength === 2 && !inAbility ? "btn btn--active" : "btn"}
          disabled={!canPickLen2 || (online && !isMyTurn)}
          onClick={() => {
            onCancelAbility();
            // Toggle off if already active: go back to Move mode.
            if (mode === "wall" && wallLength === 2 && !inAbility) {
              onSetMode("move");
            } else {
              onSetMode("wall");
              onSetWallLength(2);
            }
          }}
        >
          Wall ×2 <kbd>2</kbd>
        </button>
        <button
          className={mode === "wall" && wallLength === 3 && !inAbility ? "btn btn--active" : "btn"}
          disabled={!canPickLen3 || (online && !isMyTurn)}
          onClick={() => {
            onCancelAbility();
            if (mode === "wall" && wallLength === 3 && !inAbility) {
              onSetMode("move");
            } else {
              onSetMode("wall");
              onSetWallLength(3);
            }
          }}
        >
          Wall ×3 <kbd>3</kbd>
        </button>
        <button
          className="btn"
          disabled={mode !== "wall" || inAbility}
          onClick={() => onSetWallOrientation((o) => (o === "h" ? "v" : "h"))}
          title="Rotate wall (R)"
        >
          Rotate ({wallOrientation === "h" ? "→" : "↓"}) <kbd>R</kbd>
        </button>
        {inAbility && (
          <button
            className="btn btn--cancel"
            onClick={onCancelAbility}
            title="Cancel ability (Esc)"
          >
            ✕ Cancel <kbd>Esc</kbd>
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {/* Info modal */}
      {showInfo && (
        <>
          <div className="modal-backdrop" aria-hidden onClick={onToggleInfo} />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter info-card">
              <h2>Loot boxes</h2>
              {state.lootBoxes.length > 0 ? (
                <div className="info-card__list">
                  {state.lootBoxes.map((box, i) => (
                    <div className="info-card__ability" key={i}>
                      <div
                        className={`lootbox lootbox--${ABILITY_INFO[box.ability].category} lootbox--display`}
                        aria-hidden
                      >
                        <span className="lootbox__glyph">{abilityIcon(box.ability)}</span>
                      </div>
                      <div className="info-card__ability-text">
                        <strong>{ABILITY_INFO[box.ability].name}</strong>
                        <p>{ABILITY_INFO[box.ability].desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="endcard__sub">
                  No loot boxes on the board right now.
                  {state.turnCount < 3 &&
                    ` Next one shows up in ${3 - state.turnCount} turn(s).`}
                </p>
              )}
              <div className="endcard__actions">
                <button className="btn btn--primary" onClick={onToggleInfo}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pickup modal */}
      {state.pendingPickup && isMyPickup && (
        <>
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter">
              <h2>Replace which ability?</h2>
              <p className="endcard__sub">
                You're full. Pick one of your two abilities to discard, or
                discard the new one.
              </p>
              <div className="pickup-grid">
                {state.players[state.pendingPickup.player].abilities.map(
                  (ab, i) => (
                    <button
                      key={i}
                      className="pickup-card"
                      onClick={() => onResolvePickup(i as 0 | 1)}
                    >
                      <span className="pickup-card__name">
                        {ABILITY_INFO[ab.id].name}
                      </span>
                      <span className="pickup-card__desc">
                        {ABILITY_INFO[ab.id].desc}
                      </span>
                      <span className="pickup-card__action">Discard</span>
                    </button>
                  ),
                )}
                <button
                  className="pickup-card pickup-card--new"
                  onClick={() => onResolvePickup("discard")}
                >
                  <span className="pickup-card__tag">NEW</span>
                  <span className="pickup-card__name">
                    {ABILITY_INFO[state.pendingPickup.ability].name}
                  </span>
                  <span className="pickup-card__desc">
                    {ABILITY_INFO[state.pendingPickup.ability].desc}
                  </span>
                  <span className="pickup-card__action">Discard new</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Disconnect notice (online only, not after game finished) */}
      {roomNotice && online && state.status !== "finished" && !state.pendingPickup && (
        <>
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter endcard--notice">
              <div className="endcard__icon" aria-hidden>!</div>
              <h2>{roomNotice}</h2>
              <p className="endcard__sub">
                The game can&apos;t continue without both players.
              </p>
              <div className="endcard__actions">
                <button className="btn btn--primary" onClick={onMenu}>
                  Back to menu
                </button>
                <button className="btn" onClick={props.onDismissNotice}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Win modal */}
      {state.status === "finished" && (
        <>
          <Confetti color={state.winner === "A" ? "#4ea3ff" : "#ff6b9a"} />
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true">
            <div className="endcard endcard--enter">
              <div className="endcard__pawn">
                <Pawn
                  player={state.winner!}
                  style={state.players[state.winner!].style}
                  size={64}
                  onBoard={false}
                />
              </div>
              <h2>{state.players[state.winner!].name} wins!</h2>
              <div className="endcard__actions">
                <button className="btn btn--primary" onClick={onReset}>
                  {online ? "Rematch" : "Play again"}
                </button>
                <button className="btn" onClick={onMenu}>
                  {online ? "Leave room" : "Main menu"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerStrip({
  id,
  name,
  style,
  walls,
  abilities,
  showAbilities,
  activeSlot,
  active,
  side,
  scrambled,
  onActivate,
}: {
  id: PlayerId;
  name: string;
  style: PawnStyle;
  walls: { len2: number; len3: number };
  abilities: AbilityCharge[];
  showAbilities: boolean;
  activeSlot: 0 | 1 | null;
  active: boolean;
  side: "top" | "bottom";
  scrambled: boolean;
  onActivate?: (slot: 0 | 1) => void;
}) {
  return (
    <div
      className={`player-strip player-strip--${id}${active ? " player-strip--active" : ""} player-strip--${side}`}
    >
      <div className="player-strip__avatar">
        <Pawn player={id} style={style} size={32} onBoard={false} />
      </div>
      <div className="player-strip__body">
        <div className="player-strip__name">
          {name}
          {scrambled && (
            <span className="badge badge--scrambled" title="Next wall will be shorter by 1">
              Scrambled
            </span>
          )}
        </div>
        <div className="player-strip__walls">
          ×2: <strong>{walls.len2}</strong> &nbsp;·&nbsp; ×3:{" "}
          <strong>{walls.len3}</strong>
        </div>
        <div className="ability-slots">
          {[0, 1].map((slotIdx) => {
            const slot = slotIdx as 0 | 1;
            const ab = abilities[slot];
            const isActive = activeSlot === slot;
            if (!ab) {
              return (
                <div key={slot} className="ability-slot ability-slot--empty">
                  ·
                </div>
              );
            }
            const visible = showAbilities;
            const info = ABILITY_INFO[ab.id];
            const categoryClass = visible ? ` ability-slot--${info.category}` : "";
            return (
              <button
                key={slot}
                className={`ability-slot${categoryClass}${isActive ? " ability-slot--active" : ""}${!visible ? " ability-slot--hidden" : ""}`}
                title={
                  visible
                    ? `${info.name} — ${info.desc}`
                    : "Hidden ability"
                }
                disabled={!onActivate || !visible}
                onClick={() => onActivate?.(slot)}
              >
                {visible ? abilityIcon(ab.id) : "?"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function abilityIcon(id: AbilityId): string {
  switch (id) {
    case "jumpWall":
      return "↟";
    case "dash":
      return "»";
    case "diagonalStep":
      return "⤢";
    case "breakWall":
      return "✕";
    case "trapWall":
      return "◈";
    case "scramble":
      return "≈";
  }
}

function useResponsiveBoard(size: number) {
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
    const gap = vw < 420 ? 6 : vw < 720 ? 8 : vw < 1100 ? 10 : 12;
    const verticalChrome = vw < 720 ? 280 : 320;
    const heightCap = Math.max(280, vh - verticalChrome);
    const sidePad = vw < 720 ? 24 : 48;
    const widthCap = Math.min(vw - sidePad, 880);
    const available = Math.min(widthCap, heightCap);
    const cell = Math.max(28, Math.floor((available - (size - 1) * gap) / size));
    return { cell, gap };
  }, [vw, vh, size]);
}
