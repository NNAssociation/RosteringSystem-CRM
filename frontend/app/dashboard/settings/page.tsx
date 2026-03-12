"use client";

import React, { use } from "react";
import { useEffect } from "react";
import { useHeader } from "@/providers/header-provider";

export default function SettingsPage() {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      title: "Settings",
    });
  }, [setHeaderConfig]);

  return <div>{/* Content for settings page */}</div>;
}
