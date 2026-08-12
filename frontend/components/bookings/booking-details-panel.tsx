"use client";

import React, { useState } from 'react';
import { useUpdateBookingMutation, useDeleteBookingMutation } from '@/services/api';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
    MailOutline,
    Edit,
    Cancel,
    Save,
    Close,
    History,
    DeleteOutline,
    Map,
    Groups,
    Person,
    Notes
} from "@mui/icons-material";
import { format } from "date-fns";
import { Booking, ApiResponseError } from "@/types";
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

interface BookingDetailsPanelProps {
    booking: Booking | null;
    onClose: () => void;
}

export function BookingDetailsPanel({ booking, onClose }: BookingDetailsPanelProps) {
    const [updateBooking] = useUpdateBookingMutation();
    const [deleteBooking, { isLoading: isDeleting }] = useDeleteBookingMutation();
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState("trip");

    const [editForm, setEditForm] = useState({
        customerName: '',
        customerEmail: '',
        subject: '',
        bookingDetails: '',
        pickupLocation: '',
        dropoffLocation: '',
        noOfVehicles: '1',
        passengerCount: '1',
        tripCount: '1',
        date: '',
        startTime: '',
        endDate: '',
        endTime: '',
    });

    // Sync editForm with booking during render
    const [prevBooking, setPrevBooking] = useState<Booking | null>(null);
    if (booking !== prevBooking) {
        setPrevBooking(booking);
        if (booking) {
            setEditForm({
                customerName: booking.customerName,
                customerEmail: booking.customerEmail,
                subject: booking.subject || '',
                bookingDetails: booking.bookingDetails || '',
                pickupLocation: booking.pickupLocation,
                dropoffLocation: booking.dropoffLocation,
                noOfVehicles: (booking.noOfVehicles || 1).toString(),
                passengerCount: (booking.passengerCount || 1).toString(),
                tripCount: (booking.tripCount || 1).toString(),
                date: new Date(booking.date).toISOString().split('T')[0],
                startTime: booking.startTime,
                endDate: booking.endDate || (booking.date ? new Date(booking.date).toISOString().split('T')[0] : ''),
                endTime: booking.endTime || '',
            });
            setIsEditing(false);
        }
    }

    if (!booking) return null;

    const handleCancel = async () => {
        setIsUpdating(true);
        try {
            await updateBooking({
                id: booking.id,
                data: { status: 'Cancelled' }
            }).unwrap();
            toast.success("Booking cancelled successfully");
        } catch {
            toast.error("Failed to cancel booking");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSave = async () => {
        setIsUpdating(true);
        try {
            await updateBooking({
                id: booking.id,
                data: {
                    ...editForm,
                    noOfVehicles: parseInt(editForm.noOfVehicles) || 1,
                    passengerCount: parseInt(editForm.passengerCount) || 1,
                    tripCount: parseInt(editForm.tripCount) || 1,
                }
            }).unwrap();
            toast.success("Booking updated successfully");
            setIsEditing(false);
        } catch (error: unknown) {
            console.error("Failed to update booking:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to update booking.";
            toast.error(errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteBooking(booking.id).unwrap();
            toast.success("Booking deleted successfully");
            onClose();
        } catch (error: unknown) {
            console.error("Failed to delete booking:", error);
            toast.error((error as ApiResponseError)?.data?.error || "Failed to delete booking.");
        }
    };

    const statusConfig = {
        Confirmed: { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        Cancelled: { class: "bg-red-100 text-red-700", dot: "bg-red-600" },
        Pending: { class: "bg-amber-100 text-amber-700", dot: "bg-amber-600" },
    };

    const config = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.Pending;

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
                <>
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={() => setIsEditing(true)}
                                variant="outline"
                                className="rounded-xl h-12 gap-2 border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                            >
                                <Edit style={{ fontSize: '16px' }} /> Edit Details
                            </Button>
                            <Button className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200">
                                <History style={{ fontSize: '18px' }} /> View History
                            </Button>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    disabled={isDeleting || isUpdating}
                                    variant="ghost"
                                    className="rounded-xl h-12 gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-semibold transition-all active:scale-95"
                                >
                                    <DeleteOutline style={{ fontSize: '18px' }} /> Delete Booking
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete Booking?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete booking #BK-{booking.id.toString().padStart(5, '0')} for {booking.customerName}?
                                        This will remove all records of this trip.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Go Back</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                    >
                                        Confirm Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    {booking.status !== 'Cancelled' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    disabled={isUpdating}
                                    className="w-full h-12 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-all active:scale-95"
                                >
                                    <Cancel style={{ fontSize: '18px' }} /> Cancel Booking
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel This Booking?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to cancel booking #B-{(booking.id || "").toString().padStart(5, '0')}?
                                        This will mark the status as Cancelled.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Go Back</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleCancel}
                                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                                    >
                                        Confirm Cancellation
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </>
            )}
        </div>
    );

    const tabs = [
        { id: "trip", label: "Trip", icon: <Map style={{ fontSize: '16px' }} /> },
        { id: "logistics", label: "Logistics", icon: <Groups style={{ fontSize: '16px' }} /> },
        { id: "customer", label: "Customer", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "notes", label: "Notes", icon: <Notes style={{ fontSize: '16px' }} /> },
    ];

    return (
        <SidePanel
            isOpen={!!booking}
            onClose={onClose}
            title={`Booking #BK-${booking.id.toString().padStart(5, '0')}`}
            badge={
                <Badge className={cn("px-3 py-1 rounded-lg border-none text-xs font-semibold shadow-none", config.class)}>
                    {booking.status}
                </Badge>
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-none"
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Visual Trip Header (Always Visible) */}
                <div className="p-6 pb-0 space-y-4">
                    <div className="bg-slate-900/5 rounded-2xl p-4 border border-slate-100 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                        <span className="text-xs font-bold text-slate-400 block mb-1 tracking-wider">Trip Subject</span>
                        {isEditing ? (
                            <Input
                                value={editForm.subject}
                                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                className="h-9 text-sm font-semibold border-slate-200 bg-white rounded-xl"
                            />
                        ) : (
                            <h3 className="text-base font-bold text-slate-900 tracking-tight relative z-10">{booking.subject || "General Inquiry"}</h3>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <div className={cn("w-2 h-2 rounded-full shadow-sm", config.dot)} />
                            <span className="text-xs font-bold text-slate-500 tracking-tighter">{booking.status}</span>
                        </div>
                    </div>
                </div>

                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    <TabContent value="trip">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Pickup From</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.pickupLocation}
                                            onChange={(e) => setEditForm({ ...editForm, pickupLocation: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{booking.pickupLocation}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Dropoff At</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.dropoffLocation}
                                            onChange={(e) => setEditForm({ ...editForm, dropoffLocation: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{booking.dropoffLocation}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Start Date</label>
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={editForm.date}
                                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{format(new Date(booking.startTime), "MMM dd, yyyy")}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Start Time</label>
                                    {isEditing ? (
                                        <Input
                                            type="time"
                                            value={editForm.startTime}
                                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{format(new Date(booking.startTime), "hh:mm aa")}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">End Date</label>
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={editForm.endDate}
                                            onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{booking.endDate ? format(new Date(booking.endDate), "MMM dd, yyyy") : "Same Day"}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">End Time</label>
                                    {isEditing ? (
                                        <Input
                                            type="time"
                                            value={editForm.endTime}
                                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{booking.endTime ? format(new Date(booking.endTime), "hh:mm aa") : "TBD"}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="logistics">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Passenger Count</label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={editForm.passengerCount}
                                        onChange={(e) => setEditForm({ ...editForm, passengerCount: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{booking.passengerCount || 1} Person(s)</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">No. of Vehicles</label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={editForm.noOfVehicles}
                                        onChange={(e) => setEditForm({ ...editForm, noOfVehicles: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{booking.noOfVehicles || 1} Vehicle(s)</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Trip Count</label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={editForm.tripCount}
                                        onChange={(e) => setEditForm({ ...editForm, tripCount: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{booking.tripCount || 1} Leg(s)</p>
                                )}
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="customer">
                        <div className="space-y-8">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="space-y-1">
                                    {isEditing ? (
                                        <Input
                                            value={editForm.customerName}
                                            onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                                            className="h-10 text-center font-bold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{booking.customerName}</h3>
                                    )}
                                    {isEditing ? (
                                        <Input
                                            value={editForm.customerEmail}
                                            onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })}
                                            className="h-8 text-xs text-center font-mono border-slate-200 bg-slate-50/50 rounded-lg mt-2"
                                        />
                                    ) : (
                                        <p className="text-xs font-medium text-slate-400 font-mono tracking-tight">{booking.customerEmail}</p>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 group hover:border-primary/30 transition-all">
                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-primary transition-all">
                                    <MailOutline style={{ fontSize: '20px' }} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-400 tracking-wider">Contact Method</span>
                                    <span className="text-xs font-semibold text-slate-800 tracking-tight">Email Preferred</span>
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="notes">
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 ml-1">Special Requirements / Booking Details</label>
                            {isEditing ? (
                                <textarea
                                    className="flex min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:outline-none focus:ring-primary/20 transition-all"
                                    value={editForm.bookingDetails}
                                    onChange={(e) => setEditForm({ ...editForm, bookingDetails: e.target.value })}
                                    placeholder="Add any specific requests or internal notes here..."
                                />
                            ) : (
                                <div className="p-6 rounded-2xl bg-amber-50/30 border border-amber-100 min-h-[100px] relative">
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic pr-4">
                                        &quot;{booking.bookingDetails || "No additional requirements provided for this trip."}&quot;
                                    </p>
                                    <Notes className="absolute top-4 right-4 text-amber-200" style={{ fontSize: '24px' }} />
                                </div>
                            )}
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}
