import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Vehicle } from "../types";

const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://rosteringsystem-crm-production.up.railway.app/";

export const fleetApi = createApi({
    reducerPath: "fleetApi",
    baseQuery: fetchBaseQuery({ baseUrl, credentials: "include" }),
    tagTypes: ["Vehicle"],
    endpoints: (builder) => ({
        getVehicles: builder.query<Vehicle[], void>({
            query: () => "fleet",
            providesTags: ["Vehicle"],
        }),

        getVehicleById: builder.query<Vehicle, number | string>({
            query: (id) => `fleet/${id}`,
            providesTags: (result, error, id) => [{ type: "Vehicle", id }],
        }),

        createVehicle: builder.mutation<Vehicle, Partial<Vehicle>>({
            query: (body) => ({
                url: "fleet",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Vehicle"],
        }),

        updateVehicle: builder.mutation<Vehicle, { id: number | string; data: Partial<Vehicle> }>({
            query: ({ id, data }) => ({
                url: `fleet/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Vehicle", id },
                "Vehicle",
            ],
        }),

        deleteVehicle: builder.mutation<{ success: boolean; id: number | string }, number | string>({
            query: (id) => ({
                url: `fleet/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Vehicle"],
        }),
    }),
});

export const {
    useGetVehiclesQuery,
    useGetVehicleByIdQuery,
    useCreateVehicleMutation,
    useUpdateVehicleMutation,
    useDeleteVehicleMutation,
} = fleetApi;
