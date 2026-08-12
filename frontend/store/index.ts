import { configureStore } from "@reduxjs/toolkit";
import { userApi, fleetApi, customersApi, driversApi, bookingsApi, dispatchApi, depotsApi, settingsApi } from "@/services/api";
import dispatchUIReducer from "./dispatchUI.slice";

export const store = configureStore({
    reducer: {
        [userApi.reducerPath]: userApi.reducer,
        [fleetApi.reducerPath]: fleetApi.reducer,
        [customersApi.reducerPath]: customersApi.reducer,
        [driversApi.reducerPath]: driversApi.reducer,
        [bookingsApi.reducerPath]: bookingsApi.reducer,
        [dispatchApi.reducerPath]: dispatchApi.reducer,
        [depotsApi.reducerPath]: depotsApi.reducer,
        [settingsApi.reducerPath]: settingsApi.reducer,
        dispatchUI: dispatchUIReducer,
    },
    // Adding the api middleware enables caching, invalidation, polling, and other useful features of rtk-query.
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            userApi.middleware,
            fleetApi.middleware,
            customersApi.middleware,
            driversApi.middleware,
            bookingsApi.middleware,
            dispatchApi.middleware,
            depotsApi.middleware,
            settingsApi.middleware,
        ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
