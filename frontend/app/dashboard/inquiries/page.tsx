"use client";

import React, { use } from "react";
import { useEffect } from "react";
import { useHeader } from "@/providers/header-provider";

export default function InquiriesPage() {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      title: "Inquiries",
    });
  }, [setHeaderConfig]);

  return <div>{/* Content for inquiries page */}</div>;
}
