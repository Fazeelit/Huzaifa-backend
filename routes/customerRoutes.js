import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", authorizePermissions("CUSTOMER_VIEW"), getAllCustomers);
router.get("/:id", authorizePermissions("CUSTOMER_VIEW"), getCustomerById);
router.post("/createCustomer", authorizePermissions("CUSTOMER_CREATE"), createCustomer);
router.put("/:id", authorizePermissions("CUSTOMER_EDIT"), updateCustomer);
router.delete("/:id", authorizePermissions("CUSTOMER_DELETE"), deleteCustomer);

export default router;
