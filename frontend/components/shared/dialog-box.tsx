"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DialogBoxProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onInteractOutside?: (e: any) => void;
  modal?: boolean;
}

export function DialogBox({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  footer,
  maxWidth = "sm:max-w-[425px]",
  className,
  headerClassName,
  contentClassName,
  onInteractOutside,
  modal = true,
}: DialogBoxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        onInteractOutside={onInteractOutside}
        className={cn(
          "rounded-3xl border-none shadow-2xl bg-white p-0 overflow-hidden",
          maxWidth,
          className,
        )}
      >
        <DialogHeader
          className={cn(
            "bg-slate-50 p-6 border-b border-slate-100",
            headerClassName,
          )}
        >
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className={cn("p-6", contentClassName)}>{children}</div>
        {footer && (
          <DialogFooter className="px-6 pb-6 pt-0">{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
