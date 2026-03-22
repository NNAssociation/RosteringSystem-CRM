import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Customer } from "../types";

const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://rosteringsystem-crm-production.up.railway.app/";

export const customersApi = createApi({
    reducerPath: "customersApi",
    baseQuery: fetchBaseQuery({ baseUrl: baseUrl }),
    tagTypes: ["Customer"],
    endpoints: (builder) => ({
        getCustomers: builder.query<Customer[], void>({
            query: () => "customers",
            providesTags: ["Customer"],
        }),

        getCustomerById: builder.query<Customer, number | string>({
            query: (id) => `customers/${id}`,
            providesTags: (result, error, id) => [{ type: "Customer", id }],
        }),

        createCustomer: builder.mutation<Customer, Partial<Customer>>({
            query: (body) => ({
                url: "customers",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Customer"],
        }),

        updateCustomer: builder.mutation<Customer, { id: number | string; data: Partial<Customer> }>({
            query: ({ id, data }) => ({
                url: `customers/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Customer", id },
                "Customer",
            ],
        }),

        deleteCustomer: builder.mutation<{ success: boolean; id: number | string }, number | string>({
            query: (id) => ({
                url: `customers/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Customer"],
        }),
    }),
});

export const {
    useGetCustomersQuery,
    useGetCustomerByIdQuery,
    useCreateCustomerMutation,
    useUpdateCustomerMutation,
    useDeleteCustomerMutation,
} = customersApi;
