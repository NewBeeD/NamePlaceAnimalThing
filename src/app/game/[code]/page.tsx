"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/store/game-store";
import type { GameRoomState } from "@/types/game";

const AVATARS = ["🕺", "💃", "🐼", "🦊", "🐸", "🦄", "🐯", "🐨", "🐵", "🐧"];

const avatarForUser = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return AVATARS[Math.abs(hash) % AVATARS.length];
};

const reasonStyles: Record<string, string> = {
  unique: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  duplicate: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  invalid: "bg-rose-500/20 text-rose-200 border-rose-400/40",
  empty: "bg-slate-500/20 text-slate-200 border-slate-400/40",
  manual: "bg-violet-500/20 text-violet-200 border-violet-400/40",
};

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const roomCode = params.code;

  const { session, game, setGame, setError, reset } = useGameStore();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scoreSheet, setScoreSheet] = useState<Record<string, Record<string, number>>>({});
  const [status, setStatus] = useState("");
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  const me = game?.users.find((user) => user.id === session?.userId);
  const isHost = Boolean(me?.isHost);

  useEffect(() => {
    if (!session || session.code !== roomCode) {
      router.replace("/join");
      return;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const socket = await getSocket();

        const handleRoomState = (room: GameRoomState) => {
          if (!mounted || room.code !== roomCode) {
            return;
          }

          setGame(room);
          setStatus("");
        };

        const handleRoundStart = () => {
          if (!mounted) {
            return;
          }

          setAnswers({});
          setStatus("New round started.");
        };

        const handleSubmitError = (payload: { message?: string }) => {
          if (!mounted) {
            return;
          }

          setStatus(payload?.message || "Could not submit response.");
        };

        const handleAiComplete = () => {
          if (!mounted) {
            return;
          }

          setStatus("AI grading complete.");
        };

        const handleManualScoringRequired = () => {
          if (!mounted) {
            return;
          }

          setStatus("AI unavailable. Switching to peer scoring for this round.");
        };

        const handleScoresSubmitted = (payload: { submitted: number; expected: number }) => {
          if (!mounted) {
            return;
          }

          setStatus(`Scores submitted: ${payload.submitted}/${payload.expected}`);
        };

        const handleGameEnd = () => {
          if (!mounted) {
            return;
          }

          setStatus("Game ended.");
        };

        const handleRoomClosed = (payload: { reason?: string }) => {
          if (!mounted) {
            return;
          }

          setStatus(payload?.reason || "Host left. Room closed.");
          setTimeout(() => {
            reset();
            router.replace("/");
          }, 900);
        };

        socket.on("room-state", handleRoomState);
        socket.on("round-start", handleRoundStart);
        socket.on("submit-error", handleSubmitError);
        socket.on("ai-grading-complete", handleAiComplete);
        socket.on("manual-scoring-required", handleManualScoringRequired);
        socket.on("scores-submitted", handleScoresSubmitted);
        socket.on("game-end", handleGameEnd);
        socket.on("room-closed", handleRoomClosed);

        socket.emit("join-room", {
          code: session.code,
          userId: session.userId,
          username: session.username,
        });

        return () => {
          socket.off("room-state", handleRoomState);
          socket.off("round-start", handleRoundStart);
          socket.off("submit-error", handleSubmitError);
          socket.off("ai-grading-complete", handleAiComplete);
          socket.off("manual-scoring-required", handleManualScoringRequired);
          socket.off("scores-submitted", handleScoresSubmitted);
          socket.off("game-end", handleGameEnd);
          socket.off("room-closed", handleRoomClosed);
        };
      } catch {
        setError("Socket connection failed.");
      }
    };

    const cleanupPromise = setup();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [reset, roomCode, router, session, setError, setGame]);

  useEffect(() => {
    if (!game || !session || game.phase !== "play") {
      return;
    }

    const socketPromise = getSocket();
    socketPromise.then((socket) => {
      socket.emit("draft-response", {
        code: game.code,
        userId: session.userId,
        answers,
      });
    });
  }, [answers, game, session]);

  useEffect(() => {
    if (!game || game.phase !== "play" || !game.roundEndsAt) {
      return;
    }

    setNowTimestamp(Date.now());
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [game]);

  useEffect(() => {
    if (!game || !session || game.phase !== "scoring") {
      return;
    }

    const assignedTargets = game.scoringAssignments?.[session.userId] || [];
    const initial: Record<string, Record<string, number>> = {};
    for (const targetId of assignedTargets) {
      initial[targetId] = {};
      for (const category of game.settings.categories) {
        const isLockedDuplicate = Boolean(game.manualScoreLocks?.[targetId]?.[category]);
        initial[targetId][category] = isLockedDuplicate ? 5 : 0;
      }
    }

    setScoreSheet(initial);
  }, [game, session]);

  const startGame = async () => {
    const socket = await getSocket();
    socket.emit("start-game", { code: roomCode });
  };

  const submitResponse = async () => {
    if (!session || !game) {
      return;
    }

    const allFilled = game.settings.categories.every((category) => Boolean(String(answers[category] || "").trim()));
    if (!allFilled) {
      setStatus("Fill all fields before submitting.");
      return;
    }

    const socket = await getSocket();
    socket.emit("submit-response", {
      code: game.code,
      userId: session.userId,
      answers,
    });
  };

  const goNextStage = async () => {
    if (!game) {
      return;
    }

    const socket = await getSocket();
    socket.emit("next-stage", {
      code: game.code,
    });
  };

  const submitScores = async () => {
    if (!game || !session || game.phase !== "scoring") {
      return;
    }

    const socket = await getSocket();
    socket.emit("submit-scores", {
      code: game.code,
      userId: session.userId,
      scores: scoreSheet,
    });
  };

  const sortedPlayers = useMemo(() => {
    if (!game) {
      return [];
    }

    return [...game.users].sort((a, b) => (game.totalScores[b.id] || 0) - (game.totalScores[a.id] || 0));
  }, [game]);

  const podium = sortedPlayers.slice(0, 3);
  const mySubmitted = session ? Boolean(game?.currentAnswers?.[session.userId]) : false;
  const scoringTargetIds = session && game?.phase === "scoring"
    ? (game.scoringAssignments?.[session.userId] || [])
    : [];
  const scoringTargets = game?.users.filter((player) => scoringTargetIds.includes(player.id)) || [];
  const timeLeftMs = game?.phase === "play" && game?.roundEndsAt
    ? Math.max(0, game.roundEndsAt - nowTimestamp)
    : 0;
  const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);
  const minutesPart = String(Math.floor(timeLeftSeconds / 60)).padStart(2, "0");
  const secondsPart = String(timeLeftSeconds % 60).padStart(2, "0");

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setStatus("Game code copied.");
  };

  const onExit = async () => {
    try {
      if (session) {
        const socket = await getSocket();
        await new Promise<void>((resolve) => {
          socket.emit(
            "leave-room",
            {
              code: session.code,
              userId: session.userId,
            },
            () => resolve(),
          );
          setTimeout(() => resolve(), 600);
        });
      }
    } finally {
      reset();
      router.replace("/");
    }
  };

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#06b6d4_0%,_#4f46e5_40%,_#0f172a_100%)] px-4 py-4 text-white sm:px-6 sm:py-6">
      {game?.phase === "scoring" ? (
        <div className="mx-auto mb-3 w-full max-w-6xl rounded-xl border border-amber-300/50 bg-amber-400/20 px-4 py-3 text-center text-sm font-semibold text-amber-100">
          AI offline — manual scoring enabled
        </div>
      ) : null}

      {(!game || game.phase === "lobby") ? (
        <header className="glass-panel mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl">Game Room {roomCode}</h1>
            <p className="text-xs opacity-80 sm:text-sm">Player: {session.username}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button type="button" onClick={copyCode} className="soft-button w-full px-3 py-2 text-sm sm:w-auto">
              Copy Code
            </button>
            <button type="button" onClick={onExit} className="soft-button w-full px-3 py-2 text-sm sm:w-auto">
              Exit
            </button>
          </div>
        </header>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl justify-end">
          <button type="button" onClick={onExit} className="soft-button px-4 py-2 mb-2 text-sm">
            Exit
          </button>
        </div>
      )}

      {status ? <p className="glass-panel mx-auto w-full max-w-6xl p-3 text-sm">{status}</p> : null}

      {!game ? (
        <section className="glass-panel mx-auto w-full max-w-6xl p-6">
          <p>Connecting to room...</p>
        </section>
      ) : null}

      {game?.phase === "lobby" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">Lobby</h2>
          <p className="text-sm opacity-80">
            Rounds: {game.settings.rounds} • AI Grading • Categories: {" "}
            {game.settings.categories.join(", ")}
          </p>
          {game.settings.context ? <p className="text-sm font-medium text-cyan-100">Context lock: {game.settings.context}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {game.users.map((user) => (
              <div key={user.id} className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center shadow-lg">
                <div className="dance-bob" style={{ animationDelay: `${(user.id.length % 4) * 0.12}s` }}>
                  <div className="dance-sway mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
                    {avatarForUser(user.id)}
                  </div>
                </div>
                <p className="font-semibold">{user.username}</p>
                <p className="text-xs opacity-80">{user.isHost ? "Host" : "Player"}</p>
              </div>
            ))}
          </div>

          {isHost ? (
            <button type="button" onClick={startGame} className="fun-button w-full sm:w-auto">
              Start Game
            </button>
          ) : (
            <p className="text-sm opacity-80">Waiting for host to start game...</p>
          )}
        </section>
      ) : null}

      {game?.phase === "play" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">Round {game.currentRound}</h2>
          <p className="text-base sm:text-lg">
            Letter: <span className="text-3xl font-bold">{game.currentLetter}</span>
          </p>
          <p className="text-sm font-semibold text-cyan-100">
            Time left: {minutesPart}:{secondsPart}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {game.settings.categories.map((category) => (
              <label key={category} className="space-y-1">
                <span className="text-sm font-medium">{category}</span>
                <input
                  value={answers[category] || ""}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setAnswers((previous) => ({ ...previous, [category]: nextValue }));
                  }}
                  className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
                  placeholder={`${game.currentLetter}...`}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={submitResponse}
            className="fun-button w-full sm:w-auto"
            disabled={
              mySubmitted || !game.settings.categories.every((category) => Boolean(String(answers[category] || "").trim()))
            }
          >
            {mySubmitted ? "Submitted" : "Submit Response"}
          </button>
        </section>
      ) : null}

      {game?.phase === "ai-grading" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">AI is grading responses...</h2>
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <p className="text-sm opacity-90">Checking validity, duplicates, and unique answers.</p>
          </div>
        </section>
      ) : null}

      {game?.phase === "scoring" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">Manual Peer Scoring (AI Fallback)</h2>
          <p className="text-sm opacity-80">AI is unavailable. Score your assigned player(s) as 0, 5, or 10.</p>
          {isHost && game.users.length % 2 === 1 ? (
            <p className="text-xs text-violet-200/90">Odd players: host scores one extra submission.</p>
          ) : null}

          <div className="space-y-4">
            {scoringTargets.map((player) => (
              <div key={player.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="font-semibold">{player.username}</p>
                <div className="mt-2 space-y-2">
                  {game.settings.categories.map((category) => (
                    <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/5 p-2 text-sm">
                      {(() => {
                        const isLockedDuplicate = Boolean(game.manualScoreLocks?.[player.id]?.[category]);
                        const currentValue = isLockedDuplicate ? 5 : (scoreSheet[player.id]?.[category] ?? 0);
                        return (
                          <>
                      <p className="min-w-0 flex-1">
                        <span className="font-medium">{category}:</span> {game.currentAnswers[player.id]?.[category] || "-"}
                        {isLockedDuplicate ? (
                          <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            Matched
                          </span>
                        ) : null}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isLockedDuplicate) {
                              return;
                            }

                            const current = scoreSheet[player.id]?.[category] ?? 0;
                            const next = Math.max(0, current - 5);

                            setScoreSheet((previous) => ({
                              ...previous,
                              [player.id]: {
                                ...(previous[player.id] || {}),
                                [category]: next,
                              },
                            }));
                          }}
                          disabled={isLockedDuplicate || currentValue <= 0}
                          className="soft-button px-3 py-1 text-sm disabled:opacity-40"
                        >
                          −
                        </button>

                        <span className="w-10 text-center text-base font-bold">
                          {currentValue}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (isLockedDuplicate) {
                              return;
                            }

                            const current = scoreSheet[player.id]?.[category] ?? 0;
                            const next = Math.min(10, current + 5);

                            setScoreSheet((previous) => ({
                              ...previous,
                              [player.id]: {
                                ...(previous[player.id] || {}),
                                [category]: next,
                              },
                            }));
                          }}
                          disabled={isLockedDuplicate || currentValue >= 10}
                          className="soft-button px-3 py-1 text-sm disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {scoringTargets.length === 0 ? (
            <p className="text-sm opacity-80">No assignment available right now.</p>
          ) : null}

          <button
            type="button"
            onClick={submitScores}
            className="fun-button w-full sm:w-auto"
            disabled={scoringTargets.length === 0}
          >
            Submit Scores
          </button>
        </section>
      ) : null}

      {game?.phase === "round-breakdown" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-5 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold">AI Score Breakdown - Round {game.currentRound}</h2>

          <div className="space-y-2">
            {game.users.map((player) => (
              <div key={player.id} className="rounded-xl border border-white/20 bg-white/10 p-3">
                <p className="mb-2 font-semibold">{player.username}</p>
                <div className="space-y-2">
                  {game.settings.categories.map((category) => {
                    const row = game.roundBreakdown?.[player.id]?.[category];
                    const reason = row?.reason || "empty";
                    return (
                      <div key={category} className="flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          {category}: {row?.answer || "-"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reasonStyles[reason] || reasonStyles.empty}`}
                          >
                            {reason}
                          </span>
                          <span className="font-semibold">{row?.points ?? 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {isHost ? (
            <button type="button" onClick={goNextStage} className="fun-button w-full sm:w-auto">
              Next
            </button>
          ) : (
            <p className="text-sm opacity-80">Waiting for host to continue...</p>
          )}
        </section>
      ) : null}

      {game?.phase === "round-results" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-5 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold">🏁 Leaderboard - Round {game.currentRound}</h2>

          <div className="space-y-2">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-xl border p-3 text-sm ${
                  index === 0 ? "border-yellow-300/60 bg-yellow-300/10" : "border-white/20 bg-white/10"
                }`}
              >
                <span className="flex items-center gap-2">
                  {index === 0 ? <span>🥇</span> : null}
                  {index === 1 ? <span>🥈</span> : null}
                  {index === 2 ? <span>🥉</span> : null}
                  <span>{index + 1}. {player.username}</span>
                </span>
                <span>{game.totalScores[player.id] || 0}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button type="button" onClick={goNextStage} className="fun-button w-full sm:w-auto">
              {game.currentRound >= game.settings.rounds ? "Finish Game" : "Next Round"}
            </button>
          ) : (
            <p className="text-sm opacity-80">
              Waiting for host to {game.currentRound >= game.settings.rounds ? "finish game" : "start the next round"}...
            </p>
          )}
        </section>
      ) : null}

      {game?.phase === "ended" ? (
        <section className="glass-panel mx-auto w-full max-w-6xl space-y-6 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold">🎉 Final Podium</h2>

          <div className="grid items-end gap-3 sm:grid-cols-3">
            {podium[1] ? (
              <div className="rounded-2xl border border-slate-300/70 bg-gradient-to-br from-slate-300/25 to-slate-600/20 p-3 text-center shadow-lg sm:h-28">
                <p className="text-2xl">🥈</p>
                <p className="font-semibold">{podium[1].username}</p>
                <p className="text-sm">{game.totalScores[podium[1].id] || 0}</p>
              </div>
            ) : (
              <div />
            )}
            {podium[0] ? (
              <div className="rounded-2xl border border-yellow-300/70 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 p-3 text-center shadow-xl sm:h-36">
                <p className="text-3xl">🥇</p>
                <p className="font-semibold">{podium[0].username}</p>
                <p className="text-sm">{game.totalScores[podium[0].id] || 0}</p>
              </div>
            ) : (
              <div />
            )}
            {podium[2] ? (
              <div className="rounded-2xl border border-amber-700/70 bg-gradient-to-br from-amber-500/25 to-orange-700/20 p-3 text-center shadow-lg sm:h-24">
                <p className="text-2xl">🥉</p>
                <p className="font-semibold">{podium[2].username}</p>
                <p className="text-sm">{game.totalScores[podium[2].id] || 0}</p>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">All Players</h3>
            {sortedPlayers.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
                <span>
                  {index + 1}. {player.username}
                </span>
                <span>{game.totalScores[player.id] || 0}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className="fun-button text-center">
              Play Again
            </Link>
            <button type="button" onClick={onExit} className="soft-button">
              Exit
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
