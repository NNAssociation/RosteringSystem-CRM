"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Add, FlightTakeoff } from "@mui/icons-material";
import { useCreateBookingMutation } from "@/services/api";
import { toast } from "react-hot-toast";
import { BookingCategoryTabs } from "./BookingCategoryTabs";
import { BookingForm } from "./BookingForm";
import { BookingModalFooter } from "./BookingModalFooter";
import { useBookingForm } from "./hooks/useBookingForm";
import type { BookingCategory } from "@/types";

export function BookingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [createBooking] = useCreateBookingMutation();
  const {
    formData,
    errors,
    isSubmitting,
    setField,
    setLocation,
    setCustomer,
    clearCustomer,
    setCategory,
    toggleRepeatDay,
    setSubmitting,
    resetForm,
    validate,
    isEstimating,
  } = useBookingForm();

  const handleCategoryChange = useCallback(
    (cat: BookingCategory) => {
      setCategory(cat);
    },
    [setCategory]
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Transform form data to API payload
      const payload: Record<string, unknown> = {
        bookingType: formData.bookingType,
        customerEmail: formData.customerEmail,
        customerName: formData.customerName,
        customerId: formData.customerId ? Number(formData.customerId) : undefined,
        subject: formData.subject || "Standard Booking",
        bookingDetails: formData.notes,
        pickupLocation: formData.pickupLocation.address,
        dropoffLocation: formData.dropLocation.address,
        date: formData.pickupDate,
        startTime: formData.pickupTime,
        endTime: formData.calculatedEndTime,
        passengerCount: formData.paxCount,
        noOfVehicles: formData.busCount,
        status: "Pending",
        // Structured location data
        pickupLat: formData.pickupLocation.lat,
        pickupLng: formData.pickupLocation.lng,
        pickupPlaceId: formData.pickupLocation.placeId,
        dropoffLat: formData.dropLocation.lat,
        dropoffLng: formData.dropLocation.lng,
        dropoffPlaceId: formData.dropLocation.placeId,
      };

      // Round trip additions
      if (formData.bookingType === "round_trip") {
        payload.returnDate = formData.returnDate;
        payload.returnTime = formData.returnTime;
        payload.waitingDuration = formData.waitingDuration;
      }

      // Repeatable additions
      if (formData.bookingType === "repeatable") {
        payload.recurrenceRule = {
          type: formData.repeatType,
          days: formData.repeatDays,
          startDate: formData.repeatStartDate,
          endDate: formData.repeatEndDate,
        };
      }

      await createBooking(payload).unwrap();
      toast.success("Booking created successfully!");
      setIsOpen(false);
      resetForm();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string } };
      toast.error(error?.data?.error || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  }, [formData, validate, createBooking, setSubmitting, resetForm]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 rounded-xl px-6 gap-2 border-none h-11 transition-all active:scale-[0.98]">
          <Add style={{ fontSize: "18px" }} />
          <span className="font-semibold">Add Booking</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="rounded-3xl border-none shadow-2xl bg-white p-0 overflow-hidden sm:max-w-[780px]"
        showCloseButton={true}
      >
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-slate-50 to-white px-6 pt-6 pb-0 border-b-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <FlightTakeoff style={{ fontSize: "20px" }} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                Create Booking
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Configure your trip details below
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Category Tabs */}
        <BookingCategoryTabs
          activeCategory={formData.bookingType}
          onChange={handleCategoryChange}
        />

        {/* Dynamic Form Body */}
        <BookingForm
          formData={formData}
          errors={errors}
          setField={setField}
          setLocation={setLocation}
          setCustomer={setCustomer}
          clearCustomer={clearCustomer}
          toggleRepeatDay={toggleRepeatDay}
          isEstimating={isEstimating}
        />

        {/* Footer */}
        <BookingModalFooter
          isSubmitting={isSubmitting}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
