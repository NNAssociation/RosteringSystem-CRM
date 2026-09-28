import { Router } from "express";
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, searchCustomers } from "../controllers/customerController.js";
import { requireClerkAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/search", searchCustomers);  // Must be before /:id
router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.post("/", createCustomer);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;
