import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowForm, dateInput, zonedISO } from "../components/workplace/forms";
import { RecordDetail } from "../components/workplace/record-detail";
const state = vi.hoisted(() => ({ office: false, mutation: vi.fn(), record: {} as any }));
vi.mock("@/components/workplace/access", () => ({
  useEmployeeAccess: () => ({
    office: state.office,
    employee: { id: 1, role: state.office ? "ADMIN" : "DRIVER" },
    timeZone: "Australia/Sydney",
    canDispose: state.office,
  }),
}));
vi.mock("@/services/api/workplace.api", () => ({
  useGetWorkplaceRecordQuery: () => ({ data: state.record, refetch: vi.fn() }),
  useGetWorkplaceLookupsQuery: () => ({
    data: { employees: [], depots: [], jobs: [], vehicles: [], customers: [] },
  }),
  useWorkplaceMutationMutation: () => [state.mutation, { isLoading: false }],
  useGetAffectedAssignmentsQuery: () => ({ data: [] }),
  useGetWorkplaceListQuery: () => ({ data: { items: [], total: 0 } }),
}));
vi.mock("@/components/workplace/attachments", () => ({
  Attachments: () => <div>Private attachment controls</div>,
}));
beforeEach(() => {
  state.office = false;
  state.mutation.mockReset();
  state.mutation.mockReturnValue({ unwrap: async () => ({ success: true }) });
  state.record = {
    id: 1,
    version: 2,
    status: "IN_PROGRESS",
    title: "Damaged mirror",
    description: "Mirror needs repair",
    reporterId: 1,
    ownerId: 1,
    occurredAt: "2026-09-29T01:00:00Z",
    actions: [],
    updates: [],
  };
});
afterEach(cleanup);
describe("Workplace forms", () => {
  it("preserves input after a failed save and provides a retry", async () => {
    const save = vi
        .fn()
        .mockRejectedValueOnce({ data: { error: "Connection unavailable" } })
        .mockResolvedValueOnce(undefined),
      close = vi.fn();
    render(
      <WorkflowForm
        title="Report incident"
        fields={[{ name: "description", label: "Description", type: "textarea", required: true }]}
        onSubmit={save}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Broken mirror" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Description *") as HTMLTextAreaElement).value).toBe(
      "Broken mirror",
    );
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(save).toHaveBeenLastCalledWith({ description: "Broken mirror" });
  });
  it("converts business-zone entry independently of the browser timezone", () => {
    expect(zonedISO("2026-09-29T09:00", "Australia/Sydney")).toBe("2026-09-28T23:00:00.000Z");
    expect(dateInput("2026-09-28T23:00:00Z", "Australia/Sydney")).toBe("2026-09-29T09:00");
  });
  it("rejects nonexistent daylight-saving times", () => {
    expect(() => zonedISO("2026-10-04T02:30", "Australia/Sydney")).toThrow("does not exist");
  });
});
describe("Workflow detail controls", () => {
  it("allows participant updates without office transitions or assignment controls", () => {
    render(<RecordDetail resource="incidents" id={1} />);
    expect(screen.getByRole("button", { name: "Add update" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change status" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign / triage" })).toBeNull();
  });
  it("offers office triage and status controls", () => {
    state.office = true;
    render(<RecordDetail resource="incidents" id={1} />);
    expect(screen.getByRole("button", { name: "Change status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign / triage" })).toBeTruthy();
  });
  it("marks reading automatically when opening an active published notice", async () => {
    state.record = {
      id: 1,
      version: 4,
      currentRevision: 2,
      status: "PUBLISHED",
      revisions: [
        {
          id: 3,
          revision: 2,
          title: "Safety briefing",
          body: "Please read",
          audience: ["DRIVER"],
          recipients: [],
        },
      ],
    };
    render(<RecordDetail resource="notices" id={1} />);
    await waitFor(() =>
      expect(state.mutation).toHaveBeenCalledWith({
        resource: "notices",
        id: 1,
        action: "read",
        body: { version: 4 },
      }),
    );
  });
  it("does not display acknowledgement controls since acknowledgement is removed", () => {
    state.record = {
      id: 1,
      version: 4,
      currentRevision: 2,
      status: "PUBLISHED",
      revisions: [
        {
          id: 3,
          revision: 2,
          title: "Safety briefing",
          body: "Please read",
          audience: [],
          recipients: [{ userId: 1, readAt: "2026-09-29" }],
        },
      ],
    };
    render(<RecordDetail resource="notices" id={1} />);
    expect(screen.queryByRole("button", { name: /acknowledge/i })).toBeNull();
  });
});
