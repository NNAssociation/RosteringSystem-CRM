import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "./base-query";
export type WorkplaceResource =
  "notices" | "incidents" | "lost-property/reports" | "lost-property/items";
export type EmployeeAccess = {
  employee: { id: number; firstName: string | null; lastName: string | null; role: string };
  office: boolean;
  canDispose: boolean;
  features: { notices: boolean; incidents: boolean; lostProperty: boolean };
  timeZone: string;
};
export type WorkplaceRecord = Record<string, any> & { id: number; version: number; status: string };
export const workplaceApi = createApi({
  reducerPath: "workplaceApi",
  baseQuery,
  tagTypes: ["Identity", "Notices", "Incidents", "Property", "Notifications", "Attachments"],
  endpoints: (builder) => ({
    getEmployeeAccess: builder.query<EmployeeAccess, string | void>({
      query: () => ({ url: "me", timeout: 15000 }),
      providesTags: ["Identity"],
    }),
    getWorkplaceLookups: builder.query<Record<string, any[]>, string>({
      query: (search) => `workplace/lookups?search=${encodeURIComponent(search)}`,
    }),
    getWorkplaceList: builder.query<
      { items: WorkplaceRecord[]; total: number; page: number; pageSize: number },
      { resource: WorkplaceResource; params?: Record<string, string | number> }
    >({
      query: ({ resource, params }) => ({ url: resource, params }),
      providesTags: (_r, _e, { resource }) => [
        resource === "notices" ? "Notices" : resource === "incidents" ? "Incidents" : "Property",
      ],
    }),
    getWorkplaceRecord: builder.query<WorkplaceRecord, { resource: WorkplaceResource; id: number }>(
      {
        query: ({ resource, id }) => `${resource}/${id}`,
        providesTags: (_r, _e, { resource }) => [
          resource === "notices" ? "Notices" : resource === "incidents" ? "Incidents" : "Property",
        ],
      },
    ),
    workplaceMutation: builder.mutation<
      any,
      { resource: string; id?: number; action?: string; method?: "POST" | "PATCH"; body?: any }
    >({
      query: ({ resource, id, action, method = "POST", body = {} }) => ({
        url: `${resource}${id ? `/${id}` : ""}${action ? `/${action}` : ""}`,
        method,
        body,
      }),
      invalidatesTags: (_r, error, { resource }) =>
        error
          ? []
          : [
              ...(resource === "notices"
                ? ["Notices" as const]
                : resource === "incidents"
                  ? ["Incidents" as const]
                  : resource.startsWith("lost-property")
                    ? ["Property" as const]
                    : []),
              "Notifications",
            ],
    }),
    getAffectedAssignments: builder.query<any[], number>({
      query: (id) => `incidents/${id}/affected-assignments`,
      providesTags: ["Incidents"],
    }),
    getWorkplaceNotifications: builder.query<{ items: any[]; unreadCount: number }, void>({
      query: () => "notifications",
      providesTags: ["Notifications"],
    }),
    readWorkplaceNotification: builder.mutation<void, number>({
      query: (id) => ({ url: `notifications/${id}/read`, method: "POST" }),
      invalidatesTags: ["Notifications"],
    }),
    getAttachments: builder.query<any[], Record<string, number>>({
      query: (params) => ({ url: "attachments", params }),
      providesTags: ["Attachments"],
    }),
    uploadAttachment: builder.mutation<any, { parent: Record<string, number>; file: File }>({
      query: ({ parent, file }) => ({
        url: "attachments",
        params: { ...parent, filename: file.name },
        method: "POST",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      }),
      invalidatesTags: ["Attachments"],
    }),
    removeAttachment: builder.mutation<void, string>({
      query: (id) => ({ url: `attachments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Attachments"],
    }),
  }),
});
export const {
  useGetEmployeeAccessQuery,
  useGetWorkplaceLookupsQuery,
  useGetWorkplaceListQuery,
  useGetWorkplaceRecordQuery,
  useWorkplaceMutationMutation,
  useGetAffectedAssignmentsQuery,
  useGetWorkplaceNotificationsQuery,
  useReadWorkplaceNotificationMutation,
  useGetAttachmentsQuery,
  useUploadAttachmentMutation,
  useRemoveAttachmentMutation,
} = workplaceApi;
