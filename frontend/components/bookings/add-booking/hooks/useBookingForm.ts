"use client";

import { useReducer, useCallback, useEffect } from "react";
import type { BookingCategory, BookingFormData, StructuredLocation } from "@/types";
import { DEFAULT_FORM_DATA } from "../config/booking.config";
import { getSchemaForType, type FieldErrors } from "../validation/booking.validation";

// ── State ─────────────────────────────────────────────────

interface BookingFormState {
  data: BookingFormData;
  errors: FieldErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isEstimating: boolean;
}

const initialState: BookingFormState = {
  data: DEFAULT_FORM_DATA as BookingFormData,
  errors: {},
  touched: {},
  isSubmitting: false,
  isEstimating: false,
};

// ── Actions ───────────────────────────────────────────────

type Action =
  | { type: "SET_FIELD"; field: string; value: unknown }
  | { type: "SET_LOCATION"; field: "pickupLocation" | "dropLocation"; value: StructuredLocation }
  | { type: "SET_CUSTOMER"; customerId: number | string; name: string; email: string; phone?: string }
  | { type: "CLEAR_CUSTOMER" }
  | { type: "SET_CATEGORY"; category: BookingCategory }
  | { type: "SET_ERRORS"; errors: FieldErrors }
  | { type: "SET_TOUCHED"; field: string }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "TOGGLE_REPEAT_DAY"; day: number }
  | { type: "SET_ESTIMATES"; duration: number; distance: string; endTime: string }
  | { type: "SET_ESTIMATING"; value: boolean }
  | { type: "RESET" };

// ── Reducer ───────────────────────────────────────────────

function reducer(state: BookingFormState, action: Action): BookingFormState {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };

    case "SET_LOCATION":
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };

    case "SET_CUSTOMER":
      return {
        ...state,
        data: {
          ...state.data,
          customerId: action.customerId,
          customerName: action.name,
          customerEmail: action.email,
          customerPhone: action.phone || "",
        },
        errors: {
          ...state.errors,
          customerName: undefined,
          customerEmail: undefined,
        },
      };

    case "CLEAR_CUSTOMER":
      return {
        ...state,
        data: {
          ...state.data,
          customerId: undefined,
          customerName: "",
          customerEmail: "",
          customerPhone: "",
        },
      };

    case "SET_CATEGORY":
      return {
        ...state,
        data: {
          ...DEFAULT_FORM_DATA,
          bookingType: action.category,
        },
        errors: {},
        touched: {},
      };

    case "SET_ERRORS":
      return { ...state, errors: action.errors };

    case "SET_TOUCHED":
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
      };

    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value };

    case "TOGGLE_REPEAT_DAY": {
      const days = state.data.repeatDays || [];
      const newDays = days.includes(action.day)
        ? days.filter((d) => d !== action.day)
        : [...days, action.day].sort();
      return {
        ...state,
        data: { ...state.data, repeatDays: newDays },
      };
    }

    case "SET_ESTIMATES":
      return {
        ...state,
        data: {
          ...state.data,
          estimatedDuration: action.duration,
          estimatedDistance: action.distance,
          calculatedEndTime: action.endTime,
        },
      };

    case "SET_ESTIMATING":
      return { ...state, isEstimating: action.value };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────

export function useBookingForm() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setField = useCallback((field: string, value: unknown) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const setLocation = useCallback(
    (field: "pickupLocation" | "dropLocation", value: StructuredLocation) => {
      dispatch({ type: "SET_LOCATION", field, value });
    },
    []
  );

  const setCustomer = useCallback(
    (customerId: number | string, name: string, email: string, phone?: string) => {
      dispatch({ type: "SET_CUSTOMER", customerId, name, email, phone });
    },
    []
  );

  const clearCustomer = useCallback(() => {
    dispatch({ type: "CLEAR_CUSTOMER" });
  }, []);

  const setCategory = useCallback((category: BookingCategory) => {
    dispatch({ type: "SET_CATEGORY", category });
  }, []);

  const toggleRepeatDay = useCallback((day: number) => {
    dispatch({ type: "TOGGLE_REPEAT_DAY", day });
  }, []);

  const setSubmitting = useCallback((value: boolean) => {
    dispatch({ type: "SET_SUBMITTING", value });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const validate = useCallback((): boolean => {
    const schema = getSchemaForType(state.data.bookingType);
    const result = schema.safeParse(state.data);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      dispatch({ type: "SET_ERRORS", errors: fieldErrors });
      return false;
    }

    dispatch({ type: "SET_ERRORS", errors: {} });
    return true;
  }, [state.data]);

  // ── Effects ──────────────────────────────────────────────
  
  // Calculate travel time and end time when locations change
  useEffect(() => {
    const pickup = state.data.pickupLocation;
    const drop = state.data.dropLocation;

    if (pickup.lat && pickup.lng && drop.lat && drop.lng && typeof window !== "undefined" && window.google) {
      dispatch({ type: "SET_ESTIMATING", value: true });
      const service = new window.google.maps.DistanceMatrixService();
      
      service.getDistanceMatrix(
        {
          origins: [{ lat: pickup.lat, lng: pickup.lng }],
          destinations: [{ lat: drop.lat, lng: drop.lng }],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response: any, status: string) => {
          if (status === "OK" && response.rows[0].elements[0].status === "OK") {
            const element = response.rows[0].elements[0];
            const durationInSeconds = element.duration.value;
            const durationInMinutes = Math.ceil(durationInSeconds / 60);
            const distanceText = element.distance.text;

            // Calculate End Time
            if (state.data.pickupTime) {
              const [hours, minutes] = state.data.pickupTime.split(":").map(Number);
              const date = new Date();
              date.setHours(hours, minutes, 0);
              date.setMinutes(date.getMinutes() + durationInMinutes);
              
              const calculatedEndTime = date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });

              dispatch({
                type: "SET_ESTIMATES",
                duration: durationInMinutes,
                distance: distanceText,
                endTime: calculatedEndTime,
              });
            }
          }
          dispatch({ type: "SET_ESTIMATING", value: false });
        }
      );
    }
  }, [
    state.data.pickupLocation.lat, 
    state.data.pickupLocation.lng, 
    state.data.dropLocation.lat, 
    state.data.dropLocation.lng,
    state.data.pickupTime
  ]);

  return {
    formData: state.data,
    errors: state.errors,
    touched: state.touched,
    isSubmitting: state.isSubmitting,
    isEstimating: state.isEstimating,
    setField,
    setLocation,
    setCustomer,
    clearCustomer,
    setCategory,
    toggleRepeatDay,
    setSubmitting,
    resetForm,
    validate,
  };
}
