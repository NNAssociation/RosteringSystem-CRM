"use client";

import React, { useState } from 'react';
import { useCreateBookingMutation } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, Map, Groups, Person, Notes } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";

export function AddBookingDialog() {
    const [createBooking, { isLoading }] = useCreateBookingMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("trip");
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        subject: '',
        bookingDetails: '',
        pickupLocation: '',
        dropoffLocation: '',
        noOfVehicles: '1',
        passengerCount: '1',
        tripCount: '1',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endDate: '',
        endTime: '',
    });

    const resetForm = () => {
        setFormData({
            customerName: '',
            customerEmail: '',
            subject: '',
            bookingDetails: '',
            pickupLocation: '',
            dropoffLocation: '',
            noOfVehicles: '1',
            passengerCount: '1',
            tripCount: '1',
            date: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endDate: '',
            endTime: '',
        });
        setActiveTab("trip");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createBooking({
                ...formData,
                noOfVehicles: parseInt(formData.noOfVehicles) || 1,
                passengerCount: parseInt(formData.passengerCount) || 1,
                tripCount: parseInt(formData.tripCount) || 1,
                status: 'Pending',
                endDate: formData.endDate || formData.date,
                endTime: formData.endTime || '10:00',
            }).unwrap();
            setIsOpen(false);
            resetForm();
            toast.success("Booking created successfully!");
        } catch (error: unknown) {
            console.error("Failed to add booking:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add booking.";
            toast.error(errorMessage);
        }
    };

    const tabs = [
        { id: "trip", label: "Trip", icon: <Map style={{ fontSize: '16px' }} /> },
        { id: "logistics", label: "Logistics", icon: <Groups style={{ fontSize: '16px' }} /> },
        { id: "customer", label: "Customer", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "notes", label: "Notes", icon: <Notes style={{ fontSize: '16px' }} /> },
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
            title="Create New Booking"
            maxWidth="sm:max-w-[700px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Booking</span>
                </Button>
            }
            contentClassName="p-0 overflow-hidden flex flex-col"
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    <TabContent value="trip" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Trip Subject / Type</label>
                                <Input
                                    required
                                    placeholder="e.g. Airport Transfer"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Pickup From</label>
                                    <Input
                                        required
                                        placeholder="Address A"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.pickupLocation}
                                        onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Dropoff At</label>
                                    <Input
                                        required
                                        placeholder="Address B"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.dropoffLocation}
                                        onChange={(e) => setFormData({ ...formData, dropoffLocation: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Start Date</label>
                                    <Input
                                        type="date"
                                        required
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Start Time</label>
                                    <Input
                                        type="time"
                                        required
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">End Date</label>
                                    <Input
                                        type="date"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">End Time</label>
                                    <Input
                                        type="time"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="logistics" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Passenger Count</label>
                                <Input
                                    type="number"
                                    min="1"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.passengerCount}
                                    onChange={(e) => setFormData({ ...formData, passengerCount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">No. of Vehicles</label>
                                <Input
                                    type="number"
                                    min="1"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.noOfVehicles}
                                    onChange={(e) => setFormData({ ...formData, noOfVehicles: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Trip Count</label>
                                <Input
                                    type="number"
                                    min="1"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.tripCount}
                                    onChange={(e) => setFormData({ ...formData, tripCount: e.target.value })}
                                />
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="customer" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Customer Name</label>
                                <Input
                                    required
                                    placeholder="e.g. John Doe"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Customer Email</label>
                                <Input
                                    type="email"
                                    required
                                    placeholder="john@example.com"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                />
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="notes" className="p-0 pb-4">
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 ml-1">Special Requirements / Booking Details</label>
                            <textarea
                                className="flex min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:outline-none focus:ring-primary/20 transition-all"
                                value={formData.bookingDetails}
                                onChange={(e) => setFormData({ ...formData, bookingDetails: e.target.value })}
                                placeholder="Add any specific requests or internal notes here..."
                            />
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
                                {isLoading ? "Creating..." : "Create Booking"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}
