import { prisma } from "../db.js";
import type { CreateCustomerInput, UpdateCustomerInput } from "../validators/customerSchema.js";

// ── Response Mapper ───────────────────────────────────────

function toCustomerResponse(customer: any) {
  return {
    ...customer,
    status: customer.isActive ? "Active" : "Inactive",
  };
}

// ── Service Methods ───────────────────────────────────────

export async function getAllCustomers() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return customers.map(toCustomerResponse);
}

export async function getCustomerById(id: number) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { bookings: true },
  });
  if (!customer) return null;
  return toCustomerResponse(customer);
}

export async function createCustomer(input: CreateCustomerInput) {
  const newCustomer = await prisma.customer.create({
    data: {
      email: input.email,
      name: input.name || input.email,
      address: input.address,
      company: input.company,
      phone1: input.phone1,
      phone2: input.phone2,
      isActive: true,
    },
  });
  return toCustomerResponse(newCustomer);
}

export async function updateCustomer(id: number, input: UpdateCustomerInput) {
  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: {
      email: input.email,
      name: input.name,
      address: input.address,
      company: input.company,
      phone1: input.phone1,
      phone2: input.phone2,
      isActive: input.isActive,
    },
  });
  return toCustomerResponse(updatedCustomer);
}

export async function searchCustomers(query: string) {
  return prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone1: { contains: query } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone1: true,
      company: true,
    },
    take: 10,
    orderBy: { name: "asc" },
  });
}

export async function softDeleteCustomer(id: number) {
  await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });
  return { success: true, id };
}
