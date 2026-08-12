"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useLazySearchCustomersQuery } from "@/services/api";
import type { CustomerSearchResult } from "@/types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useCustomerSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [triggerSearch, { data: results = [], isFetching }] = useLazySearchCustomersQuery();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search trigger
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setHighlightIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value.length >= MIN_QUERY_LENGTH) {
        debounceRef.current = setTimeout(() => {
          triggerSearch(value);
          setIsOpen(true);
        }, DEBOUNCE_MS);
      } else {
        setIsOpen(false);
      }
    },
    [triggerSearch]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      onSelect: (customer: CustomerSearchResult) => void
    ) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < results.length) {
            onSelect(results[highlightIndex]);
            setIsOpen(false);
            setQuery("");
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, results, highlightIndex]
  );

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery: handleQueryChange,
    results,
    isLoading: isFetching,
    isOpen,
    setIsOpen,
    highlightIndex,
    handleKeyDown,
    closeDropdown,
  };
}
