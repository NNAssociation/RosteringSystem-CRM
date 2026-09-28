"use client";
import { CreatedRecordNotice } from "@/components/shared/created-record-notice";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useMemo } from "react";
import { useGetBookingsQuery } from "@/services/api";
import { useHeader } from "@/providers/header-provider";
import { BookingsTable } from "@/components/bookings/booking-table";
import { AddBookingDialog } from "@/components/bookings/add-booking";
import { BookingDetailsPanel } from "@/components/bookings/booking-details-panel";
import { Booking } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileDownload,
  KeyboardArrowDown
} from "@mui/icons-material";
import { cn } from "@/lib/utils";

export default function BookingsPage() {
  const router = useRouter();
  const { setHeaderConfig } = useHeader();
  const { data: bookings = [], isLoading: loading, isError, refetch } = useGetBookingsQuery(undefined, { pollingInterval: 15000, refetchOnMountOrArgChange: true });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Filtered bookings logic
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking: Booking) => {
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch =
        (booking.subject || "").toLowerCase().includes(searchStr) ||
        (booking.customerName || "").toLowerCase().includes(searchStr) ||
        booking.id.toString().toLowerCase().includes(searchStr);

      const matchesStatus =
        statusFilter === "ALL" ||
        booking.status.toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  useEffect(() => {
    // Clear global header config as we use PageHeader locally for split-view control
    setHeaderConfig({
      title: "Bookings Management",
    });
  }, [setHeaderConfig]);

  const stats = [{ label: "ALL", count: bookings.length }, ...["DRAFT", "AWAITING_RESPONSE", "CONFIRMED", "DECLINED", "CANCELLED"].map(label => ({ label, count: bookings.filter(b => b.status.toUpperCase() === label).length }))];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Main Content Grid - Wrapped to include the Header */}
      <div className={cn(
        "grid transition-all duration-500 gap-6",
        selectedBooking ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
      )}>
        {/* Left Side: Header + FilterBar + Table */}
        <div className={cn(
          "space-y-6 transition-all duration-500",
          selectedBooking ? "lg:col-span-2" : "col-span-1"
        )}>
          {/* Page Header within the narrowed column */}
          <PageHeader
            title="Bookings"
            description="Review and manage incoming trip requests and leads from clients."
            breadcrumbs={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Bookings" }
            ]}
            className="px-0 py-0 border-none"
              actions={
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="h-11 px-6 gap-2 border-slate-200 text-slate-600 rounded-xl hover:bg-white font-semibold shadow-sm transition-all hover:shadow-md">
                    <FileDownload style={{ fontSize: '18px' }} />
                    <span>Export Data</span>
                  </Button>
                  <Button asChild><Link href="/dashboard/bookings/new">New booking</Link></Button>
                </div>
              }
            />

            <FilterBar className="bg-white shadow-xl shadow-slate-200/40 border-slate-100 py-3 px-4 rounded-[2rem]">
              <FilterGroup position="left" className="gap-1.5">
                {stats.map((stat) => (
                  <button
                    key={stat.label}
                    onClick={() => setStatusFilter(stat.label)}
                    className={cn(
                      "px-5 py-2.5 rounded-2xl text-[11px] font-bold tracking-wider transition-all uppercase",
                      statusFilter === stat.label
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {stat.label}
                    <span className={cn(
                      "ml-2 text-[10px] opacity-60",
                      statusFilter === stat.label ? "text-white/70" : "text-slate-300"
                    )}>
                      ({stat.count})
                    </span>
                  </button>
                ))}
              </FilterGroup>

              <FilterGroup position="right" className="gap-3">
                <div className="relative group flex-1 min-w-[280px]">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors"
                    style={{ fontSize: '20px' }}
                  />
                  <Input
                    placeholder="Search by ID, customer or subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-4 h-11 w-full bg-slate-50/50 border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-medium"
                  />
                </div>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm">
                  <KeyboardArrowDown style={{ fontSize: '20px' }} />
                </Button>
              </FilterGroup>
            </FilterBar><CreatedRecordNotice resource="bookings" records={bookings} visible={filteredBookings} clear={() => { setSearchTerm(""); setStatusFilter("ALL"); }} />

            {isError && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load bookings. <Button variant="outline" onClick={() => refetch()}>Retry</Button></div>}
            <BookingsTable
              bookings={filteredBookings}
              loading={loading}
              filter={searchTerm}
              statusFilter={statusFilter}
              onFilterChange={setSearchTerm}
              selectedBookingId={selectedBooking ? selectedBooking.id : null}
              onSelectBooking={booking => { if (booking) router.push(`/dashboard/bookings/${booking.id}`); }}
            />
          </div>

          {/* Right Side: Details Panel */}
          {selectedBooking && (
            <div className="lg:col-span-1 h-fit sticky top-4 animate-in slide-in-from-right-8 duration-500">
              <BookingDetailsPanel
                booking={selectedBooking}
                onClose={() => setSelectedBooking(null)}
              />
            </div>
          )}
        </div>
      </div>
  );
}
