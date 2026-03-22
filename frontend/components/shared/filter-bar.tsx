"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FilterBarProps {
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-100 sticky top-0 z-10 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

interface FilterGroupProps {
  children: React.ReactNode;
  className?: string;
  position?: "left" | "right";
}

export function FilterGroup({
  children,
  className,
  position = "left",
}: FilterGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 w-full lg:w-auto",
        position === "left" ? "pl-2 overflow-x-auto no-scrollbar" : "pr-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
