"use client";

import React from "react";
import { Employee } from "@/types";
import { cn } from "@/lib/utils";
import {
    People,
    Business,
    Badge,
    WorkOutline,
    Circle,
    ExpandMore,
    ExpandLess,
} from "@mui/icons-material";
import {
    ROLES, ROLE_LABELS,
    DEPARTMENTS, DEPARTMENT_LABELS,
    EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS,
    STATUSES, STATUS_LABELS,
} from "@/constants/employee";

export interface EmployeeFilter {
    category: "all" | "department" | "role" | "employmentType" | "status";
    value: string;
}

interface FilterSection {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: EmployeeFilter["category"];
    items: { value: string; label: string; dotColor?: string }[];
}

interface EmployeeSidebarProps {
    employees: Employee[];
    activeFilter: EmployeeFilter;
    onFilterChange: (filter: EmployeeFilter) => void;
}

const STATUS_DOT_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-500",
    INACTIVE: "bg-slate-400",
    ON_LEAVE: "bg-amber-500",
};

const FILTER_SECTIONS: FilterSection[] = [
    {
        id: "department",
        label: "Department",
        icon: <Business style={{ fontSize: "18px" }} />,
        category: "department",
        items: DEPARTMENTS.map(d => ({ value: d, label: DEPARTMENT_LABELS[d] || d })),
    },
    {
        id: "role",
        label: "Role",
        icon: <Badge style={{ fontSize: "18px" }} />,
        category: "role",
        items: ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] + 's' })),
    },
    {
        id: "employmentType",
        label: "Employment Type",
        icon: <WorkOutline style={{ fontSize: "18px" }} />,
        category: "employmentType",
        items: EMPLOYMENT_TYPES.map(t => ({ value: t, label: EMPLOYMENT_TYPE_LABELS[t] || t })),
    },
    {
        id: "status",
        label: "Status",
        icon: <Circle style={{ fontSize: "10px" }} className="text-slate-400" />,
        category: "status",
        items: STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] || s, dotColor: STATUS_DOT_COLORS[s] })),
    },
];

function getCount(employees: Employee[], category: string, value: string): number {
    return employees.filter((emp) => {
        switch (category) {
            case "department":
                return emp.department === value;
            case "role":
                return emp.role === value;
            case "employmentType":
                return emp.employmentType === value;
            case "status":
                return emp.status === value;
            default:
                return false;
        }
    }).length;
}

export function EmployeeSidebar({
    employees,
    activeFilter,
    onFilterChange,
}: EmployeeSidebarProps) {
    const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set());

    const toggleSection = (sectionId: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const isActive = (category: EmployeeFilter["category"], value: string) =>
        activeFilter.category === category && activeFilter.value === value;

    return (
        <aside className="w-[250px] shrink-0 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/30 overflow-hidden flex flex-col h-fit sticky top-4">
            {/* Header */}
            <div className="p-5 pb-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Employee Directory</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{employees.length} total members</p>
            </div>

            {/* All Employees */}
            <div className="px-3 pt-3">
                <button
                    onClick={() => onFilterChange({ category: "all", value: "ALL" })}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                        activeFilter.category === "all"
                            ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                            : "text-slate-700 hover:bg-slate-50"
                    )}
                >
                    <People style={{ fontSize: "18px" }} />
                    <span>All Employees</span>
                    <span
                        className={cn(
                            "ml-auto text-xs font-bold px-2 py-0.5 rounded-md",
                            activeFilter.category === "all"
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-500"
                        )}
                    >
                        {employees.length}
                    </span>
                </button>
            </div>

            {/* Filter Sections */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
                {FILTER_SECTIONS.map((section) => {
                    const isCollapsed = collapsedSections.has(section.id);
                    return (
                        <div key={section.id} className="mt-4">
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                            >
                                {section.icon}
                                <span>{section.label}</span>
                                <span className="ml-auto">
                                    {isCollapsed ? (
                                        <ExpandMore style={{ fontSize: "16px" }} />
                                    ) : (
                                        <ExpandLess style={{ fontSize: "16px" }} />
                                    )}
                                </span>
                            </button>

                            {/* Section Items */}
                            {!isCollapsed && (
                                <div className="mt-1 space-y-0.5">
                                    {section.items.map((item) => {
                                        const count = getCount(employees, section.category, item.value);
                                        const active = isActive(section.category, item.value);
                                        return (
                                            <button
                                                key={item.value}
                                                onClick={() =>
                                                    onFilterChange({
                                                        category: section.category,
                                                        value: item.value,
                                                    })
                                                }
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                                                    active
                                                        ? "bg-primary/10 text-primary font-semibold"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}
                                            >
                                                {item.dotColor && (
                                                    <div className={cn("w-2 h-2 rounded-full shrink-0", item.dotColor)} />
                                                )}
                                                <span className="truncate">{item.label}</span>
                                                <span
                                                    className={cn(
                                                        "ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-md min-w-[24px] text-center",
                                                        active
                                                            ? "bg-primary/15 text-primary"
                                                            : "bg-slate-100 text-slate-400"
                                                    )}
                                                >
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
