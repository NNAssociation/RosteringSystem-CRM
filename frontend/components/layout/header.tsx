"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useHeader } from "@/providers/header-provider";
import { useFormattedDate } from "@/hooks/use-formattedDate";
import { UserButton } from "@clerk/nextjs";

export function Header() {
  const { config } = useHeader();

  const pathname = usePathname();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    config.date instanceof Date ? config.date : new Date(),
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [prevConfigDate, setPrevConfigDate] = useState(config.date);

  if (config.date !== prevConfigDate) {
    setPrevConfigDate(config.date);
    setSelectedDate(config.date instanceof Date ? config.date : new Date());
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      config.onDateChange?.(date);
      setIsCalendarOpen(false);
    }
  };

  const formattedDate = useFormattedDate(selectedDate || new Date());

  const isDashboard = pathname === "/";

  return (
    <header className="sticky top-0 z-30 h-20 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 transition-all duration-300">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {config.title}
            </h2>

            {!isDashboard && config.date && (
              <div className="flex items-center gap-3">
                <Separator
                  orientation="vertical"
                  className="h-6 bg-slate-200 hidden sm:block"
                />
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors h-auto p-0"
                    >
                      <CalendarTodayIcon sx={{ fontSize: 18 }} />
                      <span className="text-sm">
                        {typeof config.date === "string"
                          ? config.date
                          : formattedDate}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          {config.description && (
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              {config.description}
            </p>
          )}
        </div>

        {/* Dynamic Search */}
        {config.onSearch && (
          <div className="relative w-full max-w-xs md:block hidden ml-auto mr-12">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              sx={{ fontSize: 20 }}
            />
            <Input
              placeholder={config.searchPlaceholder || "Search..."}
              onChange={(e) => config.onSearch?.(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm bg-slate-100 border border-border-light focus-visible:ring-[#ea2a33] focus-visible:ring-1 focus:border-transparent transition-all rounded-xl w-64 h-10"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Custom Actions Slot */}
        <div className="flex items-center gap-3 mr-4">
          {config.secondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={config.secondaryAction.onClick}
              className="h-10 px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
            >
              {config.secondaryAction.icon || (
                <FileDownloadIcon sx={{ fontSize: 18 }} />
              )}
              <span className="font-medium">
                {config.secondaryAction.label}
              </span>
            </Button>
          )}

          {config.primaryAction && (
            <Button
              size="sm"
              onClick={config.primaryAction.onClick}
              className="h-10 px-4 py-2 gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 rounded-xl border-none"
            >
              <span className="text-sm font-bold">{config.primaryAction.label}</span>
            </Button>
          )}

          {config.children}
        </div>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9 ring-2 ring-background border shadow-sm",
            },
          }}
        />
      </div>
    </header>
  );
}
