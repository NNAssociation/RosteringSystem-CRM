import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HTTPServer } from "http";
import { Redis } from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { originAllowed, trustedOrigins } from "../config/trustedOrigins.js";
import { setupDispatchNamespace } from "./dispatchNamespace.js";

let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer) {
  const origins = trustedOrigins();
  io = new SocketIOServer(httpServer, {
    allowRequest: (request, callback) =>
      callback(null, originAllowed(request.headers.origin, origins)),
    cors: {
      origin: (origin, callback) => callback(null, originAllowed(origin, origins)),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  if (process.env.REDIS_URL) {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("WebSocket Redis adapter initialized");
  }

  // Setup namespaces
  setupDispatchNamespace(io);

  console.log("WebSocket server initialized");
  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}
