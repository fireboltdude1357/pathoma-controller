"use client";

import { useConvex } from "convex/react";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const convex = useConvex();
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");

  useEffect(() => {
    // Subscribe to connection state changes
    const updateStatus = () => {
      const state = convex.connectionState();

      if (state.isWebSocketConnected) {
        setStatus("connected");
      } else if (state.hasInflightRequests) {
        setStatus("connecting");
      } else {
        setStatus("disconnected");
      }
    };

    // Initial check
    updateStatus();

    // Poll for connection state changes
    const interval = setInterval(() => {
      updateStatus();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [convex]);

  const statusConfig = {
    connected: {
      color: "bg-green-500",
      text: "Connected",
      textColor: "text-green-700 dark:text-green-400",
    },
    connecting: {
      color: "bg-yellow-500",
      text: "Connecting...",
      textColor: "text-yellow-700 dark:text-yellow-400",
    },
    disconnected: {
      color: "bg-red-500",
      text: "Disconnected",
      textColor: "text-red-700 dark:text-red-400",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${config.color}`} />
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.text}
      </span>
    </div>
  );
}
