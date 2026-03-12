"use client";

import React, { use } from "react";
import { useEffect } from "react";
import { useHeader } from "@/providers/header-provider";

export default function CustomersPage() {
  const { setHeaderConfig } = useHeader();

  useEffect(() => {
    setHeaderConfig({
      title: "Customers",
    });
  }, [setHeaderConfig]);

  return <div>{/* Content for customers page */}</div>;
}
