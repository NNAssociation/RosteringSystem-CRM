"use client";

import React, { use } from "react";
import { useEffect } from "react";
import { useHeader } from "@/providers/header-provider";

export default function BookingsPage() {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      title: "Bookings",
    });
  }, [setHeaderConfig]);

  return <div>{/* Content for bookings page */}</div>;
}
