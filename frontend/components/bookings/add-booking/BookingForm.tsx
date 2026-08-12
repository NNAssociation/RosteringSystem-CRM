"use client";

import React, { useState } from "react";
import { BOOKING_CATEGORIES, type SectionId } from "./config/booking.config";
import { CustomerSelector } from "./sections/CustomerSelector";
import { AddCustomerMini } from "./sections/AddCustomerMini";
import { LocationPicker } from "./sections/LocationPicker";
import { DateTimeSection } from "./sections/DateTimeSection";
import { RepeatBookingSection } from "./sections/RepeatBookingSection";
import { PassengerPlanner } from "./sections/PassengerPlanner";
import { NotesSection } from "./sections/NotesSection";
import type { BookingFormData, RepeatType, StructuredLocation } from "@/types";
import type { FieldErrors } from "./validation/booking.validation";
import { motion, AnimatePresence } from "framer-motion";

interface BookingFormProps {
  formData: BookingFormData;
  errors: FieldErrors;
  setField: (field: string, value: unknown) => void;
  setLocation: (field: "pickupLocation" | "dropLocation", value: StructuredLocation) => void;
  setCustomer: (id: number | string, name: string, email: string, phone?: string) => void;
  clearCustomer: () => void;
  toggleRepeatDay: (day: number) => void;
  isEstimating: boolean;
}

export function BookingForm({
  formData,
  errors,
  setField,
  setLocation,
  setCustomer,
  clearCustomer,
  toggleRepeatDay,
  isEstimating,
}: BookingFormProps) {
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // Get sections for current booking type from config
  const config = BOOKING_CATEGORIES.find((c) => c.id === formData.bookingType);
  const sections: SectionId[] = config?.sections || [];

  const renderSection = (section: SectionId) => {
    switch (section) {
      case "customer":
        return (
          <div key="customer">
            <CustomerSelector
              customerName={formData.customerName}
              customerEmail={formData.customerEmail}
              customerId={formData.customerId}
              error={errors.customerName || errors.customerEmail}
              onSelect={(id, name, email, phone) => {
                setCustomer(id, name, email, phone);
                setShowAddCustomer(false);
              }}
              onClear={clearCustomer}
              onAddNew={() => setShowAddCustomer(true)}
            />
            <AddCustomerMini
              isOpen={showAddCustomer}
              onClose={() => setShowAddCustomer(false)}
              onCreated={(id, name, email, phone) => {
                setCustomer(id, name, email, phone);
                setShowAddCustomer(false);
              }}
            />
          </div>
        );

      case "locations":
        return (
          <div key="locations" className="space-y-3">
            <LocationPicker
              label="Pickup Location"
              value={formData.pickupLocation}
              onChange={(loc) => setLocation("pickupLocation", loc)}
              error={errors["pickupLocation.address"] || errors.pickupLocation}
              placeholder="Enter pickup address..."
            />
            <LocationPicker
              label="Drop-off Location"
              value={formData.dropLocation}
              onChange={(loc) => setLocation("dropLocation", loc)}
              error={errors["dropLocation.address"] || errors.dropLocation}
              placeholder="Enter drop-off address..."
            />
          </div>
        );

      case "datetime":
        return (
          <DateTimeSection
            key="datetime"
            pickupDate={formData.pickupDate}
            pickupTime={formData.pickupTime}
            onPickupDateChange={(v) => setField("pickupDate", v)}
            onPickupTimeChange={(v) => setField("pickupTime", v)}
            pickupDateError={errors.pickupDate}
            pickupTimeError={errors.pickupTime}
            estimatedDuration={formData.estimatedDuration}
            estimatedDistance={formData.estimatedDistance}
            calculatedEndTime={formData.calculatedEndTime}
            isEstimating={isEstimating}
          />
        );

      case "return_datetime":
        return (
          <DateTimeSection
            key="return_datetime"
            pickupDate={formData.pickupDate}
            pickupTime={formData.pickupTime}
            onPickupDateChange={(v) => setField("pickupDate", v)}
            onPickupTimeChange={(v) => setField("pickupTime", v)}
            pickupDateError={errors.pickupDate}
            pickupTimeError={errors.pickupTime}
            showReturn
            returnDate={formData.returnDate}
            returnTime={formData.returnTime}
            waitingDuration={formData.waitingDuration}
            onReturnDateChange={(v) => setField("returnDate", v)}
            onReturnTimeChange={(v) => setField("returnTime", v)}
            onWaitingDurationChange={(v) => setField("waitingDuration", v)}
            returnDateError={errors.returnDate}
            returnTimeError={errors.returnTime}
            estimatedDuration={formData.estimatedDuration}
            estimatedDistance={formData.estimatedDistance}
            calculatedEndTime={formData.calculatedEndTime}
            isEstimating={isEstimating}
          />
        );

      case "recurrence":
        return (
          <RepeatBookingSection
            key="recurrence"
            repeatType={formData.repeatType}
            repeatDays={formData.repeatDays || []}
            repeatStartDate={formData.repeatStartDate || ""}
            repeatEndDate={formData.repeatEndDate || ""}
            onRepeatTypeChange={(t) => setField("repeatType", t)}
            onToggleDay={toggleRepeatDay}
            onStartDateChange={(d) => setField("repeatStartDate", d)}
            onEndDateChange={(d) => setField("repeatEndDate", d)}
            errors={errors}
          />
        );

      case "transport":
        return (
          <PassengerPlanner
            key="transport"
            paxCount={formData.paxCount}
            busCount={formData.busCount}
            onPaxChange={(v) => setField("paxCount", v)}
            onBusChange={(v) => setField("busCount", v)}
            paxError={errors.paxCount}
            busError={errors.busCount}
          />
        );

      case "notes":
        return (
          <NotesSection
            key="notes"
            subject={formData.subject || ""}
            notes={formData.notes || ""}
            onSubjectChange={(v) => setField("subject", v)}
            onNotesChange={(v) => setField("notes", v)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={formData.bookingType}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2 }}
        className="space-y-6 p-6 overflow-y-auto max-h-[calc(80vh-200px)]"
      >
        {sections.map((section) => renderSection(section))}
      </motion.div>
    </AnimatePresence>
  );
}
