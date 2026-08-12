import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './base-query';

export interface SchedulingSettings {
  maxContinuousDrivingMinutes: string;
  minBreakDurationMinutes: string;
  maxShiftDurationMinutes: string;
  bufferMinutes: string;
  depotTravelBuffer: string;
  transitTimeMinutes: string;
}

export const settingsApi = createApi({
  reducerPath: 'settingsApi',
  baseQuery,
  tagTypes: ['Settings'],
  endpoints: (builder) => ({
    getSchedulingSettings: builder.query<SchedulingSettings, void>({
      query: () => '/settings/scheduling',
      providesTags: ['Settings'],
    }),
    updateSchedulingSettings: builder.mutation<SchedulingSettings, Partial<SchedulingSettings>>({
      query: (body) => ({
        url: '/settings/scheduling',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),
  }),
});

export const {
  useGetSchedulingSettingsQuery,
  useUpdateSchedulingSettingsMutation,
} = settingsApi;
