"use client";

import React, { useState } from 'react';
import { useCreateVehicleMutation } from '@/app/api/fleetApi';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";

export function AddFleetDialog() {
    const [createVehicle, { isLoading }] = useCreateVehicleMutation();
    const [isOpen, setIsOpen] = useState(false);
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
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createVehicle({
                ...formData,
                year: parseInt(formData.year) || 2024,
                status: 'ACTIVE',
                maxPassengers: parseInt(formData.maxPassengers) || 4,
                maxCargoVolume: formData.maxCargoVolume ? parseFloat(formData.maxCargoVolume) : null,
                regoState: formData.regoState,
                vin: formData.vin,
                availableFrom: formData.availableFrom || null,
                availableTo: formData.availableTo || null,
            }).unwrap();
            setIsOpen(false);
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
            });
            toast.success("Vehicle added successfully!");
        } catch (e) {
            const error = e as { data?: { error?: string } };
            console.error("Failed to add vehicle:", e);
            const errorMessage = error?.data?.error || "Failed to add vehicle.";
            toast.error(errorMessage);
        }
    };

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Add New Vehicle"
            maxWidth="sm:max-w-[500px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Vehicle</span>
                </Button>
            }
            contentClassName="p-0"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Make</label>
                        <Input
                            required
                            placeholder="e.g. Toyota"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.make}
                            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Model</label>
                        <Input
                            required
                            placeholder="e.g. HiAce"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Year</label>
                        <Input
                            type="number"
                            required
                            placeholder="2024"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Plate Number</label>
                        <Input
                            required
                            placeholder="ABC-1234"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50 uppercase"
                            value={formData.licensePlate}
                            onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">VIN Number</label>
                        <Input
                            required
                            placeholder="VIN123456789"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50 uppercase"
                            value={formData.vin}
                            onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Rego State</label>
                        <Input
                            placeholder="e.g. NSW"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50 uppercase"
                            value={formData.regoState}
                            onChange={(e) => setFormData({ ...formData, regoState: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Capacity (Seats)</label>
                        <Input
                            type="number"
                            required
                            placeholder="4"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.maxPassengers}
                            onChange={(e) => setFormData({ ...formData, maxPassengers: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Cargo Volume (m³)</label>
                        <Input
                            type="number"
                            placeholder="e.g. 0.5"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.maxCargoVolume}
                            onChange={(e) => setFormData({ ...formData, maxCargoVolume: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Available From</label>
                        <Input
                            type="date"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.availableFrom}
                            onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Available To</label>
                        <Input
                            type="date"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.availableTo}
                            onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 text-base font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {isLoading ? "Adding..." : "Add to Fleet"}
                    </Button>
                </div>
            </form>
        </DialogBox>
    );
}
