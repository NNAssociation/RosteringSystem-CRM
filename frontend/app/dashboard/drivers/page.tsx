"use client";

import React, { use } from "react";
import { useEffect } from "react";
import { useHeader } from "@/providers/header-provider";

export default function DriversPage() {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      title: "Drivers",
    });
  }, [setHeaderConfig]);

  return <div>{/* Content for drivers page */}</div>;
}
