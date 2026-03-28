import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Booking } from "../types";

const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://rosteringsystem-crm-production.up.railway.app/";

export const bookingsApi = createApi({
    reducerPath: "bookingsApi",
    baseQuery: fetchBaseQuery({ baseUrl, credentials: "include" }),
    tagTypes: ["Booking"],
    endpoints: (builder) => ({
        getBookings: builder.query<Booking[], void>({
            query: () => "bookings",
            providesTags: ["Booking"],
        }),

        getBookingById: builder.query<Booking, number | string>({
            query: (id) => `bookings/${id}`,
            providesTags: (result, error, id) => [{ type: "Booking", id }],
        }),

        createBooking: builder.mutation<Booking, Partial<Booking>>({
            query: (body) => ({
                url: "bookings",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Booking"],
        }),

        updateBooking: builder.mutation<Booking, { id: number | string; data: Partial<Booking> }>({
            query: ({ id, data }) => ({
                url: `bookings/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Booking", id },
                "Booking",
            ],
        }),

        deleteBooking: builder.mutation<{ success: boolean; id: number | string }, number | string>({
            query: (id) => ({
                url: `bookings/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Booking"],
        }),
    }),
});

export const {
    useGetBookingsQuery,
    useGetBookingByIdQuery,
    useCreateBookingMutation,
    useUpdateBookingMutation,
    useDeleteBookingMutation,
} = bookingsApi;
