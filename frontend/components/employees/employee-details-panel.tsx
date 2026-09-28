"use client";

import { RecordLifecycleActions } from "@/components/shared/record-lifecycle-actions";
import { RecordStatusBadge, InactiveRecordNotice } from "@/components/shared/record-status";
import React, { useState } from 'react';
import { useUpdateUserMutation, useDeleteUserMutation, useGetEmployeeByIdQuery } from '@/services/api';
import { Employee, ApiResponseError } from '@/types';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
    Edit,
    Print,
    Save,
    Close,
    DeleteOutline,
    Person,
    History,
    Work,
    HealthAndSafety,
    Business
} from "@mui/icons-material";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SidePanel } from "@/components/shared/side-panel";
import { Tabs, TabContent } from "@/components/ui/tabs";
import {
    ROLES, ROLE_LABELS, DEPARTMENT_LABELS,
    EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS,
    STATUSES, STATUS_LABELS,
    getDepartmentForRole, isDriverRole,
} from '@/constants/employee';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EmployeeDetailsPanelProps {
    employee?: Employee | null;
    driver?: Employee | null;
    onClose: () => void;
}

export function EmployeeDetailsPanel({ employee: employeeProp, driver: driverProp, onClose }: EmployeeDetailsPanelProps) {
    const suppliedEmployee = employeeProp ?? driverProp ?? null;
    const { currentData: freshEmployee } = useGetEmployeeByIdQuery(suppliedEmployee?.id ?? 0, { skip: !suppliedEmployee });
    const employee = freshEmployee ?? suppliedEmployee;
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    const getInitialFormState = (d: Employee | null) => {
        let fName = d?.firstName || '';
        let lName = d?.lastName || '';
        if (!fName && d?.name) {
            const parts = d.name.trim().split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ') || parts[0] || '';
        }
        return {
            firstName: fName,
            lastName: lName,
            email: d?.email || '',
            phoneNumber1: (d as any)?.phoneNumber1 || (d as any)?.phone || (d as any)?.profile?.phoneNumber1 || '',
            phoneNumber2: d?.phoneNumber2 || (d as any)?.profile?.phoneNumber2 || '',
            address: d?.address || (d as any)?.profile?.address || '',
            driverLicense: d?.driverLicense || (d as any)?.licenseNumber || (d as any)?.profile?.driverLicense || '',
            driverLicenseExpiry: d?.driverLicenseExpiry?.split('T')[0] || '',
            driverLicenseState: d?.driverLicenseState || '',
            dateOfBirth: d?.dateOfBirth ? (d.dateOfBirth.includes('T') ? d.dateOfBirth.split('T')[0] : d.dateOfBirth) : '',
            status: d?.status || 'ACTIVE',
            role: d?.role || 'DRIVER',
            employmentType: d?.employmentType || 'FULL_TIME',
            emergencyContactName: d?.emergencyContactName || '',
            emergencyContactPhone: d?.emergencyContactPhone || '',
            emergencyContactRelation: d?.emergencyContactRelation || '',
            hireDate: d?.hireDate ? (d.hireDate.includes('T') ? d.hireDate.split('T')[0] : d.hireDate) : '',
            hourlyRate: d?.hourlyRate?.toString() || '',
            hrNotes: d?.hrNotes || '',
        };
    };

    const [editForm, setEditForm] = React.useState(() => getInitialFormState(employee));
    const hydratedId = React.useRef(employee?.id);

    React.useEffect(() => {
        if (isEditing && hydratedId.current === employee?.id) return;
        hydratedId.current = employee?.id;
        setEditForm(getInitialFormState(employee));
        setIsEditing(false);
    }, [employee, isEditing]);

    if (!employee) return null;

    const handleSave = async () => {
        try {
            const isDriver = isDriverRole(editForm.role);
            await updateUser({
                id: employee.id as number,
                data: {
                    ...editForm,
                    licenseNumber: isDriver ? (editForm.driverLicense?.trim() || "") : undefined,
                    driverLicense: isDriver ? (editForm.driverLicense?.trim() || "") : undefined,
                    driverLicenseState: isDriver ? (editForm.driverLicenseState?.trim() || "") : undefined,
                    driverLicenseExpiry: isDriver ? editForm.driverLicenseExpiry : undefined,
                    hourlyRate: editForm.hourlyRate === "" ? null : Number(editForm.hourlyRate),
                }
            }).unwrap();
            toast.success("Employee updated successfully");
            setIsEditing(false);
        } catch (error: unknown) {
            console.error("Failed to update employee:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to update employee.";
            toast.error(errorMessage);
        }
    };


    const statusConfig = {
        'ACTIVE': { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        'ON_LEAVE': { class: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
        'INACTIVE': { class: "bg-slate-100 text-slate-700", dot: "bg-slate-600" },
    };

    const config = statusConfig[employee.status as keyof typeof statusConfig] || statusConfig.INACTIVE;

    const isEditEmailValid = !editForm.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim());
    const isEditDriver = isDriverRole(editForm.role);
    const isEditValid = Boolean(
        isEditEmailValid &&
        (editForm.firstName.trim().length >= 1 || editForm.lastName.trim().length >= 1) &&
        (!editForm.phoneNumber1.trim() || editForm.phoneNumber1.trim().length >= 4)
    );

    const footer = (
        <div className="flex flex-col gap-4 p-6 border-t border-slate-100 bg-white">
            {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={isUpdating || !isEditValid}
                        className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                        <Save style={{ fontSize: '18px' }} /> Save Changes
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="rounded-xl h-12 gap-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition-all active:scale-95"
                    >
                        <Close style={{ fontSize: '18px' }} /> Cancel
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => setIsEditing(true)}
                            variant="outline"
                            className="rounded-xl h-12 gap-2 border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            <Edit style={{ fontSize: '16px' }} /> Edit Profile
                        </Button>
                        <Button className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200">
                            <Print style={{ fontSize: '18px' }} /> Print ID Card
                        </Button>
                    </div>
                    <RecordLifecycleActions resource="users" id={employee.id} inactive={employee.status === "INACTIVE"} onDeleted={onClose} />
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: "profile", label: "Profile", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "employment", label: "Employment", icon: <Work style={{ fontSize: '16px' }} /> },
        { id: "hr", label: "HR & Emergency", icon: <HealthAndSafety style={{ fontSize: '16px' }} /> },
    ];

    const selectClassName = "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <SidePanel
            isOpen={!!employee}
            onClose={onClose}
            title={`Employee #${employee.employeeNumber || employee.id.toString().padStart(5, '0')}`}
            badge={
                <RecordStatusBadge status={employee.status} />
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-none"
        >
            <div className="flex flex-col h-full overflow-hidden">{employee.status === "INACTIVE" && <InactiveRecordNotice />}
                {/* Header Summary (Always Visible) */}
                <div className="p-6 pb-2 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{employee.name}</h3>
                        <p className="text-xs font-medium text-slate-500 font-mono italic">{employee.email}</p>
                    </div>
                </div>

                {/* Tabs for detailed info */}
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    <TabContent value="profile" className="p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">First Name</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.firstName}
                                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.firstName}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Last Name</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.lastName}
                                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.lastName}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Phone 1</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.phoneNumber1}
                                        onChange={(e) => setEditForm({ ...editForm, phoneNumber1: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.phoneNumber1}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Phone 2</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.phoneNumber2}
                                        onChange={(e) => setEditForm({ ...editForm, phoneNumber2: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.phoneNumber2 || "N/A"}</p>
                                )}
                            </div>

                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Residential Address</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.address}
                                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.address || "No address on file"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Date of Birth</label>
                                {isEditing ? (
                                    <Input
                                        type="date"
                                        value={editForm.dateOfBirth}
                                        onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.dateOfBirth ? format(new Date(employee.dateOfBirth), "MMM dd, yyyy") : "N/A"}</p>
                                )}
                            </div>
                            {/* License Info - Only show for DRIVER role */}
                            {isDriverRole(isEditing ? editForm.role : (employee.role || '')) && (
                                <>
                                    <div className="col-span-2 mt-4 border-b border-slate-100 pb-2">
                                        <h4 className="text-sm font-semibold text-slate-700">Driver License Details</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">License State</label>
                                        {isEditing ? (
                                            <Input
                                                value={editForm.driverLicenseState}
                                                onChange={(e) => setEditForm({ ...editForm, driverLicenseState: e.target.value })}
                                                className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            />
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-900 ml-1">{employee.driverLicenseState || "N/A"}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">License Number</label>
                                        {isEditing ? (
                                            <Input
                                                value={editForm.driverLicense}
                                                onChange={(e) => setEditForm({ ...editForm, driverLicense: e.target.value })}
                                                className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            />
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-900 ml-1">{employee.driverLicense || "N/A"}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">License Expiry</label>
                                        {isEditing ? (
                                            <Input
                                                type="date"
                                                value={editForm.driverLicenseExpiry}
                                                onChange={(e) => setEditForm({ ...editForm, driverLicenseExpiry: e.target.value })}
                                                className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            />
                                        ) : (
                                            <p className={cn(
                                                "text-sm font-semibold ml-1",
                                                employee.driverLicenseExpiry && new Date(employee.driverLicenseExpiry) < new Date() ? "text-rose-500" : "text-slate-900"
                                            )}>
                                                {employee.driverLicenseExpiry ? format(new Date(employee.driverLicenseExpiry), "MMM dd, yyyy") : "N/A"}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </TabContent>
                    
                    <TabContent value="employment" className="p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Role</label>
                                {isEditing ? (
                                    <select 
                                        className={selectClassName}
                                        value={editForm.role}
                                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    >
                                        {ROLES.map(r => (
                                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{ROLE_LABELS[employee.role || ''] || employee.role}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Department</label>
                                {isEditing ? (
                                    <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-600 cursor-not-allowed">
                                        <Business style={{ fontSize: '14px' }} className="text-slate-400" />
                                        <span>{DEPARTMENT_LABELS[getDepartmentForRole(editForm.role)] || editForm.role}</span>
                                        <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-200/80 px-1.5 py-0.5 rounded">Auto</span>
                                    </div>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{DEPARTMENT_LABELS[employee.department || ''] || employee.department}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Employment Type</label>
                                {isEditing ? (
                                    <select 
                                        className={selectClassName}
                                        value={editForm.employmentType}
                                        onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                                    >
                                        {EMPLOYMENT_TYPES.map(t => (
                                            <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{EMPLOYMENT_TYPE_LABELS[employee.employmentType || ''] || employee.employmentType?.replace('_', ' ')}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Status</label>
                                {isEditing ? (
                                    <select 
                                        className={selectClassName}
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    >
                                        {STATUSES.map(s => (
                                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{STATUS_LABELS[employee.status || ''] || employee.status?.replace('_', ' ')}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Hire Date</label>
                                {isEditing ? (
                                    <Input
                                        type="date"
                                        value={editForm.hireDate}
                                        onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.hireDate ? format(new Date(employee.hireDate), "MMM dd, yyyy") : "N/A"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Hourly Rate</label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.hourlyRate}
                                        onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.hourlyRate != null ? `$${employee.hourlyRate}` : "N/A"}</p>
                                )}
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="hr" className="p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 border-b border-slate-100 pb-2">
                                <h4 className="text-sm font-semibold text-slate-700">Emergency Contact</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Contact Name</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.emergencyContactName}
                                        onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.emergencyContactName || "N/A"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Contact Phone</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.emergencyContactPhone}
                                        onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.emergencyContactPhone || "N/A"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Relation</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.emergencyContactRelation}
                                        onChange={(e) => setEditForm({ ...editForm, emergencyContactRelation: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{employee.emergencyContactRelation || "N/A"}</p>
                                )}
                            </div>

                            <div className="col-span-2 border-b border-slate-100 pb-2 mt-4">
                                <h4 className="text-sm font-semibold text-slate-700">HR Notes</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Internal HR Notes</label>
                                {isEditing ? (
                                    <textarea
                                        value={editForm.hrNotes}
                                        onChange={(e) => setEditForm({ ...editForm, hrNotes: e.target.value })}
                                        className="flex w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 min-h-[80px]"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1 whitespace-pre-wrap">{employee.hrNotes || "No HR notes."}</p>
                                )}
                            </div>
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}

// Backward compatibility alias
export const DriverDetailsPanel = EmployeeDetailsPanel;

