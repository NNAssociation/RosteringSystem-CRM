import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const dispatchApi = createApi({
  reducerPath: "dispatchApi",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  }),
  tagTypes: ["Board", "Assignment", "Lock", "AutoSchedule"],
  endpoints: (builder) => ({
    getBoardData: builder.query<any, { date: string; viewMode?: string } | string>({
      query: (arg) => {
        if (typeof arg === "string") return `/dispatch/board?date=${arg}`;
        return `/dispatch/board?date=${arg.date}&viewMode=${arg.viewMode || "daily"}`;
      },
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
    previewAutoSchedule: builder.query<any, { startDate: string; endDate: string } | string>({
      query: (arg) => {
        if (typeof arg === "string") return `/dispatch/auto-schedule?date=${arg}`;
        return `/dispatch/auto-schedule?startDate=${arg.startDate}&endDate=${arg.endDate}`;
      },
      providesTags: ["AutoSchedule"],
    }),
    runAutoSchedule: builder.mutation<any, { startDate?: string; endDate?: string; date?: string; force?: boolean }>({
      query: (body) => {
        const s = body.startDate || body.date;
        const e = body.endDate || body.date;
        const forceStr = body.force ? "&force=true" : "";
        return {
          url: `/dispatch/auto-schedule?startDate=${s}&endDate=${e}${forceStr}`,
          method: "POST",
          body,
        };
      },
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
