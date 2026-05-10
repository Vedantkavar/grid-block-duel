import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./components/Board";
import Confetti from "./components/Confetti";
import CreateRoom from "./components/CreateRoom";
import GameSetup from "./components/GameSetup";
import JoinRoom from "./components/JoinRoom";
import Lobby from "./components/Lobby";
import MainMenu from "./components/MainMenu";
import OnlineMenu from "./components/OnlineMenu";
import Pawn from "./components/Pawn";
import { applyAction, createInitialState } from "./game/rules";
import {
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
import type { RoomSnapshot } from "./net/protocol";

type Screen =
  | "menu"
  | "setup-local"
  | "play-local"
  | "online-menu"
  | "online-create"
  | "online-join"
  | "online-lobby"
  | "play-online";

type Mode = "move" | "wall";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  // Local game state (hot-seat)
  const [localState, setLocalState] = useState<GameState>(() =>
    createInitialState(DEFAULT_CONFIG),
  );

  // Online state
  const [you, setYou] = useState<PlayerId | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);

  // Shared play UI state
  const [mode, setMode] = useState<Mode>("move");
  const [wallLength, setWallLength] = useState<WallLength>(2);
  const [wallOrientation, setWallOrientation] = useState<WallOrientation>("h");
  const [error, setError] = useState<string | null>(null);

  const isOnline = screen === "play-online";
  const activeState: GameState = isOnline && snapshot ? snapshot.state : localState;
  const { cell, gap } = useResponsiveBoard(activeState.size);

  // ----- Socket lifecycle -----
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
      s.on("roomState", (snap) => {
        setSnapshot(snap);
      });
      s.on("roomClosed", (reason) => {
        setRoomNotice(reason);
      });
    }
    return socketRef.current;
  }

  // Keyboard shortcuts (only while playing)
  useEffect(() => {
    if (screen !== "play-local" && screen !== "play-online") return;
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "m") setMode("move");
      else if (k === "w") setMode("wall");
      else if (k === "r") setWallOrientation((o) => (o === "h" ? "v" : "h"));
      else if (k === "2") {
        setMode("wall");
        setWallLength(2);
      } else if (k === "3") {
        setMode("wall");
        setWallLength(3);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  // ----- Local flow -----
  function handleStartLocal(cfg: GameConfig) {
    setConfig(cfg);
    setLocalState(createInitialState(cfg));
    setMode("move");
    setError(null);
    setRoomNotice(null);
    setScreen("play-local");
  }

  function handleLocalMove(to: Coord) {
    const result = applyAction(localState, {
      type: "move",
      player: localState.turn,
      to,
    });
    if (result.ok) {
      setLocalState(result.state);
      setError(null);
    } else flashError(result.reason);
  }

  function handleLocalWall(wall: Omit<Wall, "owner">) {
    const result = applyAction(localState, {
      type: "placeWall",
      player: localState.turn,
      wall,
    });
    if (result.ok) {
      setLocalState(result.state);
      setMode("move");
      setError(null);
    } else flashError(result.reason);
  }

  function resetLocal() {
    setLocalState(createInitialState(config));
    setMode("move");
    setError(null);
  }

  // ----- Online flow -----
  function handleCreateRoom(data: {
    name: string;
    style: PawnStyle;
    config: GameConfig;
  }) {
    const s = ensureSocket();
    setBusy(true);
    s.emit(
      "createRoom",
      { name: data.name, style: data.style, config: data.config },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          flashError(res.reason);
          return;
        }
        setYou("A");
        setSnapshot(res.snapshot);
        setRoomNotice(null);
        setScreen("online-lobby");
      },
    );
  }

  function handleJoinRoom(data: { roomId: string; name: string; style: PawnStyle }) {
    const s = ensureSocket();
    setBusy(true);
    setJoinError(null);
    s.emit(
      "joinRoom",
      { roomId: data.roomId, name: data.name, style: data.style },
      (res) => {
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
      },
    );
  }

  function handleOnlineMove(to: Coord) {
    if (!socketRef.current || !you) return;
    socketRef.current.emit("action", { type: "move", player: you, to }, (res) => {
      if (!res.ok) flashError(res.reason);
    });
  }

  function handleOnlineWall(wall: Omit<Wall, "owner">) {
    if (!socketRef.current || !you) return;
    socketRef.current.emit(
      "action",
      { type: "placeWall", player: you, wall },
      (res) => {
        if (!res.ok) flashError(res.reason);
        else setMode("move");
      },
    );
  }

  function leaveRoom() {
    if (socketRef.current) {
      socketRef.current.emit("leaveRoom");
    }
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
  }

  function handleOnlineRematch() {
    socketRef.current?.emit("rematch");
  }

  // Auto-advance host from lobby to play once player 2 has joined.
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

  // -------- Screen routing --------

  if (screen === "menu") {
    return (
      <MainMenu
        onPlayLocal={() => setScreen("setup-local")}
        onPlayOnline={() => setScreen("online-menu")}
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
    return (
      <Lobby
        roomId={snapshot.roomId}
        onCancel={backToMenu}
      />
    );
  }

  // Play screen — local or online
  return (
    <PlayScreen
      online={isOnline}
      state={activeState}
      controllingPlayer={isOnline ? you : null}
      mode={mode}
      wallLength={wallLength}
      wallOrientation={wallOrientation}
      cell={cell}
      gap={gap}
      error={error}
      roomNotice={roomNotice}
      onDismissNotice={() => setRoomNotice(null)}
      onSetMode={setMode}
      onSetWallLength={setWallLength}
      onSetWallOrientation={setWallOrientation}
      onMove={isOnline ? handleOnlineMove : handleLocalMove}
      onPlaceWall={isOnline ? handleOnlineWall : handleLocalWall}
      onReset={isOnline ? handleOnlineRematch : resetLocal}
      onMenu={backToMenu}
      roomId={isOnline ? snapshot?.roomId : undefined}
    />
  );
}

