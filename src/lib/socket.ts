"use client";

import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;

export const getSocket = async () => {
  if (socketInstance) {
    return socketInstance;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = fetch("/api/socket")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Socket bootstrap failed.");
      }

      return response.json() as Promise<{ wsUrl: string }>;
    })
    .then(({ wsUrl }) => {
      socketInstance = io(wsUrl, {
        transports: ["websocket", "polling"],
      });

      return socketInstance;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};
