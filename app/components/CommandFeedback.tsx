"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";

export function CommandFeedback() {
  const recentCommand = useQuery(api.commands.getRecent, { limit: 1 });
  const [visible, setVisible] = useState(false);
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);

  useEffect(() => {
    if (!recentCommand || recentCommand.length === 0) {
      return;
    }

    const command = recentCommand[0];
    const commandId = command._id;

    // Check if command is too old (more than 5 seconds)
    const commandAge = Date.now() - command.createdAt;
    if (commandAge > 5000) {
      setVisible(false);
      return;
    }

    // New command detected
    if (commandId !== lastCommandId) {
      setLastCommandId(commandId);
      setVisible(true);
    }

    // If command is acknowledged, start 2-second auto-dismiss timer
    if (command.acknowledged && visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [recentCommand, lastCommandId, visible]);

  if (!visible || !recentCommand || recentCommand.length === 0) {
    return null;
  }

  const command = recentCommand[0];
  const isAcknowledged = command.acknowledged;

  return (
    <div className="flex items-center gap-2">
      {isAcknowledged ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-600 dark:text-green-400">
            Executed
          </span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            Sending...
          </span>
        </>
      )}
    </div>
  );
}
