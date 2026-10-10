import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBooking, getBookingById, updateBooking } from "../services/bookingService.js";
import { createAmendment, saveQuotation, sendQuotation } from "../services/quotationService.js";
import { createBookingSchema, updateBookingSchema } from "../validators/bookingSchema.js";
const state = vi.hoisted(() => ({ db: {} as any, bookings: new Map<number, any>() }));
vi.mock("../db.js", () => ({
  get prisma() {
    return state.db;
  },
}));
vi.mock("../services/emailProviders/index.js", () => ({
  getEmailProvider: () => ({ isConfigured: () => true }),
}));
const point = (id: string, kind = "STOP") => ({
  id,
  kind,
  address: id,
  lat: 0,
  lng: 1,
  dwellSeconds: 60,
  accessNotes: "Entrance at rear",
  entrance: { lat: 0, lng: 1 },
});
const input = () =>
  createBookingSchema.parse({
    date: "2030-01-02",
    startTime: "09:00",
    endTime: "11:00",
    returnTime: "14:00",
    returnEndTime: "17:00",
    bookingType: "round_trip",
    pickupLocation: "Pickup",
    dropoffLocation: "Destination",
    customerEmail: "test@example.test",
    outboundItinerary: [
      point("Pickup"),
      point("Via road", "VIA"),
      point("Lunch"),
      point("Destination"),
    ],
    returnItinerary: [point("Destination"), point("Return road", "VIA"), point("Pickup")],
    returnItineraryConfirmed: true,
  });
