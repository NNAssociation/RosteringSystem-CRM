"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";

import { StoreProvider } from "./store-provider";

import { WebSocketProvider } from "./websocket-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <TooltipProvider>
        <WebSocketProvider>
          {children}
          <Toaster position="top-right" />
        </WebSocketProvider>
      </TooltipProvider>
    </StoreProvider>
  );
}
