"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Customer } from "@/types";
import { cn } from "@/lib/utils";
import { Visibility, Edit, Person } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, Column } from "@/components/shared/data-table";

interface CustomersTableProps {
    customers: Customer[];
    loading: boolean;
    filter: string;
    statusFilter: string;
    onFilterChange: (value: string) => void;
    selectedCustomerId?: string | number | null;
    onSelectCustomer: (customer: Customer | null) => void;
}

export function CustomersTable({
    customers,
    loading,
    filter,
    statusFilter,
    selectedCustomerId,
    onSelectCustomer
}: CustomersTableProps) {
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 8;

    const handleViewCustomer = (customer: Customer) => {
        onSelectCustomer(customer);
    };

    const totalPages = Math.ceil(customers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCustomers = customers.slice(startIndex, startIndex + itemsPerPage);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, statusFilter]);

    const columns: Column<Customer>[] = [
        {
            key: "id",
            header: "Customer ID",
            className: "pl-8 py-5",
            headerClassName: "pl-8 text-xs font-semibold text-slate-500",
            render: (customer) => (
                <span className="text-sm font-semibold text-slate-900 tracking-tight">
                    #CU-{customer.id.toString().padStart(5, '0')}
                </span>
            )
        },
        {
            key: "name",
            header: "Customer Name",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (customer) => (
                <div className="flex flex-col py-1">
                    <span className="text-sm font-semibold text-slate-900 leading-none mb-1">
                        {customer.name || 'N/A'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 tracking-tight">{customer.email}</span>
                </div>
            )
        },
        {
            key: "phone",
            header: "Phone",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (customer) => (
                <span className="text-sm font-medium text-slate-600 tracking-tight">
                    {customer.phone1 || "N/A"}
                </span>
            )
        },
        {
            key: "company",
            header: "Company",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (customer) => (
                <span className="text-sm font-medium text-slate-600 tracking-tight">
                    {customer.company || "N/A"}
                </span>
            )
        },
        {
            key: "status",
            header: "Status",
            headerClassName: "text-xs font-semibold text-slate-500",
            render: (customer) => (
                <Badge
                    className={cn(
                        "font-semibold px-3 py-1 rounded-lg text-xs border-none shadow-none",
                        customer.status === "Active" ? "bg-green-100 text-green-700" :
                            "bg-slate-100 text-slate-700"
                    )}
                >
                    {customer.status}
                </Badge>
            )
        },
        {
            key: "actions",
            header: "Actions",
            className: "pr-8",
            headerClassName: "text-right pr-8 text-xs font-semibold text-slate-500",
            render: (customer) => (
                <div className="flex items-center justify-end gap-3 text-slate-300">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary transition-all active:scale-90"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewCustomer(customer);
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
                <Person style={{ fontSize: '32px' }} className="text-slate-200" />
            </div>
            <p className="text-2xl font-semibold text-slate-900 tracking-tight">No customers found</p>
            <p className="text-slate-400 font-medium max-w-xs mx-auto text-center text-sm">Try adjusting your search filters to find what you&apos;re looking for.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col">
            <div className="flex-1">
                <DataTable
                    columns={columns}
                    data={paginatedCustomers}
                    isLoading={loading && customers.length === 0}
                    emptyMessage={emptyMessage}
                    onRowClick={handleViewCustomer}
                    rowClassName={(customer) => cn(
                        "group transition-all duration-300 hover:bg-slate-50/80 border-b border-slate-50 last:border-none",
                        selectedCustomerId === customer.id && "bg-slate-50/100 border-l-4 border-l-primary"
                    )}
                />
            </div>

            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-200/60">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={customers.length}
                    itemsPerPage={itemsPerPage}
                />
            </div>
        </div>
    );
}
