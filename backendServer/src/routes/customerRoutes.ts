import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  searchCustomers,
  updateCustomer,
} from "../controllers/customerController.js";

const router = Router();

router.get("/search", searchCustomers); // Must be before /:id
router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.post("/", createCustomer);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;
