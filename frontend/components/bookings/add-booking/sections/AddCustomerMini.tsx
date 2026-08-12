"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Person, Close } from "@mui/icons-material";
import { useCreateCustomerMutation } from "@/services/api";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface AddCustomerMiniProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: number | string, name: string, email: string, phone?: string) => void;
}

export function AddCustomerMini({ isOpen, onClose, onCreated }: AddCustomerMiniProps) {
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const result = await createCustomer({
        name,
        phone1: phone,
        email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@temp.placeholder`,
        status: "Active",
      }).unwrap();

      toast.success("Customer created!");
      onCreated(result.id, result.name || name, result.email, result.phone1);
      setName("");
      setPhone("");
      setEmail("");
      onClose();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string } };
      toast.error(error?.data?.error || "Failed to create customer");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <form
            onSubmit={handleSubmit}
            className="mt-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Person style={{ fontSize: "14px" }} className="text-primary" />
                </div>
                <span className="text-xs font-bold text-slate-700">Quick Add Customer</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-600"
                onClick={onClose}
              >
                <Close style={{ fontSize: "14px" }} />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                required
                placeholder="Full Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs font-medium border-slate-200 bg-white rounded-lg col-span-2"
              />
              <Input
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs font-medium border-slate-200 bg-white rounded-lg"
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs font-medium border-slate-200 bg-white rounded-lg"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isLoading}
                className="h-8 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm"
              >
                {isLoading ? "Creating..." : "Create & Select"}
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
