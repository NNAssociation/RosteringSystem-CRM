import { prisma } from "../db.js";
import { changeRecordLifecycle } from "./recordLifecycle.js";
import type { CreateCustomerInput, UpdateCustomerInput } from "../validators/customerSchema.js";

// ── Response Mapper ───────────────────────────────────────

function toCustomerResponse(customer: any) {
  return {
    ...customer,
    status: customer.isActive ? "Active" : "Inactive",
  };
}

// ── Service Methods ───────────────────────────────────────

export async function getAllCustomers(db: any = prisma) {
  const customers = await db.customer.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return customers.map(toCustomerResponse);
}

export async function getCustomerById(id: number, db: any = prisma) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: { bookings: true },
  });
  if (!customer) return null;
  return toCustomerResponse(customer);
}

export async function createCustomer(input: CreateCustomerInput, db: any = prisma) {
  const newCustomer = await db.customer.create({
    data: {
      email: input.email,
      name: input.name || input.email,
      address: input.address,
      company: input.company,
      phone1: input.phone1,
      phone2: input.phone2,
      customerType: input.customerType,
      contactName: input.contactName,
      contactRole: input.contactRole,
      taxId: input.taxId,
      preferredPaymentMethod: input.preferredPaymentMethod,
      paymentTerms: input.paymentTerms,
      internalNotes: input.internalNotes,
      isVip: input.isVip,
      accountStanding: input.accountStanding,
      isActive: true,
    },
  });
  return toCustomerResponse(newCustomer);
}

export async function updateCustomer(id: number, input: UpdateCustomerInput, db: any = prisma) {
  const updatedCustomer = await db.customer.update({
    where: { id },
    data: {
      email: input.email,
      name: input.name,
      address: input.address,
      company: input.company,
      phone1: input.phone1,
      phone2: input.phone2,
      customerType: input.customerType,
      contactName: input.contactName,
      contactRole: input.contactRole,
      taxId: input.taxId,
      preferredPaymentMethod: input.preferredPaymentMethod,
      paymentTerms: input.paymentTerms,
      internalNotes: input.internalNotes,
      isVip: input.isVip,
      accountStanding: input.accountStanding,
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
  return changeRecordLifecycle("customers", id, false);
}
