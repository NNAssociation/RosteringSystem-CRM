"use client";

import React, { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, PersonAdd, Person, Email, Phone, Business, Close } from "@mui/icons-material";
import { useCustomerSearch } from "../hooks/useCustomerSearch";
import type { CustomerSearchResult } from "@/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CustomerSelectorProps {
  customerName: string;
  customerEmail: string;
  customerId?: number | string;
  error?: string;
  onSelect: (id: number | string, name: string, email: string, phone?: string) => void;
  onClear: () => void;
  onAddNew: () => void;
}

export function CustomerSelector({
  customerName,
  customerId,
  error,
  onSelect,
  onClear,
  onAddNew,
}: CustomerSelectorProps) {
  const { query, setQuery, results, isLoading, isOpen, handleKeyDown, closeDropdown } =
    useCustomerSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  const handleSelect = (customer: CustomerSearchResult) => {
    onSelect(customer.id, customer.name || customer.email, customer.email, customer.phone1);
    closeDropdown();
  };

  // If a customer is already selected, show selected state
  if (customerId && customerName) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
          Customer
        </label>
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl px-4 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
            <Person style={{ fontSize: "18px" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{customerName}</p>
            <p className="text-xs text-slate-500 truncate">{customerId}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
            onClick={onClear}
          >
            <Close style={{ fontSize: "16px" }} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
        Customer <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
            style={{ fontSize: "18px" }}
          />
          <Input
            placeholder="Search by name, email, or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleSelect)}
            className={cn(
              "pl-10 pr-4 h-11 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl transition-all",
              "focus:ring-2 focus:ring-primary/10 focus:border-primary/30",
              error && "border-red-300 focus:ring-red-100 focus:border-red-300"
            )}
          />
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full mt-2 w-full bg-white rounded-xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
            >
              {isLoading ? (
                <div className="px-4 py-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                    Searching...
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="max-h-[240px] overflow-y-auto py-1">
                  {results.map((customer, index) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelect(customer)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        "hover:bg-slate-50",
                        index === 0 && "rounded-t-xl"
                      )}
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-500 shrink-0">
                        <Person style={{ fontSize: "16px" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {customer.name || "No Name"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                            <Email style={{ fontSize: "11px" }} />
                            {customer.email}
                          </span>
                          {customer.phone1 && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Phone style={{ fontSize: "11px" }} />
                              {customer.phone1}
                            </span>
                          )}
                        </div>
                      </div>
                      {customer.company && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-300 shrink-0">
                          <Business style={{ fontSize: "11px" }} />
                          {customer.company}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-center text-xs text-slate-400 font-medium">
                  No customers found for &ldquo;{query}&rdquo;
                </div>
              )}

              {/* Add New Customer Action */}
              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={onAddNew}
                  className="w-full flex items-center gap-2 px-4 py-3 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors"
                >
                  <PersonAdd style={{ fontSize: "18px" }} />
                  Add New Customer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
    </div>
  );
}
