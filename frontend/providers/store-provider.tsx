"use client";

import { clearOtherBookingDrafts } from "@/lib/booking-draft";
import { makeStore } from "@/store";
import { useAuth } from "@clerk/nextjs";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";

function SessionStore({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null | undefined;
}) {
  const [store] = useState(makeStore);
  useEffect(() => setupListeners(store.dispatch), [store]);
  useEffect(() => {
    clearOtherBookingDrafts(userId);
  }, [userId]);
  return <Provider store={store}>{children}</Provider>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { userId, sessionId, isLoaded } = useAuth();
  if (!isLoaded) return null;
  return (
    <SessionStore key={`${userId || "anonymous"}:${sessionId || "none"}`} userId={userId}>
      {children}
    </SessionStore>
  );
}
