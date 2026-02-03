"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Home() {
  const sendCommand = useMutation(api.commands.send);
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pathoma Controller
        </h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-8">
        <SignedOut>
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Welcome
              </h2>
              <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                Sign in to control video playback remotely.
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="rounded-lg bg-zinc-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                Sign In
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Video Controller
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Send commands to control video playback
              </p>
            </div>

            {/* Command Buttons */}
            <div className="flex flex-col gap-6">
              {/* Play/Pause Row */}
              <div className="flex gap-4">
                <button
                  onClick={() => sendCommand({ type: "play" })}
                  className="rounded-lg bg-green-600 px-8 py-4 font-semibold text-white transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50"
                >
                  Play
                </button>
                <button
                  onClick={() => sendCommand({ type: "pause" })}
                  className="rounded-lg bg-red-600 px-8 py-4 font-semibold text-white transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
                >
                  Pause
                </button>
              </div>

              {/* Seek Backward Row */}
              <div className="flex flex-col gap-2">
                <div className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Seek Backward
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekBackward", amount: 1 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekBackward", amount: 5 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    -5s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekBackward", amount: 10 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    -10s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekBackward", amount: 30 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    -30s
                  </button>
                </div>
              </div>

              {/* Seek Forward Row */}
              <div className="flex flex-col gap-2">
                <div className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Seek Forward
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekForward", amount: 1 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    +1s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekForward", amount: 5 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    +5s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekForward", amount: 10 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    +10s
                  </button>
                  <button
                    onClick={() =>
                      sendCommand({ type: "seekForward", amount: 30 })
                    }
                    className="flex-1 rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-600 active:scale-95 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  >
                    +30s
                  </button>
                </div>
              </div>

              {/* Speed Control Row */}
              <div className="flex flex-col gap-2">
                <div className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Playback Speed
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => sendCommand({ type: "speedDown", amount: 0.1 })}
                    className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
                  >
                    Slower (-0.1x)
                  </button>
                  <button
                    onClick={() => sendCommand({ type: "speedUp", amount: 0.1 })}
                    className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
                  >
                    Faster (+0.1x)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
