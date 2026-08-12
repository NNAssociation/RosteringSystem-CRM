"use client";

import React, { useState } from 'react';
import { useCreateUserMutation } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, Person } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";

export function AddDriverDialog() {
    const [createUser, { isLoading }] = useCreateUserMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phoneNumber1: '',
        phoneNumber2: '',
        address: '',
        driverLicense: '',
        driverLicenseExpiry: '',
        driverLicenseState: '',
        taxFileNumber: '',
        occupation: 'Driver',
        maxfatigueMinutes: '600',
        bankName: '',
        bankBSB: '',
        bankAccount: '',
        dateOfBirth: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phoneNumber1: '',
            phoneNumber2: '',
            address: '',
            driverLicense: '',
            driverLicenseExpiry: '',
            driverLicenseState: '',
            taxFileNumber: '',
            occupation: 'Driver',
            maxfatigueMinutes: '600',
            bankName: '',
            bankBSB: '',
            bankAccount: '',
            dateOfBirth: '',
        });
        setActiveTab("profile");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createUser({
                ...formData,
                phone: formData.phoneNumber1,
                licenseNumber: formData.driverLicense,
                roleName: "DRIVER",
                status: "Active",
                maxfatigueMinutes: parseInt(formData.maxfatigueMinutes) || 600,
                driverLicenseExpiry: formData.driverLicenseExpiry || undefined
            }).unwrap();
            setIsOpen(false);
            resetForm();
            toast.success("Driver added successfully!");
        } catch (error: unknown) {
            console.error("Failed to add driver:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add driver.";
            toast.error(errorMessage);
        }
    };

    const tabs = [
        { id: "profile", label: "Profile", icon: <Person style={{ fontSize: '16px' }} /> },
    ];

    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    const isLastTab = currentIndex === tabs.length - 1;

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) resetForm();
            }}
            title="Register New Driver"
            maxWidth="sm:max-w-[700px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Driver</span>
                </Button>
            }
            contentClassName="p-0 overflow-hidden flex flex-col"
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    <TabContent value="profile" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Full Name</label>
                                <Input
                                    required
                                    placeholder="e.g. John Doe"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
                                <Input
                                    type="email"
                                    required
                                    placeholder="john@example.com"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Phone 1</label>
                                <Input
                                    required
                                    placeholder="+61 400 000 000"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.phoneNumber1}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber1: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Phone 2</label>
                                <Input
                                    placeholder="+61 400 000 000"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.phoneNumber2}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber2: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Date of Birth</label>
                                <Input
                                    type="date"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Residential Address</label>
                                <Input
                                    placeholder="e.g. 123 Main St, Sydney"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">License State</label>
                                <Input
                                    placeholder="e.g. NSW"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl flex-1"
                                    value={formData.driverLicenseState}
                                    onChange={(e) => setFormData({ ...formData, driverLicenseState: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">License Number</label>
                                <Input
                                    required
                                    placeholder="NSW-123456"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.driverLicense}
                                    onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">License Expiry</label>
                                <Input
                                    type="date"
                                    required
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.driverLicenseExpiry}
                                    onChange={(e) => setFormData({ ...formData, driverLicenseExpiry: e.target.value })}
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
                                type="button"
                                onClick={() => setActiveTab(tabs[currentIndex + 1].id)}
                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-6 font-semibold shadow-md active:scale-[0.98] transition-all"
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isLoading ? "Registering..." : "Register Driver"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}
