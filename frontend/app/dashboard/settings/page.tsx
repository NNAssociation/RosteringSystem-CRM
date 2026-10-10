"use client";

import { CharterPricingSettings } from "@/components/settings/CharterPricingSettings";
import { DialogBox } from "@/components/shared/dialog-box";
import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { MapPickerModal } from "@/components/shared/MapPickerModal";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useHeader } from "@/providers/header-provider";
import {
  Depot,
  useCreateDepotMutation,
  useDeleteDepotMutation,
  useGetDepotsQuery,
  useGetSchedulingSettingsQuery,
  useUpdateDepotMutation,
  useUpdateSchedulingSettingsMutation,
} from "@/services/api";
import { Add, Delete, Edit } from "@mui/icons-material";
import { Calculator, Clock, Edit3, Lock, MapPin, Save, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
  const { setHeaderConfig } = useHeader();
  const [activeTab, setActiveTab] = useState<"pricing" | "scheduling" | "depots">("pricing");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Depots queries & mutations
  const { data: depots, isLoading, refetch } = useGetDepotsQuery();
  const [createDepot] = useCreateDepotMutation();
  const [updateDepot] = useUpdateDepotMutation();
  const [deleteDepot] = useDeleteDepotMutation();

  // Scheduling rules queries & mutations
  const { data: schedulingSettings, isLoading: isLoadingSettings } =
    useGetSchedulingSettingsQuery();
  const [updateSchedulingSettings, { isLoading: isUpdatingSettings }] =
    useUpdateSchedulingSettingsMutation();

  const [schedulingForm, setSchedulingForm] = useState({
    maxContinuousDrivingHours: "5.5",
    minBreakDurationMinutes: "30",
    maxShiftDurationHours: "12",
    bufferMinutes: "10",
    depotTravelBuffer: "10",
    transitTimeMinutes: "60",
  });

  const [originalSchedulingForm, setOriginalSchedulingForm] = useState(schedulingForm);

  const [loadedSchedulingSettings, setLoadedSchedulingSettings] = useState(schedulingSettings);
  if (schedulingSettings !== loadedSchedulingSettings) {
    setLoadedSchedulingSettings(schedulingSettings);
    if (schedulingSettings) {
      const loaded = {
        maxContinuousDrivingHours: (
          parseInt(schedulingSettings.maxContinuousDrivingMinutes || "330") / 60
        ).toString(),
        minBreakDurationMinutes: schedulingSettings.minBreakDurationMinutes || "30",
        maxShiftDurationHours: (
          parseInt(schedulingSettings.maxShiftDurationMinutes || "720") / 60
        ).toString(),
        bufferMinutes: schedulingSettings.bufferMinutes || "10",
        depotTravelBuffer: schedulingSettings.depotTravelBuffer || "10",
        transitTimeMinutes: schedulingSettings.transitTimeMinutes || "60",
      };
      setSchedulingForm(loaded);
      setOriginalSchedulingForm(loaded);
    }
  }

  useEffect(() => {
    setHeaderConfig({ title: "Settings" });
  }, [setHeaderConfig]);

  const handleSaveScheduling = async () => {
    try {
      await updateSchedulingSettings({
        maxContinuousDrivingMinutes: (
          parseFloat(schedulingForm.maxContinuousDrivingHours) * 60
        ).toString(),
        minBreakDurationMinutes: schedulingForm.minBreakDurationMinutes,
        maxShiftDurationMinutes: (parseFloat(schedulingForm.maxShiftDurationHours) * 60).toString(),
        bufferMinutes: schedulingForm.bufferMinutes,
        depotTravelBuffer: schedulingForm.depotTravelBuffer,
        transitTimeMinutes: schedulingForm.transitTimeMinutes,
      }).unwrap();
      setOriginalSchedulingForm(schedulingForm);
      setIsEditing(false);
      toast.success("HVNL scheduling rules saved successfully");
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to save scheduling rules");
    }
  };

  const handleCancelScheduling = () => {
    setSchedulingForm(originalSchedulingForm);
    setIsEditing(false);
  };

  // Depot Dialog State
  const [mapOpen, setMapOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
  });

  const resetForm = () => {
    setFormData({ name: "", address: "", lat: "", lng: "" });
    setEditingDepot(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (depot: Depot) => {
    setFormData({
      name: depot.name,
      address: depot.address || "",
      lat: depot.lat.toString(),
      lng: depot.lng.toString(),
    });
    setEditingDepot(depot);
    setIsDialogOpen(true);
  };

  const handleSubmitDepot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng || isNaN(parseFloat(formData.lat))) {
      toast.error("Please search for a location or drop a pin on the map.");
      return;
    }
    try {
      if (editingDepot) {
        await updateDepot({
          id: editingDepot.id,
          name: formData.name,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        }).unwrap();
        toast.success("Depot updated successfully");
      } else {
        await createDepot({
          name: formData.name,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        }).unwrap();
        toast.success("Depot created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to save depot");
    }
  };

  const handleDeleteDepot = async (id: number) => {
    if (confirm("Are you sure you want to delete this depot?")) {
      try {
        await deleteDepot(id).unwrap();
        toast.success("Depot deleted successfully");
      } catch (error: any) {
        toast.error(error.data?.error || "Failed to delete depot");
      }
    }
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <PageHeader
          title="System Settings"
          description="Manage charter pricing formulas, HVNL fatigue limits, and physical depot facilities."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
          className="px-0 py-0 border-none"
        />
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          Loading system settings…
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "pricing" as const, label: "Charter Pricing Rates (Punchbowl Bus)", icon: Calculator },
    { id: "scheduling" as const, label: "HVNL Fatigue & Scheduling Rules", icon: Clock },
    { id: "depots" as const, label: "Depot Locations", icon: MapPin },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page Header matching CRM standards */}
      <PageHeader
        title="System Settings"
        description="Configure charter pricing formulas, HVNL fatigue limits, and physical depot facilities."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
        className="px-0 py-0 border-none"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "depots" ? (
              <Button
                onClick={openAddDialog}
                className="h-10 px-5 gap-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-medium shadow-sm"
              >
                <Add style={{ fontSize: 20 }} />
                <span>Add Depot</span>
              </Button>
            ) : !isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="h-10 px-5 gap-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-medium shadow-sm"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Settings</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeTab === "scheduling") {
                      handleCancelScheduling();
                    } else {
                      setIsEditing(false);
                    }
                  }}
                  className="h-10 px-4 gap-1.5 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </Button>
                {activeTab === "scheduling" && (
                  <Button
                    onClick={handleSaveScheduling}
                    disabled={isUpdatingSettings}
                    className="h-10 px-5 gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium shadow-sm"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isUpdatingSettings ? "Saving…" : "Save Changes"}</span>
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* FilterBar / Tab Navigation Pill Bar */}
      <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
        <FilterGroup position="left" className="gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isEditing && activeTab !== tab.id) {
                    if (!confirm("You have unsaved changes. Switch tabs and discard?")) {
                      return;
                    }
                    setIsEditing(false);
                  }
                  setActiveTab(tab.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-102"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </FilterGroup>

        <FilterGroup position="right" className="gap-2">
          {activeTab !== "depots" &&
            (isEditing ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Editing Mode (Unsaved)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100/90 px-3 py-1.5 rounded-full border border-slate-200">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Locked (Read-Only)
              </span>
            ))}
        </FilterGroup>
      </FilterBar>

      {/* ── TAB 1: CHARTER PRICING RATES ────────────────────────────────────────── */}
      {activeTab === "pricing" && (
        <CharterPricingSettings
          isEditing={isEditing}
          onStartEdit={() => setIsEditing(true)}
          onCancelEdit={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      )}

      {/* ── TAB 2: HVNL FATIGUE & SCHEDULING RULES ────────────────────────────── */}
      {activeTab === "scheduling" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Driver Working Time & Duty Rules
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated constraint checks preventing driver fatigue violations during job
                  assignment.
                </p>
              </div>
              {!isEditing && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  <Lock className="h-3 w-3 text-slate-400" />
                  Read-Only (Locked)
                </span>
              )}
            </div>

            {/* Driver Working Time */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Driver Duty Thresholds
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Maximum Continuous Driving
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.maxContinuousDrivingHours} Hours (
                      {parseFloat(schedulingForm.maxContinuousDrivingHours) * 60} mins)
                    </div>
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      value={schedulingForm.maxContinuousDrivingHours}
                      onChange={(e) =>
                        setSchedulingForm({
                          ...schedulingForm,
                          maxContinuousDrivingHours: e.target.value,
                        })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <span className="text-[11px] text-slate-400">HVNL Solo limit: 5 ¼ hours</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Minimum Break Duration
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.minBreakDurationMinutes} Minutes
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={schedulingForm.minBreakDurationMinutes}
                      onChange={(e) =>
                        setSchedulingForm({
                          ...schedulingForm,
                          minBreakDurationMinutes: e.target.value,
                        })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <span className="text-[11px] text-slate-400">Required stationary rest</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Maximum Shift Duration
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.maxShiftDurationHours} Hours (
                      {parseFloat(schedulingForm.maxShiftDurationHours) * 60} mins)
                    </div>
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      value={schedulingForm.maxShiftDurationHours}
                      onChange={(e) =>
                        setSchedulingForm({
                          ...schedulingForm,
                          maxShiftDurationHours: e.target.value,
                        })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <span className="text-[11px] text-slate-400">Maximum daily work time</span>
                </div>
              </div>
            </div>

            {/* Travel Buffers */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Operational & Travel Buffers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Buffer Between Jobs
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.bufferMinutes} Minutes
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={schedulingForm.bufferMinutes}
                      onChange={(e) =>
                        setSchedulingForm({ ...schedulingForm, bufferMinutes: e.target.value })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <span className="text-[11px] text-slate-400">
                    Safety margin between consecutive bookings
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Depot Travel Buffer
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.depotTravelBuffer} Minutes
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={schedulingForm.depotTravelBuffer}
                      onChange={(e) =>
                        setSchedulingForm({ ...schedulingForm, depotTravelBuffer: e.target.value })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <span className="text-[11px] text-slate-400">
                    Deadhead travel time allowance to base depot
                  </span>
                </div>
              </div>
            </div>

            {/* Auto-Schedule */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Auto-Scheduling Constraints
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Transit Time Between Jobs
                  </label>
                  {!isEditing ? (
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">
                      {schedulingForm.transitTimeMinutes} Minutes
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={schedulingForm.transitTimeMinutes}
                      onChange={(e) =>
                        setSchedulingForm({ ...schedulingForm, transitTimeMinutes: e.target.value })
                      }
                      className="h-10 text-sm font-medium border-slate-200 rounded-xl"
                    />
                  )}
                  <p className="text-xs text-slate-400">
                    Minimum gap required between the end of one job and the start of the next job
                    during auto-scheduling.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Official HVNL Fatigue Management Standard Reference Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    FATIGUE MANAGEMENT WORK AND REST HOURS
                  </h3>
                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold">
                    HVNL Standard
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Drivers of heavy vehicles must comply with maximum driving hours and minimum rest
                  periods under the Heavy Vehicle National Law (HVNL). Drivers working for this
                  organisation must comply under the HVNL, including night rest breaks.
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  The below table applies to solo drivers in the bus and coach sector:
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-1/4">In any Period…</th>
                    <th className="py-3 px-4 w-3/8">
                      A driver must not work for more than a maximum of…
                    </th>
                    <th className="py-3 px-4 w-3/8">
                      And must have the rest of that period off work with at least a minimum rest
                      break of…
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">5 ½ hours</td>
                    <td className="py-2.5 px-4 font-medium">5 ¼ hours work time</td>
                    <td className="py-2.5 px-4">15 continuous minutes rest time</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">8 hours</td>
                    <td className="py-2.5 px-4 font-medium">7 ½ hours work time</td>
                    <td className="py-2.5 px-4">
                      30 minutes rest time in blocks of 15 continuous minutes
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">11 hours</td>
                    <td className="py-2.5 px-4 font-medium">10 hours work time</td>
                    <td className="py-2.5 px-4">
                      60 minutes rest time in blocks of 15 continuous minutes
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 bg-blue-50/30">
                    <td className="py-2.5 px-4 font-bold text-slate-900">24 hours</td>
                    <td className="py-2.5 px-4 font-medium">12 hours work time</td>
                    <td className="py-2.5 px-4 font-semibold text-blue-900">
                      7 continuous hours stationary rest time
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">7 days</td>
                    <td className="py-2.5 px-4 font-medium text-slate-400">—</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-900">6 x night rest breaks</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Night rest means 7 hours continual rest between 10pm and 8am
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 bg-blue-50/30">
                    <td className="py-2.5 px-4 font-bold text-slate-900">28 days</td>
                    <td className="py-2.5 px-4 font-medium">288 hours work time</td>
                    <td className="py-2.5 px-4 font-semibold text-blue-900">
                      4 x 24 hours continuous hours stationary rest time
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: DEPOT LOCATIONS ────────────────────────────────────────────── */}
      {activeTab === "depots" && (
        <div className="space-y-6">
          <DialogBox
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
            modal={false}
            title={editingDepot ? "Edit Depot" : "Add New Depot"}
          >
            <form onSubmit={handleSubmitDepot} className="space-y-4 p-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">Depot Name</label>
                <Input
                  required
                  placeholder="e.g. Punchbowl Base Depot"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  {formData.address || "Choose the depot entrance address"}
                </p>
                {formData.lat && (
                  <p className="text-xs text-slate-500">
                    Saved coordinates: {formData.lat}, {formData.lng}
                  </p>
                )}
                <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                  Choose depot location on map
                </Button>
                <p className="text-xs text-slate-400">
                  Existing coordinates are retained. Select on map to update.
                </p>
              </div>
              <MapPickerModal
                isOpen={mapOpen}
                onClose={() => setMapOpen(false)}
                onSelect={(p) =>
                  setFormData((prev) => ({
                    ...prev,
                    address: p.address,
                    lat: String(p.lat),
                    lng: String(p.lng),
                  }))
                }
              />

              <div className="flex justify-end pt-4 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingDepot ? "Save Changes" : "Create Depot"}</Button>
              </div>
            </form>
          </DialogBox>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Depot Locations</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Physical operating yards where drivers and buses depart and return.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {depots?.length || 0} configured
              </span>
            </div>

            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {depots?.map((depot) => (
                  <tr key={depot.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{depot.name}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {depot.address ? (
                        depot.address
                      ) : (
                        <span className="text-slate-400 italic">
                          Location mapped ({depot.lat}, {depot.lng})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(depot)}
                        className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-primary"
                        title="Edit Depot"
                      >
                        <Edit style={{ fontSize: 18 }} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDepot(depot.id)}
                        className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-red-500 ml-1"
                        title="Delete Depot"
                      >
                        <Delete style={{ fontSize: 18 }} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(!depots || depots.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      No depots found. Click &quot;Add Depot&quot; to register your first yard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
