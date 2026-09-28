import { createApi } from "@reduxjs/toolkit/query/react";
import { Employee } from "@/types";
import { baseQuery } from "./base-query";

export const employeesApi = createApi({
    reducerPath: "employeesApi",
    baseQuery,
    tagTypes: ["Employee"],
    endpoints: (builder) => ({
        getEmployees: builder.query<Employee[], void>({
            query: () => "users",
            providesTags: ["Employee"],
        }),

        getEmployeeById: builder.query<Employee, number | string>({
            query: (id) => `users/${id}`,
            providesTags: (result, error, id) => [{ type: "Employee", id }],
        }),

        createEmployee: builder.mutation<Employee, Partial<Employee>>({
            query: (body) => ({
                url: "users",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Employee"],
        }),

        updateEmployee: builder.mutation<Employee, { id: number | string; data: Partial<Employee> }>({
            query: ({ id, data }) => ({
                url: `users/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Employee", id },
                "Employee",
            ],
        }),

        deleteEmployee: builder.mutation<{ success: boolean; id: number | string }, number | string>({
            query: (id) => ({
                url: `users/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Employee"],
        }),

        getEmployeeAvailability: builder.query<any[], number | string>({
            query: (id) => `users/${id}/availability`,
            providesTags: (result, error, id) => [{ type: "Employee", id: `avail-${id}` }],
        }),

        addEmployeeAvailability: builder.mutation<any, { employeeId: number | string; data: any }>({
            query: ({ employeeId, data }) => ({
                url: `users/${employeeId}/availability`,
                method: "POST",
                body: data,
            }),
            invalidatesTags: (result, error, { employeeId }) => [
                { type: "Employee", id: `avail-${employeeId}` },
                "Employee",
            ],
        }),
    }),
});

export const {
    useGetEmployeesQuery,
    useGetEmployeeByIdQuery,
    useCreateEmployeeMutation,
    useUpdateEmployeeMutation,
    useDeleteEmployeeMutation,
    useGetEmployeeAvailabilityQuery,
    useAddEmployeeAvailabilityMutation,
} = employeesApi;

// Backward compatibility aliases
export const driversApi = employeesApi;
export const useGetDriversQuery = useGetEmployeesQuery;
export const useGetDriverByIdQuery = useGetEmployeeByIdQuery;
export const useCreateDriverMutation = useCreateEmployeeMutation;
export const useUpdateDriverMutation = useUpdateEmployeeMutation;
export const useDeleteDriverMutation = useDeleteEmployeeMutation;
export const useGetDriverAvailabilityQuery = useGetEmployeeAvailabilityQuery;
export const useAddDriverAvailabilityMutation = useAddEmployeeAvailabilityMutation;

