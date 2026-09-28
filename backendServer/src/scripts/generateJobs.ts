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

async function generateJobs() {
  console.log("🧹 Clearing old assignments, duty spans, jobs, and bookings...");

  await prisma.assignment.deleteMany({});
  await prisma.driverAvailability.deleteMany({ where: { reason: "Duty Span" } });
  await prisma.autoScheduleRun.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.booking.deleteMany({});

  console.log("✅ Database cleared of old assignments and jobs.");

  const customerNames = ["Corporate Charter NSW", "Sydney Event Tours", "Metro Schools Union", "Pacific Travel Group", "Apex Senior Outings"];
  const customerIds: number[] = [];
  for (let i = 0; i < customerNames.length; i++) {
    const c = await prisma.customer.upsert({
      where: { email: `customer${i + 1}@charter.com` },
      update: {},
      create: {
        email: `customer${i + 1}@charter.com`,
        name: customerNames[i],
        company: customerNames[i],
        phone1: `041234560${i}`,
      },
    });
    customerIds.push(c.id);
  }

  const startDate = new Date(2026, 7, 17); // 17 August 2026
  const totalDays = 15; // 17 Aug - 31 Aug 2026

  console.log(`📅 Bulk generating unassigned jobs across ${totalDays} days (${format(startDate, 'yyyy-MM-dd')} to ${format(addDays(startDate, 14), 'yyyy-MM-dd')}) strictly between 07:00 AM and 06:00 PM...`);

  const daySlots = [
    { startH: 7, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 7, startM: 30, dur: 2.0, type: "round_trip", returnH: 14, returnM: 0 },
    { startH: 8, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 8, startM: 30, dur: 2.0, type: "round_trip", returnH: 15, returnM: 0 },
    { startH: 9, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 9, startM: 30, dur: 1.5, type: "one_way" },
    { startH: 10, startM: 0, dur: 2.0, type: "round_trip", returnH: 16, returnM: 0 },
    { startH: 10, startM: 30, dur: 1.5, type: "one_way" },
    { startH: 11, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 11, startM: 30, dur: 2.0, type: "round_trip", returnH: 16, returnM: 0 },
    { startH: 12, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 13, startM: 0, dur: 1.5, type: "one_way" },
    { startH: 14, startM: 30, dur: 1.5, type: "one_way" },
    { startH: 16, startM: 0, dur: 1.5, type: "one_way" }, // Ends at 17:30
  ];

  let jobCount = 0;
  let bookingCount = 0;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDay = addDays(startDate, dayOffset);
    const dayStr = format(currentDay, 'yyyy-MM-dd');

    for (let sIdx = 0; sIdx < daySlots.length; sIdx++) {
      const slot = daySlots[sIdx]!;
      const customerId = customerIds[sIdx % customerIds.length]!;

      const loc1 = LOCATIONS[(sIdx + dayOffset) % LOCATIONS.length]!;
      const loc2 = LOCATIONS[(sIdx + dayOffset + 3) % LOCATIONS.length]!;

      const startDateTime = setMinutes(setHours(startOfDay(currentDay), slot.startH), slot.startM);
      const endDateTime = new Date(startDateTime.getTime() + slot.dur * 3600000);

      if (startDateTime.getHours() < 7 || endDateTime.getHours() > 18 || (endDateTime.getHours() === 18 && endDateTime.getMinutes() > 0)) {
        continue;
      }

      if (slot.type === "one_way") {
        const booking = await prisma.booking.create({
          data: {
            subject: `Transfer: ${loc1.name} to ${loc2.name}`,
            inquiryDetails: `One-way passenger transfer on ${dayStr}`,
            status: "OPEN",
            bookingType: "one_way",
            customerId,
            passengerCount: 10 + ((sIdx * 3) % 15),
            noOfVehicles: 1,
            startDateTime,
            endDateTime,
            startLocation: loc1.name,
            endLocation: loc2.name,
            pickupLat: loc1.lat,
            pickupLng: loc1.lng,
            dropoffLat: loc2.lat,
            dropoffLng: loc2.lng,
            jobs: {
              create: {
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
            }
          },
        });
        bookingCount++;
        jobCount += 1;

      } else if (slot.type === "round_trip" && slot.returnH) {
        const returnStartDateTime = setMinutes(setHours(startOfDay(currentDay), slot.returnH), slot.returnM || 0);
        const returnEndDateTime = new Date(returnStartDateTime.getTime() + slot.dur * 3600000);

        if (returnEndDateTime.getHours() > 18 || (returnEndDateTime.getHours() === 18 && returnEndDateTime.getMinutes() > 0)) {
          continue;
        }

        const booking = await prisma.booking.create({
          data: {
            subject: `Excursion: ${loc1.name} <-> ${loc2.name}`,
            inquiryDetails: `Round trip excursion on ${dayStr}`,
            status: "OPEN",
            bookingType: "round_trip",
            customerId,
            passengerCount: 12 + ((sIdx * 2) % 10),
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
            jobs: {
              create: [
                {
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
            }
          },
        });
        bookingCount++;
        jobCount += 2;
      }
    }
  }

  console.log(`🎉 SUCCESS! Created ${bookingCount} bookings containing ${jobCount} unassigned jobs across 15 days (${format(startDate, 'yyyy-MM-dd')} to ${format(addDays(startDate, 14), 'yyyy-MM-dd')}). All jobs fall strictly between 07:00 AM and 06:00 PM!`);
}

generateJobs()
  .catch((err) => {
    console.error("❌ Job generation failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
