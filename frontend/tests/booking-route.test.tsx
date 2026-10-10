import { BookingRouteEditor } from "@/components/bookings/BookingRouteEditor";
import { INITIAL_TRIP_STATE } from "@/components/bookings/config/booking-workflow.config";
import { scheduledRouteSeconds } from "@/lib/booking-route";
import type { BookingTrip } from "@/types/booking-workflow";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn(), preview: vi.fn(), map: null as any }));
vi.mock("@/lib/workflow-api", () => ({ useWorkflowApi: () => mocks.api }));
vi.mock("@/components/shared/MapboxMap", () => ({
  MapboxMap: (props: any) => {
    mocks.map = props;
    return (
      <div>
        <button onClick={() => props.onChoose?.({ lat: 0, lng: 1 })}>Map click</button>
        <button onClick={() => props.onMove?.(props.points[1]?.id, { lat: 0, lng: 3 })}>
          Drag pin
        </button>
      </div>
    );
  },
}));
vi.mock("@/components/bookings/LocationPicker", () => ({
  LocationPicker: ({ label, value, onChange }: any) => (
    <input
      aria-label={label}
      value={value.address}
      onChange={(e) => onChange({ address: e.target.value, lat: 0, lng: 4 })}
    />
  ),
}));
vi.mock("@/components/bookings/StopAccessFields", () => ({ StopAccessFields: () => null }));
const metrics = {
  geometry: {
    type: "LineString",
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  },
  distanceMeters: 1000,
  drivingSeconds: 600,
  coachDrivingSeconds: 900,
  stopSeconds: 0,
  serviceSeconds: 900,
};
const result = (fingerprint: string) => ({
  status: "VALID",
  fingerprint,
  outbound: metrics,
  return: metrics,
});
function Harness({ roundTrip = false }: { roundTrip?: boolean }) {
  const [trip, setTrip] = useState<BookingTrip>({
    ...INITIAL_TRIP_STATE,
    bookingType: roundTrip ? "round_trip" : "one_way",
    pickup: { address: "Start", lat: 0, lng: 0 },
    dropoff: { address: "End", lat: 0, lng: 2 },
  });
  return (
    <>
      <BookingRouteEditor
        trip={trip}
        disabled={false}
        onChange={(v) => setTrip((t) => ({ ...t, ...v }))}
        onPreview={mocks.preview}
      />
      <output data-testid="trip">{JSON.stringify(trip)}</output>
    </>
  );
}
const trip = () => JSON.parse(screen.getByTestId("trip").textContent!);
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(501);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  mocks.api.mockReset().mockResolvedValue(result("current"));
  mocks.preview.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("ordinary clicks do nothing; via insertion, dragging, removing and undo keep map and list synchronized", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText("Map click"));
  expect(trip().stops).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Add Via Point" }));
  fireEvent.click(screen.getByText("Map click"));
  expect(trip().outboundItinerary).toHaveLength(3);
  expect(trip().stops).toHaveLength(0);
  expect(screen.getByText("Pass through — no passenger stop.")).toBeTruthy();
  const id = trip().outboundItinerary[1].id;
  fireEvent.click(screen.getByText("Drag pin"));
  expect(trip().outboundItinerary[1]).toMatchObject({ id, lng: 3 });
  fireEvent.click(screen.getByRole("button", { name: "Remove point 2" }));
  expect(mocks.map.points).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Undo Last Change" }));
  expect(mocks.map.points).toHaveLength(3);
  expect(trip().outboundItinerary[1].id).toBe(id);
  await tick();
  expect(mocks.api.mock.calls.at(-1)?.[2].outboundItinerary[1].kind).toBe("VIA");
});
it("supports search insertion and keyboard-accessible reordering", () => {
  render(<Harness />);
  for (const address of ["First", "Second"]) {
    fireEvent.click(screen.getByRole("button", { name: "Add Passenger Stop" }));
    fireEvent.change(screen.getByLabelText("New route point"), { target: { value: address } });
    expect(trip().stops).toHaveLength(address === "First" ? 0 : 1);
    fireEvent.click(screen.getByRole("button", { name: "Insert point" }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Move point 3 up" }));
  expect(trip().stops.map((p: any) => p.address)).toEqual(["Second", "First"]);
  fireEvent.click(screen.getByRole("button", { name: "Undo Last Change" }));
  expect(trip().stops.map((p: any) => p.address)).toEqual(["First", "Second"]);
});
it("copies return points independently and editing return does not change outbound intermediate points", () => {
  render(<Harness roundTrip />);
  fireEvent.click(screen.getByRole("button", { name: "Add Via Point" }));
  fireEvent.click(screen.getByText("Map click"));
  const outbound = trip().outboundItinerary;
  fireEvent.click(screen.getByRole("tab", { name: "Return" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy outbound in reverse" }));
  expect(trip().returnItinerary[1].id).not.toBe(outbound[1].id);
  fireEvent.click(screen.getByText("Drag pin"));
  expect(trip().returnItinerary[1].lng).toBe(3);
  expect(trip().outboundItinerary[1].lng).toBe(1);
});
it("aborts old requests and ignores responses that resolve after newer edits", async () => {
  let resolveOld!: (value: any) => void;
  mocks.api
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValue(result("new"));
  const view = render(<Harness />);
  await tick();
  const oldSignal = mocks.api.mock.calls[0][4];
  fireEvent.click(screen.getByRole("button", { name: "Add Via Point" }));
  fireEvent.click(screen.getByText("Map click"));
  expect(oldSignal.aborted).toBe(true);
  await tick();
  await act(async () => resolveOld(result("old")));
  expect(mocks.preview.mock.calls.map((c) => c[0].fingerprint)).toEqual(["new"]);
  const currentSignal = mocks.api.mock.calls.at(-1)![4];
  view.unmount();
  expect(currentSignal.aborted).toBe(true);
});
it("retains points and last geometry on failure and retries", async () => {
  render(<Harness />);
  await tick();
  mocks.api.mockRejectedValueOnce(new Error("No route found"));
  fireEvent.click(screen.getByRole("button", { name: "Add Via Point" }));
  fireEvent.click(screen.getByText("Map click"));
  await tick();
  expect(screen.getByRole("alert").textContent).toContain("outdated");
  expect(mocks.map.geometry).toEqual(metrics.geometry);
  expect(trip().outboundItinerary).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await tick();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("compares scheduled durations in the booking timezone across daylight saving", () => {
  expect(scheduledRouteSeconds("2026-10-04T01:00", "2026-10-04T04:00", "Australia/Sydney")).toBe(
    7200,
  );
  expect(
    scheduledRouteSeconds("2026-10-04T02:30", "2026-10-04T04:00", "Australia/Sydney"),
  ).toBeNaN();
});
