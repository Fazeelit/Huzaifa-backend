import express from "express";

import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

/* =========================================
   CUSTOMER ROUTES
========================================= */

/* CREATE CUSTOMER */
router.post("/createCustomer", createCustomer);

/* GET ALL CUSTOMERS */
router.get("/", getAllCustomers);
router.get("/customers", getAllCustomers);

/* GET CUSTOMER BY ID */
router.get("/:id", getCustomerById);
router.get("/customers/:id", getCustomerById);

/* UPDATE CUSTOMER */
router.put("/:id", updateCustomer);
router.patch("/:id", updateCustomer);
router.put("/updateCustomer/:id", updateCustomer);

/* DELETE CUSTOMER */
router.delete("/:id", deleteCustomer);
router.delete("/customers/:id", deleteCustomer);

export default router;
