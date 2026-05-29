import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  paySupplierBill,
  payAllSupplierBills,
  deleteSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/", authorizePermissions("SUPPLIER_VIEW"), getSuppliers);            // Get all suppliers
router.post("/createSupplier", authorizePermissions("SUPPLIER_CREATE"), createSupplier);          // Create supplier
router.get("/:id", authorizePermissions("SUPPLIER_VIEW"), getSupplierById);      // Get supplier by ID
router.post("/:id/bills/pay-all", authorizePermissions("SUPPLIER_EDIT"), payAllSupplierBills);
router.post("/:id/bills/:billId/payment", authorizePermissions("SUPPLIER_EDIT"), paySupplierBill);
router.put("/:id", authorizePermissions("SUPPLIER_EDIT"), updateSupplier);       // Update supplier (REST-style)
router.put("/updateSupplier/:id", authorizePermissions("SUPPLIER_EDIT"), updateSupplier);       // Update supplier
router.delete("/:id", authorizePermissions("SUPPLIER_DELETE"), deleteSupplier);    // Delete supplier (REST-style)
router.delete("/deleteSupplier/:id", authorizePermissions("SUPPLIER_DELETE"), deleteSupplier);    // Delete supplier

// Export router at the end
export default router;
