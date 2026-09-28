"use client";
import { CreatedRecordNotice } from "@/components/shared/created-record-notice";

import React, { useState, useEffect, useMemo } from "react";
import { useGetVehiclesQuery } from "@/services/api";
import { useHeader } from "@/providers/header-provider";
import { FleetTable } from "@/components/fleet/fleet-table";
import { AddFleetDialog } from "@/components/fleet/add-fleet-dialog";
import { FleetDetailsPanel } from "@/components/fleet/fleet-details-panel";
import { Vehicle } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileDownload
} from "@mui/icons-material";
import { cn } from "@/lib/utils";

export default function FleetPage() {
  const { setHeaderConfig } = useHeader();

  // Fleet State (via RTK Query)
  const { data: vehicles = [], isLoading: fleetLoading, isError, refetch } = useGetVehiclesQuery();
  const [fleetSearchTerm, setFleetSearchTerm] = useState("");
  const [fleetStatusFilter, setFleetStatusFilter] = useState("All");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    setHeaderConfig({
      title: "Fleet Management",
    });
  }, [setHeaderConfig]);

  // Derived state
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v: Vehicle) => {
      const matchSearch =
        (v.make || "").toLowerCase().includes(fleetSearchTerm.toLowerCase()) ||
        (v.model || "").toLowerCase().includes(fleetSearchTerm.toLowerCase()) ||
        (v.licensePlate || "").toLowerCase().includes(fleetSearchTerm.toLowerCase());
      const status = (v.status || "").toUpperCase().replaceAll(" ", "_");
      const matchStatus = fleetStatusFilter === "All" || (fleetStatusFilter === "Available" ? ["ACTIVE", "AVAILABLE"].includes(status) : status === fleetStatusFilter.toUpperCase().replaceAll(" ", "_"));
      return matchSearch && matchStatus;
    });
  }, [vehicles, fleetSearchTerm, fleetStatusFilter]);

  const fleetStats = [
    { label: "All", count: vehicles.length },
    { label: "Inactive", count: vehicles.filter(v => v.status?.toUpperCase() === "INACTIVE").length },
    { label: "Available", count: vehicles.filter((v: Vehicle) => v.status === "Available").length },
    { label: "On Trip", count: vehicles.filter((v: Vehicle) => v.status === "On Trip").length },
    { label: "Maintenance", count: vehicles.filter((v: Vehicle) => v.status === "Maintenance").length },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Fleet Management"
        description="Manage vehicles, maintenance, and fleet availability"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Fleet" }
        ]}
        className="px-0 py-0 border-none"
              actions={
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="h-10 px-6 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium shadow-sm">
                    <FileDownload style={{ fontSize: '18px' }} />
                    <span className="font-medium">Export</span>
                  </Button>
                  <AddFleetDialog />
                </div>
              }
            />

            <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
              <FilterGroup position="left" className="gap-1">
                {fleetStats.map((stat) => (
                  <button
                    key={stat.label === "Inactive" ? "Deactivated" : stat.label}
                    onClick={() => setFleetStatusFilter(stat.label)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                      fleetStatusFilter === stat.label
                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {stat.label === "Inactive" ? "Deactivated" : stat.label}
                  </button>
                ))}
              </FilterGroup>

              <FilterGroup position="right" className="gap-4">
                <div className="relative group flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" style={{ fontSize: '20px' }} />
                  <Input
                    placeholder="Search vehicles..."
                    value={fleetSearchTerm}
                    onChange={(e) => setFleetSearchTerm(e.target.value)}
                    className="pl-10 pr-4 h-10 w-full lg:min-w-48 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
              </FilterGroup>
            </FilterBar><CreatedRecordNotice resource="fleet" records={vehicles} visible={filteredVehicles} clear={() => { setFleetSearchTerm(""); setFleetStatusFilter("All"); }} />

        <div className={cn("grid items-start gap-6", selectedVehicle ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]" : "grid-cols-1")}>
          <div className="min-w-0">
            {isError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not refresh vehicles. {vehicles.length ? "Showing previously loaded records." : ""} <Button variant="outline" onClick={() => refetch()}>Retry</Button></div>}
            <FleetTable
              vehicles={filteredVehicles}
              loading={fleetLoading}
              filter={fleetSearchTerm}
              statusFilter={fleetStatusFilter}
              onFilterChange={setFleetSearchTerm}
              selectedVehicleId={selectedVehicle ? selectedVehicle.id : null}
              onSelectVehicle={setSelectedVehicle}
            />
          </div>

          {selectedVehicle && (
            <div className="min-w-0 h-fit animate-in slide-in-from-right-8 duration-300">
              <FleetDetailsPanel
                vehicle={selectedVehicle}
                onClose={() => setSelectedVehicle(null)}
              />
            </div>
          )}
        </div>
    </div>
  );
}
