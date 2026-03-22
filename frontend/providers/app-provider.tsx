"use client";

import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";

import { StoreProvider } from "./store-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster position="top-right" />
        </TooltipProvider>
      </QueryProvider>
    </StoreProvider>
  );
}
