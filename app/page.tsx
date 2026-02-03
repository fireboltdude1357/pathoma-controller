"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";

export default function Home() {
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
                Control buttons will appear here
              </p>
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
