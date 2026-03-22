"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Vehicle } from "@/app/types";
import { cn } from "@/lib/utils";
import { Visibility, Edit, DirectionsCar, ConfirmationNumber } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, Column } from "@/components/shared/data-table";

interface FleetTableProps {
    vehicles: Vehicle[];
    loading: boolean;
    filter: string;
    statusFilter: string;
    onFilterChange: (value: string) => void;
    selectedVehicleId?: string | number | null;
    onSelectVehicle: (vehicle: Vehicle | null) => void;
}

export function FleetTable({
    vehicles,
    loading,
    filter,
    statusFilter,
    selectedVehicleId,
    onSelectVehicle
}: FleetTableProps) {
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 8;

    const handleViewVehicle = (vehicle: Vehicle) => {
        onSelectVehicle(vehicle);
    };

    const totalPages = Math.ceil(vehicles.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedVehicles = vehicles.slice(startIndex, startIndex + itemsPerPage);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, statusFilter]);

    const columns: Column<Vehicle>[] = [
        {
            key: "id",
            header: "Vehicle ID",
            className: "pl-8 py-5",
            headerClassName: "pl-8 text-xs font-semibold text-slate-500",
            render: (vehicle) => (
                <span className="text-sm font-semibold text-slate-900 tracking-tight">
                    #VH-{vehicle.id.toString().padStart(5, '0')}
                </span>
            )
        },
        {
            key: "vehicle",
            header: "Vehicle Details",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (vehicle) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-semibold text-slate-900 leading-none mb-1">{vehicle.make} {vehicle.model}</span>
                    <span className="text-[11px] font-medium text-slate-400 tracking-tight">{vehicle.year} • {vehicle.maxPassengers} Seats</span>
                </div>
            )
        },
        {
            key: "plate",
            header: "Plate Number",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (vehicle) => (
                <div className="flex items-center gap-2">
                    <ConfirmationNumber style={{ fontSize: '16px' }} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 font-mono tracking-tight bg-slate-100 px-2 py-1 rounded">
                        {vehicle.licensePlate}
                    </span>
                </div>
            )
        },
        {
            key: "status",
            header: "Status",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (vehicle) => (
                <Badge
                    className={cn(
                        "font-semibold px-3 py-1 rounded-lg text-xs border-none shadow-none",
                        vehicle.status === "Available" ? "bg-green-100 text-green-700" :
                            vehicle.status === "On Trip" ? "bg-blue-100 text-blue-700" :
                                "bg-amber-100 text-amber-700"
                    )}
                >
                    {vehicle.status}
                </Badge>
            )
        },
        {
            key: "actions",
            header: "Actions",
            className: "pr-8",
            headerClassName: "text-right pr-8 text-xs font-semibold text-slate-500",
            render: (vehicle) => (
                <div className="flex items-center justify-end gap-3 text-slate-300">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all active:scale-90"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewVehicle(vehicle);
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
                <DirectionsCar style={{ fontSize: '32px' }} className="text-slate-200" />
            </div>
            <p className="text-2xl font-semibold text-slate-900 tracking-tight">No vehicles found</p>
            <p className="text-slate-400 font-medium max-w-xs mx-auto text-center text-sm">Try adjusting your search filters or add a new vehicle to the fleet.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
            <div className="flex-1">
                <DataTable
                    columns={columns}
                    data={paginatedVehicles}
                    isLoading={loading && vehicles.length === 0}
                    emptyMessage={emptyMessage}
                    onRowClick={handleViewVehicle}
                    rowClassName={(vehicle) => cn(
                        "group transition-all duration-300 hover:bg-slate-50/80 border-b border-slate-50 last:border-none",
                        selectedVehicleId === vehicle.id && "bg-slate-50/100 border-l-4 border-l-primary"
                    )}
                />
            </div>

            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-200/60">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={vehicles.length}
                    itemsPerPage={itemsPerPage}
                />
            </div>
        </div>
    );
}
