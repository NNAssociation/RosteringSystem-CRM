"use client";

import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEmployeeAccess } from "@/components/workplace/access";
import { cn } from "@/lib/utils";
import { dateParts, useWorkflowApi } from "@/lib/workflow-api";
import { addDays, format, subDays } from "date-fns";
import {
  Bus,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface FleetVehicle {
  id: number;
  make: string;
  model: string;
  licensePlate: string;
  maxPassengers: number | null;
  status: string;
}

interface AssignmentItem {
  id: number;
  jobId: number;
  driverId: number | null;
  vehicleId: number | null;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  version: number;
  notes?: string;
  driver?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  vehicle?: FleetVehicle | null;
  job: {
    id: number;
    jobStartLocation: string | null;
    jobEndLocation: string | null;
    booking?: {
      passengerCount: number | null;
      bookingType: string | null;
      customer?: {
        name: string | null;
      } | null;
    } | null;
  };
}

export default function MorningYardPage() {
  const api = useWorkflowApi();
  const { office, timeZone } = useEmployeeAccess();
  const [changingId, setChangingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    () => dateParts(new Date().toISOString(), timeZone).date,
  );
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleMap, setSelectedVehicleMap] = useState<Record<number, number>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<"ALL" | "ALLOCATED" | "PENDING">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingVehicleId, setUpdatingVehicleId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleUpdateVehicleStatus = async (vehId: number, newStatus: string) => {
    setUpdatingVehicleId(vehId);
    try {
      await api(`fleet/${vehId}`, "PATCH", { status: newStatus });
      setVehicles((prev) => prev.map((v) => (v.id === vehId ? { ...v, status: newStatus } : v)));
      toast.success(`Vehicle status updated to ${newStatus.replace("_", " ")}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update vehicle status");
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  const fetchYardData = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api(`yard/board?date=${selectedDate}`)) as {
        assignments: AssignmentItem[];
        vehicles: FleetVehicle[];
      };
      setAssignments(data.assignments || []);
      setVehicles(data.vehicles || []);
    } catch (err: any) {
      console.error("Failed to load yard board data:", err);
      toast.error(err.message || "Failed to load yard board");
    } finally {
      setLoading(false);
    }
  }, [api, selectedDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch lifecycle includes loading state for the selected server query.
    fetchYardData();
  }, [fetchYardData]);

  const handleAssignBus = async (assignment: AssignmentItem) => {
    const vehicleId = selectedVehicleMap[assignment.id];
    if (!vehicleId) {
      toast.error("Please select a bus from the available fleet.");
      return;
    }

    setSavingId(assignment.id);
    try {
      await api(`yard/assignments/${assignment.id}/vehicle`, "PATCH", {
        vehicleId,
        version: assignment.version,
      });

      const selectedVeh = vehicles.find((v) => v.id === vehicleId);
      const driverName = assignment.driver
        ? `${assignment.driver.firstName || ""} ${assignment.driver.lastName || ""}`.trim() ||
          assignment.driver.email
        : "driver";

      toast.success(`Bus ${selectedVeh?.licensePlate || ""} assigned to ${driverName}!`);
      setChangingId(null);
      setSelectedVehicleMap({});
      await fetchYardData();
    } catch (err: any) {
      console.error("Yard allocation failed:", err);
      toast.error(err.message || "Failed to allocate vehicle. Reload and retry.");
    } finally {
      setSavingId(null);
    }
  };

  // Calculations
  const totalRuns = assignments.length;
  const allocatedRuns = assignments.filter((a) => Boolean(a.vehicleId)).length;
  const pendingRuns = assignments.filter((a) => !a.vehicleId).length;

  // Set of vehicle IDs already in use on this day
  const assignedVehicleIds = new Set(assignments.map((a) => a.vehicleId).filter(Boolean));
  const availableBuses = vehicles.filter(
    (v) => !assignedVehicleIds.has(v.id) && (v.status === "ACTIVE" || v.status === "AVAILABLE"),
  );

  function busesForRun(run: AssignmentItem) {
    return vehicles.filter(
      (vehicle) =>
        ["ACTIVE", "AVAILABLE"].includes(vehicle.status) &&
        !assignments.some(
          (other) =>
            other.id !== run.id &&
            other.vehicleId === vehicle.id &&
            other.status !== "CANCELLED" &&
            Date.parse(other.scheduledStart) < Date.parse(run.scheduledEnd) &&
            Date.parse(other.scheduledEnd) > Date.parse(run.scheduledStart),
        ),
    );
  }

  // Filtered runs
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterMode === "ALLOCATED" && !a.vehicleId) return false;
      if (filterMode === "PENDING" && a.vehicleId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const driverName = `${a.driver?.firstName || ""} ${a.driver?.lastName || ""}`.toLowerCase();
        const cust = (a.job?.booking?.customer?.name || "").toLowerCase();
        const startLoc = (a.job?.jobStartLocation || "").toLowerCase();
        const endLoc = (a.job?.jobEndLocation || "").toLowerCase();
        const plate = (a.vehicle?.licensePlate || "").toLowerCase();
        if (
          !driverName.includes(q) &&
          !cust.includes(q) &&
          !startLoc.includes(q) &&
          !endLoc.includes(q) &&
          !plate.includes(q) &&
          !a.jobId.toString().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [assignments, filterMode, searchTerm]);

  // Paginated runs
  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage);
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAssignments.slice(start, start + itemsPerPage);
  }, [filteredAssignments, currentPage, itemsPerPage]);

  const filterKey = JSON.stringify([filterMode, searchTerm, selectedDate]);
  const [loadedFilterKey, setLoadedFilterKey] = useState(filterKey);
  if (filterKey !== loadedFilterKey) {
    setLoadedFilterKey(filterKey);
    setCurrentPage(1);
    setChangingId(null);
    setSelectedVehicleMap({});
  }

  const stats = [
    { label: "ALL", count: totalRuns, title: "All Runs" },
    { label: "ALLOCATED", count: allocatedRuns, title: "Allocated" },
    { label: "PENDING", count: pendingRuns, title: "Awaiting Bus" },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* CRM Standard PageHeader */}
      <PageHeader
        title="Morning Yard Board"
        description="Daily bus pre-trip inspection, readiness status & depot vehicle allocation for rostered drivers."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Morning Yard" }]}
        className="px-0 py-0 border-none"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchYardData}
              disabled={loading}
              className="h-10 px-4 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium shadow-sm"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Scheduled Runs
          </span>
          <p className="mt-1 text-2xl font-black text-slate-900">{totalRuns}</p>
          <span className="text-xs text-slate-500 font-medium">For this operational date</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Buses Allocated
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-800">{allocatedRuns}</p>
          <span className="text-xs text-emerald-600 font-medium">Ready to roll</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Awaiting Yard Bus
          </span>
          <p className="mt-1 text-2xl font-black text-amber-900">{pendingRuns}</p>
          <span className="text-xs text-amber-700 font-medium">Requires morning assignment</span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Available in Depot
          </span>
          <p className="mt-1 text-2xl font-black text-blue-900">{availableBuses.length}</p>
          <span className="text-xs text-blue-600 font-medium">Ready fleet coaches</span>
        </div>
      </div>

      {/* Standard CRM FilterBar matching customers/bookings */}
      <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
        <FilterGroup position="left" className="gap-1">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => setFilterMode(stat.label as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all",
                filterMode === stat.label
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              {stat.title} ({stat.count})
            </button>
          ))}
        </FilterGroup>

        <FilterGroup position="right" className="gap-3">
          {/* Operating Date Controls */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const prev = subDays(new Date(selectedDate), 1);
                setSelectedDate(format(prev, "yyyy-MM-dd"));
              }}
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="flex items-center gap-1.5 px-3 text-xs font-bold text-slate-800">
              <Calendar size={14} className="text-blue-600" />
              <span>{format(new Date(selectedDate), "EEE, d MMM yyyy")}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const next = addDays(new Date(selectedDate), 1);
                setSelectedDate(format(next, "yyyy-MM-dd"));
              }}
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
            className="text-xs font-semibold h-9 rounded-xl border-slate-200"
          >
            Today
          </Button>

          <div className="relative group flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
              size={16}
            />
            <Input
              placeholder="Search driver, route, vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-9 w-full bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-xs font-medium"
            />
          </div>
        </FilterGroup>
      </FilterBar>

      {/* Main Allocation Area matching customers split view */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* Left Column: Scheduled Runs to Allocate */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              <span>Today&apos;s Driver Runs</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredAssignments.length} total)
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs font-semibold">Loading rostered driver runs...</p>
            </div>
          ) : paginatedAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">No matching runs</p>
              <p className="text-xs text-slate-500">
                All scheduled driver runs for this date match your selection.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedAssignments.map((assignment) => {
                const isAllocated = Boolean(assignment.vehicleId);
                const locked = ["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(
                  assignment.status,
                );
                const busOptions = busesForRun(assignment);
                const driverName = assignment.driver
                  ? `${assignment.driver.firstName || ""} ${assignment.driver.lastName || ""}`.trim() ||
                    assignment.driver.email
                  : "Unassigned Driver";
                const paxCount = assignment.job?.booking?.passengerCount || 0;

                return (
                  <Card
                    key={assignment.id}
                    className={cn(
                      "border transition-all overflow-hidden shadow-2xs",
                      isAllocated
                        ? "border-slate-200 bg-white hover:border-blue-300"
                        : "border-amber-200 bg-amber-50/20 hover:border-amber-400",
                    )}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                            Job #{assignment.jobId}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{driverName}</span>
                          <span className="text-xs text-slate-400 font-medium">·</span>
                          <span className="text-xs text-slate-600 font-medium">
                            {assignment.job?.booking?.customer?.name || "Private Charter"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                            <Clock size={13} className="text-blue-600" />
                            {assignment.scheduledStart
                              ? dateParts(assignment.scheduledStart, timeZone).time
                              : "--:--"}
                            {" → "}
                            {assignment.scheduledEnd
                              ? dateParts(assignment.scheduledEnd, timeZone).time
                              : "--:--"}
                          </span>

                          {isAllocated ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">
                              Allocated
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 text-[10px] font-bold">
                              Pending Bus
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          {assignment.job?.jobStartLocation || "Depot"}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="truncate">
                          {assignment.job?.jobEndLocation || "Destination"}
                        </span>
                        {paxCount > 0 && (
                          <span className="ml-auto text-[11px] font-bold text-slate-700 shrink-0 flex items-center gap-1">
                            <Users size={12} className="text-slate-400" />
                            {paxCount} pax
                          </span>
                        )}
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        {isAllocated && assignment.vehicle && changingId !== assignment.id ? (
                          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                            <div className="flex items-center gap-2">
                              <Bus size={15} className="text-blue-600" />
                              <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border text-slate-900">
                                {assignment.vehicle.licensePlate}
                              </span>
                              <span className="text-xs text-slate-600 font-medium">
                                {assignment.vehicle.make} {assignment.vehicle.model}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({assignment.vehicle.maxPassengers || 0} seats)
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={savingId !== null || locked}
                              title={
                                locked
                                  ? "Started or completed runs cannot change vehicles"
                                  : "Choose a replacement bus"
                              }
                              onClick={() => {
                                setChangingId(assignment.id);
                                setSelectedVehicleMap((previous) => ({
                                  ...previous,
                                  [assignment.id]: assignment.vehicleId!,
                                }));
                              }}
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 font-semibold"
                            >
                              Change Bus
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <div className="relative flex-1 w-full">
                              <select
                                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                aria-label={`Bus for job ${assignment.jobId}`}
                                disabled={savingId !== null || locked}
                                value={selectedVehicleMap[assignment.id] || ""}
                                onChange={(e) =>
                                  setSelectedVehicleMap({
                                    ...selectedVehicleMap,
                                    [assignment.id]: Number(e.target.value),
                                  })
                                }
                              >
                                <option value="">Select bus from depot fleet...</option>
                                {assignment.vehicle &&
                                  !busOptions.some(
                                    (vehicle) => vehicle.id === assignment.vehicleId,
                                  ) && (
                                    <option value={assignment.vehicleId!} disabled>
                                      {assignment.vehicle.licensePlate} — Current bus (unavailable)
                                    </option>
                                  )}
                                {busOptions.map((veh) => {
                                  const capacityOk =
                                    !veh.maxPassengers || veh.maxPassengers >= paxCount;
                                  return (
                                    <option key={veh.id} value={veh.id}>
                                      {veh.licensePlate} — {veh.make} {veh.model} (
                                      {veh.maxPassengers || 0} seats)
                                      {!capacityOk ? " [⚠️ Less seats than pax]" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <Button
                              size="sm"
                              disabled={
                                !selectedVehicleMap[assignment.id] ||
                                selectedVehicleMap[assignment.id] === assignment.vehicleId ||
                                savingId !== null ||
                                locked
                              }
                              onClick={() => handleAssignBus(assignment)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0"
                            >
                              {savingId === assignment.id
                                ? "Saving..."
                                : isAllocated
                                  ? "Save Bus Change"
                                  : "Confirm Yard Allocation"}
                            </Button>
                            {isAllocated && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={savingId !== null}
                                onClick={() => setChangingId(null)}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        )}
                        {locked && (
                          <p className="mt-2 text-xs text-slate-500">
                            Bus changes are locked for{" "}
                            {assignment.status.toLowerCase().replaceAll("_", " ")} runs.
                          </p>
                        )}
                        {!locked &&
                          (changingId === assignment.id || !isAllocated) &&
                          !busOptions.some((vehicle) => vehicle.id !== assignment.vehicleId) && (
                            <p className="mt-2 text-xs text-amber-700">
                              No replacement buses are available during this run. Check overlapping
                              runs and fleet readiness.
                            </p>
                          )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Standard CRM Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredAssignments.length}
            itemsPerPage={itemsPerPage}
          />
        </div>

        {/* Right Column: Depot Fleet Readiness matching Customers side panel */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bus size={18} className="text-blue-600" />
              <span>Depot Fleet Status</span>
            </h2>
            <Badge variant="secondary" className="text-xs">
              {vehicles.length} Total Fleet
            </Badge>
          </div>

          <Card className="border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <CardContent className="p-0 divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
              {vehicles.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No fleet vehicles recorded.
                </p>
              ) : (
                vehicles.map((veh) => {
                  const isAssigned = assignedVehicleIds.has(veh.id);

                  return (
                    <div
                      key={veh.id}
                      className={cn(
                        "p-3.5 flex items-center justify-between gap-3 text-xs transition-colors",
                        isAssigned ? "bg-slate-50/70 opacity-75" : "hover:bg-blue-50/30",
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border text-[11px]">
                            {veh.licensePlate}
                          </span>
                          <span>
                            {veh.make} {veh.model}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {veh.maxPassengers
                            ? `${veh.maxPassengers} Passenger Seats`
                            : "Capacity N/A"}
                        </p>
                      </div>

                      <div>
                        {isAssigned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            On Run Today
                          </span>
                        ) : (
                          <select
                            disabled={!office || updatingVehicleId === veh.id}
                            title={
                              !office ? "Fleet readiness changes require office staff" : undefined
                            }
                            value={veh.status || "ACTIVE"}
                            onChange={(e) => handleUpdateVehicleStatus(veh.id, e.target.value)}
                            className={cn(
                              "h-7 rounded-lg px-2 text-[11px] font-bold border focus:outline-none transition-colors",
                              veh.status === "ACTIVE" || veh.status === "AVAILABLE"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : veh.status === "MAINTENANCE"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-300",
                            )}
                          >
                            <option value="ACTIVE">Yard Available</option>
                            <option value="MAINTENANCE">Workshop Maint.</option>
                            <option value="IN_INSPECTION">Inspection Pending</option>
                            <option value="OUT_OF_SERVICE">Out of Service</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
