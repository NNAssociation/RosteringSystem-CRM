import React, { useState } from 'react';
import { useCreateCustomerMutation } from '@/services/api';
import { ApiResponseError } from '@/types';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add, Person, LocationOn } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { Tabs, TabContent } from "@/components/ui/tabs";

export function AddCustomerDialog() {
    const [createCustomer, { isLoading }] = useCreateCustomerMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("general");

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone1: '',
        phone2: '',
        company: '',
        address: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone1: '',
            phone2: '',
            company: '',
            address: '',
        });
        setActiveTab("general");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createCustomer({
                ...formData,
                status: 'Active',
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

    const tabs = [
        { id: "general", label: "General", icon: <Person style={{ fontSize: '16px' }} /> },
        { id: "contact", label: "Contact", icon: <LocationOn style={{ fontSize: '16px' }} /> },
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
            <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden" contentClassName="p-6 overflow-y-auto">
                    <TabContent value="general" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Full Name</label>
                                    <Input
                                        required
                                        placeholder="e.g. Emily Watson"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Company</label>
                                    <Input
                                        placeholder="e.g. Acme Corp"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabContent>

                    <TabContent value="contact" className="p-0 pb-4">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Email Address</label>
                                    <Input
                                        type="email"
                                        required
                                        placeholder="emily@example.com"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Primary Phone</label>
                                    <Input
                                        required
                                        placeholder="+61 400 000 000"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.phone1}
                                        onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Secondary Phone</label>
                                    <Input
                                        placeholder="+61 400 000 000"
                                        className="h-10 text-xs font-semibold border-slate-200 bg-slate-50/50 rounded-xl"
                                        value={formData.phone2}
                                        onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-400 ml-1">Mailing Address</label>
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
                                {isLoading ? "Registering..." : "Register Customer"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </DialogBox>
    );
}
