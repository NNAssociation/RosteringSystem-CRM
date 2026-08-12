"use client";

import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";

import { StoreProvider } from "./store-provider";

import { WebSocketProvider } from "./websocket-provider";
import { GoogleMapsProvider } from "./google-maps-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <QueryProvider>
        <TooltipProvider>
          <GoogleMapsProvider>
            <WebSocketProvider>
              {children}
              <Toaster position="top-right" />
            </WebSocketProvider>
          </GoogleMapsProvider>
        </TooltipProvider>
      </QueryProvider>
    </StoreProvider>
  );
}
