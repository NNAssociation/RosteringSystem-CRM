import { Server } from "socket.io";
import { clerkClient } from "@clerk/express";
import { staffIdentity } from "../middleware/staffAuth.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";

export function setupDispatchNamespace(io: Server) {
  const dispatchNsp = io.of("/dispatch");
  dispatchNsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const state = await clerkClient.authenticateRequest(new Request("http://localhost/dispatch", { headers: { authorization: `Bearer ${token}` } }));
      const auth = state.toAuth();
      if (!auth?.userId || !(await staffIdentity(auth.userId)).allowed) return next(new Error("Staff access required"));
      socket.data.expiresAt = auth.sessionClaims?.exp;
      next();
    } catch { next(new Error("Unable to authenticate dispatch connection")); }
  });

  dispatchNsp.on("connection", (socket) => {
    const timeout = setTimeout(() => socket.disconnect(true), Math.max(1000, (socket.data.expiresAt || Date.now() / 1000 + 300) * 1000 - Date.now()));
    socket.on("disconnect", () => clearTimeout(timeout));
    console.log(`[Socket] Dispatch client connected: ${socket.id}`);

    // Optional: We can handle explicit client events here (e.g. typing indicators)
    
    socket.on("disconnect", () => {
      console.log(`[Socket] Dispatch client disconnected: ${socket.id}`);
    });
  });

  // Subscribe to EventBus and broadcast to all connected Dispatch clients
  eventBus.subscribe(EventTypes.ASSIGNMENT_CREATED, (event) => {
    dispatchNsp.emit("assignment:created", event.payload);
  });

  eventBus.subscribe(EventTypes.ASSIGNMENT_UPDATED, (event) => {
    dispatchNsp.emit("assignment:updated", event.payload);
  });

  eventBus.subscribe(EventTypes.ASSIGNMENT_CANCELLED, (event) => {
    dispatchNsp.emit("assignment:cancelled", event.payload);
  });
  
  eventBus.subscribe(EventTypes.JOB_CREATED, (event) => {
    dispatchNsp.emit("job:created", event.payload);
  });
  
  eventBus.subscribe(EventTypes.JOB_UPDATED, (event) => {
    dispatchNsp.emit("job:updated", event.payload);
  });
}
