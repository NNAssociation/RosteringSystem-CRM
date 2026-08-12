import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "./base-query";

export interface Depot {
  id: number;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export const depotsApi = createApi({
  reducerPath: "depotsApi",
  baseQuery,
  tagTypes: ["Depot"],
  endpoints: (builder) => ({
    getDepots: builder.query<Depot[], void>({
      query: () => "/depots",
      providesTags: ["Depot"],
    }),
    getDepotById: builder.query<Depot, number>({
      query: (id) => `/depots/${id}`,
      providesTags: (result, error, id) => [{ type: "Depot", id }],
    }),
    createDepot: builder.mutation<Depot, Partial<Depot>>({
      query: (body) => ({
        url: "/depots",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Depot"],
    }),
    updateDepot: builder.mutation<Depot, Partial<Depot> & Pick<Depot, "id">>({
      query: ({ id, ...body }) => ({
        url: `/depots/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Depot", id }, "Depot"],
    }),
    deleteDepot: builder.mutation<{ success: boolean; id: number }, number>({
      query: (id) => ({
        url: `/depots/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Depot"],
    }),
  }),
});

export const {
  useGetDepotsQuery,
  useGetDepotByIdQuery,
  useCreateDepotMutation,
  useUpdateDepotMutation,
  useDeleteDepotMutation,
} = depotsApi;
