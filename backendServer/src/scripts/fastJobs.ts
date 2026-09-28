import { prisma } from "../db.js";
import { addDays, setHours, setMinutes, startOfDay, format } from "date-fns";

const LOCATIONS = [
  { name: "Punchbowl Bus Company (SB)", lat: -33.9482, lng: 151.0506 },
  { name: "Sydney Airport T1", lat: -33.9399, lng: 151.1753 },
  { name: "Sydney Opera House", lat: -33.8568, lng: 151.2153 },
  { name: "Central Station, Sydney", lat: -33.8832, lng: 151.2070 },
  { name: "Parramatta Interchange", lat: -33.8175, lng: 151.0020 },
  { name: "Bondi Beach Pavilion", lat: -33.8915, lng: 151.2767 },
  { name: "Manly Wharf", lat: -33.7997, lng: 151.2847 },
  { name: "Chatswood Station", lat: -33.7981, lng: 151.1810 },
  { name: "Sydney Olympic Park", lat: -33.8475, lng: 151.0664 },
  { name: "Strathfield Bus Hub", lat: -33.8708, lng: 151.0872 },
];

async function create50JobsForAug18_19_20() {
  console.log("🧹 Clearing all existing assignments, duty spans, jobs, and bookings...");

  await prisma.$executeRawUnsafe(`DELETE FROM "Assignment";`);
  await prisma.$executeRawUnsafe(`DELETE FROM "DriverAvailability" WHERE "reason" = 'Duty Span';`);
  await prisma.$executeRawUnsafe(`DELETE FROM "AutoScheduleRun";`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Job";`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Booking";`);

  console.log("✅ Cleared database.");

  // Get or create customer
  let cust = await prisma.customer.findFirst();
  if (!cust) {
    cust = await prisma.customer.create({
      data: { email: "charter@sydney.com", name: "Sydney Charter Co", phone1: "0400000000" }
    });
  }

  // Exact dates: August 18, 19, 20 (2026-08-18 to 2026-08-20)
  const startDate = new Date(2026, 7, 18); // 18 August 2026
  const totalDays = 3; // 18 Aug, 19 Aug, 20 Aug 2026
  const TARGET_JOBS = 50;

  // Hourly slots strictly between 07:00 and 18:00
  const slotTemplates = [
    { startH: 7, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 7, startM: 30, dur: 2.0, type: "round_trip", returnH: 14, returnM: 0 },
    { startH: 8, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 8, startM: 30, dur: 2.0, type: "round_trip", returnH: 14, returnM: 30 },
    { startH: 9, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 9, startM: 30, dur: 1.5, type: "one_way" },
    { startH: 10, startM: 0, dur: 2.0, type: "round_trip", returnH: 15, returnM: 0 },
    { startH: 10, startM: 30, dur: 1.5, type: "one_way" },
    { startH: 11, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 11, startM: 30, dur: 2.0, type: "round_trip", returnH: 15, returnM: 30 },
    { startH: 12, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 13, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 14, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 15, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 16, startM: 0, dur: 1.5, type: "one_way" }, // Ends at 17:30
  ];

  let bookingCount = 0;
  let jobCount = 0;

  console.log(`📅 Generating exactly ${TARGET_JOBS} unassigned jobs across August 18, 19, 20 (2026-08-18 to 2026-08-20) strictly between 07:00 AM and 06:00 PM...`);

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    if (jobCount >= TARGET_JOBS) break;

    const currentDay = addDays(startDate, dayOffset);
    const dayStr = format(currentDay, "yyyy-MM-dd");

    for (let sIdx = 0; sIdx < slotTemplates.length; sIdx++) {
      if (jobCount >= TARGET_JOBS) break;

      const slot = slotTemplates[sIdx]!;
      const loc1 = LOCATIONS[(sIdx + dayOffset) % LOCATIONS.length]!;
      const loc2 = LOCATIONS[(sIdx + dayOffset + 3) % LOCATIONS.length]!;

      const startDateTime = setMinutes(setHours(startOfDay(currentDay), slot.startH), slot.startM);
      const endDateTime = new Date(startDateTime.getTime() + slot.dur * 3600000);

      // Verify strict 07:00 - 18:00 range
      if (startDateTime.getHours() < 7 || endDateTime.getHours() > 18 || (endDateTime.getHours() === 18 && endDateTime.getMinutes() > 0)) {
        continue;
      }

      if (slot.type === "one_way") {
        const bk = await prisma.booking.create({
          data: {
            subject: `Transfer: ${loc1.name} → ${loc2.name}`,
            inquiryDetails: `One-way transfer on ${dayStr}`,
            status: "OPEN",
            bookingType: "one_way",
            customerId: cust.id,
            passengerCount: 15,
            noOfVehicles: 1,
            startDateTime,
            endDateTime,
            startLocation: loc1.name,
            endLocation: loc2.name,
            pickupLat: loc1.lat,
            pickupLng: loc1.lng,
            dropoffLat: loc2.lat,
            dropoffLng: loc2.lng,
          }
        });

        await prisma.job.create({
          data: {
            bookingId: bk.id,
            status: "UNASSIGNED",
            jobStartLocation: loc1.name,
            jobEndLocation: loc2.name,
            jobStartDateTime: startDateTime,
            jobEndDateTime: endDateTime,
            jobStartLat: loc1.lat,
            jobStartLng: loc1.lng,
            jobEndLat: loc2.lat,
            jobEndLng: loc2.lng,
            durationHours: slot.dur,
          }
        });

        bookingCount++;
        jobCount += 1;
      } else if (slot.type === "round_trip" && slot.returnH) {
        if (jobCount + 2 > TARGET_JOBS) {
          const bk = await prisma.booking.create({
            data: {
              subject: `Transfer: ${loc1.name} → ${loc2.name}`,
              inquiryDetails: `One-way transfer on ${dayStr}`,
              status: "OPEN",
              bookingType: "one_way",
              customerId: cust.id,
              passengerCount: 15,
              noOfVehicles: 1,
              startDateTime,
              endDateTime,
              startLocation: loc1.name,
              endLocation: loc2.name,
              pickupLat: loc1.lat,
              pickupLng: loc1.lng,
              dropoffLat: loc2.lat,
              dropoffLng: loc2.lng,
            }
          });

          await prisma.job.create({
            data: {
              bookingId: bk.id,
              status: "UNASSIGNED",
              jobStartLocation: loc1.name,
              jobEndLocation: loc2.name,
              jobStartDateTime: startDateTime,
              jobEndDateTime: endDateTime,
              jobStartLat: loc1.lat,
              jobStartLng: loc1.lng,
              jobEndLat: loc2.lat,
              jobEndLng: loc2.lng,
              durationHours: slot.dur,
            }
          });

          bookingCount++;
          jobCount += 1;
          continue;
        }

        const returnStartDateTime = setMinutes(setHours(startOfDay(currentDay), slot.returnH), slot.returnM || 0);
        const returnEndDateTime = new Date(returnStartDateTime.getTime() + slot.dur * 3600000);

        if (returnEndDateTime.getHours() > 18 || (returnEndDateTime.getHours() === 18 && returnEndDateTime.getMinutes() > 0)) {
          continue;
        }

        const bk = await prisma.booking.create({
          data: {
            subject: `Excursion: ${loc1.name} ↔ ${loc2.name}`,
            inquiryDetails: `Round trip excursion on ${dayStr}`,
            status: "OPEN",
            bookingType: "round_trip",
            customerId: cust.id,
            passengerCount: 20,
            noOfVehicles: 1,
            startDateTime,
            endDateTime: returnEndDateTime,
            returnDateTime: returnStartDateTime,
            startLocation: loc1.name,
            endLocation: loc2.name,
            pickupLat: loc1.lat,
            pickupLng: loc1.lng,
            dropoffLat: loc2.lat,
            dropoffLng: loc2.lng,
          }
        });

        await prisma.job.createMany({
          data: [
            {
              bookingId: bk.id,
              status: "UNASSIGNED",
              jobStartLocation: loc1.name,
              jobEndLocation: loc2.name,
              jobStartDateTime: startDateTime,
              jobEndDateTime: endDateTime,
              jobStartLat: loc1.lat,
              jobStartLng: loc1.lng,
              jobEndLat: loc2.lat,
              jobEndLng: loc2.lng,
              durationHours: slot.dur,
            },
            {
              bookingId: bk.id,
              status: "UNASSIGNED",
              jobStartLocation: loc2.name,
              jobEndLocation: loc1.name,
              jobStartDateTime: returnStartDateTime,
              jobEndDateTime: returnEndDateTime,
              jobStartLat: loc2.lat,
              jobStartLng: loc2.lng,
              jobEndLat: loc1.lat,
              jobEndLng: loc1.lng,
              durationHours: slot.dur,
            }
          ]
        });

        bookingCount++;
        jobCount += 2;
      }
    }
  }

  console.log(`🎉 SUCCESS! Created ${bookingCount} bookings containing EXACTLY ${jobCount} unassigned jobs across August 18, 19, 20 (2026-08-18 to 2026-08-20). All jobs fall strictly between 07:00 AM and 06:00 PM!`);
}

create50JobsForAug18_19_20()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
