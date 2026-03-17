import { configureStore } from "@reduxjs/toolkit";
import { userApi } from "../api/userApi";

// export const store = configureStore({
//   reducer: {
//     // Add your reducers here
//   },
// });

export const store = configureStore({
  reducer: {
    [userApi.reducerPath]: userApi.reducer,
  },
  // Adding the api middleware enables caching, invalidation, polling, and other useful features of rtk-query.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(userApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