// ============================================================
// PLAY SCREEN
// ============================================================

function PlayScreen({
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
  onDismissNotice,
  onSetMode,
  onSetWallLength,
  onSetWallOrientation,
  onMove,
  onPlaceWall,
  onReset,
  onMenu,
  roomId,
}: {
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
  onDismissNotice: () => void;
  onSetMode: (m: Mode) => void;
  onSetWallLength: (n: WallLength) => void;
  onSetWallOrientation: (o: WallOrientation | ((o: WallOrientation) => WallOrientation)) => void;
  onMove: (to: Coord) => void;
  onPlaceWall: (wall: Omit<Wall, "owner">) => void;
  onReset: () => void;
  onMenu: () => void;
  roomId?: string;
}) {
  const viewAs: PlayerId = online ? controllingPlayer ?? "A" : "A";
  const meSlot = online ? controllingPlayer ?? "A" : state.turn;
  const me = state.players[meSlot];
  const isMyTurn = !online ? true : state.turn === controllingPlayer;
  const canPickLen2 = me.walls.len2 > 0;
  const canPickLen3 = me.walls.len3 > 0;

  // For the player strips: in online mode, "me" is always at the bottom.
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
        <button className="btn btn--ghost" onClick={onReset} disabled={online && state.status !== "finished"}>
          {online ? "Rematch" : "Reset"}
        </button>
      </div>

      <div className="status">
        <PlayerStrip
          id={topId}
          name={state.players[topId].name}
          style={state.players[topId].style}
          walls={state.players[topId].walls}
          active={state.turn === topId && state.status === "playing"}
          side="top"
        />
        <div className="turn-indicator">
          {state.status === "finished" ? (
            <strong>
              {state.players[state.winner!].name} wins!
            </strong>
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
          active={state.turn === bottomId && state.status === "playing"}
          side="bottom"
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
          onMove={onMove}
          onPlaceWall={onPlaceWall}
        />
      </div>

      <div className="toolbar">
        <button
          className={mode === "move" ? "btn btn--active" : "btn"}
          onClick={() => onSetMode("move")}
        >
          Move <kbd>M</kbd>
        </button>
        <button
          className={mode === "wall" && wallLength === 2 ? "btn btn--active" : "btn"}
          disabled={!canPickLen2 || (online && !isMyTurn)}
          onClick={() => {
            onSetMode("wall");
            onSetWallLength(2);
          }}
        >
          Wall ×2 <kbd>2</kbd>
        </button>
        <button
          className={mode === "wall" && wallLength === 3 ? "btn btn--active" : "btn"}
          disabled={!canPickLen3 || (online && !isMyTurn)}
          onClick={() => {
            onSetMode("wall");
            onSetWallLength(3);
          }}
        >
          Wall ×3 <kbd>3</kbd>
        </button>
        <button
          className="btn"
          disabled={mode !== "wall"}
          onClick={() => onSetWallOrientation((o) => (o === "h" ? "v" : "h"))}
          title="Rotate wall (R)"
        >
          Rotate ({wallOrientation === "h" ? "→" : "↓"}) <kbd>R</kbd>
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {roomNotice && online && state.status !== "finished" && (
        <>
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="notice-title">
            <div className="endcard endcard--enter endcard--notice">
              <div className="endcard__icon" aria-hidden>!</div>
              <h2 id="notice-title">{roomNotice}</h2>
              <p className="endcard__sub">The game can&apos;t continue without both players.</p>
              <div className="endcard__actions">
                <button className="btn btn--primary" onClick={onMenu}>
                  Back to menu
                </button>
                <button className="btn" onClick={onDismissNotice}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {state.status === "finished" && (
        <>
          <Confetti color={state.winner === "A" ? "#4ea3ff" : "#ff6b9a"} />
          <div className="modal-backdrop" aria-hidden />
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
            <div className="endcard endcard--enter">
              <div className="endcard__pawn">
                <Pawn
                  player={state.winner!}
                  style={state.players[state.winner!].style}
                  size={64}
                  onBoard={false}
                />
              </div>
              <h2 id="win-title">{state.players[state.winner!].name} wins!</h2>
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
  active,
  side,
}: {
  id: PlayerId;
  name: string;
  style: PawnStyle;
  walls: { len2: number; len3: number };
  active: boolean;
  side: "top" | "bottom";
}) {
  return (
    <div
      className={`player-strip player-strip--${id}${active ? " player-strip--active" : ""} player-strip--${side}`}
    >
      <div className="player-strip__avatar">
        <Pawn player={id} style={style} size={32} onBoard={false} />
      </div>
      <div className="player-strip__body">
        <div className="player-strip__name">{name}</div>
        <div className="player-strip__walls">
          ×2: <strong>{walls.len2}</strong> &nbsp;·&nbsp; ×3:{" "}
          <strong>{walls.len3}</strong>
        </div>
      </div>
    </div>
  );
}

function useResponsiveBoard(size: number) {
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerWidth,
  );
  useEffect(() => {
    function onResize() {
      setVw(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return useMemo(() => {
    const gap = vw < 420 ? 6 : vw < 720 ? 8 : 10;
    const available = Math.min(vw - 24, 640);
    const cell = Math.max(24, Math.floor((available - (size - 1) * gap) / size));
    return { cell, gap };
  }, [vw, size]);
}
