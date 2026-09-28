"use client";

import React, { useState } from 'react';
import { useCreateUserMutation } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, Person, Work, HealthAndSafety, Business } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";
import {
    ROLES,
    ROLE_LABELS,
    DEPARTMENT_LABELS,
    EMPLOYMENT_TYPE_LABELS,
    STATUS_LABELS,
    getDepartmentForRole,
    isDriverRole,
    EMPLOYMENT_TYPES,
    STATUSES,
} from '@/constants/employee';

export function AddEmployeeDialog() {
    const [createUser, { isLoading }] = useCreateUserMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");
    const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber1: '',
        phoneNumber2: '',
        address: '',
        driverLicense: '',
        driverLicenseExpiry: '',
        driverLicenseState: '',
        taxFileNumber: '',
        dateOfBirth: '',

        role: 'DRIVER' as string,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',

        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        hireDate: '',
        hourlyRate: '',
        hrNotes: '',
    });

    // Derived — never directly editable
    const derivedDepartment = getDepartmentForRole(formData.role);

    const resetForm = () => {
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phoneNumber1: '',
            phoneNumber2: '',
            address: '',
            driverLicense: '',
            driverLicenseExpiry: '',
            driverLicenseState: '',
            taxFileNumber: '',
            dateOfBirth: '',

            role: 'DRIVER',
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',

            emergencyContactName: '',
            emergencyContactPhone: '',
            emergencyContactRelation: '',
            hireDate: '',
            hourlyRate: '',
            hrNotes: '',
        });
        setActiveTab("profile");
        setMaxUnlockedIndex(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        if (activeTab !== "hr" || submitter?.getAttribute("data-final-save") !== "true" || isLoading || !isFormComplete) return;
        try {
            await createUser({
                ...formData,
                phone: formData.phoneNumber1,
                licenseNumber: isDriver ? (formData.driverLicense.trim() || undefined) : undefined,
                driverLicense: isDriver ? (formData.driverLicense.trim() || undefined) : undefined,
                driverLicenseState: isDriver ? (formData.driverLicenseState.trim() || undefined) : undefined,
                driverLicenseExpiry: isDriver && formData.driverLicenseExpiry ? formData.driverLicenseExpiry : undefined,
                hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
            }).unwrap();
            setIsOpen(false);
            resetForm();
            toast.success("Employee added successfully!");
        } catch (error: unknown) {
            console.error("Failed to add employee:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add employee.";
            toast.error(errorMessage);
        }
    };

    const baseTabs = [
        { id: "profile", label: "Profile", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "employment", label: "Employment", icon: <Work style={{ fontSize: '16px' }} /> },
        { id: "hr", label: "HR & Emergency", icon: <HealthAndSafety style={{ fontSize: '16px' }} /> },
    ];

    const tabs = baseTabs;

    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    const isLastTab = currentIndex === tabs.length - 1;

    const handleNext = () => {
        if (!isCurrentTabValid() || isLoading) return;
        const nextIdx = currentIndex + 1;
        if (nextIdx < tabs.length) {
            setMaxUnlockedIndex(index => Math.max(index, nextIdx));
            setActiveTab(tabs[nextIdx].id);
        }
    };

    const selectClassName = "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    // Reactive validation rules — license is NEVER required for non-drivers
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
    const isDriver = isDriverRole(formData.role);
    const isProfileValid = Boolean(
        formData.firstName.trim().length >= 2 &&
        formData.lastName.trim().length >= 2 &&
        isEmailValid &&
        formData.phoneNumber1.trim().length >= 6
    );
    const isEmploymentValid = Boolean(formData.role && formData.employmentType && formData.status);
    const isHrValid = (!formData.hourlyRate || (Number.isFinite(Number(formData.hourlyRate)) && Number(formData.hourlyRate) >= 0)) && (!formData.emergencyContactPhone || formData.emergencyContactPhone.trim().length >= 6);

    const isCurrentTabValid = () => {
        switch (activeTab) {
            case "profile": return isProfileValid;
            case "employment": return isEmploymentValid;
            case "hr": return isHrValid;
            default: return false;
        }
    };

    const isFormComplete = isProfileValid && isEmploymentValid && isHrValid;

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) resetForm();
            }}
            title="Register New Employee"
            maxWidth="sm:max-w-[700px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Employee</span>
                </Button>
            }
            contentClassName="p-0 overflow-hidden flex flex-col"
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
                <Tabs tabs={tabs.map((tab, index) => ({ ...tab, disabled: index > maxUnlockedIndex }))} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    
                    {/* PROFILE TAB */}
                    <TabContent value="profile" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Prominent Role Selector */}
                            <div className="col-span-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 ml-1">
                                        Employee Role <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[11px] font-medium text-slate-500">
                                        Department: <strong className="text-slate-800 font-semibold">{DEPARTMENT_LABELS[derivedDepartment] || derivedDepartment}</strong>
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {ROLES.map(r => (
                                        <button
                                            type="button"
                                            key={r}
                                            onClick={() => setFormData({ ...formData, role: r })}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs transition-all ${
                                                formData.role === r
                                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-bold ring-2 ring-slate-900/10'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold'
                                            }`}
                                        >
                                            <span>{ROLE_LABELS[r]}</span>
                                            <span className="text-[10px] font-normal opacity-70 mt-0.5">
                                                {DEPARTMENT_LABELS[getDepartmentForRole(r)]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    First Name <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="e.g. John"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                />
                                {formData.firstName.length > 0 && formData.firstName.trim().length < 2 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 2 characters</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Last Name <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="e.g. Doe"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                />
                                {formData.lastName.length > 0 && formData.lastName.trim().length < 2 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 2 characters</p>
                                )}
                            </div>

                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Email Address <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    type="email"
                                    required
                                    placeholder="john@example.com"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                                {formData.email.length > 0 && !isEmailValid && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">Please enter a valid email address</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Phone 1 <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="+61 400 000 000"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.phoneNumber1}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber1: e.target.value })}
                                />
                                {formData.phoneNumber1.length > 0 && formData.phoneNumber1.trim().length < 6 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 6 digits required</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Date of Birth</label>
                                <Input
                                    type="date"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Residential Address</label>
                                <Input
                                    placeholder="e.g. 123 Main St, Sydney"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            
                            {/* License Info - Only show for DRIVER role */}
                            {isDriver ? (
                                <>
                                    <div className="col-span-2 mt-2 border-b border-slate-100 pb-2 flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-700">Driver License Details</h4>
                                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                                            Driver Role
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-600 ml-1">License State</label>
                                        <Input
                                            placeholder="e.g. NSW"
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            value={formData.driverLicenseState}
                                            onChange={(e) => setFormData({ ...formData, driverLicenseState: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-600 ml-1">
                                            License Number
                                        </label>
                                        <Input
                                            placeholder="NSW-123456"
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            value={formData.driverLicense}
                                            onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                                        />
                                        <p className="text-[11px] text-slate-400 ml-1">Required prior to scheduling driving shifts</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-600 ml-1">License Expiry</label>
                                        <Input
                                            type="date"
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            value={formData.driverLicenseExpiry}
                                            onChange={(e) => setFormData({ ...formData, driverLicenseExpiry: e.target.value })}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 flex items-center gap-2.5 text-xs text-emerald-800">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span>
                                    <span>
                                        <strong>{ROLE_LABELS[formData.role] || formData.role}</strong> role does not require driver license details.
                                    </span>
                                </div>
                            )}
                        </div>
                    </TabContent>

                    {/* EMPLOYMENT TAB */}
                    <TabContent value="employment" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Summary Badge for Selected Role & Department */}
                            <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-500">Selected Role:</span>
                                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                                        {ROLE_LABELS[formData.role] || formData.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span>Department:</span>
                                    <span className="font-semibold text-slate-800">
                                        {DEPARTMENT_LABELS[derivedDepartment] || derivedDepartment}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Employment Type <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    className={selectClassName}
                                    value={formData.employmentType}
                                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                                >
                                    {EMPLOYMENT_TYPES.map(t => (
                                        <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Status <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    className={selectClassName}
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    {STATUSES.map(s => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Hire Date</label>
                                <Input
                                    type="date"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.hireDate}
                                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Hourly Rate ($)</label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 25.50"
                                    step="0.01"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.hourlyRate}
                                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                                />
                            </div>
                        </div>
                    </TabContent>

                    {/* HR & EMERGENCY TAB */}
                    <TabContent value="hr" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 border-b border-slate-100 pb-2">
                                <h4 className="text-sm font-semibold text-slate-700">Emergency Contact</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Contact Name</label>
                                <Input
                                    placeholder="e.g. Jane Doe"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.emergencyContactName}
                                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Contact Phone</label>
                                <Input
                                    placeholder="+61 400 000 000"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.emergencyContactPhone}
                                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Relation</label>
                                <Input
                                    placeholder="e.g. Spouse"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.emergencyContactRelation}
                                    onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2 border-b border-slate-100 pb-2 mt-4">
                                <h4 className="text-sm font-semibold text-slate-700">HR Notes</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Internal HR Notes</label>
                                <textarea
                                    className="flex w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 min-h-[80px]"
                                    placeholder="Any notes..."
                                    value={formData.hrNotes}
                                    onChange={(e) => setFormData({ ...formData, hrNotes: e.target.value })}
                                />
                            </div>
                        </div>
                    </TabContent>
                </Tabs>

                <div className="flex justify-between items-center p-6 pt-4 border-t border-slate-100 bg-slate-50/30 mt-auto">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        className="rounded-xl h-11 px-6 font-semibold"
                    >
                        Cancel
                    </Button>
                    <div className="flex gap-3">
                        <span className="self-center text-xs text-slate-500">Step {currentIndex + 1} of {tabs.length}</span>
                        {currentIndex > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setActiveTab(tabs[currentIndex - 1].id)}
                                className="rounded-xl h-11 px-6 font-semibold border-slate-200"
                            >
                                Back
                            </Button>
                        )}
                        {!isLastTab ? (
                            <Button
                                key="next-step"
                                type="button"
                                disabled={!isCurrentTabValid()}
                                onClick={handleNext}
                                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white rounded-xl h-11 px-6 font-semibold shadow-md active:scale-[0.98] transition-all"
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                key="final-save"
                                data-final-save="true"
                                type="submit"
                                disabled={!isFormComplete || isLoading}
                                className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl h-11 px-6 font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isLoading ? "Registering..." : "Register Employee"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}

// Keep backward-compatible alias
export const AddDriverDialog = AddEmployeeDialog;
