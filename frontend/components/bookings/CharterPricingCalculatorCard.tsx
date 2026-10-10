"use client";

import { useCharterPricingSettings } from "@/components/settings/useCharterPricingSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateCharterPrice, CalculateCharterResult } from "@/lib/charter-pricing";
import type { BookingTrip, QuotationLineItem } from "@/types/booking-workflow";
import {
  Calculator,
  Calendar,
  CheckCircle2,
  Layers,
  Navigation,
  PlusCircle,
  Settings,
  Sliders,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface CalculatedQuoteSyncPayload {
  items: QuotationLineItem[];
  taxBasisPoints: number;
  terms: string;
  discountMinor: number;
  currency: string;
}

interface CharterPricingCalculatorCardProps {
  trip?: BookingTrip;
  locked: boolean;
  busy: boolean;
  onApplyCalculatedQuote?: (payload: CalculatedQuoteSyncPayload) => void;
  onApplyLineItems?: (items: QuotationLineItem[], terms?: string) => void;
  onAddSpecialItem: (item: QuotationLineItem) => void;
}

export function CharterPricingCalculatorCard({
  trip,
  locked,
  busy,
  onApplyCalculatedQuote,
  onApplyLineItems,
  onAddSpecialItem,
}: CharterPricingCalculatorCardProps) {
  const { config, loading, error, retry } = useCharterPricingSettings();
  const [vehicleType, setVehicleType] = useState<"Coach" | "Bus">(
    trip?.vehicleType || (trip?.passengerCount && trip.passengerCount <= 28 ? "Bus" : "Coach"),
  );
  const [vehicleCount, setVehicleCount] = useState<number>(
    trip?.noOfVehicles && trip.noOfVehicles > 0 ? trip.noOfVehicles : 1,
  );
  const [distanceKm, setDistanceKm] = useState<number>(
    trip?.estimatedDistanceKm !== undefined ? Math.round(trip.estimatedDistanceKm * 10) / 10 : 65,
  );
  const [charterDate, setCharterDate] = useState<string>(trip?.date || "");
  const [startTime, setStartTime] = useState<string>(trip?.startTime || "08:00");
  const [finishTime, setFinishTime] = useState<string>(trip?.endTime || "17:00");
  const [manualAdjustment, setManualAdjustment] = useState<number>(0);
  const [selectedSpecialId, setSelectedSpecialId] = useState<string>("");
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const tripKey = JSON.stringify([
    trip?.estimatedDistanceKm,
    trip?.date,
    trip?.startTime,
    trip?.endTime,
    trip?.vehicleType,
    trip?.passengerCount,
    trip?.noOfVehicles,
  ]);
  const [loadedTripKey, setLoadedTripKey] = useState(tripKey);
  if (tripKey !== loadedTripKey) {
    setLoadedTripKey(tripKey);
    if (trip?.estimatedDistanceKm !== undefined && trip.estimatedDistanceKm >= 0) {
      setDistanceKm(Math.round(trip.estimatedDistanceKm * 10) / 10);
    }
    if (trip?.date) {
      setCharterDate(trip.date);
    }
    if (trip?.startTime) {
      setStartTime(trip.startTime);
    }
    if (trip?.endTime) {
      setFinishTime(trip.endTime);
    }
    if (trip?.vehicleType) {
      setVehicleType(trip.vehicleType);
    } else if (trip?.passengerCount) {
      setVehicleType(trip.passengerCount <= 28 ? "Bus" : "Coach");
    }
    if (trip?.noOfVehicles && trip.noOfVehicles > 0) {
      setVehicleCount(trip.noOfVehicles);
    }
  }

  // Live calculation
  const calcResult: CalculateCharterResult = useMemo(() => {
    return calculateCharterPrice(config, {
      vehicleType,
      vehicleCount,
      distanceKm,
      charterDate,
      startTime,
      finishTime,
      manualAdjustment,
    });
  }, [
    config,
    vehicleType,
    vehicleCount,
    distanceKm,
    charterDate,
    startTime,
    finishTime,
    manualAdjustment,
  ]);

  const handleApply = () => {
    // Generate clean customer-facing line item for Charter Service (Option A: Driver wage excluded from client view)
    const vehicleCountLabel = vehicleCount > 1 ? `${vehicleCount}x Vehicles · ` : "";
    const items: QuotationLineItem[] = [
      {
        description: `${vehicleType} Charter Service (${vehicleCountLabel}${distanceKm} km @ $${calcResult.ratePerKm.toFixed(2)}/km)`,
        quantity: 1,
        unitPriceMinor: Math.round(calcResult.distanceCost * 100),
      },
    ];

    let discountMinor = 0;
    if (manualAdjustment > 0) {
      items.push({
        description: "Commercial / Route Adjustment",
        quantity: 1,
        unitPriceMinor: Math.round(manualAdjustment * 100),
      });
    } else if (manualAdjustment < 0) {
      // Map negative adjustment directly to quotation discount
      discountMinor = Math.round(Math.abs(manualAdjustment) * 100);
    }

    const payload: CalculatedQuoteSyncPayload = {
      items,
      taxBasisPoints: Math.round((config.gstPercent ?? 10) * 100), // e.g. 1000 = 10% GST
      terms: config.termsAndConditions,
      discountMinor,
      currency: "AUD",
    };

    if (onApplyCalculatedQuote) {
      onApplyCalculatedQuote(payload);
    } else if (onApplyLineItems) {
      onApplyLineItems(items, config.termsAndConditions);
    }

    setAppliedNotice("Charter service price + 10% GST applied to quotation!");
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const handleAddSpecial = () => {
    if (!selectedSpecialId) return;
    const special = config.specialRates.find((s) => s.id === selectedSpecialId);
    if (!special) return;

    onAddSpecialItem({
      description: `${special.name} (${special.description || "Fixed rate"})`,
      quantity: 1,
      unitPriceMinor: Math.round(special.beforeGst * 100),
    });
    setSelectedSpecialId("");
    setAppliedNotice(`Added ${special.name} ($${special.beforeGst.toFixed(2)})`);
    setTimeout(() => setAppliedNotice(null), 3500);
  };

  const handleApplySpecialAsPackage = () => {
    if (!selectedSpecialId) return;
    const special = config.specialRates.find((s) => s.id === selectedSpecialId);
    if (!special) return;

    const payload: CalculatedQuoteSyncPayload = {
      items: [
        {
          description: `${special.name} (${special.description || "All-inclusive fixed package"})`,
          quantity: 1,
          unitPriceMinor: Math.round(special.beforeGst * 100),
        },
      ],
      taxBasisPoints: Math.round((config.gstPercent ?? 10) * 100),
      terms: config.termsAndConditions,
      discountMinor: 0,
      currency: "AUD",
    };

    if (onApplyCalculatedQuote) {
      onApplyCalculatedQuote(payload);
    } else if (onApplyLineItems) {
      onApplyLineItems(payload.items, config.termsAndConditions);
    }

    setSelectedSpecialId("");
    setAppliedNotice(
      `Set quotation to ${special.name} package ($${special.customerPrice.toFixed(2)} inc GST)!`,
    );
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  if (loading) return <p role="status">Loading pricing rates...</p>;
  if (error)
    return (
      <div role="alert">
        <p>{error}</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );

  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 via-white to-white p-5 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Charter Pricing Calculator</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                Punchbowl Bus Standard
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculates recommended charter price automatically from vehicle type, fleet count,
              distance & schedule.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
          title="Edit rate tables in Settings"
        >
          <Settings className="h-3.5 w-3.5" />
          Edit rate tables
        </Link>
      </div>

      {/* Input Parameters Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Vehicle Type Toggle */}
        <div className="space-y-1.5 lg:col-span-1">
          <label className="text-xs font-semibold text-slate-700 block">Vehicle Type</label>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 gap-1">
            <button
              type="button"
              disabled={locked || busy}
              onClick={() => setVehicleType("Coach")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vehicleType === "Coach"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Coach
            </button>
            <button
              type="button"
              disabled={locked || busy}
              onClick={() => setVehicleType("Bus")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vehicleType === "Bus"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bus
            </button>
          </div>
        </div>

        {/* Fleet Count */}
        <div className="space-y-1.5 lg:col-span-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700">Fleet Count</label>
            <span className="text-[10px] text-slate-500 font-medium">Vehicles</span>
          </div>
          <div className="relative flex items-center">
            <Layers className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="number"
              min={1}
              max={50}
              step="1"
              disabled={locked || busy}
              value={vehicleCount}
              onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="pl-8 text-xs font-bold"
            />
          </div>
        </div>

        {/* Distance (km) */}
        <div className="space-y-1.5 lg:col-span-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700">Distance (km)</label>
            <span className="text-[10px] text-blue-600 font-medium">
              ${calcResult.ratePerKm.toFixed(2)}/km
            </span>
          </div>
          <div className="relative flex items-center">
            <Navigation className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="number"
              min={0}
              step="1"
              disabled={locked || busy}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0))}
              className="pl-8 text-xs font-bold"
            />
          </div>
        </div>

        {/* Date & Day Type */}
        <div className="space-y-1.5 lg:col-span-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700">Charter Date</label>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                calcResult.dayType === "Weekend"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {calcResult.dayType}
            </span>
          </div>
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="date"
              disabled={locked || busy}
              value={charterDate}
              onChange={(e) => setCharterDate(e.target.value)}
              className="pl-8 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Start / Finish Times & Duration */}
        <div className="space-y-1.5 lg:col-span-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700">Times / Hours</label>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
              {calcResult.totalHours} Hours
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              type="time"
              disabled={locked || busy}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-xs font-semibold px-2"
              title="Charter Start Time"
            />
            <Input
              type="time"
              disabled={locked || busy}
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              className="text-xs font-semibold px-2"
              title="Charter Finish Time"
            />
          </div>
        </div>
      </div>

      {/* Customer Quotation Summary (Client-Facing Price) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              Client Quotation Pricing (Customer-Facing)
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Distance & Fleet Service
            </span>
          </div>
          <span className="text-[11px] text-slate-400">GST: {config.gstPercent}%</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
          {/* Distance Charter Service */}
          <div className="space-y-0.5 sm:pr-3">
            <span className="text-slate-400 text-[11px] block">Charter Vehicle Service</span>
            <p className="font-bold text-slate-900 text-sm">
              ${calcResult.distanceCost.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500">
              {vehicleCount > 1 ? `${vehicleCount}x Vehicles · ` : ""}
              {distanceKm} km @ ${calcResult.ratePerKm.toFixed(2)}/km
            </span>
          </div>

          {/* Commercial / Route Adjustment */}
          <div className="space-y-0.5 pt-2 sm:pt-0 sm:px-3">
            <span className="text-slate-400 text-[11px] block">Commercial Adjustment</span>
            <p className="font-bold text-slate-900 text-sm">
              {calcResult.manualAdjustment !== 0
                ? `${calcResult.manualAdjustment > 0 ? "+" : ""}$${calcResult.manualAdjustment.toFixed(2)}`
                : "$0.00"}
            </p>
            <span className="text-[10px] text-slate-500">
              {calcResult.manualAdjustment !== 0
                ? "Route & margin override"
                : "Standard band pricing"}
            </span>
          </div>

          {/* Subtotal before GST */}
          <div className="space-y-0.5 pt-2 sm:pt-0 sm:px-3">
            <span className="text-slate-400 text-[11px] block">Subtotal (ex GST)</span>
            <p className="font-bold text-slate-900 text-sm">
              ${calcResult.subtotalBeforeGst.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500">Net customer quote</span>
          </div>

          {/* Final Customer Price */}
          <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
            <span className="text-blue-600 text-[11px] font-semibold block">
              Total Quote (inc 10% GST)
            </span>
            <p className="font-bold text-blue-900 text-base">
              ${calcResult.finalCustomerPrice.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500">
              GST: ${calcResult.gstAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Manual Adjustment & Special Rates Inserter */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Manual Adjustment Input */}
            <div className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-600 font-medium">Manual Adjustment:</span>
              <div className="flex items-center w-28">
                <span className="text-slate-400 mr-1">$</span>
                <Input
                  type="number"
                  step="5"
                  disabled={locked || busy}
                  value={manualAdjustment}
                  onChange={(e) => setManualAdjustment(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-7 text-xs font-bold"
                />
              </div>
            </div>

            {/* Special / Fixed Rates Quick Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                disabled={locked || busy}
                value={selectedSpecialId}
                onChange={(e) => setSelectedSpecialId(e.target.value)}
                className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-2xs focus:outline-none"
              >
                <option value="">Insert fixed / special rate…</option>
                {config.specialRates.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} — ${sp.beforeGst.toFixed(2)} (${sp.customerPrice.toFixed(2)} inc GST)
                  </option>
                ))}
              </select>

              {selectedSpecialId && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={locked || busy}
                    onClick={handleAddSpecial}
                    title="Add this special rate to the existing line items"
                    className="h-7 text-xs gap-1 text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add item
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={locked || busy}
                    onClick={handleApplySpecialAsPackage}
                    title="Set this special fixed rate as the entire quotation package"
                    className="h-7 text-xs gap-1 text-blue-700 bg-blue-50/70 hover:bg-blue-100 border border-blue-200 font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Use as package quote
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Apply Button */}
          <div className="flex items-center gap-2">
            {appliedNotice && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {appliedNotice}
              </span>
            )}

            <Button
              type="button"
              size="sm"
              disabled={locked || busy}
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-bold shadow-xs px-3.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Apply Recalculated Price
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
