import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const dispatchApi = createApi({
  reducerPath: "dispatchApi",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  }),
  tagTypes: ["Board", "Assignment", "Lock", "AutoSchedule"],
  endpoints: (builder) => ({
    getBoardData: builder.query<any, string>({
      query: (date) => `/dispatch/board?date=${date}`,
      providesTags: ["Board"],
    }),
    createAssignment: builder.mutation<any, Partial<any>>({
      query: (body) => ({
        url: "/dispatch/assignments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Board", "Assignment"],
    }),
    updateAssignment: builder.mutation<any, { id: number; data: Partial<any> }>({
      query: ({ id, data }) => ({
        url: `/dispatch/assignments/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Board", "Assignment"],
    }),
    deleteAssignment: builder.mutation<any, number>({
      query: (id) => ({
        url: `/dispatch/assignments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Board", "Assignment"],
    }),
    acquireLock: builder.mutation<any, { resourceType: string; resourceId: number }>({
      query: (body) => ({
        url: "/dispatch/locks",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Lock"],
    }),
    releaseLock: builder.mutation<any, { resourceType: string; resourceId: number }>({
      query: (body) => ({
        url: "/dispatch/locks",
        method: "DELETE",
        body,
      }),
      invalidatesTags: ["Lock"],
    }),
    getAnalytics: builder.query<any, string | void>({
      query: (date) => `/dispatch/analytics${date ? `?date=${date}` : ''}`,
      providesTags: ["Board"], // Invalidate/refetch when board changes
    }),
    getDutySpans: builder.query<any, string>({
      query: (date) => `/dispatch/duty-span?date=${date}`,
      providesTags: ["Board"],
    }),
    setDutySpan: builder.mutation<any, { driverIds: number[]; date: string; startTime: string; endTime: string }>({
      query: (body) => ({
        url: "/dispatch/duty-span",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Board"],
    }),
    previewAutoSchedule: builder.query<any, string>({
      query: (date) => `/dispatch/auto-schedule?date=${date}`,
      providesTags: ["AutoSchedule"],
    }),
    runAutoSchedule: builder.mutation<any, { date: string; force?: boolean }>({
      query: ({ date, force }) => ({
        url: `/dispatch/auto-schedule?date=${date}${force ? "&force=true" : ""}`,
        method: "POST",
      }),
      invalidatesTags: ["Board", "AutoSchedule"],
    }),
  }),
});

export const {
  useGetBoardDataQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useDeleteAssignmentMutation,
  useAcquireLockMutation,
  useReleaseLockMutation,
  useGetAnalyticsQuery,
  useGetDutySpansQuery,
  useSetDutySpanMutation,
  usePreviewAutoScheduleQuery,
  useRunAutoScheduleMutation,
} = dispatchApi;
