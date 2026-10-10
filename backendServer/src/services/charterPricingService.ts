import { prisma } from "../db.js";
import {
  charterPricingSchema,
  charterPricingUpdateSchema,
} from "../validators/charterPricingSchema.js";

export interface DistanceBandRate {
  maxKm: number;
  label: string;
  ratePerKm: number;
}

export interface DriverHourlyWage {
  hours: number;
  weekdayRate: number;
  weekendRate: number;
}

export interface SpecialCharterRate {
  id: string;
  name: string;
  beforeGst: number;
  gst: number;
  customerPrice: number;
  description?: string | undefined;
}

export interface CharterPricingConfig {
  companyName: string;
  gstPercent: number;
  lateDepartureFeePerHour: number;
  coachKmRates: DistanceBandRate[];
  busKmRates: DistanceBandRate[];
  driverWages: DriverHourlyWage[];
  specialRates: SpecialCharterRate[];
  termsAndConditions: string;
}

export const PUNCHBOWL_DEFAULT_PRICING: CharterPricingConfig = {
  companyName: "Punchbowl Bus Company Pty Ltd",
  gstPercent: 10,
  lateDepartureFeePerHour: 100.0,
  coachKmRates: [
    { maxKm: 65, label: "65 km", ratePerKm: 8.33 },
    { maxKm: 100, label: "100 km", ratePerKm: 5.76 },
    { maxKm: 130, label: "130 km+", ratePerKm: 4.61 },
  ],
  busKmRates: [
    { maxKm: 65, label: "65 km", ratePerKm: 4.05 },
    { maxKm: 100, label: "100 km", ratePerKm: 4.36 },
    { maxKm: 130, label: "130 km+", ratePerKm: 4.03 },
  ],
  driverWages: [
    { hours: 8, weekdayRate: 464.73, weekendRate: 489.86 },
    { hours: 9, weekdayRate: 523.65, weekendRate: 548.73 },
    { hours: 10, weekdayRate: 582.54, weekendRate: 607.62 },
    { hours: 11, weekdayRate: 613.6, weekendRate: 666.52 },
    { hours: 12, weekdayRate: 644.66, weekendRate: 725.43 },
    { hours: 13, weekdayRate: 759.2, weekendRate: 803.4 },
    { hours: 14, weekdayRate: 837.75, weekendRate: 882.48 },
    { hours: 15, weekdayRate: 917.13, weekendRate: 960.89 },
    { hours: 16, weekdayRate: 994.79, weekendRate: 1039.52 },
    { hours: 17, weekdayRate: 1073.32, weekendRate: 1133.42 },
    { hours: 18, weekdayRate: 1151.85, weekendRate: 1196.59 },
    { hours: 19, weekdayRate: 1230.39, weekendRate: 1275.27 },
    { hours: 20, weekdayRate: 1308.89, weekendRate: 1353.64 },
  ],
  specialRates: [
    {
      id: "coach-cancellation",
      name: "Coach Cancellation",
      beforeGst: 422.73,
      gst: 42.27,
      customerPrice: 465.0,
      description: "Applies if cancelled on short notice (<24 hours)",
    },
    {
      id: "bus-cancellation",
      name: "Bus Cancellation",
      beforeGst: 340.0,
      gst: 34.0,
      customerPrice: 374.0,
      description: "Applies if cancelled on short notice (<24 hours)",
    },
    {
      id: "canberra-school",
      name: "One Day Canberra - School Only",
      beforeGst: 3298.18,
      gst: 329.82,
      customerPrice: 3628.0,
      description: "Fixed all-inclusive day excursion rate",
    },
    {
      id: "lay-day",
      name: "Lay Day",
      beforeGst: 420.0,
      gst: 42.0,
      customerPrice: 462.0,
      description: "Non-travel vehicle standby day rate",
    },
    {
      id: "local-school-homebush",
      name: "Local School Drop & Return - Homebush",
      beforeGst: 597.27,
      gst: 59.73,
      customerPrice: 657.0,
      description: "Standard school transfer return package",
    },
  ],
  termsAndConditions: `THIS IS NOT A BOOKING, IT IS A QUOTE ONLY

TERMS AND CONDITIONS
- Should a vehicle need to be cancelled, we require at least 24 hours notice or a cancellation fee may apply.
- If booking is cancelled on the day of charter, full payment may still be due.
- If departing venue any later than booked time, an additional fee of $100.00 per hour will apply.
- Hirer's are to keep a passenger listing of persons on the charter.
- E&OE = errors and omissions excepted`,
};

