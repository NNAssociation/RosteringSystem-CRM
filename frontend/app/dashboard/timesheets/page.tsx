"use client";

import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmployeeAccess } from "@/components/workplace/access";
import { cn } from "@/lib/utils";
import { dateParts, useWorkflowApi } from "@/lib/workflow-api";
import { FileDownload, Search } from "@mui/icons-material";
import { addDays, format, subDays } from "date-fns";
import {
  Bus,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileSpreadsheet,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface DriverTimesheetRecord {
  id: number;
  jobId: number;
  bookingReference: string;
  customerName: string;
  routeDescription: string;
  serviceType: string;
  driverId: number;
  driverName: string;
  driverEmployeeNumber: string;
  vehicleId: number | null;
  vehiclePlate: string;
  vehicleType: "Coach" | "Bus" | "Unassigned";
  date: string;
  dayType: "Weekday" | "Weekend";
  jobStartTime: string;
  jobEndTime: string;
  jobHours: number;
  wageTierHours: number;
  timeBasis: "ACTUAL" | "SCHEDULED";
  assignmentStatus: string;
  canApprove: boolean;
  hourlyRate: number;
  totalWageAmount: number;
  status: "PENDING_REVIEW" | "APPROVED";
  supervisorNotes?: string;
}

interface TimesheetSummaryStats {
  activeDriversCount: number;
  totalJobHours: number;
  totalWageCost: number;
  pendingApprovalsCount: number;
}

export default function DriverTimesheetsPage() {
  const api = useWorkflowApi();
  const { timeZone } = useEmployeeAccess();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => dateParts(new Date().toISOString(), timeZone).date,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<DriverTimesheetRecord[]>([]);
  const [summary, setSummary] = useState<TimesheetSummaryStats>({
    activeDriversCount: 0,
    totalJobHours: 0,
    totalWageCost: 0,
    pendingApprovalsCount: 0,
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Pagination state matching customers/employees
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Load timesheets for selected date
  const fetchTimesheets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api(`dispatch/timesheets?date=${selectedDate}`);
      setRecords(data.records || []);
      setSummary(
        data.summary || {
          activeDriversCount: 0,
          totalJobHours: 0,
          totalWageCost: 0,
          pendingApprovalsCount: 0,
        },
      );
    } catch (err: any) {
      console.error("Timesheets fetch error:", err);
      toast.error(err.message || "Failed to load driver timesheets");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch lifecycle includes loading state for the selected server query.
    fetchTimesheets();
  }, [fetchTimesheets]);

  // Unique drivers list for filter
  const driverOptions = useMemo(() => {
    const map = new Map<number, string>();
    records.forEach((r) => {
      if (r.driverId && r.driverName) {
        map.set(r.driverId, r.driverName);
      }
    });
    return Array.from(map.entries());
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedDriver !== "ALL" && r.driverId.toString() !== selectedDriver) {
        return false;
      }
      if (selectedStatus !== "ALL" && r.status !== selectedStatus) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          r.driverName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.bookingReference.toLowerCase().includes(q) ||
          r.vehiclePlate.toLowerCase().includes(q) ||
          r.routeDescription.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [records, selectedDriver, selectedStatus, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const filterKey = JSON.stringify([selectedDate, selectedDriver, selectedStatus, searchTerm]);
  const [loadedFilterKey, setLoadedFilterKey] = useState(filterKey);
  if (filterKey !== loadedFilterKey) {
    setLoadedFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Approve a timesheet entry
  const handleApprove = async (record: DriverTimesheetRecord) => {
    try {
      setApprovingId(record.id);
      await api(`dispatch/timesheets/${record.id}/approve`, "POST");
      toast.success(`Timesheet approved for ${record.driverName}`);
      await fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  // CSV export of actual job times
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export");
      return;
    }

    const headers = [
      "Job ID",
      "Booking Ref",
      "Driver Name",
      "Employee Number",
      "Vehicle Plate",
      "Vehicle Type",
      "Date",
      "Day Type",
      "Start Time",
      "End Time",
      "Job Hours",
      "Time Basis",
      "Job Status",
      "Wage Tier Hours",
      "Hourly Award Rate ($)",
      "Total Wage ($)",
      "Status",
      "Route",
    ];

    const rows = filteredRecords.map((r) => [
      r.jobId,
      r.bookingReference,
      `"${r.driverName}"`,
      r.driverEmployeeNumber,
      r.vehiclePlate,
      r.vehicleType,
      r.date,
      r.dayType,
      r.jobStartTime,
      r.jobEndTime,
      r.jobHours,
      r.timeBasis,
      r.assignmentStatus,
      r.wageTierHours,
      r.hourlyRate.toFixed(2),
      r.totalWageAmount.toFixed(2),
      r.status,
      `"${r.routeDescription}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `driver_timesheets_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Timesheets CSV exported");
  };

  const statusStats = [
    { label: "ALL", count: records.length, title: "All Shifts" },
    {
      label: "PENDING_REVIEW",
      count: records.filter((r) => r.status === "PENDING_REVIEW").length,
      title: "Pending Review",
    },
    {
      label: "APPROVED",
      count: records.filter((r) => r.status === "APPROVED").length,
      title: "Approved",
    },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Standard CRM PageHeader */}
      <PageHeader
        title="Driver Timesheets"
        description={`Completed jobs, actual hours and configured wage tiers. Times in ${timeZone}; totals include any scheduled estimates.`}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Driver Timesheets" }]}
        className="px-0 py-0 border-none"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              className="h-10 px-6 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium shadow-sm"
            >
              <FileDownload style={{ fontSize: "18px" }} />
              <span className="font-medium">Export</span>
            </Button>
            <Button
              variant="outline"
              onClick={fetchTimesheets}
              disabled={loading}
              className="h-10 px-4 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium shadow-sm"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Rostered Drivers
            </span>
            <Users size={16} className="text-blue-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-900">{summary.activeDriversCount}</p>
          <span className="text-xs text-slate-500 font-medium">On job runs today</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Job Hours
            </span>
            <Clock size={16} className="text-indigo-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-indigo-900">{summary.totalJobHours}h</p>
          <span className="text-xs text-indigo-600 font-medium">Accumulated job time</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Driver Wages
            </span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-emerald-800">
            ${summary.totalWageCost.toFixed(2)}
          </p>
          <span className="text-xs text-emerald-600 font-medium">Award scale cost</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pending Approvals
            </span>
            <CheckCircle2 size={16} className="text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-amber-900">{summary.pendingApprovalsCount}</p>
          <span className="text-xs text-amber-600 font-medium">Awaiting supervisor sign-off</span>
        </div>
      </div>

      {/* Standard CRM FilterBar matching customers/bookings */}
      <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
        <FilterGroup position="left" className="gap-1">
          {statusStats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => setSelectedStatus(stat.label)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all",
                selectedStatus === stat.label
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              {stat.title} ({stat.count})
            </button>
          ))}
        </FilterGroup>

        <FilterGroup position="right" className="gap-3">
          {/* Operating Date Picker */}
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

          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Drivers</option>
            {driverOptions.map(([id, name]) => (
              <option key={id} value={id.toString()}>
                {name}
              </option>
            ))}
          </select>

          <div className="relative group flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
              style={{ fontSize: "18px" }}
            />
            <Input
              placeholder="Search driver, customer, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-9 w-full bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-xs font-medium"
            />
          </div>
        </FilterGroup>
      </FilterBar>

      {/* Main Timesheet Table in CRM standard table container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-semibold">Loading driver job timesheets…</p>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <FileSpreadsheet className="h-8 w-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No timesheet records found</p>
            <p className="text-xs text-slate-500">
              There are no scheduled driver assignments matching your date and filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Driver & Emp #</th>
                  <th className="p-4">Job & Route</th>
                  <th className="p-4">Assigned Vehicle</th>
                  <th className="p-4">Job Start</th>
                  <th className="p-4">Job End</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Award Wage Rate</th>
                  <th className="p-4">Total Wage</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 align-middle">
                      <div className="font-bold text-slate-900">{r.driverName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.driverEmployeeNumber}
                      </span>
                    </td>

                    <td className="p-4 align-middle max-w-xs">
                      <div className="font-semibold text-blue-700">{r.bookingReference}</div>
                      <div className="truncate text-slate-600">{r.customerName}</div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {r.routeDescription}
                      </p>
                    </td>

                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Bus size={13} className="text-slate-400" />
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border text-[11px]">
                          {r.vehiclePlate}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{r.vehicleType}</span>
                    </td>

                    <td className="p-4 align-middle font-mono font-bold text-slate-800">
                      {r.jobStartTime}
                      <p className="text-[10px] font-sans font-normal text-slate-500">
                        {r.timeBasis === "ACTUAL" ? "Confirmed actual" : "Scheduled estimate"}
                      </p>
                    </td>

                    <td className="p-4 align-middle font-mono font-bold text-slate-800">
                      {r.jobEndTime}
                    </td>

                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-800 text-[11px]">
                        {r.jobHours} hrs
                      </span>
                    </td>

                    <td className="p-4 align-middle text-slate-600">
                      ${r.hourlyRate.toFixed(2)}/hr
                      <p className="text-[10px]">
                        {r.wageTierHours}-hour tier · {r.dayType}
                      </p>
                    </td>

                    <td className="p-4 align-middle font-bold text-emerald-700 text-sm">
                      ${r.totalWageAmount.toFixed(2)}
                      <p className="text-[10px] font-normal text-slate-500">
                        {r.jobHours} hrs × ${r.hourlyRate.toFixed(2)}
                      </p>
                    </td>

                    <td className="p-4 align-middle">
                      <p className="mb-1 text-[10px] font-semibold">
                        {r.assignmentStatus.replaceAll("_", " ")}
                      </p>
                      {r.status === "APPROVED" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold gap-1">
                          <CheckCircle2 size={11} /> Approved
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-bold"
                        >
                          Pending Review
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 align-middle text-right">
                      {r.status !== "APPROVED" ? (
                        <Button
                          size="sm"
                          disabled={approvingId === r.id || !r.canApprove}
                          title={
                            !r.canApprove
                              ? "Requires a completed job with confirmed actual times"
                              : undefined
                          }
                          onClick={() => handleApprove(r)}
                          className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-lg"
                        >
                          <Check size={13} />
                          {approvingId === r.id ? "Approving…" : "Approve"}
                        </Button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600">
                          Signed Off
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Standard CRM Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredRecords.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
}
