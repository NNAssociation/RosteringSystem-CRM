import { RecordLifecycleActions } from "@/components/shared/record-lifecycle-actions";
import { RecordStatusBadge, InactiveRecordNotice } from "@/components/shared/record-status";
import React, { useState, useEffect } from 'react';
import { useUpdateCustomerMutation, useDeleteCustomerMutation, useGetCustomerByIdQuery } from '@/services/api';
import { Customer, ApiResponseError } from '@/types';
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
    Person,
    LocationOn,
    Receipt
} from "@mui/icons-material";
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

export function CustomerDetailsPanel({ customer: suppliedCustomer, onClose }: CustomerDetailsPanelProps) {
    const { currentData: freshCustomer } = useGetCustomerByIdQuery(suppliedCustomer?.id ?? 0, { skip: !suppliedCustomer });
    const customer = freshCustomer ?? suppliedCustomer;
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
        customerType: 'INDIVIDUAL',
        contactName: '',
        contactRole: '',
        taxId: '',
        preferredPaymentMethod: 'CREDIT_CARD',
        paymentTerms: 'DUE_ON_RECEIPT',
        internalNotes: '',
        isVip: false,
        accountStanding: 'GOOD',
        isActive: true,
    });

    const hydratedId = React.useRef(customer?.id);
    useEffect(() => {
        if (isEditing && hydratedId.current === customer?.id) return;
        hydratedId.current = customer?.id;
        if (customer) {
            setEditForm({
                name: customer.name || '',
                email: customer.email || '',
                phone1: customer.phone1 || '',
                phone2: customer.phone2 || '',
                company: customer.company || '',
                address: customer.address || '',
                customerType: customer.customerType || 'INDIVIDUAL',
                contactName: customer.contactName || '',
                contactRole: customer.contactRole || '',
                taxId: customer.taxId || '',
                preferredPaymentMethod: customer.preferredPaymentMethod || 'CREDIT_CARD',
                paymentTerms: customer.paymentTerms || 'DUE_ON_RECEIPT',
                internalNotes: customer.internalNotes || '',
                isVip: customer.isVip || false,
                accountStanding: customer.accountStanding || 'GOOD',
                isActive: customer.isActive !== undefined ? customer.isActive : true,
            });
            setIsEditing(false);
        }
    }, [customer, isEditing]);

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


    const isEditEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim());
    const isEditValid = Boolean(
        editForm.name.trim().length >= 2 &&
        isEditEmailValid &&
        editForm.phone1.trim().length >= 6
    );

    const footer = (
        <div className="flex flex-col gap-4 p-6 border-t border-slate-100 bg-white">
            {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={isUpdating || !isEditValid}
                        className="rounded-xl h-12 gap-2 bg-slate-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold border-none transition-all active:scale-95 shadow-lg shadow-slate-200"
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
                    <RecordLifecycleActions resource="customers" id={customer.id} inactive={!customer.isActive} onDeleted={onClose} />
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: "general", label: "General", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "contact", label: "Contact", icon: <LocationOn style={{ fontSize: '16px' }} /> },
        { id: "billing", label: "Billing & Notes", icon: <Receipt style={{ fontSize: '16px' }} /> },
    ];

    const selectClassName = "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <SidePanel
            isOpen={!!customer}
            onClose={onClose}
            title={`Customer Profile`}
            badge={
                <div className="flex gap-2">
                    <RecordStatusBadge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
                    {customer.isVip && (
                        <Badge className="bg-amber-100 text-amber-700 font-semibold px-2 py-1 rounded-lg text-xs border-none shadow-none">
                            VIP
                        </Badge>
                    )}
                </div>
            }
            footer={footer}
            contentClassName="p-0 flex flex-col h-full overflow-hidden"
            className="w-full max-w-none"
        >
            <div className="flex flex-col h-full overflow-hidden">{!customer.isActive && <InactiveRecordNotice />}
                {/* Visual Header (Always Visible) */}
                <div className="p-6 pb-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{customer.name}</h3>
                        <p className="text-xs font-medium text-slate-500 font-mono italic">{customer.email}</p>
                    </div>
                </div>

                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden">
                    
                    {/* GENERAL TAB */}
                    <TabContent value="general" className="p-4 overflow-y-auto">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Full Name (or Org Name)</label>
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
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.company || "N/A"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Customer Type</label>
                                    {isEditing ? (
                                        <select 
                                            className={selectClassName}
                                            value={editForm.customerType}
                                            onChange={(e) => setEditForm({ ...editForm, customerType: e.target.value })}
                                        >
                                            <option value="INDIVIDUAL">Individual</option>
                                            <option value="ORGANIZATION">Organization</option>
                                            <option value="CORPORATE">Corporate</option>
                                            <option value="TRAVEL_AGENT">Travel Agent</option>
                                            <option value="SCHOOL">School</option>
                                            <option value="COMMUNITY_GROUP">Community Group</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1 capitalize">{customer.customerType?.toLowerCase().replace('_', ' ') || "Individual"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Account Standing</label>
                                    {isEditing ? (
                                        <select 
                                            className={selectClassName}
                                            value={editForm.accountStanding}
                                            onChange={(e) => setEditForm({ ...editForm, accountStanding: e.target.value })}
                                        >
                                            <option value="GOOD">Good</option>
                                            <option value="WARNING">Warning</option>
                                            <option value="SUSPENDED">Suspended</option>
                                        </select>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1 capitalize">{customer.accountStanding?.toLowerCase() || "Good"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Status</label>
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 mt-2 ml-1">
                                            <input 
                                                type="checkbox" 
                                                checked={editForm.isActive}
                                                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-semibold text-slate-900">Active</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.isActive ? "Active" : "Deactivated"}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">VIP Status</label>
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 mt-2 ml-1">
                                            <input 
                                                type="checkbox" 
                                                checked={editForm.isVip}
                                                onChange={(e) => setEditForm({ ...editForm, isVip: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-semibold text-slate-900">VIP Customer</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.isVip ? "Yes" : "No"}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    {/* CONTACT TAB */}
                    <TabContent value="contact" className="p-4 overflow-y-auto">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
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
                                
                                <div className="col-span-2 pt-2 border-t border-slate-100">
                                    <h4 className="text-sm font-semibold text-slate-700">Primary Contact Person</h4>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Contact Name</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.contactName}
                                            onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.contactName || "N/A"}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Contact Role</label>
                                    {isEditing ? (
                                        <Input
                                            value={editForm.contactRole}
                                            onChange={(e) => setEditForm({ ...editForm, contactRole: e.target.value })}
                                            className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        />
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 ml-1">{customer.contactRole || "N/A"}</p>
                                    )}
                                </div>

                                <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100 mt-2">
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
                        </div>
                    </TabContent>
                    
                    {/* BILLING & NOTES TAB */}
                    <TabContent value="billing" className="p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Tax ID / ABN</label>
                                {isEditing ? (
                                    <Input
                                        value={editForm.taxId}
                                        onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1">{customer.taxId || "N/A"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Payment Method</label>
                                {isEditing ? (
                                    <select 
                                        className={selectClassName}
                                        value={editForm.preferredPaymentMethod}
                                        onChange={(e) => setEditForm({ ...editForm, preferredPaymentMethod: e.target.value })}
                                    >
                                        <option value="CREDIT_CARD">Credit Card</option>
                                        <option value="INVOICE">Invoice</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1 capitalize">{customer.preferredPaymentMethod?.toLowerCase().replace('_', ' ') || "N/A"}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 ml-1">Payment Terms</label>
                                {isEditing ? (
                                    <select 
                                        className={selectClassName}
                                        value={editForm.paymentTerms}
                                        onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                                    >
                                        <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                                        <option value="NET_15">Net 15</option>
                                        <option value="NET_30">Net 30</option>
                                        <option value="NET_60">Net 60</option>
                                    </select>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1 capitalize">{customer.paymentTerms?.toLowerCase().replace('_', ' ') || "N/A"}</p>
                                )}
                            </div>

                            <div className="col-span-2 border-b border-slate-100 pb-2 mt-4">
                                <h4 className="text-sm font-semibold text-slate-700">Internal Notes</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                {isEditing ? (
                                    <textarea
                                        value={editForm.internalNotes}
                                        onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                                        className="flex w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 min-h-[80px]"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-slate-900 ml-1 whitespace-pre-wrap">{customer.internalNotes || "No internal notes."}</p>
                                )}
                            </div>
                        </div>
                    </TabContent>
                </Tabs>
            </div>
        </SidePanel>
    );
}