const SETTING_KEY = "charter_pricing_config";

/**
 * Retrieve the active charter pricing configuration from the database,
 * falling back to Punchbowl Bus defaults.
 */
export async function getCharterPricingConfig(): Promise<CharterPricingConfig> {
  const row = await prisma.schedulingSetting.findUnique({
    where: { key: SETTING_KEY },
  });

  if (!row?.value) {
    return PUNCHBOWL_DEFAULT_PRICING;
  }

  try {
    const parsed = JSON.parse(row.value) as Partial<CharterPricingConfig>;
    return {
      companyName: parsed.companyName || PUNCHBOWL_DEFAULT_PRICING.companyName,
      gstPercent: parsed.gstPercent ?? PUNCHBOWL_DEFAULT_PRICING.gstPercent,
      lateDepartureFeePerHour:
        parsed.lateDepartureFeePerHour ?? PUNCHBOWL_DEFAULT_PRICING.lateDepartureFeePerHour,
      coachKmRates: parsed.coachKmRates || PUNCHBOWL_DEFAULT_PRICING.coachKmRates,
      busKmRates: parsed.busKmRates || PUNCHBOWL_DEFAULT_PRICING.busKmRates,
      driverWages: parsed.driverWages || PUNCHBOWL_DEFAULT_PRICING.driverWages,
      specialRates: parsed.specialRates || PUNCHBOWL_DEFAULT_PRICING.specialRates,
      termsAndConditions: parsed.termsAndConditions || PUNCHBOWL_DEFAULT_PRICING.termsAndConditions,
    };
  } catch {
    return PUNCHBOWL_DEFAULT_PRICING;
  }
}

/**
 * Update the active charter pricing configuration.
 */
export async function updateCharterPricingConfig(config: unknown): Promise<CharterPricingConfig> {
  const update = charterPricingUpdateSchema.parse(config);
  const current = await getCharterPricingConfig();
  const merged = charterPricingSchema.parse({
    ...current,
    ...update,
  });

  await prisma.schedulingSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      value: JSON.stringify(merged),
      description: "Punchbowl Bus Company Charter Pricing Rate Tables & Terms",
    },
    update: {
      value: JSON.stringify(merged),
    },
  });

  return merged;
}

export interface CalculateCharterInput {
  vehicleType: "Coach" | "Bus";
  vehicleCount?: number | undefined;
  distanceKm: number;
  charterDate?: string | undefined;
  startTime?: string | undefined;
  finishTime?: string | undefined;
  totalHours?: number | undefined;
  manualAdjustment?: number | undefined;
}

export interface InternalLaborBreakdown {
  dutySpanHours: number;
  dayType: "Weekday" | "Weekend";
  driverWageTierCost: number;
  totalDriverWageCost: number;
  vehicleDistanceCost: number;
  totalOperationalCost: number;
  estimatedGrossMargin: number;
}

export interface CalculateCharterResult {
  vehicleType: "Coach" | "Bus";
  vehicleCount: number;
  distanceKm: number;
  totalHours: number;
  dayType: "Weekday" | "Weekend";
  ratePerKm: number;
  distanceCost: number;
  driverWageCost: number;
  subtotalBeforeGst: number;
  manualAdjustment: number;
  gstRate: number;
  gstAmount: number;
  finalCustomerPrice: number;
  internalBreakdown: InternalLaborBreakdown;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }>;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Rate-based calculation engine according to Punchbowl Bus Company requirements:
 * Price before GST = Distance Charge (x vehicle count) + Manual Adjustment
 * Final Customer Price = Price before GST + 10% GST
 * Driver wage costs are tracked internally for margin and operational budgeting.
 */
