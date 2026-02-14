"use client";

import Link from "next/link";
import { useState } from "react";

export default function HomePage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#7c3aed_0%,_#312e81_35%,_#0f172a_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[92vh] w-full max-w-3xl flex-col items-center justify-center gap-6 text-center">
        <p className="rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest">
          Multiplayer Party Game
        </p>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">Name Place Animal Things</h1>
        <p className="max-w-xl text-sm opacity-90 sm:text-base">
          Fast rounds, vibrant fun, and realtime competition with your friends.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass-panel w-full p-5 text-left transition hover:scale-[1.01]"
        >
          <h2 className="text-xl font-bold">How to Play</h2>
          <p className="mt-2 text-sm opacity-90">Tap to view rules, round flow, and AI grading.</p>
        </button>

        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/join" className="fun-button w-full text-center sm:w-auto">
            Join Existing Game
          </Link>
          <Link href="/create" className="soft-button w-full text-center sm:w-auto">
            Create Game
          </Link>
        </div>

        <p className="mt-4 text-xs font-medium text-cyan-100/90 sm:text-sm">
          Powered by OpenAI — AI grading checks category fit, starting letter, and answer quality each round.
        </p>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-panel w-full max-w-2xl bg-slate-900/90 p-6">
            <h3 className="text-2xl font-bold">How to Play</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 opacity-90">
              <li>Players fill up to 4 categories (Name, Place, Animal, Thing or custom picks).</li>
              <li>Each round starts with a random letter; every answer must start with that letter.</li>
              <li>As soon as one player submits, the round pauses for everyone and moves to AI grading.</li>
              <li>AI grading checks validity and uniqueness; if AI is unavailable, the game falls back to manual peer scoring.</li>
              <li>After multiple rounds, final totals decide the podium winners.</li>
            </ul>
            <div className="mt-6 text-right">
              <button type="button" onClick={() => setOpen(false)} className="soft-button px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
