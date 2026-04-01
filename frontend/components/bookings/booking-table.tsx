"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Booking } from "@/types";
import { cn } from "@/lib/utils";
import { Visibility, Edit } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, Column } from "@/components/shared/data-table";

interface BookingsTableProps {
    bookings: Booking[];
    loading: boolean;
    filter: string;
    statusFilter: string;
    onFilterChange: (value: string) => void;
    selectedBookingId?: string | number | null;
    onSelectBooking: (booking: Booking | null) => void;
}

export function BookingsTable({
    bookings,
    loading,
    filter,
    statusFilter,
    selectedBookingId,
    onSelectBooking
}: BookingsTableProps) {
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 8;

    const handleViewBooking = (booking: Booking) => {
        onSelectBooking(booking);
    };

    const totalPages = Math.ceil(bookings.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedBookings = bookings.slice(startIndex, startIndex + itemsPerPage);

    // Reset page if filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, statusFilter]);

    const columns: Column<Booking>[] = [
        {
            key: "id",
            header: "Booking ID",
            className: "pl-8 py-5",
            headerClassName: "pl-8 text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900 tracking-tight">
                        #BK-{booking.id.toString().padStart(5, '0')}
                    </span>
                    <span className="text-xs font-medium text-slate-400 truncate max-w-[100px]" title={booking.subject}>
                        {booking.subject || "No Subject"}
                    </span>
                </div>
            )
        },
        {
            key: "guest",
            header: "Guest Name",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-semibold text-slate-900 leading-none mb-1">{booking.customerName}</span>
                    <span className="text-[11px] font-medium text-slate-400 tracking-tight">{booking.customerEmail}</span>
                </div>
            )
        },
        {
            key: "route",
            header: "Route",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex flex-col py-1 max-w-[200px]">
                    <span className="text-sm font-semibold text-slate-900 truncate" title={booking.pickupLocation}>
                        {booking.pickupLocation}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 truncate" title={booking.dropoffLocation}>
                        to {booking.dropoffLocation}
                    </span>
                </div>
            )
        },
        {
            key: "date",
            header: "Date & Time",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-semibold text-slate-700 leading-none mb-1 tracking-tight">
                        {format(new Date(booking.date), "MMM dd, yyyy")}
                    </span>
                    <span className="text-xs font-medium text-slate-400">{booking.startTime}</span>
                </div>
            )
        },
        {
            key: "details",
            header: "Details",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-medium text-slate-600">
                        {booking.noOfVehicles || 1} Veh • {booking.passengerCount || 0} Pax
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                        {booking.tripCount || 1} Trip(s)
                    </span>
                </div>
            )
        },
        {
            key: "status",
            header: "Status",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (booking) => (
                <Badge
                    className={cn(
                        "font-semibold px-3 py-1 rounded-lg text-xs border-none shadow-none",
                        booking.status === "Confirmed" ? "bg-emerald-100 text-emerald-700" :
                            booking.status === "Cancelled" ? "bg-rose-100 text-rose-700" :
                                "bg-amber-100/80 text-amber-700"
                    )}
                >
                    {booking.status}
                </Badge>
            )
        },
        {
            key: "actions",
            header: "Actions",
            className: "pr-8",
            headerClassName: "text-right pr-8 text-xs font-semibold text-slate-500",
            render: (booking) => (
                <div className="flex items-center justify-end gap-3 text-slate-300">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all active:scale-90"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewBooking(booking);
                        }}
                    >
                        <Visibility style={{ fontSize: '18px' }} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Edit style={{ fontSize: '18px' }} />
                    </Button>
                </div>
            )
        }
    ];

    const emptyMessage = (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 bg-slate-50/20 rounded-3xl border border-dashed border-slate-200">
            <div className="w-24 h-24 rounded-full bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center mb-4">
                <Visibility style={{ fontSize: '32px' }} className="text-slate-200" />
            </div>
            <p className="text-2xl font-semibold text-slate-900 tracking-tight">No results found</p>
            <p className="text-slate-400 font-medium max-w-xs mx-auto text-center text-sm">Try adjusting your search filters to find what you&apos;re looking for.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
            <div className="flex-1">
                <DataTable
                    columns={columns}
                    data={paginatedBookings}
                    isLoading={loading && bookings.length === 0}
                    emptyMessage={emptyMessage}
                    onRowClick={handleViewBooking}
                    rowClassName={(booking) => cn(
                        "group transition-all duration-300 hover:bg-slate-50/80 border-b border-slate-50 last:border-none",
                        selectedBookingId === booking.id && "bg-slate-50/100 border-l-4 border-l-primary"
                    )}
                />
            </div>

            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-200/60">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={bookings.length}
                    itemsPerPage={itemsPerPage}
                />
            </div>
        </div>
    );
}
