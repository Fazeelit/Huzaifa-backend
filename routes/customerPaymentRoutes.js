import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createCustomerPayment,
  deleteCustomerPayment,
  getCustomerPaymentById,
  getCustomerPayments,
  updateCustomerPayment,
} from "../controllers/customerPaymentController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/", authorizePermissions("CUSTOMER_VIEW"), getCustomerPayments);
router.post("/createCustomerPayment", authorizePermissions("CUSTOMER_EDIT", "PARTIAL_PAYMENT_ADD"), createCustomerPayment);
router.get("/getCustomerPaymentsByCustomer/:customerId", authorizePermissions("CUSTOMER_VIEW"), getCustomerPayments);
router.get("/getCustomerPaymentById/:id", authorizePermissions("CUSTOMER_VIEW"), getCustomerPaymentById);
router.put("/updateCustomerPayment/:id", authorizePermissions("CUSTOMER_EDIT", "PARTIAL_PAYMENT_ADD"), updateCustomerPayment);
router.delete("/deleteCustomerPayment/:id", authorizePermissions("CUSTOMER_EDIT", "CUSTOMER_DELETE", "PARTIAL_PAYMENT_ADD"), deleteCustomerPayment);

export default router;
