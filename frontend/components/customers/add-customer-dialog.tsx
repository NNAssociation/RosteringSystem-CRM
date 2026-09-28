import React, { useState } from 'react';
import { useCreateCustomerMutation } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, Person, LocationOn, Receipt } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";

export function AddCustomerDialog() {
    const [createCustomer, { isLoading }] = useCreateCustomerMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [maxUnlockedIndex, setMaxUnlockedIndex] = useState(0);

    const [formData, setFormData] = useState({
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
    });

    const resetForm = () => {
        setFormData({
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
        });
        setActiveTab("general");
        setMaxUnlockedIndex(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        if (activeTab !== "billing" || submitter?.getAttribute("data-final-save") !== "true" || isLoading || !isFormComplete) return;
        // Guard: Never auto-save before reaching the final Billing & Notes tab!
        if (activeTab !== "billing") {
            handleNext();
            return;
        }
        try {
            await createCustomer({
                ...formData,
                isActive: true,
            }).unwrap();
            setIsOpen(false);
            resetForm();
            toast.success("Customer added successfully!");
        } catch (error: unknown) {
            console.error("Failed to add customer:", error);
            const errorMessage = (error as ApiResponseError)?.data?.error || "Failed to add customer.";
            toast.error(errorMessage);
        }
    };

    const baseTabs = [
        { id: "general", label: "General", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "contact", label: "Contact", icon: <LocationOn style={{ fontSize: '16px' }} /> },
        { id: "billing", label: "Billing & Notes", icon: <Receipt style={{ fontSize: '16px' }} /> },
    ];

    const tabs = baseTabs;

    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    const isLastTab = currentIndex === tabs.length - 1;

    const handleNext = () => {
        if (!isCurrentTabValid() || isLoading) return;
        if (!isCurrentTabValid()) return;
        const nextIdx = currentIndex + 1;
        if (nextIdx < tabs.length) {
            setMaxUnlockedIndex(index => Math.max(index, nextIdx));
            setActiveTab(tabs[nextIdx].id);
        }
    };

    const selectClassName = "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    // Reactive validation rules
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
    const isGeneralValid = formData.name.trim().length >= 2;
    const isContactValid = isEmailValid && formData.phone1.trim().length >= 6;
    const isBillingValid = true;

    const isCurrentTabValid = () => {
        switch (activeTab) {
            case "general": return isGeneralValid;
            case "contact": return isContactValid;
            case "billing": return isBillingValid;
            default: return false;
        }
    };

    const isFormComplete = isGeneralValid && isContactValid && isBillingValid;

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) resetForm();
            }}
            title="Add New Customer"
            maxWidth="sm:max-w-[600px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Customer</span>
                </Button>
            }
            contentClassName="p-0 overflow-hidden flex flex-col"
        >
            <form 
                onSubmit={handleSubmit} 
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && activeTab !== 'billing') {
                        e.preventDefault();
                        handleNext();
                    }
                }}
                className="flex flex-col h-full max-h-[85vh]"
            >
                <Tabs tabs={tabs.map((tab, index) => ({ ...tab, disabled: index > maxUnlockedIndex }))} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    
                    {/* GENERAL TAB */}
                    <TabContent value="general" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">
                                        Full Name (or Org Name) <span className="text-rose-500">*</span>
                                    </label>
                                    <Input
                                        required
                                        placeholder="e.g. Emily Watson / Acme Corp"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    {formData.name.length > 0 && formData.name.trim().length < 2 && (
                                        <p className="text-[11px] text-rose-500 font-medium ml-1">Name must be at least 2 characters</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Company</label>
                                    <Input
                                        placeholder="e.g. Acme Corp"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Customer Type</label>
                                    <select 
                                        className={selectClassName}
                                        value={formData.customerType}
                                        onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                                    >
                                        <option value="INDIVIDUAL">Individual</option>
                                        <option value="ORGANIZATION">Organization</option>
                                        <option value="CORPORATE">Corporate</option>
                                        <option value="TRAVEL_AGENT">Travel Agent</option>
                                        <option value="SCHOOL">School</option>
                                        <option value="COMMUNITY_GROUP">Community Group</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Account Standing</label>
                                    <select 
                                        className={selectClassName}
                                        value={formData.accountStanding}
                                        onChange={(e) => setFormData({ ...formData, accountStanding: e.target.value })}
                                    >
                                        <option value="GOOD">Good</option>
                                        <option value="WARNING">Warning</option>
                                        <option value="SUSPENDED">Suspended</option>
                                    </select>
                                </div>
                                <div className="space-y-2 flex items-center mt-6">
                                    <input 
                                        type="checkbox" 
                                        id="isVip"
                                        className="mr-2 h-4 w-4 rounded border-slate-300"
                                        checked={formData.isVip}
                                        onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                                    />
                                    <label htmlFor="isVip" className="text-sm font-semibold text-slate-700">VIP Customer</label>
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    {/* CONTACT TAB */}
                    <TabContent value="contact" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">
                                        Email Address <span className="text-rose-500">*</span>
                                    </label>
                                    <Input
                                        type="email"
                                        required
                                        placeholder="emily@example.com"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    {formData.email.length > 0 && !isEmailValid && (
                                        <p className="text-[11px] text-rose-500 font-medium ml-1">Please enter a valid email address</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 ml-1">
                                        Primary Phone <span className="text-rose-500">*</span>
                                    </label>
                                    <Input
                                        required
                                        placeholder="+61 400 000 000"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.phone1}
                                        onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                                    />
                                    {formData.phone1.length > 0 && formData.phone1.trim().length < 6 && (
                                        <p className="text-[11px] text-rose-500 font-medium ml-1">At least 6 digits required</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Secondary Phone</label>
                                    <Input
                                        placeholder="+61 400 000 000"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.phone2}
                                        onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1 pt-4 border-t border-slate-100 col-span-2">
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Primary Contact Person</h4>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Contact Name</label>
                                    <Input
                                        placeholder="e.g. John Smith"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Contact Role</label>
                                    <Input
                                        placeholder="e.g. Manager"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.contactRole}
                                        onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                                    />
                                </div>

                                <div className="col-span-2 space-y-1 pt-2 mt-2">
                                    <label className="text-xs font-bold text-slate-600 ml-1">Mailing Address</label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:outline-none focus:ring-primary/20 mt-1"
                                        placeholder="e.g. 123 Business St, Sydney"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    {/* BILLING & NOTES TAB */}
                    <TabContent value="billing" className="p-0 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Tax ID / ABN</label>
                                <Input
                                    placeholder="e.g. 11 222 333 444"
                                    className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                    value={formData.taxId}
                                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Payment Method</label>
                                <select 
                                    className={selectClassName}
                                    value={formData.preferredPaymentMethod}
                                    onChange={(e) => setFormData({ ...formData, preferredPaymentMethod: e.target.value })}
                                >
                                    <option value="CREDIT_CARD">Credit Card</option>
                                    <option value="INVOICE">Invoice</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                    <option value="CASH">Cash</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 ml-1">Payment Terms</label>
                                <select 
                                    className={selectClassName}
                                    value={formData.paymentTerms}
                                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                >
                                    <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                                    <option value="NET_15">Net 15</option>
                                    <option value="NET_30">Net 30</option>
                                    <option value="NET_60">Net 60</option>
                                </select>
                            </div>

                            <div className="col-span-2 border-b border-slate-100 pb-2 mt-4">
                                <h4 className="text-sm font-semibold text-slate-700">Internal Notes</h4>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <textarea
                                    className="flex w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 min-h-[80px]"
                                    placeholder="Add any internal notes about this customer..."
                                    value={formData.internalNotes}
                                    onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                                />
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
                        <span className="self-center text-xs text-slate-500">Step {currentIndex + 1} of {tabs.length}</span>
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
                                key="next-step"
                                type="button"
                                disabled={!isCurrentTabValid()}
                                onClick={handleNext}
                                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white rounded-xl h-11 px-6 font-semibold shadow-md active:scale-[0.98] transition-all"
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                key="final-save"
                                data-final-save="true"
                                type="submit"
                                disabled={!isFormComplete || isLoading}
                                className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl h-11 px-6 font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isLoading ? "Registering..." : "Register Customer"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}
