"use client";

import { searchPlacesMapbox } from "@/lib/mapbox-geocoding";
import { cn } from "@/lib/utils";
import type { StructuredLocation } from "@/types";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface PlaceSearchProps {
  onSelect: (location: StructuredLocation) => void;
  label?: string;
  placeholder?: string;
  includedRegionCodes?: string[];
  className?: string;
}

export function PlaceSearch({
  onSelect,
  label = "Search street address",
  placeholder,
  includedRegionCodes = ["au"],
  className,
}: PlaceSearchProps) {
  const version = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StructuredLocation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const countries = includedRegionCodes.length
    ? includedRegionCodes.map((c) => c.toLowerCase())
    : ["au"];
  const countryKey = countries.join(",");

  useEffect(() => {
    return () => {
      version.current++;
    };
  }, [countryKey]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const executeSearch = useCallback(
    async (searchText: string) => {
      if (searchText.trim().length < 3) {
        setResults([]);
        setIsOpen(false);
        setError("");
        setBusy(false);
        return;
      }

      const request = ++version.current;
      setBusy(true);
      setError("");

      try {
        const rows = await searchPlacesMapbox(searchText.trim(), countries);
        if (request === version.current) {
          setResults(rows);
          setIsOpen(true);
          setSelectedIndex(-1);
          if (!rows.length) {
            setError("No address found. Try entering full street name or choose a pin on the map.");
          }
        }
      } catch (e) {
        if (request === version.current) {
          setError(e instanceof Error ? e.message : "Address search failed");
          setIsOpen(false);
        }
      } finally {
        if (request === version.current) {
          setBusy(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countryKey],
  );

  // Debounced auto-search as user types
  useEffect(() => {
    if (query.trim().length < 3) {
      version.current++;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Cancel and discard external geocoding results when the query becomes incomplete.
      setResults([]);
      setIsOpen(false);
      setBusy(false);
      return;
    }

    const timer = setTimeout(() => {
      void executeSearch(query);
    }, 320);

    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  const handleSelect = (item: StructuredLocation) => {
    version.current++;
    setQuery(item.address);
    setResults([]);
    setIsOpen(false);
    setError("");
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        setIsOpen(true);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim().length >= 3) {
        void executeSearch(query);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full space-y-1", className)}>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 flex items-center text-slate-400">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </span>

        <input
          ref={inputRef}
          type="text"
          aria-label={label}
          placeholder={placeholder || label}
          value={query}
          onChange={(e) => {
            version.current++;
            setQuery(e.target.value);
            setError("");
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
          <ul aria-label="Address results" className="divide-y divide-slate-100 py-1">
            {results.map((r, i) => {
              const parts = r.address.split(",");
              const primary = parts[0]?.trim();
              const secondary = parts.slice(1).join(",").trim();

              return (
                <li key={String(r.placeId || r.address) + i}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => handleSelect(r)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs sm:text-sm transition-colors",
                      selectedIndex === i
                        ? "bg-blue-50 text-blue-900"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                      <MapPin className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{primary}</p>
                      {secondary && (
                        <p className="text-[11px] text-slate-500 truncate">{secondary}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[10px] text-slate-400">
            <span>Use ↑↓ to navigate, Enter to choose</span>
            <span className="font-medium text-slate-500">Mapbox Geocoding</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-amber-700 font-medium px-1 pt-1">
          {error}
        </p>
      )}
    </div>
  );
}
