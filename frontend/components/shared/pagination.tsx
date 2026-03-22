"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * (itemsPerPage || 0);
  const endIndex = Math.min(startIndex + (itemsPerPage || 0), totalItems || 0);

  return (
    <div
      className={cn("flex items-center justify-between px-2 py-6", className)}
    >
      {totalItems !== undefined && itemsPerPage !== undefined && (
        <span className="text-xs font-semibold text-slate-400">
          Showing{" "}
          <span className="text-slate-900 mx-0.5">
            {startIndex + 1}-{endIndex}
          </span>{" "}
          of <span className="text-slate-900 mx-0.5">{totalItems}</span> items
        </span>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-slate-400 hover:text-primary transition-colors"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft style={{ fontSize: '18px' }} />
        </Button>

        <div className="flex items-center gap-1">
          {/* Simple Pagination Logic */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            // Adjust if we have many pages
            if (totalPages > 5 && currentPage > 3) {
              pageNum = currentPage - 2 + i;
              if (pageNum + (4 - i) > totalPages) {
                pageNum = totalPages - 4 + i;
              }
            }

            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  "h-10 w-10 rounded-lg font-bold text-xs transition-all",
                  currentPage === pageNum
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-slate-500 hover:bg-slate-100",
                )}
              >
                {pageNum}
              </Button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="px-2 text-slate-400">...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                className="h-10 w-10 rounded-lg font-bold text-xs text-slate-500 hover:bg-slate-100"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-slate-400 hover:text-primary transition-colors"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight style={{ fontSize: '18px' }} />
        </Button>
      </div>
    </div>
  );
}
