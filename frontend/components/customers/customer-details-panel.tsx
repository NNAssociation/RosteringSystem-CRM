import React, { useState, useEffect } from 'react';
import { useUpdateCustomerMutation, useDeleteCustomerMutation } from '@/app/api/customersApi';
import { Customer, ApiResponseError } from '@/app/types';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
    MailOutline,
    Edit,
    Print,
    Cancel,
    CheckCircle,
    ErrorOutline,
    Save,
    Close,
    Phone,
    History,
    DeleteOutline,
    Person,
    LocationOn
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

interface CustomerDetailsPanelProps {
    customer: Customer | null;
    onClose: () => void;
}

export function CustomerDetailsPanel({ customer, onClose }: CustomerDetailsPanelProps) {
    const [updateCustomer] = useUpdateCustomerMutation();
    const [deleteCustomer, { isLoading: isDeleting }] = useDeleteCustomerMutation();
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [activeTab, setActiveTab] = useState("general");

    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        phone1: '',
        phone2: '',
        company: '',
        address: '',
        status: '',
    });

    useEffect(() => {
        if (customer) {
            setEditForm({
                name: customer.name || '',
                email: customer.email || '',
                phone1: customer.phone1 || '',
                phone2: customer.phone2 || '',
                company: customer.company || '',
                address: customer.address || '',
                status: customer.status || '',
            });
            setIsEditing(false);
        }
    }, [customer]);

    if (!customer) return null;

    const handleSave = async () => {
        setIsUpdating(true);
        try {
            await updateCustomer({
                id: customer.id,
                data: editForm
            }).unwrap();
            toast.success("Customer updated successfully");
            setIsEditing(false);
        } catch (error: unknown) {
            console.error("Failed to update customer:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to update customer.";
            toast.error(errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteCustomer(customer.id).unwrap();
            toast.success("Customer deleted successfully");
            onClose();
        } catch (error: unknown) {
            console.error("Failed to delete customer:", error);
            toast.error((error as ApiResponseError)?.data?.error || "Failed to delete customer.");
        }
    };

    const statusConfig = {
        'Active': { class: "bg-green-100 text-green-700", dot: "bg-green-600" },
        'Inactive': { class: "bg-slate-100 text-slate-700", dot: "bg-slate-600" },
    };

    const config = statusConfig[customer.status as keyof typeof statusConfig] || statusConfig.Inactive;

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
                            <History style={{ fontSize: '18px' }} /> View Activity
                        </Button>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={isDeleting}
                                variant="ghost"
                                className="rounded-xl h-12 gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-semibold transition-all active:scale-95"
                            >
                                <DeleteOutline style={{ fontSize: '18px' }} /> Delete Customer
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Customer Profile?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete {customer.name}?
                                    All associated booking history and contact information will be permanently removed.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Keep Customer</AlertDialogCancel>
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
            )}
        </div>
    );

    const tabs = [
        { id: "general", label: "General", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "contact", label: "Contact", icon: <LocationOn style={{ fontSize: '16px' }} /> },
    ];

    return (
        <SidePanel
            isOpen={!!customer}
            onClose={onClose}
            title={`Customer Profile`}
            badge={
                <Badge className={cn("px-3 py-1 rounded-lg border-none text-xs font-semibold shadow-none", config.class)}>
                    {customer.status}
                </Badge>
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-none"
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Visual Header (Always Visible) */}
                <div className="p-6 pb-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{customer.name}</h3>
                        <p className="text-xs font-medium text-slate-500 font-mono italic">{customer.email}</p>
                    </div>
                </div>

                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    <TabContent value="general">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Full Name</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.name}</p>
                                    )}
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Company</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.company}
                                            onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.company || "Individual Customer"}</p>
                                    )}
                                </div>
                                <div className="space-y-2 text-right">
                                    <label className="text-xs font-bold text-slate-400 mr-1">Status</label>
                                    <div className="flex items-center justify-end gap-2 mt-1 px-1">
                                        <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                                        <span className="text-xs font-bold text-slate-900">{customer.status}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </TabContent>

                    <TabContent value="contact">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Primary Phone</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.phone1}
                                            onChange={(e) => setEditForm({ ...editForm, phone1: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.phone1}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Secondary Phone</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.phone2}
                                            onChange={(e) => setEditForm({ ...editForm, phone2: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.phone2 || "N/A"}</p>
                                    )}
                                </div>
                                <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Mailing Address</label>
                                    {isEditing ? (
                                        <textarea
                                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:outline-none focus:ring-primary/20 mt-1"
                                            value={editForm.address}
                                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                        />
                                    ) : (
                                        <div className="flex items-start gap-2 mt-1">
                                            <LocationOn className="text-slate-300 mt-0.5" style={{ fontSize: '16px' }} />
                                            <p className="text-sm font-semibold text-slate-800 leading-relaxed italic">
                                                {customer.address || "No address provided"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center h-32 opacity-30 space-y-2 border-t border-slate-100 pt-6">
                                <History style={{ fontSize: '24px' }} />
                                <p className="text-xs font-bold tracking-widest">No recent support tickets</p>
                            </div>
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}
