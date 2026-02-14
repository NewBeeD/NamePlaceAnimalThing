"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/store/game-store";

export default function JoinPage() {
  const router = useRouter();
  const { setSession, setError } = useGameStore();

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const onJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setError(null);

    const cleanName = username.trim();
    const cleanCode = code.trim();

    if (!cleanName) {
      setFormError("Username is required.");
      return;
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      setFormError("Game code must be a valid 6-digit number.");
      return;
    }

    setLoading(true);

    try {
      const userId = crypto.randomUUID();
      const socket = await getSocket();

      socket.emit(
        "join-room",
        {
          code: cleanCode,
          userId,
          username: cleanName,
        },
        (response: { ok: boolean; message?: string }) => {
          if (!response?.ok) {
            const message = response?.message || "Room not found.";
            setFormError(message);
            setError(message);
            setLoading(false);
            return;
          }

          setSession({ userId, username: cleanName, code: cleanCode });
          router.push(`/game/${cleanCode}`);
        },
      );
    } catch {
      setFormError("Socket connection failed.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#db2777_0%,_#4c1d95_45%,_#0f172a_100%)] px-4 py-6 text-white sm:px-6">
      <form onSubmit={onJoin} className="glass-panel mx-auto w-full max-w-xl space-y-4 p-5 sm:p-6">
        <h1 className="text-3xl font-extrabold">Join Existing Game</h1>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">6-digit Game Code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
          />
        </div>

        {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{formError}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={loading} className="fun-button disabled:opacity-60">
            {loading ? "Joining..." : "Join"}
          </button>
          <Link href="/" className="soft-button text-center">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
