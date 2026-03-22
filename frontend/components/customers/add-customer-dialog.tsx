import React, { useState } from 'react';
import { useCreateCustomerMutation } from '@/app/api/customersApi';
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";

export function AddCustomerDialog() {
    const [createCustomer, { isLoading }] = useCreateCustomerMutation();
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone1: '',
        phone2: '',
        company: '',
        address: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createCustomer({
                ...formData,
                status: 'Active',
            }).unwrap();
            setIsOpen(false);
            setFormData({
                name: '',
                email: '',
                phone1: '',
                phone2: '',
                company: '',
                address: '',
            });
            toast.success("Customer added successfully!");
        } catch (e) {
            const error = e as { data?: { error?: string } };
            console.error("Failed to add customer:", e);
            const errorMessage = error?.data?.error || "Failed to add customer.";
            toast.error(errorMessage);
        }
    };

    return (
        <DialogBox
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Add New Customer"
            maxWidth="sm:max-w-[500px]"
            trigger={
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
                    <Add style={{ fontSize: '18px' }} />
                    <span className="font-semibold">Add Customer</span>
                </Button>
            }
            contentClassName="p-0"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Full Name</label>
                    <Input
                        required
                        placeholder="e.g. Emily Watson"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
                    <Input
                        type="email"
                        required
                        placeholder="emily@example.com"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Primary Phone</label>
                    <Input
                        required
                        placeholder="+61 400 000 000"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.phone1}
                        onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Phone Number 2 (Optional)</label>
                        <Input
                            placeholder="+61 400 000 000"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.phone2}
                            onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 ml-1">Company</label>
                        <Input
                            placeholder="e.g. Acme Corp"
                            className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 ml-1">Mailing Address</label>
                    <Input
                        placeholder="e.g. 123 Business St, Sydney"
                        className="rounded-xl border-slate-200 h-12 focus:ring-primary/20 bg-slate-50/50"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                </div>

                <div className="pt-4">
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 text-base font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {isLoading ? "Registering..." : "Register Customer"}
                    </Button>
                </div>
            </form>
        </DialogBox>
    );
}
