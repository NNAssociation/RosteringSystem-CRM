"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingFlat, SwapHoriz, Repeat } from "@mui/icons-material";
import { BOOKING_CATEGORIES } from "./config/booking.config";
import type { BookingCategory } from "@/types";
import { cn } from "@/lib/utils";

interface BookingCategoryTabsProps {
  activeCategory: BookingCategory;
  onChange: (category: BookingCategory) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  TrendingFlat: <TrendingFlat style={{ fontSize: "18px" }} />,
  SwapHoriz: <SwapHoriz style={{ fontSize: "18px" }} />,
  Repeat: <Repeat style={{ fontSize: "18px" }} />,
};

export function BookingCategoryTabs({ activeCategory, onChange }: BookingCategoryTabsProps) {
  return (
    <div className="flex items-center gap-1 px-6 py-2 bg-slate-50/80 border-b border-slate-100">
      {BOOKING_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={cn(
              "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
              isActive
                ? "text-white shadow-lg"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/80"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="bookingCategoryPill"
                className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-lg shadow-slate-900/20"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {ICON_MAP[cat.iconName]}
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
