import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { format } from 'date-fns';

export interface DutySpan {
  driverId: number;
  date: string; // 'yyyy-MM-dd'
  startTime: string; // ISO string
  endTime: string; // ISO string
}

interface DispatchUIState {
  selectedDate: string; // 'yyyy-MM-dd'
  viewMode: 'daily' | 'weekly';
  filters: {
    driver: string;
    vehicle: string;
    bookingType: string;
  };
  dutySpans: Record<string, DutySpan>; // Keyed by 'driverId-date'
  dutySpanModal: {
    isOpen: boolean;
    selectedDriverIds: number[];
  };
}

const initialState: DispatchUIState = {
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  viewMode: 'daily',
  filters: {
    driver: '',
    vehicle: '',
    bookingType: '',
  },
  dutySpans: {},
  dutySpanModal: {
    isOpen: false,
    selectedDriverIds: [],
  },
};

export const dispatchUISlice = createSlice({
  name: 'dispatchUI',
  initialState,
  reducers: {
    setSelectedDate: (state, action: PayloadAction<string>) => {
      state.selectedDate = action.payload;
    },
    setViewMode: (state, action: PayloadAction<'daily' | 'weekly'>) => {
      state.viewMode = action.payload;
    },
    setFilter: (state, action: PayloadAction<{ key: keyof DispatchUIState['filters']; value: string }>) => {
      state.filters[action.payload.key] = action.payload.value;
    },
    openDutySpanModal: (state, action: PayloadAction<number[]>) => {
      state.dutySpanModal.isOpen = true;
      state.dutySpanModal.selectedDriverIds = action.payload;
    },
    closeDutySpanModal: (state) => {
      state.dutySpanModal.isOpen = false;
      state.dutySpanModal.selectedDriverIds = [];
    },
    setDutySpan: (state, action: PayloadAction<DutySpan>) => {
      const key = `${action.payload.driverId}-${action.payload.date}`;
      state.dutySpans[key] = action.payload;
    },
    setBulkDutySpans: (state, action: PayloadAction<DutySpan[]>) => {
      action.payload.forEach(ds => {
        const key = `${ds.driverId}-${ds.date}`;
        state.dutySpans[key] = ds;
      });
    },
  },
});

export const {
  setSelectedDate,
  setViewMode,
  setFilter,
  openDutySpanModal,
  closeDutySpanModal,
  setDutySpan,
  setBulkDutySpans,
} = dispatchUISlice.actions;

export default dispatchUISlice.reducer;
