import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { afterEach, expect, it, vi } from "vitest";
import { INITIAL_TRIP_STATE } from "../components/bookings/config/booking-workflow.config";
import { clearOtherBookingDrafts, readBookingDraft, writeBookingDraft } from "../lib/booking-draft";
import { StoreProvider } from "../providers/store-provider";
import type { RootState } from "../store";
import { recordCreated } from "../store/recordChanges";
const state = vi.hoisted(() => ({ userId: "first", sessionId: "session-first", isLoaded: true }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => state }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

it("isolates Redux records and late actions when the signed-in session changes", () => {
  let oldDispatch: ReturnType<typeof useDispatch>;
  function Record() {
    const dispatch = useDispatch();
    useEffect(() => {
      if (state.userId === "first") oldDispatch = dispatch;
    }, [dispatch]);
    const record = useSelector((s: RootState) => s.recordChanges.creations.bookings);
    return <span>{record?.id || "empty"}</span>;
  }
  const tree = () => (
    <StoreProvider>
      <Record />
    </StoreProvider>
  );
  const view = render(tree());
  act(() => {
    oldDispatch(recordCreated({ resource: "bookings", id: 42 }));
  });
  expect(screen.getByText("42")).toBeTruthy();
  state.userId = "second";
  state.sessionId = "session-second";
  view.rerender(tree());
  expect(screen.getByText("empty")).toBeTruthy();
  act(() => {
    oldDispatch(recordCreated({ resource: "bookings", id: 99 }));
  });
  expect(screen.getByText("empty")).toBeTruthy();
});

it("isolates drafts, removes legacy drafts, and clears them at sign-out", () => {
  sessionStorage.setItem(
    "booking-workspace-draft",
    JSON.stringify({ customerEmail: "old@example.test" }),
  );
  writeBookingDraft("first", { ...INITIAL_TRIP_STATE, customerEmail: "first@example.test" });
  expect(readBookingDraft("second")).toBeNull();
  clearOtherBookingDrafts("second");
  expect(readBookingDraft("first")).toBeNull();
  expect(sessionStorage.getItem("booking-workspace-draft")).toBeNull();
  writeBookingDraft("second", INITIAL_TRIP_STATE);
  clearOtherBookingDrafts(null);
  expect(readBookingDraft("second")).toBeNull();
});

it("continues without draft persistence when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage disabled");
  });
  expect(() => writeBookingDraft("first", INITIAL_TRIP_STATE)).not.toThrow();
});
