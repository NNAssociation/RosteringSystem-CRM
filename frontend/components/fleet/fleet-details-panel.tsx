"use client";

import React, { useState, useEffect } from 'react';
import { useUpdateVehicleMutation, useDeleteVehicleMutation, useGetDepotsQuery, useGetUsersQuery } from '@/services/api';
import { Vehicle, ApiResponseError } from '@/types';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
    Edit,
    Save,
    Close,
    History,
    DeleteOutline,
    DirectionsCar,
    Settings,
    Event
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

interface FleetDetailsPanelProps {
    vehicle: Vehicle | null;
    onClose: () => void;
}

export function FleetDetailsPanel({ vehicle, onClose }: FleetDetailsPanelProps) {
    const [updateVehicle] = useUpdateVehicleMutation();
    const [deleteVehicle, { isLoading: isDeleting }] = useDeleteVehicleMutation();
    const { data: depots } = useGetDepotsQuery();
    const { data: drivers } = useGetUsersQuery();
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState("vehicle");

    const [editForm, setEditForm] = useState({
        make: '',
        model: '',
        year: '',
        licensePlate: '',
        regoState: '',
        vin: '',
        status: '',
        maxPassengers: '',
        maxCargoVolume: '',
        availableFrom: '',
        availableTo: '',
        homeDepotId: '',
        assignedDriverId: '',
    });

    useEffect(() => {
        if (vehicle) {
            setEditForm({
                make: vehicle.make || '',
                model: vehicle.model || '',
                year: (vehicle.year || 2024).toString(),
                licensePlate: vehicle.licensePlate || '',
                regoState: vehicle.regoState || '',
                vin: vehicle.vin || '',
                status: vehicle.status || '',
                maxPassengers: (vehicle.maxPassengers || 0).toString(),
                maxCargoVolume: (vehicle.maxCargoVolume || 0).toString(),
                availableFrom: vehicle.availableFrom ? (vehicle.availableFrom.includes('T') ? vehicle.availableFrom.split('T')[0] : vehicle.availableFrom) : '',
                availableTo: vehicle.availableTo ? (vehicle.availableTo.includes('T') ? vehicle.availableTo.split('T')[0] : vehicle.availableTo) : '',
                homeDepotId: vehicle.homeDepotId ? vehicle.homeDepotId.toString() : '',
                assignedDriverId: vehicle.assignedDriverId ? vehicle.assignedDriverId.toString() : '',
            });
            setIsEditing(false);
        }
    }, [vehicle]);

    if (!vehicle) return null;

    const handleSave = async () => {
        setIsUpdating(true);
        try {
            await updateVehicle({
                id: vehicle.id,
                data: {
                    ...editForm,
                    year: parseInt(editForm.year) || vehicle.year,
                    maxPassengers: parseInt(editForm.maxPassengers) || vehicle.maxPassengers,
                    maxCargoVolume: parseFloat(editForm.maxCargoVolume) || 0,
                    homeDepotId: editForm.homeDepotId ? parseInt(editForm.homeDepotId) : undefined,
                    assignedDriverId: editForm.assignedDriverId ? parseInt(editForm.assignedDriverId) : undefined,
                }
            }).unwrap();
            toast.success("Vehicle updated successfully");
            setIsEditing(false);
        } catch (error: unknown) {
            console.error("Failed to update vehicle:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to update vehicle.";
            toast.error(errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteVehicle(vehicle.id).unwrap();
            toast.success("Vehicle deleted successfully");
            onClose();
        } catch (error: unknown) {
            console.error("Failed to delete vehicle:", error);
            toast.error((error as ApiResponseError)?.data?.error || "Failed to delete vehicle.");
        }
    };

    const statusConfig = {
        'Available': { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        'ACTIVE': { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        'On Trip': { class: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
        'Maintenance': { class: "bg-amber-100 text-amber-700", dot: "bg-amber-600" },
        'MAINTENANCE': { class: "bg-amber-100 text-amber-700", dot: "bg-amber-600" },
        'INACTIVE': { class: "bg-rose-100 text-rose-700", dot: "bg-rose-600" },
    };

    const config = statusConfig[vehicle.status as keyof typeof statusConfig] || statusConfig.Available;

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
                            <Edit style={{ fontSize: '16px' }} /> Edit Details
                        </Button>
                        <Button className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200">
                            <History style={{ fontSize: '18px' }} /> Trip History
                        </Button>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={isDeleting}
                                variant="ghost"
                                className="rounded-xl h-12 gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-semibold transition-all active:scale-95"
                            >
                                <DeleteOutline style={{ fontSize: '18px' }} /> Delete Vehicle
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Vehicle from Fleet?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to remove the {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.licensePlate})?
                                    This action is permanent and will remove all maintenance and trip history.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                >
                                    Delete Vehicle
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: "vehicle", label: "Vehicle", icon: <DirectionsCar style={{ fontSize: '16px' }} /> },
        { id: "specs", label: "Specs", icon: <Settings style={{ fontSize: '16px' }} /> },
        { id: "scheduling", label: "Availability", icon: <Event style={{ fontSize: '16px' }} /> },
    ];

    return (
        <SidePanel
            isOpen={!!vehicle}
            onClose={onClose}
            title={`Vehicle Profile`}
            badge={
                <Badge className={cn("px-3 py-1 rounded-lg border-none text-xs font-semibold shadow-none", config.class)}>
                    {vehicle.status}
                </Badge>
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-md"
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Visual Header (Always Visible) */}
                <div className="p-6 pb-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{vehicle.make} {vehicle.model}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono tracking-widest border border-slate-200 shadow-sm text-slate-600">
                                {vehicle.licensePlate}
                            </span>
                            <span className="text-xs font-medium bg-slate-900 px-2 py-0.5 rounded text-white italic">
                                {vehicle.year}
                            </span>
                        </div>
                    </div>
                </div>

                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    <TabContent value="vehicle">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Make</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.make}
                                        onChange={(e) => setEditForm({ ...editForm, make: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.make}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Model</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.model}
                                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.model}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Year</label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={editForm.year}
                                        onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.year}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Plate</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.licensePlate}
                                        onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.licensePlate}</p>
                                )}
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1 tracking-wider">Current Status</label>
                                {isEditing ? (
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:outline-none focus:ring-primary/20"
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    >
                                        <option value="ACTIVE">Active (Available)</option>
                                        <option value="On Trip">On Trip</option>
                                        <option value="MAINTENANCE">Maintenance</option>
                                        <option value="INACTIVE">Inactive</option>
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 ml-1">
                                        <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                                        <span className="text-sm font-semibold text-slate-900">{vehicle.status}</span>
                                    </div>
                                )}
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Home Depot</label>
                                {isEditing ? (
                                    <select
                                        className="h-10 w-full text-xs font-semibold border border-slate-200 bg-slate-50/50 rounded-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                        value={editForm.homeDepotId}
                                        onChange={(e) => setEditForm({ ...editForm, homeDepotId: e.target.value })}
                                    >
                                        <option value="">No Depot</option>
                                        {depots?.map(depot => (
                                            <option key={depot.id} value={depot.id}>{depot.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.homeDepot?.name || "No Depot Assigned"}</p>
                                )}
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-semibold text-slate-400 ml-1">Assigned Driver</label>
                                {isEditing ? (
                                    <select
                                        className="h-10 w-full text-xs font-semibold border border-slate-200 bg-slate-50/50 rounded-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                        value={editForm.assignedDriverId}
                                        onChange={(e) => setEditForm({ ...editForm, assignedDriverId: e.target.value })}
                                    >
                                        <option value="">No Driver Assigned</option>
                                        {drivers?.filter(d => d.isActive).map(driver => (
                                            <option key={driver.id} value={driver.id}>{driver.name || driver.email}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.assignedDriver?.name || vehicle.assignedDriver?.email || "No Driver Assigned"}</p>
                                )}
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="specs">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">VIN Number</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.vin}
                                            onChange={(e) => setEditForm({ ...editForm, vin: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1 font-mono text-[11px]">{vehicle.vin || "N/A"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Rego State</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.regoState}
                                            onChange={(e) => setEditForm({ ...editForm, regoState: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.regoState || "N/A"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Number of Seats</label>
                                    {isEditing ? (
                                        <Input
                                            type="number"
                                            value={editForm.maxPassengers}
                                            onChange={(e) => setEditForm({ ...editForm, maxPassengers: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.maxPassengers} Passengers</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Max Cargo (m³)</label>
                                    {isEditing ? (
                                        <Input
                                            type="number"
                                            value={editForm.maxCargoVolume}
                                            onChange={(e) => setEditForm({ ...editForm, maxCargoVolume: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.maxCargoVolume || 0} m³</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="scheduling">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Available From</label>
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={editForm.availableFrom}
                                            onChange={(e) => setEditForm({ ...editForm, availableFrom: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.availableFrom ? format(new Date(vehicle.availableFrom), "MMM dd, yyyy") : "Now"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 ml-1">Available To</label>
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={editForm.availableTo}
                                            onChange={(e) => setEditForm({ ...editForm, availableTo: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{vehicle.availableTo ? format(new Date(vehicle.availableTo), "MMM dd, yyyy") : "Indefinite"}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Jobs / Bookings</h4>
                                {vehicle.fleetJobs && vehicle.fleetJobs.length > 0 ? (
                                    <div className="space-y-3">
                                        {vehicle.fleetJobs.map((fj: { jobId: number | string; job?: { status?: string; jobStartDateTime?: string; jobStartLocation?: string; jobEndLocation?: string } }) => (
                                            <div key={fj.jobId} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-bold text-slate-900 uppercase">Job #{fj.jobId}</span>
                                                    <Badge className="bg-blue-100 text-blue-700 text-[10px] font-bold border-none">
                                                        {fj.job?.status || "Assigned"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                                    <Event style={{ fontSize: '14px' }} />
                                                    <span>{fj.job?.jobStartDateTime ? format(new Date(fj.job.jobStartDateTime), "MMM dd, hh:mm a") : "TBD"}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 italic">
                                                    {fj.job?.jobStartLocation} → {fj.job?.jobEndLocation}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-40 items-center justify-center opacity-40 space-y-3">
                                        <History style={{ fontSize: '32px' }} />
                                        <p className="text-xs font-bold tracking-wider">No active jobs assigned to this vehicle</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}
