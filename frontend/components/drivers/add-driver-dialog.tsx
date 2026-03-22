"use client";

import React, { useState } from 'react';
import { useCreateUserMutation } from '@/app/api/userApi';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";

export function AddDriverDialog() {
    const [createUser, { isLoading }] = useCreateUserMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone1: '',
        driverLicense: '',
        driverLicenseExpiry: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createUser({
                ...formData,
                phone: formData.phone1,
                licenseNumber: formData.driverLicense,
                roleName: "DRIVER",
                status: "Active",
                maxfatigueMinutes: 600 // Default value
            }).unwrap();
            setIsOpen(false);
            setFormData({
                name: '',
                email: '',
                phone1: '',
                driverLicense: '',
                driverLicenseExpiry: '',
            });
            toast.success("Driver added successfully!");
        } catch (error: any) {
            console.error("Failed to add driver:", error);
            const errorMessage = error?.data?.error || "Failed to add driver.";
            toast.error(errorMessage);
        }
    };

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Register New Driver"
            maxWidth="sm:max-w-[550px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Driver</span>
                </Button>
            }
            contentClassName="p-0"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Driver Full Name</label>
                    <Input
                        required
                        placeholder="e.g. John Doe"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
                        <Input
                            type="email"
                            required
                            placeholder="john@example.com"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Phone Number</label>
                        <Input
                            required
                            placeholder="+61 400 000 000"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.phone1}
                            onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">License Number</label>
                        <Input
                            required
                            placeholder="NSW-123456"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.driverLicense}
                            onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">License Expiry</label>
                        <Input
                            type="date"
                            required
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.driverLicenseExpiry}
                            onChange={(e) => setFormData({ ...formData, driverLicenseExpiry: e.target.value })}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <p className="text-xs text-slate-400 text-center mb-4">
                        Additional details like bank info, address, and DOB can be added in the Driver Profile after registration.
                    </p>
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 text-base font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {isLoading ? "Registering..." : "Register Driver"}
                    </Button>
                </div>
            </form>
        </DialogBox>
    );
}
