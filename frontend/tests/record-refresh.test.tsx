import { waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  bookingsApi,
  customersApi,
  dispatchApi,
  employeesApi,
  fleetApi,
  userApi,
} from "../services/api";
import { operationsApi } from "../services/api/operations.api";
import { workplaceApi } from "../services/api/workplace.api";
import { store } from "../store";
const state = vi.hoisted(() => ({ version: 1, requests: [] as string[] }));
vi.mock("@/services/api/base-query", () => ({
  baseQuery: async (arg: any) => {
    const url = typeof arg === "string" ? arg : arg.url;
    state.requests.push(url);
    if (arg.method) {
      state.version++;
      return { data: { id: state.version, name: `Name ${state.version}` } };
    }
    return {
      data: url.startsWith("dashboard")
        ? { generatedAt: String(state.version) }
        : url === "users"
          ? [{ id: 1, name: `Name ${state.version}`, firstName: `Name ${state.version}` }]
          : [],
    };
  },
}));
afterEach(() => {
  for (const api of [
    employeesApi,
    userApi,
    bookingsApi,
    customersApi,
    fleetApi,
    dispatchApi,
    operationsApi,
    workplaceApi,
  ])
    store.dispatch(api.util.resetApiState());
});
it("refreshes employee, selector and dashboard caches after a user update", async () => {
  const subscriptions = [
    store.dispatch(employeesApi.endpoints.getEmployees.initiate()),
    store.dispatch(userApi.endpoints.getUsers.initiate()),
    store.dispatch(operationsApi.endpoints.getOverview.initiate("2026-10-04")),
  ];
  await Promise.all(subscriptions.map((s) => s.unwrap()));
  await store
    .dispatch(userApi.endpoints.updateUser.initiate({ id: 1, data: { firstName: "New name" } }))
    .unwrap();
  await waitFor(() => {
    expect(employeesApi.endpoints.getEmployees.select()(store.getState()).data?.[0].name).toBe(
      "Name 2",
    );
    expect(userApi.endpoints.getUsers.select()(store.getState()).data?.[0].firstName).toBe(
      "Name 2",
    );
    expect(
      operationsApi.endpoints.getOverview.select("2026-10-04")(store.getState()).data?.generatedAt,
    ).toBe("2");
  });
  subscriptions.forEach((s) => s.unsubscribe());
});
it("records creation events and refreshes the custom quotation workflow", async () => {
  const subscription = store.dispatch(operationsApi.endpoints.getOverview.initiate("2026-10-05"));
  await subscription.unwrap();
  await store
    .dispatch(userApi.endpoints.createUser.initiate({ email: "test@example.test" }))
    .unwrap();
  expect(store.getState().recordChanges.creations.users?.version).toBeGreaterThan(0);
  state.version = 9;
  store.dispatch({
    type: "records/workflowChanged",
    payload: { createdResource: "bookings", id: 9 },
  });
  await waitFor(() =>
    expect(
      operationsApi.endpoints.getOverview.select("2026-10-05")(store.getState()).data?.generatedAt,
    ).toBe("9"),
  );
  expect(store.getState().recordChanges.creations.bookings?.id).toBe(9);
  subscription.unsubscribe();
});
it("does not reload operational data when a notice is acknowledged", async () => {
  const subscription = store.dispatch(operationsApi.endpoints.getOverview.initiate("2026-10-05"));
  await subscription.unwrap();
  const before = state.requests.filter((url) => url.startsWith("dashboard")).length;
  await store
    .dispatch(
      workplaceApi.endpoints.workplaceMutation.initiate({
        resource: "notices",
        id: 1,
        action: "acknowledge",
        body: { version: 1 },
      }),
    )
    .unwrap();
  expect(state.requests.filter((url) => url.startsWith("dashboard"))).toHaveLength(before);
  subscription.unsubscribe();
});
