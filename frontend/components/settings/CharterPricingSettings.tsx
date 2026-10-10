"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CharterPricingConfig,
  PUNCHBOWL_DEFAULT_PRICING,
  calculateCharterPrice,
} from "@/lib/charter-pricing";
import {
  AlertCircle,
  Bus,
  Calculator,
  Clock,
  DollarSign,
  Edit,
  FileText,
  Lock,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useCharterPricingSettings } from "./useCharterPricingSettings";

export interface CharterPricingSettingsProps {
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaved?: (savedConfig: CharterPricingConfig) => void;
}

export function CharterPricingSettings({
  isEditing = false,
  onCancelEdit,
  onSaved,
}: CharterPricingSettingsProps) {
  const { config, setConfig, loading, saving, error, save, cancel, retry } =
    useCharterPricingSettings();
  const [activeSubTab, setActiveSubTab] = useState<
    "rates" | "wages" | "special" | "terms" | "preview"
  >("rates");

  // Calculator preview state
  const [testVehicle, setTestVehicle] = useState<"Coach" | "Bus">("Coach");
  const [testDistance, setTestDistance] = useState<number>(65);
  const [testHours, setTestHours] = useState<number>(9);
  const [testDayType, setTestDayType] = useState<"Weekday" | "Weekend">("Weekday");

  const handleSave = async () => {
    try {
      const updated = await save();
      toast.success("Charter pricing rates saved successfully");
      if (onSaved) onSaved(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error saving rates");
    }
  };

  const handleCancel = () => {
    cancel();
    if (onCancelEdit) onCancelEdit();
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        "Reset all charter pricing tables to Punchbowl Bus Company official standards?",
      )
    ) {
      setConfig(PUNCHBOWL_DEFAULT_PRICING);
      toast.success("Reset to defaults. Click 'Save Changes' to persist.");
    }
  };

  // Preview calculation result
  const previewResult = calculateCharterPrice(config, {
    vehicleType: testVehicle,
    distanceKm: testDistance,
    totalHours: testHours,
    charterDate: testDayType === "Weekday" ? "2026-10-14" : "2026-10-17",
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading pricing configurations…
      </div>
    );
  }

  if (error)
    return (
      <div role="alert" className="space-y-3 p-8">
        <p>{error}</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Charter Pricing Engine & Rate Tables
            </h3>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              Punchbowl Bus Co
            </span>
            {!isEditing ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                <Lock className="h-3 w-3 text-slate-400" />
                Read-Only (Locked)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                <Edit className="h-3 w-3 text-amber-600" />
                Editing Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {!isEditing
              ? "All rates are locked to prevent accidental modifications. Click 'Edit Settings' to modify rates."
              : "Modifications apply across the quotation engine upon saving."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="text-xs gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                disabled={saving}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Defaults
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="text-xs gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white hover:bg-blue-700 text-xs gap-1.5 shadow-sm"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveSubTab("rates")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === "rates"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Bus className="h-3.5 w-3.5" />
          Vehicle Km Rates
        </button>
        <button
          onClick={() => setActiveSubTab("wages")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === "wages"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Driver Wage Rates (8h–20h)
        </button>
        <button
          onClick={() => setActiveSubTab("special")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === "special"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          Special & Fixed Rates
        </button>
        <button
          onClick={() => setActiveSubTab("terms")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === "terms"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Tax & Terms
        </button>
        <button
          onClick={() => setActiveSubTab("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === "preview"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          Formula Test Simulator
        </button>
      </div>

      {/* ── SubTab 1: Kilometre Rates ────────────────────────────────────────── */}
      {activeSubTab === "rates" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Coach Rates */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                  C
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Coach Kilometre Rates</h4>
                  <span className="text-[11px] text-slate-400">Standard distance bands</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                Tiered pricing
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {config.coachKmRates.map((band, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 gap-3">
                  <div className="w-1/2">
                    <span className="text-xs font-bold text-slate-800 block">{band.label}</span>
                    <span className="text-[11px] text-slate-400">Up to {band.maxKm} km</span>
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-1.5 justify-end w-1/2">
                      <span className="text-sm font-bold text-blue-900 bg-blue-50/70 border border-blue-100 px-3 py-1 rounded-lg">
                        ${band.ratePerKm.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">/km</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-1/2">
                      <span className="text-xs font-bold text-slate-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs font-bold"
                        value={band.ratePerKm}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const copy = [...config.coachKmRates];
                          copy[idx] = { ...copy[idx], ratePerKm: val };
                          setConfig({ ...config, coachKmRates: copy });
                        }}
                      />
                      <span className="text-xs text-slate-400">/km</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Formula Example: 65 km @ ${config.coachKmRates[0]?.ratePerKm.toFixed(2)}/km = $
              {(65 * (config.coachKmRates[0]?.ratePerKm || 8.33)).toFixed(2)}
            </p>
          </div>

          {/* Bus Rates */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">
                  B
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Bus Kilometre Rates</h4>
                  <span className="text-[11px] text-slate-400">Standard distance bands</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                Tiered pricing
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {config.busKmRates.map((band, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 gap-3">
                  <div className="w-1/2">
                    <span className="text-xs font-bold text-slate-800 block">{band.label}</span>
                    <span className="text-[11px] text-slate-400">Up to {band.maxKm} km</span>
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-1.5 justify-end w-1/2">
                      <span className="text-sm font-bold text-emerald-900 bg-emerald-50/70 border border-emerald-100 px-3 py-1 rounded-lg">
                        ${band.ratePerKm.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">/km</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-1/2">
                      <span className="text-xs font-bold text-slate-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs font-bold"
                        value={band.ratePerKm}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const copy = [...config.busKmRates];
                          copy[idx] = { ...copy[idx], ratePerKm: val };
                          setConfig({ ...config, busKmRates: copy });
                        }}
                      />
                      <span className="text-xs text-slate-400">/km</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Formula Example: 65 km @ ${config.busKmRates[0]?.ratePerKm.toFixed(2)}/km = $
              {(65 * (config.busKmRates[0]?.ratePerKm || 4.05)).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* ── SubTab 2: Driver Wage Rates ─────────────────────────────────────── */}
      {activeSubTab === "wages" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Driver Wage Rates by Charter Duration
              </h4>
              <p className="text-xs text-slate-500">
                Wages applied based on total charter hours (8h minimum block to 20h) and charter day
                type.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Note on 11-Hour Rate:</strong> The initial spreadsheet noted a typo in the 11h
              figure ($523.65). It has been initialized to $613.60 to fit the graduated progression,
              and can be edited below as needed.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-1/3">Charter Duration</th>
                  <th className="py-3 px-4 w-1/3">Weekday Driver Cost ($)</th>
                  <th className="py-3 px-4 w-1/3">Weekend Driver Cost ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {config.driverWages.map((wage, idx) => (
                  <tr key={wage.hours} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {wage.hours} Hours {wage.hours === 8 ? "(Minimum Block)" : ""}
                    </td>
                    <td className="py-2.5 px-4">
                      {!isEditing ? (
                        <span className="font-semibold text-slate-800 text-xs">
                          ${wage.weekdayRate.toFixed(2)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 w-36">
                          <span className="font-semibold text-slate-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-xs font-semibold"
                            value={wage.weekdayRate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const copy = [...config.driverWages];
                              copy[idx] = { ...copy[idx], weekdayRate: val };
                              setConfig({ ...config, driverWages: copy });
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {!isEditing ? (
                        <span className="font-semibold text-slate-800 text-xs">
                          ${wage.weekendRate.toFixed(2)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 w-36">
                          <span className="font-semibold text-slate-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-xs font-semibold"
                            value={wage.weekendRate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const copy = [...config.driverWages];
                              copy[idx] = { ...copy[idx], weekendRate: val };
                              setConfig({ ...config, driverWages: copy });
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SubTab 3: Special & Fixed Rates ──────────────────────────────────── */}
      {activeSubTab === "special" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-slate-800">Existing Special / Fixed Rates</h4>
            <p className="text-xs text-slate-500">
              Standard fixed packages, cancellation fees, and venue standby charges.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item / Service</th>
                  <th className="py-3 px-4">Before GST ($)</th>
                  <th className="py-3 px-4">GST (10%) ($)</th>
                  <th className="py-3 px-4">Customer Price ($)</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {config.specialRates.map((sp, idx) => {
                  const calculatedGst =
                    Math.round(sp.beforeGst * (config.gstPercent / 100) * 100) / 100;
                  const calculatedCustomer = Math.round((sp.beforeGst + calculatedGst) * 100) / 100;
                  return (
                    <tr key={sp.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-bold text-slate-800">{sp.name}</td>
                      <td className="py-2.5 px-4">
                        {!isEditing ? (
                          <span className="font-semibold text-slate-800">
                            ${sp.beforeGst.toFixed(2)}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 w-32">
                            <span className="font-semibold text-slate-400">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs font-semibold"
                              value={sp.beforeGst}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const copy = [...config.specialRates];
                                const newGst = Math.round(val * 0.1 * 100) / 100;
                                copy[idx] = {
                                  ...copy[idx],
                                  beforeGst: val,
                                  gst: newGst,
                                  customerPrice: Math.round((val + newGst) * 100) / 100,
                                };
                                setConfig({ ...config, specialRates: copy });
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-600">
                        ${calculatedGst.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        ${calculatedCustomer.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">{sp.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between max-w-lg p-3 rounded-xl bg-slate-50/70 border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Late Departure Venue Fee (per hour)
                </label>
                <span className="text-[11px] text-slate-500">
                  Charged if departing venue later than booked schedule
                </span>
              </div>
              {!isEditing ? (
                <span className="text-sm font-bold text-blue-900 bg-white border border-slate-200 px-3 py-1 rounded-lg">
                  ${config.lateDepartureFeePerHour.toFixed(2)} / hour
                </span>
              ) : (
                <div className="flex items-center gap-1 w-32">
                  <span className="text-xs font-semibold text-slate-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-semibold"
                    value={config.lateDepartureFeePerHour}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        lateDepartureFeePerHour: parseFloat(e.target.value) || 100,
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SubTab 4: Tax & Legal Terms ──────────────────────────────────────── */}
      {activeSubTab === "terms" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 space-y-1">
              <label className="text-xs font-bold text-slate-800 block">Company Name</label>
              {!isEditing ? (
                <p className="text-sm font-semibold text-slate-900">{config.companyName}</p>
              ) : (
                <Input
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  className="text-xs"
                />
              )}
            </div>
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 space-y-1">
              <label className="text-xs font-bold text-slate-800 block">GST Percentage (%)</label>
              {!isEditing ? (
                <p className="text-sm font-bold text-blue-900">
                  {config.gstPercent}% (Australian GST)
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={config.gstPercent}
                    onChange={(e) =>
                      setConfig({ ...config, gstPercent: parseFloat(e.target.value) || 10 })
                    }
                    className="w-28 text-xs font-bold"
                  />
                  <span className="text-xs text-slate-500 font-semibold">%</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 block">
                Standard Quotation Terms & Conditions
              </label>
              <span className="text-[11px] text-slate-400">
                Printed on customer quotes and emails
              </span>
            </div>
            {!isEditing ? (
              <pre className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                {config.termsAndConditions}
              </pre>
            ) : (
              <Textarea
                rows={8}
                value={config.termsAndConditions}
                onChange={(e) => setConfig({ ...config, termsAndConditions: e.target.value })}
                className="text-xs font-mono"
              />
            )}
          </div>
        </div>
      )}

      {/* ── SubTab 5: Formula Test Simulator ─────────────────────────────────── */}
      {activeSubTab === "preview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-600" />
              Charter Price Simulator
            </h4>
            <p className="text-xs text-slate-500">
              Test how current rate tables compute selling prices for various journey parameters.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Vehicle Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTestVehicle("Coach")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      testVehicle === "Coach"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Coach
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestVehicle("Bus")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      testVehicle === "Bus"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Bus
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Distance (km)
                  </label>
                  <Input
                    type="number"
                    value={testDistance}
                    onChange={(e) => setTestDistance(parseFloat(e.target.value) || 0)}
                    className="text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Charter Hours
                  </label>
                  <Input
                    type="number"
                    min={8}
                    max={20}
                    value={testHours}
                    onChange={(e) => setTestHours(parseInt(e.target.value) || 8)}
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Day Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTestDayType("Weekday")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      testDayType === "Weekday"
                        ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Weekday
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestDayType("Weekend")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      testDayType === "Weekend"
                        ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Weekend
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Output Card */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800">Live Formula Breakdown</h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-blue-100">
                <span className="text-slate-600">Rate per km:</span>
                <span className="font-bold text-slate-800">
                  ${previewResult.ratePerKm.toFixed(2)} / km
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-blue-100">
                <span className="text-slate-600">
                  Distance Cost ({testDistance} km x ${previewResult.ratePerKm.toFixed(2)}):
                </span>
                <span className="font-bold text-slate-800">
                  ${previewResult.distanceCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-blue-100">
                <span className="text-slate-600">
                  Driver Wage Cost ({testHours}h · {testDayType}):
                </span>
                <span className="font-bold text-slate-800">
                  ${previewResult.driverWageCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-blue-200 font-bold text-slate-900">
                <span>Subtotal (before GST):</span>
                <span>${previewResult.subtotalBeforeGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-blue-100 text-slate-600">
                <span>GST (10%):</span>
                <span>${previewResult.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-sm text-blue-900">
                <span>Final Customer Price:</span>
                <span className="text-base font-extrabold">
                  ${previewResult.finalCustomerPrice.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-blue-100 text-[11px] text-slate-500 space-y-1 shadow-2xs">
              <p className="font-bold text-slate-700">Formula Verification:</p>
              <p>Price before GST = Distance Charge + Driver Wage Cost</p>
              <p className="font-mono text-blue-800">
                ${previewResult.distanceCost.toFixed(2)} + $
                {previewResult.driverWageCost.toFixed(2)} = $
                {previewResult.subtotalBeforeGst.toFixed(2)}
              </p>
              <p className="font-mono text-emerald-800">
                Final Price = ${previewResult.subtotalBeforeGst.toFixed(2)} + $
                {previewResult.gstAmount.toFixed(2)} = $
                {previewResult.finalCustomerPrice.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
