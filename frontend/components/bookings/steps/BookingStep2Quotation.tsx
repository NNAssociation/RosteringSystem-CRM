"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/workflow-api";
import type { BookingTrip, QuotationLineItem, QuotationRevision } from "@/types/booking-workflow";
import { ReceiptText } from "lucide-react";
import { BookingSectionTitle } from "../BookingVisuals";
import { CharterPricingCalculatorCard } from "../CharterPricingCalculatorCard";
import { FIELD_INPUT_CLASS, SUPPORTED_CURRENCIES } from "../config/booking-workflow.config";

interface Step2Props {
  routeCalculation?: import("@/types/booking-workflow").RouteCalculation | null;
  routeReview?: import("@/types/booking-workflow").RouteReview;
  onRouteReview?: (review: import("@/types/booking-workflow").RouteReview) => void;
  trip?: BookingTrip;
  currentQuotation?: QuotationRevision | null;
  items: QuotationLineItem[];
  discount: number;
  tax: number;
  currency: string;
  expires: string;
  terms: string;
  message: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  locked: boolean;
  busy: boolean;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, partial: Partial<QuotationLineItem>) => void;
  onSetItems?: (items: QuotationLineItem[]) => void;
  onDiscountChange: (value: number) => void;
  onTaxChange: (value: number) => void;
  onCurrencyChange: (value: string) => void;
  onExpiresChange: (value: string) => void;
  onTermsChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSaveQuote: () => void;
}

export function BookingStep2Quotation({
  trip,
  routeCalculation,
  routeReview,
  onRouteReview,
  currentQuotation,
  items,
  discount,
  tax,
  currency,
  expires,
  terms,
  message,
  subtotal,
  taxAmount,
  total,
  locked,
  busy,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSetItems,
  onDiscountChange,
  onTaxChange,
  onCurrencyChange,
  onExpiresChange,
  onTermsChange,
  onMessageChange,
  onSaveQuote,
}: Step2Props) {
  return (
    <div className="rounded-2xl border bg-white p-6 space-y-6">
      <BookingSectionTitle
        title="Build quotation"
        description="Calculate selling price from charter parameters or customize line items."
        icon={ReceiptText}
      />

      {routeCalculation && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-4 space-y-2"
          aria-live="polite"
        >
          <p>
            {routeCalculation.status !== "VALID"
              ? "Calculate a valid route in Locations & Itinerary before preparing a quotation."
              : routeReview?.fingerprint === routeCalculation.fingerprint
                ? "Route pricing reviewed."
                : "Route changed — review required."}
          </p>
          <p className="text-sm">
            Review the route distance in the calculator and use Apply Recalculated Price, or
            explicitly keep the current price below.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={locked || busy || routeCalculation.status !== "VALID"}
            onClick={() =>
              onRouteReview?.({ fingerprint: routeCalculation.fingerprint, action: "KEEP" })
            }
          >
            Keep Current Price
          </Button>
        </div>
      )}
      {/* Punchbowl Bus Company Charter Pricing Engine Card */}
      <CharterPricingCalculatorCard
        trip={trip}
        locked={locked}
        busy={busy}
        onApplyCalculatedQuote={(payload) => {
          if (routeCalculation?.status === "VALID")
            onRouteReview?.({ fingerprint: routeCalculation.fingerprint, action: "RECALCULATED" });
          if (onSetItems) onSetItems(payload.items);
          if (onTaxChange) onTaxChange(payload.taxBasisPoints);
          if (onTermsChange) onTermsChange(payload.terms);
          if (onDiscountChange) onDiscountChange(payload.discountMinor);
          if (onCurrencyChange && payload.currency) onCurrencyChange(payload.currency);
        }}
        onApplyLineItems={(calculatedItems, defaultTerms) => {
          if (routeCalculation?.status === "VALID")
            onRouteReview?.({ fingerprint: routeCalculation.fingerprint, action: "RECALCULATED" });
          if (onSetItems) onSetItems(calculatedItems);
          if (onTaxChange) onTaxChange(1000); // Default to 10% GST
          if (defaultTerms && onTermsChange) onTermsChange(defaultTerms);
        }}
        onAddSpecialItem={(item) => {
          // If items only contain empty/initial placeholder, replace it cleanly
          const isOnlyPlaceholder =
            items.length === 1 &&
            (items[0].description === "Transport service" || !items[0].description) &&
            items[0].unitPriceMinor === 0;

          if (isOnlyPlaceholder && onSetItems) {
            onSetItems([item]);
          } else if (onSetItems) {
            onSetItems([...items, item]);
          }
          if (onTaxChange && tax === 0) {
            onTaxChange(1000); // 10% GST
          }
        }}
      />

      {currentQuotation && (
        <p className="text-sm text-slate-500">
          Saving creates a new revision. Previous customer links will stop accepting responses.
        </p>
      )}

      <fieldset disabled={locked || busy} className="space-y-5">
        {items.map((item, i) => (
          <div
            key={`line-item-${i}`}
            className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[1fr_70px_110px_40px]"
          >
            <Field label="Description">
              <Input
                value={item.description}
                onChange={(e) => onUpdateItem(i, { description: e.target.value })}
                placeholder="Service or fee description"
              />
            </Field>

            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  onUpdateItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </Field>

            <Field label="Unit price">
              <Input
                type="number"
                step="0.01"
                value={item.unitPriceMinor / 100}
                onChange={(e) =>
                  onUpdateItem(i, {
                    unitPriceMinor: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </Field>

            <Button
              aria-label={`Remove line ${i + 1}`}
              className="self-end"
              variant="ghost"
              type="button"
              disabled={items.length === 1}
              onClick={() => onRemoveItem(i)}
            >
              ×
            </Button>
          </div>
        ))}

        <Button variant="outline" type="button" onClick={onAddItem}>
          + Add line item
        </Button>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <select
              className={FIELD_INPUT_CLASS}
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valid until">
            <Input type="date" value={expires} onChange={(e) => onExpiresChange(e.target.value)} />
          </Field>

          <Field label="Discount amount">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={discount / 100}
              onChange={(e) => onDiscountChange(Math.round(Number(e.target.value) * 100))}
            />
          </Field>

          <Field label="Tax rate (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={tax / 100}
              onChange={(e) => onTaxChange(Math.round(Number(e.target.value) * 100))}
            />
          </Field>
        </div>

        <Field label="Customer message">
          <textarea
            className={FIELD_INPUT_CLASS}
            rows={3}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
          />
        </Field>

        <Field label="Terms & conditions">
          <textarea
            className={FIELD_INPUT_CLASS}
            rows={5}
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
          />
        </Field>
      </fieldset>

      <div className="flex flex-wrap justify-between items-center gap-4 border-t pt-4">
        <dl className="w-full space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Subtotal</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>Discount</dt>
            <dd>−{formatMoney(discount, currency)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>Tax ({tax / 100}%)</dt>
            <dd>{formatMoney(taxAmount, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-blue-100 pt-3 text-lg font-semibold text-blue-950">
            <dt>Total {currency}</dt>
            <dd>{formatMoney(total, currency)}</dd>
          </div>
        </dl>

        <Button
          disabled={
            locked ||
            busy ||
            (!!routeCalculation &&
              (routeCalculation.status !== "VALID" ||
                routeReview?.fingerprint !== routeCalculation.fingerprint))
          }
          onClick={onSaveQuote}
        >
          Save & preview quotation
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-600 space-y-2">
      <span>{label}</span>
      {children}
    </label>
  );
}
