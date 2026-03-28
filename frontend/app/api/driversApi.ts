import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Driver } from "../types";

const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://rosteringsystem-crm-production.up.railway.app/";

export const driversApi = createApi({
    reducerPath: "driversApi",
    baseQuery: fetchBaseQuery({ baseUrl, credentials: "include" }),
    tagTypes: ["Driver"],
    endpoints: (builder) => ({
        getDrivers: builder.query<Driver[], void>({
            query: () => "users?roles=DRIVER",
            providesTags: ["Driver"],
        }),

        getDriverById: builder.query<Driver, number | string>({
            query: (id) => `users/${id}`,
            providesTags: (result, error, id) => [{ type: "Driver", id }],
        }),

        createDriver: builder.mutation<Driver, Partial<Driver>>({
            query: (body) => ({
                url: "users",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Driver"],
        }),

        updateDriver: builder.mutation<Driver, { id: number | string; data: Partial<Driver> }>({
            query: ({ id, data }) => ({
                url: `users/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Driver", id },
                "Driver",
            ],
        }),

        deleteDriver: builder.mutation<{ success: boolean; id: number | string }, number | string>({
            query: (id) => ({
                url: `users/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Driver"],
        }),
    }),
});

export const {
    useGetDriversQuery,
    useGetDriverByIdQuery,
    useCreateDriverMutation,
    useUpdateDriverMutation,
    useDeleteDriverMutation,
} = driversApi;
