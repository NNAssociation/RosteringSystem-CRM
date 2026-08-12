"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useDispatch } from "react-redux";
import { dispatchApi } from "@/services/api";

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    // Only connect if dispatch feature is enabled
    if (process.env.NEXT_PUBLIC_DISPATCH_ENABLED === "false") {
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000/dispatch";
    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {

      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {

      setIsConnected(false);
    });

    // Real-time events to invalidate RTK Query cache
    socketInstance.on("assignment:created", () => {
      dispatch(dispatchApi.util.invalidateTags(["Board", "Assignment"]));
    });

    socketInstance.on("assignment:updated", () => {
      dispatch(dispatchApi.util.invalidateTags(["Board", "Assignment"]));
    });

    socketInstance.on("assignment:cancelled", () => {
      dispatch(dispatchApi.util.invalidateTags(["Board", "Assignment"]));
    });

    socketInstance.on("job:created", () => {
      dispatch(dispatchApi.util.invalidateTags(["Board"]));
    });

    socketInstance.on("job:updated", () => {
      dispatch(dispatchApi.util.invalidateTags(["Board"]));
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [dispatch]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
