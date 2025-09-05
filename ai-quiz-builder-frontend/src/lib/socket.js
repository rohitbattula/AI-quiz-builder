// src/lib/socket.js
import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (socket?.connected || socket?.connecting) return socket;

  const token = localStorage.getItem("token") || "";
  const base =
    import.meta.env.VITE_SOCKET_URL ??
    import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "");

  socket = io(base, {
    transports: ["websocket"],
    withCredentials: true,
    auth: { token },
    extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
