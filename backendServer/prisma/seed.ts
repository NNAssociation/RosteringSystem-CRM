// prisma/seed.ts
import { prisma } from "../src/db.ts";

async function main() {
  console.log("🌱 Starting seeding...");

  // 1. Seed Roles
  const adminRole = await prisma.role.upsert({
    where: { roleName: "ADMIN" },
    update: {},
    create: {
      roleName: "ADMIN",
      description: "System Administrator with full access",
    },
  });

  const driverRole = await prisma.role.upsert({
    where: { roleName: "DRIVER" },
    update: {},
    create: {
      roleName: "DRIVER",
      description: "Vehicle driver with limited access to jobs",
    },
  });

  const customerRole = await prisma.role.upsert({
    where: { roleName: "CUSTOMER" },
    update: {},
    create: {
      roleName: "CUSTOMER",
      description: "Client who can create inquiries",
    },
  });

  console.log("✅ Roles seeded");

  // 2. Seed a User with Profile and Role
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@system.com" },
    update: {},
    create: {
      email: "admin@system.com",
      name: "Main Admin",
      isActive: true,
      profile: {
        create: {
          address: "123 Tech Lane, Sydney",
          phoneNumber1: "0400000000",
          occupation: "Administrator",
        },
      },
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  console.log(`✅ Admin user created: ${adminUser.email}`);

  // 3. Seed a Driver
  await prisma.user.upsert({
    where: { email: "driver1@test.com" },
    update: {},
    create: {
      email: "driver1@test.com",
      name: "John Driver",
      profile: {
        create: {
          address: "456 Road St, Melbourne",
          driverLicense: "LIC123456",
          maxfatigueMinutes: 600, // 10 hours
        },
      },
      roles: {
        create: {
          roleId: driverRole.id,
        },
      },
    },
  });

  // 4. Seed a Customer
  const customer = await prisma.customer.upsert({
    where: { email: "client@company.com" },
    update: {},
    create: {
      email: "client@company.com",
      name: "Sarah Smith",
      company: "Logistics Pro",
      phone1: "0299999999",
    },
  });

  // 5. Seed a Fleet Vehicle
  await prisma.fleetVehicle.upsert({
    where: { licensePlate: "ABC-123" },
    update: {},
    create: {
      licensePlate: "ABC-123",
      make: "Toyota",
      model: "HiAce",
      year: 2023,
      vin: "VIN789456123",
      status: "ACTIVE",
      maxPassengers: 12,
    },
  });

  console.log("🌱 Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
