import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
const slice = createSlice({ name: "recordChanges", initialState: { creations: {} as Record<string, { id: string | number; version: number }> }, reducers: {
  recordCreated(state, action: PayloadAction<{ resource: string; id: string | number }>) { const { resource, id } = action.payload; state.creations[resource] = { id, version: (state.creations[resource]?.version || 0) + 1 }; },
} });
export const { recordCreated } = slice.actions;
export default slice.reducer;
