import { io, Socket } from "socket.io-client";

// LOCAL:      VITE_BACKEND_URL="" → connects to same origin (Vite proxies it)
// PRODUCTION: VITE_BACKEND_URL="https://xxx.up.railway.app" → direct to Railway
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
