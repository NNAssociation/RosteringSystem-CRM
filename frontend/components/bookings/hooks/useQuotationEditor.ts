"use client";

import type {
  QuotationConfig,
  QuotationLineItem,
  QuotationRevision,
} from "@/types/booking-workflow";
import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_QUOTATION_MESSAGE,
  DEFAULT_QUOTATION_TERMS,
  INITIAL_LINE_ITEMS,
} from "../config/booking-workflow.config";

export function useQuotationEditor(initialConfig?: QuotationConfig | null) {
  const [items, setItems] = useState<QuotationLineItem[]>(INITIAL_LINE_ITEMS);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(initialConfig?.taxBasisPoints ?? 1000);
  const [currency, setCurrency] = useState<string>(initialConfig?.currency ?? "AUD");
  const [expires, setExpires] = useState<string>("");
  const [terms, setTerms] = useState<string>(
    initialConfig?.defaultTerms ?? DEFAULT_QUOTATION_TERMS,
  );
  const [message, setMessage] = useState<string>(DEFAULT_QUOTATION_MESSAGE);
  const [quoteDirty, setQuoteDirty] = useState<boolean>(false);

  const addItem = useCallback(() => {
    setItems((current) => [...current, { description: "", quantity: 1, unitPriceMinor: 0 }]);
    setQuoteDirty(true);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
    setQuoteDirty(true);
  }, []);

  const updateItem = useCallback((index: number, partial: Partial<QuotationLineItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...partial } : item)));
    setQuoteDirty(true);
  }, []);

  const hydrateQuote = useCallback((q: QuotationRevision) => {
    setItems(
      q.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPriceMinor: i.unitPriceMinor,
      })),
    );
    setDiscount(q.discountMinor);
    setTax(q.taxBasisPoints);
    setCurrency(q.currency);
    setExpires(new Date(q.expiresAt).toISOString().slice(0, 10));
    setTerms(q.terms);
    setMessage(q.message);
    setQuoteDirty(false);
  }, []);

  const initFromConfig = useCallback((cfg: QuotationConfig) => {
    setCurrency(cfg.currency);
    setTax(cfg.taxBasisPoints);
    setExpires(new Date(Date.now() + cfg.validityDays * 86400000).toISOString().slice(0, 10));
    if (cfg.defaultTerms) {
      setTerms((curr) => curr || cfg.defaultTerms || "");
    }
  }, []);

  const subtotal = useMemo(
    () => items.reduce((n, i) => n + i.quantity * i.unitPriceMinor, 0),
    [items],
  );

  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = useMemo(() => Math.round((taxableAmount * tax) / 10000), [taxableAmount, tax]);

  const total = useMemo(() => subtotal - discount + taxAmount, [subtotal, discount, taxAmount]);

  return {
    items,
    setItems: (newItems: QuotationLineItem[]) => {
      setItems(newItems);
      setQuoteDirty(true);
    },
    addItem,
    removeItem,
    updateItem,
    discount,
    setDiscount: (val: number) => {
      setDiscount(val);
      setQuoteDirty(true);
    },
    tax,
    setTax: (val: number) => {
      setTax(val);
      setQuoteDirty(true);
    },
    currency,
    setCurrency: (val: string) => {
      setCurrency(val);
      setQuoteDirty(true);
    },
    expires,
    setExpires: (val: string) => {
      setExpires(val);
      setQuoteDirty(true);
    },
    terms,
    setTerms: (val: string) => {
      setTerms(val);
      setQuoteDirty(true);
    },
    message,
    setMessage: (val: string) => {
      setMessage(val);
      setQuoteDirty(true);
    },
    quoteDirty,
    setQuoteDirty,
    hydrateQuote,
    initFromConfig,
    subtotal,
    taxAmount,
    total,
  };
}
