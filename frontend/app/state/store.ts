import { configureStore } from "@reduxjs/toolkit";
import { userApi } from "../api/userApi";
import { fleetApi } from "../api/fleetApi";
import { customersApi } from "../api/customersApi";
import { driversApi } from "../api/driversApi";
import { bookingsApi } from "../api/bookingsApi";
// export const store = configureStore({
//   reducer: {
//     // Add your reducers here
//   },
// });


export const store = configureStore({
  reducer: {
    [userApi.reducerPath]: userApi.reducer,
    [fleetApi.reducerPath]: fleetApi.reducer,
    [customersApi.reducerPath]: customersApi.reducer,
    [driversApi.reducerPath]: driversApi.reducer,
    [bookingsApi.reducerPath]: bookingsApi.reducer,
  },
  // Adding the api middleware enables caching, invalidation, polling, and other useful features of rtk-query.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      userApi.middleware,
      fleetApi.middleware,
      customersApi.middleware,
      driversApi.middleware,
      bookingsApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
