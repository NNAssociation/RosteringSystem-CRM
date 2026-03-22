"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Close from "@mui/icons-material/Close";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  maxWidth = "w-full",
  className,
  headerClassName,
  contentClassName,
  footerClassName,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex flex-col h-full bg-slate-50/90 backdrop-blur-xl border-l border-slate-200/60 shadow-2xl overflow-hidden relative rounded-2xl lg:rounded-3xl",
        maxWidth,
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-6 border-b border-slate-200/60 bg-white shadow-sm z-10 flex-shrink-0 rounded-t-2xl lg:rounded-t-3xl",
          headerClassName,
        )}
      >
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            {title}
          </h2>
          {badge && <div className="flex items-center">{badge}</div>}
          {subtitle && <div className="text-slate-500">{subtitle}</div>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 absolute right-4 top-6"
        >
          <Close sx={{ fontSize: 20 }} />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar p-6",
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* Sticky Actions Footer */}
      {footer && (
        <div
          className={cn(
            "p-6 border-t border-slate-200/60 bg-white flex-shrink-0 rounded-b-2xl lg:rounded-b-3xl",
            footerClassName,
          )}
        >
          {footer}
        </div>
      )}
    </motion.div>
  );
}
