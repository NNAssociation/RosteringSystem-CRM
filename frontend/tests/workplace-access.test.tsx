import { configureStore } from "@reduxjs/toolkit";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmployeeAccessGate } from "../components/workplace/access";
import { workplaceApi } from "../services/api/workplace.api";

const state = vi.hoisted(() => ({
  auth: { userId: "clerk-office" as string | null, isLoaded: true },
  response: null as Promise<any> | null,
  resolve: null as ((value: any) => void) | null,
  requests: vi.fn(),
  replace: vi.fn(),
  path: "/dashboard",
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => state.auth,
  UserButton: () => <span>Account</span>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.path,
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
}));
vi.mock("@/services/api/base-query", () => ({
  baseQuery: async () => {
    state.requests();
    return state.response;
  },
}));

beforeEach(() => {
  state.auth = { userId: "clerk-office", isLoaded: true };
  state.path = "/dashboard";
  state.requests.mockClear();
  state.replace.mockClear();
  state.response = new Promise((resolve) => {
    state.resolve = resolve;
  });
});
afterEach(cleanup);
function mount() {
  const store = configureStore({
    reducer: { [workplaceApi.reducerPath]: workplaceApi.reducer },
    middleware: (getDefault) => getDefault().concat(workplaceApi.middleware),
  });
  const tree = () => (
    <React.StrictMode>
      <Provider store={store}>
        <EmployeeAccessGate>
          <div>Workspace ready</div>
        </EmployeeAccessGate>
      </Provider>
    </React.StrictMode>
  );
  const view = render(tree());
  return () => view.rerender(tree());
}
const access = {
  employee: { id: 1, role: "ADMIN", firstName: "Test", lastName: "User" },
  office: true,
  canDispose: true,
  features: { notices: false, incidents: false, lostProperty: false },
  timeZone: "Australia/Sydney",
};

it("opens the workspace when the initial in-flight identity request completes", async () => {
  mount();
  await waitFor(() => expect(state.requests).toHaveBeenCalled());
  await act(async () => {
    state.resolve!({ data: access });
  });
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
});
it("surfaces initial identity failures instead of staying on loading", async () => {
  mount();
  await waitFor(() => expect(state.requests).toHaveBeenCalled());
  await act(async () => {
    state.resolve!({ error: { status: 503, data: { error: "Database migration required" } } });
  });
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Database migration required",
  );
});
it("redirects a signed-out user to sign-in after Clerk loads", async () => {
  state.auth = { userId: null, isLoaded: true };
  mount();
  await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/sign-in"));
  expect(state.requests).not.toHaveBeenCalled();
});
it("waits for Clerk hydration before starting the identity request", async () => {
  state.auth = { userId: null, isLoaded: false };
  const rerender = mount();
  expect(state.requests).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
  state.auth = { userId: "clerk-office", isLoaded: true };
  rerender();
  await waitFor(() => expect(state.requests).toHaveBeenCalled());
  await act(async () => {
    state.resolve!({ data: access });
  });
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
});
it("clears old-account data before requesting the next account", async () => {
  const rerender = mount();
  await waitFor(() => expect(state.requests).toHaveBeenCalled());
  await act(async () => {
    state.resolve!({ data: access });
  });
  await screen.findByText("Workspace ready");
  state.response = new Promise((resolve) => {
    state.resolve = resolve;
  });
  state.auth = { userId: "clerk-next-office", isLoaded: true };
  rerender();
  await waitFor(() => expect(state.requests).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Workspace ready")).toBeNull();
  await act(async () => {
    state.resolve!({ data: { ...access, employee: { ...access.employee, id: 2 } } });
  });
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
});
