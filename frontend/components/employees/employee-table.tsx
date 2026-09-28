"use client";

import { useCreationVersion } from "@/components/shared/created-record-notice";
import { RecordStatusBadge } from "@/components/shared/record-status";
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Employee } from "@/types";
import { cn } from "@/lib/utils";
import { Visibility, Edit, Badge as BadgeIcon } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, Column } from "@/components/shared/data-table";
import { EmployeeAvailabilityDialog } from "./employee-availability-dialog";

interface EmployeesTableProps {
    employees?: Employee[];
    drivers?: Employee[];
    loading: boolean;
    filter: string;
    statusFilter: string;
    onFilterChange: (value: string) => void;
    selectedEmployeeId?: string | number | null;
    selectedDriverId?: string | number | null;
    onSelectEmployee?: (employee: Employee | null) => void;
    onSelectDriver?: (employee: Employee | null) => void;
}

export function EmployeesTable({
    employees: employeesProp,
    drivers: driversProp,
    loading,
    filter,
    statusFilter,
    selectedEmployeeId,
    selectedDriverId,
    onSelectEmployee,
    onSelectDriver
}: EmployeesTableProps) {
    const employees = employeesProp || driversProp || [];
    const selectedId = selectedEmployeeId ?? selectedDriverId;
    const handleSelect = onSelectEmployee || onSelectDriver || (() => {});

    const creationVersion = useCreationVersion("users");
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 8;

    const handleViewEmployee = (employee: Employee) => {
        handleSelect(employee);
    };

    const totalPages = Math.ceil(employees.length / itemsPerPage);
    React.useEffect(() => { setCurrentPage(page => Math.min(page, Math.max(1, totalPages))); }, [totalPages]);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedEmployees = employees.slice(startIndex, startIndex + itemsPerPage);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, statusFilter, creationVersion]);

    const columns: Column<Employee>[] = [
        {
            key: "id",
            header: "Employee ID",
            className: "pl-8 py-5",
            headerClassName: "pl-8 text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-semibold text-slate-900 tracking-tight">
                    {employee.employeeNumber || `EMP-${employee.id.toString().padStart(5, '0')}`}
                </span>
            )
        },
        {
            key: "name",
            header: "Employee Name",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-semibold text-slate-900 leading-none mb-1">{employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || "Unknown"}</span>
                    <span className="text-[11px] font-medium text-slate-400 tracking-tight">{employee.email}</span>
                </div>
            )
        },
        {
            key: "department",
            header: "Department",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-medium text-slate-600">
                    {employee.department || "N/A"}
                </span>
            )
        },
        {
            key: "role",
            header: "Role",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-medium text-slate-600">
                    {employee.role || "N/A"}
                </span>
            )
        },
        {
            key: "employmentType",
            header: "Employment",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-medium text-slate-600">
                    {employee.employmentType?.replace('_', ' ') || "N/A"}
                </span>
            )
        },
        {
            key: "phone",
            header: "Phone",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-medium text-slate-600">
                    {employee.phoneNumber1 || "N/A"}
                </span>
            )
        },
        {
            key: "license",
            header: "License No.",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {employee.driverLicense || "N/A"}
                </span>
            )
        },
        {
            key: "expiry",
            header: "License Expiry",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded",
                    employee.driverLicenseExpiry && new Date(employee.driverLicenseExpiry) < new Date() ? "bg-rose-50 text-rose-600" : "text-slate-500 bg-slate-50"
                )}>
                    {employee.driverLicenseExpiry ? format(new Date(employee.driverLicenseExpiry), "MMM dd, yyyy") : "N/A"}
                </span>
            )
        },
        {
            key: "status",
            header: "Status",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (employee) => (
                <RecordStatusBadge status={employee.status} />
            )
        },
        {
            key: "actions",
            header: "Actions",
            className: "pr-8",
            headerClassName: "text-right pr-8 text-xs font-semibold text-slate-500",
            render: (employee) => (
                <div className="flex items-center justify-end gap-3 text-slate-300">
                    <div onClick={(e) => e.stopPropagation()}>
                        <EmployeeAvailabilityDialog employeeId={employee.id as number} employeeName={employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || "Employee"} />
                    </div>
                    <Button
                        aria-label="View employee"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all active:scale-90"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewEmployee(employee);
                        }}
                    >
                        <Visibility style={{ fontSize: '18px' }} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90"
                        aria-label="Open employee to edit"
                        onClick={(e) => { e.stopPropagation(); handleViewEmployee(employee); }}
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
                <BadgeIcon style={{ fontSize: '32px' }} className="text-slate-200" />
            </div>
            <p className="text-2xl font-semibold text-slate-900 tracking-tight">No employees found</p>
            <p className="text-slate-400 font-medium max-w-xs mx-auto text-center text-sm">Try adjusting your search filters to find what you&apos;re looking for.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
            <div className="flex-1">
                <DataTable
                    columns={columns}
                    data={paginatedEmployees}
                    isLoading={loading && employees.length === 0}
                    emptyMessage={emptyMessage}
                    onRowClick={handleViewEmployee}
                    rowClassName={(employee) => cn(
                        (employee.status === "INACTIVE" || employee.status === "DEACTIVATED") && "bg-slate-50/80 [&_td]:text-slate-500",
                        "group transition-all duration-300 hover:bg-slate-50/80 border-b border-slate-50 last:border-none",
                        selectedId === employee.id && "bg-slate-50/100 border-l-4 border-l-primary"
                    )}
                />
            </div>

            <div className="px-8 bg-slate-50/50 border-t border-slate-200/60">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={employees.length}
                    itemsPerPage={itemsPerPage}
                />
            </div>
        </div>
    );
}

// Backward compatibility alias
export const DriversTable = EmployeesTable;

