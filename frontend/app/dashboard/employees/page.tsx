"use client";
import { CreatedRecordNotice } from "@/components/shared/created-record-notice";
import { useEffect, useState } from "react";
import { useGetEmployeesQuery } from "@/services/api";
import { useHeader } from "@/providers/header-provider";
import { EmployeesTable } from "@/components/employees/employee-table";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { EmployeeDetailsPanel } from "@/components/employees/employee-details-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, STATUS_LABELS, DEPARTMENT_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/constants/employee";
type FilterKey = "status" | "role" | "department" | "employmentType";
const emptyFilters = { status: "", role: "", department: "", employmentType: "" };
const options = { status: STATUS_LABELS, role: ROLE_LABELS, department: DEPARTMENT_LABELS, employmentType: EMPLOYMENT_TYPE_LABELS };
export default function EmployeesPage() {
  const { setHeaderConfig } = useHeader();
  const { data: employees = [], isLoading, isError, refetch } = useGetEmployeesQuery();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [more, setMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  useEffect(() => { setHeaderConfig({ title: "Employees Management" }); }, [setHeaderConfig]);
  const filtered = employees.filter(employee => {
    const text = [employee.name, employee.firstName, employee.lastName, employee.email, employee.employeeNumber, employee.phoneNumber1, employee.id].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase()) && Object.entries(filters).every(([key, value]) => !value || employee[key as FilterKey] === value);
  });
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("record"); if (id && /^\d+$/.test(id)) queueMicrotask(() => setSelectedId(Number(id))); }, []);
  const selected = employees.find(e => e.id === selectedId) || null;
  const select = (key: FilterKey, label: string) => <select aria-label={label} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">All {label.toLowerCase()}</option>{Object.entries(options[key]).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>;
  return <div className="space-y-6 p-6 lg:p-8">
    <PageHeader title="Employees" description="Manage profiles, employment and HR details." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Employees" }]} className="px-0 py-0 border-none" actions={<AddEmployeeDialog />} />
    <div className="rounded-xl border bg-white p-3 space-y-3"><div className="flex flex-wrap gap-2"><Input aria-label="Search employees" placeholder="Search name, email, phone or employee ID…" className="min-w-60 flex-1" value={search} onChange={e => setSearch(e.target.value)} />{select("status", "Statuses")}{select("role", "Roles")}<Button variant="outline" aria-expanded={more} onClick={() => setMore(!more)}>More filters</Button></div>{more && <div className="flex flex-wrap gap-2">{select("department", "Departments")}{select("employmentType", "Employment types")}</div>}
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{filtered.length} employees</span>{(Object.entries(filters) as [FilterKey, string][]).filter(([, value]) => value).map(([key, value]) => <button key={key} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700" aria-label={`Remove ${options[key][value]} filter`} onClick={() => setFilters(f => ({ ...f, [key]: "" }))}>{options[key][value]} ×</button>)}{(search || Object.values(filters).some(Boolean)) && <button className="underline" onClick={() => { setSearch(""); setFilters(emptyFilters); }}>Clear all</button>}</div></div>
    <CreatedRecordNotice resource="users" records={employees} visible={filtered} clear={() => { setSearch(""); setFilters(emptyFilters); }} /><div className={`grid items-start gap-6 ${selected ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]" : "grid-cols-1"}`}>
      <div className="min-w-0">{isError ? <div role="alert">Could not load employees. <Button variant="outline" onClick={refetch}>Retry</Button></div> : <EmployeesTable employees={filtered} loading={isLoading} filter={search} statusFilter={JSON.stringify(filters)} onFilterChange={setSearch} selectedEmployeeId={selectedId} onSelectEmployee={e => setSelectedId(e?.id ?? null)} />}</div>
      {selected && <div className="min-w-0 h-fit animate-in slide-in-from-right-8 duration-300"><EmployeeDetailsPanel employee={selected} onClose={() => setSelectedId(null)} /></div>}
    </div>
  </div>;
}
