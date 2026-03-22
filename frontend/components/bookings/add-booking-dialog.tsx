"use client";

import React, { useState } from 'react';
import { useCreateBookingMutation } from '@/app/api/bookingsApi';
import { ApiResponseError } from '@/app/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";

export function AddBookingDialog() {
    const [createBooking, { isLoading }] = useCreateBookingMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        subject: '',
        pickupLocation: '',
        dropoffLocation: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createBooking({
                ...formData,
                noOfVehicles: 1,
                passengerCount: 1,
                tripCount: 1,
                status: 'Pending',
                endDate: formData.date,
                endTime: '10:00', // Default 1 hour duration
            }).unwrap();
            setIsOpen(false);
            setFormData({
                customerName: '',
                customerEmail: '',
                subject: '',
                pickupLocation: '',
                dropoffLocation: '',
                date: new Date().toISOString().split('T')[0],
                startTime: '09:00',
            });
            toast.success("Booking created successfully!");
        } catch (error: unknown) {
            console.error("Failed to add booking:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add booking.";
            toast.error(errorMessage);
        }
    };

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Create New Booking"
            maxWidth="sm:max-w-[600px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Booking</span>
                </Button>
            }
            contentClassName="p-0"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Customer Name</label>
                        <Input
                            required
                            placeholder="e.g. John Doe"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
                        <Input
                            type="email"
                            required
                            placeholder="john@example.com"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.customerEmail}
                            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Subject / Trip Type</label>
                    <Input
                        required
                        placeholder="e.g. Airport Transfer"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Pickup Location</label>
                        <Input
                            required
                            placeholder="Address A"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.pickupLocation}
                            onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Dropoff Location</label>
                        <Input
                            required
                            placeholder="Address B"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.dropoffLocation}
                            onChange={(e) => setFormData({ ...formData, dropoffLocation: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Pickup Date</label>
                        <Input
                            type="date"
                            required
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Pickup Time</label>
                        <Input
                            type="time"
                            required
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50 px-2"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <p className="text-xs text-slate-400 text-center mb-4">
                        Duration, number of vehicles, and specific booking details can be adjusted in the Booking Details after creation.
                    </p>
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 text-base font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {isLoading ? "Creating..." : "Create Booking"}
                    </Button>
                </div>
            </form>
        </DialogBox>
    );
}
