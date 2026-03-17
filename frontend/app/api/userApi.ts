import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { User } from "../state/user/userSlice";

// Fallback to localhost if the env variable is missing for some reason
const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/";
console.log("Current API URL:", baseUrl);

export const userApi = createApi({
  reducerPath: "userApi",
  baseQuery: fetchBaseQuery({ baseUrl: baseUrl }),
  tagTypes: ["User"], // Used for automated re-fetching
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
    createUser: builder.mutation<User, Partial<User>>({
      query: (body) => ({
        url: "users",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    // PATCH update user
    updateUser: builder.mutation<User, { id: number; data: Partial<User> }>({
      query: ({ id, data }) => ({
        url: `users/${id}`,
        method: "PATCH",
        body: data,
      }),
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
