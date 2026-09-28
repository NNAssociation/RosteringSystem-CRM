import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "./base-query";
export type Resource = "users" | "customers" | "fleet" | "bookings";
export type DashboardOverview = {
  date: string; timeZone: string; generatedAt: string;
  metrics: { confirmedTripLegs: number; jobsNeedingAllocation: number; activeEmployees: number; activeCustomers: number };
  schedule: { id: number; bookingId: number; customer: string; start: string; end: string; pickup: string; destination: string; status: string; required: number; assigned: number; assignments: { id: number; driver: string; vehicle: string; status: string }[] }[];
  attention: { key: string; kind: string; title: string; detail: string; href: string; tone: string }[];
  fleet: { eligibleActive: number; scheduled: number; maintenance: number; inactive: number; total: number };
};
export const operationsApi = createApi({ reducerPath: "operationsApi", baseQuery, tagTypes: ["Overview", "Eligibility"], endpoints: builder => ({
  getOverview: builder.query<DashboardOverview, string>({ query: date => `dashboard/overview?date=${date}`, providesTags: ["Overview"] }),
  getDeletionEligibility: builder.query<{ eligible: boolean; reasons: string[] }, { resource: Resource; id: number | string }>({ query: ({ resource, id }) => `${resource}/${id}/deletion-eligibility`, providesTags: ["Eligibility"] }),
  changeLifecycle: builder.mutation<{ success: boolean; id: number }, { resource: Resource; id: string | number; permanent: boolean }>({ query: ({ resource, id, permanent }) => ({ url: permanent ? `${resource}/${id}?permanent=true` : `${resource}/${id}/${resource === "bookings" ? "cancel" : "deactivate"}`, method: permanent ? "DELETE" : "POST" }), invalidatesTags: ["Overview", "Eligibility"] }),
}) });
export const { useGetOverviewQuery, useGetDeletionEligibilityQuery, useChangeLifecycleMutation } = operationsApi;
