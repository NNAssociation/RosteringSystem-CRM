import { createApi } from "@reduxjs/toolkit/query/react";
import { User, CreateUserRequest } from "@/types";
import { employeesApi } from "./employees.api";
import { baseQuery } from "./base-query";

export const userApi = createApi({
    reducerPath: "userApi",
    baseQuery,
    tagTypes: ["User"],
    endpoints: (builder) => ({
        // GET all users
        getUsers: builder.query<User[], void>({
            query: () => "users",
            providesTags: ["User"],
        }),

        // GET single user
        getUserById: builder.query<User, number>({
            query: (id) => `users/${id}`,
            providesTags: (result, error, id) => [{ type: "User", id }],
        }),

        // POST create user
        createUser: builder.mutation<User, CreateUserRequest>({
            query: (body) => ({
                url: "users",
                method: "POST",
                body,
            }),
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) { try { await queryFulfilled; dispatch(employeesApi.util.invalidateTags(["Employee"])); } catch {} },
            invalidatesTags: ["User"],
        }),

        // PATCH update user
        updateUser: builder.mutation<User, { id: number; data: Partial<User & CreateUserRequest> }>({
            query: ({ id, data }) => ({
                url: `users/${id}`,
                method: "PATCH",
                body: data,
            }),
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) { try { await queryFulfilled; dispatch(employeesApi.util.invalidateTags(["Employee"])); } catch {} },
            invalidatesTags: (result, error, { id }) => [
                { type: "User", id },
                "User",
            ],
        }),

        // DELETE user
        deleteUser: builder.mutation<{ success: boolean; id: number }, number>({
            query: (id) => ({
                url: `users/${id}`,
                method: "DELETE",
            }),
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) { try { await queryFulfilled; dispatch(employeesApi.util.invalidateTags(["Employee"])); } catch {} },
            invalidatesTags: ["User"],
        }),
    }),
});

export const {
    useGetUsersQuery,
    useGetUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} = userApi;
