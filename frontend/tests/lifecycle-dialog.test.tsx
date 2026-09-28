import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const state = vi.hoisted(() => ({ change: vi.fn(), eligibility: { eligible: true, reasons: [] as string[] }, refetch: vi.fn() }));
vi.mock("@/services/api/operations.api", () => ({ useChangeLifecycleMutation: () => [state.change, { isLoading: false }], useGetDeletionEligibilityQuery: () => ({ currentData: state.eligibility, isFetching: false, isError: false, refetch: state.refetch }) }));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));
import { RecordLifecycleActions } from "../components/shared/record-lifecycle-actions";
beforeEach(() => { vi.clearAllMocks(); state.eligibility = { eligible: true, reasons: [] }; state.change.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) }); });
afterEach(cleanup);
it("requires confirmation, then closes the record only after successful permanent deletion", async () => {
  const user = userEvent.setup(), closed = vi.fn(); render(<RecordLifecycleActions resource="customers" id={1} inactive onDeleted={closed} />);
  await user.click(screen.getByRole("button", { name: "Delete permanently" })); expect(state.change).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" })); await waitFor(() => expect(closed).toHaveBeenCalledTimes(1)); expect(state.change).toHaveBeenCalledWith({ resource: "customers", id: 1, permanent: true });
});
it("shows dependency blockers and disables permanent deletion", async () => {
  state.eligibility = { eligible: false, reasons: ["2 bookings prevent permanent deletion."] };
  const user = userEvent.setup(); render(<RecordLifecycleActions resource="customers" id={1} inactive onDeleted={vi.fn()} />); await user.click(screen.getByRole("button", { name: "Delete permanently" }));
  expect(screen.getByText("2 bookings prevent permanent deletion.")).toBeTruthy(); expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" }) as HTMLButtonElement).disabled).toBe(true); expect(state.change).not.toHaveBeenCalled();
});
it("retains the dialog and record on a failed deletion", async () => {
  state.change.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: "Record changed concurrently." } }) });
  const user = userEvent.setup(), closed = vi.fn(); render(<RecordLifecycleActions resource="fleet" id={2} inactive onDeleted={closed} />); await user.click(screen.getByRole("button", { name: "Delete permanently" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" }));
  await screen.findByText("Record changed concurrently."); expect(screen.getByRole("dialog")).toBeTruthy(); expect(closed).not.toHaveBeenCalled();
});
it("deactivation refreshes details without permanently deleting or closing the record", async () => {
  const user = userEvent.setup(), changed = vi.fn(), closed = vi.fn(); render(<RecordLifecycleActions resource="users" id={8} inactive={false} onDeleted={closed} onChanged={changed} />); await user.click(screen.getByRole("button", { name: "Deactivate" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" })); await waitFor(() => expect(changed).toHaveBeenCalled()); expect(closed).not.toHaveBeenCalled(); expect(state.change).toHaveBeenCalledWith({ resource: "users", id: 8, permanent: false });
});

