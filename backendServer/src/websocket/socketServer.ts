import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { setupDispatchNamespace } from "./dispatchNamespace.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Or specific allowed origins
      methods: ["GET", "POST"],
      credentials: true
    }
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
