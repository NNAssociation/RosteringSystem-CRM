import {
  bookingsApi,
  customersApi,
  depotsApi,
  dispatchApi,
  employeesApi,
  fleetApi,
  settingsApi,
  userApi,
} from "@/services/api";
import { operationsApi } from "@/services/api/operations.api";
import { workplaceApi } from "@/services/api/workplace.api";
import { configureStore, type Middleware } from "@reduxjs/toolkit";
import dispatchUIReducer from "./dispatchUI.slice";
import recordChanges, { recordCreated } from "./recordChanges";

const refreshRecords: Middleware = (api) => (next) => (action) => {
  const result = next(action);
  const a = action as any;
  const mutation = a.type?.endsWith("/executeMutation/fulfilled");
  const workplaceMutation = a.type?.startsWith("workplaceApi/");
  const fleetImpact = workplaceMutation && a.meta?.arg?.originalArgs?.action === "fleet-impact";
  if ((mutation && (!workplaceMutation || fleetImpact)) || a.type === "records/workflowChanged") {
    for (const [service, tags] of [
      [userApi, ["User"]],
      [employeesApi, ["Employee"]],
      [customersApi, ["Customer"]],
      [fleetApi, ["Vehicle"]],
      [bookingsApi, ["Booking", "CustomerSearch"]],
      [dispatchApi, ["Board"]],
      [operationsApi, ["Overview", "Eligibility"]],
    ] as const)
      api.dispatch((service.util.invalidateTags as any)(tags));
    const resource =
      (
        {
          createUser: "users",
          createEmployee: "users",
          createCustomer: "customers",
          createVehicle: "fleet",
          createBooking: "bookings",
        } as Record<string, string>
      )[a.meta?.arg?.endpointName] || a.payload?.createdResource;
    const id = a.payload?.id;
    if (resource && id != null) api.dispatch(recordCreated({ resource, id }));
  }
  return result;
};
export const makeStore = () =>
  configureStore({
    reducer: {
      [workplaceApi.reducerPath]: workplaceApi.reducer,
      recordChanges,
      [operationsApi.reducerPath]: operationsApi.reducer,
      [userApi.reducerPath]: userApi.reducer,
      [fleetApi.reducerPath]: fleetApi.reducer,
      [customersApi.reducerPath]: customersApi.reducer,
      [employeesApi.reducerPath]: employeesApi.reducer,
      [bookingsApi.reducerPath]: bookingsApi.reducer,
      [dispatchApi.reducerPath]: dispatchApi.reducer,
      [depotsApi.reducerPath]: depotsApi.reducer,
      [settingsApi.reducerPath]: settingsApi.reducer,
      dispatchUI: dispatchUIReducer,
    },
    // Adding the api middleware enables caching, invalidation, polling, and other useful features of rtk-query.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        workplaceApi.middleware,
        refreshRecords,
        operationsApi.middleware,
        userApi.middleware,
        fleetApi.middleware,
        customersApi.middleware,
        employeesApi.middleware,
        bookingsApi.middleware,
        dispatchApi.middleware,
        depotsApi.middleware,
        settingsApi.middleware,
      ),
  });

export const store = makeStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
