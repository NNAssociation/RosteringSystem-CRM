import { configureStore } from "@reduxjs/toolkit";
import { userApi, fleetApi, customersApi, driversApi, bookingsApi } from "@/services/api";

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