beforeEach(() => {
  state.bookings.clear();
  vi.stubEnv("MAPBOX_ACCESS_TOKEN", "test-token");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 3000,
            duration: 600,
            geometry: {
              type: "LineString",
              coordinates: [
                [1, 0],
                [1, 0],
              ],
            },
          },
        ],
      }),
    }),
  );
  state.db = {
    $transaction: async (fn: any) => fn(state.db),
    $queryRaw: vi.fn(),
    customer: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 1, name: "Customer", email: "test@example.test" }),
    },
    booking: {
      create: vi.fn(async ({ data }) => {
        const b = JSON.parse(
          JSON.stringify({
            ...data,
            id: state.bookings.size + 1,
            revision: 1,
            customer: { name: "Customer", email: "test@example.test" },
            jobs: [],
            quotations: [],
          }),
        );
        for (const field of ["startDateTime", "endDateTime", "returnDateTime", "returnEndDateTime"])
          if (b[field]) b[field] = new Date(b[field]);
        state.bookings.set(b.id, b);
        return b;
      }),
      findUnique: vi.fn(async ({ where }) => state.bookings.get(where.id)),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(async ({ where, data }) => {
        const previous = state.bookings.get(where.id);
        const next = {
          ...previous,
          ...data,
          revision: data.revision ? previous.revision + 1 : previous.revision,
        };
        state.bookings.set(where.id, next);
        return next;
      }),
    },
    quotation: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }) => ({ ...data, id: 1, status: "DRAFT" })),
    },
    emailDelivery: { updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
    job: { updateMany: vi.fn(), createMany: vi.fn() },
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("saves server calculations, reopens both rich itineraries and preserves them in an amendment", async () => {
  const created = await createBooking(
    { ...input(), routeCalculation: { distanceMeters: 1 } } as any,
    undefined,
    state.db,
  );
  const reopened = await getBookingById(created.id, state.db);
  expect(reopened.routeCalculation.status).toBe("VALID");
  expect(reopened.routeCalculation.outbound.distanceMeters).toBe(3000);
  expect(reopened.outboundItinerary[2]).toMatchObject({
    id: "Lunch",
    accessNotes: "Entrance at rear",
    entrance: { lat: 0, lng: 1 },
    dwellSeconds: 60,
  });
  expect(reopened.returnItinerary[1]).toMatchObject({
    id: "Return road",
    kind: "VIA",
    dwellSeconds: 0,
  });
  state.bookings.set(created.id, { ...state.bookings.get(created.id), status: "CONFIRMED" });
  const amendment = await createAmendment(created.id, "staff");
  const draft = state.bookings.get(amendment.id);
  expect(draft.outboundItinerary).toEqual(reopened.outboundItinerary);
  expect(draft.returnItinerary).toEqual(reopened.returnItinerary);
  expect(draft.routeCalculation).toEqual(reopened.routeCalculation);
  expect(state.db.job.updateMany).not.toHaveBeenCalled();
  expect(state.db.job.createMany).not.toHaveBeenCalled();
});
it("keeps a failed route as an editable draft and rejects quotations until valid and reviewed", async () => {
  const created = await createBooking(input(), undefined, state.db);
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  const points = created.outboundItinerary.map((p: any, i: number) =>
    i === 1 ? { ...p, lng: 3 } : p,
  );
  const saved = await updateBooking(
    created.id,
    updateBookingSchema.parse({ revision: 1, outboundItinerary: points }),
    undefined,
    state.db,
  );
  expect(saved.routeCalculation.status).toBe("OUTDATED");
  expect(saved.routeCalculation.previous.status).toBe("VALID");
  expect(saved.outboundItinerary[1].lng).toBe(3);
  const quote = {
    bookingRevision: saved.revision,
    previousQuotationId: null,
    items: [{ description: "Trip", quantity: 1, unitPriceMinor: 100 }],
    discountMinor: 0,
    taxBasisPoints: 0,
    expiresAt: "2030-01-01T00:00:00Z",
  };
  await expect(saveQuotation(saved.id, quote, "staff")).rejects.toThrow("valid route");
  expect(state.db.quotation.create).not.toHaveBeenCalled();
});
it("snapshots only passenger stops for customers and captures exact fingerprint review", async () => {
  const created = await createBooking(input(), undefined, state.db);
  const quote = {
    bookingRevision: 1,
    previousQuotationId: null,
    items: [{ description: "Trip", quantity: 1, unitPriceMinor: 100 }],
    discountMinor: 0,
    taxBasisPoints: 0,
    expiresAt: "2030-01-01T00:00:00Z",
  };
  await expect(saveQuotation(created.id, quote, "staff")).rejects.toThrow("review required");
  const routeReview = { fingerprint: created.routeCalculation.fingerprint, action: "KEEP" };
  const result = await saveQuotation(created.id, { ...quote, routeReview }, "staff");
  expect(result.snapshot.stops).toEqual([{ address: "Lunch" }]);
  expect(result.snapshot.returnStops).toEqual([]);
  expect(result.snapshot.routeReview).toEqual(routeReview);
});
it("rejects edits to a confirmed booking without changing its jobs or quotation", async () => {
  const created = await createBooking(input(), undefined, state.db);
  state.bookings.set(created.id, { ...state.bookings.get(created.id), status: "CONFIRMED" });
  await expect(
    updateBooking(created.id, { subject: "Change" }, undefined, state.db),
  ).rejects.toThrow("amendment");
  expect(state.db.quotation.updateMany).not.toHaveBeenCalled();
  expect(state.db.job.updateMany).not.toHaveBeenCalled();
});
it("checks for concurrent changes after the provider returns and before writing", async () => {
  const created = await createBooking(input(), undefined, state.db);
  const originalFind = state.db.booking.findUnique.getMockImplementation();
  state.db.booking.findUnique
    .mockImplementationOnce(originalFind)
    .mockImplementationOnce(async () => ({ ...state.bookings.get(created.id), revision: 2 }));
  await expect(
    updateBooking(created.id, { subject: "Change", revision: 1 }, undefined, state.db),
  ).rejects.toThrow("Reload");
  expect(state.db.booking.update).not.toHaveBeenCalled();
});

it("cannot send a quotation reviewed against a different route", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://example.test");
  vi.stubEnv("QUOTATION_TOKEN_KEY", "a".repeat(64));
  const created = await createBooking(input(), undefined, state.db);
  state.db.quotation.findUnique.mockResolvedValue({
    id: 2,
    bookingId: created.id,
    status: "DRAFT",
    expiresAt: new Date("2030-01-01"),
    deliveries: [],
    snapshot: { routeReview: { fingerprint: "old", action: "KEEP" } },
  });
  await expect(sendQuotation(2, "staff")).rejects.toThrow("review required");
  expect(state.db.booking.update).not.toHaveBeenCalled();
});
