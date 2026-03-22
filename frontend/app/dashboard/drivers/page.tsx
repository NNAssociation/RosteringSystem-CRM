"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useGetDriversQuery } from "@/app/api/userApi";
import { useHeader } from "@/providers/header-provider";
import { DriversTable } from "@/components/drivers/driver-table";
import { AddDriverDialog } from "@/components/drivers/add-driver-dialog";
import { DriverDetailsPanel } from "@/components/drivers/driver-details-panel";
import { Driver } from "@/app/types";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileDownload
} from "@mui/icons-material";
import { cn } from "@/lib/utils";

export default function DriversPage() {
  const { setHeaderConfig } = useHeader();
  const { data: drivers = [], isLoading: loading } = useGetDriversQuery();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver: Driver) => {
      const matchesSearch =
        (driver.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (driver.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.id.toString().includes(searchTerm);

      const matchesStatus =
        statusFilter === "ALL" ||
        (driver.status || "").toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchTerm, statusFilter]);

  useEffect(() => {
    setHeaderConfig({
      title: "Drivers Management",
    });
  }, [setHeaderConfig]);

  const stats = [
    { label: "ALL", count: drivers.length },
    { label: "ACTIVE", count: drivers.filter((d: Driver) => d.status === "Active").length },
    { label: "ON TRIP", count: drivers.filter((d: Driver) => d.status === "On Trip").length },
    { label: "INACTIVE", count: drivers.filter((d: Driver) => d.status === "Inactive").length },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/30">
      <div className="pb-8 pt-4 px-8">
        <div className={cn(
          "grid transition-all duration-500 gap-6",
          selectedDriver ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
        )}>
          <div className={cn(
            "space-y-6 transition-all duration-500",
            selectedDriver ? "lg:col-span-2" : "col-span-1"
          )}>
            <PageHeader
              title="Drivers"
              description="Manage your fleet personnel and their schedules"
              breadcrumbs={[
                { label: "Dashboard", href: "/" },
                { label: "Drivers" }
              ]}
              className="px-0 py-4 border-none"
              actions={
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="h-10 px-6 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium shadow-sm">
                    <FileDownload style={{ fontSize: '18px' }} />
                    <span className="font-medium">Export</span>
                  </Button>
                  <AddDriverDialog />
                </div>
              }
            />

            <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
              <FilterGroup position="left" className="gap-1">
                {stats.map((stat) => (
                  <button
                    key={stat.label}
                    onClick={() => setStatusFilter(stat.label)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all",
                      statusFilter === stat.label
                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {stat.label.charAt(0) + stat.label.slice(1).toLowerCase()}
                  </button>
                ))}
              </FilterGroup>

              <FilterGroup position="right" className="gap-4">
                <div className="relative group flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
                    style={{ fontSize: '20px' }}
                  />
                  <Input
                    placeholder="Search drivers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 h-10 w-full lg:min-w-48 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-sm font-medium"
                  />
                </div>


              </FilterGroup>
            </FilterBar>

            <DriversTable
              drivers={filteredDrivers}
              loading={loading}
              filter={searchTerm}
              statusFilter={statusFilter}
              onFilterChange={setSearchTerm}
              selectedDriverId={selectedDriver ? selectedDriver.id : null}
              onSelectDriver={setSelectedDriver}
            />
          </div>

          {selectedDriver && (
            <div className="lg:col-span-1 h-fit sticky top-4 animate-in slide-in-from-right-8 duration-500">
              <DriverDetailsPanel
                driver={selectedDriver}
                onClose={() => setSelectedDriver(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
