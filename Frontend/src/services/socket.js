import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");

console.log("Connecting to socket:", socketUrl);

export const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  transports: ["websocket"], 
});
