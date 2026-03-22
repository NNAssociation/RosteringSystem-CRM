import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";
import HttpError from "../models/errorModel.js";

// Helper to format customer for frontend
const formatCustomer = (customer: any) => {
    return {
        ...customer,
        status: customer.isActive ? "Active" : "Inactive"
    };
};

// GET /customers
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customers = await prisma.customer.findMany({
            where: { isActive: true },
            orderBy: { createdAt: "desc" }
        });
        res.json(customers.map(formatCustomer));
    } catch (error) {
        console.error("Error fetching customers:", error);
        next(new HttpError("Failed to fetch customers", 500));
    }
};

// GET /customers/:id
export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: Number(req.params.id) },
            include: { inquiries: true }
        });

        if (!customer) {
            res.status(404).json({ error: "Customer not found" });
            return;
        }

        res.json(formatCustomer(customer));
    } catch (error) {
        console.error("Error fetching customer:", error);
        next(new HttpError("Failed to fetch customer", 500));
    }
};

// POST /customers
export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, name, address, company, phone1, phone2 } = req.body;

        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        const newCustomer = await prisma.customer.create({
            data: {
                email,
                name: name || email,
                address,
                company,
                phone1,
                phone2,
                isActive: true
            },
        });

        res.status(201).json(formatCustomer(newCustomer));
    } catch (error: any) {
        console.error("Error creating customer:", error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: "A customer with this email already exists" });
            return;
        }
        next(new HttpError("Failed to create customer", 500));
    }
};

// PATCH /customers/:id
export const updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, name, address, company, phone1, phone2, isActive } = req.body;

        const updatedCustomer = await prisma.customer.update({
            where: { id: Number(req.params.id) },
            data: {
                email,
                name,
                address,
                company,
                phone1,
                phone2,
                isActive
            },
        });

        res.json(formatCustomer(updatedCustomer));
    } catch (error: any) {
        console.error("Error updating customer:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: "Customer not found" });
            return;
        }
        next(new HttpError("Failed to update customer", 500));
    }
};

// DELETE /customers/:id
export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Soft delete by setting isActive to false
        await prisma.customer.update({
            where: { id: Number(req.params.id) },
            data: { isActive: false },
        });

        res.json({ success: true, id: Number(req.params.id) });
    } catch (error: any) {
        console.error("Error deleting customer:", error);
        next(new HttpError("Failed to delete customer", 500));
    }
};
