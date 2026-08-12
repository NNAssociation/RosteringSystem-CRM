"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface BookingModalFooterProps {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function BookingModalFooter({
  isSubmitting,
  onCancel,
  onSubmit,
}: BookingModalFooterProps) {
  return (
    <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        className="rounded-xl h-11 px-6 font-semibold text-slate-500 hover:text-slate-700"
      >
        Cancel
      </Button>
      <Button
        type="button"
        disabled={isSubmitting}
        onClick={onSubmit}
        className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2"
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating...
          </>
        ) : (
          "Create Booking"
        )}
      </Button>
    </div>
  );
}
