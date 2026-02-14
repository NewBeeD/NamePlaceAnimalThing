"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateGameCode, clampRounds } from "../../lib/game-utils";
import { getSocket } from "../../lib/socket";
import { useGameStore } from "../../store/game-store";

const CATEGORY_OPTIONS = [
  "Name",
  "Place",
  "Animal",
  "Thing",
  "City",
  "Country",
  "Food",
  "Movie",
  "Brand",
];

const CONTEXT_OPTIONS = ["Bible", "Mythology", "History", "Science", "Movies", "Custom"];

export default function CreatePage() {
  const router = useRouter();
  const { setSession, setError } = useGameStore();

  const [username, setUsername] = useState("");
  const [rounds, setRounds] = useState(3);
  const [categories, setCategories] = useState<string[]>(["Name", "Place", "Animal", "Thing"]);
  const [contextOption, setContextOption] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const toggleCategory = (category: string) => {
    setCategories((previous) => {
      if (previous.includes(category)) {
        return previous.filter((entry) => entry !== category);
      }

      if (previous.length >= 4) {
        return previous;
      }

      return [...previous, category];
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setError(null);

    const cleanName = username.trim();
    if (!cleanName) {
      setFormError("Username is required.");
      return;
    }

    if (categories.length === 0 || categories.length > 4) {
      setFormError("Choose between 1 and 4 categories.");
      return;
    }

    const context = contextOption === "Custom" ? customContext.trim() : contextOption;
    if (contextOption === "Custom" && !context) {
      setFormError("Custom context is required when Custom is selected.");
      return;
    }

    setSubmitting(true);

    try {
      const code = generateGameCode();
      const userId = crypto.randomUUID();
      const socket = await getSocket();

      socket.emit(
        "join-room",
        {
          code,
          userId,
          username: cleanName,
          settings: {
            rounds: clampRounds(rounds),
            categories,
            context: context.trim(),
          },
        },
        (response: { ok: boolean; message?: string }) => {
          if (!response?.ok) {
            setFormError(response?.message || "Could not create game.");
            setSubmitting(false);
            return;
          }

          setSession({ userId, username: cleanName, code });
          router.push(`/game/${code}`);
        },
      );
    } catch {
      setFormError("Socket connection failed.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d4ed8_0%,_#312e81_40%,_#0f172a_100%)] px-4 py-6 text-white sm:px-6">
      <form onSubmit={onSubmit} className="glass-panel mx-auto w-full max-w-3xl space-y-5 p-5 sm:p-6">
        <h1 className="text-3xl font-extrabold">Create Game</h1>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Number of Rounds (1-10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={rounds}
            onChange={(event) => setRounds(clampRounds(Number(event.target.value)))}
            className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Categories (up to 4)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORY_OPTIONS.map((category) => (
              <label key={category} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                {category}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Category (optional)</label>
          <select
            value={contextOption}
            onChange={(event) => setContextOption(event.target.value)}
            className="w-full rounded-xl border border-white/25 bg-white/10 p-3 text-white"
          >
            <option value="" className="bg-white text-slate-900">No category lock</option>
            {CONTEXT_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-white text-slate-900">
                {option}
              </option>
            ))}
          </select>

          {contextOption === "Custom" ? (
            <input
              value={customContext}
              onChange={(event) => setCustomContext(event.target.value)}
              className="w-full rounded-xl border border-white/25 bg-white/10 p-3"
              placeholder="Type custom context"
              maxLength={80}
              required
            />
          ) : null}

          <p className="text-xs opacity-75">When set, AI grading validates answers inside this selected category theme.</p>
        </div>

        {formError ? <p className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{formError}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={submitting || (contextOption === "Custom" && !customContext.trim())}
            className="fun-button disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Game"}
          </button>
          <Link href="/" className="soft-button text-center">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