export function calculateCharterPrice(
  config: CharterPricingConfig,
  input: CalculateCharterInput,
): CalculateCharterResult {
  const {
    vehicleType,
    distanceKm,
    charterDate,
    startTime = "08:00",
    finishTime = "17:00",
    manualAdjustment = 0,
  } = input;

  const vehicleCount = Math.max(1, input.vehicleCount ?? 1);

  // 1. Determine Day Type (Weekday vs Weekend)
  let dayType: "Weekday" | "Weekend" = "Weekday";
  if (charterDate) {
    const d = new Date(`${charterDate}T12:00:00Z`);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) {
      dayType = "Weekend";
    }
  }

  // 2. Determine Total Hours
  let totalHours = input.totalHours;
  if (!totalHours) {
    const [sH, sM] = startTime.split(":").map(Number);
    const [fH, fM] = finishTime.split(":").map(Number);
    const startMinutes = (sH || 8) * 60 + (sM || 0);
    const finishMinutes = (fH || 17) * 60 + (fM || 0);
    let diffMinutes = finishMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight
    totalHours = Math.max(8, Math.round(diffMinutes / 60)); // Minimum 8-hour charter block
  }
  totalHours = Math.min(20, Math.max(8, Math.round(totalHours)));

  // 3. Select Rate per km based on vehicle type and distance band
  const rates = vehicleType === "Coach" ? config.coachKmRates : config.busKmRates;
  let selectedRatePerKm =
    rates[rates.length - 1]?.ratePerKm ?? (vehicleType === "Coach" ? 4.61 : 4.03);

  // Band selection logic: find the first tier where distance <= maxKm
  for (const band of rates) {
    if (distanceKm <= band.maxKm) {
      selectedRatePerKm = band.ratePerKm;
      break;
    }
  }

  // 4. Calculate Distance Charge (scaled by vehicle count)
  const distanceCost = round2(distanceKm * selectedRatePerKm * vehicleCount);

  // 5. Select Internal Driver Wage Cost (for internal operations and margin tracking)
  const wageTier =
    config.driverWages.find((w) => w.hours === totalHours) ||
    config.driverWages[config.driverWages.length - 1];
  const driverWageCost = round2(
    wageTier ? (dayType === "Weekend" ? wageTier.weekendRate : wageTier.weekdayRate) : 500.0,
  );

  // 6. Subtotal, GST, and Total for CLIENT QUOTATION
  // Customer quote is based on the vehicle charter service charge (driver salaries managed separately)
  const subtotalBeforeGst = round2(distanceCost + manualAdjustment);
  const gstRate = (config.gstPercent ?? 10) / 100;
  const gstAmount = round2(subtotalBeforeGst * gstRate);
  const finalCustomerPrice = round2(subtotalBeforeGst + gstAmount);

  // 7. Internal Operational Cost & Margin Breakdown (Option A: Internal Staff Only)
  const totalDriverWageCost = round2(driverWageCost * vehicleCount);
  const totalOperationalCost = round2(distanceCost + totalDriverWageCost);
  const estimatedGrossMargin = round2(subtotalBeforeGst - totalDriverWageCost);

  const internalBreakdown: InternalLaborBreakdown = {
    dutySpanHours: totalHours,
    dayType,
    driverWageTierCost: driverWageCost,
    totalDriverWageCost,
    vehicleDistanceCost: distanceCost,
    totalOperationalCost,
    estimatedGrossMargin,
  };

  // 8. Generate Line Items for CLIENT QUOTATION (Driver wage excluded from client view)
  const vehicleCountLabel = vehicleCount > 1 ? `${vehicleCount}x Vehicles · ` : "";
  const lineItems = [
    {
      description: `${vehicleType} Charter Service (${vehicleCountLabel}${distanceKm} km @ $${selectedRatePerKm.toFixed(2)}/km)`,
      quantity: 1,
      unitPriceMinor: Math.round(distanceCost * 100),
      totalMinor: Math.round(distanceCost * 100),
    },
  ];

  if (manualAdjustment !== 0) {
    lineItems.push({
      description:
        manualAdjustment > 0
          ? "Commercial / Itinerary Adjustment"
          : "Discount / Special Adjustment",
      quantity: 1,
      unitPriceMinor: Math.round(manualAdjustment * 100),
      totalMinor: Math.round(manualAdjustment * 100),
    });
  }

  return {
    vehicleType,
    vehicleCount,
    distanceKm,
    totalHours,
    dayType,
    ratePerKm: selectedRatePerKm,
    distanceCost,
    driverWageCost,
    subtotalBeforeGst,
    manualAdjustment,
    gstRate,
    gstAmount,
    finalCustomerPrice,
    internalBreakdown,
    lineItems,
  };
}
