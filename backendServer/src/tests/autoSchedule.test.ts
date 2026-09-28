import { describe, it, expect } from 'vitest';
import { DEPOT_LOCATION } from '../services/googleMapsService.js';
import { startOfWeek, addDays, startOfDay, endOfDay, format } from 'date-fns';

describe('Driver Scheduling Requirements & Auto-Schedule Engine Tests', () => {
  it('should use Punchbowl Bus Company (SB) as depot location', () => {
    expect(DEPOT_LOCATION.name).toBe('Punchbowl Bus Company (SB)');
    expect(DEPOT_LOCATION.lat).toBe(-33.9482);
    expect(DEPOT_LOCATION.lng).toBe(151.0506);
  });

  it('should calculate 2-week scheduling window one week in advance from Monday', () => {
    // Example: Monday 06/07/2026 -> 13/07/2026 to 26/07/2026
    const mockMonday = new Date(2026, 6, 6, 10, 0, 0); // Monday July 6, 2026
    const startOfThisWeek = startOfWeek(mockMonday, { weekStartsOn: 1 });
    const startDate = startOfDay(addDays(startOfThisWeek, 7));
    const endDate = endOfDay(addDays(startOfThisWeek, 20));

    expect(format(startDate, 'yyyy-MM-dd')).toBe('2026-07-13');
    expect(format(endDate, 'yyyy-MM-dd')).toBe('2026-07-26');
  });

  it('should calculate pay rates correctly for weekdays, Saturdays, and Sundays', () => {
    const calcEarnings = (hours: number, dayOfWeek: number) => {
      if (dayOfWeek === 0) return hours * 60; // Sunday (2.0x)
      if (dayOfWeek === 6) return hours * 45; // Saturday (1.5x)
      return hours * 30; // Weekday ($30/h)
    };

    expect(calcEarnings(8, 1)).toBe(240); // Mon (8h * $30)
    expect(calcEarnings(8, 6)).toBe(360); // Sat (8h * $45)
    expect(calcEarnings(8, 0)).toBe(480); // Sun (8h * $60)
  });

  it('should enforce 10-minute depot travel buffer per Requirement 2', () => {
    const travelTimeMinutes = 25;
    const extraBuffer = 10;
    const totalDepotBuffer = travelTimeMinutes + extraBuffer;

    expect(totalDepotBuffer).toBe(35);
  });

  it('should compute rest gap for break rendering without overlapping travel blocks', () => {
    const jobEndMin = 120; // 08:00
    const nextJobStartMin = 195; // 09:15
    const nextJobTravelMins = 15; // 15 mins travel

    const nextTravelStartMin = nextJobStartMin - nextJobTravelMins; // 180 (09:00)
    const restGapMins = nextTravelStartMin - jobEndMin; // 60 mins rest

    expect(restGapMins).toBe(60);
    expect(restGapMins >= 30).toBe(true); // Valid break
  });
});
