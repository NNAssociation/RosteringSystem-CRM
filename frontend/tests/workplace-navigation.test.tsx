import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkplacePage } from "../components/workplace/workplace-page";
const state = vi.hoisted(() => ({ push: vi.fn(), items: [] as any[] }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/providers/header-provider", () => ({ useHeader: () => ({ setHeaderConfig: vi.fn() }) }));
vi.mock("@/components/workplace/access", () => ({
  useEmployeeAccess: () => ({ office: true, timeZone: "Australia/Sydney" }),
}));
vi.mock("@/services/api/workplace.api", () => ({
  useGetWorkplaceListQuery: () => ({ data: { items: state.items, total: state.items.length } }),
}));
vi.mock("@/components/workplace/record-form", () => ({
  RecordForm: () => null,
  noticeCategories: [],
  incidentCategories: [],
  propertyCategories: [],
}));
vi.mock("@/components/workplace/record-detail", () => ({
  RecordDetail: () => <div>Detail panel</div>,
  StatusBadge: ({ value }: any) => <span>{value}</span>,
  recordTitle: (_: any, row: any) => row.title || row.revisions?.[0]?.title,
  recordReference: (_: any, id: any) => `REF-${id}`,
}));
afterEach(() => {
  cleanup();
  state.push.mockClear();
});
it("renders notices as a table with full-page detail links", () => {
  state.items = [
    {
      id: 7,
      status: "PUBLISHED",
      publishedAt: "2030-01-01T00:00:00Z",
      revisions: [
        { title: "Safety briefing", category: "SAFETY", priority: "URGENT", audience: ["DRIVER"] },
      ],
    },
  ];
  render(<WorkplacePage module="notices" />);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View REF-7" }).getAttribute("href")).toBe(
    "/dashboard/notices/7",
  );
  fireEvent.click(screen.getByText("Safety briefing"));
  expect(state.push).toHaveBeenCalledWith("/dashboard/notices/7");
  expect(screen.queryByText("Detail panel")).toBeNull();
});
it("opens incidents directly and displays the reporter", () => {
  state.items = [
    {
      id: 8,
      title: "Mirror damage",
      category: "OTHER",
      severity: "LOW",
      status: "SUBMITTED",
      occurredAt: "2030-01-01T00:00:00Z",
      reporter: { firstName: "Pat", lastName: "Driver" },
    },
  ];
  render(<WorkplacePage module="incidents" />);
  expect(screen.getByText("Pat Driver")).toBeTruthy();
  fireEvent.click(screen.getByText("Mirror damage"));
  expect(state.push).toHaveBeenCalledWith("/dashboard/incidents/8");
});
it("links found items and lost reports to their corresponding detail routes", () => {
  state.items = [
    { id: 9, title: "Blue bag", status: "SUBMITTED", createdAt: "2030-01-01T00:00:00Z" },
  ];
  render(<WorkplacePage module="lost-property" />);
  expect(screen.getByRole("link", { name: "View REF-9" }).getAttribute("href")).toBe(
    "/dashboard/lost-property/items/9",
  );
  fireEvent.click(screen.getByRole("button", { name: "Lost Reports" }));
  expect(screen.getByRole("link", { name: "View REF-9" }).getAttribute("href")).toBe(
    "/dashboard/lost-property/reports/9",
  );
});
