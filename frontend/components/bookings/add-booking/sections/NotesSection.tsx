"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Notes, Subject } from "@mui/icons-material";

interface NotesSectionProps {
  subject: string;
  notes: string;
  onSubjectChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}

export function NotesSection({
  subject,
  notes,
  onSubjectChange,
  onNotesChange,
}: NotesSectionProps) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
          <Notes style={{ fontSize: "14px" }} className="text-slate-500" />
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Trip Details
        </span>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 ml-1">
          Trip Subject / Type
        </label>
        <div className="relative">
          <Subject
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
            style={{ fontSize: "16px" }}
          />
          <Input
            placeholder="e.g. Airport Transfer, School Run"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="pl-10 h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 ml-1">
          Special Requirements / Notes
        </label>
        <textarea
          className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all resize-none"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add any specific requests, accessibility needs, or internal notes..."
        />
      </div>
    </div>
  );
}
