import { Server } from "socket.io";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";

export function setupDispatchNamespace(io: Server) {
  const dispatchNsp = io.of("/dispatch");

  dispatchNsp.on("connection", (socket) => {
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
