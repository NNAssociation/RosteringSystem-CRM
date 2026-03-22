"use client";

import React, { useState } from 'react';
import { useUpdateUserMutation, useDeleteUserMutation } from '@/app/api/userApi';
import { Driver, ApiResponseError } from '@/app/types';
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
    Payments,
    History
} from "@mui/icons-material";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SidePanel } from "@/components/shared/side-panel";
import { Tabs, TabContent } from "@/components/ui/tabs";
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

interface DriverDetailsPanelProps {
    driver: Driver | null;
    onClose: () => void;
}

export function DriverDetailsPanel({ driver, onClose }: DriverDetailsPanelProps) {
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    const [editForm, setEditForm] = useState({
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
        status: '',
    });

    const [prevDriverId, setPrevDriverId] = useState<number | string | null>(driver?.id || null);

    if (driver && driver.id !== prevDriverId) {
        setPrevDriverId(driver.id);
        setEditForm({
            name: driver.name || '',
            email: driver.email || '',
            phoneNumber1: driver.phoneNumber1 || '',
            phoneNumber2: driver.phoneNumber2 || '',
            address: driver.address || '',
            driverLicense: driver.driverLicense || '',
            driverLicenseExpiry: driver.driverLicenseExpiry || '',
            driverLicenseState: driver.driverLicenseState || '',
            taxFileNumber: driver.taxFileNumber || '',
            occupation: driver.occupation || 'Driver',
            maxfatigueMinutes: (driver.maxfatigueMinutes || 600).toString(),
            bankName: driver.bankName || '',
            bankBSB: driver.bankBSB || '',
            bankAccount: (driver.bankAccount || '').toString(),
            dateOfBirth: driver.dateOfBirth ? (driver.dateOfBirth.includes('T') ? driver.dateOfBirth.split('T')[0] : driver.dateOfBirth) : '',
            status: driver.status || '',
        });
        setIsEditing(false);
    }

    if (!driver) return null;

    const handleSave = async () => {
        try {
            await updateUser({
                id: driver.id as number,
                data: {
                    ...editForm,
                    maxfatigueMinutes: parseInt(editForm.maxfatigueMinutes) || 600,
                    driverLicenseExpiry: editForm.driverLicenseExpiry || undefined
                }
            }).unwrap();
            toast.success("Driver updated successfully");
            setIsEditing(false);
        } catch (error: unknown) {
            console.error("Failed to update driver:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to update driver.";
            toast.error(errorMessage);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteUser(driver.id as number).unwrap();
            toast.success("Driver deleted successfully");
            onClose();
        } catch (error: unknown) {
            console.error("Failed to delete driver:", error);
            toast.error((error as ApiResponseError)?.data?.error || "Failed to delete driver.");
        }
    };

    const statusConfig = {
        'Active': { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        'On Trip': { class: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
        'Inactive': { class: "bg-slate-100 text-slate-700", dot: "bg-slate-600" },
    };

    const config = statusConfig[driver.status as keyof typeof statusConfig] || statusConfig.Inactive;

    const footer = (
        <div className="flex flex-col gap-4 p-6 border-t border-slate-100 bg-white">
            {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200"
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
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={isDeleting}
                                variant="ghost"
                                className="rounded-xl h-12 gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-semibold transition-all active:scale-95"
                            >
                                <DeleteOutline style={{ fontSize: '18px' }} /> Delete Driver
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the driver
                                    profile for {driver.name} and remove their data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                >
                                    Delete Driver
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: "profile", label: "Profile", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "employment", label: "Professional", icon: <Payments style={{ fontSize: '16px' }} /> },
        { id: "history", label: "Activity", icon: <History style={{ fontSize: '16px' }} /> },
    ];

    return (
        <SidePanel
            isOpen={!!driver}
            onClose={onClose}
            title={`Driver #DR-${driver.id.toString().padStart(5, '0')}`}
            badge={
                <Badge className={cn("px-3 py-1 rounded-lg border-none text-xs font-semibold shadow-none", config.class)}>
                    {driver.status}
                </Badge>
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-none"
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header Summary (Always Visible) */}
                <div className="p-6 pb-2 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{driver.name}</h3>
                        <p className="text-xs font-medium text-slate-500 font-mono italic">{driver.email}</p>
                    </div>
                </div>

                {/* Tabs for detailed info */}
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    <TabContent value="profile">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Full Name</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.name}</p>
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.phoneNumber1}</p>
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.phoneNumber2 || "N/A"}</p>
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.address || "No address on file"}</p>
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.dateOfBirth ? format(new Date(driver.dateOfBirth), "MMM dd, yyyy") : "N/A"}</p>
                                )}
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.driverLicenseState || "N/A"}</p>
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
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{driver.driverLicense}</p>
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
                                        driver.driverLicenseExpiry && new Date(driver.driverLicenseExpiry) < new Date() ? "text-rose-500" : "text-slate-900"
                                    )}>
                                        {driver.driverLicenseExpiry ? format(new Date(driver.driverLicenseExpiry), "MMM dd, yyyy") : "N/A"}
                                    </p>
                                )}
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="employment">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Occupation</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.occupation}
                                            onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1 capitalize">{driver.occupation || "Driver"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Max Fatigue (Mins)</label>
                                    {isEditing ? (
                                        <Input
                                            type="number"
                                            value={editForm.maxfatigueMinutes}
                                            onChange={(e) => setEditForm({ ...editForm, maxfatigueMinutes: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{driver.maxfatigueMinutes || 600}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-900 tracking-wider ml-1">Bank Details</h4>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Bank Name</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.bankName}
                                            onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{driver.bankName || "N/A"}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">BSB</label>
                                        {isEditing ? (
                                            <Input
                                                value={editForm.bankBSB}
                                                onChange={(e) => setEditForm({ ...editForm, bankBSB: e.target.value })}
                                                className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            />
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-900 ml-1 font-mono">{driver.bankBSB || "N/A"}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">Account Number</label>
                                        {isEditing ? (
                                            <Input
                                                value={editForm.bankAccount}
                                                onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                                                className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                            />
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-900 ml-1 font-mono">{driver.bankAccount || "N/A"}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Tax File Number</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.taxFileNumber}
                                            onChange={(e) => setEditForm({ ...editForm, taxFileNumber: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1 font-mono">{driver.taxFileNumber || "N/A"}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="history">
                        <div className="flex flex-col items-center justify-center h-40 space-y-3 opacity-40">
                            <History style={{ fontSize: '40px' }} />
                            <p className="text-xs font-semibold">No recent activity recorded</p>
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}
