import { describe, expect, it, vi } from "vitest";
import { prisma } from "../db.js";
import {
  calculateCharterPrice,
  getCharterPricingConfig,
  PUNCHBOWL_DEFAULT_PRICING,
  updateCharterPricingConfig,
} from "../services/charterPricingService.js";

vi.mock("../db.js", () => ({
  prisma: {
    schedulingSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe("Punchbowl Bus Company - Charter Pricing Engine", () => {
  it("calculates customer quote and internal labor breakdown (Coach, 65km, 9h Weekday)", () => {
    const result = calculateCharterPrice(PUNCHBOWL_DEFAULT_PRICING, {
      vehicleType: "Coach",
      distanceKm: 65,
      charterDate: "2026-10-14", // Wednesday (Weekday)
      totalHours: 9,
    });

    expect(result.vehicleType).toBe("Coach");
    expect(result.vehicleCount).toBe(1);
    expect(result.distanceKm).toBe(65);
    expect(result.totalHours).toBe(9);
    expect(result.dayType).toBe("Weekday");
    expect(result.ratePerKm).toBe(8.33);
    expect(result.distanceCost).toBe(541.45);
    // Customer quotation excludes driver wage:
    expect(result.subtotalBeforeGst).toBe(541.45);
    expect(result.gstAmount).toBe(54.15);
    expect(result.finalCustomerPrice).toBe(595.6);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]!.description).toBe("Coach Charter Service (65 km @ $8.33/km)");

    // Internal operations breakdown tracks driver labor & margin:
    expect(result.internalBreakdown.dutySpanHours).toBe(9);
    expect(result.internalBreakdown.driverWageTierCost).toBe(523.65);
    expect(result.internalBreakdown.totalDriverWageCost).toBe(523.65);
    expect(result.internalBreakdown.totalOperationalCost).toBe(1065.1);
    expect(result.internalBreakdown.estimatedGrossMargin).toBe(17.8);
  });

  it("scales distance and labor by vehicleCount for multi-vehicle fleet", () => {
    const result = calculateCharterPrice(PUNCHBOWL_DEFAULT_PRICING, {
      vehicleType: "Coach",
      vehicleCount: 2,
      distanceKm: 65,
      charterDate: "2026-10-14",
      totalHours: 9,
    });

    expect(result.vehicleCount).toBe(2);
    // 65 km * 8.33/km * 2 vehicles = 1082.90
    expect(result.distanceCost).toBe(1082.9);
    expect(result.subtotalBeforeGst).toBe(1082.9);
    expect(result.lineItems[0]!.description).toBe(
      "Coach Charter Service (2x Vehicles · 65 km @ $8.33/km)",
    );

    // Internal breakdown tracks 2 drivers
    expect(result.internalBreakdown.totalDriverWageCost).toBe(1047.3); // 523.65 * 2
    expect(result.internalBreakdown.totalOperationalCost).toBe(2130.2); // 1082.90 + 1047.30
  });

  it("applies Bus 100km band correctly on a weekend", () => {
    const result = calculateCharterPrice(PUNCHBOWL_DEFAULT_PRICING, {
      vehicleType: "Bus",
      distanceKm: 95,
      charterDate: "2026-10-17", // Saturday (Weekend)
      totalHours: 8,
    });

    expect(result.vehicleType).toBe("Bus");
    expect(result.dayType).toBe("Weekend");
    expect(result.ratePerKm).toBe(4.36); // 100km band for Bus
    expect(result.distanceCost).toBe(414.2); // 95 * 4.36
    expect(result.subtotalBeforeGst).toBe(414.2);
    expect(result.gstAmount).toBe(41.42);
    expect(result.finalCustomerPrice).toBe(455.62);
    expect(result.internalBreakdown.driverWageTierCost).toBe(489.86); // 8h weekend wage
  });

  it("applies 130km+ tier for long distance journeys", () => {
    const result = calculateCharterPrice(PUNCHBOWL_DEFAULT_PRICING, {
      vehicleType: "Coach",
      distanceKm: 180,
      charterDate: "2026-10-14",
      totalHours: 12,
    });

    expect(result.ratePerKm).toBe(4.61);
    expect(result.distanceCost).toBe(829.8); // 180 * 4.61
    expect(result.subtotalBeforeGst).toBe(829.8);
    expect(result.internalBreakdown.driverWageTierCost).toBe(644.66); // 12h weekday wage
  });

  it("handles manual adjustment correctly", () => {
    const result = calculateCharterPrice(PUNCHBOWL_DEFAULT_PRICING, {
      vehicleType: "Coach",
      distanceKm: 65,
      totalHours: 9,
      charterDate: "2026-10-14",
      manualAdjustment: 50.0,
    });

    expect(result.subtotalBeforeGst).toBe(591.45); // 541.45 + 50
    expect(result.gstAmount).toBe(59.15);
    expect(result.finalCustomerPrice).toBe(650.6);
  });

  it("persists updated rates into DB and retrieves them", async () => {
    const mockRow = {
      key: "charter_pricing_config",
      value: JSON.stringify({
        ...PUNCHBOWL_DEFAULT_PRICING,
        gstPercent: 12,
      }),
    };

    (prisma.schedulingSetting.findUnique as any).mockResolvedValue(mockRow);
    const config = await getCharterPricingConfig();
    expect(config.gstPercent).toBe(12);

    const updated = await updateCharterPricingConfig({ gstPercent: 10 });
    expect(updated.gstPercent).toBe(10);
    expect(updated.coachKmRates).toEqual(PUNCHBOWL_DEFAULT_PRICING.coachKmRates);
    expect(prisma.schedulingSetting.upsert).toHaveBeenCalled();
  });

  it.each([
    { gstPercent: -1 },
    { gstPercent: 101 },
    { gstPercent: "10" },
    { lateDepartureFeePerHour: Infinity },
    { coachKmRates: [] },
    { driverWages: null },
    { busKmRates: [{ maxKm: 65, label: "65 km", ratePerKm: -1 }] },
    { coachKmRates: [...PUNCHBOWL_DEFAULT_PRICING.coachKmRates].reverse() },
    { driverWages: [...PUNCHBOWL_DEFAULT_PRICING.driverWages].reverse() },
  ])("rejects invalid pricing before accessing persistence: %j", async (input) => {
    vi.mocked(prisma.schedulingSetting.findUnique).mockClear();
    vi.mocked(prisma.schedulingSetting.upsert).mockClear();
    await expect(updateCharterPricingConfig(input)).rejects.toThrow();
    expect(prisma.schedulingSetting.findUnique).not.toHaveBeenCalled();
    expect(prisma.schedulingSetting.upsert).not.toHaveBeenCalled();
  });
});
