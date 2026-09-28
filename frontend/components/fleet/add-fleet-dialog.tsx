"use client";

import React, { useState } from 'react';
import { useCreateVehicleMutation, useGetDepotsQuery, useGetUsersQuery } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, DirectionsCar, Settings, Event } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";

export function AddFleetDialog() {
    const [createVehicle, { isLoading }] = useCreateVehicleMutation();
    const { data: depots } = useGetDepotsQuery();
    const { data: drivers } = useGetUsersQuery();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("vehicle");
    const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0);

    const [formData, setFormData] = useState({
        make: '',
        model: '',
        year: new Date().getFullYear().toString(),
        licensePlate: '',
        regoState: '',
        vin: '',
        maxPassengers: '4',
        maxCargoVolume: '',
        availableFrom: '',
        availableTo: '',
        homeDepotId: '',
        assignedDriverId: '',
    });

    const resetForm = () => {
        setFormData({
            make: '',
            model: '',
            year: new Date().getFullYear().toString(),
            licensePlate: '',
            regoState: '',
            vin: '',
            maxPassengers: '4',
            maxCargoVolume: '',
            availableFrom: '',
            availableTo: '',
            homeDepotId: '',
            assignedDriverId: '',
        });
        setActiveTab("vehicle");
        setMaxUnlockedIndex(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createVehicle({
                ...formData,
                year: parseInt(formData.year) || 2024,
                status: 'ACTIVE',
                maxPassengers: parseInt(formData.maxPassengers) || 4,
                maxCargoVolume: formData.maxCargoVolume ? parseFloat(formData.maxCargoVolume) : undefined,
                regoState: formData.regoState,
                vin: formData.vin,
                availableFrom: formData.availableFrom || undefined,
                availableTo: formData.availableTo || undefined,
                homeDepotId: formData.homeDepotId ? parseInt(formData.homeDepotId) : undefined,
                assignedDriverId: formData.assignedDriverId ? parseInt(formData.assignedDriverId) : undefined,
            }).unwrap();
            setIsOpen(false);
            resetForm();
            toast.success("Vehicle added successfully!");
        } catch (error: unknown) {
            console.error("Failed to add vehicle:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add vehicle.";
            toast.error(errorMessage);
        }
    };

    const baseTabs = [
        { id: "vehicle", label: "Vehicle", icon: <DirectionsCar style={{ fontSize: '16px' }} /> },
        { id: "specs", label: "Specs", icon: <Settings style={{ fontSize: '16px' }} /> },
        { id: "scheduling", label: "Availability", icon: <Event style={{ fontSize: '16px' }} /> },
    ];

    const tabs = baseTabs.map((t, idx) => ({
        ...t,
        disabled: idx > maxUnlockedIndex,
    }));

    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    const isLastTab = currentIndex === tabs.length - 1;

    const handleNext = () => {
        if (!isCurrentTabValid()) return;
        const nextIdx = currentIndex + 1;
        if (nextIdx < tabs.length) {
            setMaxUnlockedIndex((prev) => Math.max(prev, nextIdx));
            setActiveTab(tabs[nextIdx].id);
        }
    };

    const isYearValid = Boolean(parseInt(formData.year) >= 1900 && parseInt(formData.year) <= 2100);
    const isVehicleValid = Boolean(
        formData.make.trim().length >= 2 &&
        formData.model.trim().length >= 2 &&
        isYearValid &&
        formData.licensePlate.trim().length >= 2
    );
    const isSpecsValid = Boolean(
        formData.vin.trim().length >= 3 &&
        parseInt(formData.maxPassengers) >= 1
    );
    const isSchedulingValid = Boolean(
        !formData.availableFrom ||
        !formData.availableTo ||
        new Date(formData.availableTo) >= new Date(formData.availableFrom)
    );

    const isCurrentTabValid = () => {
        switch (activeTab) {
            case "vehicle": return isVehicleValid;
            case "specs": return isSpecsValid;
            case "scheduling": return isSchedulingValid;
            default: return false;
        }
    };

    const isFormComplete = isVehicleValid && isSpecsValid && isSchedulingValid;

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) resetForm();
            }}
            title="Add New Vehicle"
            maxWidth="sm:max-w-[600px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Vehicle</span>
                </Button>
            }
            contentClassName="p-0 overflow-hidden flex flex-col"
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    <TabContent value="vehicle" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Make <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="e.g. Toyota"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.make}
                                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                                />
                                {formData.make.length > 0 && formData.make.trim().length < 2 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 2 characters</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Model <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="e.g. HiAce"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                />
                                {formData.model.length > 0 && formData.model.trim().length < 2 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 2 characters</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Year <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    type="number"
                                    required
                                    placeholder="2024"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                />
                                {formData.year.length > 0 && !isYearValid && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">Must be between 1900 and 2100</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">
                                    Plate <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    required
                                    placeholder="ABC-1234"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl uppercase"
                                    value={formData.licensePlate}
                                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                                />
                                {formData.licensePlate.length > 0 && formData.licensePlate.trim().length < 2 && (
                                    <p className="text-[11px] text-rose-500 font-medium ml-1">At least 2 characters</p>
                                )}
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Home Depot</label>
                                <select
                                    className="h-10 w-full text-xs font-semibold border border-slate-200 bg-slate-50/50 rounded-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                    value={formData.homeDepotId}
                                    onChange={(e) => setFormData({ ...formData, homeDepotId: e.target.value })}
                                >
                                    <option value="">No Depot (Use Default)</option>
                                    {depots?.map(depot => (
                                        <option key={depot.id} value={depot.id}>{depot.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Assigned Driver</label>
                                <select
                                    className="h-10 w-full text-xs font-semibold border border-slate-200 bg-slate-50/50 rounded-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                    value={formData.assignedDriverId}
                                    onChange={(e) => setFormData({ ...formData, assignedDriverId: e.target.value })}
                                >
                                    <option value="">No Assigned Driver</option>
                                    {drivers?.filter(d => d.status === 'ACTIVE').map(driver => (
                                        <option key={driver.id} value={driver.id}>{driver.firstName || ''} {driver.lastName || ''} ({driver.email})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="specs" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">
                                        VIN Number <span className="text-rose-500">*</span>
                                    </label>
                                    <Input
                                        required
                                        placeholder="VIN123456789"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl uppercase"
                                        value={formData.vin}
                                        onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                                    />
                                    {formData.vin.length > 0 && formData.vin.trim().length < 3 && (
                                        <p className="text-[11px] text-rose-500 font-medium ml-1">At least 3 characters</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Rego State</label>
                                    <Input
                                        placeholder="e.g. NSW"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl uppercase"
                                        value={formData.regoState}
                                        onChange={(e) => setFormData({ ...formData, regoState: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">
                                        Number of Seats <span className="text-rose-500">*</span>
                                    </label>
                                    <Input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="4"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.maxPassengers}
                                        onChange={(e) => setFormData({ ...formData, maxPassengers: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Max Cargo Volume (m³)</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 0.5"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.maxCargoVolume}
                                        onChange={(e) => setFormData({ ...formData, maxCargoVolume: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="scheduling" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Available From</label>
                                    <Input
                                        type="date"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.availableFrom}
                                        onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Available To</label>
                                    <Input
                                        type="date"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.availableTo}
                                        onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                                    />
                                    {formData.availableFrom && formData.availableTo && !isSchedulingValid && (
                                        <p className="text-[11px] text-rose-500 font-medium ml-1">Available To must be after Available From</p>
                                    )}
                                </div>
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
                                disabled={!isCurrentTabValid()}
                                onClick={handleNext}
                                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white rounded-xl h-11 px-6 font-semibold shadow-md active:scale-[0.98] transition-all"
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                disabled={!isFormComplete || isLoading}
                                className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl h-11 px-6 font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isLoading ? "Adding..." : "Add to Fleet"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}
