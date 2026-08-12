import type { Request, Response, NextFunction } from "express";
import HttpError from "../models/errorModel.js";
import * as CustomerService from "../services/customerService.js";

// GET /customers/search?q=...
export const searchCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = (req.query.q as string) || '';
        if (query.length < 2) {
            res.json([]);
            return;
        }
        const results = await CustomerService.searchCustomers(query);
        res.json(results);
    } catch (error) {
        console.error("Error searching customers:", error);
        next(new HttpError("Failed to search customers", 500));
    }
};

// GET /customers
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customers = await CustomerService.getAllCustomers();
        res.json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        next(new HttpError("Failed to fetch customers", 500));
    }
};

// GET /customers/:id
export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customer = await CustomerService.getCustomerById(Number(req.params.id));
        if (!customer) {
            res.status(404).json({ error: "Customer not found" });
            return;
        }
        res.json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        next(new HttpError("Failed to fetch customer", 500));
    }
};

// POST /customers
export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.body.email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }
        const newCustomer = await CustomerService.createCustomer(req.body);
        res.status(201).json(newCustomer);
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
        const updatedCustomer = await CustomerService.updateCustomer(Number(req.params.id), req.body);
        res.json(updatedCustomer);
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
        const result = await CustomerService.softDeleteCustomer(Number(req.params.id));
        res.json(result);
    } catch (error: any) {
        console.error("Error deleting customer:", error);
        next(new HttpError("Failed to delete customer", 500));
    }
};
