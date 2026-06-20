import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createSupplierPayment,
  deleteSupplierPayment,
  getSupplierPaymentById,
  getSupplierPayments,
  updateSupplierPayment,
} from "../controllers/supplierPaymentController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/", authorizePermissions("SUPPLIER_VIEW"), getSupplierPayments);
router.post("/createSupplierPayment", authorizePermissions("SUPPLIER_EDIT", "PARTIAL_PAYMENT_ADD"), createSupplierPayment);
router.get("/getSupplierPaymentsBySupplier/:supplierId", authorizePermissions("SUPPLIER_VIEW"), getSupplierPayments);
router.get("/getSupplierPaymentById/:id", authorizePermissions("SUPPLIER_VIEW"), getSupplierPaymentById);
router.put("/updateSupplierPayment/:id", authorizePermissions("SUPPLIER_EDIT", "PARTIAL_PAYMENT_ADD"), updateSupplierPayment);
router.delete("/deleteSupplierPayment/:id", authorizePermissions("SUPPLIER_EDIT", "SUPPLIER_DELETE", "PARTIAL_PAYMENT_ADD"), deleteSupplierPayment);

export default router;
